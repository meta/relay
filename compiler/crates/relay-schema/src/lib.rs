/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! This crate contains a GraphQL schema representation.

#![deny(warnings)]
#![deny(rust_2018_idioms)]
#![deny(clippy::all)]

pub mod client_implementors;
pub mod definitions;
use std::iter::once;
use std::sync::LazyLock;

use ::intern::string_key::StringKey;
use common::ArgumentName;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::SourceLocationKey;
use graphql_syntax::SchemaDocument;
use intern::intern;
use schema::ArgumentDefinitions;
use schema::SDLSchema;
use schema::TypeReference;

const RELAY_EXTENSIONS: &str = include_str!("./relay-extensions.graphql");

static DEFER: LazyLock<DirectiveName> = LazyLock::new(|| DirectiveName(intern!("defer")));
static STREAM: LazyLock<DirectiveName> = LazyLock::new(|| DirectiveName(intern!("stream")));
static LABEL: LazyLock<ArgumentName> = LazyLock::new(|| ArgumentName(intern!("label")));
pub static CUSTOM_SCALAR_DIRECTIVE_NAME: LazyLock<StringKey> =
    LazyLock::new(|| intern!("__RelayCustomScalar"));
pub static PATH_CUSTOM_SCALAR_ARGUMENT_NAME: LazyLock<StringKey> =
    LazyLock::new(|| intern!("path"));
pub static EXPORT_NAME_CUSTOM_SCALAR_ARGUMENT_NAME: LazyLock<StringKey> =
    LazyLock::new(|| intern!("export_name"));

pub fn build_schema_with_extensions_parallel<
    T: AsRef<str> + std::marker::Sync,
    U: AsRef<str> + std::marker::Sync,
>(
    server_sdls: &[(T, SourceLocationKey)],
    extension_sdls: &[(U, SourceLocationKey)],
) -> DiagnosticsResult<SDLSchema> {
    let extensions: Vec<(&str, SourceLocationKey)> =
        once((RELAY_EXTENSIONS, SourceLocationKey::generated()))
            .chain(
                extension_sdls
                    .iter()
                    .map(|(source, location_key)| (source.as_ref(), *location_key)),
            )
            .collect();

    let mut schema = schema::build_schema_with_extensions_parallel(server_sdls, &extensions)?;
    remove_defer_stream_label(&mut schema);
    Ok(schema)
}

pub fn build_schema_with_extensions_from_asts(
    server_sdls: &[SchemaDocument],
    mut extension_sdls: Vec<SchemaDocument>,
) -> DiagnosticsResult<SDLSchema> {
    let relay_extensions_ast =
        graphql_syntax::parse_schema_document(RELAY_EXTENSIONS, SourceLocationKey::generated())?;

    extension_sdls.push(relay_extensions_ast);

    let mut schema = SDLSchema::build(server_sdls, &extension_sdls)?;
    remove_defer_stream_label(&mut schema);
    Ok(schema)
}

/// Remove label arg from @defer and @stream directives since the compiler
/// adds these arguments.
fn remove_defer_stream_label(schema: &mut SDLSchema) {
    for directive_name in &[*DEFER, *STREAM] {
        if let Some(directive) = schema.get_directive_mut(*directive_name) {
            let mut next_args: Vec<_> = directive.arguments.iter().cloned().collect();
            for arg in next_args.iter_mut() {
                if arg.name.item == *LABEL
                    && let TypeReference::NonNull(of) = &arg.type_
                {
                    arg.type_ = *of.clone()
                };
            }
            directive.arguments = ArgumentDefinitions::new(next_args);
        }
    }
}
