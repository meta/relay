/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::path::PathBuf;
use std::sync::Arc;

use common::NamedItem;
use common::SourceLocationKey;
use fnv::FnvHashMap;
use graphql_ir::FragmentDefinition;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_text_printer::PrinterOptions;
use graphql_text_printer::compute_operation_text;
use graphql_text_printer::precompute_fragment_texts;
use intern::Lookup;
use intern::string_key::StringKey;
use rayon::prelude::*;
use relay_codegen::EXEC_TIME_RESOLVERS;
use relay_codegen::QueryID;
use relay_config::ResolversSchemaModuleConfig;
use relay_transforms::ArtifactSourceKeyData;
use relay_transforms::ClientEdgeGeneratedQueryMetadataDirective;
use relay_transforms::PrefetchablePaginationEdgesFragmentMetadata;
use relay_transforms::Programs;
use relay_transforms::RawResponseGenerationMode;
use relay_transforms::RefetchableDerivedFromMetadata;
use relay_transforms::SplitOperationMetadata;
use relay_transforms::UPDATABLE_DIRECTIVE;

pub use super::artifact_content::ArtifactContent;
use super::build_ir::SourceHashes;
use crate::artifact_map::ArtifactSourceKey;
use crate::config::ProjectConfig;

/// Represents a generated output artifact.
pub struct Artifact {
    /// List of source definitions that this artifact is generated from.
    /// It may be the name of the query/fragment or relay resolver hash.
    pub artifact_source_keys: Vec<ArtifactSourceKey>,
    pub path: PathBuf,
    pub content: ArtifactContent,
    /// The source file responsible for generating this file.
    /// For example: `my_project/Component.react.js`
    pub source_file: SourceLocationKey,
}

pub fn generate_artifacts(
    project_config: &ProjectConfig,
    programs: &Programs,
    source_hashes: Arc<SourceHashes>,
) -> Vec<Artifact> {
    let printer_options = PrinterOptions {
        compact: project_config
            .feature_flags
            .compact_query_text
            .is_fully_enabled(),
        ..Default::default()
    };
    // Pre-compute all fragment texts into a read-only map, then compute all
    // operation texts in parallel. This replaces the sequential mutable
    // OperationPrinter with thread-safe parallel computation.
    let fragment_texts = precompute_fragment_texts(&programs.operation_text, printer_options);
    let mut op_texts: FnvHashMap<OperationDefinitionName, String> = programs
        .operation_text
        .operations()
        .collect::<Vec<_>>()
        .into_par_iter()
        .map(|op| {
            (
                op.name.item,
                compute_operation_text(
                    op,
                    &programs.operation_text,
                    &fragment_texts,
                    printer_options,
                ),
            )
        })
        .collect();
    group_operations(programs).into_values().map(|operations| {
            if let Some(normalization) = operations.normalization {
                // We have a normalization AST... so we'll move forward with that
                if let Some(metadata) = SplitOperationMetadata::find(&normalization.directives)
                {
                    // Generate normalization file for SplitOperation
                    let source_file = metadata.location.source_location();
                    let source_hash = metadata.derived_from.and_then(|derived_from| source_hashes.get(&derived_from.into()).cloned());
                    let typegen_operation = if metadata.raw_response_type_generation_mode.is_some() {
                        Some(Arc::clone(normalization))
                    } else {
                        None
                    };

                    let artifact_source_keys = if let Some(artifact_source) = ArtifactSourceKeyData::find(&normalization.directives) {
                        vec![
                            ArtifactSourceKey::ResolverHash(artifact_source.0)
                        ]
                    } else {
                        // TODO: refactor `parent_documents` to include ArtifactSource and not ExecutableDefinition
                       metadata.parent_documents.iter().copied().map(ArtifactSourceKey::ExecutableDefinition).collect()
                    };

                    return Artifact {
                        artifact_source_keys,
                        path: project_config
                            .artifact_path_for_definition(normalization.name),
                        content: ArtifactContent::SplitOperation {
                            normalization_operation: Arc::clone(normalization),
                            typegen_operation,
                            no_optional_fields_in_raw_response_type: matches!(metadata.raw_response_type_generation_mode, Some(RawResponseGenerationMode::AllFieldsRequired)),
                            source_hash,
                        },
                        source_file,
                    }
                } else if let Some(derived_from_metadata) =
                    RefetchableDerivedFromMetadata::find(&normalization.directives)
                {
                    let source_name = derived_from_metadata.0;
                    let source_hash = source_hashes.get(&source_name.into()).cloned().unwrap();

                    return generate_normalization_artifact(
                        &mut op_texts,
                        ArtifactSourceKey::ExecutableDefinition(source_name.into()),
                        project_config,
                        &operations,
                        source_hash,
                    )
                } else if let Some(client_edges_directive) =
                    ClientEdgeGeneratedQueryMetadataDirective::find(&normalization.directives)
                {
                    let source_name = client_edges_directive.source_name.item;
                    let source_hash = source_hashes.get(&source_name).cloned().unwrap();
                    return generate_normalization_artifact(
                        &mut op_texts,
                        ArtifactSourceKey::ExecutableDefinition(source_name),
                        project_config,
                        &operations,
                        source_hash,
                    )
                } else {
                    let source_hash = source_hashes
                        .get(&normalization.name.item.into())
                        .cloned()
                        .unwrap();
                    return generate_normalization_artifact(
                        &mut op_texts,
                        ArtifactSourceKey::ExecutableDefinition(normalization.name.item.into()),
                        project_config,
                        &operations,
                        source_hash,
                    )
                }
            } else if let Some(reader) = operations.reader {
                // We don't have a normalization AST, but we do have a reader.
                // Therefore this must be an updatable query in order to continue.
                if reader
                    .directives
                    .named(*UPDATABLE_DIRECTIVE)
                    .is_some()
                {
                    let source_hash = source_hashes
                        .get(&reader.name.item.into())
                        .cloned()
                        .unwrap();
                    return generate_updatable_query_artifact(
                        ArtifactSourceKey::ExecutableDefinition(reader.name.item.into()),
                        project_config,
                        &operations,
                        source_hash,
                    )
                }
            }
            panic!("Expected at least one of an @updatable reader AST, or normalization AST to be present");
        })
        .chain(programs.reader.fragments().map(|reader_fragment| {
            let source_name = if let Some(client_edges_directive) =
                ClientEdgeGeneratedQueryMetadataDirective::find(&reader_fragment.directives)
            {
                client_edges_directive.source_name.item
            } else {
                reader_fragment.name.item.into()
            };
            // If the fragment is generated for the RelayResolver model (id, or model instance)
            // we need to update the source definition to include the original text of the resolver.
            let source_hash = source_hashes.get(&source_name).cloned();

            // We need this `if/else` here because of the way the compiler is handling the aritfacts
            // deletion (see commit_project in compiler.rs).
            // To remove the artifact, the artifact map should not contain any document/source that may
            // generate the artifact. If we merge these sources (fragment name and resolver hash)
            // then the removal of the source hash won't trigger the removal of the artifact, because
            // there will be anothe key (fragment name) in the artifacts map that will point to the
            // same generate artifact.
            let artifact_source_keys = if let Some(artifact_source) = ArtifactSourceKeyData::find(&reader_fragment.directives) {
                vec![
                    ArtifactSourceKey::ResolverHash(artifact_source.0)
                ]
            } else if let Some(edges_metadata) = PrefetchablePaginationEdgesFragmentMetadata::find(&reader_fragment.directives) {
                // The synthetic `{name}__edges` fragment is attributed to the
                // document its connection field belonged to, so its artifact is
                // removed together with that source definition rather than being
                // orphaned under its own synthetic name (e.g. on rename).
                vec![ArtifactSourceKey::ExecutableDefinition(edges_metadata.parent_document_name)]
            } else {
                vec![ArtifactSourceKey::ExecutableDefinition(source_name)]
            };

            generate_reader_artifact(
                project_config,
                programs,
                reader_fragment,
                source_hash,
                artifact_source_keys,
            )
        }))
        .chain(
            match project_config.resolvers_schema_module {
                Some(ResolversSchemaModuleConfig { path: Some(ref path) , .. }) =>
                vec![
                    generate_resolvers_schema_module_artifact(path.clone())
                ],
                _ => vec![],
            }
        )
        .collect()
}

fn generate_normalization_artifact(
    op_texts: &mut FnvHashMap<OperationDefinitionName, String>,
    artifact_source: ArtifactSourceKey,
    project_config: &ProjectConfig,
    operations: &OperationGroup<'_>,
    source_hash: String,
) -> Artifact {
    let text = operations
        .operation_text
        .map(|operation| op_texts.remove(&operation.name.item).unwrap());
    let normalization = operations
        .normalization
        .expect("Operations must have a normalization entry.");

    // Exec-time resolvers run in the network layer, where runs whose variables
    // differ only in what client code reads send the same server request.
    let server_variables = if normalization
        .directives
        .named(*EXEC_TIME_RESOLVERS)
        .is_some()
    {
        operations.operation_text.map(|operation| {
            operation
                .variable_definitions
                .iter()
                .map(|variable| variable.name.item.0)
                .collect()
        })
    } else {
        None
    };

    Artifact {
        artifact_source_keys: vec![artifact_source],
        path: project_config.artifact_path_for_definition(normalization.name),
        content: ArtifactContent::Operation {
            normalization_operation: Arc::clone(normalization),
            reader_operation: operations.expect_reader(),
            typegen_operation: operations.expect_typegen(),
            source_hash,
            text,
            id_and_text_hash: None,
            server_variables,
        },
        source_file: normalization.name.location.source_location(),
    }
}

pub fn generate_preloadable_query_parameters_artifact(
    project_config: &ProjectConfig,
    normalization: &Arc<OperationDefinition>,
    text: Option<&str>,
    id_and_text_hash: Option<&QueryID>,
    server_variables: Option<&[StringKey]>,
    source_keys: Vec<ArtifactSourceKey>,
    source_file: SourceLocationKey,
) -> Artifact {
    let query_id = match (id_and_text_hash, text) {
        (Some(query_id), _) => Some(query_id.clone()),
        // Client-only operations have no server text to persist.
        (None, None) => None,
        (None, Some(_)) => panic!(
            "Expected operation artifact to have an `id`. Ensure a `persistConfig` is setup for the current project."
        ),
    };

    let artifact_name = normalization.name.item.0.to_string() + "$parameters";

    Artifact {
        artifact_source_keys: source_keys,
        path: project_config.path_for_language_specific_artifact(source_file, artifact_name),
        content: ArtifactContent::PreloadableQueryParameters {
            normalization_operation: Arc::clone(normalization),
            query_id,
            server_variables: server_variables.map(<[StringKey]>::to_vec),
        },
        source_file,
    }
}

fn generate_updatable_query_artifact(
    artifact_source: ArtifactSourceKey,
    project_config: &ProjectConfig,
    operations: &OperationGroup<'_>,
    source_hash: String,
) -> Artifact {
    let reader = operations
        .reader
        .expect("Updatable operations must have a reader entry.");

    Artifact {
        artifact_source_keys: vec![artifact_source],
        path: project_config.artifact_path_for_definition(reader.name),
        content: ArtifactContent::UpdatableQuery {
            reader_operation: operations.expect_reader(),
            typegen_operation: operations.expect_typegen(),
            source_hash,
        },
        source_file: reader.name.location.source_location(),
    }
}

fn generate_reader_artifact(
    project_config: &ProjectConfig,
    programs: &Programs,
    reader_fragment: &Arc<FragmentDefinition>,
    source_hash: Option<String>,
    artifact_source_keys: Vec<ArtifactSourceKey>,
) -> Artifact {
    let name = reader_fragment.name.item;
    let typegen_fragment = programs
        .typegen
        .fragment(name)
        .expect("a type fragment should be generated for this fragment");
    Artifact {
        artifact_source_keys,
        path: project_config.artifact_path_for_definition(reader_fragment.name),
        content: ArtifactContent::Fragment {
            reader_fragment: Arc::clone(reader_fragment),
            typegen_fragment: Arc::clone(typegen_fragment),
            source_hash,
        },
        source_file: reader_fragment.name.location.source_location(),
    }
}

/// Operation with the same name from different `Program`s.
struct OperationGroup<'a> {
    normalization: Option<&'a Arc<OperationDefinition>>,
    operation_text: Option<&'a OperationDefinition>,
    reader: Option<&'a Arc<OperationDefinition>>,
    typegen: Option<&'a Arc<OperationDefinition>>,
}

impl OperationGroup<'_> {
    fn new() -> Self {
        OperationGroup {
            normalization: None,
            operation_text: None,
            reader: None,
            typegen: None,
        }
    }

    fn expect_reader(&self) -> Arc<OperationDefinition> {
        let normal_name = self
            .normalization
            .map_or("MISSING_ENTRY", |n| n.name.item.0.lookup());

        Arc::clone(
            self.reader.unwrap_or_else(|| {
                panic!("Expected to have a reader operation for `{normal_name}`")
            }),
        )
    }

    fn expect_typegen(&self) -> Arc<OperationDefinition> {
        let normal_name = self
            .normalization
            .map_or("MISSING_ENTRY", |n| n.name.item.0.lookup());

        Arc::clone(
            self.typegen.unwrap_or_else(|| {
                panic!("Expected to have a typegen operation for `{normal_name}`")
            }),
        )
    }
}

/// Groups operations from the given programs by name for efficient access.
/// `Programs::operation(name)` does a linear search, so it's more efficient to
/// group in a batch.
fn group_operations(programs: &Programs) -> FnvHashMap<StringKey, OperationGroup<'_>> {
    let mut grouped_operations: FnvHashMap<StringKey, OperationGroup<'_>> = programs
        .normalization
        .operations
        .iter()
        .map(|normalization_operation| {
            (
                normalization_operation.name.item.0,
                OperationGroup {
                    normalization: Some(normalization_operation),
                    operation_text: None,
                    reader: None,
                    typegen: None,
                },
            )
        })
        .collect();

    for operation in programs.operation_text.operations() {
        grouped_operations
            .entry(operation.name.item.0)
            .or_insert_with(OperationGroup::new)
            .operation_text = Some(operation);
    }
    for operation in programs.reader.operations() {
        grouped_operations
            .entry(operation.name.item.0)
            .or_insert_with(OperationGroup::new)
            .reader = Some(operation);
    }
    for operation in programs.typegen.operations() {
        grouped_operations
            .entry(operation.name.item.0)
            .or_insert_with(OperationGroup::new)
            .typegen = Some(operation);
    }

    grouped_operations
}

fn generate_resolvers_schema_module_artifact(path: PathBuf) -> Artifact {
    Artifact {
        artifact_source_keys: vec![ArtifactSourceKey::Schema()],
        path,
        content: ArtifactContent::ResolversSchema,
        source_file: SourceLocationKey::generated(),
    }
}
