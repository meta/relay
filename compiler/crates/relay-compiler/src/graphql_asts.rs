/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashSet;
use std::collections::hash_map::Entry;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;

use common::Diagnostic;
use common::SourceLocationKey;
use common::sync::ParallelIterator;
use dependency_analyzer::ExecutableDefinitionNameSet;
use fnv::FnvHashMap;
use graphql_ir::ExecutableDefinitionName;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::OperationDefinitionName;
use graphql_syntax::ExecutableDefinition;
use graphql_syntax::ParserFeatures;
use intern::string_key::StringKey;
use rayon::iter::IntoParallelRefIterator;
use relay_config::ProjectConfig;
use relay_config::ProjectName;
use relay_transforms::MATCH_CONSTANTS;

use crate::artifact_map::ArtifactSourceKey;
use crate::compiler_state::GraphQLSources;
use crate::config::Config;
use crate::errors::Error;
use crate::errors::Result;
use crate::file_source::LocatedGraphQLSource;
use crate::utils::get_parser_features;

/// Collect the names of fragments spread with a @module directive within the
/// given selections. When a definition that spreads a fragment with @module is
/// removed or modified, the spread fragment must be recompiled so that its
/// $normalization (SplitOperation) artifact can be removed if no longer needed.
fn collect_module_fragment_spreads_from_selections(
    selections: &[graphql_syntax::Selection],
    out: &mut Vec<ExecutableDefinitionName>,
) {
    for selection in selections {
        match selection {
            graphql_syntax::Selection::FragmentSpread(spread) => {
                if spread
                    .directives
                    .iter()
                    .any(|d| d.name.value == MATCH_CONSTANTS.module_directive_name.0)
                {
                    out.push(FragmentDefinitionName(spread.name.value).into());
                }
            }
            graphql_syntax::Selection::InlineFragment(inline_fragment) => {
                collect_module_fragment_spreads_from_selections(
                    &inline_fragment.selections.items,
                    out,
                );
            }
            graphql_syntax::Selection::LinkedField(field) => {
                collect_module_fragment_spreads_from_selections(&field.selections.items, out);
            }
            graphql_syntax::Selection::ScalarField(_) => {}
        }
    }
}

fn collect_fragment_spread_names(
    selections: &[graphql_syntax::Selection],
    out: &mut HashSet<StringKey>,
) {
    for selection in selections {
        match selection {
            graphql_syntax::Selection::FragmentSpread(spread) => {
                out.insert(spread.name.value);
            }
            graphql_syntax::Selection::InlineFragment(inline_fragment) => {
                collect_fragment_spread_names(&inline_fragment.selections.items, out);
            }
            graphql_syntax::Selection::LinkedField(field) => {
                collect_fragment_spread_names(&field.selections.items, out);
            }
            graphql_syntax::Selection::ScalarField(_) => {}
        }
    }
}

fn definition_selections(definition: &ExecutableDefinition) -> &[graphql_syntax::Selection] {
    match definition {
        ExecutableDefinition::Operation(operation) => &operation.selections.items,
        ExecutableDefinition::Fragment(fragment) => &fragment.selections.items,
    }
}

/// A collection of GraphQL abstract syntax trees (ASTs) for a set of files.
///
/// Stores definitions both per-file (for per-file lookup) and in a pre-flattened
/// Vec (for efficient access to all definitions). `get_all_executable_definitions`
/// returns a borrowed slice instead of cloning ~222K definitions each time.
#[derive(Debug)]
pub struct GraphQLAsts {
    /// A map of file paths to their corresponding GraphQL ASTs.
    asts: FnvHashMap<PathBuf, Vec<ExecutableDefinition>>,
    /// Pre-flattened Vec of all definitions across all files. Avoids expensive
    /// per-call cloning in `get_all_executable_definitions`.
    all_definitions: Vec<ExecutableDefinition>,
    /// Names of fragments and operations that are updated or created.
    pub pending_definition_names: ExecutableDefinitionNameSet,
    /// Names of fragments and operations that are deleted.
    pub removed_definition_names: Vec<ArtifactSourceKey>,
    /// Names of fragments that a changed or deleted definition no longer spreads.
    pub removed_spread_names: ExecutableDefinitionNameSet,
}

impl GraphQLAsts {
    pub fn get_executable_definitions_for_file(
        &self,
        file_path: &Path,
    ) -> Option<&Vec<ExecutableDefinition>> {
        self.asts.get(file_path)
    }

    pub fn get_all_executable_definitions(&self) -> &[ExecutableDefinition] {
        &self.all_definitions
    }

    pub fn from_graphql_sources_map(
        graphql_sources_map: &FnvHashMap<ProjectName, GraphQLSources>,
        dirty_artifact_sources: &FnvHashMap<ProjectName, Vec<ArtifactSourceKey>>,
        config: &Arc<Config>,
    ) -> Result<FnvHashMap<ProjectName, GraphQLAsts>> {
        graphql_sources_map
            .par_iter()
            .map(|(&project_name, sources)| {
                let project_config = &config.projects[&project_name];

                let asts = GraphQLAsts::from_graphql_sources(
                    sources,
                    dirty_artifact_sources
                        .get(&project_name)
                        .map(|dirty_artifacts| {
                            dirty_artifacts
                                .iter()
                                .filter_map(|artifact_source_key| match artifact_source_key {
                                    ArtifactSourceKey::ExecutableDefinition(def_name) => {
                                        Some(def_name)
                                    }
                                    ArtifactSourceKey::Schema()
                                    | ArtifactSourceKey::ResolverHash(_) => {
                                        // We're only concerned with collecting ExecutableDefinitionNames
                                        None
                                    }
                                })
                                .collect()
                        }),
                    project_config,
                )?;
                Ok((project_name, asts))
            })
            .collect::<Result<_>>()
    }

    /// Parses all source files for all projects into ASTs and builds up a Sources map that can
    /// be used to print errors with source code listing.
    /// Additionally collects the set of definition names that updated, given the compiler state
    pub fn from_graphql_sources(
        graphql_sources: &GraphQLSources,
        dirty_definitions: Option<Vec<&ExecutableDefinitionName>>,
        project_config: &ProjectConfig,
    ) -> Result<Self> {
        let parser_features = get_parser_features(project_config);

        let mut syntax_errors = Vec::new();

        let mut asts: FnvHashMap<PathBuf, Vec<ExecutableDefinition>> = Default::default();
        let mut pending_definition_names: ExecutableDefinitionNameSet = HashSet::default();
        let mut removed_definition_names = Vec::new();
        let mut removed_spread_names: ExecutableDefinitionNameSet = HashSet::default();

        if let Some(dirty_definitions) = dirty_definitions {
            pending_definition_names.extend(dirty_definitions);
        }

        let (pending_results, processed_results) = rayon::join(
            // Iterate over all pending sources, and parse each graphql string.
            // Prefer the entry from the pending source set, which contains the
            // latest values for the graphql strings in the file.
            || {
                graphql_sources
                    .pending
                    .par_iter()
                    .map(|(file_name, pending_graphql_sources)| {
                        parse_pending_graphql_source_and_collect_removed_definitions(
                            graphql_sources,
                            parser_features,
                            file_name,
                            pending_graphql_sources,
                        )
                    })
                    .collect::<Vec<_>>()
            },
            // Iterate over processed sources that aren't in the pending source set,
            // and parse each graphql string.
            || {
                graphql_sources
                    .processed
                    .par_iter()
                    .filter(
                        // Only parse the file if it isn't in the pending sources
                        |(file_name, _)| !graphql_sources.pending.contains_key(*file_name),
                    )
                    .map(|(file_name, processed_graphql_sources)| {
                        let mut definitions_for_file = Vec::new();
                        let mut local_syntax_errors = vec![];
                        for LocatedGraphQLSource {
                            index,
                            graphql_source,
                        } in processed_graphql_sources.iter()
                        {
                            let source_location =
                                SourceLocationKey::embedded(&file_name.to_string_lossy(), *index);
                            match graphql_syntax::parse_executable_with_features(
                                &graphql_source.text_source().text,
                                source_location,
                                parser_features,
                            ) {
                                Ok(document) => {
                                    definitions_for_file.extend(document.definitions);
                                }
                                Err(errors) => local_syntax_errors.extend(errors),
                            }
                        }
                        (file_name, definitions_for_file, local_syntax_errors)
                    })
                    .collect::<Vec<_>>()
            },
        );

        for PendingSourceResult {
            file_name,
            definitions_for_file,
            local_pending_definition_names,
            local_syntax_errors,
            local_removed_definition_names,
            local_removed_spread_names,
        } in pending_results
        {
            pending_definition_names.extend(local_pending_definition_names);
            syntax_errors.extend(local_syntax_errors);
            removed_definition_names.extend(local_removed_definition_names);
            removed_spread_names.extend(local_removed_spread_names);
            asts.insert(file_name.clone(), definitions_for_file);
        }

        for (file_name, definitions_for_file, local_syntax_errors) in processed_results {
            syntax_errors.extend(local_syntax_errors);
            match asts.entry(file_name.clone()) {
                Entry::Vacant(entry) => {
                    entry.insert(definitions_for_file);
                }
                Entry::Occupied(mut entry) => {
                    let definitions = entry.get_mut();
                    definitions.extend(definitions_for_file)
                }
            }
        }

        if syntax_errors.is_empty() {
            // Pre-flatten all definitions to avoid cloning on every call to
            // get_all_executable_definitions(). This trades memory for avoiding
            // ~222K deep clones per build on the intern project.
            let all_definitions = asts
                .par_iter()
                .flat_map_iter(|(_, definitions)| definitions.iter().cloned())
                .collect();
            Ok(Self {
                asts,
                all_definitions,
                pending_definition_names,
                removed_definition_names,
                removed_spread_names,
            })
        } else {
            Err(Error::DiagnosticsError {
                errors: syntax_errors,
            })
        }
    }
}

struct PendingSourceResult<'a> {
    file_name: &'a PathBuf,
    definitions_for_file: Vec<ExecutableDefinition>,
    local_pending_definition_names: Vec<ExecutableDefinitionName>,
    local_syntax_errors: Vec<Diagnostic>,
    local_removed_definition_names: Vec<ArtifactSourceKey>,
    local_removed_spread_names: Vec<ExecutableDefinitionName>,
}

fn parse_pending_graphql_source_and_collect_removed_definitions<'a>(
    graphql_sources: &GraphQLSources,
    parser_features: ParserFeatures,
    file_name: &'a PathBuf,
    pending_graphql_sources: &[LocatedGraphQLSource],
) -> PendingSourceResult<'a> {
    let mut definitions_for_file = Vec::new();
    let mut local_pending_definition_names: Vec<ExecutableDefinitionName> = vec![];
    let mut local_syntax_errors = vec![];
    let mut local_removed_definition_names = vec![];
    let mut local_removed_spread_names = vec![];
    for LocatedGraphQLSource {
        index,
        graphql_source,
    } in pending_graphql_sources.iter()
    {
        let source_location = SourceLocationKey::embedded(&file_name.to_string_lossy(), *index);
        match graphql_syntax::parse_executable_with_features(
            &graphql_source.text_source().text,
            source_location,
            parser_features,
        ) {
            Ok(document) => {
                for def in &document.definitions {
                    if let Some(name) = def.name() {
                        match def {
                            ExecutableDefinition::Operation(_) => local_pending_definition_names
                                .push(OperationDefinitionName(name).into()),
                            ExecutableDefinition::Fragment(_) => local_pending_definition_names
                                .push(FragmentDefinitionName(name).into()),
                        };
                    } else {
                        local_syntax_errors.push(Diagnostic::error(
                            "Expected operation to have a name (e.g. 'query <Name>')",
                            def.location(),
                        ))
                    }
                }
                definitions_for_file.extend(document.definitions);
            }
            Err(errors) => local_syntax_errors.extend(errors),
        }
    }
    // Parse the processed source to get all processed definition names
    // and collect definition names that are removed from that file.
    // (A definition moved to another file is considered as a deletion and a new source)
    if let Some(processed_graphql_sources) = graphql_sources.processed.get(file_name) {
        let mut spread_names = HashSet::new();
        for definition in &definitions_for_file {
            collect_fragment_spread_names(definition_selections(definition), &mut spread_names);
        }
        for LocatedGraphQLSource {
            index,
            graphql_source,
        } in processed_graphql_sources.iter()
        {
            // TODO: parse name instead of the whole graphql text
            let source_location = SourceLocationKey::embedded(&file_name.to_string_lossy(), *index);
            if let Ok(document) = graphql_syntax::parse_executable_with_features(
                &graphql_source.text_source().text,
                source_location,
                parser_features,
            ) {
                for def in document.definitions {
                    let mut old_spreads = HashSet::new();
                    collect_fragment_spread_names(definition_selections(&def), &mut old_spreads);
                    local_removed_spread_names.extend(
                        old_spreads.difference(&spread_names).map(|name| {
                            ExecutableDefinitionName::from(FragmentDefinitionName(*name))
                        }),
                    );
                    match def {
                        ExecutableDefinition::Operation(operation) => {
                            let still_exists = definitions_for_file.iter().any(|def| {
                                if let ExecutableDefinition::Operation(op) = def {
                                    op.name == operation.name
                                } else {
                                    false
                                }
                            });
                            if !still_exists && let Some(operation_name) = operation.name {
                                local_removed_definition_names.push(
                                    ArtifactSourceKey::ExecutableDefinition(
                                        ExecutableDefinitionName::OperationDefinitionName(
                                            OperationDefinitionName(operation_name.value),
                                        ),
                                    ),
                                );
                            }
                            // When a definition is removed or modified, any
                            // fragments it previously spread with @module may
                            // need to be recompiled so that the
                            // SplitOperation ($normalization) artifact can be
                            // removed if no longer needed.
                            collect_module_fragment_spreads_from_selections(
                                &operation.selections.items,
                                &mut local_pending_definition_names,
                            );
                        }
                        ExecutableDefinition::Fragment(fragment) => {
                            let still_exists = definitions_for_file.iter().any(|def| {
                                if let ExecutableDefinition::Fragment(frag) = def {
                                    frag.name == fragment.name
                                } else {
                                    false
                                }
                            });
                            if !still_exists {
                                local_removed_definition_names.push(
                                    ArtifactSourceKey::ExecutableDefinition(
                                        ExecutableDefinitionName::FragmentDefinitionName(
                                            FragmentDefinitionName(fragment.name.value),
                                        ),
                                    ),
                                );
                            }
                            // When a definition is removed or modified, any
                            // fragments it previously spread with @module may
                            // need to be recompiled so that the
                            // SplitOperation ($normalization) artifact can be
                            // removed if no longer needed.
                            collect_module_fragment_spreads_from_selections(
                                &fragment.selections.items,
                                &mut local_pending_definition_names,
                            );
                        }
                    }
                }
            }
        }
    }
    PendingSourceResult {
        file_name,
        definitions_for_file,
        local_pending_definition_names,
        local_syntax_errors,
        local_removed_definition_names,
        local_removed_spread_names,
    }
}
