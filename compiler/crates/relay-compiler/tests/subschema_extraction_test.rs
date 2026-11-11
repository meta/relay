/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<683d9e61cbe5f667142a753813929aad>>
 */

mod subschema_extraction;

use subschema_extraction::transform_fixture;
use fixture_tests::test_fixture;

#[tokio::test]
async fn abstract_spread_keeps_implementors() {
    let input = include_str!("subschema_extraction/fixtures/abstract_spread_keeps_implementors.input");
    let expected = include_str!("subschema_extraction/fixtures/abstract_spread_keeps_implementors.expected");
    test_fixture(transform_fixture, file!(), "abstract_spread_keeps_implementors.input", "subschema_extraction/fixtures/abstract_spread_keeps_implementors.expected", input, expected).await;
}

#[tokio::test]
async fn connection_page_info() {
    let input = include_str!("subschema_extraction/fixtures/connection_page_info.input");
    let expected = include_str!("subschema_extraction/fixtures/connection_page_info.expected");
    test_fixture(transform_fixture, file!(), "connection_page_info.input", "subschema_extraction/fixtures/connection_page_info.expected", input, expected).await;
}

#[tokio::test]
async fn defaulted_interface_argument() {
    let input = include_str!("subschema_extraction/fixtures/defaulted_interface_argument.input");
    let expected = include_str!("subschema_extraction/fixtures/defaulted_interface_argument.expected");
    test_fixture(transform_fixture, file!(), "defaulted_interface_argument.input", "subschema_extraction/fixtures/defaulted_interface_argument.expected", input, expected).await;
}

#[tokio::test]
async fn empty_interface_dependencies() {
    let input = include_str!("subschema_extraction/fixtures/empty_interface_dependencies.input");
    let expected = include_str!("subschema_extraction/fixtures/empty_interface_dependencies.expected");
    test_fixture(transform_fixture, file!(), "empty_interface_dependencies.input", "subschema_extraction/fixtures/empty_interface_dependencies.expected", input, expected).await;
}

#[tokio::test]
async fn empty_output_type_dependencies() {
    let input = include_str!("subschema_extraction/fixtures/empty_output_type_dependencies.input");
    let expected = include_str!("subschema_extraction/fixtures/empty_output_type_dependencies.expected");
    test_fixture(transform_fixture, file!(), "empty_output_type_dependencies.input", "subschema_extraction/fixtures/empty_output_type_dependencies.expected", input, expected).await;
}

#[tokio::test]
async fn generated_node_spread_does_not_keep_implementors() {
    let input = include_str!("subschema_extraction/fixtures/generated_node_spread_does_not_keep_implementors.input");
    let expected = include_str!("subschema_extraction/fixtures/generated_node_spread_does_not_keep_implementors.expected");
    test_fixture(transform_fixture, file!(), "generated_node_spread_does_not_keep_implementors.input", "subschema_extraction/fixtures/generated_node_spread_does_not_keep_implementors.expected", input, expected).await;
}

#[tokio::test]
async fn inlined_nested_input() {
    let input = include_str!("subschema_extraction/fixtures/inlined_nested_input.input");
    let expected = include_str!("subschema_extraction/fixtures/inlined_nested_input.expected");
    test_fixture(transform_fixture, file!(), "inlined_nested_input.input", "subschema_extraction/fixtures/inlined_nested_input.expected", input, expected).await;
}

#[tokio::test]
async fn interface_field_covariance() {
    let input = include_str!("subschema_extraction/fixtures/interface_field_covariance.input");
    let expected = include_str!("subschema_extraction/fixtures/interface_field_covariance.expected");
    test_fixture(transform_fixture, file!(), "interface_field_covariance.input", "subschema_extraction/fixtures/interface_field_covariance.expected", input, expected).await;
}

#[tokio::test]
async fn missing_full_schema() {
    let input = include_str!("subschema_extraction/fixtures/missing_full_schema.input");
    let expected = include_str!("subschema_extraction/fixtures/missing_full_schema.expected");
    test_fixture(transform_fixture, file!(), "missing_full_schema.input", "subschema_extraction/fixtures/missing_full_schema.expected", input, expected).await;
}

#[tokio::test]
async fn multiple_operations() {
    let input = include_str!("subschema_extraction/fixtures/multiple_operations.input");
    let expected = include_str!("subschema_extraction/fixtures/multiple_operations.expected");
    test_fixture(transform_fixture, file!(), "multiple_operations.input", "subschema_extraction/fixtures/multiple_operations.expected", input, expected).await;
}

#[tokio::test]
async fn mutation_with_input_types() {
    let input = include_str!("subschema_extraction/fixtures/mutation_with_input_types.input");
    let expected = include_str!("subschema_extraction/fixtures/mutation_with_input_types.expected");
    test_fixture(transform_fixture, file!(), "mutation_with_input_types.input", "subschema_extraction/fixtures/mutation_with_input_types.expected", input, expected).await;
}

#[tokio::test]
async fn simple_extraction() {
    let input = include_str!("subschema_extraction/fixtures/simple_extraction.input");
    let expected = include_str!("subschema_extraction/fixtures/simple_extraction.expected");
    test_fixture(transform_fixture, file!(), "simple_extraction.input", "subschema_extraction/fixtures/simple_extraction.expected", input, expected).await;
}

#[tokio::test]
async fn subscription_only() {
    let input = include_str!("subschema_extraction/fixtures/subscription_only.input");
    let expected = include_str!("subschema_extraction/fixtures/subscription_only.expected");
    test_fixture(transform_fixture, file!(), "subscription_only.input", "subschema_extraction/fixtures/subscription_only.expected", input, expected).await;
}

#[tokio::test]
async fn union_with_client_member() {
    let input = include_str!("subschema_extraction/fixtures/union_with_client_member.input");
    let expected = include_str!("subschema_extraction/fixtures/union_with_client_member.expected");
    test_fixture(transform_fixture, file!(), "union_with_client_member.input", "subschema_extraction/fixtures/union_with_client_member.expected", input, expected).await;
}

#[tokio::test]
async fn unknown_field_error() {
    let input = include_str!("subschema_extraction/fixtures/unknown_field_error.input");
    let expected = include_str!("subschema_extraction/fixtures/unknown_field_error.expected");
    test_fixture(transform_fixture, file!(), "unknown_field_error.input", "subschema_extraction/fixtures/unknown_field_error.expected", input, expected).await;
}

#[tokio::test]
async fn with_client_extensions() {
    let input = include_str!("subschema_extraction/fixtures/with_client_extensions.input");
    let expected = include_str!("subschema_extraction/fixtures/with_client_extensions.expected");
    test_fixture(transform_fixture, file!(), "with_client_extensions.input", "subschema_extraction/fixtures/with_client_extensions.expected", input, expected).await;
}
