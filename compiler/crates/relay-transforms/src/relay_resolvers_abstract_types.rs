/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashMap;
use std::sync::Arc;

use common::ArgumentName;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::FeatureFlags;
use common::Location;
use common::NamedItem;
use common::WithLocation;
use docblock_shared::RELAY_RESOLVER_DIRECTIVE_NAME;
use docblock_shared::ROOT_FRAGMENT_FIELD;
use graphql_ir::Condition;
use graphql_ir::FragmentDefinition;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::Program;
use graphql_ir::ScalarField;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::TransformedValue;
use graphql_ir::Transformer;
use graphql_ir::transform_list;
use relay_schema::client_implementors::has_client_implementors;
use schema::FieldID;
use schema::InterfaceID;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

use crate::CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME;
use crate::relay_resolvers::get_resolver_info;

/// Transform selections on interface types.
///
/// First we locate fields which are interface types. Then we convert all of its
/// selections into inline fragments per concrete type with the same
/// selections.
pub fn relay_resolvers_abstract_types(
    program: &Program,
    feature_flags: &FeatureFlags,
) -> DiagnosticsResult<Program> {
    if !feature_flags
        .relay_resolver_enable_interface_output_type
        .is_fully_enabled()
    {
        return Ok(program.clone());
    }
    let mut transform = RelayResolverAbstractTypesTransform::new(program);
    let next_program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());

    if transform.errors.is_empty() {
        Ok(next_program)
    } else {
        Err(transform.errors)
    }
}

struct RelayResolverAbstractTypesTransform<'program> {
    program: &'program Program,
    errors: Vec<Diagnostic>,
    interface_to_are_implementers_server_defined: HashMap<InterfaceID, bool>,
}

impl<'program> RelayResolverAbstractTypesTransform<'program> {
    fn new(program: &'program Program) -> Self {
        Self {
            program,
            errors: Default::default(),
            interface_to_are_implementers_server_defined: HashMap::new(),
        }
    }
}

impl RelayResolverAbstractTypesTransform<'_> {
    // Partition selections on an interface type to copy to inline fragments
    // on concrete types and to keep as is.
    // Selections that should be copied are those that have different implementations
    // across concrete types on the interface type (e.g. resolver field defined differently
    // per concrete type.)
    // Selections that should be kept are those that have the same implementations
    // across concrete types (e.g. fields defined directly on the abstract type, or on server)
    // or inline fragments that are on a concrete type.
    fn partition_selections_to_copy_and_keep(
        &self,
        selections: &[Selection],
        interface_id: InterfaceID,
    ) -> (Vec<Selection>, Vec<Selection>) {
        selections
            .iter()
            .cloned()
            .partition(|selection| self.should_copy_selection(selection, interface_id))
    }

    fn should_copy_selection(&self, selection: &Selection, interface_id: InterfaceID) -> bool {
        match selection {
            Selection::InlineFragment(inline_fragment) => {
                if inline_fragment.type_condition.is_none() {
                    inline_fragment
                        .selections
                        .iter()
                        .any(|selection| self.should_copy_selection(selection, interface_id))
                } else {
                    false
                }
            }
            Selection::FragmentSpread(_) => false,
            Selection::Condition(condition) => condition
                .selections
                .iter()
                .any(|selection| self.should_copy_selection(selection, interface_id)),
            Selection::LinkedField(field) => self
                .concrete_types_have_different_implementations(interface_id, field.definition.item),
            Selection::ScalarField(field) => self
                .concrete_types_have_different_implementations(interface_id, field.definition.item),
        }
    }

    // Return true if concrete types have different implementations for the interface field
    // with field_id.
    fn concrete_types_have_different_implementations(
        &self,
        interface_id: InterfaceID,
        field_id: FieldID,
    ) -> bool {
        let interface = self.program.schema.interface(interface_id);
        let interface_field = self.program.schema.field(field_id);
        // Interface field is a model resolver field defined with @rootFragment
        if let Some(resolver_directive) = interface_field
            .directives
            .iter()
            .find(|directive| directive.name.0 == RELAY_RESOLVER_DIRECTIVE_NAME.0)
            && resolver_directive
                .arguments
                .named(ArgumentName(*ROOT_FRAGMENT_FIELD))
                .is_some()
        {
            return true;
        }
        // Any of the implementing objects' corresponding field is a resolver field
        let selection_name = interface_field.name.item;
        let implementing_objects =
            interface.recursively_implementing_objects(Arc::as_ref(&self.program.schema));
        implementing_objects.iter().any(|object_id| {
            let concrete_field_id = self
                .program
                .schema
                .named_field(Type::Object(*object_id), selection_name)
                .expect("Expected field to be defined on concrete type");
            let concrete_field = self.program.schema.field(concrete_field_id);
            // A field is a "different implementation" if it's either an explicit
            // resolver or any extension field (e.g. a synthetic ID field on a
            // client model type that has no @relay_resolver directive but is still
            // client-only and must be fanned out per concrete type).
            concrete_field.is_extension
                || concrete_field
                    .directives
                    .iter()
                    .any(|directive| directive.name.0 == RELAY_RESOLVER_DIRECTIVE_NAME.0)
        })
    }

    fn create_inline_fragment_selections_for_interface(
        &self,
        interface_id: InterfaceID,
        selections: &[Selection],
    ) -> Vec<Selection> {
        assert!(
            !selections.is_empty(),
            "Expected selections to be non-empty when copying to inline fragments on concrete type"
        );
        let interface = self.program.schema.interface(interface_id);
        let implementing_objects =
            interface.recursively_implementing_objects(Arc::as_ref(&self.program.schema));
        let mut sorted_implementing_objects = implementing_objects.into_iter().collect::<Vec<_>>();
        sorted_implementing_objects.sort();
        sorted_implementing_objects
            .iter()
            .map(|object_id| {
                let concrete_type = Type::Object(*object_id);
                Selection::InlineFragment(Arc::new(InlineFragment {
                    type_condition: Some(concrete_type),
                    directives: vec![], // Directives not necessary here
                    selections: project_interface_selections_to_concrete(
                        self.program.schema.as_ref(),
                        concrete_type,
                        selections,
                    ),
                    spread_location: Location::generated(),
                }))
            })
            .collect()
    }

    fn is_interface_implemented_by_all_server_defined_types(
        &mut self,
        interface_id: InterfaceID,
    ) -> bool {
        *self
            .interface_to_are_implementers_server_defined
            .entry(interface_id)
            .or_insert_with_key(|interface_id| {
                let interface = self.program.schema.interface(*interface_id);
                let implementing_objects =
                    interface.recursively_implementing_objects(Arc::as_ref(&self.program.schema));
                !implementing_objects.iter().any(|object_id| {
                    let object = self.program.schema.object(*object_id);
                    object.is_extension
                })
            })
    }

    // Transform selections on an interface type.
    fn transform_selections_given_parent_type(
        &mut self,
        entry_type: Option<Type>,
        selections: &[Selection],
    ) -> TransformedValue<Vec<Selection>> {
        if let Some(Type::Interface(interface_id)) = entry_type {
            // A server interface with client-defined implementors gets cases
            // (`add_client_implementor_cases`), so this transform leaves it alone.
            if has_client_implementors(&self.program.schema, Type::Interface(interface_id))
                || self.is_interface_implemented_by_all_server_defined_types(interface_id)
            {
                return TransformedValue::Keep;
            }
            let transformed_selections = transform_list(selections, |selection| match selection {
                Selection::LinkedField(_)
                | Selection::ScalarField(_)
                | Selection::FragmentSpread(_) => Transformed::Keep,
                Selection::InlineFragment(inline_fragment) => {
                    if inline_fragment.type_condition.is_none() {
                        self.transform_inline_fragment_with_parent_type(inline_fragment, entry_type)
                    } else {
                        Transformed::Keep
                    }
                }
                Selection::Condition(condition) => {
                    self.transform_condition_with_parent_type(condition, entry_type)
                }
            });
            let selections_to_transform = match &transformed_selections {
                TransformedValue::Keep => selections,
                TransformedValue::Replace(replaced_selections) => replaced_selections,
            };
            let (selections_to_copy, mut selections_to_keep) =
                self.partition_selections_to_copy_and_keep(selections_to_transform, interface_id);
            if selections_to_copy.is_empty() {
                if transformed_selections.should_keep() {
                    TransformedValue::Keep
                } else {
                    TransformedValue::Replace(selections_to_keep)
                }
            } else {
                selections_to_keep.append(
                    &mut self.create_inline_fragment_selections_for_interface(
                        interface_id,
                        &selections_to_copy,
                    ),
                );
                TransformedValue::Replace(selections_to_keep)
            }
        } else {
            // If no parent type is provided, skip transform
            TransformedValue::Keep
        }
    }

    fn transform_condition_with_parent_type(
        &mut self,
        condition: &Condition,
        parent_type: Option<Type>,
    ) -> Transformed<Selection> {
        let transformed_selections =
            self.transform_selections_given_parent_type(parent_type, &condition.selections);
        match transformed_selections {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(transformed_selections) => {
                Transformed::Replace(Selection::Condition(Arc::new(Condition {
                    selections: transformed_selections,
                    ..condition.clone()
                })))
            }
        }
    }

    fn transform_inline_fragment_with_parent_type(
        &mut self,
        inline_fragment: &InlineFragment,
        parent_type: Option<Type>,
    ) -> Transformed<Selection> {
        let transformed_selections =
            self.transform_selections_given_parent_type(parent_type, &inline_fragment.selections);
        match transformed_selections {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(transformed_selections) => {
                Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                    selections: transformed_selections,
                    ..inline_fragment.clone()
                })))
            }
        }
    }
}

impl Transformer<'_> for RelayResolverAbstractTypesTransform<'_> {
    const NAME: &'static str = "RelayResolverAbstractTypesTransform";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_inline_fragment(
        &mut self,
        inline_fragment: &InlineFragment,
    ) -> Transformed<Selection> {
        if inline_fragment.type_condition.is_none() {
            self.default_transform_inline_fragment(inline_fragment)
        } else {
            let selections = self.transform_selections(&inline_fragment.selections);
            // If our child selections had no changes, do not copy them until we have to replace them
            let selections_to_transform = match &selections {
                TransformedValue::Keep => &inline_fragment.selections,
                TransformedValue::Replace(replaced_selections) => replaced_selections,
            };
            let transformed_selections = self.transform_selections_given_parent_type(
                inline_fragment.type_condition,
                selections_to_transform,
            );
            match transformed_selections {
                TransformedValue::Keep => {
                    if !selections.should_keep() {
                        Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                            selections: selections_to_transform.to_vec(),
                            ..inline_fragment.clone()
                        })))
                    } else {
                        Transformed::Keep
                    }
                }
                TransformedValue::Replace(transformed_selections) => {
                    Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                        selections: transformed_selections,
                        ..inline_fragment.clone()
                    })))
                }
            }
        }
    }

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        let selections = self.transform_selections(&fragment.selections);
        let selections_to_transform = match &selections {
            TransformedValue::Keep => &fragment.selections,
            TransformedValue::Replace(replaced_selections) => replaced_selections,
        };
        let transformed_selections = self.transform_selections_given_parent_type(
            Some(fragment.type_condition),
            selections_to_transform,
        );
        match transformed_selections {
            TransformedValue::Keep => {
                if !selections.should_keep() {
                    Transformed::Replace(FragmentDefinition {
                        selections: selections_to_transform.to_vec(),
                        ..fragment.clone()
                    })
                } else {
                    Transformed::Keep
                }
            }
            TransformedValue::Replace(transformed_selections) => {
                Transformed::Replace(FragmentDefinition {
                    selections: transformed_selections,
                    ..fragment.clone()
                })
            }
        }
    }

    fn transform_linked_field(&mut self, field: &LinkedField) -> Transformed<Selection> {
        let selections = self.transform_selections(&field.selections);
        let selections_to_transform = match &selections {
            TransformedValue::Keep => &field.selections,
            TransformedValue::Replace(replaced_selections) => replaced_selections,
        };
        let field_type = self.program.schema.field(field.definition.item);
        let edge_to_type = field_type.type_.inner();
        let transformed_selections = self
            .transform_selections_given_parent_type(Some(edge_to_type), selections_to_transform);
        match transformed_selections {
            TransformedValue::Keep => {
                if !selections.should_keep() {
                    Transformed::Replace(Selection::LinkedField(Arc::new(LinkedField {
                        selections: selections_to_transform.to_vec(),
                        ..field.clone()
                    })))
                } else {
                    Transformed::Keep
                }
            }
            TransformedValue::Replace(transformed_selections) => {
                Transformed::Replace(Selection::LinkedField(Arc::new(LinkedField {
                    selections: transformed_selections,
                    ..field.clone()
                })))
            }
        }
    }
}

/// Whether a concrete field is a client edge that points to a *server* object —
/// the only case that requires `@waterfall`. An extension field backed by a
/// `@relay_resolver` whose edge target is a server (non-extension) type. Native
/// server fields and client edges to client objects return false. A shadow
/// resolver (`@returnFragment`) is transplant-only and returns false unless it
/// declares `@mayWaterfall`.
pub(crate) fn concrete_field_requires_waterfall(
    schema: &SDLSchema,
    concrete_field_id: FieldID,
) -> bool {
    let field = schema.field(concrete_field_id);
    let is_client_edge = field.is_extension
        && field
            .directives
            .iter()
            .any(|directive| directive.name.0 == RELAY_RESOLVER_DIRECTIVE_NAME.0);
    if !is_client_edge || schema.is_extension_type(field.type_.inner()) {
        return false;
    }
    // A shadow resolver (`@returnFragment`) transplants the consumer's selections
    // onto the shadowed server field, so it only incurs a waterfall when it
    // declares `@mayWaterfall`. Without that declaration it is transplant-only and
    // must NOT be treated as waterfall-required -- otherwise an abstract fan-out
    // could keep `@waterfall` on a non-`@mayWaterfall` shadow arm (and typegen
    // could self-project a `ClientEdgeQuery` the operation pipeline suppresses).
    if let Some(Ok(resolver_info)) = get_resolver_info(schema, field, field.name.location)
        && resolver_info.return_fragment.is_some()
    {
        return resolver_info.may_waterfall;
    }
    true
}

/// Projects `selections` written against an abstract type onto a concrete
/// implementor type by rewriting each field reference to the field of the same
/// name defined on `concrete_type`, recursing through linked fields whose edge
/// target also narrows. A field absent on the concrete type is skipped rather
/// than projected.
///
/// The abstract field may carry `@waterfall` (an author acknowledgment that
/// consuming it incurs a network roundtrip). When specializing to a concrete
/// arm, keep `@waterfall` only where the concrete field is a client edge to a
/// server object (which requires it); strip it from native server fields and
/// client-edge-to-client-object fields (where it is invalid), so one
/// interface-level `@waterfall` covers a field that is server-backed on one
/// implementor and a client-to-server edge on another.
pub(crate) fn project_interface_selections_to_concrete(
    schema: &SDLSchema,
    concrete_type: Type,
    selections: &[Selection],
) -> Vec<Selection> {
    selections
        .iter()
        .filter_map(|selection| match selection {
            Selection::LinkedField(node) => {
                let field_name = schema.field(node.definition.item).name.item;
                let concrete_field_id = schema.named_field(concrete_type, field_name)?;
                let concrete_return_type = schema.field(concrete_field_id).type_.inner();
                let definition = WithLocation::new(node.definition.location, concrete_field_id);
                let filtered =
                    filter_incompatible_inline_fragments(concrete_return_type, &node.selections);
                let nested_selections =
                    if concrete_return_type != schema.field(node.definition.item).type_.inner() {
                        project_interface_selections_to_concrete(
                            schema,
                            concrete_return_type,
                            &filtered,
                        )
                    } else {
                        filtered
                    };
                let has_waterfall = node
                    .directives
                    .named(*CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME)
                    .is_some();
                let directives = if has_waterfall
                    && !concrete_field_requires_waterfall(schema, concrete_field_id)
                {
                    node.directives
                        .iter()
                        .filter(|directive| {
                            directive.name.item != *CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME
                        })
                        .cloned()
                        .collect()
                } else {
                    node.directives.clone()
                };
                Some(Selection::LinkedField(Arc::new(LinkedField {
                    definition,
                    alias: node.alias,
                    arguments: node.arguments.clone(),
                    directives,
                    selections: nested_selections,
                })))
            }
            Selection::ScalarField(node) => {
                let field_name = schema.field(node.definition.item).name.item;
                let concrete_field_id = schema.named_field(concrete_type, field_name)?;
                let definition = WithLocation::new(node.definition.location, concrete_field_id);
                Some(Selection::ScalarField(Arc::new(ScalarField {
                    definition,
                    alias: node.alias,
                    arguments: node.arguments.clone(),
                    directives: node.directives.clone(),
                })))
            }
            Selection::FragmentSpread(_) => Some(selection.clone()),
            Selection::InlineFragment(_) => Some(selection.clone()),
            Selection::Condition(_) => Some(selection.clone()),
        })
        .collect()
}

/// Removes inline fragments from `selections` whose object type condition is
/// incompatible with a known concrete return type. When a linked field is known
/// to return a specific concrete object type, any `... on OtherObject` inline
/// fragments in its selection set are unreachable and can be dropped.
///
/// Only acts when `concrete_type` is an object type; abstract return types are
/// returned unchanged because we cannot rule out any implementor without further
/// context.
fn filter_incompatible_inline_fragments(
    concrete_type: Type,
    selections: &[Selection],
) -> Vec<Selection> {
    let Type::Object(_) = concrete_type else {
        return selections.to_vec();
    };
    selections
        .iter()
        .filter(|selection| {
            if let Selection::InlineFragment(fragment) = selection
                && let Some(Type::Object(_)) = fragment.type_condition
            {
                return fragment.type_condition == Some(concrete_type);
            }
            true
        })
        .cloned()
        .collect()
}
