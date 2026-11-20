/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;

use ::intern::intern;
use ::intern::string_key::Intern;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::NamedItem;
use common::WithLocation;
use docblock_shared::RELAY_RESOLVER_DIRECTIVE_NAME;
use graphql_ir::Directive;
use graphql_ir::ExecutableDefinition;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::associated_data_impl;
use graphql_syntax::OperationKind;
use rustc_hash::FxHashSet;
use schema::SDLSchema;

use crate::RESOLVER_BELONGS_TO_BASE_SCHEMA_DIRECTIVE;
use crate::SplitOperationMetadata;
use crate::get_normalization_operation_name;
use crate::get_resolver_fragment_dependency_name;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct IsResolverRootFragment();
associated_data_impl!(IsResolverRootFragment);

/// Marks a split operation as having been generated from a resolver's
/// `@rootFragment`.
///
/// Codegen uses this to decide whether to compute `hasServerField`, which it
/// must not do for `@module` split operations or any other kind. The *value* of
/// that flag is computed in codegen rather than here, because it depends on the
/// `ClientExtension` wrappers that the `client_extensions` transform inserts —
/// and that runs in `apply_normalization_transforms`, after this one.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct IsResolverRootFragmentSplitOperation();
associated_data_impl!(IsResolverRootFragmentSplitOperation);

pub fn generate_relay_resolvers_root_fragment_split_operation(
    program: &Program,
) -> DiagnosticsResult<Program> {
    let mut operations = vec![];
    for fragment in program.fragments() {
        if IsResolverRootFragment::find(&fragment.directives).is_some()
            // A Relay RSC root fragment's normalization operation is the one
            // RSC lowering wrote, whose variables cannot shadow the root
            // variables that the fragments it spreads read.
            && program
                .operation(OperationDefinitionName(
                    get_normalization_operation_name(fragment.name.item.0).intern(),
                ))
                .is_none()
        {
            let mut directives = vec![
                SplitOperationMetadata {
                    location: fragment.name.location,
                    parent_documents: FxHashSet::from_iter([fragment.name.item.into()]),
                    derived_from: Some(fragment.name.item),
                    raw_response_type_generation_mode: None,
                }
                .into(),
                Directive {
                    name: WithLocation::new(
                        fragment.name.location,
                        DirectiveName(intern!("exec_time_resolvers")),
                    ),
                    arguments: vec![],
                    data: None,
                    location: fragment.name.location,
                },
            ];
            directives.push(IsResolverRootFragmentSplitOperation().into());
            operations.push(Arc::new(OperationDefinition {
                name: fragment.name.map(|name| {
                    OperationDefinitionName(get_normalization_operation_name(name.0).intern())
                }),
                type_: fragment.type_condition,
                variable_definitions: fragment.variable_definitions.clone(),
                directives,
                selections: fragment.selections.clone(),
                kind: OperationKind::Query,
            }));
        }
    }

    if operations.is_empty() {
        Ok(program.clone())
    } else {
        let mut next_program = program.clone();

        for operation in operations {
            next_program.insert_operation(operation)
        }

        Ok(next_program)
    }
}

fn get_resolver_root_fragment_names(schema: &SDLSchema) -> FxHashSet<FragmentDefinitionName> {
    let mut names = FxHashSet::default();
    for field in schema.get_fields() {
        if !field.is_extension
            || field
                .directives
                .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
                .is_none()
            || field
                .directives
                .named(*RESOLVER_BELONGS_TO_BASE_SCHEMA_DIRECTIVE)
                .is_some()
        {
            continue;
        }

        if let Some(root_fragment_name) = get_resolver_fragment_dependency_name(field) {
            names.insert(root_fragment_name);
        }
    }
    names
}

/// Adds a directive on all `FragmentDefinition`s in IR that are marked as a `@rootFragment`
/// for any resolver backed field in the schema (but not base schema)
pub fn annotate_resolver_root_fragments(
    schema: &SDLSchema,
    ir: Vec<ExecutableDefinition>,
) -> Vec<ExecutableDefinition> {
    let resolver_root_fragment_names = get_resolver_root_fragment_names(schema);
    ir.into_iter()
        .map(|def| {
            if let ExecutableDefinition::Fragment(ref fragment) = def {
                return if resolver_root_fragment_names.contains(&fragment.name.item) {
                    ExecutableDefinition::Fragment(FragmentDefinition {
                        directives: fragment
                            .directives
                            .iter()
                            .cloned()
                            .chain(vec![IsResolverRootFragment().into()])
                            .collect(),
                        ..fragment.clone()
                    })
                } else {
                    def
                };
            }
            def
        })
        .collect()
}
