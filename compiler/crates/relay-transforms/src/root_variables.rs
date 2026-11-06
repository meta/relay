/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashMap;
use std::collections::HashSet;

use common::Diagnostic;
use common::NamedItem;
use common::WithLocation;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionNameMap;
use graphql_ir::FragmentSpread;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::ValidationMessage;
use graphql_ir::Value;
use graphql_ir::Variable;
use graphql_ir::VariableName;
use graphql_ir::Visitor;
use schema::Schema;
use schema::Type;
use schema::TypeReference;

use super::RelayResolverMetadata;
use crate::no_inline::NO_INLINE_DIRECTIVE_NAME;

pub type VariableMap = HashMap<VariableName, Variable>;
pub enum VariableMapEntry {
    // The variables for this entry are still being populated as a result of a
    // cyclic fragment dependency.
    Pending,
    Populated(VariableMap),
}
pub type Visited = FragmentDefinitionNameMap<VariableMapEntry>;

pub struct InferVariablesVisitor<'program> {
    /// Cache fragments as they are transformed to avoid duplicate processing.
    /// Because @argument values don't matter (only variable names/types),
    /// each reachable fragment only has to be checked once.
    pub visited_fragments: Visited,
    program: &'program Program,
}

impl<'program> InferVariablesVisitor<'program> {
    pub fn new(program: &'program Program) -> Self {
        Self {
            visited_fragments: Default::default(),
            program,
        }
    }

    /// Determine the set of root variables that are transitively
    /// referenced by each fragment, ie the union of all root variables used in the
    /// fragment and any fragments it transitively spreads. The type of each variable will be
    /// the most specific type with which that variable is used (ie, the type that the variable
    /// must have for the query to be valid).
    pub fn infer_operation_variables(
        &mut self,
        operation: &OperationDefinition,
    ) -> (VariableMap, Vec<Diagnostic>) {
        let transitive_local_variables = Default::default();
        let mut visitor = VariablesVisitor::new(
            self.program,
            &mut self.visited_fragments,
            Default::default(),
            &transitive_local_variables,
        );
        visitor.visit_operation(operation);
        (visitor.variable_map, visitor.errors)
    }

    /// Similar to infer_operation_variables(), but finds root variables referenced transitively
    /// from the given fragment.
    pub fn infer_fragment_variables(&mut self, fragment: &FragmentDefinition) -> VariableMap {
        let transitive_local_variables = Default::default();
        let mut visitor = VariablesVisitor::new(
            self.program,
            &mut self.visited_fragments,
            Default::default(),
            &transitive_local_variables,
        );
        visitor.infer_fragment_variables(fragment)
    }
}

struct VariablesVisitor<'a, 'b> {
    variable_map: VariableMap,
    visited_fragments: &'a mut Visited,
    program: &'a Program,
    local_variables: HashSet<VariableName>,
    transitive_local_variables: &'b HashSet<VariableName>,
    cycle_detected: bool,
    errors: Vec<Diagnostic>,
}

impl<'a, 'b> VariablesVisitor<'a, 'b> {
    fn new(
        program: &'a Program,
        visited_fragments: &'a mut Visited,
        local_variables: HashSet<VariableName>,
        transitive_local_variables: &'b HashSet<VariableName>,
    ) -> Self {
        Self {
            variable_map: Default::default(),
            visited_fragments,
            program,
            local_variables,
            transitive_local_variables,
            cycle_detected: false,
            errors: Default::default(),
        }
    }
}

impl VariablesVisitor<'_, '_> {
    /// Determine the set of root variables referenced locally in each
    /// fragment. Note that RootArgumentDefinitions in the fragment's
    /// argumentDefinitions can contain spurious entries for legacy
    /// reasons. Instead of using those the fragment is traversed
    /// to reanalyze variable usage.
    fn infer_fragment_variables(&mut self, fragment: &FragmentDefinition) -> VariableMap {
        if let Some(map) = self.visited_fragments.get(&fragment.name.item) {
            match map {
                VariableMapEntry::Pending => {
                    // We have encountered a cycle! For the purposes of the
                    // parent traversal, we can safely return an empty map since
                    // the Pending fragment is already being processed and its
                    // variables will get added.
                    //
                    // However, this traversal is invalid, since it does not
                    // include the dependencies of the Pending fragment. We
                    // record this here, and consumers of this visitor can
                    // check if a cycle was encountered and avoid caching
                    // results which encountered cycles.
                    self.cycle_detected = true;
                    Default::default()
                }
                VariableMapEntry::Populated(map) => map.clone(),
            }
        } else {
            // Populate the cache with a pending entry so we can detect if we encounter a cycle.
            self.visited_fragments
                .insert(fragment.name.item, VariableMapEntry::Pending);

            // Avoid collecting local variables usages as root variables
            let local_variables = fragment
                .variable_definitions
                .iter()
                .map(|var| var.name.item)
                .collect::<HashSet<VariableName>>();
            let transitive_local_variables = if fragment
                .directives
                .named(*NO_INLINE_DIRECTIVE_NAME)
                .is_some()
            {
                Some(local_variables.clone())
            } else {
                None
            };
            let mut visitor = VariablesVisitor::new(
                self.program,
                self.visited_fragments,
                local_variables,
                transitive_local_variables
                    .as_ref()
                    .unwrap_or(self.transitive_local_variables),
            );
            visitor.visit_fragment(fragment);
            let result = visitor.variable_map;

            if visitor.cycle_detected {
                // If a cycle was detected, the result may be missing some
                // variables, so we won't cache it. Instead, we'll clean up our
                // Pending flag and force other callers to do their own traversal.
                self.visited_fragments.remove(&fragment.name.item);
            } else {
                // If no cycle was detected, this result can safely be reused by
                // other traversals, so we'll cache it for later use.
                self.visited_fragments.insert(
                    fragment.name.item,
                    VariableMapEntry::Populated(result.clone()),
                );
            }
            result
        }
    }

    fn is_root_variable(&self, name: VariableName) -> bool {
        !self.local_variables.contains(&name) && !self.transitive_local_variables.contains(&name)
    }

    // Record that the given (root) variable was used with the given type, updating the mapping of
    // used root variables:
    // - If the first time the variable has been seen, add it to the variable map
    // - If the variable has been seen before, update the type if the new type is more specific
    //   then the type with which the variable was previously used.
    // The net effect is that for each variable name the most specific type will be recorded along
    // with a location that requires that type.
    fn record_root_variable_usage(
        &mut self,
        name: &WithLocation<VariableName>,
        type_: &TypeReference<Type>,
    ) {
        let schema = &self.program.schema;
        let errors = &mut self.errors;
        self.variable_map
            .entry(name.item)
            .and_modify(|prev_variable| {
                // Note the use of *strict* subtype check: there's no reason to update the mapping
                // if the types are equivalent, only if the current type is more specific than
                // the previous type
                let is_stricter_type =
                    schema.is_type_strict_subtype_of(type_, &prev_variable.type_);
                if is_stricter_type {
                    *prev_variable = Variable {
                        name: *name,
                        type_: type_.clone(),
                    };
                } else if !schema.is_type_subtype_of(&prev_variable.type_, type_) {
                    errors.push(
                        Diagnostic::error(
                            ValidationMessage::IncompatibleVariableUsage {
                                prev_type: schema.get_type_string(&prev_variable.type_),
                                next_type: schema.get_type_string(type_),
                            },
                            name.location,
                        )
                        .annotate("is incompatible with", prev_variable.name.location),
                    )
                }
            })
            .or_insert_with(|| Variable {
                name: *name,
                type_: type_.clone(),
            });
    }
}

impl Visitor for VariablesVisitor<'_, '_> {
    const NAME: &'static str = "VariablesVisitor";
    const VISIT_ARGUMENTS: bool = true;
    const VISIT_DIRECTIVES: bool = true;

    fn visit_directive(&mut self, directive: &graphql_ir::Directive) {
        if directive.name.item == RelayResolverMetadata::directive_name()
            && let Some(relay_resolver_metadata) = RelayResolverMetadata::from(directive)
        {
            for arg in relay_resolver_metadata.field_arguments.iter() {
                if let Value::Variable(var) = &arg.value.item
                    && self.is_root_variable(var.name.item)
                {
                    self.record_root_variable_usage(&var.name, &var.type_);
                }
            }
        }
        self.default_visit_directive(directive);
    }

    fn visit_fragment_spread(&mut self, spread: &FragmentSpread) {
        self.visit_directives(&spread.directives);
        let fragment = self
            .program
            .fragment(spread.fragment.item)
            .expect("Expect fragment to exist.");

        // Detect root variables being passed as the value of @arguments;
        // recover the expected type from the corresponding argument definitions.
        if !fragment.variable_definitions.is_empty() {
            for arg in spread.arguments.iter() {
                if let Value::Variable(var) = &arg.value.item {
                    if let Some(def) = fragment
                        .variable_definitions
                        .named(VariableName(arg.name.item.0))
                        && self.is_root_variable(var.name.item)
                    {
                        self.record_root_variable_usage(&var.name, &def.type_);
                    }
                } else {
                    // Root variables nested inside an object or list literal,
                    // e.g. `@arguments(input: {text: $text})`.
                    self.visit_value(&arg.value.item);
                }
            }
        }

        // Merge any root variables referenced by the spread fragment
        // into this (parent) fragment's arguments.
        let referenced_fragment_variables = self.infer_fragment_variables(fragment);
        for (_, variable) in referenced_fragment_variables.into_iter() {
            self.record_root_variable_usage(&variable.name, &variable.type_);
        }
    }

    fn visit_variable(&mut self, variable: &Variable) {
        if self.is_root_variable(variable.name.item) {
            self.record_root_variable_usage(&variable.name, &variable.type_)
        }
    }
}
