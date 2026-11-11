/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<26beb83b95069bf750eaf3ef4a5fb66f>>
 */

mod validate_global_variable_names;

use validate_global_variable_names::transform_fixture;

fixture_tests::fixture_tests!("validate_global_variable_names");
