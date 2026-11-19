/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::cmp::Reverse;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::Location;
use common::Named;
use common::NamedItem;
use common::WithLocation;
use fnv::FnvHashMap;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::Program;
use graphql_ir::ProvidedVariableMetadata;
use graphql_ir::Transformed;
use graphql_ir::TransformedValue;
use graphql_ir::Transformer;
use graphql_ir::Variable;
use graphql_ir::VariableDefinition;
use graphql_ir::VariableName;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use itertools::Itertools;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;
use schema::TypeReference;
use thiserror::Error;

use crate::RscSeamMetadata;
use crate::util::format_provided_variable_name;

/// This transform applies provided variables in each fragment.
///  - Rename all uses of provided variables (in values)
///    \[provided_variable_name\] --> __pv__\[module_name\]
///  - Remove provided variables from (local) argument definitions
///  - Add provided variables to list of used global variables
///
/// apply_fragment_arguments depends on provide_variable_fragment_transform
pub fn provided_variable_fragment_transform(program: &Program) -> DiagnosticsResult<Program> {
    let mut transform = ProvidedVariableFragmentTransform::new(&program.schema);
    let program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());

    let errors = transform.get_errors();
    if errors.is_empty() {
        Ok(program)
    } else {
        Err(errors)
    }
}

struct ProvidedVariableDefinitions {
    // Different (module name, variable type) tuples give conflicting
    //  provided variable definitions.
    // We need to keep track of usages under each definition for stable
    //  error reporting.
    usages_map: FnvHashMap<(StringKey, TypeReference<Type>), Vec<Location>>,
}

impl ProvidedVariableDefinitions {
    fn new() -> ProvidedVariableDefinitions {
        ProvidedVariableDefinitions {
            usages_map: Default::default(),
        }
    }
    fn add(&mut self, module_name: StringKey, variable_def: &VariableDefinition) {
        let usages = self
            .usages_map
            .entry((module_name, variable_def.type_.clone()))
            .or_default();
        usages.push(variable_def.name.location);
    }

    fn get_errors(&self, schema: &SDLSchema, errors: &mut Vec<Diagnostic>) {
        if self.usages_map.len() > 1 {
            // The most frequently used definition is likely the intended one
            // Tie break by string ordering of module + type name
            let ((most_used_module, most_used_type), _) = self
                .usages_map
                .iter()
                .max_by_key(|((module, type_), usages)| {
                    (
                        usages.len(),
                        Reverse((module, schema.get_type_string(type_))),
                    )
                })
                .unwrap();

            for ((other_module, other_type), other_usages) in self.usages_map.iter() {
                if other_module != most_used_module {
                    for usage in other_usages {
                        errors.push(Diagnostic::error(
                            ValidationMessage::ProvidedVariableConflictingModuleNames {
                                module1: *most_used_module,
                                module2: *other_module,
                            },
                            *usage,
                        ));
                    }
                }

                if other_type != most_used_type {
                    for usage in other_usages {
                        errors.push(Diagnostic::error(
                            ValidationMessage::ProvidedVariableConflictingTypes {
                                module: *most_used_module,
                                existing_type: schema.get_type_string(most_used_type).intern(),
                                new_type: schema.get_type_string(other_type).intern(),
                            },
                            *usage,
                        ));
                    }
                }
            }
        }
    }
}

struct ProvidedVariableFragmentTransform<'schema> {
    schema: &'schema SDLSchema,
    all_provided_variables: FnvHashMap<VariableName, ProvidedVariableDefinitions>,
    // fragment local identifier --> transformed identifier
    in_scope_providers: FnvHashMap<VariableName, VariableName>,
}

impl<'schema> ProvidedVariableFragmentTransform<'schema> {
    fn new(schema: &'schema SDLSchema) -> Self {
        ProvidedVariableFragmentTransform {
            schema,
            all_provided_variables: Default::default(),
            in_scope_providers: Default::default(),
        }
    }

    fn get_errors(&self) -> Vec<Diagnostic> {
        let mut errors = Vec::new();

        for def in self.all_provided_variables.values() {
            def.get_errors(self.schema, &mut errors);
        }
        errors
    }

    fn add_provided_variable(
        &mut self,
        transformed_name: VariableName,
        module_name: StringKey,
        variable_def: &VariableDefinition,
    ) {
        let usages = self
            .all_provided_variables
            .entry(transformed_name)
            .or_insert_with(ProvidedVariableDefinitions::new);

        usages.add(module_name, variable_def);
    }

    fn get_variable_definitions(&self, fragment: &FragmentDefinition) -> Vec<VariableDefinition> {
        fragment
            .variable_definitions
            .iter()
            .filter(|def| {
                def.directives
                    .named(ProvidedVariableMetadata::directive_name())
                    .is_none()
            })
            .cloned()
            .collect_vec()
    }

    fn get_global_variables(&self, fragment: &FragmentDefinition) -> Vec<VariableDefinition> {
        let mut new_globals = fragment.used_global_variables.clone();
        new_globals.extend(fragment.variable_definitions.iter().filter_map(|def| {
            let transformed_name = self.in_scope_providers.get(&def.name())?;
            Some(VariableDefinition {
                name: WithLocation {
                    item: *transformed_name,
                    location: def.name.location,
                },
                ..def.clone()
            })
        }));
        new_globals
    }
}

impl Transformer<'_> for ProvidedVariableFragmentTransform<'_> {
    const NAME: &'static str = "ProvidedVariableFragmentTransform";
    const VISIT_ARGUMENTS: bool = true;
    const VISIT_DIRECTIVES: bool = true;

    fn transform_variable(&mut self, variable: &Variable) -> TransformedValue<Variable> {
        if let Some(transformed_name) = self.in_scope_providers.get(&variable.name.item) {
            TransformedValue::Replace(Variable {
                name: WithLocation {
                    location: variable.name.location,
                    item: *transformed_name,
                },
                type_: variable.type_.clone(),
            })
        } else {
            TransformedValue::Keep
        }
    }

    /// A Relay RSC field's component-only arguments live in its
    /// `RscSeamMetadata`, which default directive visiting does not reach.
    fn transform_directive(&mut self, directive: &Directive) -> Transformed<Directive> {
        if directive.name.item == RscSeamMetadata::directive_name()
            && let Some(seam) = RscSeamMetadata::from(directive)
        {
            return self
                .transform_arguments(&seam.component_arguments)
                .map(|component_arguments| {
                    RscSeamMetadata {
                        component_arguments,
                        ..seam.clone()
                    }
                    .into()
                })
                .into();
        }
        self.default_transform_directive(directive)
    }

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        debug_assert!(self.in_scope_providers.is_empty());
        for def in fragment.variable_definitions.iter() {
            if let Some(metadata) = ProvidedVariableMetadata::find(&def.directives) {
                let transformed_name = format_provided_variable_name(metadata.module_name);
                self.in_scope_providers.insert(def.name(), transformed_name);
                self.add_provided_variable(transformed_name, metadata.module_name, def);
            }
        }

        if self.in_scope_providers.is_empty() {
            Transformed::Keep
        } else {
            let selections = self.transform_selections(&fragment.selections);
            let new_fragment = FragmentDefinition {
                name: fragment.name,
                variable_definitions: self.get_variable_definitions(fragment),
                used_global_variables: self.get_global_variables(fragment),
                type_condition: fragment.type_condition,
                directives: fragment.directives.clone(),
                selections: selections.replace_or_else(|| fragment.selections.clone()),
            };
            self.in_scope_providers.clear();
            Transformed::Replace(new_fragment)
        }
    }
}

#[derive(Debug, Error, serde::Serialize)]
#[serde(tag = "type")]
enum ValidationMessage {
    #[error(
        "Modules '{module1}' and '{module2}' used by provided variables have indistinguishable names. (All non ascii-alphanumeric characters are stripped in Relay transform)"
    )]
    ProvidedVariableConflictingModuleNames {
        module1: StringKey,
        module2: StringKey,
    },

    #[error(
        "All provided variables using module '{module}' must declare the same type. Expected '{existing_type}' but found '{new_type}'"
    )]
    ProvidedVariableConflictingTypes {
        module: StringKey,
        existing_type: StringKey,
        new_type: StringKey,
    },
}
