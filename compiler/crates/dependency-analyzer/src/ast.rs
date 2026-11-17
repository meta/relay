/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentDefinitionNameMap;
use graphql_ir::FragmentDefinitionNameSet;
use graphql_ir::OperationDefinitionName;
use graphql_syntax::*;
use rayon::prelude::*;

use crate::ExecutableDefinitionNameMap;
use crate::ExecutableDefinitionNameSet;

pub struct ReachableAst {
    /// The definitions that need to be compiled, includes the project
    /// definitions plus the fragment definitions in the base definitions
    /// reachable from the project definitions.
    pub definitions: Vec<ExecutableDefinition>,
    /// The fragment names added from the base definitions.
    pub base_fragment_names: FragmentDefinitionNameSet,
}

/// Get all definitions that are reachable from project definitions.
///
/// Takes borrowed slices to avoid cloning all definitions upfront. Only clones
/// into the result Vec once, saving ~222K deep clones for large projects with
/// base definitions.
pub fn get_reachable_ast(
    project_definitions: &[ExecutableDefinition],
    base_definitions: &[ExecutableDefinition],
) -> ReachableAst {
    if base_definitions.is_empty() {
        return ReachableAst {
            definitions: project_definitions.par_iter().cloned().collect(),
            base_fragment_names: Default::default(),
        };
    }

    let mut reachable_base_asts = Default::default();
    let mut base_definitions_map: FragmentDefinitionNameMap<&ExecutableDefinition> =
        Default::default();

    // Preprocess all base fragment definitions
    // Skipping operations because project definitions can't reference base operations
    for base_definition in base_definitions {
        if let ExecutableDefinition::Fragment(fragment) = base_definition {
            let name = FragmentDefinitionName(fragment.name.value);
            assert!(
                base_definitions_map.insert(name, base_definition).is_none(),
                "get_reachable_ast called on graph with duplicate definition of `{name}`"
            );
        }
    }

    // Clone project definitions into result once. We iterate the borrowed slice
    // directly below for selection visiting, avoiding a second clone.
    let mut result: Vec<ExecutableDefinition> = project_definitions.par_iter().cloned().collect();

    // Find references from project definitions -> base definitions
    for definition in project_definitions {
        let selections = match definition {
            ExecutableDefinition::Operation(definition) => &definition.selections,
            ExecutableDefinition::Fragment(definition) => &definition.selections,
        };
        visit_selections(
            &base_definitions_map,
            &mut reachable_base_asts,
            selections,
            false,
        )
    }

    result.extend(
        reachable_base_asts
            .iter()
            .map(|key| base_definitions_map[key].clone()),
    );

    ReachableAst {
        definitions: result,
        base_fragment_names: reachable_base_asts,
    }
}

/// Get fragment references of each definition
pub fn get_definition_references<'a>(
    definitions: impl IntoIterator<Item = &'a ExecutableDefinition>,
) -> ExecutableDefinitionNameMap<ExecutableDefinitionNameSet> {
    let mut result: ExecutableDefinitionNameMap<ExecutableDefinitionNameSet> = Default::default();
    for definition in definitions {
        let name = definition.name().expect("Expect a name on an operation");
        let name = match definition {
            ExecutableDefinition::Operation(_) => OperationDefinitionName(name).into(),
            ExecutableDefinition::Fragment(_) => FragmentDefinitionName(name).into(),
        };
        let mut selections: Vec<_> = match definition {
            ExecutableDefinition::Operation(definition) => &definition.selections.items,
            ExecutableDefinition::Fragment(definition) => &definition.selections.items,
        }
        .iter()
        .collect();
        let mut references: ExecutableDefinitionNameSet = Default::default();
        while let Some(selection) = selections.pop() {
            match selection {
                Selection::FragmentSpread(selection) => {
                    references.insert(FragmentDefinitionName(selection.name.value).into());
                }
                Selection::LinkedField(selection) => {
                    selections.extend(&selection.selections.items);
                }
                Selection::InlineFragment(selection) => {
                    selections.extend(&selection.selections.items);
                }
                Selection::ScalarField(_) => {}
            }
        }
        result.insert(name, references);
    }
    result
}

fn visit_selections(
    base_definitions_map: &FragmentDefinitionNameMap<&ExecutableDefinition>,
    reachable_base_asts: &mut FragmentDefinitionNameSet,
    selections: &List<Selection>,
    is_base: bool,
) {
    for selection in &selections.items {
        match selection {
            Selection::FragmentSpread(selection) => {
                let fragment_name = FragmentDefinitionName(selection.name.value);
                if is_base || base_definitions_map.contains_key(&fragment_name) {
                    traverse_base_ast_definition(
                        base_definitions_map,
                        reachable_base_asts,
                        fragment_name,
                    )
                }
            }
            Selection::LinkedField(selection) => visit_selections(
                base_definitions_map,
                reachable_base_asts,
                &selection.selections,
                is_base,
            ),
            Selection::InlineFragment(selection) => visit_selections(
                base_definitions_map,
                reachable_base_asts,
                &selection.selections,
                is_base,
            ),
            Selection::ScalarField(_) => {}
        }
    }
}

fn traverse_base_ast_definition(
    base_definitions_map: &FragmentDefinitionNameMap<&ExecutableDefinition>,
    reachable_base_asts: &mut FragmentDefinitionNameSet,
    key: FragmentDefinitionName,
) {
    if reachable_base_asts.contains(&key) {
        return;
    }
    if let Some(base_definition) = base_definitions_map.get(&key) {
        reachable_base_asts.insert(key);
        let selections = match base_definition {
            ExecutableDefinition::Operation(definition) => &definition.selections,
            ExecutableDefinition::Fragment(definition) => &definition.selections,
        };
        visit_selections(base_definitions_map, reachable_base_asts, selections, true)
    }
}
