/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! The `compiler_state` module manages the state of the Relay compiler.
//!
//! This module provides a way to manage the state of the Relay compiler, including the current project,
//! schema, and other configuration options. It also provides methods for updating the state and
//! generating artifacts.
use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::env;
use std::fmt;
use std::fmt::Write;
use std::fs::File as FsFile;
use std::hash::Hash;
use std::io::BufReader;
use std::io::BufWriter;
use std::io::Read;
use std::io::Seek;
use std::io::Write as IoWrite;
use std::path::MAIN_SEPARATOR;
use std::path::Path;
use std::path::PathBuf;
use std::slice;
use std::sync::Arc;
use std::sync::RwLock;
use std::vec;

use common::PerfLogEvent;
use common::PerfLogger;
use common::SourceLocationKey;
use dashmap::DashSet;
use fnv::FnvBuildHasher;
use fnv::FnvHashMap;
use fnv::FnvHashSet;
use log::debug;
use rayon::prelude::*;
use relay_config::ProjectConfig;
use relay_config::ProjectName;
use schema::SDLSchema;
use schema::ends_with_right_curly_brace;
use schema_diff::check::SchemaChangeSafety;
use schema_diff::definitions::SchemaChange;
use schema_diff::detect_changes;
use schema_diff::detect_changes_from_schemas;
use schema_diff::try_detect_changes_per_document;
use schemars::JsonSchema;
use serde::Deserialize;
use serde::Serialize;
use zstd::stream::read::Decoder as ZstdDecoder;
use zstd::stream::write::Encoder as ZstdEncoder;

use crate::artifact_map::ArtifactMap;
use crate::artifact_map::ArtifactSourceKey;
use crate::config::Config;
use crate::errors::Error;
use crate::errors::Result;
use crate::file_source::Clock;
use crate::file_source::File;
use crate::file_source::FileGroup;
use crate::file_source::FileSourceResult;
use crate::file_source::LocatedDocblockSource;
use crate::file_source::LocatedGraphQLSource;
use crate::file_source::LocatedJavascriptSourceFeatures;
use crate::file_source::SourceControlUpdateStatus;
use crate::file_source::categorize_files;
use crate::file_source::extract_javascript_features_from_file;
use crate::file_source::read_file_to_bytes;
use crate::file_source::read_file_to_string;

/// Set of project names.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, JsonSchema)]
#[serde(from = "DeserializableProjectSet")]
pub struct ProjectSet(Vec<ProjectName>);

impl ProjectSet {
    pub fn new(names: Vec<ProjectName>) -> Self {
        if names.is_empty() {
            panic!("Expected project set to have at least one project.")
        }
        ProjectSet(names)
    }
    pub fn of(name: ProjectName) -> Self {
        ProjectSet(vec![name])
    }
    /// Inserts a new project name into this set.
    pub fn insert(&mut self, project_name: ProjectName) {
        let existing_names = &mut self.0;
        assert!(!existing_names.contains(&project_name));
        existing_names.push(project_name);
    }

    pub fn extend_iter(&mut self, other: impl Iterator<Item = ProjectName>) {
        self.0.extend(other);
    }

    pub fn iter(&self) -> slice::Iter<'_, ProjectName> {
        self.0.iter()
    }

    pub fn has_multiple_projects(&self) -> bool {
        self.0.len() > 1
    }

    pub fn first(&self) -> Option<&ProjectName> {
        self.0.first()
    }

    pub fn sort(&mut self) {
        self.0.sort();
    }
}

impl IntoIterator for ProjectSet {
    type Item = ProjectName;
    type IntoIter = vec::IntoIter<ProjectName>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}

impl fmt::Display for ProjectSet {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let names = self
            .0
            .iter()
            .map(|name| name.to_string())
            .collect::<Vec<String>>()
            .join(",");

        write!(f, "{names}")
    }
}

// Serde has the built in ability for deserializing enums that might be in
// different shapes. In this case a `Vec<StringKey>` or `StringKey`. However, we
// want our actual `ProjectSet` object to be modeled as a single Vec internally.
// So, we provide this enum to use sede's polymorphic deserialization and then
// tell `ProjectSet` to deserialize via this enum using `From`.
#[derive(Deserialize, Debug, JsonSchema)]
#[serde(untagged)]
pub enum DeserializableProjectSet {
    ProjectName(ProjectName),
    ProjectNames(Vec<ProjectName>),
}

impl From<DeserializableProjectSet> for ProjectSet {
    fn from(legacy: DeserializableProjectSet) -> Self {
        match legacy {
            DeserializableProjectSet::ProjectName(name) => ProjectSet::of(name),
            DeserializableProjectSet::ProjectNames(names) => ProjectSet::new(names),
        }
    }
}

pub trait Source {
    fn is_empty(&self) -> bool;
}

impl Source for Vec<LocatedGraphQLSource> {
    fn is_empty(&self) -> bool {
        self.is_empty()
    }
}

impl Source for Vec<LocatedDocblockSource> {
    fn is_empty(&self) -> bool {
        self.is_empty()
    }
}

impl Source for Vec<u8> {
    fn is_empty(&self) -> bool {
        self.is_empty()
    }
}

type IncrementalSourceSet<V> = FnvHashMap<PathBuf, V>;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IncrementalSources<V: Source> {
    pub pending: IncrementalSourceSet<V>,
    pub processed: IncrementalSourceSet<V>,
}

impl<V: Source + Clone> IncrementalSources<V> {
    /// Merges additional pending sources into this states pending sources.
    /// Skip if a pending source is empty and the processed source doesn't exist.
    /// A pending source can be empty when a file doesn't contain any source (GraphQL,
    /// Docblock, .etc). We need to keep the empty source only when there is a
    /// corresponding source in `processed`, and compiler needs to do the work to remove it.
    fn merge_pending_sources(&mut self, additional_pending_sources: &IncrementalSourceSet<V>) {
        for (key, value) in additional_pending_sources.iter() {
            self.merge_pending_source(key, value);
        }
    }

    /// `merge_pending_sources`, except that a file that isn't pending and whose
    /// contents equal its processed version is skipped: it was reported as
    /// changed but didn't change. A file that is already pending is always
    /// updated, because a build may already have used its pending version.
    fn merge_changed_pending_sources(
        &mut self,
        additional_pending_sources: &IncrementalSourceSet<V>,
    ) where
        V: PartialEq,
    {
        for (key, value) in additional_pending_sources.iter() {
            if !self.pending.contains_key(key) && self.processed.get(key) == Some(value) {
                continue;
            }
            self.merge_pending_source(key, value);
        }
    }

    fn merge_pending_source(&mut self, key: &Path, value: &V) {
        match self.pending.entry(key.to_path_buf()) {
            Entry::Occupied(mut entry) => {
                entry.insert(value.clone());
            }
            Entry::Vacant(vacant) => {
                if !value.is_empty() || self.processed.get(key).is_some_and(|v| !v.is_empty()) {
                    vacant.insert(value.clone());
                }
            }
        }
    }

    fn commit_pending_sources(&mut self) {
        for (file_name, pending_graphql_sources) in self.pending.drain() {
            if pending_graphql_sources.is_empty() {
                self.processed.remove(&file_name);
            } else {
                self.processed.insert(file_name, pending_graphql_sources);
            }
        }
    }
    pub fn get_all(&self) -> Vec<(&PathBuf, &V)> {
        let mut sources: Vec<_>;
        if self.pending.is_empty() {
            sources = self.processed.iter().collect();
        } else {
            sources = self.pending.iter().collect();
            for (key, value) in self.processed.iter() {
                if !self.pending.contains_key(key) {
                    sources.push((key, value));
                }
            }
        }
        sources.sort_by_key(|file_content| file_content.0);
        sources
    }

    pub fn get_all_non_empty(&self) -> Vec<(&PathBuf, &V)> {
        let mut sources: Vec<_> = if self.pending.is_empty() {
            self.processed
                .iter()
                .filter(|(_, value)| !value.is_empty())
                .collect()
        } else {
            self.pending
                .iter()
                .chain(
                    self.processed
                        .iter()
                        .filter(|(key, _)| !self.pending.contains_key(*key)),
                )
                .filter(|(_, value)| !value.is_empty())
                .collect()
        };
        sources.sort_by_key(|file_content| file_content.0);
        sources
    }
}

impl<V: Source> Default for IncrementalSources<V> {
    fn default() -> Self {
        IncrementalSources {
            pending: FnvHashMap::default(),
            processed: FnvHashMap::default(),
        }
    }
}

type GraphQLSourceSet = IncrementalSourceSet<Vec<LocatedGraphQLSource>>;
type DocblockSourceSet = IncrementalSourceSet<Vec<LocatedDocblockSource>>;
type FullSourceSet = IncrementalSourceSet<String>;
pub type GraphQLSources = IncrementalSources<Vec<LocatedGraphQLSource>>;
pub type SchemaSources = IncrementalSources<String>;
pub type DocblockSources = IncrementalSources<Vec<LocatedDocblockSource>>;
pub type FullSources = IncrementalSources<String>;
pub type CompactSchemaSources = IncrementalSources<Vec<u8>>;

impl Source for String {
    fn is_empty(&self) -> bool {
        self.is_empty()
    }
}

impl SchemaSources {
    pub fn get_sources(&self) -> Vec<&String> {
        let sources = self.get_all();
        sources.iter().map(|file_content| file_content.1).collect()
    }

    pub fn get_sources_with_location(&self) -> Vec<(&String, SourceLocationKey)> {
        let sources = self.get_all();
        sources
            .iter()
            .map(|file_content| {
                (
                    file_content.1,
                    SourceLocationKey::standalone(file_content.0.to_str().unwrap()),
                )
            })
            .collect()
    }

    pub fn get_old_sources(&self) -> Vec<&String> {
        let mut sources: Vec<_> = self.processed.iter().collect();
        sources.sort_by_key(|file_content| file_content.0);
        sources.iter().map(|file_content| file_content.1).collect()
    }

    /// The changed parts of a schema split across files, in the units the
    /// schema is parsed in.
    ///
    /// The schema builder parses files in path order, in chunks that end at a
    /// file ending with `}`. This groups the paths into chunks that end where
    /// a file ends with `}` both before and after the change, so each one is a
    /// whole number of the parser's chunks on either side, and keeps the
    /// chunks that contain a changed file.
    pub fn get_changed_chunks(&self) -> ChangedSchemaChunks {
        let mut paths: Vec<_> = self.processed.keys().chain(self.pending.keys()).collect();
        paths.sort();
        paths.dedup();

        let mut changed = ChangedSchemaChunks::default();
        let mut chunk = ChunkBuilder::default();
        for path in paths {
            let previous = self.processed.get(path).map_or("", String::as_str);
            let pending = self.pending.get(path).map(String::as_str);
            let file_changed = pending.is_some_and(|current| current != previous);
            let current = pending.unwrap_or(previous);
            chunk.push(current, previous, file_changed);
            if ends_with_right_curly_brace(current) && ends_with_right_curly_brace(previous) {
                std::mem::take(&mut chunk).finish_into(&mut changed);
            }
        }
        chunk.finish_into(&mut changed);
        changed
    }
}

/// See [`SchemaSources::get_changed_chunks`].
#[derive(Debug, Default, PartialEq)]
pub struct ChangedSchemaChunks {
    /// New text of each changed chunk, in path order.
    pub current: Vec<String>,
    /// Old text of each changed chunk, in path order.
    pub previous: Vec<String>,
    pub changed_file_count: usize,
}

#[derive(Default)]
struct ChunkBuilder<'a> {
    current: Vec<&'a str>,
    previous: Vec<&'a str>,
    changed_file_count: usize,
}

impl<'a> ChunkBuilder<'a> {
    fn push(&mut self, current: &'a str, previous: &'a str, changed: bool) {
        if changed {
            self.changed_file_count += 1;
        }
        if !current.is_empty() {
            self.current.push(current);
        }
        if !previous.is_empty() {
            self.previous.push(previous);
        }
    }

    fn finish_into(self, changed: &mut ChangedSchemaChunks) {
        if self.changed_file_count == 0 {
            return;
        }
        changed.changed_file_count += self.changed_file_count;
        if !self.current.is_empty() {
            changed.current.push(self.current.join("\n"));
        }
        if !self.previous.is_empty() {
            changed.previous.push(self.previous.join("\n"));
        }
    }
}

fn commit_pending_sources_of<V: Source + Clone>(
    sources: &mut FnvHashMap<ProjectName, IncrementalSources<V>>,
    projects: &FnvHashSet<ProjectName>,
) {
    sources
        .iter_mut()
        .filter(|(project_name, _)| projects.contains(*project_name))
        .for_each(|(_, sources)| sources.commit_pending_sources());
}

impl CompactSchemaSources {
    /// Get the current compact bytes (pending merged over processed).
    /// Returns None if there are no sources. For compact schemas,
    /// there should be exactly one entry (single file).
    pub fn get_current_bytes(&self) -> Option<&Vec<u8>> {
        self.get_all_non_empty().first().map(|(_, v)| *v)
    }

    /// Get the previous (processed) compact bytes.
    pub fn get_old_bytes(&self) -> Option<&Vec<u8>> {
        self.processed.values().find(|v| !v.is_empty())
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub enum ArtifactMapKind {
    /// A simple set of paths of generated files. This kind is used when the
    /// compiler starts without a saved state and doesn't know the connection
    /// between generated files and the artifacts that produced them.
    Unconnected(FnvHashSet<PathBuf>),
    /// A known mapping from input documents to generated outputs.
    Mapping(ArtifactMap),
}

#[derive(Serialize, Deserialize, Default)]
pub struct ProjectArtifactMap(pub FnvHashMap<ProjectName, Arc<ArtifactMapKind>>);

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct CompilerState {
    pub graphql_sources: FnvHashMap<ProjectName, GraphQLSources>,
    pub schemas: FnvHashMap<ProjectName, SchemaSources>,
    pub extensions: FnvHashMap<ProjectName, SchemaSources>,
    pub docblocks: FnvHashMap<ProjectName, DocblockSources>,
    pub full_sources: FnvHashMap<ProjectName, FullSources>,
    pub artifacts: ProjectArtifactMap,
    #[serde(with = "clock_json_string")]
    pub clock: Option<Clock>,
    pub saved_state_version: String,
    #[serde(skip)]
    pub dirty_artifact_paths: FnvHashMap<ProjectName, DashSet<PathBuf, FnvBuildHasher>>,
    #[serde(skip)]
    pub pending_file_source_changes: Arc<RwLock<Vec<FileSourceResult>>>,
    #[serde(skip)]
    pub schema_cache: FnvHashMap<ProjectName, Arc<SDLSchema>>,
    #[serde(skip)]
    pub source_control_update_status: Arc<SourceControlUpdateStatus>,
    #[serde(default)]
    pub compact_schemas: FnvHashMap<ProjectName, CompactSchemaSources>,
    /// Cache of pre-parsed server schema ASTs, keyed by schema location path.
    /// Populated before the parallel project build loop so that multiple projects
    /// sharing the same schema source can reuse the parsed ASTs instead of
    /// re-parsing the same SDL text independently.
    #[serde(skip)]
    pub(crate) parsed_server_asts_cache: FnvHashMap<PathBuf, ParsedServerAsts>,
}

/// Server schema ASTs parsed from the schema sources of `source_project`.
#[derive(Debug)]
pub(crate) struct ParsedServerAsts {
    pub(crate) source_project: ProjectName,
    pub(crate) documents: Arc<Vec<graphql_syntax::SchemaDocument>>,
}

/// Stringify a path such that it's stable across operating systems.
/// This normalizes path separators to forward slashes for consistent output.
fn format_normalized_path(path: &Path) -> String {
    path.to_string_lossy()
        .to_string()
        .replace(MAIN_SEPARATOR, "/")
}

impl fmt::Debug for ProjectArtifactMap {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut output = String::new();

        // Sort projects by name for stable ordering
        let mut sorted_projects: Vec<_> = self.0.iter().collect();
        sorted_projects.sort_by_key(|(project_name, _)| project_name.to_string());

        for (project_name, artifact_map_kind) in sorted_projects {
            output.push_str(&format!("Project: {}\n", project_name));

            match artifact_map_kind.as_ref() {
                ArtifactMapKind::Unconnected(_) => {
                    panic!("Expected artifact map to be connected once compilation is complete")
                }
                ArtifactMapKind::Mapping(artifact_map) => {
                    output.push_str("  Type: Mapping\n");

                    // Collect and sort all entries by source key
                    let mut entries: Vec<_> = artifact_map.0.iter().collect();
                    entries.sort_by(|a, b| a.key().cmp(b.key()));

                    for entry in entries {
                        let (source_key, records) = entry.pair();
                        let source_label = match source_key {
                            ArtifactSourceKey::ExecutableDefinition(name) => {
                                format!("ExecutableDefinition: {}", name)
                            }
                            ArtifactSourceKey::ResolverHash(hash) => {
                                format!("ResolverHash: {:?}", hash)
                            }
                            ArtifactSourceKey::Schema() => "Schema".to_string(),
                        };

                        output.push_str(&format!("  - Source: {}\n", source_label));

                        // Sort artifacts by path
                        let mut sorted_records: Vec<_> = records.iter().collect();
                        sorted_records.sort_by_key(|record| &record.path);

                        for record in sorted_records {
                            output.push_str(&format!(
                                "    Path: {}\n",
                                format_normalized_path(&record.path)
                            ));
                            if let Some(persisted_id) = &record.persisted_operation_id {
                                output.push_str(&format!("    Persisted ID: {}\n", persisted_id));
                            }
                        }
                    }
                }
            }
            output.push('\n');
        }

        write!(f, "{}", output)
    }
}
/// Used to store the intermediate results of processing a file source in parallel.
/// Because the compiler state does not support concurrency, we process in parallel,
/// then merge the results into the compiler state.
enum FileSourceIntermediateResult {
    Source(
        ProjectSet,
        GraphQLSourceSet,
        DocblockSourceSet,
        FullSourceSet,
    ),
    Schema(ProjectSet, FnvHashMap<PathBuf, String>, Vec<PathBuf>),
    CompactSchema(ProjectSet, FnvHashMap<PathBuf, Vec<u8>>, Vec<PathBuf>),
    Extension(ProjectSet, FnvHashMap<PathBuf, String>, Vec<PathBuf>),
    Generated(ProjectName, FnvHashSet<PathBuf>),
    Ignore,
}

impl CompilerState {
    /// Creates a new instance of the compiler state from the given file source changes.
    pub fn from_file_source_changes(
        config: &Config,
        file_source_changes: &FileSourceResult,
        setup_event: &impl PerfLogEvent,
        perf_logger: &impl PerfLogger,
    ) -> Result<Self> {
        let categorized = setup_event.time("categorize_files_time", || {
            categorize_files(config, file_source_changes)
        });

        let mut result = Self {
            clock: file_source_changes.clock(),
            saved_state_version: config.saved_state_version.clone(),
            ..Default::default()
        };

        let file_source_result =
            process_categorized_sources(categorized, config, perf_logger, false)?;
        for file_source in file_source_result {
            match file_source {
                FileSourceIntermediateResult::Source(
                    project_set,
                    graphql_sources,
                    docblock_sources,
                    full_sources,
                ) => {
                    for project_name in project_set {
                        result.set_pending_source_set(project_name, &graphql_sources);
                        result.set_pending_docblock_set(project_name, &docblock_sources);
                        result.set_pending_full_source_set(project_name, &full_sources);
                    }
                }
                FileSourceIntermediateResult::Schema(project_set, added, removed) => {
                    for project_name in project_set {
                        let entry = result.schemas.entry(project_name).or_default();
                        for source in &removed {
                            entry.pending.insert(source.clone(), "".to_string());
                        }
                        entry.merge_pending_sources(&added);
                    }
                }
                FileSourceIntermediateResult::CompactSchema(project_set, added, removed) => {
                    for project_name in project_set {
                        let entry = result.compact_schemas.entry(project_name).or_default();
                        for source in &removed {
                            entry.pending.insert(source.clone(), Vec::new());
                        }
                        entry.merge_pending_sources(&added);
                    }
                }
                FileSourceIntermediateResult::Extension(project_set, added, removed) => {
                    for project_name in project_set {
                        let entry = result.extensions.entry(project_name).or_default();
                        for source in &removed {
                            entry.pending.insert(source.clone(), "".to_string());
                        }
                        entry.merge_pending_sources(&added);
                    }
                }
                FileSourceIntermediateResult::Generated(project_name, files) => {
                    result
                        .artifacts
                        .0
                        .insert(project_name, Arc::new(ArtifactMapKind::Unconnected(files)));
                }
                FileSourceIntermediateResult::Ignore => {}
            }
        }

        Ok(result)
    }

    pub fn project_has_pending_changes(&self, project_name: ProjectName) -> bool {
        self.graphql_sources
            .get(&project_name)
            .is_some_and(|sources| !sources.pending.is_empty())
            || self.project_has_pending_schema_changes(project_name)
            || self.dirty_artifact_paths.contains_key(&project_name)
    }

    pub fn project_has_pending_schema_changes(&self, project_name: ProjectName) -> bool {
        self.schemas
            .get(&project_name)
            .is_some_and(|sources| !sources.pending.is_empty())
            || self
                .compact_schemas
                .get(&project_name)
                .is_some_and(|sources| !sources.pending.is_empty())
            || self.has_pending_non_schema_changes(project_name)
    }

    /// Whether two projects have identical pending schema sources.
    pub fn projects_share_pending_schemas(&self, a: ProjectName, b: ProjectName) -> bool {
        let sdl_match = match (self.schemas.get(&a), self.schemas.get(&b)) {
            (Some(a), Some(b)) => a.pending == b.pending,
            (None, None) => true,
            _ => false,
        };
        let compact_match = match (self.compact_schemas.get(&a), self.compact_schemas.get(&b)) {
            (Some(a), Some(b)) => a.pending == b.pending,
            (None, None) => true,
            _ => false,
        };
        sdl_match && compact_match
    }

    /// Whether a project has pending extension, docblock, or full_source changes.
    pub fn has_pending_non_schema_changes(&self, project_name: ProjectName) -> bool {
        self.extensions
            .get(&project_name)
            .is_some_and(|sources| !sources.pending.is_empty())
            || self
                .docblocks
                .get(&project_name)
                .is_some_and(|sources| !sources.pending.is_empty())
            || self
                .full_sources
                .get(&project_name)
                .is_some_and(|sources| !sources.pending.is_empty())
    }

    pub fn has_processed_changes(&self) -> bool {
        self.graphql_sources
            .values()
            .any(|sources| !sources.processed.is_empty())
            || self
                .schemas
                .values()
                .any(|sources| !sources.processed.is_empty())
            || self
                .compact_schemas
                .values()
                .any(|sources| !sources.processed.is_empty())
            || self
                .extensions
                .values()
                .any(|sources| !sources.processed.is_empty())
            || self
                .docblocks
                .values()
                .any(|sources| !sources.processed.is_empty())
            || self
                .full_sources
                .values()
                .any(|sources| !sources.processed.is_empty())
    }

    fn get_schema_change(
        &self,
        log_event: Option<&impl PerfLogEvent>,
        sources: &SchemaSources,
        diff_changed_sources_only: bool,
    ) -> SchemaChange {
        if diff_changed_sources_only
            && let Some(schema_change) =
                Self::get_schema_change_of_changed_chunks(log_event, sources)
        {
            return schema_change;
        }

        let previous = sources
            .get_old_sources()
            .into_iter()
            .map(String::as_str)
            .collect::<Vec<_>>();

        let current = sources
            .get_sources()
            .into_iter()
            .map(String::as_str)
            .collect::<Vec<_>>();

        detect_changes(&current, &previous)
    }

    /// Diffs only the chunks of [`SchemaSources::get_changed_chunks`]. Same as
    /// diffing the whole joined schema when the parser's chunks of the current
    /// schema each parse (otherwise building it fails before or right after
    /// this check): unchanged chunks then give both sides the same
    /// definitions, a type is defined once, and the diff ignores extensions,
    /// directive and schema definitions, and source positions. That also
    /// assumes the processed (old) schema defines each type once: sources are
    /// committed as processed only after a successful build
    /// (`complete_compilation`, also on the LSP path), and saved states are
    /// written after a successful compile; `complete_compilation` commits only
    /// the projects a build built. `None`, to diff
    /// everything instead, when a changed chunk does not parse on its own, or
    /// when the changed chunks hold the same text on both sides (text moved
    /// between files, which reorders the joined schema).
    fn get_schema_change_of_changed_chunks(
        log_event: Option<&impl PerfLogEvent>,
        sources: &SchemaSources,
    ) -> Option<SchemaChange> {
        let changed = sources.get_changed_chunks();
        if let Some(log_event) = log_event {
            log_event.number("schema_diff_changed_file_count", changed.changed_file_count);
        }
        if changed.changed_file_count == 0 {
            return Some(SchemaChange::None);
        }
        let log_fallback = |reason: &str| {
            if let Some(log_event) = log_event {
                log_event.string("schema_diff_fallback_reason", reason.to_owned());
            }
        };
        if changed.current == changed.previous {
            log_fallback("moved_text");
            return None;
        }
        let current: Vec<&str> = changed.current.iter().map(String::as_str).collect();
        let previous: Vec<&str> = changed.previous.iter().map(String::as_str).collect();
        let schema_change = try_detect_changes_per_document(&current, &previous);
        if schema_change.is_none() {
            log_fallback("chunk_does_not_parse");
        }
        schema_change
    }

    fn build_schema_for_safety_check(
        &self,
        sources: &SchemaSources,
    ) -> std::result::Result<SDLSchema, ()> {
        let current_sources_with_location = sources
            .get_sources_with_location()
            .into_iter()
            .map(|(schema, location_key)| (schema.as_str(), location_key))
            .collect::<Vec<_>>();

        if let Some(server_asts) = self.parsed_server_asts_for(&current_sources_with_location) {
            return relay_schema::build_schema_with_extensions_from_asts(server_asts, vec![])
                .map_err(|_| ());
        }

        relay_schema::build_schema_with_extensions_parallel(
            &current_sources_with_location,
            &Vec::<(&str, SourceLocationKey)>::new(),
        )
        .map_err(|_| ())
    }

    /// The pre-parsed server ASTs of a project whose schema sources are
    /// exactly `sources`: the same text and location keys, in the same order.
    fn parsed_server_asts_for(
        &self,
        sources: &[(&str, SourceLocationKey)],
    ) -> Option<&[graphql_syntax::SchemaDocument]> {
        self.parsed_server_asts_cache
            .values()
            .find(|cached| {
                self.schemas
                    .get(&cached.source_project)
                    .is_some_and(|cached_sources| {
                        cached_sources
                            .get_sources_with_location()
                            .into_iter()
                            .map(|(schema, location_key)| (schema.as_str(), location_key))
                            .eq(sources.iter().copied())
                    })
            })
            .map(|cached| cached.documents.as_slice())
    }

    /// This method is looking at the pending schema changes to see if they may be breaking (removed types, renamed field, etc)
    /// When `built_schema` is provided, it is reused for the safety check
    /// instead of rebuilding the schema. `diff_changed_sources_only` mirrors
    /// [`Config::schema_diff_changed_sources_only`]. The check reads the schema
    /// config and feature flags of `project_config`, also when `project_name`
    /// is its base project.
    pub fn schema_change_safety(
        &self,
        log_event: &impl PerfLogEvent,
        project_name: ProjectName,
        project_config: &ProjectConfig,
        built_schema: Option<&SDLSchema>,
        diff_changed_sources_only: bool,
        check: SchemaChangeCheck,
    ) -> SchemaChangeSafety {
        let schema_config = &project_config.schema_config;
        let feature_flags = &project_config.feature_flags;
        if let Some(extension) = self.extensions.get(&project_name)
            && !extension.pending.is_empty()
        {
            log_event.string("has_breaking_schema_change", "extension".to_owned());
            return SchemaChangeSafety::Unsafe;
        }
        if let Some(docblocks) = self.docblocks.get(&project_name)
            && !docblocks.pending.is_empty()
        {
            log_event.string("has_breaking_schema_change", "docblock".to_owned());
            return SchemaChangeSafety::Unsafe;
        }
        if let Some(full_sources) = self.full_sources.get(&project_name)
            && !full_sources.pending.is_empty()
        {
            log_event.string("has_breaking_schema_change", "full_source".to_owned());
            return SchemaChangeSafety::Unsafe;
        }
        if let Some(compact_sources) = self.compact_schemas.get(&project_name)
            && !compact_sources.pending.is_empty()
        {
            let current_bytes = compact_sources.get_current_bytes();
            let old_bytes = compact_sources.get_old_bytes();
            match (current_bytes, old_bytes) {
                (Some(curr), Some(old)) => {
                    let current_schema =
                        SDLSchema::InMemory(schema::compact::deserialize_parallel(curr));
                    let previous_schema =
                        SDLSchema::InMemory(schema::compact::deserialize_parallel(old));
                    let schema_change =
                        detect_changes_from_schemas(&current_schema, &previous_schema);
                    log_schema_change_kinds(log_event, &schema_change, check);
                    let schema_change_string = schema_change_for_logging(&schema_change);
                    let schema_change_safety = if schema_change == SchemaChange::None {
                        SchemaChangeSafety::Safe
                    } else {
                        let schema = built_schema.unwrap_or(&current_schema);
                        schema_change.get_safety(schema, schema_config, feature_flags)
                    };
                    match schema_change_safety {
                        SchemaChangeSafety::Unsafe => {
                            log_event.string("schema_change", schema_change_string);
                            log_event.string(
                                "has_breaking_schema_change",
                                "compact_schema_change".to_owned(),
                            );
                        }
                        SchemaChangeSafety::SafeWithIncrementalBuild(_)
                        | SchemaChangeSafety::Safe => {}
                    }
                    return schema_change_safety;
                }
                _ => {
                    log_event.string("has_breaking_schema_change", "compact_schema".to_owned());
                    return SchemaChangeSafety::Unsafe;
                }
            }
        }
        if let Some(schema_sources) = self.schemas.get(&project_name)
            && !schema_sources.pending.is_empty()
        {
            let schema_change = self.get_schema_change(
                // Only the project's own check logs these, so that the base
                // project's check on the same event doesn't overwrite them.
                (check == SchemaChangeCheck::Project).then_some(log_event),
                schema_sources,
                diff_changed_sources_only,
            );
            log_schema_change_kinds(log_event, &schema_change, check);
            let schema_change_string = schema_change_for_logging(&schema_change);
            let schema_change_safety = if schema_change == SchemaChange::None {
                SchemaChangeSafety::Safe
            } else if let Some(schema) = built_schema {
                schema_change.get_safety(schema, schema_config, feature_flags)
            } else {
                match self.build_schema_for_safety_check(schema_sources) {
                    Ok(schema) => schema_change.get_safety(&schema, schema_config, feature_flags),
                    Err(_) => SchemaChangeSafety::Unsafe,
                }
            };
            match schema_change_safety {
                SchemaChangeSafety::Unsafe => {
                    log_event.string("schema_change", schema_change_string);
                    log_event.string("has_breaking_schema_change", "schema_change".to_owned());
                }
                SchemaChangeSafety::SafeWithIncrementalBuild(_) | SchemaChangeSafety::Safe => {}
            }
            return schema_change_safety;
        }
        SchemaChangeSafety::Safe
    }

    /// Merges pending changes from the file source into the compiler state.
    ///
    /// Returns a boolean indicating if any new changes were merged.
    pub fn merge_file_source_changes(
        &mut self,
        config: &Config,
        perf_logger: &impl PerfLogger,
        // When loading from saved state, collect dirty artifacts for recompiling their source definitions
        should_collect_changed_artifacts: bool,
    ) -> Result<bool> {
        let mut has_changed = false;
        for file_source_changes in self.pending_file_source_changes.write().unwrap().drain(..) {
            let log_event = perf_logger.create_event("merge_file_source_changes");
            log_event.number("number_of_changes", file_source_changes.size());
            let categorized = log_event.time("categorize_files_time", || {
                categorize_files(config, &file_source_changes)
            });
            let file_source_result =
                process_categorized_sources(categorized, config, perf_logger, true)?;
            for file_source in file_source_result {
                match file_source {
                    FileSourceIntermediateResult::Source(
                        project_set,
                        graphql_sources,
                        docblock_sources,
                        full_sources,
                    ) => {
                        // TODO: possible optimization to only set this if the
                        // extracted sources actually differ.
                        has_changed = true;

                        for project_name in project_set {
                            self.graphql_sources
                                .entry(project_name)
                                .or_default()
                                .merge_pending_sources(&graphql_sources);
                            self.docblocks
                                .entry(project_name)
                                .or_default()
                                .merge_pending_sources(&docblock_sources);
                            self.full_sources
                                .entry(project_name)
                                .or_default()
                                .merge_pending_sources(&full_sources);
                        }
                    }
                    FileSourceIntermediateResult::Schema(project_set, added, removed) => {
                        has_changed = true;
                        for project_name in project_set {
                            let entry = self.schemas.entry(project_name).or_default();
                            for source in &removed {
                                entry.pending.insert(source.clone(), "".to_string());
                            }
                            entry.merge_changed_pending_sources(&added);
                        }
                    }
                    FileSourceIntermediateResult::CompactSchema(project_set, added, removed) => {
                        has_changed = true;
                        for project_name in project_set {
                            let entry = self.compact_schemas.entry(project_name).or_default();
                            for source in &removed {
                                entry.pending.insert(source.clone(), Vec::new());
                            }
                            entry.merge_pending_sources(&added);
                        }
                    }
                    FileSourceIntermediateResult::Extension(project_set, added, removed) => {
                        has_changed = true;
                        for project_name in project_set {
                            let entry = self.extensions.entry(project_name).or_default();
                            for source in &removed {
                                entry.pending.insert(source.clone(), "".to_string());
                            }
                            entry.merge_pending_sources(&added);
                        }
                    }
                    FileSourceIntermediateResult::Generated(project_name, files) => {
                        if should_collect_changed_artifacts {
                            let dirty_files: DashSet<PathBuf, FnvBuildHasher> = files
                                .into_iter()
                                .filter(|path| {
                                    !config
                                        .artifact_writer
                                        .content_matches_last_write(&config.root_dir.join(path))
                                })
                                .collect();

                            if !dirty_files.is_empty() {
                                self.dirty_artifact_paths.insert(project_name, dirty_files);
                            }
                        }
                    }
                    FileSourceIntermediateResult::Ignore => {}
                }
            }
        }

        Ok(has_changed)
    }

    /// Marks the pending sources of the built projects as processed and clears
    /// their dirty artifact paths. `projects` are the projects a later build
    /// can select. Every other project keeps its pending sources for the next
    /// build that includes it. A base's pending sources are also the rebuild
    /// signal of each project that uses it, so they stay pending until the base
    /// (if it's in `projects`) and every project in `projects` that uses it
    /// have been built.
    pub fn complete_compilation<'a>(
        &mut self,
        projects: impl IntoIterator<Item = &'a ProjectConfig>,
        is_built: impl Fn(ProjectName) -> bool,
    ) {
        let projects: Vec<&ProjectConfig> = projects.into_iter().collect();
        let bases: FnvHashSet<ProjectName> =
            projects.iter().filter_map(|project| project.base).collect();
        let built_bases = bases.iter().copied().filter(|base| {
            projects
                .iter()
                .filter(|project| project.name == *base || project.base == Some(*base))
                .all(|project| is_built(project.name))
        });
        let built_projects: FnvHashSet<ProjectName> = projects
            .iter()
            .map(|project| project.name)
            .filter(|name| !bases.contains(name) && is_built(*name))
            .chain(built_bases)
            .collect();
        commit_pending_sources_of(&mut self.graphql_sources, &built_projects);
        commit_pending_sources_of(&mut self.schemas, &built_projects);
        commit_pending_sources_of(&mut self.compact_schemas, &built_projects);
        commit_pending_sources_of(&mut self.extensions, &built_projects);
        commit_pending_sources_of(&mut self.docblocks, &built_projects);
        commit_pending_sources_of(&mut self.full_sources, &built_projects);
        self.dirty_artifact_paths
            .retain(|project_name, _| !built_projects.contains(project_name));
    }

    /// Calculate dirty definitions/sources from dirty artifacts
    pub fn get_dirty_artifact_sources(
        &self,
        config: &Config,
    ) -> FnvHashMap<ProjectName, Vec<ArtifactSourceKey>> {
        if self.dirty_artifact_paths.is_empty() {
            return Default::default();
        }
        let mut result = FnvHashMap::default();
        for (project_name, paths) in self.dirty_artifact_paths.iter() {
            if config.projects[project_name].enabled {
                let paths = paths.clone();
                let artifacts = self
                    .artifacts
                    .0
                    .get(project_name)
                    .expect("Expected the artifacts map to exist.");
                if let ArtifactMapKind::Mapping(artifacts) = &**artifacts {
                    let mut dirty_definitions = vec![];
                    'outer: for entry in artifacts.0.iter() {
                        let (definition_name, artifact_records) = entry.pair();
                        let mut added = false;
                        for artifact_record in artifact_records {
                            if paths.remove(&artifact_record.path).is_some() && !added {
                                dirty_definitions.push(definition_name.clone());
                                if paths.is_empty() {
                                    break 'outer;
                                }
                                added = true;
                            }
                        }
                    }
                    if !dirty_definitions.is_empty() {
                        result.insert(*project_name, dirty_definitions);
                    }
                } else {
                    panic!("Expected the artifacts map to be populated.")
                }
            }
        }
        result
    }

    /// Writes the state as one zstd stream.
    pub fn serialize_to_file(&self, path: &PathBuf) -> Result<()> {
        self.serialize_to_file_with_frames(path, false)
    }

    /// Writes the state as zstd. With `independent_frames`, the bincode
    /// output is compressed in `SAVED_STATE_FRAME_SIZE` chunks, in parallel,
    /// each as its own frame that records its decompressed size, so
    /// [`Self::deserialize_from_file_with_frames`] can decompress the frames
    /// in parallel. Any zstd decoder reads the concatenated frames as one
    /// stream.
    pub fn serialize_to_file_with_frames(
        &self,
        path: &PathBuf,
        independent_frames: bool,
    ) -> Result<()> {
        let zstd_level: i32 = env::var("RELAY_SAVED_STATE_ZSTD_LEVEL").map_or_else(
            |_| 12,
            |level| {
                level.parse::<i32>().expect(
                    "Expected RELAY_SAVED_STATE_ZSTD_LEVEL environment variable to be a number.",
                )
            },
        );
        let write_error = |err| Error::WriteFileError {
            file: path.clone(),
            source: err,
        };
        let serialization_error = |err| Error::SerializationError {
            file: path.clone(),
            source: err,
        };

        if independent_frames {
            let file = BufWriter::new(FsFile::create(path).map_err(write_error)?);
            let threads = saved_state_compression_threads(
                std::thread::available_parallelism().map_or(1, |threads| threads.get()),
            );
            return write_in_frames(self, file, SAVED_STATE_FRAME_SIZE, threads, || {
                zstd_compressor(zstd_level)
            })
            .map_err(|err| match err {
                FrameWriteError::Encode(err) => serialization_error(err),
                FrameWriteError::Io(err) => write_error(err),
            });
        }

        let writer = FsFile::create(path)
            .and_then(|writer| {
                let mut encoder = ZstdEncoder::new(writer, zstd_level)?;
                match u32::try_from(std::thread::available_parallelism()?.get()) {
                    Ok(threads) => {
                        debug!("Using {threads} zstd threads");
                        encoder.multithread(threads).ok();
                    }
                    Err(_) => {
                        debug!("Using single-threaded zstd");
                    }
                }
                Ok(encoder)
            })
            .map_err(write_error)?
            .auto_finish();

        let mut writer =
            BufWriter::with_capacity(ZstdEncoder::<FsFile>::recommended_input_size(), writer);
        bincode::serde::encode_into_std_write(self, &mut writer, bincode::config::legacy())
            .map(|_| ())
            .map_err(serialization_error)
    }

    /// Loads a saved state written by [`Self::serialize_to_file`] or
    /// [`Self::serialize_to_file_with_frames`], decompressing it as one stream.
    pub fn deserialize_from_file(path: &PathBuf) -> Result<Self> {
        Self::deserialize_from_file_with_frames(path, false)
    }

    /// Loads a saved state written by [`Self::serialize_to_file_with_frames`],
    /// or its decompressed form when the path ends with `.decompressed`. With
    /// `parallel_frames`, a state written as independent frames is
    /// decompressed in parallel; any other zstd file is decompressed as one
    /// stream, as without it.
    pub fn deserialize_from_file_with_frames(
        path: &PathBuf,
        parallel_frames: bool,
    ) -> Result<Self> {
        let is_already_decompressed = path
            .to_str()
            .map(|s| s.ends_with(".decompressed"))
            .unwrap_or(false);

        let read_error = |err| Error::ReadFileError {
            file: path.clone(),
            source: err,
        };
        let deserialization_error = |err| Error::DeserializationError {
            file: path.clone(),
            source: err,
        };

        let mut file = FsFile::open(path).map_err(read_error)?;
        if parallel_frames
            && !is_already_decompressed
            && first_frame_records_size(&mut file).map_err(read_error)?
        {
            let mut compressed = vec![];
            file.read_to_end(&mut compressed).map_err(read_error)?;
            if let Some(frames) = sized_frames(&compressed).map_err(read_error)? {
                return decode_frames_pipelined(&frames, SAVED_STATE_FRAMES_PER_BATCH)
                    .map_err(deserialization_error);
            }
            let mut reader = BufReader::with_capacity(
                ZstdDecoder::<BufReader<FsFile>>::recommended_output_size(),
                ZstdDecoder::new(compressed.as_slice()).map_err(read_error)?,
            );
            return bincode::serde::decode_from_std_read(&mut reader, bincode::config::legacy())
                .map_err(deserialization_error);
        }

        let mut reader: Box<dyn std::io::Read> = if is_already_decompressed {
            Box::new(BufReader::new(file))
        } else {
            let zstd_decoder = ZstdDecoder::new(file).map_err(read_error)?;
            Box::new(BufReader::with_capacity(
                ZstdDecoder::<BufReader<FsFile>>::recommended_output_size(),
                zstd_decoder,
            ))
        };

        bincode::serde::decode_from_std_read(&mut reader, bincode::config::legacy())
            .map_err(deserialization_error)
    }

    pub fn has_pending_file_source_changes(&self) -> bool {
        !self.pending_file_source_changes.read().unwrap().is_empty()
    }

    fn set_pending_source_set(&mut self, project_name: ProjectName, source_set: &GraphQLSourceSet) {
        let entry = &mut self.graphql_sources.entry(project_name).or_default();
        entry.merge_pending_sources(source_set);
    }

    fn set_pending_docblock_set(
        &mut self,
        project_name: ProjectName,
        source_set: &DocblockSourceSet,
    ) {
        let entry = &mut self.docblocks.entry(project_name).or_default();
        entry.merge_pending_sources(source_set);
    }

    fn set_pending_full_source_set(
        &mut self,
        project_name: ProjectName,
        source_set: &FullSourceSet,
    ) {
        let entry = &mut self.full_sources.entry(project_name).or_default();
        entry.merge_pending_sources(source_set);
    }

    pub fn is_source_control_update_in_progress(&self) -> bool {
        self.source_control_update_status.is_started()
    }

    /// Over the course of the build, we may need to stop current progress
    /// as there maybe incoming file change or source control update in progress
    pub fn should_cancel_current_build(&self) -> bool {
        self.is_source_control_update_in_progress() || self.has_pending_file_source_changes()
    }
}

fn process_intermediate_schema_change(
    config: &Config,
    files: Vec<File>,
) -> Result<(FnvHashMap<PathBuf, String>, Vec<PathBuf>)> {
    let mut removed_sources = vec![];
    let mut added_sources = FnvHashMap::default();
    for file in files {
        let file_name = file.name.clone();
        if file.exists {
            added_sources.insert(file_name, read_file_to_string(config, &file)?);
        } else {
            removed_sources.push(file_name);
        }
    }
    Ok((added_sources, removed_sources))
}

fn process_intermediate_compact_schema_change(
    config: &Config,
    files: Vec<File>,
) -> Result<(IncrementalSourceSet<Vec<u8>>, Vec<PathBuf>)> {
    let mut removed_sources = vec![];
    let mut added_sources = FnvHashMap::default();
    for file in files {
        let file_name = file.name.clone();
        if file.exists {
            added_sources.insert(file_name, read_file_to_bytes(config, &file)?);
        } else {
            removed_sources.push(file_name);
        }
    }
    Ok((added_sources, removed_sources))
}

fn process_categorized_sources(
    categorized: HashMap<FileGroup, Vec<File>>,
    config: &Config,
    perf_logger: &impl PerfLogger,
    preserve_empty: bool,
) -> Result<Vec<FileSourceIntermediateResult>> {
    categorized
        .into_par_iter()
        .map(|(category, files)| match category {
            FileGroup::Source { project_set } => {
                // Slow step: reading from disk and parsing
                let (graphql_sources, docblock_sources, full_sources) =
                    extract_sources(&project_set, files, preserve_empty, perf_logger, config)?;
                Ok(FileSourceIntermediateResult::Source(
                    project_set,
                    graphql_sources,
                    docblock_sources,
                    full_sources,
                ))
            }
            FileGroup::Schema { project_set } => {
                let (added, removed) = process_intermediate_schema_change(config, files)?;
                Ok(FileSourceIntermediateResult::Schema(
                    project_set,
                    added,
                    removed,
                ))
            }
            FileGroup::CompactSchema { project_set } => {
                let (added, removed) = process_intermediate_compact_schema_change(config, files)?;
                Ok(FileSourceIntermediateResult::CompactSchema(
                    project_set,
                    added,
                    removed,
                ))
            }
            FileGroup::Extension { project_set } => {
                let (added, removed) = process_intermediate_schema_change(config, files)?;
                Ok(FileSourceIntermediateResult::Extension(
                    project_set,
                    added,
                    removed,
                ))
            }
            FileGroup::Generated { project_name } => Ok(FileSourceIntermediateResult::Generated(
                project_name,
                files.into_iter().map(|file: File| file.name).collect(),
            )),
            FileGroup::Ignore => Ok(FileSourceIntermediateResult::Ignore),
        })
        .collect()
}

fn extract_sources(
    project_set: &ProjectSet,
    files: Vec<File>,
    preserve_empty: bool,
    perf_logger: &impl PerfLogger,
    config: &Config,
) -> Result<(GraphQLSourceSet, DocblockSourceSet, FullSourceSet)> {
    let log_event = perf_logger.create_event("categorize");
    log_event.string("source_set_name", project_set.to_string());
    let extract_timer = log_event.start("extract_graphql_strings_from_file_time");

    let source_features = files
        .par_iter()
        .map(|file| {
            if file.exists {
                match extract_javascript_features_from_file(file, config) {
                    Ok(features) => Ok((file, features)),
                    Err(err) => Err(err),
                }
            } else {
                Ok((file, LocatedJavascriptSourceFeatures::default()))
            }
        })
        .collect::<Result<Vec<_>>>()?;

    log_event.stop(extract_timer);

    let mut graphql_sources: GraphQLSourceSet = FnvHashMap::default();
    let mut docblock_sources: DocblockSourceSet = FnvHashMap::default();
    let mut full_sources = FnvHashMap::default();
    for (file, features) in source_features {
        if preserve_empty || !features.graphql_sources.is_empty() {
            graphql_sources.insert(file.name.clone(), features.graphql_sources);
        }
        if preserve_empty || !features.docblock_sources.is_empty() {
            docblock_sources.insert(file.name.clone(), features.docblock_sources);
        }
        if preserve_empty || !features.full_source.is_empty() {
            full_sources.insert(file.name.clone(), features.full_source);
        }
    }

    Ok((graphql_sources, docblock_sources, full_sources))
}

/// A module to serialize a watchman Clock value via JSON.
/// The reason is that `Clock` internally uses an untagged enum value
/// which requires "self descriptive" serialization formats and `bincode` does not
/// support those enums.
mod clock_json_string {
    use serde::Deserializer;
    use serde::Serializer;
    use serde::de::Error as DeserializationError;
    use serde::de::Visitor;
    use serde::ser::Error as SerializationError;

    use crate::file_source::Clock;

    pub fn serialize<S>(clock: &Option<Clock>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let json_string = serde_json::to_string(clock).map_err(|err| {
            SerializationError::custom(format!("Unable to serialize clock value. Error {err}"))
        })?;
        serializer.serialize_str(&json_string)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Clock>, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_str(JSONStringVisitor)
    }

    struct JSONStringVisitor;
    impl Visitor<'_> for JSONStringVisitor {
        type Value = Option<Clock>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            formatter.write_str("a JSON encoded watchman::Clock value")
        }

        fn visit_str<E: DeserializationError>(self, v: &str) -> Result<Option<Clock>, E> {
            serde_json::from_str(v).map_err(|err| {
                DeserializationError::custom(format!("Unable deserialize clock value. Error {err}"))
            })
        }
    }
}

/// Longest `schema_change` value written to the perf log. The diff behind an
/// unsafe schema change can run to megabytes when a large schema changes.
const MAX_LOGGED_SCHEMA_CHANGE_LEN: usize = 1000;

/// Keeps the first `MAX_LOGGED_SCHEMA_CHANGE_LEN` bytes written to it, then
/// fails, which stops the formatting.
#[derive(Default)]
struct LoggedSchemaChange(String);

impl Write for LoggedSchemaChange {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        let room = MAX_LOGGED_SCHEMA_CHANGE_LEN - self.0.len();
        if s.len() <= room {
            self.0.push_str(s);
            return Ok(());
        }
        let end = (0..=room)
            .rev()
            .find(|&index| s.is_char_boundary(index))
            .expect("should find a char boundary because 0 is always one");
        self.0.push_str(&s[..end]);
        Err(fmt::Error)
    }
}

/// Logs the number of changed definitions and the count of each kind. Unlike
/// `schema_change`, which is cut off, these hold for the whole diff and are
/// logged whatever the safety of the change.
fn log_schema_change_kinds(
    log_event: &impl PerfLogEvent,
    schema_change: &SchemaChange,
    check: SchemaChangeCheck,
) {
    if let SchemaChange::DefinitionChanges(changes) = schema_change {
        let (count_key, kinds_key) = match check {
            SchemaChangeCheck::Project => ("schema_change_count", "schema_change_kinds"),
            SchemaChangeCheck::BaseProject => {
                ("base_schema_change_count", "base_schema_change_kinds")
            }
        };
        log_event.number(count_key, changes.len());
        log_event.string(kinds_key, schema_change.kind_counts());
    }
}

/// Whose schema change `CompilerState::schema_change_safety` checks for a
/// project's build: the project's own, or its base project's. They log to the
/// same perf event, so the base project's counts get their own keys.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SchemaChangeCheck {
    Project,
    BaseProject,
}

/// Formats `schema_change` for the perf log, cut off after
/// `MAX_LOGGED_SCHEMA_CHANGE_LEN` bytes.
fn schema_change_for_logging(schema_change: &SchemaChange) -> String {
    let mut logged = LoggedSchemaChange::default();
    if write!(logged, "{schema_change}").is_ok() {
        return logged.0;
    }
    let mut text = logged.0;
    match schema_change {
        SchemaChange::DefinitionChanges(changes) => {
            text.push_str(&format!("... ({} definition changes)", changes.len()))
        }
        SchemaChange::None | SchemaChange::GenericChange | SchemaChange::InvalidSchema => {
            text.push_str("...")
        }
    }
    text
}

/// Decompressed size of each frame [`CompilerState::serialize_to_file_with_frames`] writes.
const SAVED_STATE_FRAME_SIZE: usize = 32 * 1024 * 1024;

/// Whether `file` starts with a zstd frame header that records the frame's
/// decompressed size, as frames from [`compress_in_frames`] do and frames from
/// a streaming encoder don't. Leaves `file` at its start.
fn first_frame_records_size(file: &mut FsFile) -> std::io::Result<bool> {
    // The largest zstd frame header.
    let mut header = Vec::with_capacity(18);
    (&mut *file).take(18).read_to_end(&mut header)?;
    file.rewind()?;
    Ok(matches!(
        zstd::zstd_safe::get_frame_content_size(&header),
        Ok(Some(_))
    ))
}

/// `bytes` compressed in parallel as one zstd frame per `frame_size` chunk;
/// each frame records its decompressed size.
#[cfg(test)]
fn compress_in_frames(
    bytes: &[u8],
    frame_size: usize,
    level: i32,
) -> std::io::Result<Vec<Vec<u8>>> {
    bytes
        .par_chunks(frame_size)
        .map(|chunk| zstd::bulk::compress(chunk, level))
        .collect()
}

/// Threads that compress a saved state while it is written: three quarters of
/// the available CPUs, at most 64. Each holds a 32 MiB chunk and a zstd
/// context, about 90 MB together at the default level, a little more than a
/// streaming zstd worker; three quarters keeps the writer within the memory
/// the streaming writer used on small machines, and 64 bounds it on large ones.
fn saved_state_compression_threads(available: usize) -> usize {
    (available * 3 / 4).clamp(1, 64)
}

/// Why [`write_in_frames`] failed.
enum FrameWriteError {
    Encode(bincode::error::EncodeError),
    Io(std::io::Error),
}

/// Takes the bincode output and passes it on in numbered `frame_size` chunks,
/// reusing chunks that have been compressed.
struct ChunkWriter {
    chunk: Vec<u8>,
    frame_size: usize,
    index: usize,
    chunks: std::sync::mpsc::SyncSender<(usize, Vec<u8>)>,
    spare: std::sync::mpsc::Receiver<Vec<u8>>,
    /// One message per frame written; a chunk is sent only when it is fewer
    /// than `window` chunks ahead of the last frame written, so a slow early
    /// frame can't leave later ones piling up.
    written: std::sync::mpsc::Receiver<()>,
    written_count: usize,
    window: usize,
}

impl ChunkWriter {
    fn send(&mut self) -> std::io::Result<()> {
        while self.index >= self.written_count + self.window {
            self.written
                .recv()
                .map_err(|_| std::io::Error::other("saved state compression stopped"))?;
            self.written_count += 1;
        }
        let mut next = self.spare.try_recv().unwrap_or_default();
        next.clear();
        next.reserve(self.frame_size);
        let chunk = std::mem::replace(&mut self.chunk, next);
        self.chunks
            .send((self.index, chunk))
            .map_err(|_| std::io::Error::other("saved state compression stopped"))?;
        self.index += 1;
        Ok(())
    }
}

impl IoWrite for ChunkWriter {
    fn write(&mut self, data: &[u8]) -> std::io::Result<usize> {
        let len = data.len().min(self.frame_size - self.chunk.len());
        self.chunk.extend_from_slice(&data[..len]);
        if self.chunk.len() == self.frame_size {
            self.send()?;
        }
        Ok(len)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Writes the bincode encoding of `value` to `out` as the frames
/// `compress_in_frames` makes of the whole encoding, given the compression
/// each thread gets from `new_compressor`. Chunks are compressed on `threads`
/// threads while later ones are encoded, and written in order. At most
/// `threads + 2` uncompressed chunks are held, and a chunk is only sent while
/// fewer than `2 * threads` frames are waiting to be written.
fn write_in_frames<T, C>(
    value: &T,
    out: impl IoWrite + Send,
    frame_size: usize,
    threads: usize,
    new_compressor: impl Fn() -> std::io::Result<C> + Sync,
) -> std::result::Result<(), FrameWriteError>
where
    T: Serialize,
    C: FnMut(&[u8], &mut Vec<u8>) -> std::io::Result<()>,
{
    let compression_stopped = || std::io::Error::other("saved state compression thread panicked");
    std::thread::scope(|scope| {
        let (chunk_sender, chunks) = std::sync::mpsc::sync_channel::<(usize, Vec<u8>)>(1);
        // Dropped with the last compressor, which unblocks the encoder.
        let chunks = Arc::new(std::sync::Mutex::new(chunks));
        let (frame_sender, frames) = std::sync::mpsc::sync_channel(threads);
        let (spare_sender, spare) = std::sync::mpsc::channel();
        let new_compressor = &new_compressor;
        let compressors: Vec<_> = (0..threads)
            .map(|_| {
                let chunks = Arc::clone(&chunks);
                let frame_sender: std::sync::mpsc::SyncSender<(usize, std::io::Result<Vec<u8>>)> =
                    frame_sender.clone();
                let spare_sender = spare_sender.clone();
                scope.spawn(move || -> std::io::Result<()> {
                    // A panic here still reaches the writer, which then stops
                    // instead of waiting for this thread's frame.
                    let _panic_notice = PanicNotice(frame_sender.clone());
                    let mut compress = new_compressor()?;
                    let mut frame = Vec::with_capacity(zstd::zstd_safe::compress_bound(frame_size));
                    loop {
                        let next = chunks.lock().map_err(|_| compression_stopped())?.recv();
                        let Ok((index, chunk)) = next else {
                            return Ok(());
                        };
                        frame.clear();
                        let compressed = compress(&chunk, &mut frame).map(|()| frame.clone());
                        spare_sender.send(chunk).ok();
                        // A compression error goes to the writer, which reports it.
                        let failed = compressed.is_err();
                        if frame_sender.send((index, compressed)).is_err() || failed {
                            return Ok(());
                        }
                    }
                })
            })
            .collect();
        drop((chunks, frame_sender, spare_sender));
        let (written_sender, written) = std::sync::mpsc::channel();
        let writer = scope.spawn(move || -> std::io::Result<()> {
            let mut out = out;
            let mut waiting = std::collections::BTreeMap::new();
            let mut next = 0;
            // Returning drops `written_sender`, which unblocks the encoder.
            for (index, frame) in frames {
                waiting.insert(index, frame?);
                while let Some(frame) = waiting.remove(&next) {
                    out.write_all(&frame)?;
                    written_sender.send(()).ok();
                    next += 1;
                }
            }
            out.flush()
        });

        let mut chunk_writer = ChunkWriter {
            chunk: Vec::with_capacity(frame_size),
            frame_size,
            index: 0,
            chunks: chunk_sender,
            spare,
            written,
            written_count: 0,
            window: 2 * threads,
        };
        let encoded = bincode::serde::encode_into_std_write(
            value,
            &mut chunk_writer,
            bincode::config::legacy(),
        )
        .map_err(FrameWriteError::Encode)
        .and_then(|_| {
            if chunk_writer.chunk.is_empty() {
                Ok(())
            } else {
                chunk_writer.send().map_err(FrameWriteError::Io)
            }
        });
        drop(chunk_writer);

        // A compression or output error also stops the encoder, so report it
        // first. Every thread is joined before returning.
        let joined: Vec<std::io::Result<()>> = std::iter::once(writer.join())
            .chain(compressors.into_iter().map(|compressor| compressor.join()))
            .map(|result| result.unwrap_or_else(|_| Err(compression_stopped())))
            .collect();
        joined
            .into_iter()
            .try_for_each(|result| result.map_err(FrameWriteError::Io))?;
        encoded
    })
}

/// Sends an error to the frame writer when dropped during a panic.
struct PanicNotice(std::sync::mpsc::SyncSender<(usize, std::io::Result<Vec<u8>>)>);

impl Drop for PanicNotice {
    fn drop(&mut self) {
        if std::thread::panicking() {
            let error = std::io::Error::other("saved state compression thread panicked");
            self.0.send((usize::MAX, Err(error))).ok();
        }
    }
}

/// A zstd compression with a context that is reused for every chunk.
fn zstd_compressor(
    level: i32,
) -> std::io::Result<impl FnMut(&[u8], &mut Vec<u8>) -> std::io::Result<()>> {
    let mut compressor = zstd::bulk::Compressor::new(level)?;
    Ok(move |chunk: &[u8], frame: &mut Vec<u8>| {
        compressor.compress_to_buffer(chunk, frame).map(|_| ())
    })
}

/// A zstd frame and its decompressed size.
type SizedFrame<'a> = (&'a [u8], usize);

/// The zstd frames of `compressed` with their decompressed sizes when it is
/// two or more frames that each record their decompressed size, as
/// [`CompilerState::serialize_to_file_with_frames`] writes them. `None` for anything else,
/// such as a single frame from a streaming encoder or a frame larger than
/// `SAVED_STATE_FRAME_SIZE`.
fn sized_frames(compressed: &[u8]) -> std::io::Result<Option<Vec<SizedFrame<'_>>>> {
    let zstd_error = |code| std::io::Error::other(zstd::zstd_safe::get_error_name(code).to_owned());
    let mut frames = vec![];
    let mut rest = compressed;
    while !rest.is_empty() {
        let len = zstd::zstd_safe::find_frame_compressed_size(rest).map_err(zstd_error)?;
        let (frame, tail) = rest.split_at(len);
        let Ok(Some(size)) = zstd::zstd_safe::get_frame_content_size(frame) else {
            return Ok(None);
        };
        // Larger than the frames we write: not ours, or a corrupt header that
        // shouldn't size an allocation. The streaming path rejects it cleanly.
        let Ok(size) = usize::try_from(size) else {
            return Ok(None);
        };
        if size > SAVED_STATE_FRAME_SIZE {
            return Ok(None);
        }
        frames.push((frame, size));
        rest = tail;
    }
    if frames.len() < 2 {
        return Ok(None);
    }
    Ok(Some(frames))
}

/// `frames` decompressed in parallel into `bytes`, reusing its allocation.
fn decompress_frames_into(
    frames: &[SizedFrame<'_>],
    mut bytes: Vec<u8>,
) -> std::io::Result<Vec<u8>> {
    bytes.clear();
    bytes.resize(frames.iter().map(|(_, size)| size).sum(), 0);
    let mut destinations = Vec::with_capacity(frames.len());
    let mut unassigned = bytes.as_mut_slice();
    for (_, size) in frames {
        let (destination, tail) = unassigned.split_at_mut(*size);
        destinations.push(destination);
        unassigned = tail;
    }
    frames
        .par_iter()
        .zip(destinations)
        .try_for_each(|((frame, size), destination)| {
            let written = zstd::bulk::decompress_to_buffer(frame, destination)?;
            if written != *size {
                return Err(std::io::Error::other(format!(
                    "zstd frame decompressed to {written} bytes, its header says {size}"
                )));
            }
            Ok(())
        })?;
    Ok(bytes)
}

/// A bincode reader over batches of decompressed frames, received in order.
struct FrameBatchReader {
    batches: std::sync::mpsc::Receiver<std::io::Result<Vec<u8>>>,
    /// Where finished batches go back to be refilled.
    spent: std::sync::mpsc::Sender<Vec<u8>>,
    current: Vec<u8>,
    position: usize,
}

impl FrameBatchReader {
    fn next_batch(
        &mut self,
        additional: usize,
    ) -> std::result::Result<(), bincode::error::DecodeError> {
        match self.batches.recv() {
            Ok(Ok(batch)) => {
                let spent = std::mem::replace(&mut self.current, batch);
                self.spent.send(spent).ok();
                self.position = 0;
                Ok(())
            }
            Ok(Err(inner)) => Err(bincode::error::DecodeError::Io { inner, additional }),
            Err(_) => Err(bincode::error::DecodeError::UnexpectedEnd { additional }),
        }
    }
}

impl bincode::de::read::Reader for FrameBatchReader {
    fn read(&mut self, bytes: &mut [u8]) -> std::result::Result<(), bincode::error::DecodeError> {
        let mut filled = 0;
        while filled < bytes.len() {
            if self.position == self.current.len() {
                self.next_batch(bytes.len() - filled)?;
            }
            let len = (bytes.len() - filled).min(self.current.len() - self.position);
            bytes[filled..filled + len]
                .copy_from_slice(&self.current[self.position..self.position + len]);
            filled += len;
            self.position += len;
        }
        Ok(())
    }

    fn peek_read(&mut self, len: usize) -> Option<&[u8]> {
        self.current.get(self.position..self.position + len)
    }

    fn consume(&mut self, len: usize) {
        self.position += len;
    }
}

/// Frames the saved-state reader decompresses at a time while it decodes the
/// previous batch. Decoding is the slow part, so four threads keep up while
/// only a few frames of decompressed data are held. They are a pool of their
/// own: decompressing on every thread of the global pool leaves allocator
/// memory behind on each.
const SAVED_STATE_FRAMES_PER_BATCH: usize = 4;

/// Decodes the concatenated contents of `frames`, decompressing `batch` frames
/// at a time on another thread while the previous batch is decoded.
fn decode_frames_pipelined<T: serde::de::DeserializeOwned>(
    frames: &[SizedFrame<'_>],
    batch: usize,
) -> std::result::Result<T, bincode::error::DecodeError> {
    std::thread::scope(|scope| {
        let (sender, batches) = std::sync::mpsc::sync_channel(0);
        let (spent, buffers) = std::sync::mpsc::channel();
        scope.spawn(move || {
            let pool = match rayon::ThreadPoolBuilder::new().num_threads(batch).build() {
                Ok(pool) => pool,
                Err(err) => {
                    sender.send(Err(std::io::Error::other(err))).ok();
                    return;
                }
            };
            for frames in frames.chunks(batch) {
                let buffer = buffers.try_recv().unwrap_or_default();
                let decompressed = pool.install(|| decompress_frames_into(frames, buffer));
                let failed = decompressed.is_err();
                // Stops when the decoder does: it drops the receiver.
                if sender.send(decompressed).is_err() || failed {
                    break;
                }
            }
        });
        bincode::serde::decode_from_reader(
            FrameBatchReader {
                batches,
                spent,
                current: vec![],
                position: 0,
            },
            bincode::config::legacy(),
        )
    })
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use schema_diff::definitions::DefinitionChange;

    use super::*;

    #[test]
    fn frames_decompress_in_parallel_and_as_one_stream() {
        let bytes: Vec<u8> = (0..1_000_000u32).map(|i| (i % 251) as u8).collect();
        let compressed = compress_in_frames(&bytes, 100_000, 3).unwrap().concat();

        let frames = sized_frames(&compressed).unwrap().unwrap();
        assert_eq!(decompress_frames_into(&frames, vec![]).unwrap(), bytes);
        assert_eq!(
            zstd::decode_all(compressed.as_slice()).unwrap(),
            bytes,
            "a streaming decoder, like older compilers use, reads the frames as one stream",
        );
    }

    #[test]
    fn single_or_streamed_frame_is_not_decompressed_in_parallel() {
        let bytes = vec![7u8; 1000];
        let single = compress_in_frames(&bytes, bytes.len(), 3).unwrap().concat();
        let streamed = zstd::encode_all(bytes.as_slice(), 3).unwrap();

        assert!(sized_frames(&single).unwrap().is_none());
        assert!(
            sized_frames(&[streamed.clone(), streamed].concat())
                .unwrap()
                .is_none(),
            "streamed frames don't record their size",
        );
    }

    #[test]
    fn saved_state_round_trips_in_both_formats() {
        let dir = tempfile::tempdir().unwrap();
        for independent_frames in [true, false] {
            let path = dir.path().join(format!("state-{independent_frames}"));
            let state = CompilerState {
                saved_state_version: "v1".to_owned(),
                ..Default::default()
            };
            state
                .serialize_to_file_with_frames(&path, independent_frames)
                .unwrap();

            for parallel_frames in [true, false] {
                let read = CompilerState::deserialize_from_file_with_frames(&path, parallel_frames)
                    .unwrap();
                assert_eq!(read.saved_state_version, "v1");
            }
        }
    }

    #[test]
    fn only_frames_that_record_their_size_take_the_parallel_path() {
        let dir = tempfile::tempdir().unwrap();
        let bytes = vec![7u8; 1000];
        let cases = [
            (compress_in_frames(&bytes, 100, 3).unwrap().concat(), true),
            (zstd::encode_all(bytes.as_slice(), 3).unwrap(), false),
        ];
        for (i, (compressed, records_size)) in cases.into_iter().enumerate() {
            let path = dir.path().join(i.to_string());
            std::fs::write(&path, compressed).unwrap();
            let mut file = FsFile::open(&path).unwrap();

            assert_eq!(first_frame_records_size(&mut file).unwrap(), records_size);
            assert_eq!(
                file.stream_position().unwrap(),
                0,
                "leaves the file at its start"
            );
        }
    }

    #[test]
    fn pipelined_decode_matches_decoding_the_whole_buffer() {
        let values: Vec<u64> = (0..100_000).map(|i| i * 7919).collect();
        let bytes = bincode::serde::encode_to_vec(&values, bincode::config::legacy()).unwrap();
        // Eight frames that split encoded values, the last one partial.
        let compressed = compress_in_frames(&bytes, 100_003, 3).unwrap().concat();
        let frames = sized_frames(&compressed).unwrap().unwrap();
        assert_eq!(frames.len(), 8);
        for batch in [1, 2, 3, 16] {
            let decoded: Vec<u64> = decode_frames_pipelined(&frames, batch).unwrap();
            assert_eq!(decoded, values, "batch: {batch}");
        }

        let first: u64 = decode_frames_pipelined(&frames, 1).unwrap();
        assert_eq!(
            first,
            values.len() as u64,
            "stops early without waiting for the rest"
        );

        let truncated = &frames[..frames.len() / 2];
        assert!(matches!(
            decode_frames_pipelined::<Vec<u64>>(truncated, 4),
            Err(bincode::error::DecodeError::UnexpectedEnd { .. })
        ));
    }

    #[test]
    fn pipelined_decode_reports_a_failed_batch() {
        let (sender, batches) = std::sync::mpsc::sync_channel(1);
        sender
            .send(Err(std::io::Error::other("corrupt frame")))
            .unwrap();
        let reader = FrameBatchReader {
            batches,
            spent: std::sync::mpsc::channel().0,
            current: vec![],
            position: 0,
        };
        assert!(matches!(
            bincode::serde::decode_from_reader::<u64, _, _>(reader, bincode::config::legacy()),
            Err(bincode::error::DecodeError::Io { .. })
        ));
    }

    #[test]
    fn frames_written_while_encoding_match_compressing_the_whole_encoding() {
        let values: Vec<u64> = (0..100_000).map(|i| i * 7919).collect();
        let bytes = bincode::serde::encode_to_vec(&values, bincode::config::legacy()).unwrap();
        // Eight frames, the last one partial.
        let expected = compress_in_frames(&bytes, 100_003, 3).unwrap().concat();
        for threads in [1, 2, 3, 16] {
            let mut written = vec![];
            assert!(
                write_in_frames(&values, &mut written, 100_003, threads, || zstd_compressor(
                    3
                ))
                .is_ok()
            );
            assert_eq!(written, expected, "threads: {threads}");
        }
        assert_eq!(zstd::decode_all(expected.as_slice()).unwrap(), bytes);
        let frames = sized_frames(&expected).unwrap().unwrap();
        let decoded: Vec<u64> = decode_frames_pipelined(&frames, 4).unwrap();
        assert_eq!(decoded, values);
        assert_eq!(saved_state_compression_threads(1), 1);
        assert_eq!(saved_state_compression_threads(26), 19);
        assert_eq!(saved_state_compression_threads(176), 64);

        struct Failing;
        impl IoWrite for Failing {
            fn write(&mut self, _: &[u8]) -> std::io::Result<usize> {
                Err(std::io::Error::other("disk full"))
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Ok(())
            }
        }
        assert!(matches!(
            write_in_frames(&values, Failing, 100_003, 2, || zstd_compressor(3)),
            Err(FrameWriteError::Io(_))
        ));
    }

    /// Runs `write_in_frames` with `compress` on another thread and returns
    /// whether it failed, giving up if it takes more than 30 seconds.
    fn write_in_frames_fails_with(
        compress: fn(&[u8], &mut Vec<u8>) -> std::io::Result<()>,
    ) -> bool {
        let (sender, result) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let values: Vec<u64> = (0..100_000).collect();
            let written = write_in_frames(&values, std::io::sink(), 1_000, 2, || Ok(compress));
            sender.send(written.is_err()).ok();
        });
        result
            .recv_timeout(std::time::Duration::from_secs(30))
            .expect("write_in_frames hung")
    }

    #[test]
    fn a_failed_compression_stops_writing_frames() {
        static CALLS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        // The first chunk handed out fails while hundreds more are pending.
        assert!(write_in_frames_fails_with(|chunk, frame| {
            if CALLS.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 0 {
                return Err(std::io::Error::other("compression failed"));
            }
            frame.extend_from_slice(chunk);
            Ok(())
        }));
    }

    #[test]
    fn a_panicking_compression_stops_writing_frames() {
        static CALLS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        assert!(write_in_frames_fails_with(|chunk, frame| {
            if CALLS.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 0 {
                panic!("compression panicked");
            }
            frame.extend_from_slice(chunk);
            Ok(())
        }));
    }

    #[test]
    fn chunks_wait_for_frames_written_beyond_the_window() {
        let (chunk_sender, chunks) = std::sync::mpsc::sync_channel(16);
        let (_spare_sender, spare) = std::sync::mpsc::channel();
        let (written_sender, written) = std::sync::mpsc::channel();
        let encoder = std::thread::spawn(move || {
            let mut chunk_writer = ChunkWriter {
                chunk: vec![],
                frame_size: 1,
                index: 0,
                chunks: chunk_sender,
                spare,
                written,
                written_count: 0,
                window: 3,
            };
            chunk_writer.write_all(&[0; 5]).unwrap();
        });
        for index in 0..3 {
            assert_eq!(chunks.recv().unwrap().0, index);
        }
        assert!(
            chunks
                .recv_timeout(std::time::Duration::from_millis(200))
                .is_err(),
            "a fourth chunk waits until the first frame is written",
        );
        written_sender.send(()).unwrap();
        assert_eq!(chunks.recv().unwrap().0, 3);
        written_sender.send(()).unwrap();
        assert_eq!(chunks.recv().unwrap().0, 4);
        encoder.join().unwrap();
    }

    #[test]
    fn frames_larger_than_ours_are_not_decompressed_in_parallel() {
        let bytes = vec![7u8; SAVED_STATE_FRAME_SIZE + 1];
        let compressed = compress_in_frames(&bytes, bytes.len(), 1).unwrap().concat();

        assert!(
            sized_frames(&[compressed.clone(), compressed].concat())
                .unwrap()
                .is_none()
        );
    }

    impl Source for Vec<u32> {
        fn is_empty(&self) -> bool {
            self.is_empty()
        }
    }

    #[test]
    fn empty_pending_incremental_source_overwrites_existing_pending_source() {
        let mut incremental_source: IncrementalSources<Vec<u32>> = IncrementalSources::default();

        let a = PathBuf::new();

        let mut initial = FnvHashMap::default();
        initial.insert(a.clone(), vec![1, 2, 3]);

        // Starting with a pending source of a => [1, 2, 3]
        incremental_source.merge_pending_sources(&initial);

        assert_eq!(incremental_source.pending.get(&a), Some(&vec![1, 2, 3]));

        let mut update: FnvHashMap<PathBuf, Vec<u32>> = FnvHashMap::default();
        update.insert(a.clone(), Vec::new());

        // Merge in a pending source of a => []
        incremental_source.merge_pending_sources(&update);

        // Pending for a should now be empty
        assert_eq!(incremental_source.pending.get(&a), Some(&vec![]));
    }

    #[test]
    fn empty_pending_incremental_is_ignored_if_no_processed_source_exists() {
        let mut incremental_source: IncrementalSources<Vec<u32>> = IncrementalSources::default();

        let a = PathBuf::new();

        let mut update: FnvHashMap<PathBuf, Vec<u32>> = FnvHashMap::default();
        update.insert(a.clone(), Vec::new());

        // Merge in a pending source of a => []
        incremental_source.merge_pending_sources(&update);

        // Pending for a should not be populated
        assert_eq!(incremental_source.pending.get(&a), None);
    }

    #[test]
    fn empty_pending_incremental_is_ignored_if_no_processed_source_is_empty() {
        let mut incremental_source: IncrementalSources<Vec<u32>> = IncrementalSources::default();

        let a = PathBuf::new();

        incremental_source.processed.insert(a.clone(), Vec::new());

        let mut update: FnvHashMap<PathBuf, Vec<u32>> = FnvHashMap::default();
        update.insert(a.clone(), Vec::new());

        // Merge in a pending source of a => []
        incremental_source.merge_pending_sources(&update);

        // Pending for a should not be populated
        assert_eq!(incremental_source.pending.get(&a), None);
    }

    // --- CompactSchemaSources::get_current_bytes tests ---

    #[test]
    fn get_current_bytes_with_only_pending() {
        let mut sources: CompactSchemaSources = IncrementalSources::default();
        sources
            .pending
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);
        assert_eq!(sources.get_current_bytes(), Some(&vec![1, 2, 3]));
    }

    #[test]
    fn get_current_bytes_with_only_processed() {
        let mut sources: CompactSchemaSources = IncrementalSources::default();
        sources
            .processed
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);
        assert_eq!(sources.get_current_bytes(), Some(&vec![1, 2, 3]));
    }

    #[test]
    fn get_current_bytes_pending_overrides_processed() {
        let mut sources: CompactSchemaSources = IncrementalSources::default();
        let path = PathBuf::from("schema.bin");
        sources.processed.insert(path.clone(), vec![1, 2, 3]);
        sources.pending.insert(path, vec![4, 5, 6]);
        assert_eq!(sources.get_current_bytes(), Some(&vec![4, 5, 6]));
    }

    #[test]
    fn get_current_bytes_empty_sources() {
        let sources: CompactSchemaSources = IncrementalSources::default();
        assert_eq!(sources.get_current_bytes(), None);
    }

    #[test]
    fn get_current_bytes_skips_empty_pending() {
        // An empty pending vec is treated as a deletion; get_current_bytes
        // filters out empty entries via get_all_non_empty.
        let mut sources: CompactSchemaSources = IncrementalSources::default();
        sources
            .pending
            .insert(PathBuf::from("schema.bin"), Vec::new());
        assert_eq!(sources.get_current_bytes(), None);
    }

    // --- CompactSchemaSources::get_old_bytes tests ---

    #[test]
    fn get_old_bytes_returns_processed() {
        let mut sources: CompactSchemaSources = IncrementalSources::default();
        sources
            .processed
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);
        assert_eq!(sources.get_old_bytes(), Some(&vec![1, 2, 3]));
    }

    #[test]
    fn get_old_bytes_ignores_pending() {
        // get_old_bytes only looks at processed, not pending.
        let mut sources: CompactSchemaSources = IncrementalSources::default();
        sources
            .pending
            .insert(PathBuf::from("schema.bin"), vec![4, 5, 6]);
        assert_eq!(sources.get_old_bytes(), None);
    }

    #[test]
    fn get_old_bytes_skips_empty_processed() {
        let mut sources: CompactSchemaSources = IncrementalSources::default();
        sources
            .processed
            .insert(PathBuf::from("schema.bin"), Vec::new());
        assert_eq!(sources.get_old_bytes(), None);
    }

    #[test]
    fn get_old_bytes_empty_sources() {
        let sources: CompactSchemaSources = IncrementalSources::default();
        assert_eq!(sources.get_old_bytes(), None);
    }

    // --- CompilerState::projects_share_pending_schemas tests ---

    use common::NoopPerfLoggerEvent;
    use intern::string_key::Intern;

    fn project(name: &str) -> ProjectName {
        name.intern().into()
    }

    /// Records the keys logged to it.
    #[derive(Default)]
    struct RecordingLogEvent {
        keys: std::sync::Mutex<Vec<&'static str>>,
    }

    impl PerfLogEvent for RecordingLogEvent {
        type Timer = ();
        fn number(&self, name: &'static str, _number: usize) {
            self.keys.lock().unwrap().push(name);
        }
        fn bool(&self, name: &'static str, _value: bool) {
            self.keys.lock().unwrap().push(name);
        }
        fn string(&self, name: &'static str, _value: String) {
            self.keys.lock().unwrap().push(name);
        }
        fn start(&self, _name: &'static str) -> Self::Timer {}
        fn stop(&self, _timer: Self::Timer) {}
        fn complete(self) {}
    }

    #[test]
    fn schema_change_safety_logs_base_project_kinds_under_their_own_keys() {
        let mut state = CompilerState::default();
        let proj = project("my_project");
        let mut schemas: SchemaSources = IncrementalSources::default();
        schemas.processed.insert(
            PathBuf::from("schema.graphql"),
            "type Query { hello: String }".to_string(),
        );
        schemas.pending.insert(
            PathBuf::from("schema.graphql"),
            "type Query { hello: Int }".to_string(),
        );
        state.schemas.insert(proj, schemas);

        let log_event = RecordingLogEvent::default();
        state.schema_change_safety(
            &log_event,
            proj,
            &Default::default(),
            None,
            true,
            SchemaChangeCheck::Project,
        );
        state.schema_change_safety(
            &log_event,
            proj,
            &Default::default(),
            None,
            true,
            SchemaChangeCheck::BaseProject,
        );
        let keys = log_event.keys.into_inner().unwrap();
        for key in [
            "schema_change_count",
            "schema_change_kinds",
            "base_schema_change_count",
            "base_schema_change_kinds",
        ] {
            assert_eq!(
                keys.iter().filter(|logged| **logged == key).count(),
                1,
                "{key} should be logged once in {keys:?}"
            );
        }
    }

    #[test]
    fn projects_share_pending_schemas_sdl_only_matching() {
        let mut state = CompilerState::default();
        let a = project("project_a");
        let b = project("project_b");

        let mut schemas_a: SchemaSources = IncrementalSources::default();
        schemas_a.pending.insert(
            PathBuf::from("schema.graphql"),
            "type Query { hello: String }".to_string(),
        );
        let mut schemas_b: SchemaSources = IncrementalSources::default();
        schemas_b.pending.insert(
            PathBuf::from("schema.graphql"),
            "type Query { hello: String }".to_string(),
        );

        state.schemas.insert(a, schemas_a);
        state.schemas.insert(b, schemas_b);

        assert!(state.projects_share_pending_schemas(a, b));
    }

    #[test]
    fn projects_share_pending_schemas_sdl_only_different() {
        let mut state = CompilerState::default();
        let a = project("project_a");
        let b = project("project_b");

        let mut schemas_a: SchemaSources = IncrementalSources::default();
        schemas_a.pending.insert(
            PathBuf::from("schema.graphql"),
            "type Query { hello: String }".to_string(),
        );
        let mut schemas_b: SchemaSources = IncrementalSources::default();
        schemas_b.pending.insert(
            PathBuf::from("schema.graphql"),
            "type Query { world: String }".to_string(),
        );

        state.schemas.insert(a, schemas_a);
        state.schemas.insert(b, schemas_b);

        assert!(!state.projects_share_pending_schemas(a, b));
    }

    #[test]
    fn projects_share_pending_schemas_flatbuffer_only_matching() {
        let mut state = CompilerState::default();
        let a = project("project_a");
        let b = project("project_b");

        let mut fb_a: CompactSchemaSources = IncrementalSources::default();
        fb_a.pending
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);
        let mut fb_b: CompactSchemaSources = IncrementalSources::default();
        fb_b.pending
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);

        state.compact_schemas.insert(a, fb_a);
        state.compact_schemas.insert(b, fb_b);

        assert!(state.projects_share_pending_schemas(a, b));
    }

    #[test]
    fn projects_share_pending_schemas_flatbuffer_only_different() {
        let mut state = CompilerState::default();
        let a = project("project_a");
        let b = project("project_b");

        let mut fb_a: CompactSchemaSources = IncrementalSources::default();
        fb_a.pending
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);
        let mut fb_b: CompactSchemaSources = IncrementalSources::default();
        fb_b.pending
            .insert(PathBuf::from("schema.bin"), vec![4, 5, 6]);

        state.compact_schemas.insert(a, fb_a);
        state.compact_schemas.insert(b, fb_b);

        assert!(!state.projects_share_pending_schemas(a, b));
    }

    #[test]
    fn projects_share_pending_schemas_mixed_sdl_and_flatbuffer() {
        // One project has only SDL schemas, the other has only flatbuffer
        // schemas. Since each lookup returns (Some, None) or (None, Some),
        // neither sdl_match nor fb_match can be true.
        let mut state = CompilerState::default();
        let a = project("project_a");
        let b = project("project_b");

        let mut schemas_a: SchemaSources = IncrementalSources::default();
        schemas_a.pending.insert(
            PathBuf::from("schema.graphql"),
            "type Query { hello: String }".to_string(),
        );
        state.schemas.insert(a, schemas_a);

        let mut fb_b: CompactSchemaSources = IncrementalSources::default();
        fb_b.pending
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);
        state.compact_schemas.insert(b, fb_b);

        assert!(!state.projects_share_pending_schemas(a, b));
    }

    // --- CompilerState::project_has_pending_schema_changes tests ---

    #[test]
    fn project_has_pending_schema_changes_with_pending_flatbuffer() {
        let mut state = CompilerState::default();
        let proj = project("my_project");

        let mut fb: CompactSchemaSources = IncrementalSources::default();
        fb.pending
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);
        state.compact_schemas.insert(proj, fb);

        assert!(state.project_has_pending_schema_changes(proj));
    }

    #[test]
    fn project_has_pending_schema_changes_no_pending_flatbuffer() {
        // Only processed flatbuffer data, no pending changes.
        let mut state = CompilerState::default();
        let proj = project("my_project");

        let mut fb: CompactSchemaSources = IncrementalSources::default();
        fb.processed
            .insert(PathBuf::from("schema.bin"), vec![1, 2, 3]);
        state.compact_schemas.insert(proj, fb);

        assert!(!state.project_has_pending_schema_changes(proj));
    }

    #[test]
    fn project_has_pending_schema_changes_no_schemas() {
        let state = CompilerState::default();
        let proj = project("nonexistent");

        assert!(!state.project_has_pending_schema_changes(proj));
    }

    #[test]
    fn schema_change_for_logging_keeps_small_diff() {
        let schema_change =
            SchemaChange::DefinitionChanges(vec![DefinitionChange::ObjectAdded("User".intern())]);

        assert_eq!(
            schema_change_for_logging(&schema_change),
            schema_change.to_string(),
            "a diff under the limit should be logged in full"
        );
    }

    #[test]
    fn schema_change_for_logging_truncates_large_diff() {
        let schema_change = SchemaChange::DefinitionChanges(
            (0..1000)
                .map(|index| DefinitionChange::ObjectAdded(format!("Type{index}").intern()))
                .collect(),
        );
        let full = schema_change.to_string();
        let logged = schema_change_for_logging(&schema_change);

        assert!(
            full.len() > MAX_LOGGED_SCHEMA_CHANGE_LEN,
            "test diff should exceed the limit"
        );
        assert!(
            logged.starts_with(&full[..MAX_LOGGED_SCHEMA_CHANGE_LEN]),
            "should keep the start of the diff: {logged}"
        );
        assert!(
            logged.ends_with("... (1000 definition changes)"),
            "should say how many changes there were: {logged}"
        );
    }

    fn schema_sources(processed: &[(&str, &str)], pending: &[(&str, &str)]) -> SchemaSources {
        let to_map = |entries: &[(&str, &str)]| {
            entries
                .iter()
                .map(|(path, source)| (PathBuf::from(path), source.to_string()))
                .collect()
        };
        IncrementalSources {
            processed: to_map(processed),
            pending: to_map(pending),
        }
    }

    #[test]
    fn get_changed_chunks_extends_chunks_to_a_definition_boundary_on_both_sides() {
        let sources = schema_sources(
            &[
                ("a", "type A { a: Int }"),
                ("b", "type B {"),
                ("c", "b: Int }"),
                ("d", "type D { d: Int }"),
            ],
            &[("a", "type A { a: Int }"), ("c", "b: String }")],
        );

        assert_eq!(
            sources.get_changed_chunks(),
            ChangedSchemaChunks {
                current: vec!["type B {\nb: String }".to_owned()],
                previous: vec!["type B {\nb: Int }".to_owned()],
                changed_file_count: 1,
            },
            "`c` continues `b`, so they form one chunk; touched-identical `a` and `d` are left out",
        );
    }

    /// The schema change with only changed chunks diffed, and with everything
    /// diffed, in a form that ignores the order of the definition changes.
    fn schema_changes_both_ways(
        processed: &[(&str, &str)],
        pending: &[(&str, &str)],
    ) -> (String, String) {
        let state = CompilerState::default();
        let sources = schema_sources(processed, pending);
        let canonical = |change: SchemaChange| match change {
            SchemaChange::DefinitionChanges(changes) => {
                let mut changes: Vec<_> = changes.iter().map(|c| format!("{c:?}")).collect();
                changes.sort();
                format!("{changes:?}")
            }
            change => format!("{change:?}"),
        };
        let get = |changed_chunks_only| {
            canonical(state.get_schema_change(
                None::<&NoopPerfLoggerEvent>,
                &sources,
                changed_chunks_only,
            ))
        };
        (get(true), get(false))
    }

    fn assert_same_schema_change(processed: &[(&str, &str)], pending: &[(&str, &str)]) {
        let (changed_chunks_only, everything) = schema_changes_both_ways(processed, pending);
        assert_eq!(changed_chunks_only, everything);
    }

    #[test]
    fn changed_chunks_split_definition_with_unchanged_middle_file() {
        // `U` spans the unchanged `2` and the changed `3`; the changed `1`
        // starts `T`, which `2` finishes.
        assert_same_schema_change(
            &[
                ("0", "type Query { t: T uu: U }"),
                ("1", "type T {"),
                ("2", "x: Int }\ntype U {"),
                ("3", "u: Int }"),
            ],
            &[("1", "type T {\nw: Int"), ("3", "u: String }")],
        );
    }

    #[test]
    fn changed_chunks_same_content_renamed() {
        // Moving the text to another path reorders the joined schema, which the
        // full diff reports as a generic change; keep that.
        let (changed_chunks_only, everything) = schema_changes_both_ways(
            &[("a", "type Query { q: Int }"), ("b", "type B { x: Int }")],
            &[("b", ""), ("0", "type B { x: Int }")],
        );
        assert_eq!(everything, "GenericChange");
        assert_eq!(changed_chunks_only, everything);
    }

    #[test]
    fn changed_chunks_type_moved_between_files() {
        assert_same_schema_change(
            &[
                ("a", "type Query { a: A }\ntype A { x: Int }"),
                ("b", "type B { y: Int }"),
                ("c", "type C { z: Int }"),
            ],
            &[
                ("a", "type Query { a: A }"),
                ("b", "type B { y: Int }\ntype A { x: Int name: String }"),
            ],
        );
    }

    #[test]
    fn changed_chunks_extension_changed_with_base_elsewhere() {
        assert_same_schema_change(
            &[
                ("a", "type A { x: Int }"),
                ("b", "extend type A { y: Int }"),
            ],
            &[("b", "extend type A { z: Int }")],
        );
    }

    #[test]
    fn changed_chunks_only_directive_and_schema_definitions_changed() {
        assert_same_schema_change(
            &[
                ("a", "type Query { x: Int }"),
                ("b", "directive @d on FIELD\nschema { query: Query }"),
            ],
            &[(
                "b",
                "directive @d(a: Int) on FIELD\nschema { query: Query }",
            )],
        );
    }

    #[test]
    fn changed_chunks_file_ending_with_union_continues_into_next() {
        // Like WWW's dumped shards: a file may end with a union, so its chunk
        // runs into the next file.
        assert_same_schema_change(
            &[
                ("a", "type A { x: Int }\nunion U = A"),
                ("b", "type B { y: Int }"),
                ("c", "type C { z: Int }"),
            ],
            &[("b", "type B { y: Int w: Int }")],
        );
    }

    #[test]
    fn changed_chunks_added_and_deleted_files() {
        assert_same_schema_change(
            &[("a", "type A { x: Int }"), ("b", "enum E { ONE TWO }")],
            &[("b", ""), ("c", "type C { z: Int }")],
        );
    }

    #[test]
    fn changed_chunks_touched_identical_is_no_change() {
        let processed = [("a", "type Query { a: A }"), ("b", "type A { x: Int }")];
        assert_eq!(
            schema_changes_both_ways(&processed, &processed),
            ("None".to_owned(), "None".to_owned()),
        );
    }

    /// Small deterministic generator for the randomized test below.
    struct Lcg(u64);

    impl Lcg {
        fn below(&mut self, n: usize) -> usize {
            self.0 = self
                .0
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((self.0 >> 33) as usize) % n
        }
    }

    /// A generated definition as lines: `head` (description, comment, the
    /// line that opens it), `body`, and a closing `}` when `closed`.
    #[derive(Clone)]
    struct GeneratedDefinition {
        name: String,
        head: Vec<String>,
        body: Vec<String>,
        closed: bool,
    }

    impl GeneratedDefinition {
        fn lines(&self) -> Vec<String> {
            let mut lines = self.head.clone();
            lines.extend(self.body.iter().cloned());
            if self.closed {
                lines.push("}".to_owned());
            }
            lines
        }

        fn random(rng: &mut Lcg, i: usize) -> Self {
            let scalar = |rng: &mut Lcg| ["Int", "String", "ID", "[Int]", "Int!"][rng.below(5)];
            let definition = |name: String, head: Vec<String>, body: Vec<String>| Self {
                name,
                head,
                body,
                closed: true,
            };
            match rng.below(8) {
                0 => definition(
                    format!("E{i}"),
                    vec![format!("enum E{i} {{")],
                    (0..1 + rng.below(3)).map(|v| format!("V{v}")).collect(),
                ),
                1 => Self {
                    name: format!("U{i}"),
                    head: vec![format!("union U{i} = T0 | T1")],
                    body: vec![],
                    closed: false,
                },
                // Default values ending in `}` put an inner `}` at a line end.
                2 => definition(
                    format!("In{i}"),
                    vec![format!("input In{i} {{")],
                    vec![
                        "a: Int = 1".to_owned(),
                        "b: In0 = {x: 1}".to_owned(),
                        "c: [String] = [\"s\"]".to_owned(),
                    ],
                ),
                3 => definition(
                    format!("I{i}"),
                    vec![format!("interface I{i} {{")],
                    vec!["id: ID".to_owned()],
                ),
                4 => definition(
                    format!("X{i}"),
                    vec![format!("extend type T{} {{", rng.below(4))],
                    vec![format!("e{i}: Int")],
                ),
                _ => {
                    let mut head = vec![];
                    if rng.below(3) == 0 {
                        head.push(format!("\"\"\"Doc {i}\"\"\""));
                    }
                    if rng.below(3) == 0 {
                        head.push("# comment".to_owned());
                    }
                    let implements = if rng.below(3) == 0 {
                        " implements I3"
                    } else {
                        ""
                    };
                    head.push(format!("type T{i}{implements} {{"));
                    let body = (0..2 + rng.below(3))
                        .map(|f| {
                            // A directive object argument also ends a line in `}`.
                            let directive = if rng.below(4) == 0 {
                                " @d(o: {k: 1})"
                            } else {
                                ""
                            };
                            format!("f{f}: {}{directive}", scalar(rng))
                        })
                        .collect();
                    definition(format!("T{i}"), head, body)
                }
            }
        }

        fn edit(&mut self, rng: &mut Lcg, n: usize) {
            let new_line = if self
                .head
                .last()
                .is_some_and(|head| head.starts_with("enum"))
            {
                format!("NEW{n}")
            } else if self
                .head
                .last()
                .is_some_and(|head| head.starts_with("input"))
            {
                format!("g{n}: Int = {{x: {n}}}")
            } else {
                format!("g{n}: Int")
            };
            match rng.below(4) {
                0 if self.closed => self.body.push(new_line),
                1 if self.body.len() > 1 => {
                    self.body.remove(rng.below(self.body.len()));
                }
                2 if !self.body.is_empty() => {
                    let line = rng.below(self.body.len());
                    self.body[line] = self.body[line].replacen("Int", "String", 1);
                }
                _ => {
                    let head = self.head.last_mut().expect("has a head line");
                    if head.starts_with("union") {
                        head.push_str(" | T9");
                    } else if head.starts_with("type") && !head.contains("implements") {
                        *head = head.replacen(" {", " implements I1 {", 1);
                    } else {
                        self.head.insert(0, format!("\"\"\"Changed {n}\"\"\""));
                    }
                }
            }
        }
    }

    /// Renders definitions grouped by file index into `(path, text)` pairs.
    /// The last definition of a file may be split after line `split[name]`: it
    /// then finishes at the start of the next file, like a schema whose
    /// definitions run across files.
    fn render_files(
        definitions: &[(usize, GeneratedDefinition)],
        split: &FnvHashMap<String, usize>,
        file_count: usize,
    ) -> Vec<(String, String)> {
        let mut files = vec![String::new(); file_count + 1];
        for (i, (file, definition)) in definitions.iter().enumerate() {
            let lines = definition.lines();
            let last_in_file = definitions.get(i + 1).is_none_or(|(next, _)| next != file);
            let split_at = split
                .get(&definition.name)
                .filter(|_| last_in_file && lines.len() > 1)
                .map(|at| (*at).clamp(1, lines.len() - 1));
            let (head, tail) = match split_at {
                Some(at) => (lines[..at].join("\n"), Some(lines[at..].join("\n"))),
                None => (lines.join("\n"), None),
            };
            files[*file].push_str(&head);
            files[*file].push('\n');
            if let Some(tail) = tail {
                files[*file + 1].insert_str(0, &format!("{tail}\n"));
            }
        }
        files
            .into_iter()
            .enumerate()
            .map(|(i, text)| (format!("{i:02}.graphql"), text))
            .collect()
    }

    #[test]
    fn changed_chunks_match_full_diff_on_random_schemas() {
        let mut rng = Lcg(42);
        let mut used_changed_chunks = 0;
        for _ in 0..1000 {
            let file_count = 2 + rng.below(6);
            let mut definitions: Vec<(usize, GeneratedDefinition)> = (0..3 + rng.below(8))
                .map(|i| {
                    let definition = GeneratedDefinition::random(&mut rng, i);
                    (rng.below(file_count), definition)
                })
                .collect();
            definitions.sort_by_key(|(file, _)| *file);
            let split: FnvHashMap<String, usize> = definitions
                .iter()
                .filter_map(|(_, definition)| {
                    if rng.below(4) != 0 {
                        return None;
                    }
                    Some((definition.name.clone(), 1 + rng.below(4)))
                })
                .collect();

            let mut changed = definitions.clone();
            for n in 0..1 + rng.below(3) {
                let i = rng.below(changed.len());
                match rng.below(5) {
                    0 => {
                        changed.remove(i);
                        if changed.is_empty() {
                            break;
                        }
                    }
                    1 => changed[i].0 = rng.below(file_count),
                    _ => changed[i].1.edit(&mut rng, n),
                }
            }
            changed.sort_by_key(|(file, _)| *file);

            let processed = render_files(&definitions, &split, file_count);
            let pending = render_files(&changed, &split, file_count);
            let processed: Vec<(&str, &str)> = processed
                .iter()
                .map(|(p, t)| (p.as_str(), t.as_str()))
                .collect();
            let pending: Vec<(&str, &str)> = pending
                .iter()
                .map(|(p, t)| (p.as_str(), t.as_str()))
                .collect();

            if CompilerState::get_schema_change_of_changed_chunks(
                None::<&NoopPerfLoggerEvent>,
                &schema_sources(&processed, &pending),
            )
            .is_some()
            {
                used_changed_chunks += 1;
            }
            let (changed_chunks_only, everything) = schema_changes_both_ways(&processed, &pending);
            assert_eq!(
                changed_chunks_only, everything,
                "processed: {processed:?}\npending: {pending:?}"
            );
        }
        assert!(
            used_changed_chunks > 500,
            "most cases should take the changed-chunks path, took it {used_changed_chunks} times",
        );
    }

    #[test]
    fn schema_change_safety_same_with_changed_sources_only() {
        let processed = [
            ("0.graphql", "type Query { a: A b: B }"),
            ("1.graphql", "type A { id: ID }"),
            ("2.graphql", "enum B { X Y }"),
            ("3.graphql", "type C { id: ID }"),
        ];
        let pending = [
            ("1.graphql", "type A { id: ID }"),
            ("2.graphql", "enum B { X }"),
            ("3.graphql", ""),
        ];
        let current_sdl = "type Query { a: A b: B } type A { id: ID } enum B { X }";
        let schema = relay_schema::build_schema_with_extensions_parallel::<_, &str>(
            &[(current_sdl, SourceLocationKey::generated())],
            &[],
        )
        .unwrap();
        let proj = project("my_project");
        let mut state = CompilerState::default();
        state
            .schemas
            .insert(proj, schema_sources(&processed, &pending));

        assert!(
            matches!(
                state.schema_change_safety(
                    &NoopPerfLoggerEvent,
                    proj,
                    &Default::default(),
                    Some(&schema),
                    true,
                    SchemaChangeCheck::Project,
                ),
                SchemaChangeSafety::SafeWithIncrementalBuild(_)
            ),
            "removing an enum value and an object needs an incremental build",
        );
        // `None` is the base project's check, which builds the schema itself.
        for built_schema in [Some(&schema), None] {
            let safety = |changed_sources_only| {
                state.schema_change_safety(
                    &NoopPerfLoggerEvent,
                    proj,
                    &Default::default(),
                    built_schema,
                    changed_sources_only,
                    SchemaChangeCheck::Project,
                )
            };
            assert_eq!(safety(true), safety(false));
        }
    }

    #[test]
    fn schema_change_safety_falls_back_when_changed_file_splits_a_definition() {
        // `A` starts in the unchanged `0.graphql` and ends in the changed
        // `1.graphql`, which does not parse on its own.
        let processed = [
            ("0.graphql", "type Query { a: A }\ntype A {"),
            ("1.graphql", "id: ID }"),
        ];
        let pending = [("1.graphql", "id: ID name: String }")];
        let current_sdl = "type Query { a: A }\ntype A { id: ID name: String }";
        let schema = relay_schema::build_schema_with_extensions_parallel::<_, &str>(
            &[(current_sdl, SourceLocationKey::generated())],
            &[],
        )
        .unwrap();
        let proj = project("my_project");
        let mut state = CompilerState::default();
        state
            .schemas
            .insert(proj, schema_sources(&processed, &pending));

        let safety = |changed_sources_only| {
            state.schema_change_safety(
                &NoopPerfLoggerEvent,
                proj,
                &Default::default(),
                Some(&schema),
                changed_sources_only,
                SchemaChangeCheck::Project,
            )
        };

        assert!(
            matches!(safety(true), SchemaChangeSafety::Safe),
            "adding a field is safe once the whole definition is diffed",
        );
        assert!(matches!(safety(false), SchemaChangeSafety::Safe));
    }

    // --- Reusing pre-parsed server ASTs in the base project safety check ---

    fn sources_with_location(sources: &SchemaSources) -> Vec<(&str, SourceLocationKey)> {
        sources
            .get_sources_with_location()
            .into_iter()
            .map(|(schema, location_key)| (schema.as_str(), location_key))
            .collect()
    }

    /// Caches server ASTs for `source_project` the way
    /// `preparse_unique_server_schemas` does: parsed from its schema sources.
    fn cache_preparsed_server_asts(state: &mut CompilerState, source_project: ProjectName) {
        let documents = schema::parse_schema_with_extensions_parallel::<_, &str>(
            &sources_with_location(&state.schemas[&source_project]),
            &[],
        )
        .unwrap()
        .server;
        state.parsed_server_asts_cache.insert(
            PathBuf::from("schema"),
            ParsedServerAsts {
                source_project,
                documents: Arc::new(documents),
            },
        );
    }

    /// Caches server ASTs parsed from `sdl` for `source_project`, whatever its
    /// schema sources hold, so a test can tell whether they were used.
    fn cache_server_asts_from(state: &mut CompilerState, source_project: ProjectName, sdl: &str) {
        let documents = schema::parse_schema_with_extensions_parallel::<_, &str>(
            &[(sdl, SourceLocationKey::generated())],
            &[],
        )
        .unwrap()
        .server;
        state.parsed_server_asts_cache.insert(
            PathBuf::from("schema"),
            ParsedServerAsts {
                source_project,
                documents: Arc::new(documents),
            },
        );
    }

    #[test]
    fn parsed_server_asts_need_the_exact_sources_of_their_source_project() {
        let base = project("base");
        let producer = project("producer");
        let base_sources = [
            ("0.graphql", "type Query { a: A }"),
            ("1.graphql", "type A { id: ID }"),
        ];
        let has_match = |producer_sources: &[(&str, &str)]| {
            let mut state = CompilerState::default();
            state
                .schemas
                .insert(base, schema_sources(&base_sources, &[]));
            if !producer_sources.is_empty() {
                state
                    .schemas
                    .insert(producer, schema_sources(producer_sources, &[]));
            }
            cache_server_asts_from(&mut state, producer, "type Query { a: Int }");
            state
                .parsed_server_asts_for(&sources_with_location(&state.schemas[&base]))
                .is_some()
        };

        assert!(has_match(&base_sources), "same text, files and order");
        assert!(
            !has_match(&[
                ("0.graphql", "type Query { a: A }"),
                ("1.graphql", "type A { id: ID name: String }"),
            ]),
            "different text"
        );
        assert!(
            !has_match(&[
                ("0.graphql", "type Query { a: A }"),
                ("2.graphql", "type A { id: ID }"),
            ]),
            "same text in a differently named file, so a different location key"
        );
        assert!(
            !has_match(&[
                ("0.graphql", "type A { id: ID }"),
                ("1.graphql", "type Query { a: A }"),
            ]),
            "same texts in a different order"
        );
        assert!(
            !has_match(&[("0.graphql", "type Query { a: A }")]),
            "fewer files"
        );
        assert!(!has_match(&[]), "source project without schema sources");
    }

    #[test]
    fn safety_check_schema_is_built_from_matching_cached_server_asts() {
        use schema::Schema;

        let base = project("base");
        let mut state = CompilerState::default();
        state.schemas.insert(
            base,
            schema_sources(&[("0.graphql", "type Query { a: Int }")], &[]),
        );
        let has_query_field = |schema: &SDLSchema, name: &str| {
            schema
                .named_field(schema.query_type().unwrap(), name.intern())
                .is_some()
        };

        let schema = state
            .build_schema_for_safety_check(&state.schemas[&base])
            .unwrap();
        assert!(
            has_query_field(&schema, "a"),
            "without a cache entry the schema is parsed from the sources"
        );

        cache_server_asts_from(&mut state, base, "type Query { b: Int }");
        let schema = state
            .build_schema_for_safety_check(&state.schemas[&base])
            .unwrap();
        assert!(
            has_query_field(&schema, "b") && !has_query_field(&schema, "a"),
            "a matching cache entry is used instead of parsing the sources"
        );

        cache_server_asts_from(&mut state, base, "type Query { a: Missing }");
        assert!(
            state
                .build_schema_for_safety_check(&state.schemas[&base])
                .is_err(),
            "cached ASTs that parsed but do not build still fail the build"
        );
    }

    #[test]
    fn base_project_safety_is_the_same_with_cached_server_asts() {
        let base = project("base");
        let producer = project("producer");
        let processed = [(
            "0.graphql",
            "type Query { a: A }\ntype A { id: ID name: String }",
        )];
        for pending in [
            // An added field.
            "type Query { a: A }\ntype A { id: ID name: String other: String }",
            // A removed field.
            "type Query { a: A }\ntype A { id: ID }",
            // A field of an unknown type: parses, but does not build.
            "type Query { a: A }\ntype A { id: ID name: String other: Missing }",
        ] {
            let mut state = CompilerState::default();
            let sources = || schema_sources(&processed, &[("0.graphql", pending)]);
            state.schemas.insert(base, sources());
            state.schemas.insert(producer, sources());
            let safety = |state: &CompilerState| {
                state.schema_change_safety(
                    &NoopPerfLoggerEvent,
                    base,
                    &Default::default(),
                    None,
                    true,
                    SchemaChangeCheck::BaseProject,
                )
            };

            let parsed_from_text = safety(&state);
            cache_preparsed_server_asts(&mut state, producer);
            assert!(
                state
                    .parsed_server_asts_for(&sources_with_location(&state.schemas[&base]))
                    .is_some()
            );
            assert_eq!(safety(&state), parsed_from_text, "pending: {pending}");
        }
    }

    #[test]
    fn complete_compilation_commits_built_projects_and_their_built_bases() {
        let base = project("base");
        let child = project("child");
        let sibling = project("sibling");
        let mut state = CompilerState::default();
        for name in [base, child, sibling] {
            state.schemas.insert(
                name,
                schema_sources(&[], &[("schema.graphql", "type A { x: Int }")]),
            );
            state.dirty_artifact_paths.insert(name, Default::default());
        }
        let configs = [
            project_config(base, None),
            project_config(child, Some(base)),
            project_config(sibling, None),
        ];

        state.complete_compilation(&configs, |name| name == base || name == child);

        assert!(!state.project_has_pending_schema_changes(child));
        assert!(
            !state.project_has_pending_schema_changes(base),
            "the base and its only consumer were built",
        );
        assert!(
            state.project_has_pending_schema_changes(sibling),
            "a project that wasn't built keeps its pending sources",
        );
        assert!(!state.dirty_artifact_paths.contains_key(&base));
        assert!(state.dirty_artifact_paths.contains_key(&sibling));
        assert_eq!(
            state.schema_change_safety(
                &NoopPerfLoggerEvent,
                base,
                &Default::default(),
                None,
                true,
                SchemaChangeCheck::BaseProject,
            ),
            SchemaChangeSafety::Safe,
            "the next build's base check sees no pending base change",
        );
    }

    fn project_config(name: ProjectName, base: Option<ProjectName>) -> ProjectConfig {
        ProjectConfig {
            name,
            base,
            ..Default::default()
        }
    }

    #[test]
    fn a_base_stays_pending_through_a_saved_state_until_all_its_consumers_are_built() {
        let base = project("base");
        let a = project("a");
        let b = project("b");
        let mut state = CompilerState::default();
        state.schemas.insert(
            base,
            schema_sources(
                &[("base.graphql", "type A { x: Int }")],
                &[("base.graphql", "type A { x: Int y: Int }")],
            ),
        );
        for name in [a, b] {
            state.schemas.insert(
                name,
                schema_sources(&[("schema.graphql", "type B { x: Int }")], &[]),
            );
        }
        let configs = [
            project_config(base, None),
            project_config(a, Some(base)),
            project_config(b, Some(base)),
        ];

        // `build -p a --export-state` after an edit to the base only.
        state.complete_compilation(&configs, |name| name == a);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("state");
        state.serialize_to_file(&path).unwrap();

        // Importing that state for `-p b` must still rebuild `b`, which builds
        // when its base has pending changes.
        let mut imported = CompilerState::deserialize_from_file(&path).unwrap();
        assert!(
            imported.project_has_pending_changes(base),
            "`b` and the base itself haven't consumed the base's change",
        );
        assert!(!imported.project_has_pending_changes(b));

        imported.complete_compilation(&configs, |_| true);
        assert!(!imported.project_has_pending_changes(base));
    }

    #[test]
    fn merge_changed_pending_sources_skips_only_unchanged_files_that_were_not_pending() {
        let mut sources = schema_sources(
            &[
                ("same.graphql", "type A { x: Int }"),
                ("changed.graphql", "type B { x: Int }"),
                ("reverted.graphql", "type C { x: Int }"),
            ],
            &[("reverted.graphql", "type C { y: Int }")],
        );
        let additional = [
            ("same.graphql", "type A { x: Int }"),
            ("changed.graphql", "type B { y: Int }"),
            ("reverted.graphql", "type C { x: Int }"),
            ("added.graphql", "type D { x: Int }"),
        ]
        .into_iter()
        .map(|(path, source)| (PathBuf::from(path), source.to_string()))
        .collect();

        sources.merge_changed_pending_sources(&additional);

        let mut pending: Vec<_> = sources
            .pending
            .iter()
            .map(|(path, source)| (path.to_str().unwrap(), source.as_str()))
            .collect();
        pending.sort_unstable();
        assert_eq!(
            pending,
            vec![
                ("added.graphql", "type D { x: Int }"),
                ("changed.graphql", "type B { y: Int }"),
                // A build may have used the pending `y` version, so the revert
                // stays pending and the next build rebuilds the schema.
                ("reverted.graphql", "type C { x: Int }"),
            ],
            "only the unchanged file that wasn't pending is skipped",
        );
    }
}
