/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! Artifact content refers to the generated code that is produced by the Relay compiler during the compilation process
//! to be used by Relay runtime.
//!
//! The artifact content module provides functionality for generating and managing different types of artifact content,
//! such as operations, fragments, and resolvers schema modules.
pub mod content;
pub mod content_section;

use std::sync::Arc;

use common::SourceLocationKey;
use content::generate_fragment;
use content::generate_operation;
use content::generate_resolvers_schema_module_content;
use content::generate_split_operation;
use content::generate_updatable_query;
use graphql_ir::FragmentDefinition;
use graphql_ir::OperationDefinition;
use intern::string_key::StringKey;
use relay_codegen::Printer;
use relay_codegen::QueryID;
use relay_typegen::FragmentLocations;
use schema::SDLSchema;

use self::content::generate_preloadable_query_parameters;
use crate::config::Config;
use crate::config::ProjectConfig;

#[derive(Clone)]
pub enum ArtifactContent {
    Operation {
        normalization_operation: Arc<OperationDefinition>,
        reader_operation: Arc<OperationDefinition>,
        typegen_operation: Arc<OperationDefinition>,
        source_hash: String,
        text: Option<String>,
        id_and_text_hash: Option<QueryID>,
        /// The variables `text` declares (`RequestParameters::server_variables`).
        server_variables: Option<Vec<StringKey>>,
    },
    UpdatableQuery {
        reader_operation: Arc<OperationDefinition>,
        typegen_operation: Arc<OperationDefinition>,
        source_hash: String,
    },
    PreloadableQueryParameters {
        normalization_operation: Arc<OperationDefinition>,
        query_id: Option<QueryID>,
        server_variables: Option<Vec<StringKey>>,
    },
    Fragment {
        reader_fragment: Arc<FragmentDefinition>,
        typegen_fragment: Arc<FragmentDefinition>,
        source_hash: Option<String>,
    },
    SplitOperation {
        normalization_operation: Arc<OperationDefinition>,
        typegen_operation: Option<Arc<OperationDefinition>>,
        source_hash: Option<String>,
        no_optional_fields_in_raw_response_type: bool,
    },
    ResolversSchema,
    Generic {
        content: Vec<u8>,
    },
}

impl ArtifactContent {
    pub fn as_bytes(
        &self,
        config: &Config,
        project_config: &ProjectConfig,
        printer: &mut Printer<'_>,
        schema: &SDLSchema,
        source_file: SourceLocationKey,
        fragment_locations: &FragmentLocations,
    ) -> Vec<u8> {
        let skip_types =
            if let Some(extra_artifacts_config) = &project_config.extra_artifacts_config {
                (extra_artifacts_config.skip_types_for_artifact)(source_file)
            } else {
                false
            };
        match self {
            ArtifactContent::Operation {
                normalization_operation,
                reader_operation,
                typegen_operation,
                source_hash,
                text,
                id_and_text_hash,
                server_variables,
            } => generate_operation(
                config,
                project_config,
                printer,
                schema,
                normalization_operation,
                reader_operation,
                typegen_operation,
                source_hash.into(),
                text.as_deref(),
                id_and_text_hash.as_ref(),
                server_variables.as_deref(),
                skip_types,
                fragment_locations,
            )
            .unwrap(),
            ArtifactContent::UpdatableQuery {
                reader_operation,
                typegen_operation,
                source_hash,
            } => generate_updatable_query(
                config,
                project_config,
                printer,
                schema,
                reader_operation,
                typegen_operation,
                source_hash.into(),
                skip_types,
                fragment_locations,
            )
            .unwrap(),
            ArtifactContent::PreloadableQueryParameters {
                normalization_operation,
                query_id,
                server_variables,
            } => generate_preloadable_query_parameters(
                config,
                project_config,
                printer,
                schema,
                normalization_operation,
                query_id.as_ref(),
                server_variables.as_deref(),
            )
            .unwrap(),
            ArtifactContent::SplitOperation {
                normalization_operation,
                typegen_operation,
                no_optional_fields_in_raw_response_type,
                source_hash,
            } => generate_split_operation(
                config,
                project_config,
                printer,
                schema,
                normalization_operation,
                typegen_operation.as_ref(),
                source_hash.as_deref(),
                fragment_locations,
                *no_optional_fields_in_raw_response_type,
            )
            .unwrap(),
            ArtifactContent::Fragment {
                reader_fragment,
                typegen_fragment,
                source_hash,
            } => generate_fragment(
                config,
                project_config,
                printer,
                schema,
                reader_fragment,
                typegen_fragment,
                source_hash.as_deref(),
                skip_types,
                fragment_locations,
            )
            .unwrap(),
            ArtifactContent::ResolversSchema => {
                generate_resolvers_schema_module_content(config, project_config, printer, schema)
                    .unwrap()
            }
            ArtifactContent::Generic { content } => content.clone(),
        }
    }
}
