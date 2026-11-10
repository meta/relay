/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashMap;
use std::sync::Arc;

use common::ConsoleLogger;
use common::FeatureFlag;
use common::FeatureFlags;
use common::NamedItem;
use common::SourceLocationKey;
use fixture_tests::Fixture;
use graphql_ir::BuilderOptions;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentVariablesSemantic;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::RelayMode;
use graphql_ir::build_ir_with_extra_features;
use graphql_syntax::parse_executable;
use graphql_test_helpers::diagnostics_to_sorted_string;
use graphql_text_printer::print_full_operation;
use intern::string_key::Intern;
use relay_codegen::EXEC_TIME_RESOLVERS;
use relay_codegen::JsModuleFormat;
use relay_codegen::build_request_params;
use relay_codegen::print_fragment;
use relay_codegen::print_operation;
use relay_codegen::print_request;
use relay_compiler::ConfigFileProject;
use relay_compiler::ProjectConfig;
use relay_compiler::find_duplicates;
use relay_compiler::validate;
use relay_config::NonNodeIdFieldsConfig;
use relay_config::ProjectName;
use relay_config::SchemaConfig;
use relay_test_schema::get_test_schema;
use relay_test_schema::get_test_schema_with_extensions;
use relay_transforms::DIRECTIVE_SPLIT_OPERATION;
use relay_transforms::apply_transforms;

pub async fn transform_fixture(fixture: &Fixture<'_>) -> Result<String, String> {
    let source_location = SourceLocationKey::standalone(fixture.file_name);

    if fixture.content.contains("%TODO%") {
        if fixture.content.contains("expected-to-throw") {
            return Err("TODO".to_string());
        }
        return Ok("TODO".to_string());
    }
    let no_inline_allowlist = vec![
        "autoFilledArgumentOnMatchPlainUserNameRenderer_name".intern(),
        "autoFilledArgumentOnMatchMarkdownUserNameRenderer_name".intern(),
        "fragmentWithMatchDirective_PlainUserNameRenderer_name".intern(),
        "fragmentWithMatchDirective_MarkdownUserNameRenderer_name".intern(),
        "matchFieldOverlapAcrossDocuments_MarkdownUserNameRenderer_name".intern(),
        "matchOnChildOfPlural_PlainUserNameRenderer_name".intern(),
        "matchOnChildOfPlural_MarkdownUserNameRenderer_name".intern(),
        "moduleDeduping_frag".intern(),
        "moduleInInlineFragment_MarkdownUserNameRenderer_name".intern(),
        "moduleOverlapAcrossDocuments_MarkdownUserNameRenderer_name".intern(),
        "moduleOverlapAcrossDocuments_PlainUserNameRenderer_name".intern(),
        "moduleOverlapAcrossDocuments_MarkdownUserNameRenderer_name".intern(),
        "moduleOverlapWithinDocument_MarkdownUserNameRenderer_name".intern(),
        "moduleOverlapWithinDocument_PlainUserNameRenderer_name".intern(),
        "moduleOverlapWithinDocument_MarkdownUserNameRenderer_name".intern(),
        "moduleWithDefer_MarkdownUserNameRenderer_name".intern(),
        "multipleModulesDifferentComponent_MarkdownUserNameRenderer_name".intern(),
        "multipleModulesDifferentFragment_MarkdownUserNameRenderer_name".intern(),
        "multipleModulesDifferentFragment_OtherMarkdownUserNameRenderer_name".intern(),
        "multipleModulesSameSelections_MarkdownUserNameRenderer_name".intern(),
        "multipleModulesWithKey_PlainUserNameRenderer_name".intern(),
        "multipleModulesWithKey_MarkdownUserNameRenderer_name".intern(),
        "multipleModulesWithoutKey_PlainUserNameRenderer_name".intern(),
        "multipleModulesWithoutKey_MarkdownUserNameRenderer_name".intern(),
        "noInlineFragmentAndModule_parent".intern(),
        "queryWithAndWithoutModuleDirective_MarkdownUserNameRenderer_name".intern(),
        "queryWithConditionalModule_MarkdownUserNameRenderer_name".intern(),
        "queryWithMatchDirective_PlainUserNameRenderer_name".intern(),
        "queryWithMatchDirective_MarkdownUserNameRenderer_name".intern(),
        "queryWithMatchDirectiveNoInlineExperimental_PlainUserNameRenderer_name".intern(),
        "queryWithMatchDirectiveNoInlineExperimental_MarkdownUserNameRenderer_name".intern(),
        "queryWithMatchDirectiveWithExtraArgument_PlainUserNameRenderer_name".intern(),
        "queryWithMatchDirectiveWithExtraArgument_MarkdownUserNameRenderer_name".intern(),
        "queryWithMatchDirectiveWithTypename_PlainUserNameRenderer_name".intern(),
        "queryWithMatchDirectiveWithTypename_MarkdownUserNameRenderer_name".intern(),
        "queryWithModuleDirective_MarkdownUserNameRenderer_name".intern(),
        "queryWithModuleDirectiveAndArguments_MarkdownUserNameRenderer_name".intern(),
        "queryWithModuleDirectiveAndArguments_PlainUserNameRenderer_name".intern(),
        "conflictingSelectionsWithNoInline_fragment".intern(),
        "providedVariableNoInlineFragment".intern(),
        "noInlineFragment_parent".intern(),
        "noInlineAbstractFragment_parent".intern(),
    ];

    let feature_flags = FeatureFlags {
        // test SplitOperations that do not use @no-inline D28460294
        no_inline: FeatureFlag::Limited {
            allowlist: no_inline_allowlist.into_iter().collect(),
        },
        enable_3d_branch_arg_generation: true,
        text_artifacts: FeatureFlag::Disabled,
        skip_printing_nulls: FeatureFlag::Disabled,
        compact_query_text: FeatureFlag::Disabled,
        relay_resolver_enable_interface_output_type: if fixture
            .content
            .contains("# relay-resolver-enable-interface-output-type")
        {
            FeatureFlag::Enabled
        } else {
            FeatureFlag::Disabled
        },
        enable_resolver_normalization_ast: fixture
            .content
            .contains("# enable_resolver_normalization_ast"),
        prefer_fetchable_in_refetch_queries: fixture
            .content
            .contains("# prefer_fetchable_in_refetch_queries"),
        ..Default::default()
    };

    let default_project_config = ProjectConfig {
        name: ProjectName::default(),
        feature_flags: Arc::new(feature_flags),
        js_module_format: JsModuleFormat::Haste,
        schema_config: SchemaConfig {
            non_node_id_fields: Some(NonNodeIdFieldsConfig {
                allowed_id_types: {
                    let mut mappings = HashMap::new();

                    mappings.insert("NonNode".intern(), "String".intern());

                    mappings
                },
            }),
            ..Default::default()
        },
        ..Default::default()
    };

    // Adding %project_config section on top of the fixture will allow
    // us to validate output changes with different configurations
    let parts: Vec<_> = fixture.content.split("%project_config%").collect();
    let (project_config, other_parts) = match parts.as_slice() {
        [fixture_content, project_config_str] => (
            {
                let config_file_project: ConfigFileProject =
                    serde_json::from_str(project_config_str).unwrap();
                ProjectConfig {
                    schema_config: config_file_project.schema_config,
                    typegen_config: config_file_project.typegen_config,
                    module_import_config: config_file_project.module_import_config,
                    feature_flags: config_file_project
                        .feature_flags
                        .map_or(default_project_config.feature_flags, |flags| {
                            Arc::new(flags)
                        }),
                    js_module_format: config_file_project.js_module_format,
                    relativize_js_module_paths: config_file_project.relativize_js_module_paths,
                    ..default_project_config
                }
            },
            fixture_content.split("%extensions%").collect::<Vec<&str>>(),
        ),
        [fixture_content] => (
            default_project_config,
            fixture_content.split("%extensions%").collect::<Vec<&str>>(),
        ),
        _ => panic!("Invalid fixture input {}", fixture.content),
    };

    let (base, schema) = match other_parts.as_slice() {
        [base, extensions] => (base, get_test_schema_with_extensions(extensions)),
        [base] => (base, get_test_schema()),
        _ => panic!("Invalid fixture input {}", fixture.content),
    };

    let ast = parse_executable(base, source_location)
        .map_err(|diagnostics| diagnostics_to_sorted_string(fixture.content, &diagnostics))?;

    find_duplicates(&ast.definitions, &[])
        .map_err(|diagnostics| diagnostics_to_sorted_string(fixture.content, &diagnostics))?;

    let ir_result = build_ir_with_extra_features(
        &schema,
        &ast.definitions,
        &BuilderOptions {
            allow_undefined_fragment_spreads: false,
            allow_non_overlapping_abstract_spreads: false,
            fragment_variables_semantic: FragmentVariablesSemantic::PassedValue,
            relay_mode: Some(RelayMode),
            default_anonymous_operation_name: None,
            allow_custom_scalar_literals: true, // for compatibility
        },
    );
    let ir = ir_result
        .map_err(|diagnostics| diagnostics_to_sorted_string(fixture.content, &diagnostics))?;
    let program = Program::from_definitions(Arc::clone(&schema), ir);

    validate(&program, &project_config, None)
        .map_err(|diagnostics| diagnostics_to_sorted_string(fixture.content, &diagnostics))?;

    // TODO pass base fragment names
    let programs = apply_transforms(
        &project_config,
        Arc::new(program),
        Default::default(),
        Arc::new(ConsoleLogger),
        None,
        None,
        vec![],
    )
    .map_err(|diagnostics| diagnostics_to_sorted_string(fixture.content, &diagnostics))?;

    let mut operations: Vec<&std::sync::Arc<OperationDefinition>> =
        programs.normalization.operations().collect();
    operations.sort_by_key(|operation| operation.name.item.0);
    let result = operations
        .into_iter()
        .map(|operation| {
            if operation
                .directives
                .named(*DIRECTIVE_SPLIT_OPERATION)
                .is_some()
            {
                let mut import_statements = Default::default();
                let operation =
                    print_operation(&schema, operation, &project_config, &mut import_statements);
                format!("{}{}", import_statements, operation)
            } else {
                let name = operation.name.item.0;
                let print_operation_node = programs
                    .operation_text
                    .operation(OperationDefinitionName(name));
                let text = print_operation_node.map_or_else(
                    || "Query Text is Empty.".to_string(),
                    |print_operation_node| {
                        print_full_operation(
                            &programs.operation_text,
                            print_operation_node,
                            Default::default(),
                        )
                    },
                );

                let reader_operation = programs
                    .reader
                    .operation(OperationDefinitionName(name))
                    .expect("a reader fragment should be generated for this operation");
                let operation_fragment = FragmentDefinition {
                    name: reader_operation.name.map(|x| FragmentDefinitionName(x.0)),
                    variable_definitions: reader_operation.variable_definitions.clone(),
                    selections: reader_operation.selections.clone(),
                    used_global_variables: Default::default(),
                    directives: reader_operation.directives.clone(),
                    type_condition: reader_operation.type_,
                };
                let mut import_statements = Default::default();
                let server_variables: Option<Vec<_>> = print_operation_node
                    .filter(|_| operation.directives.named(*EXEC_TIME_RESOLVERS).is_some())
                    .map(|print_operation_node| {
                        print_operation_node
                            .variable_definitions
                            .iter()
                            .map(|variable| variable.name.item.0)
                            .collect()
                    });
                let mut request_parameters = build_request_params(operation);
                request_parameters.server_variables = server_variables.as_deref();
                let request = print_request(
                    &schema,
                    operation,
                    &operation_fragment,
                    request_parameters,
                    &project_config,
                    &mut import_statements,
                );
                format!("{}{}\n\nQUERY:\n\n{}", import_statements, request, text)
            }
        })
        .chain({
            let mut fragments: Vec<&std::sync::Arc<FragmentDefinition>> =
                programs.reader.fragments().collect();
            fragments.sort_by_key(|fragment| fragment.name.item);
            fragments.into_iter().map(|fragment| {
                let mut import_statements = Default::default();
                let fragment =
                    print_fragment(&schema, fragment, &project_config, &mut import_statements);
                format!("{}{}", import_statements, fragment)
            })
        })
        .collect::<Vec<_>>();
    Ok(result.join("\n\n"))
}
