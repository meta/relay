/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;

use common::FeatureFlag;
use fixture_tests::Fixture;
use graphql_ir::reexport::Intern;
use graphql_ir::reexport::StringKey;
use itertools::Itertools;
use relay_lsp::type_information::print_type;
use relay_schema::client_implementors::mark_client_implementors;
use relay_test_schema::get_test_schema_with_extensions;
use serde::Deserialize;
use serde::Serialize;

#[derive(Serialize, Deserialize, Debug)]
struct TestSettings {
    type_name: StringKey,
    string_filter: Option<String>,
}

pub async fn transform_fixture(_fixture: &Fixture<'_>) -> Result<String, String> {
    let settings: TestSettings = serde_json::from_str(_fixture.content).unwrap();

    let lots_of_fields = (0..1000)
        .map(|i| format!("  field{}: String\n", i))
        .join("");

    let schema = get_test_schema_with_extensions(&format!(
        r"
type MassiveType {{
{lots_of_fields}
}}

type ClientNamed implements Named {{
  name: String
}}
"
    ));
    // The server interface `Named` lists its client-defined implementor.
    let mut schema = Arc::try_unwrap(schema).expect("Expected a schema no one else holds");
    mark_client_implementors(
        &mut schema,
        &FeatureFlag::Limited {
            allowlist: ["Named".intern()].into_iter().collect(),
        },
    )
    .unwrap();
    let schema = Arc::new(schema);

    let type_ = *schema
        .get_type_map()
        .find_map(|(&name, type_)| (name == settings.type_name).then_some(type_))
        .unwrap();

    Ok(print_type(&schema, type_, settings.string_filter))
}
