/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::Location;
use common::NamedItem;
use common::SourceLocationKey;
use graphql_ir::Condition;
use graphql_ir::ConditionValue;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::ProvidedVariableMetadata;
use graphql_ir::Variable;
use graphql_ir::VariableDefinition;
use graphql_ir::VariableName;
use graphql_ir::Visitor;
use graphql_ir::associated_data_impl;
use intern::string_key::StringKey;
use relay_config::ModuleImportConfig;
use relay_config::Surface;
use rustc_hash::FxHashMap;
use rustc_hash::FxHashSet;
use thiserror::Error;

use crate::ClientComponentBoundaryMetadata;
use crate::ModuleMetadata;
use crate::NoInlineFragmentSpreadMetadata;
use crate::RelayResolverMetadata;
use crate::RscSeamMetadata;
use crate::SERVER_DIRECTIVE;

/// Compiler-only references required to hydrate a server operation response.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct ServerOperationHandoffMetadata {
    /// Reader and normalization artifacts for client fragment boundaries.
    pub client_fragments: Vec<ServerOperationClientFragment>,
    /// The Relay RSC Resolver fields the operation selects.
    pub rsc_seams: Vec<RscSeamMetadata>,
}
associated_data_impl!(ServerOperationHandoffMetadata);

/// One client fragment referenced by a server operation handoff.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct ServerOperationClientFragment {
    /// The Reader fragment exposed to client code.
    pub fragment: FragmentDefinitionName,
    /// The normalization artifact used to publish the fragment's fields.
    pub client_normalization_operation: OperationDefinitionName,
    /// The source location used to resolve both generated artifacts.
    pub fragment_location: Location,
    /// The operation variables the boundary's normalization reads, sorted.
    /// A runtime that executes the boundary on its own needs these values
    /// and no other operation variables.
    pub root_variables: Vec<VariableName>,
    /// The provider-backed `@module` branches of the boundary's
    /// normalization. Their providers are functions, so the handoff names
    /// them by the exports of a generated `'use client'` module.
    pub module_providers: Vec<ModuleProviderBranch>,
}

/// A provider-backed `@module` branch: the `@match` document it belongs to,
/// the fragment its operation provider loads, and the component module its
/// component provider loads. Two `@match` fields can spread one fragment with
/// different components, so a branch is its document and fragment together.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct ModuleProviderBranch {
    pub document_name: StringKey,
    pub fragment_name: FragmentDefinitionName,
    pub fragment_location: Location,
    pub module_name: StringKey,
    pub module_source_location: SourceLocationKey,
}

impl ModuleProviderBranch {
    /// The key of the branch's `component` or `operation` provider in a
    /// handoff's `moduleProviders`.
    pub fn provider_key(&self, kind: &str) -> String {
        format!("{kind}${}${}", self.document_name, self.fragment_name)
    }

    /// The name the generated providers module exports the provider as: its
    /// key, with any character a JavaScript identifier cannot hold replaced.
    pub fn export_name(&self, kind: &str) -> String {
        self.provider_key(kind)
            .chars()
            .map(|c| match c {
                'a'..='z' | 'A'..='Z' | '0'..='9' | '_' | '$' => c,
                _ => '_',
            })
            .collect()
    }
}

/// Records on every explicit server query what it hands off to the client
/// (`serverHandoff`): its client fragments, with the operation variables each
/// one reads, and the Relay RSC Resolver fields it selects.
pub(crate) fn generate_server_operation_handoffs(
    program: &Program,
    fragments_program: &Program,
    module_import_config: &ModuleImportConfig,
) -> DiagnosticsResult<Program> {
    let mut server_operations: Vec<_> = program
        .operations()
        .filter(|operation| operation.directives.named(*SERVER_DIRECTIVE).is_some())
        .cloned()
        .collect();
    if server_operations.is_empty() {
        return Ok(program.clone());
    }
    server_operations.sort_unstable_by_key(|operation| operation.name.item);

    let mut next_program = program.clone();
    let mut handoffs = FxHashMap::default();
    let mut errors = Vec::new();

    for operation in server_operations {
        let mut collector = HandoffCollector::new(program);
        collector.visit_selections(&operation.selections);
        if !collector.errors.is_empty() {
            errors.append(&mut collector.errors);
            continue;
        }

        collector.client_fragments.sort_unstable();
        collector.client_fragments.dedup();
        for client_fragment in &mut collector.client_fragments {
            client_fragment.root_variables =
                boundary_root_variables(program, fragments_program, &operation, client_fragment);
            let mut branches: Vec<_> = module_branches(
                program,
                client_fragment.client_normalization_operation,
                module_import_config,
            )
            .into_iter()
            .map(|module| ModuleProviderBranch {
                document_name: module.key,
                fragment_name: module.fragment_name,
                fragment_location: module.fragment_source_location,
                module_name: module.module_name,
                module_source_location: module.module_source_location,
            })
            .collect();
            branches.sort_unstable();
            branches.dedup();
            client_fragment.module_providers = branches;
        }
        handoffs.insert(
            operation.name.item,
            ServerOperationHandoffMetadata {
                client_fragments: collector.client_fragments,
                rsc_seams: collector.rsc_seams,
            },
        );
    }

    if !errors.is_empty() {
        return Err(errors);
    }

    for operation in &mut next_program.operations {
        let name = operation.name.item;
        if let Some(handoff) = handoffs.remove(&name) {
            Arc::make_mut(operation).directives.push(handoff.into());
        }
    }
    Ok(next_program)
}

/// The `@module` selections with module providers in an artifact's
/// normalization, which inlines every fragment it spreads but a `@no_inline`
/// one (its own artifact) and an RSC field's root fragment.
fn module_branches(
    program: &Program,
    name: OperationDefinitionName,
    config: &ModuleImportConfig,
) -> Vec<ModuleMetadata> {
    let Some(operation) = program.operation(name) else {
        return Vec::new();
    };
    let mut finder = BranchFinder {
        program,
        config,
        visited_fragments: FxHashSet::default(),
        branches: Vec::new(),
    };
    finder.visit_selections(&operation.selections);
    finder.branches
}

struct BranchFinder<'program> {
    program: &'program Program,
    config: &'program ModuleImportConfig,
    visited_fragments: FxHashSet<FragmentDefinitionName>,
    branches: Vec<ModuleMetadata>,
}

impl Visitor for BranchFinder<'_> {
    const NAME: &'static str = "BranchFinder";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    // A module's own selections are in its normalization's artifact.
    fn visit_inline_fragment(&mut self, fragment: &InlineFragment) {
        let Some(module) = ModuleMetadata::find(&fragment.directives) else {
            return self.default_visit_inline_fragment(fragment);
        };
        // As codegen decides whether a `ModuleImport` gets providers.
        if self.config.dynamic_module_provider.is_some()
            && (self.config.surface != Some(Surface::Resolvers) || module.read_time_resolvers)
        {
            self.branches.push(module.clone());
        }
    }

    fn visit_fragment_spread(&mut self, spread: &FragmentSpread) {
        if NoInlineFragmentSpreadMetadata::find(&spread.directives).is_none()
            && RscSeamMetadata::find(&spread.directives).is_none()
            && self.visited_fragments.insert(spread.fragment.item)
            && let Some(fragment) = self.program.fragment(spread.fragment.item)
        {
            self.visit_selections(&fragment.selections);
        }
    }
}

struct HandoffCollector<'program> {
    program: &'program Program,
    client_fragments: Vec<ServerOperationClientFragment>,
    rsc_seams: Vec<RscSeamMetadata>,
    visited_fragments: FxHashSet<FragmentDefinitionName>,
    errors: Vec<Diagnostic>,
}

impl<'program> HandoffCollector<'program> {
    fn new(program: &'program Program) -> Self {
        Self {
            program,
            client_fragments: Vec::new(),
            rsc_seams: Vec::new(),
            visited_fragments: FxHashSet::default(),
            errors: Vec::new(),
        }
    }
}

impl Visitor for HandoffCollector<'_> {
    const NAME: &'static str = "HandoffCollector";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn visit_fragment_spread(&mut self, spread: &FragmentSpread) {
        if let Some(seam) = RscSeamMetadata::find(&spread.directives) {
            if !self
                .rsc_seams
                .iter()
                .any(|existing| existing.definition_id == seam.definition_id)
            {
                self.rsc_seams.push(seam.clone());
            }
            return;
        }

        if let Some(boundary) = ClientComponentBoundaryMetadata::find(&spread.directives) {
            self.client_fragments.push(ServerOperationClientFragment {
                fragment: boundary.fragment,
                client_normalization_operation: boundary.normalization_operation,
                fragment_location: boundary.fragment_location,
                root_variables: Vec::new(),
                module_providers: Vec::new(),
            });
            return;
        }

        if !self.visited_fragments.insert(spread.fragment.item) {
            return;
        }
        // A server-owned `@no_inline` fragment's selections live in its
        // normalization operation, which a base project does not provide.
        let program = self.program;
        if NoInlineFragmentSpreadMetadata::find(&spread.directives).is_some()
            && let Some(operation) =
                program.operation(OperationDefinitionName(spread.fragment.item.0))
        {
            self.visit_selections(&operation.selections);
            return;
        }

        if NoInlineFragmentSpreadMetadata::find(&spread.directives).is_some() {
            self.errors.push(Diagnostic::error(
                ValidationMessage::NoInlineFragmentUnsupported {
                    fragment_name: spread.fragment.item,
                },
                spread.fragment.location,
            ));
            return;
        }
        // This pass runs before `inline_fragments` inlines the spread.
        if let Some(fragment) = self.program.fragment(spread.fragment.item) {
            self.visit_selections(&fragment.selections);
        }
    }
}

/// The operation variables a client boundary's normalization reads, excluding
/// its own fragment arguments.
fn boundary_root_variables(
    program: &Program,
    fragments_program: &Program,
    operation: &OperationDefinition,
    client_fragment: &ServerOperationClientFragment,
) -> Vec<VariableName> {
    let is_defined = |definitions: &[VariableDefinition], name: &VariableName| {
        definitions
            .iter()
            .any(|definition| definition.name.item == *name)
    };
    let mut root_variables: Vec<VariableName> = if let Some(normalization) =
        program.operation(client_fragment.client_normalization_operation)
    {
        let mut collector = UsedVariableCollector::new(program, fragments_program);
        collector.visit_selections(&normalization.selections);
        collector
            .names
            .into_iter()
            .filter(|name| {
                !is_defined(&normalization.variable_definitions, name)
                    && is_defined(&operation.variable_definitions, name)
            })
            .collect()
    } else {
        // A base project's normalization: the operation variables its
        // fragment reads, outside each fragment's own arguments.
        let fragment = fragments_program
            .fragment(client_fragment.fragment)
            .unwrap_or_else(|| {
                panic!(
                    "should have the definition of client fragment `{}`, which a client boundary names",
                    client_fragment.fragment
                )
            });
        let mut collector = UsedVariableCollector::new(fragments_program, fragments_program);
        collector.visit_fragment(fragment);
        collector
            .names
            .into_iter()
            .filter(|name| is_defined(&operation.variable_definitions, name))
            .collect()
    };
    root_variables.sort_unstable();
    root_variables
}

/// Collects the variables that selections read, including inside the
/// normalization operations of the fragments they spread: those split
/// operations read operation variables at runtime too.
struct UsedVariableCollector<'program> {
    program: &'program Program,
    // Where a base project's fragments are defined: a derived project's
    // normalizations spread them, but `program` has neither their
    // definitions nor their split operations.
    fragments_program: &'program Program,
    names: FxHashSet<VariableName>,
    // The arguments of the fragment whose definition is being visited.
    local_names: FxHashSet<VariableName>,
    visited_fragments: FxHashSet<FragmentDefinitionName>,
}

impl<'program> UsedVariableCollector<'program> {
    fn new(program: &'program Program, fragments_program: &'program Program) -> Self {
        Self {
            program,
            fragments_program,
            names: FxHashSet::default(),
            local_names: FxHashSet::default(),
            visited_fragments: FxHashSet::default(),
        }
    }
}

impl Visitor for UsedVariableCollector<'_> {
    const NAME: &'static str = "UsedVariableCollector";
    const VISIT_ARGUMENTS: bool = true;
    const VISIT_DIRECTIVES: bool = true;

    fn visit_fragment(&mut self, fragment: &FragmentDefinition) {
        let local_names = fragment
            .variable_definitions
            .iter()
            .filter(|definition| ProvidedVariableMetadata::find(&definition.directives).is_none())
            .map(|definition| definition.name.item)
            .collect();
        let outer = std::mem::replace(&mut self.local_names, local_names);
        self.visit_selections(&fragment.selections);
        self.local_names = outer;
    }

    fn visit_variable(&mut self, variable: &Variable) {
        if !self.local_names.contains(&variable.name.item) {
            self.names.insert(variable.name.item);
        }
    }

    // A base fragment's definition still holds the branches that a constant
    // condition removes from its normalization.
    fn visit_condition(&mut self, condition: &Condition) {
        if let ConditionValue::Constant(value) = condition.value
            && value != condition.passing_value
        {
            return;
        }
        self.default_visit_condition(condition);
    }

    fn visit_directive(&mut self, directive: &Directive) {
        if directive.name.item == RelayResolverMetadata::directive_name()
            && let Some(resolver) = RelayResolverMetadata::from(directive)
        {
            self.visit_arguments(&resolver.field_arguments);
        }
        self.default_visit_directive(directive);
    }

    fn visit_fragment_spread(&mut self, spread: &FragmentSpread) {
        self.default_visit_fragment_spread(spread);
        if !self.visited_fragments.insert(spread.fragment.item) {
            return;
        }
        let normalization_operation =
            match ClientComponentBoundaryMetadata::find(&spread.directives) {
                Some(boundary) => Some(boundary.normalization_operation),
                None => NoInlineFragmentSpreadMetadata::find(&spread.directives)
                    .map(|_| OperationDefinitionName(spread.fragment.item.0)),
            };
        if let Some(operation) =
            normalization_operation.and_then(|name| self.program.operation(name))
        {
            // A split operation renames its fragment's own arguments, so no
            // enclosing fragment's arguments are in scope there.
            let outer = std::mem::take(&mut self.local_names);
            self.visit_selections(&operation.selections);
            self.local_names = outer;
        } else {
            // A `@no_inline` spread names its split operation; its signature
            // names the fragment.
            let fragment_name = spread
                .signature
                .as_ref()
                .map_or(spread.fragment.item, |signature| signature.name.item);
            if let Some(fragment) = self
                .program
                .fragment(fragment_name)
                .or_else(|| self.fragments_program.fragment(fragment_name))
            {
                self.visit_fragment(fragment);
            }
        }
    }
}

#[derive(
    Clone,
    Debug,
    Eq,
    Error,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
    serde::Serialize
)]
#[serde(tag = "type")]
enum ValidationMessage {
    #[error("Server-owned operations do not yet support non-inlined fragment `{fragment_name}`.")]
    NoInlineFragmentUnsupported {
        fragment_name: FragmentDefinitionName,
    },
}
