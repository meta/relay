/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::transform_project_fixture;

fn generated_artifact<'a>(output: &'a str, path: &str) -> &'a str {
    let marker = format!("//-++ {path}");
    let start = output
        .find(&marker)
        .unwrap_or_else(|| panic!("missing generated artifact `{path}` in:\n{output}"));
    let artifact = &output[start + marker.len()..];
    let end = artifact
        .find("\n//-++ ")
        .or_else(|| artifact.find("\n\nArtifact Map:"))
        .unwrap_or(artifact.len());
    &artifact[..end]
}

#[tokio::test]
async fn client_rsc_resolver_unsupported() {
    let input = include_str!("rsc_fixtures/client_rsc_resolver_unsupported.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the compiler diagnostic should be rendered");
    assert!(output.contains(
        "A `RelayRscValue` field may only be selected by an explicitly `@server` document"
    ));
}

#[tokio::test]
async fn server_rsc_resolver_projection() {
    let input = include_str!("rsc_fixtures/server_rsc_resolver_projection.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the Relay RSC fixture should compile");

    for expected in [
        "\"name\": \"rsc$",
        "\"handle\": \"rsc\"",
        "\"definitionID\":",
        "\"componentArgumentNames\": [",
        "\"tone\"",
        "\"rscIdentityArgs\":",
        "\"clientNormalization\": ServerRscResolverProjectionQuery$clientNormalization_graphql",
    ] {
        assert!(
            output.contains(expected),
            "missing `{expected}` in:\n{output}"
        );
    }
    assert!(!output.contains("\"kind\": \"RelayResolver\""));

    let client_normalization = generated_artifact(
        &output,
        "src/__generated__/ServerRscResolverProjectionQuery$clientNormalization.graphql.js",
    );
    let compact_client_normalization: String = client_normalization
        .chars()
        .filter(|char| !char.is_whitespace())
        .collect();
    assert!(compact_client_normalization.contains(
        "varv0=[{\"kind\":\"Literal\",\"name\":\"size\",\"value\":64},{\"kind\":\"Literal\",\"name\":\"tone\",\"value\":\"quiet\"}]"
    ));
    assert_eq!(
        compact_client_normalization
            .matches("(v0/*::asany*/)")
            .count(),
        3
    );
    assert!(client_normalization.contains("\"kind\": \"ClientExtension\""));
    assert!(client_normalization.contains("\"kind\": \"ScalarField\""));
    assert!(client_normalization.contains("\"kind\": \"ScalarHandle\""));
    assert!(!client_normalization.contains("\"kind\": \"FragmentSpread\""));
    assert!(!client_normalization.contains("\"kind\": \"ModuleImport\""));
    assert!(!client_normalization.contains("\"serverFragment\""));

    let request = generated_artifact(
        &output,
        "src/__generated__/ServerRscResolverProjectionQuery.graphql.js",
    );
    let compact_request: String = request
        .chars()
        .filter(|char| !char.is_whitespace())
        .collect();
    assert!(compact_request.contains("\"name\":\"size\",\"value\":64"));
    assert!(compact_request.contains("\"name\":\"tone\",\"value\":\"quiet\""));
    assert!(
        compact_request.contains(
            "\"rscRenderID\":\"rsc-render:v2:16:NoArgsPanel_user:15:src/NoArgsPanel:11:NoArgsPanel\""
        ),
        "{request}"
    );
    assert!(
        !compact_request
            .contains("\"alias\":\"panel\",\"args\":null,\"kind\":\"ScalarField\",\"name\":\"rsc$")
    );
    assert_eq!(
        compact_request
            .matches("\"args\":null,\"fragment\":")
            .count(),
        1
    );
    assert_eq!(
        compact_request.matches("\"rscIdentityArgs\":null").count(),
        1
    );
}

#[tokio::test]
async fn server_rsc_resolver_feature_disabled() {
    let input = include_str!("rsc_fixtures/server_rsc_resolver_feature_disabled.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the compiler diagnostic should be rendered");
    assert!(output.contains(
        "Relay Resolver-authored RSC field `rscPanel` requires the `enable_relay_rsc` feature flag"
    ));
}

#[tokio::test]
async fn rsc_component_export_collision() {
    let input = include_str!("rsc_fixtures/rsc_component_export_collision.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the compiler diagnostic should be rendered");
    assert!(
        output.contains("both map to the component export `RscPanel`"),
        "two RSC fields that name one component export must be rejected:\n{output}"
    );
}

#[tokio::test]
async fn server_rsc_resolver_incremental_unsupported() {
    let input = include_str!("rsc_fixtures/server_rsc_resolver_incremental_unsupported.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the compiler diagnostic should be rendered");
    assert!(
        output.contains(
            "Relay RSC operation `ServerRscResolverIncrementalQuery` cannot use `@defer` or `@stream`"
        ),
        "@defer inside an RSC Resolver root fragment must be rejected:\n{output}"
    );
}

#[tokio::test]
async fn server_rsc_resolver_signature_flow() {
    let input = include_str!("rsc_fixtures/server_rsc_resolver_signature_flow.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the Relay RSC signature fixture should compile");

    for expected in [
        "RscPanel_user$RscPanel$rscResolverSignature.graphql.js",
        "@relayRscResolverSignature",
        "import typeof {RscPanel as __RelayRscComponent} from \"../RscPanel\";",
        "import type { RscPanel_user$key } from \"./RscPanel_user.graphql\";",
        "=> React$Node | Promise<React$Node>;",
        "export type __RelayRscResolverSignature",
    ] {
        assert!(
            output.contains(expected),
            "missing `{expected}` in:\n{output}"
        );
    }
    assert!(
        !output.contains("ReactNode"),
        "Flow output must not import `ReactNode`, which React's Flow types do not export:\n{output}"
    );
}

#[tokio::test]
async fn server_rsc_resolver_signature_typescript() {
    let input = include_str!("rsc_fixtures/server_rsc_resolver_signature_typescript.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the Relay RSC signature fixture should compile");

    for expected in [
        "RscPanel_user$RscPanel$rscResolverSignature.graphql.ts",
        "@relayRscResolverSignature",
        "type __RelayRscComponent = typeof import(\"../RscPanel\")[\"RscPanel\"];",
        "import { RscPanel_user$key } from \"./RscPanel_user.graphql\";",
        "import { ReactNode } from \"react\";",
        "type __RelayRscExpectedArgs = Record<never, never>;",
        "export type __RelayRscResolverSignature",
    ] {
        assert!(
            output.contains(expected),
            "missing `{expected}` in:\n{output}"
        );
    }
}

#[tokio::test]
async fn rsc_component_export_collision_unselected() {
    let input = include_str!("rsc_fixtures/rsc_component_export_collision_unselected.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the compiler diagnostic should be rendered");
    assert!(
        output.contains("both map to the component export `RscPanel`"),
        "a colliding field must be rejected even when nothing selects it:\n{output}"
    );
}

#[tokio::test]
async fn rsc_signature_artifact_collision() {
    let input = include_str!("rsc_fixtures/rsc_signature_artifact_collision.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the compiler diagnostic should be rendered");
    assert!(
        output.contains("both map to the component export `RscPanel`"),
        "two Resolvers must not silently share one signature artifact:\n{output}"
    );
    assert!(
        !output.contains("$rscResolverSignature.graphql.js"),
        "{output}"
    );
}

#[tokio::test]
async fn rsc_interface_field_selected_on_implementor() {
    let input = include_str!("rsc_fixtures/rsc_interface_field_selected_on_implementor.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("one interface field selected through an implementor should compile");
    assert!(
        !output.contains("both map to the component export"),
        "{output}"
    );
    assert!(!output.contains('✖'), "{output}");
}

#[tokio::test]
async fn rsc_fragment_prop_name_uses_first_underscore() {
    let input = include_str!("rsc_fixtures/rsc_fragment_prop_name.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the fixture should compile");
    assert!(
        output.contains("\"fragmentPropName\": \"user_profile\""),
        "`RscPanel_user_profile` follows the `@module` rule:\n{output}"
    );
}

#[tokio::test]
async fn rsc_reserved_prop_name() {
    let input = include_str!("rsc_fixtures/rsc_reserved_prop_name.input");
    let project = graphql_test_helpers::ProjectFixture::deserialize(input);
    let output = transform_project_fixture(&project)
        .await
        .expect("the compiler diagnostic should be rendered");
    assert!(
        output.contains("derives the reserved component prop name `key`"),
        "{output}"
    );
}
