/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! Stamps exec-time operations with [`ClientToServerResolverOperationMetadata`]
//! when they *transitively* contain a client-to-server (`@waterfall`) client
//! edge — including an edge that is only reachable through a `@module` or
//! `@no_inline` split-operation boundary.
//!
//! Codegen (`build_ast`) computes the `has_client_to_server_resolvers` operation
//! flag from a per-operation traversal, but that traversal stops at `@module` /
//! `@no_inline` boundaries: those are emitted as a reference to a separate
//! `SplitOperation` rather than inlined, and `CodegenBuilder` has no access to
//! the fragment/operation table to follow them. The runtime
//! (`LSRelayEnvironmentConfig`) reads `has_client_to_server_resolvers` to decide
//! whether to route a query through `executeWithNetwork` (which installs the C2S
//! waterfall coordinator). Without this transform, a C2S edge hoisted behind a
//! `@module` leaves the parent operation unflagged, so it runs on the
//! non-network path and trips the "C2S edge encountered without a c2sConfig"
//! invariant at runtime.
//!
//! Only exec-time operations are flagged: a `ClientEdgeToServerObject` is only
//! emitted into (and processed from) the operation's normalization AST in
//! exec-time mode. Read-time client edges to server objects are resolved by the
//! read-time client-edge machinery (a generated `ClientEdgeQuery`), never route
//! through `executeWithNetwork`, and must not carry this flag. This mirrors the
//! exec-time gate `build_ast` uses to decide whether to emit the edge at all.
//!
//! This transform runs after the `@module` / `@no_inline` split operations have
//! been generated, so it resolves those fragment spreads to their
//! `SplitOperation` by name and walks into them.

use std::collections::HashSet;

use common::NamedItem;
use graphql_ir::FragmentDefinition;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::Transformer;
use graphql_ir::associated_data_impl;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use relay_config::ProjectConfig;

use crate::ClientEdgeMetadataDirective;
use crate::DIRECTIVE_SPLIT_OPERATION;
use crate::client_edges::EXEC_TIME_RESOLVERS_DIRECTIVE_NAME;
use crate::get_normalization_operation_name;

/// Operation-level marker added when an exec-time operation transitively
/// contains a client-to-server (`ClientEdgeToServerObject`) edge. Read by
/// codegen to emit `has_client_to_server_resolvers: true` on the operation.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ClientToServerResolverOperationMetadata {}
associated_data_impl!(ClientToServerResolverOperationMetadata);

pub fn generate_resolver_operation_metadata(
    program: &Program,
    project_config: &ProjectConfig,
) -> Program {
    let mut transform = GenerateResolverOperationMetadata::new(program, project_config);
    transform
        .transform_program(program)
        .replace_or_else(|| program.clone())
}

struct GenerateResolverOperationMetadata<'s> {
    program: &'s Program,
    project_config: &'s ProjectConfig,
}

impl<'s> GenerateResolverOperationMetadata<'s> {
    fn new(program: &'s Program, project_config: &'s ProjectConfig) -> Self {
        Self {
            program,
            project_config,
        }
    }

    /// Whether `operation` is normalized in exec-time mode, which is exactly
    /// when a `ClientEdgeToServerObject` is emitted into its normalization AST.
    /// Mirrors `CodegenBuilder::use_exec_time_resolvers` /
    /// `use_exec_and_read_time_resolvers` in `relay-codegen`.
    fn is_exec_time_operation(&self, operation: &OperationDefinition) -> bool {
        let feature_flags = &self.project_config.feature_flags;
        feature_flags.enable_resolver_normalization_ast
            || (feature_flags.enable_exec_time_resolvers_directive
                && operation
                    .directives
                    .named(*EXEC_TIME_RESOLVERS_DIRECTIVE_NAME)
                    .is_some())
    }

    /// Returns true if any selection is a client-to-server client edge, or
    /// transitively reaches one by following fragment-spread references into
    /// normal fragments and `@module` / `@no_inline` split operations.
    fn selections_have_client_to_server_edge(
        &self,
        selections: &[Selection],
        visited: &mut HashSet<StringKey>,
    ) -> bool {
        selections.iter().any(|selection| match selection {
            Selection::InlineFragment(inline_fragment) => {
                if matches!(
                    ClientEdgeMetadataDirective::find(&inline_fragment.directives),
                    Some(ClientEdgeMetadataDirective::ServerObject { .. })
                ) {
                    return true;
                }
                self.selections_have_client_to_server_edge(&inline_fragment.selections, visited)
            }
            Selection::LinkedField(field) => {
                self.selections_have_client_to_server_edge(&field.selections, visited)
            }
            Selection::Condition(condition) => {
                self.selections_have_client_to_server_edge(&condition.selections, visited)
            }
            Selection::ScalarField(_) => false,
            Selection::FragmentSpread(spread) => {
                let name = spread.fragment.item;
                if !visited.insert(name.0) {
                    return false;
                }
                // `@no_inline`: `apply_fragment_arguments` rewrites the spread to
                // the `$normalization` SplitOperation name, so the spread name
                // resolves directly to an operation.
                if let Some(operation) = self.program.operation(OperationDefinitionName(name.0)) {
                    return self
                        .selections_have_client_to_server_edge(&operation.selections, visited);
                }
                // `@module` / `@match` (3D): the module inline fragment still
                // spreads the reader fragment by its base name, while
                // `split_module_import` named the SplitOperation
                // `<fragment>$normalization`. Resolve that explicitly — the C2S
                // edge lives in the split operation, not the reader fragment.
                let normalization_name =
                    OperationDefinitionName(get_normalization_operation_name(name.0).intern());
                if let Some(operation) = self.program.operation(normalization_name) {
                    return self
                        .selections_have_client_to_server_edge(&operation.selections, visited);
                }
                // Fallback: a regular (not-yet-inlined) fragment.
                if let Some(fragment) = self.program.fragment(name) {
                    return self
                        .selections_have_client_to_server_edge(&fragment.selections, visited);
                }
                false
            }
        })
    }
}

impl Transformer<'_> for GenerateResolverOperationMetadata<'_> {
    const NAME: &'static str = "GenerateResolverOperationMetadata";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_operation(
        &mut self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        // Only stamp user-facing operations. Split operations emit empty
        // metadata and the runtime never routes on their flags.
        if operation
            .directives
            .named(*DIRECTIVE_SPLIT_OPERATION)
            .is_some()
        {
            return Transformed::Keep;
        }

        // Only exec-time operations route through executeWithNetwork; the
        // ClientEdgeToServerObject is only present in their normalization AST.
        if !self.is_exec_time_operation(operation) {
            return Transformed::Keep;
        }

        let mut visited: HashSet<StringKey> = HashSet::new();
        if !self.selections_have_client_to_server_edge(&operation.selections, &mut visited) {
            return Transformed::Keep;
        }

        let mut directives = operation.directives.clone();
        directives.push(ClientToServerResolverOperationMetadata {}.into());
        Transformed::Replace(OperationDefinition {
            directives,
            ..operation.clone()
        })
    }

    fn transform_fragment(
        &mut self,
        _fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        // Fragments do not carry the operation-level routing flag.
        Transformed::Keep
    }
}
