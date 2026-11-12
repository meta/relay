/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! Selections on a server interface that client-defined types implement.
//!
//! A position typed by a server interface can hold server objects and objects
//! of client-defined types (Relay Resolver types, client schema extension
//! types) that implement it. A client-defined type serves its fields with
//! resolvers, where a server object holds the field the server wrote.
//!
//! The server owns its implementors and can add more without a client compile,
//! so the compiler never lists them: the selection stays on the interface, as
//! authored, for every server object. For each type that serves a selected
//! field differently, the compiler adds an inline fragment on that type, a
//! case, with the field as that type defines it:
//!
//! ```text
//! fragment F on ICampaignGroup { name }
//! name
//! ... on CombinedCampaignGroup { name }   # the model's resolver
//! ```
//!
//! These operations run at exec time only (`exec_time_only`): the executor
//! computes a case's resolvers when the query runs and writes their values
//! under the storage keys of the interface's fields, so the reader and the
//! generated types read the selection as authored, and drop the cases
//! (`pipelines`). Normalization keeps the cases, which tell the executor what
//! to compute, and the query text keeps the cases of server types, whose
//! resolvers read server data; a client type never reaches the server.

mod exec_time_only;
mod pipelines;

use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::hash_map::Entry;
use std::sync::Arc;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::Location;
use common::NamedItem;
use common::WithLocation;
use docblock_shared::RELAY_RESOLVER_DIRECTIVE_NAME;
pub use exec_time_only::validate_client_implementor_cases_run_at_exec_time;
use graphql_ir::Condition;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::ScalarField;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::TransformedValue;
use graphql_ir::Transformer;
use graphql_ir::associated_data_impl;
use graphql_ir::transform_list;
use intern::string_key::StringKey;
pub use pipelines::client_implementor_cases_for_normalization;
pub use pipelines::remove_client_implementor_cases;
use relay_schema::client_implementors::client_implementors_of;
use relay_schema::client_implementors::has_client_implementors;
use relay_schema::client_implementors::sort_by_name;
use schema::DirectiveValue;
use schema::Field;
use schema::FieldID;
use schema::InterfaceID;
use schema::ObjectID;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

use crate::ASSIGNABLE_DIRECTIVE;
use crate::CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME;
use crate::UPDATABLE_DIRECTIVE;
use crate::ValidationMessage;
use crate::relay_resolvers_abstract_types::project_interface_selections_to_concrete;

/// Marks an inline fragment the compiler added on a type that serves a
/// selection on the server interface `interface` differently: a case.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ClientImplementorCaseDirective {
    pub interface: InterfaceID,
}
associated_data_impl!(ClientImplementorCaseDirective);

/// Where the records at a position come from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
enum Origin {
    /// A server response, so only server objects: the root of an operation and
    /// a field the server serves.
    Server,
    /// Possibly the client: a fragment, which can be spread anywhere, and a
    /// field the client serves, such as a resolver.
    Any,
}

fn field_origin(field: &Field) -> Origin {
    if field.is_extension {
        Origin::Any
    } else {
        Origin::Server
    }
}

/// Whether `type_` is an object type the server defines: a position of that
/// type holds only its objects, which are server objects.
fn is_server_object_type(schema: &SDLSchema, type_: Type) -> bool {
    match type_ {
        Type::Object(object_id) => !schema.object(object_id).is_extension,
        _ => false,
    }
}

/// Whether the object type `object_id` implements the interface, or belongs to
/// the union, `abstract_type`.
fn is_member_of(schema: &SDLSchema, object_id: ObjectID, abstract_type: Type) -> bool {
    match abstract_type {
        Type::Interface(interface_id) => {
            let mut pending = schema.object(object_id).interfaces.clone();
            let mut seen = vec![];
            while let Some(current) = pending.pop() {
                if current == interface_id {
                    return true;
                }
                if seen.contains(&current) {
                    continue;
                }
                seen.push(current);
                pending.extend_from_slice(&schema.interface(current).interfaces);
            }
            false
        }
        Type::Union(union_id) => schema.union(union_id).members.contains(&object_id),
        _ => false,
    }
}

/// Where the records inside a refinement on `type_condition`, read at
/// `origin`, come from.
fn refined_origin(schema: &SDLSchema, type_condition: Option<Type>, origin: Origin) -> Origin {
    match type_condition {
        Some(type_condition) if is_server_object_type(schema, type_condition) => Origin::Server,
        _ => origin,
    }
}

/// Where the records below `field`, read at `origin`, come from. A field of a
/// server object type holds that type's objects only. On a server interface
/// read where client objects can be, a field that a client-defined implementor
/// serves from the store holds whatever the client wrote there.
fn linked_field_origin(schema: &SDLSchema, field: &Field, origin: Origin) -> Origin {
    if is_server_object_type(schema, field.type_.inner()) {
        return Origin::Server;
    }
    if origin == Origin::Any
        && let Some(parent_type) = field.parent_type
        && has_client_implementors(schema, parent_type)
    {
        return Origin::Any;
    }
    field_origin(field)
}

fn resolver_directive(field: &Field) -> Option<&DirectiveValue> {
    field.directives.named(*RELAY_RESOLVER_DIRECTIVE_NAME)
}

/// Whether `field` is the resolver its type inherits from `interface_field`:
/// reading it on the interface reads the same resolver.
fn is_inherited_resolver(field: &Field, interface_field: &Field) -> bool {
    match (
        resolver_directive(field),
        resolver_directive(interface_field),
    ) {
        (Some(directive), Some(interface_directive)) => {
            same_arguments(directive, interface_directive)
        }
        _ => false,
    }
}

fn same_arguments(directive: &DirectiveValue, other: &DirectiveValue) -> bool {
    if directive.arguments.len() != other.arguments.len() {
        return false;
    }
    for argument in directive.arguments.iter() {
        match other.arguments.named(argument.name) {
            Some(other_argument) if other_argument.value == argument.value => {}
            _ => return false,
        }
    }
    true
}

/// Whether a server type's `field` reads differently from the client field
/// `interface_field` of its interface: its own resolver, or a field the server
/// sends.
fn serves_client_field_differently(field: &Field, interface_field: &Field) -> bool {
    !field.is_extension
        || (resolver_directive(field).is_some() && !is_inherited_resolver(field, interface_field))
}

/// Whether reading `field` on a client-defined type differs from reading the
/// store field the interface selection reads: the type's own resolver. A
/// client schema extension field without a resolver is a store field under the
/// same storage key, and a resolver inherited from the interface is read on the
/// interface.
fn is_served_by_client(field: &Field, interface_field: &Field) -> bool {
    resolver_directive(field).is_some() && !is_inherited_resolver(field, interface_field)
}

/// A divergent selection as the interface declares it, read for server
/// objects. A client field of the interface that a case serves with a client
/// edge is a store field on the interface, so it drops `@waterfall`, which
/// only a client edge accepts.
fn interface_selection(schema: &SDLSchema, selection: &Selection) -> Selection {
    match selection {
        Selection::LinkedField(field)
            if has_waterfall_on_store_field(schema, field.definition.item, &field.directives) =>
        {
            Selection::LinkedField(Arc::new(LinkedField {
                directives: without_directive(
                    &field.directives,
                    *CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME,
                ),
                ..(**field).clone()
            }))
        }
        Selection::ScalarField(field)
            if has_waterfall_on_store_field(schema, field.definition.item, &field.directives) =>
        {
            Selection::ScalarField(Arc::new(ScalarField {
                directives: without_directive(
                    &field.directives,
                    *CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME,
                ),
                ..(**field).clone()
            }))
        }
        _ => selection.clone(),
    }
}

fn has_waterfall_on_store_field(
    schema: &SDLSchema,
    field_id: FieldID,
    directives: &[Directive],
) -> bool {
    directives
        .named(*CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME)
        .is_some()
        && resolver_directive(schema.field(field_id)).is_none()
}

fn without_directive(directives: &[Directive], name: DirectiveName) -> Vec<Directive> {
    let mut kept = Vec::with_capacity(directives.len());
    for directive in directives {
        if directive.name.item != name {
            kept.push(directive.clone());
        }
    }
    kept
}

/// Whether `object_ids` contains every one of `required`.
fn includes_all(object_ids: &[ObjectID], required: &[ObjectID]) -> bool {
    for object_id in required {
        if !object_ids.contains(object_id) {
            return false;
        }
    }
    true
}

pub(crate) fn is_client_field(schema: &SDLSchema, selection: &Selection) -> bool {
    match selection {
        Selection::ScalarField(field) => schema.field(field.definition.item).is_extension,
        Selection::LinkedField(field) => schema.field(field.definition.item).is_extension,
        Selection::Condition(_) | Selection::InlineFragment(_) | Selection::FragmentSpread(_) => {
            false
        }
    }
}

pub(crate) fn is_client_implementor_case(fragment: &InlineFragment) -> bool {
    ClientImplementorCaseDirective::find(&fragment.directives).is_some()
}

/// The server implementors of `interface_id` that read its client field
/// `interface_field` differently from the interface: their own resolver, or a
/// field the server sends.
fn server_cases(
    schema: &SDLSchema,
    interface_id: InterfaceID,
    interface_field: &Field,
) -> Vec<ObjectID> {
    let mut object_ids = vec![];
    for object_id in schema
        .interface(interface_id)
        .recursively_implementing_objects(schema)
    {
        if schema.object(object_id).is_extension {
            continue;
        }
        if let Some(field_id) =
            schema.named_field(Type::Object(object_id), interface_field.name.item)
            && serves_client_field_differently(schema.field(field_id), interface_field)
        {
            object_ids.push(object_id);
        }
    }
    sort_by_name(schema, &mut object_ids);
    object_ids
}

/// Adds the cases of every selection on a server interface that a type the
/// client defines or serves reads differently. See the module comment.
pub fn add_client_implementor_cases(
    program: &Program,
    stream_directive_name: DirectiveName,
) -> DiagnosticsResult<Program> {
    let mut transform = ClientImplementorCases {
        program,
        schema: &program.schema,
        stream_directive_name,
        server_cases: Default::default(),
        parent_types: vec![],
        origin: Origin::Server,
        authored_location: Location::generated(),
        is_updatable: false,
        reported_missing: Default::default(),
        reported_refinements: Default::default(),
        errors: vec![],
    };
    let next_program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());
    if transform.errors.is_empty() {
        Ok(next_program)
    } else {
        Err(transform.errors)
    }
}

/// The cases for the typegen pipeline, so it mints the same client edge
/// queries from them as the operation pipeline. The common pipeline reports
/// the errors.
pub fn add_client_implementor_cases_for_typegen(
    program: &Program,
    stream_directive_name: DirectiveName,
) -> Program {
    match add_client_implementor_cases(program, stream_directive_name) {
        Ok(next_program) => next_program,
        Err(_) => program.clone(),
    }
}

struct ClientImplementorCases<'program> {
    program: &'program Program,
    schema: &'program SDLSchema,
    /// A case drops `@stream` from a field its type serves with a resolver,
    /// which the executor computes whole.
    stream_directive_name: DirectiveName,
    /// `server_cases` per interface and field name.
    server_cases: HashMap<(InterfaceID, StringKey), Vec<ObjectID>>,
    parent_types: Vec<Type>,
    origin: Origin,
    /// The innermost location written in the document: an error about a
    /// selection an earlier transform generated, such as an unmasked spread,
    /// points there.
    authored_location: Location,
    /// Whether the current document is @updatable: its reader AST backs an
    /// updatable proxy, which reads the selection as authored.
    is_updatable: bool,
    /// A missing field is reported once per type and selection.
    reported_missing: HashSet<(Type, Location)>,
    /// A refinement is reported once, though a case reads it again.
    reported_refinements: HashSet<(Type, Location)>,
    errors: Vec<Diagnostic>,
}

impl ClientImplementorCases<'_> {
    /// The types that read `field_id` of `interface_id` differently from the
    /// interface, at the current origin.
    fn cases_for_field(
        &mut self,
        interface_id: InterfaceID,
        client_implementors: &[ObjectID],
        field_id: FieldID,
    ) -> Vec<ObjectID> {
        let schema = self.schema;
        // Relay's own client fields, such as `__id`, read the same on every
        // type.
        if field_id == schema.clientid_field() {
            return vec![];
        }
        let field = schema.field(field_id);
        let mut cases = vec![];
        if self.origin == Origin::Any {
            for object_id in client_implementors {
                // A field the type does not define is reported by
                // `report_missing_field`.
                if let Some(concrete_field_id) =
                    schema.named_field(Type::Object(*object_id), field.name.item)
                    && is_served_by_client(schema.field(concrete_field_id), field)
                {
                    cases.push(*object_id);
                }
            }
        }
        if field.is_extension {
            let object_ids = match self.server_cases.entry((interface_id, field.name.item)) {
                Entry::Occupied(entry) => entry.into_mut(),
                Entry::Vacant(entry) => entry.insert(server_cases(schema, interface_id, field)),
            };
            cases.extend_from_slice(object_ids);
        }
        cases
    }

    /// The types that read `selection` differently from the interface. Only a
    /// field can differ: a condition and an inline fragment without a type get
    /// cases of their own, inside them.
    fn cases_for_selection(
        &mut self,
        interface_id: InterfaceID,
        client_implementors: &[ObjectID],
        selection: &Selection,
    ) -> Vec<ObjectID> {
        match selection {
            Selection::ScalarField(field) => {
                self.cases_for_field(interface_id, client_implementors, field.definition.item)
            }
            Selection::LinkedField(field) => {
                self.cases_for_field(interface_id, client_implementors, field.definition.item)
            }
            Selection::Condition(_)
            | Selection::InlineFragment(_)
            | Selection::FragmentSpread(_) => {
                vec![]
            }
        }
    }

    /// Reports each field of `selections` that the client-defined type
    /// `object_id` does not define: an object of that type read here would
    /// have nothing where the interface promises a value. A condition and an
    /// inline fragment are checked where they are transformed.
    fn report_missing_fields(
        &mut self,
        interface_id: InterfaceID,
        object_id: ObjectID,
        selections: &[Selection],
    ) {
        for selection in selections {
            match selection {
                Selection::ScalarField(field) => {
                    self.report_missing_field(
                        interface_id,
                        Type::Object(object_id),
                        field.definition,
                    );
                }
                Selection::LinkedField(field) => {
                    self.report_missing_field(
                        interface_id,
                        Type::Object(object_id),
                        field.definition,
                    );
                }
                Selection::Condition(_)
                | Selection::InlineFragment(_)
                | Selection::FragmentSpread(_) => {}
            }
        }
    }

    /// Reports the interface field `definition` if the client-defined type
    /// `type_` does not define it, and returns the type's own field.
    fn report_missing_field(
        &mut self,
        interface_id: InterfaceID,
        type_: Type,
        definition: WithLocation<FieldID>,
    ) -> Option<FieldID> {
        let schema = self.schema;
        let field_name = schema.field(definition.item).name.item;
        let concrete_field_id = schema.named_field(type_, field_name);
        if concrete_field_id.is_none()
            && schema.is_extension_type(type_)
            && self.reported_missing.insert((type_, definition.location))
        {
            self.errors.push(Diagnostic::error(
                ValidationMessage::ClientImplementorMissingInterfaceField {
                    type_name: schema.get_type_name(type_),
                    interface_name: schema.interface(interface_id).name.item,
                    field_name,
                },
                definition.location,
            ));
        }
        concrete_field_id
    }

    /// A case reads `field` as its type defines it (`concrete_field_id`), which
    /// can return a client-defined implementor of the interface field's type,
    /// such as a weak model or a client interface. Reports the fields its
    /// selections read that this type does not define: no selection on the
    /// interface covers them.
    fn report_missing_fields_of_client_value(
        &mut self,
        field: &LinkedField,
        concrete_field_id: FieldID,
    ) {
        let schema = self.schema;
        let concrete_type = schema.field(concrete_field_id).type_.inner();
        if let Type::Interface(field_interface_id) =
            schema.field(field.definition.item).type_.inner()
            && concrete_type != Type::Interface(field_interface_id)
            && matches!(concrete_type, Type::Object(_) | Type::Interface(_))
            && schema.is_extension_type(concrete_type)
        {
            self.report_missing_fields_below(field_interface_id, concrete_type, &field.selections);
        }
    }

    fn report_missing_fields_below(
        &mut self,
        interface_id: InterfaceID,
        type_: Type,
        selections: &[Selection],
    ) {
        for selection in selections {
            match selection {
                Selection::ScalarField(field) => {
                    self.report_missing_field(interface_id, type_, field.definition);
                }
                Selection::LinkedField(field) => {
                    if let Some(concrete_field_id) =
                        self.report_missing_field(interface_id, type_, field.definition)
                    {
                        self.report_missing_fields_of_client_value(field, concrete_field_id);
                    }
                }
                Selection::Condition(condition) => {
                    self.report_missing_fields_below(interface_id, type_, &condition.selections);
                }
                Selection::InlineFragment(fragment) => {
                    if fragment.type_condition.is_none()
                        || fragment.type_condition == Some(Type::Interface(interface_id))
                    {
                        self.report_missing_fields_below(interface_id, type_, &fragment.selections);
                    }
                }
                // Checked where the fragment is defined.
                Selection::FragmentSpread(_) => {}
            }
        }
    }

    /// The divergent fields of a case on `object_id` that it reads as the type
    /// defines them.
    fn report_missing_fields_of_case(&mut self, object_id: ObjectID, divergent: &[Selection]) {
        let schema = self.schema;
        for selection in divergent {
            if let Selection::LinkedField(field) = selection
                && let Some(concrete_field_id) = schema.named_field(
                    Type::Object(object_id),
                    schema.field(field.definition.item).name.item,
                )
            {
                self.report_missing_fields_of_client_value(field, concrete_field_id);
            }
        }
    }

    /// `selections`, selected on an interface, as `concrete_type` defines them.
    /// `project_interface_selections_to_concrete` copies a condition and an
    /// inline fragment without a type as they are; their fields are projected
    /// here too, at every level, so a case never reads the interface's field
    /// where its type serves its own.
    fn project_to_concrete(&self, concrete_type: Type, selections: &[Selection]) -> Vec<Selection> {
        let schema = self.schema;
        let projected = project_interface_selections_to_concrete(schema, concrete_type, selections);
        let mut next_selections = Vec::with_capacity(projected.len());
        for selection in projected {
            next_selections.push(match selection {
                Selection::LinkedField(field) => {
                    let concrete_field = schema.field(field.definition.item);
                    let directives = if resolver_directive(concrete_field).is_some() {
                        without_directive(&field.directives, self.stream_directive_name)
                    } else {
                        field.directives.clone()
                    };
                    Selection::LinkedField(Arc::new(LinkedField {
                        directives,
                        selections: self
                            .project_to_concrete(concrete_field.type_.inner(), &field.selections),
                        ..(*field).clone()
                    }))
                }
                Selection::Condition(condition) => Selection::Condition(Arc::new(Condition {
                    selections: self.project_to_concrete(concrete_type, &condition.selections),
                    ..(*condition).clone()
                })),
                Selection::InlineFragment(fragment) if fragment.type_condition.is_none() => {
                    Selection::InlineFragment(Arc::new(InlineFragment {
                        selections: self.project_to_concrete(concrete_type, &fragment.selections),
                        ..(*fragment).clone()
                    }))
                }
                selection => selection,
            });
        }
        next_selections
    }

    fn report_updatable_divergent_field(
        &mut self,
        interface_id: InterfaceID,
        divergent: &[Selection],
    ) {
        let (field_id, location) = match &divergent[0] {
            Selection::ScalarField(field) => (field.definition.item, field.definition.location),
            Selection::LinkedField(field) => (field.definition.item, field.definition.location),
            Selection::Condition(_)
            | Selection::InlineFragment(_)
            | Selection::FragmentSpread(_) => {
                panic!("Expected the divergent selections to be fields")
            }
        };
        self.errors.push(Diagnostic::error(
            ValidationMessage::ClientImplementorCasesInUpdatableDocument {
                interface_name: self.schema.interface(interface_id).name.item,
                field_name: self.schema.field(field_id).name.item,
            },
            location,
        ));
    }

    /// A refinement on another server abstract type asks the reader whether
    /// each object here is of that type, which it answers for a client object
    /// only from the types the compiler lists: reports a client-defined type
    /// that can be read here and is not listed.
    fn report_unlisted_refinement(&mut self, refined_type: Type, location: Location) {
        let schema = self.schema;
        if self.origin != Origin::Any
            || !refined_type.is_abstract_type()
            || schema.is_extension_type(refined_type)
        {
            return;
        }
        let parent_type = self.parent_type();
        if refined_type == parent_type {
            return;
        }
        let parent_implementors = client_implementors_of(schema, parent_type);
        if parent_implementors.is_empty() {
            return;
        }
        let location = if location.source_location().is_generated() {
            self.authored_location
        } else {
            location
        };
        let listed = client_implementors_of(schema, refined_type);
        for object_id in parent_implementors {
            if !listed.contains(&object_id) {
                if !self.reported_refinements.insert((refined_type, location)) {
                    return;
                }
                let abstract_type_name = schema.get_type_name(refined_type);
                let remedy = if is_member_of(schema, object_id, refined_type) {
                    format!(
                        "Name `{abstract_type_name}` in `enable_client_implementors_of_server_abstract_types`, or select this inside `... on` the server types."
                    )
                } else {
                    "Select this inside `... on` the server types.".to_string()
                };
                self.errors.push(Diagnostic::error(
                    ValidationMessage::ClientImplementorRefinementOnUnlistedAbstractType {
                        type_name: schema.object(object_id).name.item.0,
                        parent_name: schema.get_type_name(parent_type),
                        abstract_type_name,
                        remedy,
                    },
                    location,
                ));
                return;
            }
        }
    }

    /// The selections of a position typed by `parent_type`, followed by a case
    /// for each type that reads one of them differently.
    fn transform_selections_at(
        &mut self,
        parent_type: Type,
        selections: &[Selection],
    ) -> TransformedValue<Vec<Selection>> {
        let Type::Interface(interface_id) = parent_type else {
            return self.transform_children(parent_type, self.origin, selections);
        };
        let client_implementors = client_implementors_of(self.schema, parent_type);
        if client_implementors.is_empty() {
            return self.transform_children(parent_type, self.origin, selections);
        }
        if self.origin == Origin::Any {
            for object_id in &client_implementors {
                self.report_missing_fields(interface_id, *object_id, selections);
            }
        }

        let mut cases = vec![];
        let mut divergent = vec![];
        let mut cases_by_selection = Vec::with_capacity(selections.len());
        for selection in selections {
            let selection_cases =
                self.cases_for_selection(interface_id, &client_implementors, selection);
            if !selection_cases.is_empty() {
                divergent.push(selection.clone());
                cases.extend_from_slice(&selection_cases);
            }
            cases_by_selection.push(selection_cases);
        }
        if divergent.is_empty() {
            return self.transform_children(parent_type, self.origin, selections);
        }
        if self.is_updatable {
            self.report_updatable_divergent_field(interface_id, &divergent);
            return self.transform_children(parent_type, self.origin, selections);
        }
        let schema = self.schema;
        sort_by_name(schema, &mut cases);

        // Every selection stays where it was authored, so adding a case leaves
        // the query text of the others alone. On the interface, a divergent
        // selection is read for server objects, and for the objects of a
        // client-defined type that serves it from the store: a case's values
        // are written under the same storage keys. When every client-defined
        // type has a case of its own, only server objects read it there.
        let origin = self.origin;
        let mut next_selections = Vec::with_capacity(selections.len() + cases.len());
        for (selection, selection_cases) in selections.iter().zip(&cases_by_selection) {
            let (selection, selection_origin) = if selection_cases.is_empty() {
                (selection.clone(), origin)
            } else if includes_all(selection_cases, &client_implementors) {
                (interface_selection(schema, selection), Origin::Server)
            } else {
                (interface_selection(schema, selection), origin)
            };
            let selection = [selection];
            next_selections.extend(
                self.transform_children(parent_type, selection_origin, &selection)
                    .replace_or_else(|| selection.to_vec()),
            );
        }
        for object_id in cases {
            let object = schema.object(object_id);
            let case_type = Type::Object(object_id);
            // The selections this type reads differently, in authored order.
            let mut case_divergent = vec![];
            for (selection, selection_cases) in selections.iter().zip(&cases_by_selection) {
                if selection_cases.contains(&object_id) {
                    case_divergent.push(selection.clone());
                }
            }
            self.report_missing_fields_of_case(object_id, &case_divergent);
            let projected = self.project_to_concrete(case_type, &case_divergent);
            let case_origin = if object.is_extension {
                Origin::Any
            } else {
                Origin::Server
            };
            let case_selections = self
                .transform_children(case_type, case_origin, &projected)
                .replace_or_else(|| projected.clone());
            next_selections.push(Selection::InlineFragment(Arc::new(InlineFragment {
                type_condition: Some(case_type),
                directives: vec![
                    ClientImplementorCaseDirective {
                        interface: interface_id,
                    }
                    .into(),
                ],
                selections: case_selections,
                spread_location: Location::generated(),
            })));
        }
        TransformedValue::Replace(next_selections)
    }

    /// Transforms what lies below each selection, without cases at this level.
    fn transform_children(
        &mut self,
        parent_type: Type,
        origin: Origin,
        selections: &[Selection],
    ) -> TransformedValue<Vec<Selection>> {
        let previous_origin = self.origin;
        self.origin = origin;
        self.parent_types.push(parent_type);
        let result = transform_list(selections, |selection| self.transform_selection(selection));
        self.parent_types.pop();
        self.origin = previous_origin;
        result
    }

    fn parent_type(&self) -> Type {
        *self
            .parent_types
            .last()
            .expect("Expected a parent type while transforming selections")
    }
}

impl Transformer<'_> for ClientImplementorCases<'_> {
    const NAME: &'static str = "ClientImplementorCases";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_operation(
        &mut self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        self.origin = Origin::Server;
        self.authored_location = operation.name.location;
        self.is_updatable = operation.directives.named(*UPDATABLE_DIRECTIVE).is_some();
        match self.transform_selections_at(operation.type_, &operation.selections) {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => Transformed::Replace(OperationDefinition {
                selections,
                ..operation.clone()
            }),
        }
    }

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        self.origin = refined_origin(self.schema, Some(fragment.type_condition), Origin::Any);
        self.authored_location = fragment.name.location;
        self.is_updatable = fragment.directives.named(*UPDATABLE_DIRECTIVE).is_some();
        if fragment.directives.named(*ASSIGNABLE_DIRECTIVE).is_some()
            && has_client_implementors(self.schema, fragment.type_condition)
        {
            self.errors.push(Diagnostic::error(
                ValidationMessage::AssignableFragmentOnTypeWithClientImplementors {
                    fragment_name: fragment.name.item,
                    type_name: self.schema.get_type_name(fragment.type_condition),
                },
                fragment.name.location,
            ));
        }
        match self.transform_selections_at(fragment.type_condition, &fragment.selections) {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => Transformed::Replace(FragmentDefinition {
                selections,
                ..fragment.clone()
            }),
        }
    }

    fn transform_linked_field(&mut self, field: &LinkedField) -> Transformed<Selection> {
        let schema_field = self.schema.field(field.definition.item);
        let previous_origin = self.origin;
        let previous_location = self.authored_location;
        self.origin = linked_field_origin(self.schema, schema_field, previous_origin);
        if !field.definition.location.source_location().is_generated() {
            self.authored_location = field.definition.location;
        }
        let result = self.transform_selections_at(schema_field.type_.inner(), &field.selections);
        self.origin = previous_origin;
        self.authored_location = previous_location;
        match result {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => {
                Transformed::Replace(Selection::LinkedField(Arc::new(LinkedField {
                    selections,
                    ..field.clone()
                })))
            }
        }
    }

    fn transform_inline_fragment(&mut self, fragment: &InlineFragment) -> Transformed<Selection> {
        let parent_type = match fragment.type_condition {
            Some(type_condition) => {
                self.report_unlisted_refinement(type_condition, fragment.spread_location);
                type_condition
            }
            None => self.parent_type(),
        };
        let previous_origin = self.origin;
        let previous_location = self.authored_location;
        self.origin = refined_origin(self.schema, fragment.type_condition, previous_origin);
        if !fragment.spread_location.source_location().is_generated() {
            self.authored_location = fragment.spread_location;
        }
        let result = self.transform_selections_at(parent_type, &fragment.selections);
        self.origin = previous_origin;
        self.authored_location = previous_location;
        match result {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => {
                Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                    selections,
                    ..fragment.clone()
                })))
            }
        }
    }

    fn transform_fragment_spread(&mut self, spread: &FragmentSpread) -> Transformed<Selection> {
        if let Some(fragment) = self.program.fragment(spread.fragment.item) {
            self.report_unlisted_refinement(fragment.type_condition, spread.fragment.location);
        }
        Transformed::Keep
    }

    fn transform_condition(&mut self, condition: &Condition) -> Transformed<Selection> {
        match self.transform_selections_at(self.parent_type(), &condition.selections) {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => {
                Transformed::Replace(Selection::Condition(Arc::new(Condition {
                    selections,
                    ..condition.clone()
                })))
            }
        }
    }
}
