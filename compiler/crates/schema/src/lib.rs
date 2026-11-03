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

pub mod compact;
pub mod definitions;
mod errors;
mod field_descriptions;
mod flatbuffer;
mod graphql_schema;
mod in_memory;
mod schema;
pub mod suggestion_list;
use std::borrow::Cow;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::Location;
use common::SourceLocationKey;
use common::sync::IntoParallelIterator;
use common::sync::ParallelIterator;
pub use definitions::Argument;
pub use definitions::ArgumentDefinitions;
pub use definitions::ArgumentValue;
pub use definitions::Directive;
pub use definitions::DirectiveValue;
pub use definitions::Enum;
pub use definitions::EnumID;
pub use definitions::EnumValue;
pub use definitions::Field;
pub use definitions::FieldID;
pub use definitions::InputObject;
pub use definitions::InputObjectID;
pub use definitions::Interface;
pub use definitions::InterfaceID;
pub use definitions::Object;
pub use definitions::ObjectID;
pub use definitions::Scalar;
pub use definitions::ScalarID;
pub use definitions::Type;
pub use definitions::TypeReference;
pub use definitions::TypeWithFields;
pub use definitions::Union;
pub use definitions::UnionID;
pub use errors::Result;
pub use errors::SchemaError;
use flatbuffer::FlatBufferSchema;
pub use flatbuffer::SchemaWrapper;
pub use graphql_schema::Schema;
pub use graphql_syntax::DirectiveLocation;
use graphql_syntax::SchemaDocument;
pub use graphql_syntax::TypeSystemDefinition;
pub use in_memory::InMemorySchema;
use rayon::iter::IntoParallelRefIterator;

pub use crate::schema::SDLSchema;

const BUILTINS: &str = include_str!("./builtins.graphql");

pub use flatbuffer::serialize_as_flatbuffer;

pub fn build_schema(sdl: &str) -> DiagnosticsResult<SDLSchema> {
    build_schema_with_extensions_parallel::<_, &str>(&[(sdl, SourceLocationKey::generated())], &[])
}

pub struct SchemaDocuments {
    pub server: Vec<SchemaDocument>,
    pub extensions: Vec<SchemaDocument>,
}

pub fn build_schema_with_extensions_parallel<
    T: AsRef<str> + std::marker::Sync,
    U: AsRef<str> + std::marker::Sync,
>(
    server_sdls: &[(T, SourceLocationKey)],
    extension_sdls: &[(U, SourceLocationKey)],
) -> DiagnosticsResult<SDLSchema> {
    let SchemaDocuments { server, extensions } =
        parse_schema_with_extensions_parallel(server_sdls, extension_sdls)?;
    SDLSchema::build(&server, &extensions)
}

pub fn parse_schema_with_extensions_parallel<
    T: AsRef<str> + std::marker::Sync,
    U: AsRef<str> + std::marker::Sync,
>(
    server_sdls: &[(T, SourceLocationKey)],
    extension_sdls: &[(U, SourceLocationKey)],
) -> DiagnosticsResult<SchemaDocuments> {
    let merged_server_sdls = match server_sdls {
        [(sdl, location)] => vec![(Cow::Borrowed(sdl.as_ref()), *location)],
        _ => {
            // When the schema is split across multiple files, the individual
            // files may not be syntactically complete, so we join them together
            // before parsing.

            // Note that this requires us to use a generates source location key which
            // means click to definition for schema files will not work.
            let mut chunks = vec![];
            let mut buffer = String::new();
            for (sdl, source_location) in server_sdls {
                // Accumulate the document until it ends with a `}` to form
                // a valid schema document
                if ends_with_right_curly_brace(sdl) {
                    if buffer.is_empty() {
                        chunks.push((Cow::Borrowed(sdl.as_ref()), *source_location));
                    } else {
                        buffer.push_str(sdl.as_ref());
                        chunks.push((
                            Cow::Owned(std::mem::take(&mut buffer)),
                            SourceLocationKey::Generated,
                        ));
                    }
                } else {
                    buffer.push_str(sdl.as_ref());
                    buffer.push('\n');
                }
            }
            if !buffer.is_empty() {
                let all_files = server_sdls
                    .iter()
                    .enumerate()
                    .map(|(i, (_, loc))| format!("  {}: {}", i + 1, loc.path()))
                    .collect::<Vec<_>>()
                    .join("\n");
                return Err(vec![Diagnostic::error(
                    errors::SchemaError::IncompleteSchemaDocument { all_files },
                    Location::generated(),
                )]);
            }
            chunks
        }
    };
    let result = rayon::join(
        || {
            merged_server_sdls
                .into_par_iter()
                .map(|(sdl, source_location)| {
                    graphql_syntax::parse_schema_document(sdl.as_ref(), source_location)
                })
                .collect::<DiagnosticsResult<Vec<_>>>()
        },
        || {
            extension_sdls
                .par_iter()
                .map(|(extension_sdl, location_key)| {
                    graphql_syntax::parse_schema_document(extension_sdl.as_ref(), *location_key)
                })
                .collect::<DiagnosticsResult<Vec<_>>>()
        },
    );

    let mut server_documents: Vec<SchemaDocument> = vec![builtins()?];
    server_documents.extend(result.0?);
    let client_schema_documents = result.1?;

    Ok(SchemaDocuments {
        server: server_documents,
        extensions: client_schema_documents,
    })
}

pub fn build_schema_with_flat_buffer(bytes: Vec<u8>) -> SDLSchema {
    SDLSchema::FlatBuffer(Box::new(SchemaWrapper::from_vec(bytes)))
}

pub fn build_schema_with_flat_buffer_unchecked(bytes: Vec<u8>) -> SDLSchema {
    SDLSchema::FlatBuffer(Box::new(SchemaWrapper::from_vec_unchecked(bytes)))
}

pub fn build_schema_from_flat_buffer(bytes: &[u8]) -> DiagnosticsResult<FlatBufferSchema<'_>> {
    Ok(FlatBufferSchema::build(bytes))
}

pub fn builtins() -> DiagnosticsResult<SchemaDocument> {
    graphql_syntax::parse_schema_document(BUILTINS, SourceLocationKey::generated())
}

/// Whether `text` ends with `}` (ignoring trailing whitespace). A server schema
/// split across files is parsed in chunks that end at such a file.
pub fn ends_with_right_curly_brace<T: AsRef<str>>(text: T) -> bool {
    for char in text.as_ref().chars().rev() {
        if char == '}' {
            return true;
        }
        if !char.is_whitespace() {
            return false;
        }
    }
    false
}
