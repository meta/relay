/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<fdb168d80b932f7cf758df830216d6e3>>
 */

mod generate_flow;

use generate_flow::transform_fixture;
use fixture_tests::test_fixture;

#[tokio::test]
async fn aliased_fragment_raw_response_type() {
    let input = include_str!("generate_flow/fixtures/aliased-fragment-raw-response-type.graphql");
    let expected = include_str!("generate_flow/fixtures/aliased-fragment-raw-response-type.expected");
    test_fixture(transform_fixture, file!(), "aliased-fragment-raw-response-type.graphql", "generate_flow/fixtures/aliased-fragment-raw-response-type.expected", input, expected).await;
}

#[tokio::test]
async fn aliased_fragment_spread() {
    let input = include_str!("generate_flow/fixtures/aliased-fragment-spread.graphql");
    let expected = include_str!("generate_flow/fixtures/aliased-fragment-spread.expected");
    test_fixture(transform_fixture, file!(), "aliased-fragment-spread.graphql", "generate_flow/fixtures/aliased-fragment-spread.expected", input, expected).await;
}

#[tokio::test]
async fn aliased_fragment_spread_in_abstract_selection() {
    let input = include_str!("generate_flow/fixtures/aliased-fragment-spread-in-abstract-selection.graphql");
    let expected = include_str!("generate_flow/fixtures/aliased-fragment-spread-in-abstract-selection.expected");
    test_fixture(transform_fixture, file!(), "aliased-fragment-spread-in-abstract-selection.graphql", "generate_flow/fixtures/aliased-fragment-spread-in-abstract-selection.expected", input, expected).await;
}

#[tokio::test]
async fn aliased_inline_fragment_spread() {
    let input = include_str!("generate_flow/fixtures/aliased-inline-fragment-spread.graphql");
    let expected = include_str!("generate_flow/fixtures/aliased-inline-fragment-spread.expected");
    test_fixture(transform_fixture, file!(), "aliased-inline-fragment-spread.graphql", "generate_flow/fixtures/aliased-inline-fragment-spread.expected", input, expected).await;
}

#[tokio::test]
async fn aliased_inline_fragment_spread_without_type_condition_fragment_root() {
    let input = include_str!("generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-fragment-root.graphql");
    let expected = include_str!("generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-fragment-root.expected");
    test_fixture(transform_fixture, file!(), "aliased-inline-fragment-spread-without-type-condition-fragment-root.graphql", "generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-fragment-root.expected", input, expected).await;
}

#[tokio::test]
async fn aliased_inline_fragment_spread_without_type_condition_linked_field() {
    let input = include_str!("generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-linked-field.graphql");
    let expected = include_str!("generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-linked-field.expected");
    test_fixture(transform_fixture, file!(), "aliased-inline-fragment-spread-without-type-condition-linked-field.graphql", "generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-linked-field.expected", input, expected).await;
}

#[tokio::test]
async fn aliased_inline_fragment_spread_without_type_condition_query_root() {
    let input = include_str!("generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-query-root.graphql");
    let expected = include_str!("generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-query-root.expected");
    test_fixture(transform_fixture, file!(), "aliased-inline-fragment-spread-without-type-condition-query-root.graphql", "generate_flow/fixtures/aliased-inline-fragment-spread-without-type-condition-query-root.expected", input, expected).await;
}

#[tokio::test]
async fn catch_no_arg_nested() {
    let input = include_str!("generate_flow/fixtures/catch-no-arg-nested.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-no-arg-nested.expected");
    test_fixture(transform_fixture, file!(), "catch-no-arg-nested.graphql", "generate_flow/fixtures/catch-no-arg-nested.expected", input, expected).await;
}

#[tokio::test]
async fn catch_no_arg_nested_custom_error_type() {
    let input = include_str!("generate_flow/fixtures/catch-no-arg-nested-custom-error-type.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-no-arg-nested-custom-error-type.expected");
    test_fixture(transform_fixture, file!(), "catch-no-arg-nested-custom-error-type.graphql", "generate_flow/fixtures/catch-no-arg-nested-custom-error-type.expected", input, expected).await;
}

#[tokio::test]
async fn catch_no_arg_nested_linked() {
    let input = include_str!("generate_flow/fixtures/catch-no-arg-nested-linked.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-no-arg-nested-linked.expected");
    test_fixture(transform_fixture, file!(), "catch-no-arg-nested-linked.graphql", "generate_flow/fixtures/catch-no-arg-nested-linked.expected", input, expected).await;
}

#[tokio::test]
async fn catch_no_arg_nested_raw() {
    let input = include_str!("generate_flow/fixtures/catch-no-arg-nested-raw.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-no-arg-nested-raw.expected");
    test_fixture(transform_fixture, file!(), "catch-no-arg-nested-raw.graphql", "generate_flow/fixtures/catch-no-arg-nested-raw.expected", input, expected).await;
}

#[tokio::test]
async fn catch_no_arg_nested_raw_fragments() {
    let input = include_str!("generate_flow/fixtures/catch-no-arg-nested-raw-fragments.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-no-arg-nested-raw-fragments.expected");
    test_fixture(transform_fixture, file!(), "catch-no-arg-nested-raw-fragments.graphql", "generate_flow/fixtures/catch-no-arg-nested-raw-fragments.expected", input, expected).await;
}

#[tokio::test]
async fn catch_no_arg_nested_raw_fragments_catch_in_fragment() {
    let input = include_str!("generate_flow/fixtures/catch-no-arg-nested-raw-fragments-catch-in-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-no-arg-nested-raw-fragments-catch-in-fragment.expected");
    test_fixture(transform_fixture, file!(), "catch-no-arg-nested-raw-fragments-catch-in-fragment.graphql", "generate_flow/fixtures/catch-no-arg-nested-raw-fragments-catch-in-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn catch_no_arg_nested_raw_multiple_queries_and_fields() {
    let input = include_str!("generate_flow/fixtures/catch-no-arg-nested-raw-multiple-queries-and-fields.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-no-arg-nested-raw-multiple-queries-and-fields.expected");
    test_fixture(transform_fixture, file!(), "catch-no-arg-nested-raw-multiple-queries-and-fields.graphql", "generate_flow/fixtures/catch-no-arg-nested-raw-multiple-queries-and-fields.expected", input, expected).await;
}

#[tokio::test]
async fn catch_on_aliased_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/catch-on-aliased-inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-on-aliased-inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "catch-on-aliased-inline-fragment.graphql", "generate_flow/fixtures/catch-on-aliased-inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn catch_on_mutation() {
    let input = include_str!("generate_flow/fixtures/catch-on-mutation.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-on-mutation.expected");
    test_fixture(transform_fixture, file!(), "catch-on-mutation.graphql", "generate_flow/fixtures/catch-on-mutation.expected", input, expected).await;
}

#[tokio::test]
async fn catch_on_root() {
    let input = include_str!("generate_flow/fixtures/catch-on-root.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-on-root.expected");
    test_fixture(transform_fixture, file!(), "catch-on-root.graphql", "generate_flow/fixtures/catch-on-root.expected", input, expected).await;
}

#[tokio::test]
async fn catch_semantic_non_null_with_catch_no_arg() {
    let input = include_str!("generate_flow/fixtures/catch-semantic-non-null-with-catch-no-arg.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-semantic-non-null-with-catch-no-arg.expected");
    test_fixture(transform_fixture, file!(), "catch-semantic-non-null-with-catch-no-arg.graphql", "generate_flow/fixtures/catch-semantic-non-null-with-catch-no-arg.expected", input, expected).await;
}

#[tokio::test]
async fn catch_semantic_non_null_with_catch_to_null() {
    let input = include_str!("generate_flow/fixtures/catch-semantic-non-null-with-catch-to-null.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-semantic-non-null-with-catch-to-null.expected");
    test_fixture(transform_fixture, file!(), "catch-semantic-non-null-with-catch-to-null.graphql", "generate_flow/fixtures/catch-semantic-non-null-with-catch-to-null.expected", input, expected).await;
}

#[tokio::test]
async fn catch_to_null_nested() {
    let input = include_str!("generate_flow/fixtures/catch-to-null-nested.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-to-null-nested.expected");
    test_fixture(transform_fixture, file!(), "catch-to-null-nested.graphql", "generate_flow/fixtures/catch-to-null-nested.expected", input, expected).await;
}

#[tokio::test]
async fn catch_to_null_on_aliased_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/catch-to-null-on-aliased-inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-to-null-on-aliased-inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "catch-to-null-on-aliased-inline-fragment.graphql", "generate_flow/fixtures/catch-to-null-on-aliased-inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn catch_to_null_on_fragment() {
    let input = include_str!("generate_flow/fixtures/catch-to-null-on-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-to-null-on-fragment.expected");
    test_fixture(transform_fixture, file!(), "catch-to-null-on-fragment.graphql", "generate_flow/fixtures/catch-to-null-on-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn catch_to_null_on_query() {
    let input = include_str!("generate_flow/fixtures/catch-to-null-on-query.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-to-null-on-query.expected");
    test_fixture(transform_fixture, file!(), "catch-to-null-on-query.graphql", "generate_flow/fixtures/catch-to-null-on-query.expected", input, expected).await;
}

#[tokio::test]
async fn catch_to_result_nested() {
    let input = include_str!("generate_flow/fixtures/catch-to-result-nested.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-to-result-nested.expected");
    test_fixture(transform_fixture, file!(), "catch-to-result-nested.graphql", "generate_flow/fixtures/catch-to-result-nested.expected", input, expected).await;
}

#[tokio::test]
async fn catch_to_result_on_aliased_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/catch-to-result-on-aliased-inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-to-result-on-aliased-inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "catch-to-result-on-aliased-inline-fragment.graphql", "generate_flow/fixtures/catch-to-result-on-aliased-inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn catch_to_result_on_fragment() {
    let input = include_str!("generate_flow/fixtures/catch-to-result-on-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-to-result-on-fragment.expected");
    test_fixture(transform_fixture, file!(), "catch-to-result-on-fragment.graphql", "generate_flow/fixtures/catch-to-result-on-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn catch_to_result_on_query() {
    let input = include_str!("generate_flow/fixtures/catch-to-result-on-query.graphql");
    let expected = include_str!("generate_flow/fixtures/catch-to-result-on-query.expected");
    test_fixture(transform_fixture, file!(), "catch-to-result-on-query.graphql", "generate_flow/fixtures/catch-to-result-on-query.expected", input, expected).await;
}

#[tokio::test]
async fn conditional() {
    let input = include_str!("generate_flow/fixtures/conditional.graphql");
    let expected = include_str!("generate_flow/fixtures/conditional.expected");
    test_fixture(transform_fixture, file!(), "conditional.graphql", "generate_flow/fixtures/conditional.expected", input, expected).await;
}

#[tokio::test]
async fn custom_scalar_type_import() {
    let input = include_str!("generate_flow/fixtures/custom-scalar-type-import.graphql");
    let expected = include_str!("generate_flow/fixtures/custom-scalar-type-import.expected");
    test_fixture(transform_fixture, file!(), "custom-scalar-type-import.graphql", "generate_flow/fixtures/custom-scalar-type-import.expected", input, expected).await;
}

#[tokio::test]
async fn default_input() {
    let input = include_str!("generate_flow/fixtures/default-input.graphql");
    let expected = include_str!("generate_flow/fixtures/default-input.expected");
    test_fixture(transform_fixture, file!(), "default-input.graphql", "generate_flow/fixtures/default-input.expected", input, expected).await;
}

#[tokio::test]
async fn fragment_spread() {
    let input = include_str!("generate_flow/fixtures/fragment-spread.graphql");
    let expected = include_str!("generate_flow/fixtures/fragment-spread.expected");
    test_fixture(transform_fixture, file!(), "fragment-spread.graphql", "generate_flow/fixtures/fragment-spread.expected", input, expected).await;
}

#[tokio::test]
async fn inline_fragment() {
    let input = include_str!("generate_flow/fixtures/inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "inline-fragment.graphql", "generate_flow/fixtures/inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn linked_field() {
    let input = include_str!("generate_flow/fixtures/linked-field.graphql");
    let expected = include_str!("generate_flow/fixtures/linked-field.expected");
    test_fixture(transform_fixture, file!(), "linked-field.graphql", "generate_flow/fixtures/linked-field.expected", input, expected).await;
}

#[tokio::test]
async fn match_field() {
    let input = include_str!("generate_flow/fixtures/match-field.graphql");
    let expected = include_str!("generate_flow/fixtures/match-field.expected");
    test_fixture(transform_fixture, file!(), "match-field.graphql", "generate_flow/fixtures/match-field.expected", input, expected).await;
}

#[tokio::test]
async fn match_field_in_query() {
    let input = include_str!("generate_flow/fixtures/match-field-in-query.graphql");
    let expected = include_str!("generate_flow/fixtures/match-field-in-query.expected");
    test_fixture(transform_fixture, file!(), "match-field-in-query.graphql", "generate_flow/fixtures/match-field-in-query.expected", input, expected).await;
}

#[tokio::test]
async fn mixed_conditonal_raw_response() {
    let input = include_str!("generate_flow/fixtures/mixed-conditonal-raw-response.graphql");
    let expected = include_str!("generate_flow/fixtures/mixed-conditonal-raw-response.expected");
    test_fixture(transform_fixture, file!(), "mixed-conditonal-raw-response.graphql", "generate_flow/fixtures/mixed-conditonal-raw-response.expected", input, expected).await;
}

#[tokio::test]
async fn mutation() {
    let input = include_str!("generate_flow/fixtures/mutation.graphql");
    let expected = include_str!("generate_flow/fixtures/mutation.expected");
    test_fixture(transform_fixture, file!(), "mutation.graphql", "generate_flow/fixtures/mutation.expected", input, expected).await;
}

#[tokio::test]
async fn mutation_input_has_array() {
    let input = include_str!("generate_flow/fixtures/mutation-input-has-array.graphql");
    let expected = include_str!("generate_flow/fixtures/mutation-input-has-array.expected");
    test_fixture(transform_fixture, file!(), "mutation-input-has-array.graphql", "generate_flow/fixtures/mutation-input-has-array.expected", input, expected).await;
}

#[tokio::test]
async fn mutation_with_client_extension() {
    let input = include_str!("generate_flow/fixtures/mutation-with-client-extension.graphql");
    let expected = include_str!("generate_flow/fixtures/mutation-with-client-extension.expected");
    test_fixture(transform_fixture, file!(), "mutation-with-client-extension.graphql", "generate_flow/fixtures/mutation-with-client-extension.expected", input, expected).await;
}

#[tokio::test]
async fn mutation_with_enums_on_fragment() {
    let input = include_str!("generate_flow/fixtures/mutation-with-enums-on-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/mutation-with-enums-on-fragment.expected");
    test_fixture(transform_fixture, file!(), "mutation-with-enums-on-fragment.graphql", "generate_flow/fixtures/mutation-with-enums-on-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn mutation_with_nested_fragments() {
    let input = include_str!("generate_flow/fixtures/mutation-with-nested-fragments.graphql");
    let expected = include_str!("generate_flow/fixtures/mutation-with-nested-fragments.expected");
    test_fixture(transform_fixture, file!(), "mutation-with-nested-fragments.graphql", "generate_flow/fixtures/mutation-with-nested-fragments.expected", input, expected).await;
}

#[tokio::test]
async fn mutation_with_one_of() {
    let input = include_str!("generate_flow/fixtures/mutation-with-one-of.graphql");
    let expected = include_str!("generate_flow/fixtures/mutation-with-one-of.expected");
    test_fixture(transform_fixture, file!(), "mutation-with-one-of.graphql", "generate_flow/fixtures/mutation-with-one-of.expected", input, expected).await;
}

#[tokio::test]
async fn mutation_with_response_on_inline_fragments() {
    let input = include_str!("generate_flow/fixtures/mutation-with-response-on-inline-fragments.graphql");
    let expected = include_str!("generate_flow/fixtures/mutation-with-response-on-inline-fragments.expected");
    test_fixture(transform_fixture, file!(), "mutation-with-response-on-inline-fragments.graphql", "generate_flow/fixtures/mutation-with-response-on-inline-fragments.expected", input, expected).await;
}

#[tokio::test]
async fn no_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/no-inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/no-inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "no-inline-fragment.graphql", "generate_flow/fixtures/no-inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn no_inline_fragment_on_abstract_field() {
    let input = include_str!("generate_flow/fixtures/no-inline-fragment-on-abstract-field.graphql");
    let expected = include_str!("generate_flow/fixtures/no-inline-fragment-on-abstract-field.expected");
    test_fixture(transform_fixture, file!(), "no-inline-fragment-on-abstract-field.graphql", "generate_flow/fixtures/no-inline-fragment-on-abstract-field.expected", input, expected).await;
}

#[tokio::test]
async fn plural_fragment() {
    let input = include_str!("generate_flow/fixtures/plural-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/plural-fragment.expected");
    test_fixture(transform_fixture, file!(), "plural-fragment.graphql", "generate_flow/fixtures/plural-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn query_mixed_provided_variables() {
    let input = include_str!("generate_flow/fixtures/query-mixed-provided-variables.graphql");
    let expected = include_str!("generate_flow/fixtures/query-mixed-provided-variables.expected");
    test_fixture(transform_fixture, file!(), "query-mixed-provided-variables.graphql", "generate_flow/fixtures/query-mixed-provided-variables.expected", input, expected).await;
}

#[tokio::test]
async fn query_only_provided_variables() {
    let input = include_str!("generate_flow/fixtures/query-only-provided-variables.graphql");
    let expected = include_str!("generate_flow/fixtures/query-only-provided-variables.expected");
    test_fixture(transform_fixture, file!(), "query-only-provided-variables.graphql", "generate_flow/fixtures/query-only-provided-variables.expected", input, expected).await;
}

#[tokio::test]
async fn query_provided_variables_custom_scalar() {
    let input = include_str!("generate_flow/fixtures/query-provided-variables-custom-scalar.graphql");
    let expected = include_str!("generate_flow/fixtures/query-provided-variables-custom-scalar.expected");
    test_fixture(transform_fixture, file!(), "query-provided-variables-custom-scalar.graphql", "generate_flow/fixtures/query-provided-variables-custom-scalar.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_deduplicated_raw_response_type() {
    let input = include_str!("generate_flow/fixtures/query-with-deduplicated-raw-response-type.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-deduplicated-raw-response-type.expected");
    test_fixture(transform_fixture, file!(), "query-with-deduplicated-raw-response-type.graphql", "generate_flow/fixtures/query-with-deduplicated-raw-response-type.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_disabled_deduplicated_raw_response_type() {
    let input = include_str!("generate_flow/fixtures/query-with-disabled-deduplicated-raw-response-type.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-disabled-deduplicated-raw-response-type.expected");
    test_fixture(transform_fixture, file!(), "query-with-disabled-deduplicated-raw-response-type.graphql", "generate_flow/fixtures/query-with-disabled-deduplicated-raw-response-type.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_handles() {
    let input = include_str!("generate_flow/fixtures/query-with-handles.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-handles.expected");
    test_fixture(transform_fixture, file!(), "query-with-handles.graphql", "generate_flow/fixtures/query-with-handles.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_match_field_and_applicable_abstract_fragment() {
    let input = include_str!("generate_flow/fixtures/query-with-match-field-and-applicable-abstract-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-match-field-and-applicable-abstract-fragment.expected");
    test_fixture(transform_fixture, file!(), "query-with-match-field-and-applicable-abstract-fragment.graphql", "generate_flow/fixtures/query-with-match-field-and-applicable-abstract-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_match_field_and_nested_no_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/query-with-match-field-and-nested-no-inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-match-field-and-nested-no-inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "query-with-match-field-and-nested-no-inline-fragment.graphql", "generate_flow/fixtures/query-with-match-field-and-nested-no-inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_match_fields() {
    let input = include_str!("generate_flow/fixtures/query-with-match-fields.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-match-fields.expected");
    test_fixture(transform_fixture, file!(), "query-with-match-fields.graphql", "generate_flow/fixtures/query-with-match-fields.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_module_field() {
    let input = include_str!("generate_flow/fixtures/query-with-module-field.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-module-field.expected");
    test_fixture(transform_fixture, file!(), "query-with-module-field.graphql", "generate_flow/fixtures/query-with-module-field.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_multiple_match_fields() {
    let input = include_str!("generate_flow/fixtures/query-with-multiple-match-fields.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-multiple-match-fields.expected");
    test_fixture(transform_fixture, file!(), "query-with-multiple-match-fields.graphql", "generate_flow/fixtures/query-with-multiple-match-fields.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_abstract_in_catch_all() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-abstract-in-catch-all.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-abstract-in-catch-all.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-abstract-in-catch-all.graphql", "generate_flow/fixtures/query-with-raw-response-abstract-in-catch-all.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_concrete_and_interface_spreads() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-concrete-and-interface-spreads.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-concrete-and-interface-spreads.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-concrete-and-interface-spreads.graphql", "generate_flow/fixtures/query-with-raw-response-concrete-and-interface-spreads.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_interface() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-interface.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-interface.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-interface.graphql", "generate_flow/fixtures/query-with-raw-response-interface.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_interface_inline_fragment_on_interface() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-interface-inline-fragment-on-interface.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-interface-inline-fragment-on-interface.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-interface-inline-fragment-on-interface.graphql", "generate_flow/fixtures/query-with-raw-response-interface-inline-fragment-on-interface.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_linked_field_in_abstract_spread() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-linked-field-in-abstract-spread.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-linked-field-in-abstract-spread.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-linked-field-in-abstract-spread.graphql", "generate_flow/fixtures/query-with-raw-response-linked-field-in-abstract-spread.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_mixed_abstract_and_concrete_spreads() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-mixed-abstract-and-concrete-spreads.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-mixed-abstract-and-concrete-spreads.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-mixed-abstract-and-concrete-spreads.graphql", "generate_flow/fixtures/query-with-raw-response-mixed-abstract-and-concrete-spreads.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_nested_abstract_inline_fragments() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-nested-abstract-inline-fragments.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-nested-abstract-inline-fragments.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-nested-abstract-inline-fragments.graphql", "generate_flow/fixtures/query-with-raw-response-nested-abstract-inline-fragments.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_nested_different_abstract_inline_fragments() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-nested-different-abstract-inline-fragments.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-nested-different-abstract-inline-fragments.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-nested-different-abstract-inline-fragments.graphql", "generate_flow/fixtures/query-with-raw-response-nested-different-abstract-inline-fragments.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_object_inline_fragment_on_interface() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-object-inline-fragment-on-interface.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-object-inline-fragment-on-interface.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-object-inline-fragment-on-interface.graphql", "generate_flow/fixtures/query-with-raw-response-object-inline-fragment-on-interface.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_on_conditional() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-on-conditional.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-on-conditional.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-on-conditional.graphql", "generate_flow/fixtures/query-with-raw-response-on-conditional.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_on_literal_conditional() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-on-literal-conditional.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-on-literal-conditional.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-on-literal-conditional.graphql", "generate_flow/fixtures/query-with-raw-response-on-literal-conditional.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_union() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-union.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-union.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-union.graphql", "generate_flow/fixtures/query-with-raw-response-union.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_union_and_interface_spread_all_implement() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-union-and-interface-spread-all-implement.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-union-and-interface-spread-all-implement.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-union-and-interface-spread-all-implement.graphql", "generate_flow/fixtures/query-with-raw-response-union-and-interface-spread-all-implement.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_raw_response_union_and_interface_spread_with_non_null_field() {
    let input = include_str!("generate_flow/fixtures/query-with-raw-response-union-and-interface-spread-with-non-null-field.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-raw-response-union-and-interface-spread-with-non-null-field.expected");
    test_fixture(transform_fixture, file!(), "query-with-raw-response-union-and-interface-spread-with-non-null-field.graphql", "generate_flow/fixtures/query-with-raw-response-union-and-interface-spread-with-non-null-field.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_stream() {
    let input = include_str!("generate_flow/fixtures/query-with-stream.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-stream.expected");
    test_fixture(transform_fixture, file!(), "query-with-stream.graphql", "generate_flow/fixtures/query-with-stream.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_stream_connection() {
    let input = include_str!("generate_flow/fixtures/query-with-stream-connection.graphql");
    let expected = include_str!("generate_flow/fixtures/query-with-stream-connection.expected");
    test_fixture(transform_fixture, file!(), "query-with-stream-connection.graphql", "generate_flow/fixtures/query-with-stream-connection.expected", input, expected).await;
}

#[tokio::test]
async fn raw_response_concrete_field_via_interface_covariant_return() {
    let input = include_str!("generate_flow/fixtures/raw-response-concrete-field-via-interface-covariant-return.graphql");
    let expected = include_str!("generate_flow/fixtures/raw-response-concrete-field-via-interface-covariant-return.expected");
    test_fixture(transform_fixture, file!(), "raw-response-concrete-field-via-interface-covariant-return.graphql", "generate_flow/fixtures/raw-response-concrete-field-via-interface-covariant-return.expected", input, expected).await;
}

#[tokio::test]
async fn recursive_fragments() {
    let input = include_str!("generate_flow/fixtures/recursive-fragments.graphql");
    let expected = include_str!("generate_flow/fixtures/recursive-fragments.expected");
    test_fixture(transform_fixture, file!(), "recursive-fragments.graphql", "generate_flow/fixtures/recursive-fragments.expected", input, expected).await;
}

#[tokio::test]
async fn refetchable() {
    let input = include_str!("generate_flow/fixtures/refetchable.graphql");
    let expected = include_str!("generate_flow/fixtures/refetchable.expected");
    test_fixture(transform_fixture, file!(), "refetchable.graphql", "generate_flow/fixtures/refetchable.expected", input, expected).await;
}

#[tokio::test]
async fn refetchable_fragment() {
    let input = include_str!("generate_flow/fixtures/refetchable-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/refetchable-fragment.expected");
    test_fixture(transform_fixture, file!(), "refetchable-fragment.graphql", "generate_flow/fixtures/refetchable-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn regular_query_with_assignable_fragment_spread() {
    let input = include_str!("generate_flow/fixtures/regular-query-with-assignable-fragment-spread.graphql");
    let expected = include_str!("generate_flow/fixtures/regular-query-with-assignable-fragment-spread.expected");
    test_fixture(transform_fixture, file!(), "regular-query-with-assignable-fragment-spread.graphql", "generate_flow/fixtures/regular-query-with-assignable-fragment-spread.expected", input, expected).await;
}

#[tokio::test]
async fn relay_client_id_field() {
    let input = include_str!("generate_flow/fixtures/relay-client-id-field.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-client-id-field.expected");
    test_fixture(transform_fixture, file!(), "relay-client-id-field.graphql", "generate_flow/fixtures/relay-client-id-field.expected", input, expected).await;
}

#[tokio::test]
async fn relay_live_resolver() {
    let input = include_str!("generate_flow/fixtures/relay-live-resolver.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-live-resolver.expected");
    test_fixture(transform_fixture, file!(), "relay-live-resolver.graphql", "generate_flow/fixtures/relay-live-resolver.expected", input, expected).await;
}

#[tokio::test]
async fn relay_live_resolver_no_fragment() {
    let input = include_str!("generate_flow/fixtures/relay-live-resolver-no-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-live-resolver-no-fragment.expected");
    test_fixture(transform_fixture, file!(), "relay-live-resolver-no-fragment.graphql", "generate_flow/fixtures/relay-live-resolver-no-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn relay_live_resolver_with_field_args() {
    let input = include_str!("generate_flow/fixtures/relay-live-resolver-with-field-args.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-live-resolver-with-field-args.expected");
    test_fixture(transform_fixture, file!(), "relay-live-resolver-with-field-args.graphql", "generate_flow/fixtures/relay-live-resolver-with-field-args.expected", input, expected).await;
}

#[tokio::test]
async fn relay_live_resolver_with_field_args_no_fragment() {
    let input = include_str!("generate_flow/fixtures/relay-live-resolver-with-field-args-no-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-live-resolver-with-field-args-no-fragment.expected");
    test_fixture(transform_fixture, file!(), "relay-live-resolver-with-field-args-no-fragment.graphql", "generate_flow/fixtures/relay-live-resolver-with-field-args-no-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver() {
    let input = include_str!("generate_flow/fixtures/relay-resolver.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver.graphql", "generate_flow/fixtures/relay-resolver.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_client_edge() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-client-edge.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-client-edge.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-client-edge.graphql", "generate_flow/fixtures/relay-resolver-client-edge.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_client_edge_required() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-client-edge-required.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-client-edge-required.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-client-edge-required.graphql", "generate_flow/fixtures/relay-resolver-client-edge-required.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_client_edge_required_edge() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-client-edge-required-edge.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-client-edge-required-edge.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-client-edge-required-edge.graphql", "generate_flow/fixtures/relay-resolver-client-edge-required-edge.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_in_fragment() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-in-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-in-fragment.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-in-fragment.graphql", "generate_flow/fixtures/relay-resolver-in-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_inject_fragment_data() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-inject-fragment-data.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-inject-fragment-data.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-inject-fragment-data.graphql", "generate_flow/fixtures/relay-resolver-inject-fragment-data.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_live_client_edge() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-live-client-edge.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-live-client-edge.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-live-client-edge.graphql", "generate_flow/fixtures/relay-resolver-live-client-edge.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_multiple_consumers() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-multiple-consumers.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-multiple-consumers.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-multiple-consumers.graphql", "generate_flow/fixtures/relay-resolver-multiple-consumers.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_named_import() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-named-import.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-named-import.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-named-import.graphql", "generate_flow/fixtures/relay-resolver-named-import.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_plural_client_edge() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-plural-client-edge.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-plural-client-edge.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-plural-client-edge.graphql", "generate_flow/fixtures/relay-resolver-plural-client-edge.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_plural_client_edge_with_required_edge() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-plural-client-edge-with-required-edge.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-plural-client-edge-with-required-edge.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-plural-client-edge-with-required-edge.graphql", "generate_flow/fixtures/relay-resolver-plural-client-edge-with-required-edge.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_plural_required_client_edge() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-plural-required-client-edge.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-plural-required-client-edge.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-plural-required-client-edge.graphql", "generate_flow/fixtures/relay-resolver-plural-required-client-edge.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_plural_required_client_edge_with_required_edge() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-plural-required-client-edge-with-required-edge.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-plural-required-client-edge-with-required-edge.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-plural-required-client-edge-with-required-edge.graphql", "generate_flow/fixtures/relay-resolver-plural-required-client-edge-with-required-edge.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_raw_response() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-raw-response.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-raw-response.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-raw-response.graphql", "generate_flow/fixtures/relay-resolver-raw-response.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_required() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-required.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-required.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-required.graphql", "generate_flow/fixtures/relay-resolver-required.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_scalar_plural() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-scalar-plural.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-scalar-plural.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-scalar-plural.graphql", "generate_flow/fixtures/relay-resolver-scalar-plural.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_client_interface() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-client-interface.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-client-interface.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-client-interface.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-client-interface.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_client_object() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-client-object.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-client-object.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-client-object.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-client-object.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_client_object_plural() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-client-object-plural.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-client-object-plural.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-client-object-plural.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-client-object-plural.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_enum() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-enum.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-enum.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-enum.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-enum.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_enum_plural() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-enum-plural.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-enum-plural.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-enum-plural.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-enum-plural.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_relay_resolver_value() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-relay-resolver-value.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_relay_resolver_value_plural() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value-plural.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value-plural.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-relay-resolver-value-plural.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value-plural.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_relay_resolver_value_required() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value-required.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value-required.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-relay-resolver-value-required.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-relay-resolver-value-required.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_scalar() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-scalar.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-scalar.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-scalar.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-scalar.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_scalar_plural() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-scalar-plural.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-scalar-plural.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-scalar-plural.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-scalar-plural.expected", input, expected).await;
}

#[tokio::test]
async fn relay_resolver_with_output_type_scalar_required() {
    let input = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-scalar-required.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-resolver-with-output-type-scalar-required.expected");
    test_fixture(transform_fixture, file!(), "relay-resolver-with-output-type-scalar-required.graphql", "generate_flow/fixtures/relay-resolver-with-output-type-scalar-required.expected", input, expected).await;
}

#[tokio::test]
async fn relay_rsc_resolver_field() {
    let input = include_str!("generate_flow/fixtures/relay-rsc-resolver-field.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-rsc-resolver-field.expected");
    test_fixture(transform_fixture, file!(), "relay-rsc-resolver-field.graphql", "generate_flow/fixtures/relay-rsc-resolver-field.expected", input, expected).await;
}

#[tokio::test]
async fn relay_rsc_resolver_field_default_node_type() {
    let input = include_str!("generate_flow/fixtures/relay-rsc-resolver-field-default-node-type.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-rsc-resolver-field-default-node-type.expected");
    test_fixture(transform_fixture, file!(), "relay-rsc-resolver-field-default-node-type.graphql", "generate_flow/fixtures/relay-rsc-resolver-field-default-node-type.expected", input, expected).await;
}

#[tokio::test]
async fn relay_rsc_resolver_field_digit_export() {
    let input = include_str!("generate_flow/fixtures/relay-rsc-resolver-field-digit-export.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-rsc-resolver-field-digit-export.expected");
    test_fixture(transform_fixture, file!(), "relay-rsc-resolver-field-digit-export.graphql", "generate_flow/fixtures/relay-rsc-resolver-field-digit-export.expected", input, expected).await;
}

#[tokio::test]
async fn relay_rsc_resolver_field_lowercase_export() {
    let input = include_str!("generate_flow/fixtures/relay-rsc-resolver-field-lowercase-export.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-rsc-resolver-field-lowercase-export.expected");
    test_fixture(transform_fixture, file!(), "relay-rsc-resolver-field-lowercase-export.graphql", "generate_flow/fixtures/relay-rsc-resolver-field-lowercase-export.expected", input, expected).await;
}

#[tokio::test]
async fn relay_rsc_resolver_field_raw_node_type() {
    let input = include_str!("generate_flow/fixtures/relay-rsc-resolver-field-raw-node-type.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-rsc-resolver-field-raw-node-type.expected");
    test_fixture(transform_fixture, file!(), "relay-rsc-resolver-field-raw-node-type.graphql", "generate_flow/fixtures/relay-rsc-resolver-field-raw-node-type.expected", input, expected).await;
}

#[tokio::test]
async fn relay_weak_client_type() {
    let input = include_str!("generate_flow/fixtures/relay-weak-client-type.graphql");
    let expected = include_str!("generate_flow/fixtures/relay-weak-client-type.expected");
    test_fixture(transform_fixture, file!(), "relay-weak-client-type.graphql", "generate_flow/fixtures/relay-weak-client-type.expected", input, expected).await;
}

#[tokio::test]
async fn required() {
    let input = include_str!("generate_flow/fixtures/required.graphql");
    let expected = include_str!("generate_flow/fixtures/required.expected");
    test_fixture(transform_fixture, file!(), "required.graphql", "generate_flow/fixtures/required.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_through_inline_fragments_to_fragment() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-through-inline-fragments-to-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-through-inline-fragments-to-fragment.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-through-inline-fragments-to-fragment.graphql", "generate_flow/fixtures/required-bubbles-through-inline-fragments-to-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_fragment() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-fragment.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-fragment.graphql", "generate_flow/fixtures/required-bubbles-to-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_item_in_plural_field() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-item-in-plural-field.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-item-in-plural-field.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-item-in-plural-field.graphql", "generate_flow/fixtures/required-bubbles-to-item-in-plural-field.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_item_in_required_plural_field() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-item-in-required-plural-field.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-item-in-required-plural-field.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-item-in-required-plural-field.graphql", "generate_flow/fixtures/required-bubbles-to-item-in-required-plural-field.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_non_null_item_in_non_null_plural_linked_field() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-non-null-item-in-non-null-plural-linked-field.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-non-null-item-in-non-null-plural-linked-field.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-non-null-item-in-non-null-plural-linked-field.graphql", "generate_flow/fixtures/required-bubbles-to-non-null-item-in-non-null-plural-linked-field.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_non_null_linked_field() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-non-null-linked-field.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-non-null-linked-field.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-non-null-linked-field.graphql", "generate_flow/fixtures/required-bubbles-to-non-null-linked-field.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_non_null_linked_field_through_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-non-null-linked-field-through-inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-non-null-linked-field-through-inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-non-null-linked-field-through-inline-fragment.graphql", "generate_flow/fixtures/required-bubbles-to-non-null-linked-field-through-inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_non_null_plural_linked_field() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-non-null-plural-linked-field.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-non-null-plural-linked-field.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-non-null-plural-linked-field.graphql", "generate_flow/fixtures/required-bubbles-to-non-null-plural-linked-field.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_plural_fragment_root() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-plural-fragment-root.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-plural-fragment-root.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-plural-fragment-root.graphql", "generate_flow/fixtures/required-bubbles-to-plural-fragment-root.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_to_query() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-to-query.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-to-query.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-to-query.graphql", "generate_flow/fixtures/required-bubbles-to-query.expected", input, expected).await;
}

#[tokio::test]
async fn required_bubbles_up_to_mutation_response() {
    let input = include_str!("generate_flow/fixtures/required-bubbles-up-to-mutation-response.graphql");
    let expected = include_str!("generate_flow/fixtures/required-bubbles-up-to-mutation-response.expected");
    test_fixture(transform_fixture, file!(), "required-bubbles-up-to-mutation-response.graphql", "generate_flow/fixtures/required-bubbles-up-to-mutation-response.expected", input, expected).await;
}

#[tokio::test]
async fn required_chain_bubbles_to_non_null_linked_field_through_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/required-chain-bubbles-to-non-null-linked-field-through-inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/required-chain-bubbles-to-non-null-linked-field-through-inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "required-chain-bubbles-to-non-null-linked-field-through-inline-fragment.graphql", "generate_flow/fixtures/required-chain-bubbles-to-non-null-linked-field-through-inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn required_conditional() {
    let input = include_str!("generate_flow/fixtures/required-conditional.graphql");
    let expected = include_str!("generate_flow/fixtures/required-conditional.expected");
    test_fixture(transform_fixture, file!(), "required-conditional.graphql", "generate_flow/fixtures/required-conditional.expected", input, expected).await;
}

#[tokio::test]
async fn required_isolates_concrete_inline_fragments() {
    let input = include_str!("generate_flow/fixtures/required-isolates-concrete-inline-fragments.graphql");
    let expected = include_str!("generate_flow/fixtures/required-isolates-concrete-inline-fragments.expected");
    test_fixture(transform_fixture, file!(), "required-isolates-concrete-inline-fragments.graphql", "generate_flow/fixtures/required-isolates-concrete-inline-fragments.expected", input, expected).await;
}

#[tokio::test]
async fn required_raw_response_type() {
    let input = include_str!("generate_flow/fixtures/required-raw-response-type.graphql");
    let expected = include_str!("generate_flow/fixtures/required-raw-response-type.expected");
    test_fixture(transform_fixture, file!(), "required-raw-response-type.graphql", "generate_flow/fixtures/required-raw-response-type.expected", input, expected).await;
}

#[tokio::test]
async fn required_throw_doesnt_bubbles_to_fragment() {
    let input = include_str!("generate_flow/fixtures/required-throw-doesnt-bubbles-to-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/required-throw-doesnt-bubbles-to-fragment.expected");
    test_fixture(transform_fixture, file!(), "required-throw-doesnt-bubbles-to-fragment.graphql", "generate_flow/fixtures/required-throw-doesnt-bubbles-to-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn required_throw_doesnt_bubbles_to_query() {
    let input = include_str!("generate_flow/fixtures/required-throw-doesnt-bubbles-to-query.graphql");
    let expected = include_str!("generate_flow/fixtures/required-throw-doesnt-bubbles-to-query.expected");
    test_fixture(transform_fixture, file!(), "required-throw-doesnt-bubbles-to-query.graphql", "generate_flow/fixtures/required-throw-doesnt-bubbles-to-query.expected", input, expected).await;
}

#[tokio::test]
async fn required_throws_nested() {
    let input = include_str!("generate_flow/fixtures/required-throws-nested.graphql");
    let expected = include_str!("generate_flow/fixtures/required-throws-nested.expected");
    test_fixture(transform_fixture, file!(), "required-throws-nested.graphql", "generate_flow/fixtures/required-throws-nested.expected", input, expected).await;
}

#[tokio::test]
async fn required_throws_within_non_null_linked_field() {
    let input = include_str!("generate_flow/fixtures/required-throws-within-non-null-linked-field.graphql");
    let expected = include_str!("generate_flow/fixtures/required-throws-within-non-null-linked-field.expected");
    test_fixture(transform_fixture, file!(), "required-throws-within-non-null-linked-field.graphql", "generate_flow/fixtures/required-throws-within-non-null-linked-field.expected", input, expected).await;
}

#[tokio::test]
async fn required_throws_within_non_null_plural_linked_field() {
    let input = include_str!("generate_flow/fixtures/required-throws-within-non-null-plural-linked-field.graphql");
    let expected = include_str!("generate_flow/fixtures/required-throws-within-non-null-plural-linked-field.expected");
    test_fixture(transform_fixture, file!(), "required-throws-within-non-null-plural-linked-field.graphql", "generate_flow/fixtures/required-throws-within-non-null-plural-linked-field.expected", input, expected).await;
}

#[tokio::test]
async fn required_within_aliased_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/required-within-aliased-inline-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/required-within-aliased-inline-fragment.expected");
    test_fixture(transform_fixture, file!(), "required-within-aliased-inline-fragment.graphql", "generate_flow/fixtures/required-within-aliased-inline-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn required_within_aliased_inline_fragment_on_abstract() {
    let input = include_str!("generate_flow/fixtures/required-within-aliased-inline-fragment-on-abstract.graphql");
    let expected = include_str!("generate_flow/fixtures/required-within-aliased-inline-fragment-on-abstract.expected");
    test_fixture(transform_fixture, file!(), "required-within-aliased-inline-fragment-on-abstract.graphql", "generate_flow/fixtures/required-within-aliased-inline-fragment-on-abstract.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_of_all_strong_model_type() {
    let input = include_str!("generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type.graphql");
    let expected = include_str!("generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type.expected");
    test_fixture(transform_fixture, file!(), "resolver-on-interface-of-all-strong-model-type.graphql", "generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_of_all_strong_model_type_with_extension() {
    let input = include_str!("generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type-with-extension.graphql");
    let expected = include_str!("generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type-with-extension.expected");
    test_fixture(transform_fixture, file!(), "resolver-on-interface-of-all-strong-model-type-with-extension.graphql", "generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type-with-extension.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_of_all_strong_model_type_with_root_fragment() {
    let input = include_str!("generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type-with-root-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type-with-root-fragment.expected");
    test_fixture(transform_fixture, file!(), "resolver-on-interface-of-all-strong-model-type-with-root-fragment.graphql", "generate_flow/fixtures/resolver-on-interface-of-all-strong-model-type-with-root-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn resolver_on_interface_of_all_weak_model_type() {
    let input = include_str!("generate_flow/fixtures/resolver-on-interface-of-all-weak-model-type.graphql");
    let expected = include_str!("generate_flow/fixtures/resolver-on-interface-of-all-weak-model-type.expected");
    test_fixture(transform_fixture, file!(), "resolver-on-interface-of-all-weak-model-type.graphql", "generate_flow/fixtures/resolver-on-interface-of-all-weak-model-type.expected", input, expected).await;
}

#[tokio::test]
async fn roots() {
    let input = include_str!("generate_flow/fixtures/roots.graphql");
    let expected = include_str!("generate_flow/fixtures/roots.expected");
    test_fixture(transform_fixture, file!(), "roots.graphql", "generate_flow/fixtures/roots.expected", input, expected).await;
}

#[tokio::test]
async fn scalar_field() {
    let input = include_str!("generate_flow/fixtures/scalar-field.graphql");
    let expected = include_str!("generate_flow/fixtures/scalar-field.expected");
    test_fixture(transform_fixture, file!(), "scalar-field.graphql", "generate_flow/fixtures/scalar-field.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_in_raw_response() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_in_raw_response.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_in_raw_response.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_in_raw_response.graphql", "generate_flow/fixtures/semantic_non_null_in_raw_response.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_items_in_matrix() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_items_in_matrix.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_items_in_matrix.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_items_in_matrix.graphql", "generate_flow/fixtures/semantic_non_null_items_in_matrix.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_liked_field_resolver() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_liked_field_resolver.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_liked_field_resolver.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_liked_field_resolver.graphql", "generate_flow/fixtures/semantic_non_null_liked_field_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_liked_field_weak_resolver() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_liked_field_weak_resolver.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_liked_field_weak_resolver.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_liked_field_weak_resolver.graphql", "generate_flow/fixtures/semantic_non_null_liked_field_weak_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_linked_field() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_linked_field.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_linked_field.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_linked_field.graphql", "generate_flow/fixtures/semantic_non_null_linked_field.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_list_and_list_item() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_list_and_list_item.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_list_and_list_item.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_list_and_list_item.graphql", "generate_flow/fixtures/semantic_non_null_list_and_list_item.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_list_item() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_list_item.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_list_item.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_list_item.graphql", "generate_flow/fixtures/semantic_non_null_list_item.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_scalar() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_scalar.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_scalar.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_scalar.graphql", "generate_flow/fixtures/semantic_non_null_scalar.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_scalar_feature_disabled() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_scalar_feature_disabled.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_scalar_feature_disabled.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_scalar_feature_disabled.graphql", "generate_flow/fixtures/semantic_non_null_scalar_feature_disabled.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_scalar_resolver() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_scalar_resolver.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_scalar_resolver.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_scalar_resolver.graphql", "generate_flow/fixtures/semantic_non_null_scalar_resolver.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_scalar_with_catch() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_scalar_with_catch.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_scalar_with_catch.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_scalar_with_catch.graphql", "generate_flow/fixtures/semantic_non_null_scalar_with_catch.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_scalar_within_catch_fragment() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_scalar_within_catch_fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_scalar_within_catch_fragment.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_scalar_within_catch_fragment.graphql", "generate_flow/fixtures/semantic_non_null_scalar_within_catch_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_scalar_within_catch_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_scalar_within_catch_inline_fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_scalar_within_catch_inline_fragment.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_scalar_within_catch_inline_fragment.graphql", "generate_flow/fixtures/semantic_non_null_scalar_within_catch_inline_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_scalar_within_catch_query() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_scalar_within_catch_query.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_scalar_within_catch_query.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_scalar_within_catch_query.graphql", "generate_flow/fixtures/semantic_non_null_scalar_within_catch_query.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_non_null_scalar_within_inline_fragment() {
    let input = include_str!("generate_flow/fixtures/semantic_non_null_scalar_within_inline_fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_non_null_scalar_within_inline_fragment.expected");
    test_fixture(transform_fixture, file!(), "semantic_non_null_scalar_within_inline_fragment.graphql", "generate_flow/fixtures/semantic_non_null_scalar_within_inline_fragment.expected", input, expected).await;
}

#[tokio::test]
async fn semantic_null_required_throw_on_error() {
    let input = include_str!("generate_flow/fixtures/semantic_null_required_throw_on_error.graphql");
    let expected = include_str!("generate_flow/fixtures/semantic_null_required_throw_on_error.expected");
    test_fixture(transform_fixture, file!(), "semantic_null_required_throw_on_error.graphql", "generate_flow/fixtures/semantic_null_required_throw_on_error.expected", input, expected).await;
}

#[tokio::test]
async fn simple() {
    let input = include_str!("generate_flow/fixtures/simple.graphql");
    let expected = include_str!("generate_flow/fixtures/simple.expected");
    test_fixture(transform_fixture, file!(), "simple.graphql", "generate_flow/fixtures/simple.expected", input, expected).await;
}

#[tokio::test]
async fn spread_interface_fragment_on_concrete_raw_type() {
    let input = include_str!("generate_flow/fixtures/spread-interface-fragment-on-concrete-raw-type.graphql");
    let expected = include_str!("generate_flow/fixtures/spread-interface-fragment-on-concrete-raw-type.expected");
    test_fixture(transform_fixture, file!(), "spread-interface-fragment-on-concrete-raw-type.graphql", "generate_flow/fixtures/spread-interface-fragment-on-concrete-raw-type.expected", input, expected).await;
}

#[tokio::test]
async fn typename_discriminated_unions() {
    let input = include_str!("generate_flow/fixtures/typename-discriminated-unions.graphql");
    let expected = include_str!("generate_flow/fixtures/typename-discriminated-unions.expected");
    test_fixture(transform_fixture, file!(), "typename-discriminated-unions.graphql", "generate_flow/fixtures/typename-discriminated-unions.expected", input, expected).await;
}

#[tokio::test]
async fn typename_in_union_with_other_fields() {
    let input = include_str!("generate_flow/fixtures/typename-in-union-with-other-fields.graphql");
    let expected = include_str!("generate_flow/fixtures/typename-in-union-with-other-fields.expected");
    test_fixture(transform_fixture, file!(), "typename-in-union-with-other-fields.graphql", "generate_flow/fixtures/typename-in-union-with-other-fields.expected", input, expected).await;
}

#[tokio::test]
async fn typename_inside_with_overlapping_fields() {
    let input = include_str!("generate_flow/fixtures/typename-inside-with-overlapping-fields.graphql");
    let expected = include_str!("generate_flow/fixtures/typename-inside-with-overlapping-fields.expected");
    test_fixture(transform_fixture, file!(), "typename-inside-with-overlapping-fields.graphql", "generate_flow/fixtures/typename-inside-with-overlapping-fields.expected", input, expected).await;
}

#[tokio::test]
async fn typename_on_union() {
    let input = include_str!("generate_flow/fixtures/typename-on-union.graphql");
    let expected = include_str!("generate_flow/fixtures/typename-on-union.expected");
    test_fixture(transform_fixture, file!(), "typename-on-union.graphql", "generate_flow/fixtures/typename-on-union.expected", input, expected).await;
}

#[tokio::test]
async fn typename_on_union_with_non_matching_aliases() {
    let input = include_str!("generate_flow/fixtures/typename-on-union-with-non-matching-aliases.graphql");
    let expected = include_str!("generate_flow/fixtures/typename-on-union-with-non-matching-aliases.expected");
    test_fixture(transform_fixture, file!(), "typename-on-union-with-non-matching-aliases.graphql", "generate_flow/fixtures/typename-on-union-with-non-matching-aliases.expected", input, expected).await;
}

#[tokio::test]
async fn unmasked_fragment_spreads() {
    let input = include_str!("generate_flow/fixtures/unmasked-fragment-spreads.graphql");
    let expected = include_str!("generate_flow/fixtures/unmasked-fragment-spreads.expected");
    test_fixture(transform_fixture, file!(), "unmasked-fragment-spreads.graphql", "generate_flow/fixtures/unmasked-fragment-spreads.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_fragment_spread() {
    let input = include_str!("generate_flow/fixtures/updatable-fragment-spread.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-fragment-spread.expected");
    test_fixture(transform_fixture, file!(), "updatable-fragment-spread.graphql", "generate_flow/fixtures/updatable-fragment-spread.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_fragment_spread_and_regular_spread() {
    let input = include_str!("generate_flow/fixtures/updatable-fragment-spread-and-regular-spread.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-fragment-spread-and-regular-spread.expected");
    test_fixture(transform_fixture, file!(), "updatable-fragment-spread-and-regular-spread.graphql", "generate_flow/fixtures/updatable-fragment-spread-and-regular-spread.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_fragment_spread_multiple() {
    let input = include_str!("generate_flow/fixtures/updatable-fragment-spread-multiple.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-fragment-spread-multiple.expected");
    test_fixture(transform_fixture, file!(), "updatable-fragment-spread-multiple.graphql", "generate_flow/fixtures/updatable-fragment-spread-multiple.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation() {
    let input = include_str!("generate_flow/fixtures/updatable-operation.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation.graphql", "generate_flow/fixtures/updatable-operation.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation_assignable_fragment() {
    let input = include_str!("generate_flow/fixtures/updatable-operation-assignable-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation-assignable-fragment.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation-assignable-fragment.graphql", "generate_flow/fixtures/updatable-operation-assignable-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation_assignable_fragment_plural() {
    let input = include_str!("generate_flow/fixtures/updatable-operation-assignable-fragment-plural.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation-assignable-fragment-plural.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation-assignable-fragment-plural.graphql", "generate_flow/fixtures/updatable-operation-assignable-fragment-plural.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation_assignable_fragments_within_narrowing() {
    let input = include_str!("generate_flow/fixtures/updatable-operation-assignable-fragments-within-narrowing.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation-assignable-fragments-within-narrowing.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation-assignable-fragments-within-narrowing.graphql", "generate_flow/fixtures/updatable-operation-assignable-fragments-within-narrowing.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation_multiple_assignable_fragments() {
    let input = include_str!("generate_flow/fixtures/updatable-operation-multiple-assignable-fragments.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation-multiple-assignable-fragments.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation-multiple-assignable-fragments.graphql", "generate_flow/fixtures/updatable-operation-multiple-assignable-fragments.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation_plural_field_no_spreads() {
    let input = include_str!("generate_flow/fixtures/updatable-operation-plural-field-no-spreads.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation-plural-field-no-spreads.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation-plural-field-no-spreads.graphql", "generate_flow/fixtures/updatable-operation-plural-field-no-spreads.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation_plural_field_with_spreads() {
    let input = include_str!("generate_flow/fixtures/updatable-operation-plural-field-with-spreads.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation-plural-field-with-spreads.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation-plural-field-with-spreads.graphql", "generate_flow/fixtures/updatable-operation-plural-field-with-spreads.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation_special_fields() {
    let input = include_str!("generate_flow/fixtures/updatable-operation-special-fields.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation-special-fields.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation-special-fields.graphql", "generate_flow/fixtures/updatable-operation-special-fields.expected", input, expected).await;
}

#[tokio::test]
async fn updatable_operation_type_refinement() {
    let input = include_str!("generate_flow/fixtures/updatable-operation-type-refinement.graphql");
    let expected = include_str!("generate_flow/fixtures/updatable-operation-type-refinement.expected");
    test_fixture(transform_fixture, file!(), "updatable-operation-type-refinement.graphql", "generate_flow/fixtures/updatable-operation-type-refinement.expected", input, expected).await;
}

#[tokio::test]
async fn assignable_conformant_union_fragment() {
    let input = include_str!("generate_flow/fixtures/assignable-conformant-union-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/assignable-conformant-union-fragment.expected");
    test_fixture(transform_fixture, file!(), "assignable-conformant-union-fragment.graphql", "generate_flow/fixtures/assignable-conformant-union-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn assignable_conformant_interface_fragment() {
    let input = include_str!("generate_flow/fixtures/assignable-conformant-interface-fragment.graphql");
    let expected = include_str!("generate_flow/fixtures/assignable-conformant-interface-fragment.expected");
    test_fixture(transform_fixture, file!(), "assignable-conformant-interface-fragment.graphql", "generate_flow/fixtures/assignable-conformant-interface-fragment.expected", input, expected).await;
}

#[tokio::test]
async fn assignable_nonconforming_interface() {
    let input = include_str!("generate_flow/fixtures/assignable-nonconforming-interface.graphql");
    let expected = include_str!("generate_flow/fixtures/assignable-nonconforming-interface.expected");
    test_fixture(transform_fixture, file!(), "assignable-nonconforming-interface.graphql", "generate_flow/fixtures/assignable-nonconforming-interface.expected", input, expected).await;
}
