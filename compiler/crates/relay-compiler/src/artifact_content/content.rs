/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::fmt::Error as FmtError;
use std::fmt::Result as FmtResult;
use std::fmt::Write;
use std::sync::Arc;

use common::NamedItem;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::OperationDefinition;
use relay_codegen::EXEC_TIME_RESOLVERS;
use relay_codegen::EXEC_TIME_RESOLVERS_ENABLED_ARGUMENT;
use relay_codegen::Printer;
use relay_codegen::QueryID;
use relay_codegen::build_request_params;
use relay_transforms::ASSIGNABLE_DIRECTIVE;
use relay_transforms::ClientEdgeGeneratedQueryMetadataDirective;
use relay_transforms::RelayDataDrivenDependencyMetadata;
use relay_transforms::is_operation_preloadable;
use relay_typegen::FragmentLocations;
use relay_typegen::RscResolverSignatureTypeAssertionParams;
use relay_typegen::TypegenConfig;
use relay_typegen::TypegenLanguage;
use relay_typegen::generate_fragment_type_exports_section;
use relay_typegen::generate_named_validator_export;
use relay_typegen::generate_operation_type_exports_section;
use relay_typegen::generate_rsc_resolver_signature_type_assertion_section;
use relay_typegen::generate_split_operation_type_exports_section;
use schema::SDLSchema;
use signedsource::SIGNING_TOKEN;

use super::super::ArtifactGeneratedTypes;
use super::content_section::CommentAnnotationsSection;
use super::content_section::ContentSection;
use super::content_section::ContentSections;
use super::content_section::DocblockSection;
use super::content_section::GenericSection;
use crate::config::Config;
use crate::config::ProjectConfig;

pub fn generate_preloadable_query_parameters(
    config: &Config,
    project_config: &ProjectConfig,
    printer: &mut Printer<'_>,
    schema: &SDLSchema,
    normalization_operation: &OperationDefinition,
    query_id: Option<&QueryID>,
) -> Result<Vec<u8>, FmtError> {
    let mut request_parameters = build_request_params(normalization_operation);
    let query_id = query_id.cloned();
    request_parameters.id = query_id.as_ref();

    let mut content_sections = ContentSections::default();

    // -- Begin Docblock Section --
    let extra_annotations = match &query_id {
        Some(QueryID::Persisted { text_hash, .. }) => vec![format!("@relayHash {}", text_hash)],
        _ => vec![],
    };
    content_sections.push(ContentSection::Docblock(generate_docblock_section(
        config,
        project_config,
        extra_annotations,
    )?));
    // -- End Docblock Section --

    // -- Begin Disable Lint Section --
    content_sections.push(ContentSection::Generic(generate_disable_lint_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Disable Lint Section --

    // -- Begin Use Strict Section --
    content_sections.push(ContentSection::Generic(generate_use_strict_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Use Strict Section --

    // -- Begin Metadata Annotations Section --
    let mut section = CommentAnnotationsSection::default();
    if let Some(QueryID::Persisted { id, .. }) = &request_parameters.id {
        writeln!(section, "@relayRequestID {id}")?;
    }
    content_sections.push(ContentSection::CommentAnnotations(section));
    // -- End Metadata Annotations Section --

    // -- Begin Types Section --
    let mut section = GenericSection::default();
    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "/*::")?;
    }

    write_import_type_from(
        project_config,
        &mut section,
        "PreloadableConcreteRequest",
        "relay-runtime",
    )?;
    write_import_type_from(
        project_config,
        &mut section,
        &normalization_operation.name.item.0.to_string(),
        &format!("./{}.graphql", normalization_operation.name.item.0),
    )?;

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "*/")?;
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End Types Section --

    // -- Begin Query Node Section --
    let preloadable_request = printer.print_preloadable_request(
        schema,
        request_parameters,
        normalization_operation,
        &mut Default::default(),
    );
    let mut section = GenericSection::default();

    let node_type = format!(
        "PreloadableConcreteRequest<{}>",
        normalization_operation.name.item.0
    );

    write_variable_value_with_type(
        &project_config.typegen_config.language,
        &mut section,
        "node",
        &node_type,
        &preloadable_request,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Query Node Section --

    // -- Begin Export Section --
    let mut section = GenericSection::default();
    write_export_generated_node(
        &project_config.typegen_config,
        &mut section,
        "node",
        Some(node_type),
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Export Section --

    content_sections.into_signed_bytes()
}

#[allow(clippy::too_many_arguments)]
pub fn generate_updatable_query(
    config: &Config,
    project_config: &ProjectConfig,
    printer: &mut Printer<'_>,
    schema: &SDLSchema,
    reader_operation: &OperationDefinition,
    typegen_operation: &OperationDefinition,
    source_hash: String,
    skip_types: bool,
    fragment_locations: &FragmentLocations,
) -> Result<Vec<u8>, FmtError> {
    let operation_fragment = FragmentDefinition {
        name: reader_operation.name.map(|x| FragmentDefinitionName(x.0)),
        variable_definitions: reader_operation.variable_definitions.clone(),
        selections: reader_operation.selections.clone(),
        used_global_variables: Default::default(),
        directives: reader_operation.directives.clone(),
        type_condition: reader_operation.type_,
    };

    let mut content_sections = ContentSections::default();

    // -- Begin Docblock Section --
    content_sections.push(ContentSection::Docblock(generate_docblock_section(
        config,
        project_config,
        vec![],
    )?));
    // -- End Docblock Section --

    // -- Begin Disable Lint Section --
    content_sections.push(ContentSection::Generic(generate_disable_lint_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Disable Lint Section --

    // -- Begin Use Strict Section --
    content_sections.push(ContentSection::Generic(generate_use_strict_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Use Strict Section --

    // -- Begin Types Section --
    let mut section = GenericSection::default();
    let generated_types = ArtifactGeneratedTypes::from_updatable_query(
        typegen_operation,
        skip_types,
        project_config.typegen_config.language,
    );

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "/*::")?;
    }

    write_import_type_from(
        project_config,
        &mut section,
        generated_types.imported_types,
        "relay-runtime",
    )?;

    if !skip_types {
        write!(
            section,
            "{}",
            generate_operation_type_exports_section(
                typegen_operation,
                reader_operation,
                schema,
                project_config,
                fragment_locations,
                None, // TODO: Add/investigrate support for provided variables in updatable queries
            )
        )?;
    }

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "*/")?;
    }

    content_sections.push(ContentSection::Generic(section));
    // -- End Types Section --

    // -- Begin Query Node Section --
    let mut section = GenericSection::default();
    let request = printer.print_updatable_query(schema, &operation_fragment);
    write_variable_value_with_type(
        &project_config.typegen_config.language,
        &mut section,
        "node",
        &generated_types.ast_type,
        &request,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Query Node Section --

    // -- Begin Query Node Hash Section --
    let mut section = GenericSection::default();
    write_source_hash(
        config,
        &project_config.typegen_config.language,
        &mut section,
        &source_hash,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Query Node Hash Section --

    // -- Begin Export Query Node Section --
    let mut section = GenericSection::default();
    write_export_generated_node(
        &project_config.typegen_config,
        &mut section,
        "node",
        generated_types.exported_type,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Export Query Node Section --

    content_sections.into_signed_bytes()
}

#[allow(clippy::too_many_arguments)]
pub fn generate_operation(
    config: &Config,
    project_config: &ProjectConfig,
    printer: &mut Printer<'_>,
    schema: &SDLSchema,
    normalization_operation: &OperationDefinition,
    reader_operation: &OperationDefinition,
    typegen_operation: &OperationDefinition,
    source_hash: String,
    text: Option<&str>,
    id_and_text_hash: Option<&QueryID>,
    skip_types: bool,
    fragment_locations: &FragmentLocations,
) -> Result<Vec<u8>, FmtError> {
    let mut request_parameters = build_request_params(normalization_operation);

    if id_and_text_hash.is_some() {
        request_parameters.id = id_and_text_hash;
        if project_config
            .persist
            .as_ref()
            .is_some_and(|config| config.include_query_text())
        {
            request_parameters.text = text.map(str::to_owned);
        }
    } else {
        request_parameters.text = text.map(str::to_owned);
    }

    let operation_fragment = FragmentDefinition {
        name: reader_operation.name.map(|x| FragmentDefinitionName(x.0)),
        variable_definitions: reader_operation.variable_definitions.clone(),
        selections: reader_operation.selections.clone(),
        used_global_variables: Default::default(),
        directives: reader_operation.directives.clone(),
        type_condition: reader_operation.type_,
    };

    let mut content_sections = ContentSections::default();

    // -- Begin Docblock Section --
    let extra_annotations = match id_and_text_hash {
        Some(QueryID::Persisted { text_hash, .. }) => vec![format!("@relayHash {}", text_hash)],
        _ => vec![],
    };
    content_sections.push(ContentSection::Docblock(generate_docblock_section(
        config,
        project_config,
        extra_annotations,
    )?));
    // -- End Docblock Section --

    // -- Begin Disable Lint Section --
    content_sections.push(ContentSection::Generic(generate_disable_lint_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Disable Lint Section --

    // -- Begin Use Strict Section --
    content_sections.push(ContentSection::Generic(generate_use_strict_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Use Strict Section --

    // -- Begin Metadata Annotations Section --
    let mut section = CommentAnnotationsSection::default();
    if let Some(QueryID::Persisted { id, .. }) = &request_parameters.id {
        writeln!(section, "@relayRequestID {id}")?;
    }
    if project_config.variable_names_comment {
        let mut variables = String::new();
        let mut non_null_variables = String::new();

        for variable_definition in &normalization_operation.variable_definitions {
            variables.push_str(&format!(" {}", variable_definition.name.item));
            if variable_definition.type_.is_non_null() {
                non_null_variables.push_str(&format!(" {}", variable_definition.name.item));
            }
        }
        writeln!(section, "@relayVariables{variables}")?;
        writeln!(section, "@relayRequiredVariables{non_null_variables}")?;
    }
    let data_driven_dependency_metadata =
        RelayDataDrivenDependencyMetadata::find(&operation_fragment.directives);
    if let Some(data_driven_dependency_metadata) = data_driven_dependency_metadata {
        write_data_driven_dependency_annotation(&mut section, data_driven_dependency_metadata)?;
    }
    content_sections.push(ContentSection::CommentAnnotations(section));
    // -- End Metadata Annotations Section --

    // -- Begin Types Section --
    let mut section = GenericSection::default();
    let generated_types = ArtifactGeneratedTypes::from_operation(
        typegen_operation,
        skip_types,
        request_parameters.is_client_request(),
        project_config.typegen_config.language,
    );

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "/*::")?;
    }

    write_import_type_from(
        project_config,
        &mut section,
        generated_types.imported_types,
        "relay-runtime",
    )?;

    if !skip_types {
        let maybe_provided_variables =
            printer.print_provided_variables(schema, normalization_operation);
        write!(
            section,
            "{}",
            generate_operation_type_exports_section(
                typegen_operation,
                normalization_operation,
                schema,
                project_config,
                fragment_locations,
                maybe_provided_variables,
            )
        )?;
    }

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "*/")?;
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End Types Section --

    let mut top_level_statements = Default::default();
    // -- Begin Query Node Section --
    let request = printer.print_request(
        schema,
        normalization_operation,
        &operation_fragment,
        request_parameters,
        &mut top_level_statements,
    );

    // -- Begin Top Level Statements Section --
    let mut section: GenericSection = GenericSection::default();
    write!(section, "{}", top_level_statements)?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Top Level Statements Section --

    let mut section = GenericSection::default();
    write_variable_value_with_type(
        &project_config.typegen_config.language,
        &mut section,
        "node",
        &generated_types.ast_type,
        &request,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Query Node Section --

    // -- Begin Query Node Hash Section --
    let mut section = GenericSection::default();
    write_source_hash(
        config,
        &project_config.typegen_config.language,
        &mut section,
        &source_hash,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Query Node Hash Section --

    // -- Begin Exec Time Resolvers Section --
    let mut section = GenericSection::default();
    if let Some(exec_time_resolvers_directive) = normalization_operation
        .directives
        .named(*EXEC_TIME_RESOLVERS)
        && ClientEdgeGeneratedQueryMetadataDirective::find(&normalization_operation.directives)
            .is_none()
    {
        // Routing an exec-time query happens at the network layer, which is handed only
        // `params` and never the operation AST. Assigning at module scope keeps this a
        // self-reference, so it costs no duplicated AST in the artifact.
        // Provider-gated queries expose it only when the provider selects exec-time mode.
        let has_enabled_provider = exec_time_resolvers_directive
            .arguments
            .named(*EXEC_TIME_RESOLVERS_ENABLED_ARGUMENT)
            .is_some();
        if has_enabled_provider {
            writeln!(
                section,
                "if (node.operation.exec_time_resolvers_enabled_provider?.get() === true) {{"
            )?;
        }
        let indentation = if has_enabled_provider { "  " } else { "" };
        match project_config.typegen_config.language {
            TypegenLanguage::Flow => writeln!(
                section,
                "{indentation}(node.params.metadata/*:: as any*/).operation = node.operation;"
            )?,
            TypegenLanguage::JavaScript => writeln!(
                section,
                "{indentation}node.params.metadata.operation = node.operation;"
            )?,
            TypegenLanguage::TypeScript => writeln!(
                section,
                "{indentation}(node.params.metadata as any).operation = node.operation;"
            )?,
        }
        if has_enabled_provider {
            writeln!(section, "}}")?;
        }
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End Exec Time Resolvers Section --

    // -- Begin PreloadableQueryRegistry Section --
    let mut section = GenericSection::default();
    let registry_key = match (id_and_text_hash, text) {
        (Some(_), _) if project_config.typegen_config.language == TypegenLanguage::Flow => {
            Some("(node.params/*:: as any*/).id")
        }
        (Some(_), _) => Some("node.params.id"),
        // Client-only operations have no persisted ID or server text, but
        // their request parameters contain a stable cache ID.
        (None, None) => Some("node.params.cacheID"),
        // Unpersisted server operations have no registry key;
        // `generate_preloadable_query_parameters_artifact` reports the missing
        // `persistConfig`.
        (None, Some(_)) => None,
    };
    if is_operation_preloadable(normalization_operation)
        && let Some(registry_key) = registry_key
    {
        if project_config.typegen_config.eager_es_modules {
            writeln!(
                section,
                "import {{ PreloadableQueryRegistry }} from 'relay-runtime';",
            )?;
            writeln!(
                section,
                "PreloadableQueryRegistry.set({registry_key}, node);",
            )?;
        } else {
            writeln!(
                section,
                "require('relay-runtime').PreloadableQueryRegistry.set({registry_key}, node);",
            )?;
        }
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End PreloadableQueryRegistry Section --

    // -- Begin Export Section --
    let mut section = GenericSection::default();
    write_export_generated_node(
        &project_config.typegen_config,
        &mut section,
        "node",
        generated_types.exported_type,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Export Section --

    content_sections.into_signed_bytes()
}

#[allow(clippy::too_many_arguments)]
pub fn generate_split_operation(
    config: &Config,
    project_config: &ProjectConfig,
    printer: &mut Printer<'_>,
    schema: &SDLSchema,
    normalization_operation: &OperationDefinition,
    typegen_operation: Option<&Arc<OperationDefinition>>,
    source_hash: Option<&str>,
    fragment_locations: &FragmentLocations,
    no_optional_fields_in_raw_response_type: bool,
) -> Result<Vec<u8>, FmtError> {
    let mut content_sections = ContentSections::default();

    // -- Begin Docblock Section --
    content_sections.push(ContentSection::Docblock(generate_docblock_section(
        config,
        project_config,
        vec![],
    )?));
    // -- End Docblock Section --

    // -- Begin Disable Lint Section --
    content_sections.push(ContentSection::Generic(generate_disable_lint_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Disable Lint Section --

    // -- Begin Use Strict Section --
    content_sections.push(ContentSection::Generic(generate_use_strict_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Use Strict Section --

    // -- Begin Types Section --
    let mut section = GenericSection::default();
    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "/*::")?;
    }
    write_import_type_from(
        project_config,
        &mut section,
        "NormalizationSplitOperation",
        "relay-runtime",
    )?;
    writeln!(section)?;

    if let Some(typegen_operation) = typegen_operation {
        writeln!(
            section,
            "{}",
            generate_split_operation_type_exports_section(
                typegen_operation,
                normalization_operation,
                schema,
                project_config,
                fragment_locations,
                no_optional_fields_in_raw_response_type
            )
        )?;
    }

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "*/")?;
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End Types Section --

    // -- Begin Top Level Statements Section --
    let mut section = GenericSection::default();
    let mut top_level_statements = Default::default();
    let operation =
        printer.print_operation(schema, normalization_operation, &mut top_level_statements);

    write!(section, "{}", top_level_statements)?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Top Level Statements Section --

    // -- Begin Operation Node Section --
    let mut section = GenericSection::default();
    write_variable_value_with_type(
        &project_config.typegen_config.language,
        &mut section,
        "node",
        "NormalizationSplitOperation",
        &operation,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Operation Node Section --

    // -- Begin Operation Node Hash Section --
    let mut section = GenericSection::default();
    if let Some(source_hash) = source_hash {
        write_source_hash(
            config,
            &project_config.typegen_config.language,
            &mut section,
            source_hash,
        )?;
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End Operation Node Hash Section --

    // -- Begin Export Section --
    let mut section = GenericSection::default();
    write_export_generated_node(&project_config.typegen_config, &mut section, "node", None)?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Export Section --

    content_sections.into_signed_bytes()
}

#[allow(clippy::too_many_arguments)]
pub fn generate_fragment(
    config: &Config,
    project_config: &ProjectConfig,
    printer: &mut Printer<'_>,
    schema: &SDLSchema,
    reader_fragment: &FragmentDefinition,
    typegen_fragment: &FragmentDefinition,
    source_hash: Option<&str>,
    skip_types: bool,
    fragment_locations: &FragmentLocations,
) -> Result<Vec<u8>, FmtError> {
    let is_assignable_fragment = typegen_fragment
        .directives
        .named(*ASSIGNABLE_DIRECTIVE)
        .is_some();
    if is_assignable_fragment {
        generate_assignable_fragment(
            config,
            project_config,
            schema,
            typegen_fragment,
            source_hash,
            fragment_locations,
        )
    } else {
        generate_read_only_fragment(
            config,
            project_config,
            printer,
            schema,
            reader_fragment,
            typegen_fragment,
            source_hash,
            skip_types,
            fragment_locations,
        )
    }
}

#[allow(clippy::too_many_arguments)]
fn generate_read_only_fragment(
    config: &Config,
    project_config: &ProjectConfig,
    printer: &mut Printer<'_>,
    schema: &SDLSchema,
    reader_fragment: &FragmentDefinition,
    typegen_fragment: &FragmentDefinition,
    source_hash: Option<&str>,
    skip_types: bool,
    fragment_locations: &FragmentLocations,
) -> Result<Vec<u8>, FmtError> {
    let mut content_sections = ContentSections::default();

    // -- Begin Docblock Section --
    content_sections.push(ContentSection::Docblock(generate_docblock_section(
        config,
        project_config,
        vec![],
    )?));
    // -- End Docblock Section --

    // -- Begin Disable Lint Section --
    content_sections.push(ContentSection::Generic(generate_disable_lint_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Disable Lint Section --

    // -- Begin Use Strict Section --
    content_sections.push(ContentSection::Generic(generate_use_strict_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Use Strict Section --

    // -- Begin Metadata Annotations Section --
    let mut section = CommentAnnotationsSection::default();
    if let Some(data_driven_dependency_metadata) =
        RelayDataDrivenDependencyMetadata::find(&reader_fragment.directives)
    {
        write_data_driven_dependency_annotation(&mut section, data_driven_dependency_metadata)?;
    }
    content_sections.push(ContentSection::CommentAnnotations(section));
    // -- End Metadata Annotations Section --

    // -- Begin Types Section --
    let mut section = GenericSection::default();
    let generated_types = ArtifactGeneratedTypes::from_fragment(
        typegen_fragment,
        skip_types,
        project_config.typegen_config.language,
    );

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "/*::")?;
    }

    write_import_type_from(
        project_config,
        &mut section,
        generated_types.imported_types,
        "relay-runtime",
    )?;

    if !skip_types {
        write!(
            section,
            "{}",
            generate_fragment_type_exports_section(
                typegen_fragment,
                schema,
                project_config,
                fragment_locations,
            )
        )?;
    }

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "*/")?;
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End Types Section --

    // -- Begin Top Level Statements Section --
    let mut section = GenericSection::default();
    let mut top_level_statements = Default::default();
    let fragment = printer.print_fragment(schema, reader_fragment, &mut top_level_statements);

    write!(section, "{}", top_level_statements)?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Top Level Statements Section --

    // -- Begin Fragment Node Section --
    let mut section = GenericSection::default();
    write_variable_value_with_type(
        &project_config.typegen_config.language,
        &mut section,
        "node",
        &generated_types.ast_type,
        &fragment,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Fragment Node Section --

    // -- Begin Fragment Node Hash Section --
    if let Some(source_hash) = source_hash {
        let mut section = GenericSection::default();
        write_source_hash(
            config,
            &project_config.typegen_config.language,
            &mut section,
            source_hash,
        )?;
        content_sections.push(ContentSection::Generic(section));
    }
    // -- End Fragment Node Hash Section --

    // -- Begin Fragment Node Export Section --
    let mut section = GenericSection::default();
    write_export_generated_node(
        &project_config.typegen_config,
        &mut section,
        "node",
        generated_types.exported_type,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Fragment Node Export Section --

    content_sections.into_signed_bytes()
}

fn generate_assignable_fragment(
    config: &Config,
    project_config: &ProjectConfig,
    schema: &SDLSchema,
    typegen_fragment: &FragmentDefinition,
    source_hash: Option<&str>,
    fragment_locations: &FragmentLocations,
) -> Result<Vec<u8>, FmtError> {
    let mut content_sections = ContentSections::default();

    // -- Begin Docblock Section --
    content_sections.push(ContentSection::Docblock(generate_docblock_section(
        config,
        project_config,
        vec![],
    )?));
    // -- End Docblock Section --

    // -- Begin Disable Lint Section --
    content_sections.push(ContentSection::Generic(generate_disable_lint_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Disable Lint Section --

    // -- Begin Use Strict Section --
    content_sections.push(ContentSection::Generic(generate_use_strict_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Use Strict Section --

    // -- Begin Types Section --
    let mut section = GenericSection::default();
    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "/*::")?;
    }

    write!(
        section,
        "{}",
        generate_fragment_type_exports_section(
            typegen_fragment,
            schema,
            project_config,
            fragment_locations,
        )
    )?;

    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "*/")?;
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End Types Section --

    // -- Begin Fragment Node Section --
    let mut section = GenericSection::default();
    write_variable_value_with_type(
        &project_config.typegen_config.language,
        &mut section,
        "node",
        "any",
        "{}",
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Fragment Node Section --

    // -- Begin Fragment Node Hash Section --
    if let Some(source_hash) = source_hash {
        let mut section = GenericSection::default();
        write_source_hash(
            config,
            &project_config.typegen_config.language,
            &mut section,
            source_hash,
        )?;
        content_sections.push(ContentSection::Generic(section));
    }
    // -- End Fragment Node Hash Section --

    // -- Begin Fragment Node Export Section --
    let mut section = GenericSection::default();
    write_export_generated_node(&project_config.typegen_config, &mut section, "node", None)?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Fragment Node Export Section --

    // -- Begin Export Section --
    let mut section = GenericSection::default();
    // Assignable fragments should never be passed to useFragment, and thus, we
    // don't need to emit a reader fragment.
    // Instead, we only need a named validator export, i.e.
    // module.exports.validate = ...
    let named_validator_export = generate_named_validator_export(
        typegen_fragment,
        schema,
        project_config,
        fragment_locations,
    );
    writeln!(section, "{named_validator_export}").unwrap();
    content_sections.push(ContentSection::Generic(section));
    // -- End Export Section --

    content_sections.into_signed_bytes()
}

fn write_variable_value_with_type(
    language: &TypegenLanguage,
    section: &mut dyn Write,
    variable_name: &str,
    type_: &str,
    value: &str,
) -> FmtResult {
    match language {
        TypegenLanguage::JavaScript => writeln!(section, "var {variable_name} = {value};"),
        TypegenLanguage::Flow => {
            writeln!(section, "var {variable_name}/*: {type_}*/ = {value};")
        }
        TypegenLanguage::TypeScript => {
            writeln!(section, "const {variable_name}: {type_} = {value};")
        }
    }
}

fn generate_disable_lint_section(language: &TypegenLanguage) -> Result<GenericSection, FmtError> {
    let mut section = GenericSection::default();
    match language {
        TypegenLanguage::TypeScript => {
            writeln!(section, "/* tslint:disable */")?;
            writeln!(section, "/* eslint-disable */")?;
            writeln!(section, "// @ts-nocheck")?;
        }
        TypegenLanguage::Flow | TypegenLanguage::JavaScript => {
            writeln!(section, "/* eslint-disable */")?;
        }
    }
    Ok(section)
}

fn generate_use_strict_section(language: &TypegenLanguage) -> Result<GenericSection, FmtError> {
    let mut section = GenericSection::default();
    match language {
        TypegenLanguage::TypeScript => {}
        TypegenLanguage::Flow | TypegenLanguage::JavaScript => {
            writeln!(section, "'use strict';")?;
        }
    }
    Ok(section)
}

fn write_import_type_from(
    project_config: &ProjectConfig,
    section: &mut dyn Write,
    type_: &str,
    from: &str,
) -> FmtResult {
    let language = &project_config.typegen_config.language;
    match language {
        TypegenLanguage::JavaScript => Ok(()),
        TypegenLanguage::Flow => writeln!(section, "import type {{ {type_} }} from '{from}';"),
        TypegenLanguage::TypeScript => writeln!(
            section,
            "import {}{{ {} }} from '{}';",
            if project_config.typegen_config.use_import_type_syntax {
                "type "
            } else {
                ""
            },
            type_,
            from
        ),
    }
}

pub fn write_export_generated_node(
    typegen_config: &TypegenConfig,
    section: &mut dyn Write,
    variable_node: &str,
    forced_type: Option<String>,
) -> FmtResult {
    let export_value = match (typegen_config.language, forced_type) {
        (TypegenLanguage::Flow, None) | (TypegenLanguage::JavaScript, _) => {
            variable_node.to_string()
        }
        (TypegenLanguage::TypeScript, _) => {
            // TODO: Support force_type for TypeScript
            variable_node.to_string()
        }
        (TypegenLanguage::Flow, Some(forced_type)) => {
            format!("(({variable_node}/*:: as any*/)/*:: as {forced_type}*/)")
        }
    };
    if typegen_config.eager_es_modules || typegen_config.language == TypegenLanguage::TypeScript {
        writeln!(section, "export default {export_value};")
    } else {
        writeln!(section, "module.exports = {export_value};")
    }
}

pub fn generate_docblock_section(
    config: &Config,
    project_config: &ProjectConfig,
    extra_annotations: Vec<String>,
) -> Result<DocblockSection, FmtError> {
    let mut section = DocblockSection::default();
    if !config.header.is_empty() {
        for header_line in &config.header {
            writeln!(section, "{header_line}")?;
        }
        writeln!(section)?;
    }
    writeln!(section, "{SIGNING_TOKEN}")?;
    for annotation in extra_annotations {
        writeln!(section, "{annotation}")?;
    }
    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "@flow")?;
    }
    writeln!(section, "@lightSyntaxTransform")?;

    if let Some(codegen_command) = &project_config
        .codegen_command
        .as_ref()
        .or(config.codegen_command.as_ref())
    {
        writeln!(section, "@codegen-command: {codegen_command}")?;
    }
    Ok(section)
}

fn write_source_hash(
    config: &Config,
    language: &TypegenLanguage,
    section: &mut dyn Write,
    source_hash: &str,
) -> FmtResult {
    if let Some(is_dev_variable_name) = &config.is_dev_variable_name {
        writeln!(section, "if ({is_dev_variable_name}) {{")?;
        match language {
            TypegenLanguage::Flow => {
                writeln!(section, "  (node/*:: as any*/).hash = \"{source_hash}\";")?
            }
            TypegenLanguage::JavaScript => writeln!(section, "  node.hash = \"{source_hash}\";")?,
            TypegenLanguage::TypeScript => {
                writeln!(section, "  (node as any).hash = \"{source_hash}\";")?
            }
        };
        writeln!(section, "}}")?;
    } else {
        match language {
            TypegenLanguage::Flow => {
                writeln!(section, "(node/*:: as any*/).hash = \"{source_hash}\";")?
            }
            TypegenLanguage::JavaScript => writeln!(section, "node.hash = \"{source_hash}\";")?,
            TypegenLanguage::TypeScript => {
                writeln!(section, "(node as any).hash = \"{source_hash}\";")?
            }
        };
    }

    Ok(())
}

fn write_data_driven_dependency_annotation(
    section: &mut CommentAnnotationsSection,
    data_driven_dependency_metadata: &RelayDataDrivenDependencyMetadata,
) -> FmtResult {
    for (key, value) in data_driven_dependency_metadata
        .direct_dependencies
        .iter()
        .flatten()
    {
        writeln!(section, "@dataDrivenDependency {key} {value}")?;
    }
    for (key, value) in data_driven_dependency_metadata
        .indirect_dependencies
        .iter()
        .flatten()
    {
        writeln!(section, "@indirectDataDrivenDependency {key} {value}")?;
    }
    Ok(())
}

pub fn generate_resolvers_schema_module_content(
    config: &Config,
    project_config: &ProjectConfig,
    printer: &mut Printer<'_>,
    schema: &SDLSchema,
) -> Result<Vec<u8>, FmtError> {
    let mut content_sections = ContentSections::default();
    // -- Begin Docblock Section --
    content_sections.push(ContentSection::Docblock(generate_docblock_section(
        config,
        project_config,
        vec![],
    )?));
    // -- End Docblock Section --

    // -- Begin Disable Lint Section --
    content_sections.push(ContentSection::Generic(generate_disable_lint_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Disable Lint Section --

    // -- Begin Use Strict Section --
    content_sections.push(ContentSection::Generic(generate_use_strict_section(
        &project_config.typegen_config.language,
    )?));
    // -- End Use Strict Section --

    // -- Begin Types Section --
    let mut section = GenericSection::default();
    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "/*::")?;
    }
    write_import_type_from(
        project_config,
        &mut section,
        "SchemaResolvers",
        "ReactiveQueryExecutor",
    )?;
    write_import_type_from(
        project_config,
        &mut section,
        "ResolverFunction, NormalizationSplitOperation",
        "relay-runtime",
    )?;
    writeln!(section)?;
    if project_config.typegen_config.language == TypegenLanguage::Flow {
        writeln!(section, "*/")?;
    }
    content_sections.push(ContentSection::Generic(section));
    // -- End Types Section --

    let mut top_level_statements = Default::default();
    let resolvers_schema = printer.print_resolvers_schema(schema, &mut top_level_statements);

    // -- Begin Top Level Statements Section --
    let mut section: GenericSection = GenericSection::default();
    write!(section, "{}", top_level_statements)?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Top Level Statements Section --

    // -- Begin Resolvers Schema Section --
    let mut section = GenericSection::default();
    write_variable_value_with_type(
        &project_config.typegen_config.language,
        &mut section,
        "schema_resolvers",
        "SchemaResolvers",
        &resolvers_schema,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Resolvers Schema Section --

    // -- Begin Exports Section --
    let mut section = GenericSection::default();
    write_export_generated_node(
        &project_config.typegen_config,
        &mut section,
        "schema_resolvers",
        None,
    )?;
    content_sections.push(ContentSection::Generic(section));
    // -- End Exports Section --

    content_sections.into_signed_bytes()
}

/// Generates a typecheck-only artifact for a Resolver-authored RSC component.
pub fn generate_rsc_resolver_signature_content(
    config: &Config,
    params: RscResolverSignatureTypeAssertionParams<'_>,
) -> Result<Vec<u8>, FmtError> {
    let mut content_sections = ContentSections::default();
    content_sections.push(ContentSection::Docblock(generate_docblock_section(
        config,
        params.project_config,
        vec!["@relayRscResolverSignature".to_string()],
    )?));

    // This artifact exists only so Flow or TypeScript checks its erased types.
    // `@ts-nocheck` would make the assertion a no-op, so do not use the shared
    // generated-artifact lint preamble here.
    let mut section = GenericSection::default();
    writeln!(section, "/* eslint-disable */")?;
    writeln!(section)?;
    write!(
        section,
        "{}",
        generate_rsc_resolver_signature_type_assertion_section(params)
    )?;
    content_sections.push(ContentSection::Generic(section));
    content_sections.into_signed_bytes()
}
