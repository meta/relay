/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::BTreeMap;

use common::WithLocation;
use docblock_shared::RELAY_RSC_VALUE_SCALAR_NAME;
use intern::string_key::Intern;
use relay_config::TypegenLanguage;
use relay_transforms::generate_relay_resolvers_model_fragments::get_resolver_source_hash;
use relay_transforms::is_operation_preloadable;
use relay_transforms::relay_resolvers::get_resolver_info;
use relay_typegen::FragmentLocations;
use relay_typegen::RscResolverSignatureTypeAssertionParams;
use schema::SDLSchema;
use schema::Schema;

use super::Artifact;
use super::Config;
use super::Programs;
use super::ProjectConfig;
use super::generate_preloadable_query_parameters_artifact;
use crate::ArtifactContent;
use crate::artifact_content::content::generate_rsc_resolver_signature_content;
use crate::artifact_map::ArtifactSourceKey;

pub type GenerateExtraArtifactsFn = Box<
    dyn Fn(&Config, &ProjectConfig, &SDLSchema, &Programs, &[Artifact]) -> Vec<Artifact>
        + Send
        + Sync,
>;

pub fn default_generate_extra_artifacts_fn(
    config: &Config,
    project_config: &ProjectConfig,
    schema: &SDLSchema,
    programs: &Programs,
    artifacts: &[Artifact],
) -> Vec<Artifact> {
    let mut extra: Vec<_> = artifacts
        .iter()
        .filter_map(|artifact| match &artifact.content {
            ArtifactContent::Operation {
                normalization_operation,
                text,
                id_and_text_hash,
                server_variables,
                ..
            } => {
                if !is_operation_preloadable(normalization_operation) {
                    return None;
                }

                Some(generate_preloadable_query_parameters_artifact(
                    project_config,
                    normalization_operation,
                    text.as_deref(),
                    id_and_text_hash.as_ref(),
                    server_variables.as_deref(),
                    artifact.artifact_source_keys.clone(),
                    artifact.source_file,
                ))
            }
            _ => None,
        })
        .collect();
    extra.extend(generate_rsc_resolver_signature_artifacts(
        config,
        project_config,
        schema,
        programs,
    ));
    extra
}

pub fn generate_rsc_resolver_signature_artifacts(
    config: &Config,
    project_config: &ProjectConfig,
    schema: &SDLSchema,
    programs: &Programs,
) -> Vec<Artifact> {
    if project_config.relay_rsc_capabilities().is_none()
        || project_config.typegen_config.language == TypegenLanguage::JavaScript
    {
        return Vec::new();
    }

    let fragment_locations = FragmentLocations::new(programs.typegen.fragments());
    let mut signatures = BTreeMap::new();
    for field in schema.get_fields() {
        let is_rsc_value = field
            .type_
            .inner()
            .get_scalar_id()
            .is_some_and(|scalar_id| {
                schema.scalar(scalar_id).name.item == *RELAY_RSC_VALUE_SCALAR_NAME
            });
        if !is_rsc_value {
            continue;
        }
        let Some(source_hash) = get_resolver_source_hash(field) else {
            continue;
        };
        let Some(Ok(resolver_info)) = get_resolver_info(schema, field, field.name.location) else {
            continue;
        };
        let (Some(fragment_name), Some(component_export_name)) =
            (resolver_info.fragment_name, resolver_info.import_name)
        else {
            continue;
        };

        // Base fragments are absent from the typegen program; their owning
        // project emits the assertion with its own language and path settings.
        let Some(root_fragment) = programs.typegen.fragment(fragment_name) else {
            continue;
        };
        let signature_name = format!(
            "{}${}$rscResolverSignature",
            fragment_name.0, component_export_name
        )
        .intern();
        let signature_definition = WithLocation::new(root_fragment.name.location, signature_name);
        let path = project_config.artifact_path_for_definition(signature_definition);
        signatures.entry(path.clone()).or_insert_with(|| Artifact {
            artifact_source_keys: vec![ArtifactSourceKey::ResolverHash(source_hash)],
            path,
            content: ArtifactContent::Generic {
                content: generate_rsc_resolver_signature_content(
                    config,
                    RscResolverSignatureTypeAssertionParams {
                        signature_definition,
                        schema_field: field,
                        root_fragment,
                        component_import_path: resolver_info.import_path,
                        component_export_name,
                        schema,
                        project_config,
                        fragment_locations: &fragment_locations,
                    },
                )
                .expect("writing an RSC Resolver signature artifact should not fail"),
            },
            source_file: field.name.location.source_location(),
        });
    }
    signatures.into_values().collect()
}
