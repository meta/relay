/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<2b4d905511dfd08364ef968a1236bccd>>
 */

mod validate_unused_variables;

use validate_unused_variables::transform_fixture;
use fixture_tests::test_fixture;

#[tokio::test]
async fn cycles_read_from_different_entrypoints() {
    let input = include_str!("validate_unused_variables/fixtures/cycles-read-from-different-entrypoints.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/cycles-read-from-different-entrypoints.expected");
    test_fixture(transform_fixture, file!(), "cycles-read-from-different-entrypoints.graphql", "validate_unused_variables/fixtures/cycles-read-from-different-entrypoints.expected", input, expected).await;
}

#[tokio::test]
async fn fragment_with_root_arguments() {
    let input = include_str!("validate_unused_variables/fixtures/fragment-with-root-arguments.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/fragment-with-root-arguments.expected");
    test_fixture(transform_fixture, file!(), "fragment-with-root-arguments.graphql", "validate_unused_variables/fixtures/fragment-with-root-arguments.expected", input, expected).await;
}

#[tokio::test]
async fn practically_unused_but_actually_used_variables() {
    let input = include_str!("validate_unused_variables/fixtures/practically-unused-but-actually-used-variables.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/practically-unused-but-actually-used-variables.expected");
    test_fixture(transform_fixture, file!(), "practically-unused-but-actually-used-variables.graphql", "validate_unused_variables/fixtures/practically-unused-but-actually-used-variables.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_invalid_error_suppression() {
    let input = include_str!("validate_unused_variables/fixtures/query-with-invalid-error-suppression.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/query-with-invalid-error-suppression.expected");
    test_fixture(transform_fixture, file!(), "query-with-invalid-error-suppression.graphql", "validate_unused_variables/fixtures/query-with-invalid-error-suppression.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_unused_root_variable_shadowed_by_local_invalid() {
    let input = include_str!("validate_unused_variables/fixtures/query-with-unused-root-variable-shadowed-by-local.invalid.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/query-with-unused-root-variable-shadowed-by-local.invalid.expected");
    test_fixture(transform_fixture, file!(), "query-with-unused-root-variable-shadowed-by-local.invalid.graphql", "validate_unused_variables/fixtures/query-with-unused-root-variable-shadowed-by-local.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_unused_variable_error_suppressed() {
    let input = include_str!("validate_unused_variables/fixtures/query-with-unused-variable-error-suppressed.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/query-with-unused-variable-error-suppressed.expected");
    test_fixture(transform_fixture, file!(), "query-with-unused-variable-error-suppressed.graphql", "validate_unused_variables/fixtures/query-with-unused-variable-error-suppressed.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_unused_variable_invalid() {
    let input = include_str!("validate_unused_variables/fixtures/query-with-unused-variable.invalid.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/query-with-unused-variable.invalid.expected");
    test_fixture(transform_fixture, file!(), "query-with-unused-variable.invalid.graphql", "validate_unused_variables/fixtures/query-with-unused-variable.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn query_with_variables_shadowed_by_local_variable_and_used_as_root_variable() {
    let input = include_str!("validate_unused_variables/fixtures/query-with-variables-shadowed-by-local-variable-and-used-as-root-variable.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/query-with-variables-shadowed-by-local-variable-and-used-as-root-variable.expected");
    test_fixture(transform_fixture, file!(), "query-with-variables-shadowed-by-local-variable-and-used-as-root-variable.graphql", "validate_unused_variables/fixtures/query-with-variables-shadowed-by-local-variable-and-used-as-root-variable.expected", input, expected).await;
}

#[tokio::test]
async fn variable_in_fragment_argument_object() {
    let input = include_str!("validate_unused_variables/fixtures/variable-in-fragment-argument-object.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/variable-in-fragment-argument-object.expected");
    test_fixture(transform_fixture, file!(), "variable-in-fragment-argument-object.graphql", "validate_unused_variables/fixtures/variable-in-fragment-argument-object.expected", input, expected).await;
}

#[tokio::test]
async fn variable_in_the_complex_object_list() {
    let input = include_str!("validate_unused_variables/fixtures/variable-in-the-complex-object-list.graphql");
    let expected = include_str!("validate_unused_variables/fixtures/variable-in-the-complex-object-list.expected");
    test_fixture(transform_fixture, file!(), "variable-in-the-complex-object-list.graphql", "validate_unused_variables/fixtures/variable-in-the-complex-object-list.expected", input, expected).await;
}
