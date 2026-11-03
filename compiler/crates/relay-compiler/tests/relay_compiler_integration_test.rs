/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<bd5527aaca3013eed7b6ded1e3a9823c>>
 */

mod relay_compiler_integration;

use relay_compiler_integration::transform_fixture;
use fixture_tests::test_fixture;

#[tokio::test]
async fn abstract_type_expands_one_inline_fragment_per_implementor() {
    let input = include_str!("relay_compiler_integration/fixtures/abstract_type_expands_one_inline_fragment_per_implementor.input");
    let expected = include_str!("relay_compiler_integration/fixtures/abstract_type_expands_one_inline_fragment_per_implementor.expected");
    test_fixture(transform_fixture, file!(), "abstract_type_expands_one_inline_fragment_per_implementor.input", "relay_compiler_integration/fixtures/abstract_type_expands_one_inline_fragment_per_implementor.expected", input, expected).await;
}

#[tokio::test]
async fn abstract_type_expansion_copies_nested_defer() {
    let input = include_str!("relay_compiler_integration/fixtures/abstract_type_expansion_copies_nested_defer.input");
    let expected = include_str!("relay_compiler_integration/fixtures/abstract_type_expansion_copies_nested_defer.expected");
    test_fixture(transform_fixture, file!(), "abstract_type_expansion_copies_nested_defer.input", "relay_compiler_integration/fixtures/abstract_type_expansion_copies_nested_defer.expected", input, expected).await;
}

#[tokio::test]
async fn bare_graphql_token_does_not_loop() {
    let input = include_str!("relay_compiler_integration/fixtures/bare_graphql_token_does_not_loop.input");
    let expected = include_str!("relay_compiler_integration/fixtures/bare_graphql_token_does_not_loop.expected");
    test_fixture(transform_fixture, file!(), "bare_graphql_token_does_not_loop.input", "relay_compiler_integration/fixtures/bare_graphql_token_does_not_loop.expected", input, expected).await;
}

#[tokio::test]
async fn block_string_hash_consistency() {
    let input = include_str!("relay_compiler_integration/fixtures/block_string_hash_consistency.input");
    let expected = include_str!("relay_compiler_integration/fixtures/block_string_hash_consistency.expected");
    test_fixture(transform_fixture, file!(), "block_string_hash_consistency.input", "relay_compiler_integration/fixtures/block_string_hash_consistency.expected", input, expected).await;
}

#[tokio::test]
async fn client_document_server_fragment_unsupported_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/client_document_server_fragment_unsupported.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_document_server_fragment_unsupported.invalid.expected");
    test_fixture(transform_fixture, file!(), "client_document_server_fragment_unsupported.invalid.input", "relay_compiler_integration/fixtures/client_document_server_fragment_unsupported.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn client_extension_interface_backed_by_resolvers_in_throw_on_field_error() {
    let input = include_str!("relay_compiler_integration/fixtures/client_extension_interface_backed_by_resolvers_in_throw_on_field_error.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_extension_interface_backed_by_resolvers_in_throw_on_field_error.expected");
    test_fixture(transform_fixture, file!(), "client_extension_interface_backed_by_resolvers_in_throw_on_field_error.input", "relay_compiler_integration/fixtures/client_extension_interface_backed_by_resolvers_in_throw_on_field_error.expected", input, expected).await;
}

#[tokio::test]
async fn client_model_sdl_extend_implements_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/client_model_sdl_extend_implements_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_model_sdl_extend_implements_interface.expected");
    test_fixture(transform_fixture, file!(), "client_model_sdl_extend_implements_interface.input", "relay_compiler_integration/fixtures/client_model_sdl_extend_implements_interface.expected", input, expected).await;
}

#[tokio::test]
async fn client_mutation_extension() {
    let input = include_str!("relay_compiler_integration/fixtures/client_mutation_extension.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_mutation_extension.expected");
    test_fixture(transform_fixture, file!(), "client_mutation_extension.input", "relay_compiler_integration/fixtures/client_mutation_extension.expected", input, expected).await;
}

#[tokio::test]
async fn client_mutation_resolver() {
    let input = include_str!("relay_compiler_integration/fixtures/client_mutation_resolver.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_mutation_resolver.expected");
    test_fixture(transform_fixture, file!(), "client_mutation_resolver.input", "relay_compiler_integration/fixtures/client_mutation_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn client_mutation_resolver_different_mutation_ok() {
    let input = include_str!("relay_compiler_integration/fixtures/client_mutation_resolver_different_mutation_ok.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_mutation_resolver_different_mutation_ok.expected");
    test_fixture(transform_fixture, file!(), "client_mutation_resolver_different_mutation_ok.input", "relay_compiler_integration/fixtures/client_mutation_resolver_different_mutation_ok.expected", input, expected).await;
}

#[tokio::test]
async fn client_mutation_resolver_invalid_disabled() {
    let input = include_str!("relay_compiler_integration/fixtures/client_mutation_resolver_invalid_disabled.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_mutation_resolver_invalid_disabled.expected");
    test_fixture(transform_fixture, file!(), "client_mutation_resolver_invalid_disabled.input", "relay_compiler_integration/fixtures/client_mutation_resolver_invalid_disabled.expected", input, expected).await;
}

#[tokio::test]
async fn client_mutation_resolver_invalid_nonscalar() {
    let input = include_str!("relay_compiler_integration/fixtures/client_mutation_resolver_invalid_nonscalar.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_mutation_resolver_invalid_nonscalar.expected");
    test_fixture(transform_fixture, file!(), "client_mutation_resolver_invalid_nonscalar.input", "relay_compiler_integration/fixtures/client_mutation_resolver_invalid_nonscalar.expected", input, expected).await;
}

#[tokio::test]
async fn client_schema_extension_in_throw_on_field_error() {
    let input = include_str!("relay_compiler_integration/fixtures/client_schema_extension_in_throw_on_field_error.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_schema_extension_in_throw_on_field_error.expected");
    test_fixture(transform_fixture, file!(), "client_schema_extension_in_throw_on_field_error.input", "relay_compiler_integration/fixtures/client_schema_extension_in_throw_on_field_error.expected", input, expected).await;
}

#[tokio::test]
async fn client_schema_extension_interface_uses_resolver_type() {
    let input = include_str!("relay_compiler_integration/fixtures/client_schema_extension_interface_uses_resolver_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/client_schema_extension_interface_uses_resolver_type.expected");
    test_fixture(transform_fixture, file!(), "client_schema_extension_interface_uses_resolver_type.input", "relay_compiler_integration/fixtures/client_schema_extension_interface_uses_resolver_type.expected", input, expected).await;
}

#[tokio::test]
async fn config_validation_excluded_source_directory() {
    let input = include_str!("relay_compiler_integration/fixtures/config_validation_excluded_source_directory.input");
    let expected = include_str!("relay_compiler_integration/fixtures/config_validation_excluded_source_directory.expected");
    test_fixture(transform_fixture, file!(), "config_validation_excluded_source_directory.input", "relay_compiler_integration/fixtures/config_validation_excluded_source_directory.expected", input, expected).await;
}

#[tokio::test]
async fn config_validation_invalid_exclude_glob() {
    let input = include_str!("relay_compiler_integration/fixtures/config_validation_invalid_exclude_glob.input");
    let expected = include_str!("relay_compiler_integration/fixtures/config_validation_invalid_exclude_glob.expected");
    test_fixture(transform_fixture, file!(), "config_validation_invalid_exclude_glob.input", "relay_compiler_integration/fixtures/config_validation_invalid_exclude_glob.expected", input, expected).await;
}

#[tokio::test]
async fn config_validation_invalid_excludes_extensions_glob() {
    let input = include_str!("relay_compiler_integration/fixtures/config_validation_invalid_excludes_extensions_glob.input");
    let expected = include_str!("relay_compiler_integration/fixtures/config_validation_invalid_excludes_extensions_glob.expected");
    test_fixture(transform_fixture, file!(), "config_validation_invalid_excludes_extensions_glob.input", "relay_compiler_integration/fixtures/config_validation_invalid_excludes_extensions_glob.expected", input, expected).await;
}

#[tokio::test]
async fn config_validation_missing_schema_extension_directory() {
    let input = include_str!("relay_compiler_integration/fixtures/config_validation_missing_schema_extension_directory.input");
    let expected = include_str!("relay_compiler_integration/fixtures/config_validation_missing_schema_extension_directory.expected");
    test_fixture(transform_fixture, file!(), "config_validation_missing_schema_extension_directory.input", "relay_compiler_integration/fixtures/config_validation_missing_schema_extension_directory.expected", input, expected).await;
}

#[tokio::test]
async fn config_validation_missing_schema_file() {
    let input = include_str!("relay_compiler_integration/fixtures/config_validation_missing_schema_file.input");
    let expected = include_str!("relay_compiler_integration/fixtures/config_validation_missing_schema_file.expected");
    test_fixture(transform_fixture, file!(), "config_validation_missing_schema_file.input", "relay_compiler_integration/fixtures/config_validation_missing_schema_file.expected", input, expected).await;
}

#[tokio::test]
async fn config_validation_missing_source_directory() {
    let input = include_str!("relay_compiler_integration/fixtures/config_validation_missing_source_directory.input");
    let expected = include_str!("relay_compiler_integration/fixtures/config_validation_missing_source_directory.expected");
    test_fixture(transform_fixture, file!(), "config_validation_missing_source_directory.input", "relay_compiler_integration/fixtures/config_validation_missing_source_directory.expected", input, expected).await;
}

#[tokio::test]
async fn config_validation_project_missing() {
    let input = include_str!("relay_compiler_integration/fixtures/config_validation_project_missing.input");
    let expected = include_str!("relay_compiler_integration/fixtures/config_validation_project_missing.expected");
    test_fixture(transform_fixture, file!(), "config_validation_project_missing.input", "relay_compiler_integration/fixtures/config_validation_project_missing.expected", input, expected).await;
}

#[tokio::test]
async fn connection_missing_count_args_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/connection_missing_count_args.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/connection_missing_count_args.invalid.expected");
    test_fixture(transform_fixture, file!(), "connection_missing_count_args.invalid.input", "relay_compiler_integration/fixtures/connection_missing_count_args.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn custom_scalar_variable_default_arg_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/custom_scalar_variable_default_arg.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/custom_scalar_variable_default_arg.invalid.expected");
    test_fixture(transform_fixture, file!(), "custom_scalar_variable_default_arg.invalid.input", "relay_compiler_integration/fixtures/custom_scalar_variable_default_arg.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn custom_scalar_variable_default_arg_non_strict() {
    let input = include_str!("relay_compiler_integration/fixtures/custom_scalar_variable_default_arg_non_strict.input");
    let expected = include_str!("relay_compiler_integration/fixtures/custom_scalar_variable_default_arg_non_strict.expected");
    test_fixture(transform_fixture, file!(), "custom_scalar_variable_default_arg_non_strict.input", "relay_compiler_integration/fixtures/custom_scalar_variable_default_arg_non_strict.expected", input, expected).await;
}

#[tokio::test]
async fn dangerously_throw_on_semantically_nullable_field() {
    let input = include_str!("relay_compiler_integration/fixtures/dangerously_throw_on_semantically_nullable_field.input");
    let expected = include_str!("relay_compiler_integration/fixtures/dangerously_throw_on_semantically_nullable_field.expected");
    test_fixture(transform_fixture, file!(), "dangerously_throw_on_semantically_nullable_field.input", "relay_compiler_integration/fixtures/dangerously_throw_on_semantically_nullable_field.expected", input, expected).await;
}

#[tokio::test]
async fn default_excludes_node_modules() {
    let input = include_str!("relay_compiler_integration/fixtures/default_excludes_node_modules.input");
    let expected = include_str!("relay_compiler_integration/fixtures/default_excludes_node_modules.expected");
    test_fixture(transform_fixture, file!(), "default_excludes_node_modules.input", "relay_compiler_integration/fixtures/default_excludes_node_modules.expected", input, expected).await;
}

#[tokio::test]
async fn delete_match_removes_normalization() {
    let input = include_str!("relay_compiler_integration/fixtures/delete_match_removes_normalization.input");
    let expected = include_str!("relay_compiler_integration/fixtures/delete_match_removes_normalization.expected");
    test_fixture(transform_fixture, file!(), "delete_match_removes_normalization.input", "relay_compiler_integration/fixtures/delete_match_removes_normalization.expected", input, expected).await;
}

#[tokio::test]
async fn disable_schema_validation_exempt_field_definition_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_exempt_field_definition.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_exempt_field_definition.invalid.expected");
    test_fixture(transform_fixture, file!(), "disable_schema_validation_exempt_field_definition.invalid.input", "relay_compiler_integration/fixtures/disable_schema_validation_exempt_field_definition.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn disable_schema_validation_exempt_field_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_exempt_field.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_exempt_field.invalid.expected");
    test_fixture(transform_fixture, file!(), "disable_schema_validation_exempt_field.invalid.input", "relay_compiler_integration/fixtures/disable_schema_validation_exempt_field.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn disable_schema_validation_exempt_type_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_exempt_type.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_exempt_type.invalid.expected");
    test_fixture(transform_fixture, file!(), "disable_schema_validation_exempt_type.invalid.input", "relay_compiler_integration/fixtures/disable_schema_validation_exempt_type.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn disable_schema_validation_unused_field_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_unused_field.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_unused_field.invalid.expected");
    test_fixture(transform_fixture, file!(), "disable_schema_validation_unused_field.invalid.input", "relay_compiler_integration/fixtures/disable_schema_validation_unused_field.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn disable_schema_validation_unused_missing_field_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_unused_missing_field.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_unused_missing_field.invalid.expected");
    test_fixture(transform_fixture, file!(), "disable_schema_validation_unused_missing_field.invalid.input", "relay_compiler_integration/fixtures/disable_schema_validation_unused_missing_field.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn disable_schema_validation_unused_missing_type_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_unused_missing_type.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_unused_missing_type.invalid.expected");
    test_fixture(transform_fixture, file!(), "disable_schema_validation_unused_missing_type.invalid.input", "relay_compiler_integration/fixtures/disable_schema_validation_unused_missing_type.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn disable_schema_validation_unused_type_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_unused_type.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/disable_schema_validation_unused_type.invalid.expected");
    test_fixture(transform_fixture, file!(), "disable_schema_validation_unused_type.invalid.input", "relay_compiler_integration/fixtures/disable_schema_validation_unused_type.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn error_handling_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/error_handling_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/error_handling_fragment.expected");
    test_fixture(transform_fixture, file!(), "error_handling_fragment.input", "relay_compiler_integration/fixtures/error_handling_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn error_handling_query() {
    let input = include_str!("relay_compiler_integration/fixtures/error_handling_query.input");
    let expected = include_str!("relay_compiler_integration/fixtures/error_handling_query.expected");
    test_fixture(transform_fixture, file!(), "error_handling_query.input", "relay_compiler_integration/fixtures/error_handling_query.expected", input, expected).await;
}

#[tokio::test]
async fn exec_resolvers_directive_with_root_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_resolvers_directive_with_root_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_resolvers_directive_with_root_fragment.expected");
    test_fixture(transform_fixture, file!(), "exec_resolvers_directive_with_root_fragment.input", "relay_compiler_integration/fixtures/exec_resolvers_directive_with_root_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_client_model_resolver_reads_server_data() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_client_model_resolver_reads_server_data.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_client_model_resolver_reads_server_data.expected");
    test_fixture(transform_fixture, file!(), "exec_time_client_model_resolver_reads_server_data.input", "relay_compiler_integration/fixtures/exec_time_client_model_resolver_reads_server_data.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_module_rejects_arguments_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_module_rejects_arguments.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_module_rejects_arguments.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_module_rejects_arguments.invalid.input", "relay_compiler_integration/fixtures/exec_time_module_rejects_arguments.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_query_rooted_server_reading_resolver_routed() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_query_rooted_server_reading_resolver_routed.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_query_rooted_server_reading_resolver_routed.expected");
    test_fixture(transform_fixture, file!(), "exec_time_query_rooted_server_reading_resolver_routed.input", "relay_compiler_integration/fixtures/exec_time_query_rooted_server_reading_resolver_routed.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_footer_enabled_provider() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_footer_enabled_provider.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_footer_enabled_provider.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_footer_enabled_provider.input", "relay_compiler_integration/fixtures/exec_time_resolver_footer_enabled_provider.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_footer_javascript() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_footer_javascript.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_footer_javascript.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_footer_javascript.input", "relay_compiler_integration/fixtures/exec_time_resolver_footer_javascript.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_footer_typescript() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_footer_typescript.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_footer_typescript.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_footer_typescript.input", "relay_compiler_integration/fixtures/exec_time_resolver_footer_typescript.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_mixed_interface_client_edge() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_mixed_interface_client_edge.input", "relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_mixed_interface_client_edge_enabled_provider() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge_enabled_provider.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge_enabled_provider.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_mixed_interface_client_edge_enabled_provider.input", "relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge_enabled_provider.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_mixed_interface_client_edge_waterfall_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge_waterfall.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge_waterfall.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_mixed_interface_client_edge_waterfall.invalid.input", "relay_compiler_integration/fixtures/exec_time_resolver_mixed_interface_client_edge_waterfall.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_query_root_reads_server_field() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_query_root_reads_server_field.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_query_root_reads_server_field.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_query_root_reads_server_field.input", "relay_compiler_integration/fixtures/exec_time_resolver_query_root_reads_server_field.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_query_root_shadow_routes() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_query_root_shadow_routes.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_query_root_shadow_routes.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_query_root_shadow_routes.input", "relay_compiler_integration/fixtures/exec_time_resolver_query_root_shadow_routes.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_server_to_client_has_flag() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_server_to_client_has_flag.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_server_to_client_has_flag.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_server_to_client_has_flag.input", "relay_compiler_integration/fixtures/exec_time_resolver_server_to_client_has_flag.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_resolver_use_network_normalization_provider() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_use_network_normalization_provider.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_resolver_use_network_normalization_provider.expected");
    test_fixture(transform_fixture, file!(), "exec_time_resolver_use_network_normalization_provider.input", "relay_compiler_integration/fixtures/exec_time_resolver_use_network_normalization_provider.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_client_to_server_edge_without_root_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_client_to_server_edge_without_root_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_client_to_server_edge_without_root_fragment.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_client_to_server_edge_without_root_fragment.input", "relay_compiler_integration/fixtures/exec_time_s2c_client_to_server_edge_without_root_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_flag_ignores_impossible_interface_arm() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_flag_ignores_impossible_interface_arm.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_flag_ignores_impossible_interface_arm.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_flag_ignores_impossible_interface_arm.input", "relay_compiler_integration/fixtures/exec_time_s2c_flag_ignores_impossible_interface_arm.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_key_client_field_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_key_client_field.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_key_client_field.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_key_client_field.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_key_client_field.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_key_field_with_arguments_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_key_field_with_arguments.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_key_field_with_arguments.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_key_field_with_arguments.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_key_field_with_arguments.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_key_nested_field_set_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_key_nested_field_set.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_key_nested_field_set.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_key_nested_field_set.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_key_nested_field_set.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_magic_fragment_corridor_allows_nested_path() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_allows_nested_path.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_allows_nested_path.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_magic_fragment_corridor_allows_nested_path.input", "relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_allows_nested_path.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_magic_fragment_corridor_rejects_foreign_marker_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_foreign_marker.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_foreign_marker.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_magic_fragment_corridor_rejects_foreign_marker.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_foreign_marker.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_magic_fragment_corridor_rejects_root_fragment_sharer_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_root_fragment_sharer.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_root_fragment_sharer.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_magic_fragment_corridor_rejects_root_fragment_sharer.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_root_fragment_sharer.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_magic_fragment_corridor_rejects_sibling_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_sibling.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_sibling.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_magic_fragment_corridor_rejects_sibling.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_corridor_rejects_sibling.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_magic_fragment_rejects_inner_sibling_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_rejects_inner_sibling.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_rejects_inner_sibling.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_magic_fragment_rejects_inner_sibling.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_rejects_inner_sibling.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_magic_fragment_server_arm_resolver() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_server_arm_resolver.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_server_arm_resolver.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_magic_fragment_server_arm_resolver.input", "relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_server_arm_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_magic_fragment_value_return_non_query_parent() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_value_return_non_query_parent.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_value_return_non_query_parent.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_magic_fragment_value_return_non_query_parent.input", "relay_compiler_integration/fixtures/exec_time_s2c_magic_fragment_value_return_non_query_parent.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_resolver_requires_root_fragment_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_resolver_requires_root_fragment.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_resolver_requires_root_fragment.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_resolver_requires_root_fragment.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_resolver_requires_root_fragment.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_allows_client_fields_on_query() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_client_fields_on_query.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_client_fields_on_query.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_allows_client_fields_on_query.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_client_fields_on_query.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_allows_inline_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_inline_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_inline_fragment.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_allows_inline_fragment.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_inline_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_allows_key_field() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_key_field.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_key_field.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_allows_key_field.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_allows_key_field.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_key_on_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_key_on_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_key_on_interface.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_key_on_interface.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_key_on_interface.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_rejects_client_edge_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_client_edge.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_client_edge.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_rejects_client_edge.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_client_edge.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_rejects_condition_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_condition.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_condition.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_rejects_condition.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_condition.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_rejects_inline_fragment_field_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_inline_fragment_field.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_inline_fragment_field.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_rejects_inline_fragment_field.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_inline_fragment_field.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_rejects_server_edge_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_server_edge.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_server_edge.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_rejects_server_edge.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_server_edge.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_rejects_spread_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_spread.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_spread.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_rejects_spread.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_spread.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_rejects_unkeyed_field_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_unkeyed_field.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_unkeyed_field.invalid.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_rejects_unkeyed_field.invalid.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_rejects_unkeyed_field.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn exec_time_s2c_root_fragment_split_operation() {
    let input = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_split_operation.input");
    let expected = include_str!("relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_split_operation.expected");
    test_fixture(transform_fixture, file!(), "exec_time_s2c_root_fragment_split_operation.input", "relay_compiler_integration/fixtures/exec_time_s2c_root_fragment_split_operation.expected", input, expected).await;
}

#[tokio::test]
async fn extra_in_single_file_config() {
    let input = include_str!("relay_compiler_integration/fixtures/extra_in_single_file_config.input");
    let expected = include_str!("relay_compiler_integration/fixtures/extra_in_single_file_config.expected");
    test_fixture(transform_fixture, file!(), "extra_in_single_file_config.input", "relay_compiler_integration/fixtures/extra_in_single_file_config.expected", input, expected).await;
}

#[tokio::test]
async fn fragment_alias_nested_in_inline_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/fragment_alias_nested_in_inline_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/fragment_alias_nested_in_inline_fragment.expected");
    test_fixture(transform_fixture, file!(), "fragment_alias_nested_in_inline_fragment.input", "relay_compiler_integration/fixtures/fragment_alias_nested_in_inline_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn fragment_arguments() {
    let input = include_str!("relay_compiler_integration/fixtures/fragment_arguments.input");
    let expected = include_str!("relay_compiler_integration/fixtures/fragment_arguments.expected");
    test_fixture(transform_fixture, file!(), "fragment_arguments.input", "relay_compiler_integration/fixtures/fragment_arguments.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_base_project_extension_change() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_base_project_extension_change.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_base_project_extension_change.expected");
    test_fixture(transform_fixture, file!(), "incremental_base_project_extension_change.input", "relay_compiler_integration/fixtures/incremental_base_project_extension_change.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_delete_fragment_used_by_relay_resolver() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_delete_fragment_used_by_relay_resolver.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_delete_fragment_used_by_relay_resolver.expected");
    test_fixture(transform_fixture, file!(), "incremental_delete_fragment_used_by_relay_resolver.input", "relay_compiler_integration/fixtures/incremental_delete_fragment_used_by_relay_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_delete_module_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_delete_module_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_delete_module_fragment.expected");
    test_fixture(transform_fixture, file!(), "incremental_delete_module_fragment.input", "relay_compiler_integration/fixtures/incremental_delete_module_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_exec_time_client_edge_exec_time_query_deleted() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_exec_time_client_edge_exec_time_query_deleted.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_exec_time_client_edge_exec_time_query_deleted.expected");
    test_fixture(transform_fixture, file!(), "incremental_exec_time_client_edge_exec_time_query_deleted.input", "relay_compiler_integration/fixtures/incremental_exec_time_client_edge_exec_time_query_deleted.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_exec_time_client_edge_exec_time_spread_removed() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_exec_time_client_edge_exec_time_spread_removed.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_exec_time_client_edge_exec_time_spread_removed.expected");
    test_fixture(transform_fixture, file!(), "incremental_exec_time_client_edge_exec_time_spread_removed.input", "relay_compiler_integration/fixtures/incremental_exec_time_client_edge_exec_time_spread_removed.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_exec_time_mixed_client_edge_read_time_spread_removed_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_exec_time_mixed_client_edge_read_time_spread_removed.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_exec_time_mixed_client_edge_read_time_spread_removed.invalid.expected");
    test_fixture(transform_fixture, file!(), "incremental_exec_time_mixed_client_edge_read_time_spread_removed.invalid.input", "relay_compiler_integration/fixtures/incremental_exec_time_mixed_client_edge_read_time_spread_removed.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_file_deletion() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_file_deletion.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_file_deletion.expected");
    test_fixture(transform_fixture, file!(), "incremental_file_deletion.input", "relay_compiler_integration/fixtures/incremental_file_deletion.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_fuzz_multiproject_cross_fragment_change() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_fuzz_multiproject_cross_fragment_change.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_fuzz_multiproject_cross_fragment_change.expected");
    test_fixture(transform_fixture, file!(), "incremental_fuzz_multiproject_cross_fragment_change.input", "relay_compiler_integration/fixtures/incremental_fuzz_multiproject_cross_fragment_change.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_fuzz_subscription_root_type_change() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_fuzz_subscription_root_type_change.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_fuzz_subscription_root_type_change.expected");
    test_fixture(transform_fixture, file!(), "incremental_fuzz_subscription_root_type_change.input", "relay_compiler_integration/fixtures/incremental_fuzz_subscription_root_type_change.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_input_object_field_addition() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_input_object_field_addition.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_input_object_field_addition.expected");
    test_fixture(transform_fixture, file!(), "incremental_input_object_field_addition.input", "relay_compiler_integration/fixtures/incremental_input_object_field_addition.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_input_object_removed() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_input_object_removed.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_input_object_removed.expected");
    test_fixture(transform_fixture, file!(), "incremental_input_object_removed.input", "relay_compiler_integration/fixtures/incremental_input_object_removed.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_module_fragment_plain_spread_added_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_module_fragment_plain_spread_added.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_module_fragment_plain_spread_added.invalid.expected");
    test_fixture(transform_fixture, file!(), "incremental_module_fragment_plain_spread_added.invalid.input", "relay_compiler_integration/fixtures/incremental_module_fragment_plain_spread_added.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_mutation_field_return_type_change() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_mutation_field_return_type_change.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_mutation_field_return_type_change.expected");
    test_fixture(transform_fixture, file!(), "incremental_mutation_field_return_type_change.input", "relay_compiler_integration/fixtures/incremental_mutation_field_return_type_change.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_object_added_with_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_object_added_with_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_object_added_with_interface.expected");
    test_fixture(transform_fixture, file!(), "incremental_object_added_with_interface.input", "relay_compiler_integration/fixtures/incremental_object_added_with_interface.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_object_removed_with_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_object_removed_with_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_object_removed_with_interface.expected");
    test_fixture(transform_fixture, file!(), "incremental_object_removed_with_interface.input", "relay_compiler_integration/fixtures/incremental_object_removed_with_interface.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_plain_fragment_module_spread_added_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_plain_fragment_module_spread_added.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_plain_fragment_module_spread_added.invalid.expected");
    test_fixture(transform_fixture, file!(), "incremental_plain_fragment_module_spread_added.invalid.input", "relay_compiler_integration/fixtures/incremental_plain_fragment_module_spread_added.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_schema_change_with_base_project() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_schema_change_with_base_project.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_schema_change_with_base_project.expected");
    test_fixture(transform_fixture, file!(), "incremental_schema_change_with_base_project.input", "relay_compiler_integration/fixtures/incremental_schema_change_with_base_project.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_schema_field_directive_not_diffed() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_schema_field_directive_not_diffed.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_schema_field_directive_not_diffed.expected");
    test_fixture(transform_fixture, file!(), "incremental_schema_field_directive_not_diffed.input", "relay_compiler_integration/fixtures/incremental_schema_field_directive_not_diffed.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_schema_field_nullability_change() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_schema_field_nullability_change.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_schema_field_nullability_change.expected");
    test_fixture(transform_fixture, file!(), "incremental_schema_field_nullability_change.input", "relay_compiler_integration/fixtures/incremental_schema_field_nullability_change.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_shared_exec_time_client_edge() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_client_edge.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_client_edge.expected");
    test_fixture(transform_fixture, file!(), "incremental_shared_exec_time_client_edge.input", "relay_compiler_integration/fixtures/incremental_shared_exec_time_client_edge.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_shared_exec_time_mixed_client_edge() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_mixed_client_edge.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_mixed_client_edge.expected");
    test_fixture(transform_fixture, file!(), "incremental_shared_exec_time_mixed_client_edge.input", "relay_compiler_integration/fixtures/incremental_shared_exec_time_mixed_client_edge.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_shared_exec_time_mixed_client_edge_feature_disabled() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_mixed_client_edge_feature_disabled.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_mixed_client_edge_feature_disabled.expected");
    test_fixture(transform_fixture, file!(), "incremental_shared_exec_time_mixed_client_edge_feature_disabled.input", "relay_compiler_integration/fixtures/incremental_shared_exec_time_mixed_client_edge_feature_disabled.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_shared_exec_time_refetch_client_edge() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_refetch_client_edge.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_refetch_client_edge.expected");
    test_fixture(transform_fixture, file!(), "incremental_shared_exec_time_refetch_client_edge.input", "relay_compiler_integration/fixtures/incremental_shared_exec_time_refetch_client_edge.expected", input, expected).await;
}

#[tokio::test]
async fn incremental_shared_exec_time_refetch_client_edge_feature_disabled() {
    let input = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_refetch_client_edge_feature_disabled.input");
    let expected = include_str!("relay_compiler_integration/fixtures/incremental_shared_exec_time_refetch_client_edge_feature_disabled.expected");
    test_fixture(transform_fixture, file!(), "incremental_shared_exec_time_refetch_client_edge_feature_disabled.input", "relay_compiler_integration/fixtures/incremental_shared_exec_time_refetch_client_edge_feature_disabled.expected", input, expected).await;
}

#[tokio::test]
async fn live_resolver_implements_interface_field() {
    let input = include_str!("relay_compiler_integration/fixtures/live_resolver_implements_interface_field.input");
    let expected = include_str!("relay_compiler_integration/fixtures/live_resolver_implements_interface_field.expected");
    test_fixture(transform_fixture, file!(), "live_resolver_implements_interface_field.input", "relay_compiler_integration/fixtures/live_resolver_implements_interface_field.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_interface_direct_field_selection() {
    let input = include_str!("relay_compiler_integration/fixtures/mixed_interface_direct_field_selection.input");
    let expected = include_str!("relay_compiler_integration/fixtures/mixed_interface_direct_field_selection.expected");
    test_fixture(transform_fixture, file!(), "mixed_interface_direct_field_selection.input", "relay_compiler_integration/fixtures/mixed_interface_direct_field_selection.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_interface_fragment_spread() {
    let input = include_str!("relay_compiler_integration/fixtures/mixed_interface_fragment_spread.input");
    let expected = include_str!("relay_compiler_integration/fixtures/mixed_interface_fragment_spread.expected");
    test_fixture(transform_fixture, file!(), "mixed_interface_fragment_spread.input", "relay_compiler_integration/fixtures/mixed_interface_fragment_spread.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_interface_fragment_spread_nested() {
    let input = include_str!("relay_compiler_integration/fixtures/mixed_interface_fragment_spread_nested.input");
    let expected = include_str!("relay_compiler_integration/fixtures/mixed_interface_fragment_spread_nested.expected");
    test_fixture(transform_fixture, file!(), "mixed_interface_fragment_spread_nested.input", "relay_compiler_integration/fixtures/mixed_interface_fragment_spread_nested.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_interface_missing_node_interface_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/mixed_interface_missing_node_interface.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/mixed_interface_missing_node_interface.invalid.expected");
    test_fixture(transform_fixture, file!(), "mixed_interface_missing_node_interface.invalid.input", "relay_compiler_integration/fixtures/mixed_interface_missing_node_interface.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_interface_nested_object_type_not_refined() {
    let input = include_str!("relay_compiler_integration/fixtures/mixed_interface_nested_object_type_not_refined.input");
    let expected = include_str!("relay_compiler_integration/fixtures/mixed_interface_nested_object_type_not_refined.expected");
    test_fixture(transform_fixture, file!(), "mixed_interface_nested_object_type_not_refined.input", "relay_compiler_integration/fixtures/mixed_interface_nested_object_type_not_refined.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_interface_nested_two_levels() {
    let input = include_str!("relay_compiler_integration/fixtures/mixed_interface_nested_two_levels.input");
    let expected = include_str!("relay_compiler_integration/fixtures/mixed_interface_nested_two_levels.expected");
    test_fixture(transform_fixture, file!(), "mixed_interface_nested_two_levels.input", "relay_compiler_integration/fixtures/mixed_interface_nested_two_levels.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_interface_server_type_does_not_implement_node_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/mixed_interface_server_type_does_not_implement_node.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/mixed_interface_server_type_does_not_implement_node.invalid.expected");
    test_fixture(transform_fixture, file!(), "mixed_interface_server_type_does_not_implement_node.invalid.input", "relay_compiler_integration/fixtures/mixed_interface_server_type_does_not_implement_node.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_interface_strong_edge_waterfall() {
    let input = include_str!("relay_compiler_integration/fixtures/mixed_interface_strong_edge_waterfall.input");
    let expected = include_str!("relay_compiler_integration/fixtures/mixed_interface_strong_edge_waterfall.expected");
    test_fixture(transform_fixture, file!(), "mixed_interface_strong_edge_waterfall.input", "relay_compiler_integration/fixtures/mixed_interface_strong_edge_waterfall.expected", input, expected).await;
}

#[tokio::test]
async fn module_directive_no_config() {
    let input = include_str!("relay_compiler_integration/fixtures/module_directive_no_config.input");
    let expected = include_str!("relay_compiler_integration/fixtures/module_directive_no_config.expected");
    test_fixture(transform_fixture, file!(), "module_directive_no_config.input", "relay_compiler_integration/fixtures/module_directive_no_config.expected", input, expected).await;
}

#[tokio::test]
async fn module_directive_relative_path() {
    let input = include_str!("relay_compiler_integration/fixtures/module_directive_relative_path.input");
    let expected = include_str!("relay_compiler_integration/fixtures/module_directive_relative_path.expected");
    test_fixture(transform_fixture, file!(), "module_directive_relative_path.input", "relay_compiler_integration/fixtures/module_directive_relative_path.expected", input, expected).await;
}

#[tokio::test]
async fn module_directive_relative_path_custom_output() {
    let input = include_str!("relay_compiler_integration/fixtures/module_directive_relative_path_custom_output.input");
    let expected = include_str!("relay_compiler_integration/fixtures/module_directive_relative_path_custom_output.expected");
    test_fixture(transform_fixture, file!(), "module_directive_relative_path_custom_output.input", "relay_compiler_integration/fixtures/module_directive_relative_path_custom_output.expected", input, expected).await;
}

#[tokio::test]
async fn module_name_validation_enforced_with_flag_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/module_name_validation_enforced_with_flag.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/module_name_validation_enforced_with_flag.invalid.expected");
    test_fixture(transform_fixture, file!(), "module_name_validation_enforced_with_flag.invalid.input", "relay_compiler_integration/fixtures/module_name_validation_enforced_with_flag.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn module_name_validation_skipped_for_non_haste() {
    let input = include_str!("relay_compiler_integration/fixtures/module_name_validation_skipped_for_non_haste.input");
    let expected = include_str!("relay_compiler_integration/fixtures/module_name_validation_skipped_for_non_haste.expected");
    test_fixture(transform_fixture, file!(), "module_name_validation_skipped_for_non_haste.input", "relay_compiler_integration/fixtures/module_name_validation_skipped_for_non_haste.expected", input, expected).await;
}

#[tokio::test]
async fn multiple_resolvers_on_interface_of_all_strong_model_type() {
    let input = include_str!("relay_compiler_integration/fixtures/multiple_resolvers_on_interface_of_all_strong_model_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/multiple_resolvers_on_interface_of_all_strong_model_type.expected");
    test_fixture(transform_fixture, file!(), "multiple_resolvers_on_interface_of_all_strong_model_type.input", "relay_compiler_integration/fixtures/multiple_resolvers_on_interface_of_all_strong_model_type.expected", input, expected).await;
}

#[tokio::test]
async fn multiple_resolvers_returns_interfaces_of_all_strong_model_type() {
    let input = include_str!("relay_compiler_integration/fixtures/multiple_resolvers_returns_interfaces_of_all_strong_model_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/multiple_resolvers_returns_interfaces_of_all_strong_model_type.expected");
    test_fixture(transform_fixture, file!(), "multiple_resolvers_returns_interfaces_of_all_strong_model_type.input", "relay_compiler_integration/fixtures/multiple_resolvers_returns_interfaces_of_all_strong_model_type.expected", input, expected).await;
}

#[tokio::test]
async fn no_inline_fragment_on_union_member() {
    let input = include_str!("relay_compiler_integration/fixtures/no_inline_fragment_on_union_member.input");
    let expected = include_str!("relay_compiler_integration/fixtures/no_inline_fragment_on_union_member.expected");
    test_fixture(transform_fixture, file!(), "no_inline_fragment_on_union_member.input", "relay_compiler_integration/fixtures/no_inline_fragment_on_union_member.expected", input, expected).await;
}

#[tokio::test]
async fn no_inline_raw_response_type_typescript_abstract_spread() {
    let input = include_str!("relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_abstract_spread.input");
    let expected = include_str!("relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_abstract_spread.expected");
    test_fixture(transform_fixture, file!(), "no_inline_raw_response_type_typescript_abstract_spread.input", "relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_abstract_spread.expected", input, expected).await;
}

#[tokio::test]
async fn no_inline_raw_response_type_typescript_drops_spread() {
    let input = include_str!("relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_drops_spread.input");
    let expected = include_str!("relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_drops_spread.expected");
    test_fixture(transform_fixture, file!(), "no_inline_raw_response_type_typescript_drops_spread.input", "relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_drops_spread.expected", input, expected).await;
}

#[tokio::test]
async fn no_inline_raw_response_type_typescript_root_spread() {
    let input = include_str!("relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_root_spread.input");
    let expected = include_str!("relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_root_spread.expected");
    test_fixture(transform_fixture, file!(), "no_inline_raw_response_type_typescript_root_spread.input", "relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_root_spread.expected", input, expected).await;
}

#[tokio::test]
async fn no_inline_raw_response_type_typescript_split_output_commonjs() {
    let input = include_str!("relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_split_output_commonjs.input");
    let expected = include_str!("relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_split_output_commonjs.expected");
    test_fixture(transform_fixture, file!(), "no_inline_raw_response_type_typescript_split_output_commonjs.input", "relay_compiler_integration/fixtures/no_inline_raw_response_type_typescript_split_output_commonjs.expected", input, expected).await;
}

#[tokio::test]
async fn non_relay_file_in_generated_dir() {
    let input = include_str!("relay_compiler_integration/fixtures/non_relay_file_in_generated_dir.input");
    let expected = include_str!("relay_compiler_integration/fixtures/non_relay_file_in_generated_dir.expected");
    test_fixture(transform_fixture, file!(), "non_relay_file_in_generated_dir.input", "relay_compiler_integration/fixtures/non_relay_file_in_generated_dir.expected", input, expected).await;
}

#[tokio::test]
async fn non_relay_file_in_generated_dir_with_custom_output() {
    let input = include_str!("relay_compiler_integration/fixtures/non_relay_file_in_generated_dir_with_custom_output.input");
    let expected = include_str!("relay_compiler_integration/fixtures/non_relay_file_in_generated_dir_with_custom_output.expected");
    test_fixture(transform_fixture, file!(), "non_relay_file_in_generated_dir_with_custom_output.input", "relay_compiler_integration/fixtures/non_relay_file_in_generated_dir_with_custom_output.expected", input, expected).await;
}

#[tokio::test]
async fn persisted_queries_file_created_when_missing() {
    let input = include_str!("relay_compiler_integration/fixtures/persisted_queries_file_created_when_missing.input");
    let expected = include_str!("relay_compiler_integration/fixtures/persisted_queries_file_created_when_missing.expected");
    test_fixture(transform_fixture, file!(), "persisted_queries_file_created_when_missing.input", "relay_compiler_integration/fixtures/persisted_queries_file_created_when_missing.expected", input, expected).await;
}

#[tokio::test]
async fn persisted_queries_file_existing_entries_preserved() {
    let input = include_str!("relay_compiler_integration/fixtures/persisted_queries_file_existing_entries_preserved.input");
    let expected = include_str!("relay_compiler_integration/fixtures/persisted_queries_file_existing_entries_preserved.expected");
    test_fixture(transform_fixture, file!(), "persisted_queries_file_existing_entries_preserved.input", "relay_compiler_integration/fixtures/persisted_queries_file_existing_entries_preserved.expected", input, expected).await;
}

#[tokio::test]
async fn persisted_queries_file_missing_parent_directories_created() {
    let input = include_str!("relay_compiler_integration/fixtures/persisted_queries_file_missing_parent_directories_created.input");
    let expected = include_str!("relay_compiler_integration/fixtures/persisted_queries_file_missing_parent_directories_created.expected");
    test_fixture(transform_fixture, file!(), "persisted_queries_file_missing_parent_directories_created.input", "relay_compiler_integration/fixtures/persisted_queries_file_missing_parent_directories_created.expected", input, expected).await;
}

#[tokio::test]
async fn prefetchable_pagination_rename_fragment_removes_edges() {
    let input = include_str!("relay_compiler_integration/fixtures/prefetchable_pagination_rename_fragment_removes_edges.input");
    let expected = include_str!("relay_compiler_integration/fixtures/prefetchable_pagination_rename_fragment_removes_edges.expected");
    test_fixture(transform_fixture, file!(), "prefetchable_pagination_rename_fragment_removes_edges.input", "relay_compiler_integration/fixtures/prefetchable_pagination_rename_fragment_removes_edges.expected", input, expected).await;
}

#[tokio::test]
async fn prefetchable_refetchable_pagination() {
    let input = include_str!("relay_compiler_integration/fixtures/prefetchable_refetchable_pagination.input");
    let expected = include_str!("relay_compiler_integration/fixtures/prefetchable_refetchable_pagination.expected");
    test_fixture(transform_fixture, file!(), "prefetchable_refetchable_pagination.input", "relay_compiler_integration/fixtures/prefetchable_refetchable_pagination.expected", input, expected).await;
}

#[tokio::test]
async fn preloadable_client_query_flow() {
    let input = include_str!("relay_compiler_integration/fixtures/preloadable_client_query_flow.input");
    let expected = include_str!("relay_compiler_integration/fixtures/preloadable_client_query_flow.expected");
    test_fixture(transform_fixture, file!(), "preloadable_client_query_flow.input", "relay_compiler_integration/fixtures/preloadable_client_query_flow.expected", input, expected).await;
}

#[tokio::test]
async fn preloadable_query_flow() {
    let input = include_str!("relay_compiler_integration/fixtures/preloadable_query_flow.input");
    let expected = include_str!("relay_compiler_integration/fixtures/preloadable_query_flow.expected");
    test_fixture(transform_fixture, file!(), "preloadable_query_flow.input", "relay_compiler_integration/fixtures/preloadable_query_flow.expected", input, expected).await;
}

#[tokio::test]
async fn preloadable_query_javascript() {
    let input = include_str!("relay_compiler_integration/fixtures/preloadable_query_javascript.input");
    let expected = include_str!("relay_compiler_integration/fixtures/preloadable_query_javascript.expected");
    test_fixture(transform_fixture, file!(), "preloadable_query_javascript.input", "relay_compiler_integration/fixtures/preloadable_query_javascript.expected", input, expected).await;
}

#[tokio::test]
async fn preloadable_query_typescript() {
    let input = include_str!("relay_compiler_integration/fixtures/preloadable_query_typescript.input");
    let expected = include_str!("relay_compiler_integration/fixtures/preloadable_query_typescript.expected");
    test_fixture(transform_fixture, file!(), "preloadable_query_typescript.input", "relay_compiler_integration/fixtures/preloadable_query_typescript.expected", input, expected).await;
}

#[tokio::test]
async fn preloadable_query_without_persist_config() {
    let input = include_str!("relay_compiler_integration/fixtures/preloadable_query_without_persist_config.input");
    let expected = include_str!("relay_compiler_integration/fixtures/preloadable_query_without_persist_config.expected");
    test_fixture(transform_fixture, file!(), "preloadable_query_without_persist_config.input", "relay_compiler_integration/fixtures/preloadable_query_without_persist_config.expected", input, expected).await;
}

#[tokio::test]
async fn refetchable_with_directive_enum_arg() {
    let input = include_str!("relay_compiler_integration/fixtures/refetchable_with_directive_enum_arg.input");
    let expected = include_str!("relay_compiler_integration/fixtures/refetchable_with_directive_enum_arg.expected");
    test_fixture(transform_fixture, file!(), "refetchable_with_directive_enum_arg.input", "relay_compiler_integration/fixtures/refetchable_with_directive_enum_arg.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolvers_in_throw_on_field_error() {
    let input = include_str!("relay_compiler_integration/fixtures/relay_resolvers_in_throw_on_field_error.input");
    let expected = include_str!("relay_compiler_integration/fixtures/relay_resolvers_in_throw_on_field_error.expected");
    test_fixture(transform_fixture, file!(), "relay_resolvers_in_throw_on_field_error.input", "relay_compiler_integration/fixtures/relay_resolvers_in_throw_on_field_error.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_capture() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_capture.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_capture.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_capture.input", "relay_compiler_integration/fixtures/remote_persist_capture.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_capture_extra_headers() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_capture_extra_headers.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_capture_extra_headers.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_capture_extra_headers.input", "relay_compiler_integration/fixtures/remote_persist_capture_extra_headers.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_capture_multi_project_config() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_capture_multi_project_config.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_capture_multi_project_config.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_capture_multi_project_config.input", "relay_compiler_integration/fixtures/remote_persist_capture_multi_project_config.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_capture_multiple_operations() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_capture_multiple_operations.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_capture_multiple_operations.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_capture_multiple_operations.input", "relay_compiler_integration/fixtures/remote_persist_capture_multiple_operations.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_id_cached_from_existing_artifact() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_id_cached_from_existing_artifact.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_id_cached_from_existing_artifact.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_id_cached_from_existing_artifact.input", "relay_compiler_integration/fixtures/remote_persist_id_cached_from_existing_artifact.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_id_recache_on_hash_mismatch() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_id_recache_on_hash_mismatch.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_id_recache_on_hash_mismatch.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_id_recache_on_hash_mismatch.input", "relay_compiler_integration/fixtures/remote_persist_id_recache_on_hash_mismatch.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_id_recache_on_merge_conflict() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_id_recache_on_merge_conflict.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_id_recache_on_merge_conflict.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_id_recache_on_merge_conflict.input", "relay_compiler_integration/fixtures/remote_persist_id_recache_on_merge_conflict.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_id_recache_when_request_id_absent() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_id_recache_when_request_id_absent.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_id_recache_when_request_id_absent.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_id_recache_when_request_id_absent.input", "relay_compiler_integration/fixtures/remote_persist_id_recache_when_request_id_absent.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_id_repersisted_when_relay_hash_absent() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_id_repersisted_when_relay_hash_absent.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_id_repersisted_when_relay_hash_absent.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_id_repersisted_when_relay_hash_absent.input", "relay_compiler_integration/fixtures/remote_persist_id_repersisted_when_relay_hash_absent.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_include_query_text() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_include_query_text.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_include_query_text.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_include_query_text.input", "relay_compiler_integration/fixtures/remote_persist_include_query_text.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_include_schema_text() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_include_schema_text.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_include_schema_text.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_include_schema_text.input", "relay_compiler_integration/fixtures/remote_persist_include_schema_text.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_include_schema_text_excludes_base_extensions() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_include_schema_text_excludes_base_extensions.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_include_schema_text_excludes_base_extensions.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_include_schema_text_excludes_base_extensions.input", "relay_compiler_integration/fixtures/remote_persist_include_schema_text_excludes_base_extensions.expected", input, expected).await;
}

#[tokio::test]
async fn remote_persist_include_schema_text_excludes_client_extensions() {
    let input = include_str!("relay_compiler_integration/fixtures/remote_persist_include_schema_text_excludes_client_extensions.input");
    let expected = include_str!("relay_compiler_integration/fixtures/remote_persist_include_schema_text_excludes_client_extensions.expected");
    test_fixture(transform_fixture, file!(), "remote_persist_include_schema_text_excludes_client_extensions.input", "relay_compiler_integration/fixtures/remote_persist_include_schema_text_excludes_client_extensions.expected", input, expected).await;
}

#[tokio::test]
async fn repro_dangerously_unaliased_changes_output_after() {
    let input = include_str!("relay_compiler_integration/fixtures/repro_dangerously_unaliased_changes_output_after.input");
    let expected = include_str!("relay_compiler_integration/fixtures/repro_dangerously_unaliased_changes_output_after.expected");
    test_fixture(transform_fixture, file!(), "repro_dangerously_unaliased_changes_output_after.input", "relay_compiler_integration/fixtures/repro_dangerously_unaliased_changes_output_after.expected", input, expected).await;
}

#[tokio::test]
async fn repro_dangerously_unaliased_changes_output_before() {
    let input = include_str!("relay_compiler_integration/fixtures/repro_dangerously_unaliased_changes_output_before.input");
    let expected = include_str!("relay_compiler_integration/fixtures/repro_dangerously_unaliased_changes_output_before.expected");
    test_fixture(transform_fixture, file!(), "repro_dangerously_unaliased_changes_output_before.input", "relay_compiler_integration/fixtures/repro_dangerously_unaliased_changes_output_before.expected", input, expected).await;
}

#[tokio::test]
async fn required_conditional_field() {
    let input = include_str!("relay_compiler_integration/fixtures/required_conditional_field.input");
    let expected = include_str!("relay_compiler_integration/fixtures/required_conditional_field.expected");
    test_fixture(transform_fixture, file!(), "required_conditional_field.input", "relay_compiler_integration/fixtures/required_conditional_field.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_interface_semantic_non_null_id() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_interface_semantic_non_null_id.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_interface_semantic_non_null_id.expected");
    test_fixture(transform_fixture, file!(), "resolver_interface_semantic_non_null_id.input", "relay_compiler_integration/fixtures/resolver_interface_semantic_non_null_id.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_on_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_on_interface.expected");
    test_fixture(transform_fixture, file!(), "resolver_on_interface.input", "relay_compiler_integration/fixtures/resolver_on_interface.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_does_not_pass_schema_validation_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_does_not_pass_schema_validation.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_does_not_pass_schema_validation.invalid.expected");
    test_fixture(transform_fixture, file!(), "resolver_on_interface_does_not_pass_schema_validation.invalid.input", "relay_compiler_integration/fixtures/resolver_on_interface_does_not_pass_schema_validation.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_of_all_strong_model_type() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type.expected");
    test_fixture(transform_fixture, file!(), "resolver_on_interface_of_all_strong_model_type.input", "relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_of_all_strong_model_type_including_cse() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type_including_cse.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type_including_cse.expected");
    test_fixture(transform_fixture, file!(), "resolver_on_interface_of_all_strong_model_type_including_cse.input", "relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type_including_cse.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_of_all_strong_model_type_with_root_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type_with_root_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type_with_root_fragment.expected");
    test_fixture(transform_fixture, file!(), "resolver_on_interface_of_all_strong_model_type_with_root_fragment.input", "relay_compiler_integration/fixtures/resolver_on_interface_of_all_strong_model_type_with_root_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_of_all_weak_model_type() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_of_all_weak_model_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_of_all_weak_model_type.expected");
    test_fixture(transform_fixture, file!(), "resolver_on_interface_of_all_weak_model_type.input", "relay_compiler_integration/fixtures/resolver_on_interface_of_all_weak_model_type.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_returns_custom_scalar() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_returns_custom_scalar.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_on_interface_returns_custom_scalar.expected");
    test_fixture(transform_fixture, file!(), "resolver_on_interface_returns_custom_scalar.input", "relay_compiler_integration/fixtures/resolver_on_interface_returns_custom_scalar.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_return_fragment_conflicts_with_existing_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_conflicts_with_existing.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_conflicts_with_existing.invalid.expected");
    test_fixture(transform_fixture, file!(), "resolver_return_fragment_conflicts_with_existing.invalid.input", "relay_compiler_integration/fixtures/resolver_return_fragment_conflicts_with_existing.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_return_fragment_invalid_module_name_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_invalid_module_name.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_invalid_module_name.invalid.expected");
    test_fixture(transform_fixture, file!(), "resolver_return_fragment_invalid_module_name.invalid.input", "relay_compiler_integration/fixtures/resolver_return_fragment_invalid_module_name.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_return_fragment_invalid_name_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_invalid_name.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_invalid_name.invalid.expected");
    test_fixture(transform_fixture, file!(), "resolver_return_fragment_invalid_name.invalid.input", "relay_compiler_integration/fixtures/resolver_return_fragment_invalid_name.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_return_fragment_not_spread_in_root_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_not_spread_in_root_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_not_spread_in_root_fragment.expected");
    test_fixture(transform_fixture, file!(), "resolver_return_fragment_not_spread_in_root_fragment.input", "relay_compiler_integration/fixtures/resolver_return_fragment_not_spread_in_root_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_return_fragment_requires_feature_flag() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_requires_feature_flag.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_requires_feature_flag.expected");
    test_fixture(transform_fixture, file!(), "resolver_return_fragment_requires_feature_flag.input", "relay_compiler_integration/fixtures/resolver_return_fragment_requires_feature_flag.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_return_fragment_requires_feature_flag_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_requires_feature_flag.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_requires_feature_flag.invalid.expected");
    test_fixture(transform_fixture, file!(), "resolver_return_fragment_requires_feature_flag.invalid.input", "relay_compiler_integration/fixtures/resolver_return_fragment_requires_feature_flag.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_return_fragment_requires_root_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_requires_root_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_return_fragment_requires_root_fragment.expected");
    test_fixture(transform_fixture, file!(), "resolver_return_fragment_requires_root_fragment.input", "relay_compiler_integration/fixtures/resolver_return_fragment_requires_root_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_client_schema_extension_enum() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_client_schema_extension_enum.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_client_schema_extension_enum.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_client_schema_extension_enum.input", "relay_compiler_integration/fixtures/resolver_returns_client_schema_extension_enum.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_enum_with_enum_suffix() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_enum_with_enum_suffix.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_enum_with_enum_suffix.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_enum_with_enum_suffix.input", "relay_compiler_integration/fixtures/resolver_returns_enum_with_enum_suffix.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_interface_of_all_live_model_type() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_all_live_model_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_all_live_model_type.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_interface_of_all_live_model_type.input", "relay_compiler_integration/fixtures/resolver_returns_interface_of_all_live_model_type.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_interface_of_all_strong_model_type() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_all_strong_model_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_all_strong_model_type.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_interface_of_all_strong_model_type.input", "relay_compiler_integration/fixtures/resolver_returns_interface_of_all_strong_model_type.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_interface_of_all_strong_model_type_including_cse() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_all_strong_model_type_including_cse.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_all_strong_model_type_including_cse.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_interface_of_all_strong_model_type_including_cse.input", "relay_compiler_integration/fixtures/resolver_returns_interface_of_all_strong_model_type_including_cse.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_interface_of_all_weak_model_type() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_all_weak_model_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_all_weak_model_type.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_interface_of_all_weak_model_type.input", "relay_compiler_integration/fixtures/resolver_returns_interface_of_all_weak_model_type.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_interface_of_live_and_non_live_strong_model_type() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_live_and_non_live_strong_model_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_interface_of_live_and_non_live_strong_model_type.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_interface_of_live_and_non_live_strong_model_type.input", "relay_compiler_integration/fixtures/resolver_returns_interface_of_live_and_non_live_strong_model_type.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_plural_server_type_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_plural_server_type.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_plural_server_type.invalid.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_plural_server_type.invalid.input", "relay_compiler_integration/fixtures/resolver_returns_plural_server_type.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_union_of_cse() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_union_of_cse.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_union_of_cse.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_union_of_cse.input", "relay_compiler_integration/fixtures/resolver_returns_union_of_cse.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_union_of_cse_weak() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_union_of_cse_weak.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_union_of_cse_weak.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_union_of_cse_weak.input", "relay_compiler_integration/fixtures/resolver_returns_union_of_cse_weak.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_union_of_strong_resolver() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_union_of_strong_resolver.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_union_of_strong_resolver.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_union_of_strong_resolver.input", "relay_compiler_integration/fixtures/resolver_returns_union_of_strong_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_union_of_weak_resolver() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_union_of_weak_resolver.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_union_of_weak_resolver.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_union_of_weak_resolver.input", "relay_compiler_integration/fixtures/resolver_returns_union_of_weak_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_returns_weak_client_schema_type() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_returns_weak_client_schema_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_returns_weak_client_schema_type.expected");
    test_fixture(transform_fixture, file!(), "resolver_returns_weak_client_schema_type.input", "relay_compiler_integration/fixtures/resolver_returns_weak_client_schema_type.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_root_fragment_has_server_field() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_root_fragment_has_server_field.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_root_fragment_has_server_field.expected");
    test_fixture(transform_fixture, file!(), "resolver_root_fragment_has_server_field.input", "relay_compiler_integration/fixtures/resolver_root_fragment_has_server_field.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_root_fragment_list_arg_binding() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_root_fragment_list_arg_binding.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_root_fragment_list_arg_binding.expected");
    test_fixture(transform_fixture, file!(), "resolver_root_fragment_list_arg_binding.input", "relay_compiler_integration/fixtures/resolver_root_fragment_list_arg_binding.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_semantic_non_null_custom_scalar() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_custom_scalar.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_custom_scalar.expected");
    test_fixture(transform_fixture, file!(), "resolver_semantic_non_null_custom_scalar.input", "relay_compiler_integration/fixtures/resolver_semantic_non_null_custom_scalar.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_semantic_non_null_live() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_live.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_live.expected");
    test_fixture(transform_fixture, file!(), "resolver_semantic_non_null_live.input", "relay_compiler_integration/fixtures/resolver_semantic_non_null_live.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_semantic_non_null_plural() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_plural.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_plural.expected");
    test_fixture(transform_fixture, file!(), "resolver_semantic_non_null_plural.input", "relay_compiler_integration/fixtures/resolver_semantic_non_null_plural.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_semantic_non_null_plural_live() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_plural_live.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_plural_live.expected");
    test_fixture(transform_fixture, file!(), "resolver_semantic_non_null_plural_live.input", "relay_compiler_integration/fixtures/resolver_semantic_non_null_plural_live.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_semantic_non_null_relayresolvervalue() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_relayresolvervalue.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_relayresolvervalue.expected");
    test_fixture(transform_fixture, file!(), "resolver_semantic_non_null_relayresolvervalue.input", "relay_compiler_integration/fixtures/resolver_semantic_non_null_relayresolvervalue.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_semantic_non_null_relayresolvervalue_disabled() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_relayresolvervalue_disabled.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_relayresolvervalue_disabled.expected");
    test_fixture(transform_fixture, file!(), "resolver_semantic_non_null_relayresolvervalue_disabled.input", "relay_compiler_integration/fixtures/resolver_semantic_non_null_relayresolvervalue_disabled.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_semantic_non_null_scalar() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_scalar.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_semantic_non_null_scalar.expected");
    test_fixture(transform_fixture, file!(), "resolver_semantic_non_null_scalar.input", "relay_compiler_integration/fixtures/resolver_semantic_non_null_scalar.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_with_return_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/resolver_with_return_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolver_with_return_fragment.expected");
    test_fixture(transform_fixture, file!(), "resolver_with_return_fragment.input", "relay_compiler_integration/fixtures/resolver_with_return_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn resolvers_mask_false() {
    let input = include_str!("relay_compiler_integration/fixtures/resolvers_mask_false.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolvers_mask_false.expected");
    test_fixture(transform_fixture, file!(), "resolvers_mask_false.input", "relay_compiler_integration/fixtures/resolvers_mask_false.expected", input, expected).await;
}

#[tokio::test]
async fn resolvers_non_nullable() {
    let input = include_str!("relay_compiler_integration/fixtures/resolvers_non_nullable.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolvers_non_nullable.expected");
    test_fixture(transform_fixture, file!(), "resolvers_non_nullable.input", "relay_compiler_integration/fixtures/resolvers_non_nullable.expected", input, expected).await;
}

#[tokio::test]
async fn resolvers_schema_module() {
    let input = include_str!("relay_compiler_integration/fixtures/resolvers_schema_module.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolvers_schema_module.expected");
    test_fixture(transform_fixture, file!(), "resolvers_schema_module.input", "relay_compiler_integration/fixtures/resolvers_schema_module.expected", input, expected).await;
}

#[tokio::test]
async fn resolvers_schema_module_apply_to_normalization_ast() {
    let input = include_str!("relay_compiler_integration/fixtures/resolvers_schema_module_apply_to_normalization_ast.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolvers_schema_module_apply_to_normalization_ast.expected");
    test_fixture(transform_fixture, file!(), "resolvers_schema_module_apply_to_normalization_ast.input", "relay_compiler_integration/fixtures/resolvers_schema_module_apply_to_normalization_ast.expected", input, expected).await;
}

#[tokio::test]
async fn resolvers_schema_module_no_map() {
    let input = include_str!("relay_compiler_integration/fixtures/resolvers_schema_module_no_map.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolvers_schema_module_no_map.expected");
    test_fixture(transform_fixture, file!(), "resolvers_schema_module_no_map.input", "relay_compiler_integration/fixtures/resolvers_schema_module_no_map.expected", input, expected).await;
}

#[tokio::test]
async fn resolvers_with_context_javascript() {
    let input = include_str!("relay_compiler_integration/fixtures/resolvers_with_context_javascript.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolvers_with_context_javascript.expected");
    test_fixture(transform_fixture, file!(), "resolvers_with_context_javascript.input", "relay_compiler_integration/fixtures/resolvers_with_context_javascript.expected", input, expected).await;
}

#[tokio::test]
async fn resolvers_with_context_package_import() {
    let input = include_str!("relay_compiler_integration/fixtures/resolvers_with_context_package_import.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolvers_with_context_package_import.expected");
    test_fixture(transform_fixture, file!(), "resolvers_with_context_package_import.input", "relay_compiler_integration/fixtures/resolvers_with_context_package_import.expected", input, expected).await;
}

#[tokio::test]
async fn resolvers_with_context_path_import() {
    let input = include_str!("relay_compiler_integration/fixtures/resolvers_with_context_path_import.input");
    let expected = include_str!("relay_compiler_integration/fixtures/resolvers_with_context_path_import.expected");
    test_fixture(transform_fixture, file!(), "resolvers_with_context_path_import.input", "relay_compiler_integration/fixtures/resolvers_with_context_path_import.expected", input, expected).await;
}

#[tokio::test]
async fn schema_in_excluded_dir_works() {
    let input = include_str!("relay_compiler_integration/fixtures/schema_in_excluded_dir_works.input");
    let expected = include_str!("relay_compiler_integration/fixtures/schema_in_excluded_dir_works.expected");
    test_fixture(transform_fixture, file!(), "schema_in_excluded_dir_works.input", "relay_compiler_integration/fixtures/schema_in_excluded_dir_works.expected", input, expected).await;
}

#[tokio::test]
async fn schema_in_generated_dir() {
    let input = include_str!("relay_compiler_integration/fixtures/schema_in_generated_dir.input");
    let expected = include_str!("relay_compiler_integration/fixtures/schema_in_generated_dir.expected");
    test_fixture(transform_fixture, file!(), "schema_in_generated_dir.input", "relay_compiler_integration/fixtures/schema_in_generated_dir.expected", input, expected).await;
}

#[tokio::test]
async fn schema_incomplete_last_shard() {
    let input = include_str!("relay_compiler_integration/fixtures/schema_incomplete_last_shard.input");
    let expected = include_str!("relay_compiler_integration/fixtures/schema_incomplete_last_shard.expected");
    test_fixture(transform_fixture, file!(), "schema_incomplete_last_shard.input", "relay_compiler_integration/fixtures/schema_incomplete_last_shard.expected", input, expected).await;
}

#[tokio::test]
async fn schema_outside_root_dir() {
    let input = include_str!("relay_compiler_integration/fixtures/schema_outside_root_dir.input");
    let expected = include_str!("relay_compiler_integration/fixtures/schema_outside_root_dir.expected");
    test_fixture(transform_fixture, file!(), "schema_outside_root_dir.input", "relay_compiler_integration/fixtures/schema_outside_root_dir.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_null_require_bubble_to_required_parent() {
    let input = include_str!("relay_compiler_integration/fixtures/semantic_null_require_bubble_to_required_parent.input");
    let expected = include_str!("relay_compiler_integration/fixtures/semantic_null_require_bubble_to_required_parent.expected");
    test_fixture(transform_fixture, file!(), "semantic_null_require_bubble_to_required_parent.input", "relay_compiler_integration/fixtures/semantic_null_require_bubble_to_required_parent.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_null_require_bubbling() {
    let input = include_str!("relay_compiler_integration/fixtures/semantic_null_require_bubbling.input");
    let expected = include_str!("relay_compiler_integration/fixtures/semantic_null_require_bubbling.expected");
    test_fixture(transform_fixture, file!(), "semantic_null_require_bubbling.input", "relay_compiler_integration/fixtures/semantic_null_require_bubbling.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_base_client_boundary_without_normalization_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_base_client_boundary_without_normalization.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_base_client_boundary_without_normalization.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_base_client_boundary_without_normalization.invalid.input", "relay_compiler_integration/fixtures/server_fragment_base_client_boundary_without_normalization.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_client_boundary() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_client_boundary.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_client_boundary.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_client_boundary.input", "relay_compiler_integration/fixtures/server_fragment_client_boundary.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_client_boundary_requires_alias_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_client_boundary_requires_alias.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_client_boundary_requires_alias.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_client_boundary_requires_alias.invalid.input", "relay_compiler_integration/fixtures/server_fragment_client_boundary_requires_alias.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_contract_flow() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_contract_flow.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_contract_flow.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_contract_flow.input", "relay_compiler_integration/fixtures/server_fragment_contract_flow.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_contract_typescript() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_contract_typescript.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_contract_typescript.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_contract_typescript.input", "relay_compiler_integration/fixtures/server_fragment_contract_typescript.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_existing_no_inline_client_boundary() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_existing_no_inline_client_boundary.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_existing_no_inline_client_boundary.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_existing_no_inline_client_boundary.input", "relay_compiler_integration/fixtures/server_fragment_existing_no_inline_client_boundary.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_field_catch_unsupported_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_field_catch_unsupported.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_field_catch_unsupported.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_field_catch_unsupported.invalid.input", "relay_compiler_integration/fixtures/server_fragment_field_catch_unsupported.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_plural_client_boundary_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_plural_client_boundary.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_plural_client_boundary.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_plural_client_boundary.invalid.input", "relay_compiler_integration/fixtures/server_fragment_plural_client_boundary.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_fragment_requires_feature_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_fragment_requires_feature.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_fragment_requires_feature.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_fragment_requires_feature.invalid.input", "relay_compiler_integration/fixtures/server_fragment_requires_feature.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_base_no_inline_incremental_unsupported_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_base_no_inline_incremental_unsupported.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_base_no_inline_incremental_unsupported.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_base_no_inline_incremental_unsupported.invalid.input", "relay_compiler_integration/fixtures/server_operation_base_no_inline_incremental_unsupported.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_client_boundary_on_union_member() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_client_boundary_on_union_member.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_client_boundary_on_union_member.expected");
    test_fixture(transform_fixture, file!(), "server_operation_client_boundary_on_union_member.input", "relay_compiler_integration/fixtures/server_operation_client_boundary_on_union_member.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_empty_client_projection() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_empty_client_projection.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_empty_client_projection.expected");
    test_fixture(transform_fixture, file!(), "server_operation_empty_client_projection.input", "relay_compiler_integration/fixtures/server_operation_empty_client_projection.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_field_connection() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_field_connection.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_field_connection.expected");
    test_fixture(transform_fixture, file!(), "server_operation_field_connection.input", "relay_compiler_integration/fixtures/server_operation_field_connection.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_field_required_unsupported_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_field_required_unsupported.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_field_required_unsupported.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_field_required_unsupported.invalid.input", "relay_compiler_integration/fixtures/server_operation_field_required_unsupported.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_flow() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_flow.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_flow.expected");
    test_fixture(transform_fixture, file!(), "server_operation_flow.input", "relay_compiler_integration/fixtures/server_operation_flow.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_incremental_default_nextjs_allows_but_rejected_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_default_nextjs_allows_but_rejected.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_default_nextjs_allows_but_rejected.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_incremental_default_nextjs_allows_but_rejected.invalid.input", "relay_compiler_integration/fixtures/server_operation_incremental_default_nextjs_allows_but_rejected.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_incremental_explicitly_allowed_but_rejected_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_explicitly_allowed_but_rejected.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_explicitly_allowed_but_rejected.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_incremental_explicitly_allowed_but_rejected.invalid.input", "relay_compiler_integration/fixtures/server_operation_incremental_explicitly_allowed_but_rejected.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_incremental_unsupported_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_unsupported.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_unsupported.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_incremental_unsupported.invalid.input", "relay_compiler_integration/fixtures/server_operation_incremental_unsupported.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_incremental_validation_root_spread_defer_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_validation_root_spread_defer.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_validation_root_spread_defer.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_incremental_validation_root_spread_defer.invalid.input", "relay_compiler_integration/fixtures/server_operation_incremental_validation_root_spread_defer.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_incremental_validation_stream_connection_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_validation_stream_connection.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_incremental_validation_stream_connection.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_incremental_validation_stream_connection.invalid.input", "relay_compiler_integration/fixtures/server_operation_incremental_validation_stream_connection.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_match_module_unsupported_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_match_module_unsupported.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_match_module_unsupported.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_match_module_unsupported.invalid.input", "relay_compiler_integration/fixtures/server_operation_match_module_unsupported.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_non_query_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_non_query.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_non_query.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_non_query.invalid.input", "relay_compiler_integration/fixtures/server_operation_non_query.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_requires_feature_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_requires_feature.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_requires_feature.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_requires_feature.invalid.input", "relay_compiler_integration/fixtures/server_operation_requires_feature.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_spread_relay_mask_false_unsupported_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_spread_relay_mask_false_unsupported.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_spread_relay_mask_false_unsupported.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_operation_spread_relay_mask_false_unsupported.invalid.input", "relay_compiler_integration/fixtures/server_operation_spread_relay_mask_false_unsupported.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_operation_typescript() {
    let input = include_str!("relay_compiler_integration/fixtures/server_operation_typescript.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_operation_typescript.expected");
    test_fixture(transform_fixture, file!(), "server_operation_typescript.input", "relay_compiler_integration/fixtures/server_operation_typescript.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_base_root_fragment_cross_language() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_cross_language.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_cross_language.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_base_root_fragment_cross_language.input", "relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_cross_language.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_base_root_fragment_shared_normalization_artifact() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_shared_normalization_artifact.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_shared_normalization_artifact.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_base_root_fragment_shared_normalization_artifact.input", "relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_shared_normalization_artifact.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_base_root_fragment_unselected_in_base() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_unselected_in_base.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_unselected_in_base.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_base_root_fragment_unselected_in_base.input", "relay_compiler_integration/fixtures/server_rsc_resolver_base_root_fragment_unselected_in_base.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_field_catch_rejected_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_field_catch_rejected.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_field_catch_rejected.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_field_catch_rejected.invalid.input", "relay_compiler_integration/fixtures/server_rsc_resolver_field_catch_rejected.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_field_non_null_rejected_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_field_non_null_rejected.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_field_non_null_rejected.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_field_non_null_rejected.invalid.input", "relay_compiler_integration/fixtures/server_rsc_resolver_field_non_null_rejected.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_field_required_rejected_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_field_required_rejected.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_field_required_rejected.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_field_required_rejected.invalid.input", "relay_compiler_integration/fixtures/server_rsc_resolver_field_required_rejected.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_incremental_validation_root_fragment_defer_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_incremental_validation_root_fragment_defer.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_incremental_validation_root_fragment_defer.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_incremental_validation_root_fragment_defer.invalid.input", "relay_compiler_integration/fixtures/server_rsc_resolver_incremental_validation_root_fragment_defer.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_throw_on_field_error_document_rejected_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_throw_on_field_error_document_rejected.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_throw_on_field_error_document_rejected.invalid.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_throw_on_field_error_document_rejected.invalid.input", "relay_compiler_integration/fixtures/server_rsc_resolver_throw_on_field_error_document_rejected.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn server_rsc_resolver_throw_on_field_error_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_throw_on_field_error_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_rsc_resolver_throw_on_field_error_fragment.expected");
    test_fixture(transform_fixture, file!(), "server_rsc_resolver_throw_on_field_error_fragment.input", "relay_compiler_integration/fixtures/server_rsc_resolver_throw_on_field_error_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn server_type_and_resolver_type_share_interface_semantic_non_null_id() {
    let input = include_str!("relay_compiler_integration/fixtures/server_type_and_resolver_type_share_interface_semantic_non_null_id.input");
    let expected = include_str!("relay_compiler_integration/fixtures/server_type_and_resolver_type_share_interface_semantic_non_null_id.expected");
    test_fixture(transform_fixture, file!(), "server_type_and_resolver_type_share_interface_semantic_non_null_id.input", "relay_compiler_integration/fixtures/server_type_and_resolver_type_share_interface_semantic_non_null_id.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_client_only() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_client_only.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_client_only.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_client_only.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_client_only.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_client_requires_interface_output_type_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_client_requires_interface_output_type.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_client_requires_interface_output_type.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_client_requires_interface_output_type.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_client_requires_interface_output_type.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_concrete_return_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_concrete_return.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_concrete_return.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_concrete_return.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_concrete_return.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_consumer_spread_arguments_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_arguments.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_arguments.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_consumer_spread_arguments.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_arguments.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_consumer_spread_client() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_client.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_client.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_consumer_spread_client.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_client.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_consumer_spread_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_consumer_spread_interface.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_consumer_spread_interface_all_dead() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface_all_dead.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface_all_dead.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_consumer_spread_interface_all_dead.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface_all_dead.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_consumer_spread_interface_broad() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface_broad.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface_broad.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_consumer_spread_interface_broad.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_interface_broad.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_consumer_spread_no_inline_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_no_inline.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_no_inline.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_consumer_spread_no_inline.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_no_inline.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_consumer_spread_server() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_server.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_server.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_consumer_spread_server.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_server.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_consumer_spread_union_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_union.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_union.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_consumer_spread_union.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_consumer_spread_union.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_incompatible_server_arm_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_incompatible_server_arm.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_incompatible_server_arm.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_incompatible_server_arm.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_incompatible_server_arm.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_may_waterfall_missing_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_may_waterfall_missing.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_may_waterfall_missing.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_may_waterfall_missing.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_may_waterfall_missing.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_misplaced_placeholder_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_misplaced_placeholder.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_misplaced_placeholder.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_misplaced_placeholder.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_misplaced_placeholder.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_mixed_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_interface.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_mixed_interface.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_interface.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_mixed_value_strong_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_value_strong.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_value_strong.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_mixed_value_strong.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_value_strong.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_mixed_weak_strong_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_weak_strong.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_weak_strong.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_mixed_weak_strong.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_weak_strong.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_mixed_with_waterfall() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_with_waterfall.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_with_waterfall.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_mixed_with_waterfall.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_mixed_with_waterfall.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_multi_consumer() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_multi_consumer.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_multi_consumer.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_multi_consumer.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_multi_consumer.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_multiple_client_implementors() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_multiple_client_implementors.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_multiple_client_implementors.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_multiple_client_implementors.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_multiple_client_implementors.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_nested_path() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_nested_path.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_nested_path.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_nested_path.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_nested_path.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_plural() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_plural.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_plural.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_plural.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_plural.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_plural_waterfall_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_plural_waterfall.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_plural_waterfall.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_plural_waterfall.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_plural_waterfall.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_server_arm_client_edge() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_arm_client_edge.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_arm_client_edge.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_server_arm_client_edge.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_arm_client_edge.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_server_arm_resolver() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_arm_resolver.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_arm_resolver.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_server_arm_resolver.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_arm_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_server_typo_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_typo.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_typo.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_server_typo.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_typo.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_server_value() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_server_value.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_server_value_nested() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_nested.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_nested.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_server_value_nested.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_nested.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_server_value_plural_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_plural.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_plural.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_server_value_plural.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_plural.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_server_value_waterfall_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_waterfall.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_waterfall.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_server_value_waterfall.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_server_value_waterfall.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_spread() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_spread.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_spread.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_spread.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_spread.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_unexpected_waterfall_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_unexpected_waterfall.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_unexpected_waterfall.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_unexpected_waterfall.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_unexpected_waterfall.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_union_return_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_union_return.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_union_return.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_union_return.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_union_return.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_value_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_value_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_value_interface.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_value_interface.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_value_interface.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_waterfall() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_waterfall.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_waterfall.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_waterfall.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_waterfall.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_weak_client() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_client.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_client.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_weak_client.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_client.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_weak_concrete() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_concrete.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_concrete.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_weak_concrete.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_concrete.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_weak_concrete_waterfall_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_concrete_waterfall.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_concrete_waterfall.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_weak_concrete_waterfall.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_concrete_waterfall.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_weak_plural_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_plural.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_plural.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_weak_plural.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_plural.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_weak_union_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_union.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_union.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_weak_union.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_union.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_magic_fragment_weak_value_interface() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_value_interface.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_value_interface.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_magic_fragment_weak_value_interface.input", "relay_compiler_integration/fixtures/shadow_resolver_magic_fragment_weak_value_interface.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_resolver_may_waterfall_requires_return_fragment_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_resolver_may_waterfall_requires_return_fragment.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_resolver_may_waterfall_requires_return_fragment.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_resolver_may_waterfall_requires_return_fragment.invalid.input", "relay_compiler_integration/fixtures/shadow_resolver_may_waterfall_requires_return_fragment.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn shadow_return_directive_in_user_source_invalid() {
    let input = include_str!("relay_compiler_integration/fixtures/shadow_return_directive_in_user_source.invalid.input");
    let expected = include_str!("relay_compiler_integration/fixtures/shadow_return_directive_in_user_source.invalid.expected");
    test_fixture(transform_fixture, file!(), "shadow_return_directive_in_user_source.invalid.input", "relay_compiler_integration/fixtures/shadow_return_directive_in_user_source.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn simple_fragment() {
    let input = include_str!("relay_compiler_integration/fixtures/simple_fragment.input");
    let expected = include_str!("relay_compiler_integration/fixtures/simple_fragment.expected");
    test_fixture(transform_fixture, file!(), "simple_fragment.input", "relay_compiler_integration/fixtures/simple_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn simple_fragment_name_change() {
    let input = include_str!("relay_compiler_integration/fixtures/simple_fragment_name_change.input");
    let expected = include_str!("relay_compiler_integration/fixtures/simple_fragment_name_change.expected");
    test_fixture(transform_fixture, file!(), "simple_fragment_name_change.input", "relay_compiler_integration/fixtures/simple_fragment_name_change.expected", input, expected).await;
}

#[tokio::test]
async fn skip_impossible_inline_fragments_emptied_refinement() {
    let input = include_str!("relay_compiler_integration/fixtures/skip_impossible_inline_fragments_emptied_refinement.input");
    let expected = include_str!("relay_compiler_integration/fixtures/skip_impossible_inline_fragments_emptied_refinement.expected");
    test_fixture(transform_fixture, file!(), "skip_impossible_inline_fragments_emptied_refinement.input", "relay_compiler_integration/fixtures/skip_impossible_inline_fragments_emptied_refinement.expected", input, expected).await;
}

#[tokio::test]
async fn skip_impossible_inline_fragments_limited() {
    let input = include_str!("relay_compiler_integration/fixtures/skip_impossible_inline_fragments_limited.input");
    let expected = include_str!("relay_compiler_integration/fixtures/skip_impossible_inline_fragments_limited.expected");
    test_fixture(transform_fixture, file!(), "skip_impossible_inline_fragments_limited.input", "relay_compiler_integration/fixtures/skip_impossible_inline_fragments_limited.expected", input, expected).await;
}

#[tokio::test]
async fn spread_interface_fragment_on_concrete_type() {
    let input = include_str!("relay_compiler_integration/fixtures/spread_interface_fragment_on_concrete_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/spread_interface_fragment_on_concrete_type.expected");
    test_fixture(transform_fixture, file!(), "spread_interface_fragment_on_concrete_type.input", "relay_compiler_integration/fixtures/spread_interface_fragment_on_concrete_type.expected", input, expected).await;
}

#[tokio::test]
async fn spread_interface_fragment_on_weak_concrete_type() {
    let input = include_str!("relay_compiler_integration/fixtures/spread_interface_fragment_on_weak_concrete_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/spread_interface_fragment_on_weak_concrete_type.expected");
    test_fixture(transform_fixture, file!(), "spread_interface_fragment_on_weak_concrete_type.input", "relay_compiler_integration/fixtures/spread_interface_fragment_on_weak_concrete_type.expected", input, expected).await;
}

#[tokio::test]
async fn spread_multiple_interface_fragments_on_concrete_type() {
    let input = include_str!("relay_compiler_integration/fixtures/spread_multiple_interface_fragments_on_concrete_type.input");
    let expected = include_str!("relay_compiler_integration/fixtures/spread_multiple_interface_fragments_on_concrete_type.expected");
    test_fixture(transform_fixture, file!(), "spread_multiple_interface_fragments_on_concrete_type.input", "relay_compiler_integration/fixtures/spread_multiple_interface_fragments_on_concrete_type.expected", input, expected).await;
}

#[tokio::test]
async fn typescript_resolver_type_import() {
    let input = include_str!("relay_compiler_integration/fixtures/typescript_resolver_type_import.input");
    let expected = include_str!("relay_compiler_integration/fixtures/typescript_resolver_type_import.expected");
    test_fixture(transform_fixture, file!(), "typescript_resolver_type_import.input", "relay_compiler_integration/fixtures/typescript_resolver_type_import.expected", input, expected).await;
}

#[tokio::test]
async fn typescript_resolver_with_context() {
    let input = include_str!("relay_compiler_integration/fixtures/typescript_resolver_with_context.input");
    let expected = include_str!("relay_compiler_integration/fixtures/typescript_resolver_with_context.expected");
    test_fixture(transform_fixture, file!(), "typescript_resolver_with_context.input", "relay_compiler_integration/fixtures/typescript_resolver_with_context.expected", input, expected).await;
}
