/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<6f473153a28aec22f4cb2c6443cda473>>
 */

mod validate_no_double_underscore_alias;

use validate_no_double_underscore_alias::transform_fixture;
use fixture_tests::test_fixture;

#[tokio::test]
async fn double_underscore_invalid() {
    let input = include_str!("validate_no_double_underscore_alias/fixtures/double_underscore.invalid.graphql");
    let expected = include_str!("validate_no_double_underscore_alias/fixtures/double_underscore.invalid.expected");
    test_fixture(transform_fixture, file!(), "double_underscore.invalid.graphql", "validate_no_double_underscore_alias/fixtures/double_underscore.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn fragment_alias_invalid() {
    let input = include_str!("validate_no_double_underscore_alias/fixtures/fragment_alias.invalid.graphql");
    let expected = include_str!("validate_no_double_underscore_alias/fixtures/fragment_alias.invalid.expected");
    test_fixture(transform_fixture, file!(), "fragment_alias.invalid.graphql", "validate_no_double_underscore_alias/fixtures/fragment_alias.invalid.expected", input, expected).await;
}

#[tokio::test]
async fn non_alias() {
    let input = include_str!("validate_no_double_underscore_alias/fixtures/non_alias.graphql");
    let expected = include_str!("validate_no_double_underscore_alias/fixtures/non_alias.expected");
    test_fixture(transform_fixture, file!(), "non_alias.graphql", "validate_no_double_underscore_alias/fixtures/non_alias.expected", input, expected).await;
}
