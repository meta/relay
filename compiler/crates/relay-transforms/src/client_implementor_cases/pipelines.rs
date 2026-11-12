/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! What each pipeline keeps of the cases. The reader and the generated types
//! read a selection as authored, so they drop every case. Normalization keeps
//! the cases, except a client type's where only server objects can appear, as
//! plain inline fragments. The query text needs nothing here:
//! `skip_client_extensions` drops a client type's case like any inline fragment
//! on a client type, and the case marker like any metadata directive.

use std::sync::Arc;

use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::Transformer;
use schema::SDLSchema;
use schema::Schema;

use super::ClientImplementorCaseDirective;
use super::Origin;
use super::is_client_implementor_case;
use super::linked_field_origin;
use super::refined_origin;
use crate::ClientEdgeMetadataDirective;
use crate::SplitOperationMetadata;

/// Drops every case, for the reader and the generated types: at exec time the
/// executor writes a case's values under the storage keys of the interface's
/// fields, and a selection is typed by the interface field, whatever type
/// serves it.
pub fn remove_client_implementor_cases(program: &Program) -> Program {
    RemoveCases
        .transform_program(program)
        .replace_or_else(|| program.clone())
}

struct RemoveCases;

impl Transformer<'_> for RemoveCases {
    const NAME: &'static str = "RemoveClientImplementorCases";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_inline_fragment(&mut self, fragment: &InlineFragment) -> Transformed<Selection> {
        if is_client_implementor_case(fragment) {
            return Transformed::Delete;
        }
        self.default_transform_inline_fragment(fragment)
    }
}

/// For normalization: drops a client type's case where only server objects can
/// appear, such as a fragment spread into a server field, and turns the other
/// cases into plain inline fragments, which later transforms flatten and
/// deduplicate like any other. Runs after `inline_fragments`, which puts each
/// fragment where it is spread.
pub fn client_implementor_cases_for_normalization(program: &Program) -> Program {
    RemoveClientCases {
        schema: &program.schema,
        origin: Origin::Server,
    }
    .transform_program(program)
    .replace_or_else(|| program.clone())
}

struct RemoveClientCases<'program> {
    schema: &'program SDLSchema,
    origin: Origin,
}

impl Transformer<'_> for RemoveClientCases<'_> {
    const NAME: &'static str = "ClientImplementorCasesForNormalization";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_operation(
        &mut self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        // A split operation normalizes data read where the parent operation
        // spread its fragment, which may be a client object.
        self.origin = if SplitOperationMetadata::find(&operation.directives).is_some() {
            Origin::Any
        } else {
            Origin::Server
        };
        self.default_transform_operation(operation)
    }

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        self.origin = refined_origin(self.schema, Some(fragment.type_condition), Origin::Any);
        self.default_transform_fragment(fragment)
    }

    fn transform_linked_field(&mut self, field: &LinkedField) -> Transformed<Selection> {
        let previous_origin = self.origin;
        self.origin = linked_field_origin(
            self.schema,
            self.schema.field(field.definition.item),
            previous_origin,
        );
        let result = self.default_transform_linked_field(field);
        self.origin = previous_origin;
        result
    }

    fn transform_inline_fragment(&mut self, fragment: &InlineFragment) -> Transformed<Selection> {
        let previous_origin = self.origin;
        if is_client_implementor_case(fragment) {
            let is_client_type = match fragment.type_condition {
                Some(type_condition) => self.schema.is_extension_type(type_condition),
                None => false,
            };
            if is_client_type && self.origin == Origin::Server {
                return Transformed::Delete;
            }
            self.origin = if is_client_type {
                Origin::Any
            } else {
                Origin::Server
            };
            let selections = self
                .transform_selections(&fragment.selections)
                .replace_or_else(|| fragment.selections.clone());
            self.origin = previous_origin;
            return Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                type_condition: fragment.type_condition,
                directives: without_case_marker(&fragment.directives),
                selections,
                spread_location: fragment.spread_location,
            })));
        }
        self.origin = refined_origin(self.schema, fragment.type_condition, previous_origin);
        if ClientEdgeMetadataDirective::find(&fragment.directives).is_some() {
            self.origin = Origin::Any;
        }
        let result = self.default_transform_inline_fragment(fragment);
        self.origin = previous_origin;
        result
    }
}

fn without_case_marker(directives: &[Directive]) -> Vec<Directive> {
    let marker = ClientImplementorCaseDirective::directive_name();
    let mut kept = Vec::with_capacity(directives.len());
    for directive in directives {
        if directive.name.item != marker {
            kept.push(directive.clone());
        }
    }
    kept
}
