/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::Location;
use common::PerfLogEvent;
use common::SourceLocationKey;
use fnv::FnvHashMap;
use graphql_syntax::SchemaDocument;
use relay_config::ProjectName;
use relay_config::SchemaLocation;
use relay_docblock::extend_schema_with_resolver_type_system_definition;
use relay_docblock::validate_resolver_schema;
use relay_schema::client_implementors::mark_client_implementors;
use schema::SDLSchema;
use schema::SchemaDocuments;
use schema::parse_schema_with_extensions_parallel;
use schema_validate_lib::SchemaValidationOptions;
use schema_validate_lib::validate;

use super::build_resolvers_schema::build_resolver_types_schema_documents;
use super::build_resolvers_schema::extend_schema_with_field_ir;
use super::build_resolvers_schema::extract_docblock_ir;
use crate::GraphQLAsts;
use crate::compiler_state::CompilerState;
use crate::compiler_state::ParsedServerAsts;
use crate::config::Config;
use crate::config::ProjectConfig;

pub fn build_schema(
    compiler_state: &CompilerState,
    config: &Config,
    project_config: &ProjectConfig,
    graphql_asts_map: &FnvHashMap<ProjectName, GraphQLAsts>,
    log_event: &impl PerfLogEvent,
) -> DiagnosticsResult<Arc<SDLSchema>> {
    if let Some(schema) = compiler_state.schema_cache.get(&project_config.name)
        && !compiler_state.project_has_pending_schema_changes(project_config.name)
        && !project_config
            .base
            .is_some_and(|base| compiler_state.project_has_pending_schema_changes(base))
    {
        return Ok(schema.clone());
    }
    build_schema_impl(
        compiler_state,
        project_config,
        log_event,
        config,
        graphql_asts_map,
    )
}

fn build_schema_impl(
    compiler_state: &CompilerState,
    project_config: &ProjectConfig,
    log_event: &impl PerfLogEvent,
    config: &Config,
    graphql_asts_map: &FnvHashMap<ProjectName, GraphQLAsts>,
) -> DiagnosticsResult<Arc<SDLSchema>> {
    if let SchemaLocation::CompactFile(compact_path) = &project_config.schema_location {
        // Load compact schema (has base schema + SDL extensions, but NOT docblock IRs).
        // Compact format deserializes directly into InMemorySchema with parallel decoding.
        let owned_bytes;
        let compact_bytes: &[u8] = if let Some(compact_sources) =
            compiler_state.compact_schemas.get(&project_config.name)
            && let Some(bytes) = compact_sources.get_current_bytes()
        {
            bytes
        } else {
            owned_bytes = config
                .file_system
                .read(compact_path)
                .map_err(|e| vec![Diagnostic::error(e.to_string(), Location::generated())])?;
            &owned_bytes
        };
        let mut schema = log_event.time("deserialize_compact_schema_time", || {
            SDLSchema::InMemory(schema::compact::deserialize_parallel(compact_bytes))
        });

        // Extract docblock IRs
        let resolver_schema_data = log_event.time("collect_resolver_schema_time", || {
            extract_docblock_ir(config, compiler_state, project_config, graphql_asts_map)
        })?;

        // Apply type IRs as mutations
        log_event.time(
            "build_resolver_types_schema_time",
            || -> DiagnosticsResult<()> {
                let type_docs = build_resolver_types_schema_documents(
                    &resolver_schema_data.type_irs,
                    config,
                    project_config,
                );
                for doc in type_docs {
                    let location = doc.location;
                    for def in doc.definitions {
                        extend_schema_with_resolver_type_system_definition(
                            def,
                            &mut schema,
                            location,
                        )?;
                    }
                }
                Ok(())
            },
        )?;

        // Apply field IRs
        log_event.time("extend_schema_with_resolver_fields_time", || {
            extend_schema_with_field_ir(
                resolver_schema_data.field_irs,
                &mut schema,
                config,
                project_config,
            )
        })?;

        return finish_schema(schema, project_config, log_event);
    }

    let extensions = get_extension_sources(compiler_state, project_config);

    // Parse the server and extension schema text. If pre-parsed server ASTs
    // are available in the cache (shared across projects with the same schema
    // source), reuse them and only parse the project-specific extensions.
    let cached_server_asts = schema_location_sdl_path(&project_config.schema_location)
        .and_then(|path| compiler_state.parsed_server_asts_cache.get(path))
        .map(|cached| &cached.documents);
    log_event.number(
        "parse_schema_cache_hit",
        cached_server_asts.is_some() as usize,
    );

    let (server_asts, mut extension_asts) = if let Some(cached) = cached_server_asts {
        log_event.time("parse_schema_extensions_only_time", || {
            parse_extension_documents(&extensions).map(|ext_docs| (Arc::clone(cached), ext_docs))
        })?
    } else {
        log_event.time("parse_schema_time", || {
            let schema_sources = get_schema_sources(compiler_state, project_config);
            parse_schema_with_extensions_parallel(&schema_sources, &extensions).map(|docs| {
                let SchemaDocuments {
                    server,
                    extensions: ext,
                } = docs;
                (Arc::new(server), ext)
            })
        })?
    };

    // Collect Relay Resolver schema IR
    let resolver_schema_data = log_event.time("collect_resolver_schema_time", || {
        extract_docblock_ir(config, compiler_state, project_config, graphql_asts_map)
    })?;

    // Convert resolver schema to AST and append it to extension ASTs
    log_event.time("build_resolver_types_schema_time", || {
        extension_asts.extend(build_resolver_types_schema_documents(
            &resolver_schema_data.type_irs,
            config,
            project_config,
        ));
    });

    // Now that all the named types have been collected, we can build
    // the normalized schema. All names should be able to be resolved.
    let mut schema = log_event.time("build_schema_time", || {
        relay_schema::build_schema_with_extensions_from_asts(&server_asts, extension_asts)
    })?;

    // Now that the normalized schema has been built we can add fields to existing types by name.
    log_event.time("extend_schema_with_resolver_fields_time", || {
        extend_schema_with_field_ir(
            resolver_schema_data.field_irs,
            &mut schema,
            config,
            project_config,
        )
    })?;

    finish_schema(schema, project_config, log_event)
}

/// Now that the schema includes every client type and Relay Resolver field:
/// records the client-defined implementors of the server interfaces and unions
/// the project enables, so later passes read them from the schema; applies the
/// resolver and schema validations; and builds the root field lookup.
fn finish_schema(
    mut schema: SDLSchema,
    project_config: &ProjectConfig,
    log_event: &impl PerfLogEvent,
) -> DiagnosticsResult<Arc<SDLSchema>> {
    let timer = log_event.start("mark_client_implementors_time");
    let marked = mark_client_implementors(
        &mut schema,
        &project_config
            .feature_flags
            .enable_client_implementors_of_server_abstract_types,
    );
    log_event.stop(timer);
    marked?;

    log_event.time("validate_resolver_schema_time", || {
        validate_resolver_schema(
            &schema,
            &project_config.feature_flags,
            project_config.schema_config.node_interface_id_field,
        )
    })?;

    log_event.time("validate_composite_schema_time", || {
        maybe_validate_schema(project_config, &schema)
    })?;

    finalize_root_field_lookup(&mut schema);
    Ok(Arc::new(schema))
}

/// Builds the root operation type field lookup used by `named_field`. Only
/// in-memory schemas have one.
fn finalize_root_field_lookup(schema: &mut SDLSchema) {
    if let SDLSchema::InMemory(in_memory_schema) = schema {
        in_memory_schema.finalize_root_field_lookup();
    }
}

/// Returns the SDL schema path for File/Directory schema locations,
/// or None for CompactFile schemas (which use a different code path).
fn schema_location_sdl_path(location: &SchemaLocation) -> Option<&Path> {
    match location {
        SchemaLocation::File(path) | SchemaLocation::Directory(path) => Some(path),
        SchemaLocation::CompactFile(_) => None,
    }
}

/// Parse extension SDL documents independently of server schema.
fn parse_extension_documents(
    extension_sdls: &[(&String, SourceLocationKey)],
) -> DiagnosticsResult<Vec<SchemaDocument>> {
    extension_sdls
        .iter()
        .map(|(sdl, location_key)| {
            graphql_syntax::parse_schema_document(sdl.as_str(), *location_key)
        })
        .collect::<DiagnosticsResult<Vec<_>>>()
}

/// Pre-parse unique server schemas shared by multiple projects.
///
/// Groups enabled projects by their SDL schema location path and parses each
/// unique schema source once. Returns a cache mapping schema paths to their
/// parsed server ASTs, which can be shared across projects during the parallel
/// build loop.
pub(crate) fn preparse_unique_server_schemas(
    config: &Config,
    compiler_state: &CompilerState,
) -> FnvHashMap<PathBuf, ParsedServerAsts> {
    // Group enabled SDL projects by schema location path.
    let mut schema_groups: FnvHashMap<&Path, Vec<&ProjectConfig>> = FnvHashMap::default();
    for project_config in config.enabled_projects() {
        if let Some(path) = schema_location_sdl_path(&project_config.schema_location) {
            // Only include projects that will actually rebuild their schema
            let needs_rebuild = !compiler_state
                .schema_cache
                .contains_key(&project_config.name)
                || compiler_state.project_has_pending_schema_changes(project_config.name)
                || project_config
                    .base
                    .is_some_and(|base| compiler_state.project_has_pending_schema_changes(base));
            if needs_rebuild {
                schema_groups.entry(path).or_default().push(project_config);
            }
        }
    }

    // Note: kept sequential (not par_iter). `parse_schema_with_extensions_parallel`
    // already saturates the rayon thread pool internally; nesting an outer
    // par_iter shares the same pool and gives no measurable wall improvement
    // (verified: 5-round bench, ~1075ms with or without outer par_iter).
    let no_extensions: Vec<(&str, SourceLocationKey)> = Vec::new();
    schema_groups
        .into_iter()
        .filter(|(_, projects)| projects.len() > 1)
        .filter_map(|(path, projects)| {
            let schema_sources = get_schema_sources(compiler_state, projects[0]);
            // Parse server schema only (empty extensions). On failure, skip
            // caching — each project will parse individually and surface errors
            // through the normal per-project error path.
            parse_schema_with_extensions_parallel(&schema_sources, &no_extensions)
                .ok()
                .map(|docs| {
                    (
                        path.to_path_buf(),
                        ParsedServerAsts {
                            source_project: projects[0].name,
                            documents: Arc::new(docs.server),
                        },
                    )
                })
        })
        .collect()
}

fn get_schema_sources<'a>(
    compiler_state: &'a CompilerState,
    project_config: &'a ProjectConfig,
) -> Vec<(&'a str, SourceLocationKey)> {
    match compiler_state.schemas.get(&project_config.name) {
        Some(sources) => sources
            .get_sources_with_location()
            .into_iter()
            .map(|(schema, location_key)| (schema.as_str(), location_key))
            .collect(),
        None => vec![],
    }
}

fn get_extension_sources<'a>(
    compiler_state: &'a CompilerState,
    project_config: &'a ProjectConfig,
) -> Vec<(&'a String, SourceLocationKey)> {
    let mut extensions = vec![];
    if let Some(project_extensions) = compiler_state.extensions.get(&project_config.name) {
        extensions.extend(project_extensions.get_sources_with_location());
    }
    if let Some(base_project_name) = project_config.base
        && let Some(base_project_extensions) = compiler_state.extensions.get(&base_project_name)
    {
        extensions.extend(base_project_extensions.get_sources_with_location());
    }
    extensions
}

fn maybe_validate_schema(
    project_config: &ProjectConfig,
    schema: &SDLSchema,
) -> DiagnosticsResult<()> {
    let disable_schema_validation = &project_config.feature_flags.disable_schema_validation;
    if disable_schema_validation.is_fully_enabled() {
        return Ok(());
    }

    validate(
        schema,
        SchemaValidationOptions {
            allow_introspection_names: true,
            exempt_coordinates: disable_schema_validation,
        },
    )
}

#[cfg(test)]
mod tests {
    use common::SourceLocationKey;
    use schema::Schema;

    use super::*;

    /// Cache path (separate server + extension parse) must produce a schema
    /// equivalent to the non-cache path (combined parse). This is the
    /// correctness invariant the optimization relies on.
    #[test]
    fn test_cached_server_asts_produce_same_schema() {
        let server_sdl = "type Query { hello: String }";
        let extension_sdl = "extend type Query { world: String }".to_string();
        let loc = SourceLocationKey::generated();

        let combined =
            parse_schema_with_extensions_parallel(&[(server_sdl, loc)], &[(&extension_sdl, loc)])
                .unwrap();
        let schema_normal = relay_schema::build_schema_with_extensions_from_asts(
            &combined.server,
            combined.extensions,
        )
        .unwrap();

        let server_only = parse_schema_with_extensions_parallel(
            &[(server_sdl, loc)],
            &Vec::<(&str, SourceLocationKey)>::new(),
        )
        .unwrap();
        let ext_docs = parse_extension_documents(&[(&extension_sdl, loc)]).unwrap();
        let schema_cached =
            relay_schema::build_schema_with_extensions_from_asts(&server_only.server, ext_docs)
                .unwrap();

        let query = intern::intern!("Query");
        let Some(schema::Type::Object(id_normal)) = schema_normal.get_type(query) else {
            panic!("Query should be an Object type in normal schema");
        };
        let Some(schema::Type::Object(id_cached)) = schema_cached.get_type(query) else {
            panic!("Query should be an Object type in cached schema");
        };
        assert_eq!(
            schema_normal.object(id_normal).fields.len(),
            schema_cached.object(id_cached).fields.len(),
            "cache path should produce schema with same Query field count as combined parse",
        );
    }
}
