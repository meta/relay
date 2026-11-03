/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! The config module provides functionality for managing the configuration of the Relay compiler.
use std::env::current_dir;
use std::ffi::OsStr;
use std::fmt;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;
use std::time::SystemTime;
use std::vec;

use async_trait::async_trait;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::FeatureFlag;
use common::FeatureFlags;
use common::Rollout;
use common::ScalarName;
use dunce::canonicalize;
use fnv::FnvBuildHasher;
use fnv::FnvHashSet;
use globset::Glob;
use globset::GlobSetBuilder;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use indexmap::IndexMap;
use intern::string_key::StringKey;
use js_config_loader::LoaderSource;
use log::warn;
use persist_query::PersistError;
use rayon::prelude::*;
use regex::Regex;
use relay_config::CustomType;
use relay_config::DiagnosticReportConfig;
pub use relay_config::ExtraArtifactsConfig;
use relay_config::JsModuleFormat;
pub use relay_config::LocalPersistConfig;
use relay_config::ModuleImportConfig;
pub use relay_config::PersistConfig;
pub use relay_config::ProcessPersistConfig;
pub use relay_config::ProjectConfig;
use relay_config::ProjectName;
use relay_config::RelayRscProjectConfig;
pub use relay_config::RemotePersistConfig;
use relay_config::ResolversSchemaModuleConfig;
use relay_config::SchemaConfig;
pub use relay_config::SchemaLocation;
use relay_config::TypegenConfig;
pub use relay_config::TypegenLanguage;
use relay_docblock::DocblockIr;
use relay_saved_state_loader::SavedStateLoader;
use relay_transforms::CustomTransformsConfig;
use schemars::JsonSchema;
use schemars::SchemaGenerator;
use schemars::generate::SchemaSettings;
use schemars::{self};
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::de::Error as DeError;
use serde_json::Value;
use sha1::Digest;
use sha1::Sha1;
use tokio::sync::broadcast;
use watchman_client::pdu::ScmAwareClockData;

use crate::GraphQLAsts;
use crate::build_project::AdditionalValidations;
use crate::build_project::artifact_writer::ArtifactFileWriter;
use crate::build_project::artifact_writer::ArtifactWriter;
use crate::build_project::generate_extra_artifacts::GenerateExtraArtifactsFn;
use crate::build_project::get_artifacts_file_hash_map::GetArtifactsFileHashMapFn;
use crate::compiler_state::CompilerState;
use crate::compiler_state::DeserializableProjectSet;
use crate::compiler_state::ProjectSet;
use crate::errors::ConfigValidationError;
use crate::errors::Error;
use crate::errors::Result;
use crate::file_system::FileSystem;
use crate::file_system::StdFileSystem;
use crate::path_validator::PathValidator;
use crate::source_control_for_root;
use crate::status_reporter::BuildStatus;
use crate::status_reporter::ConsoleStatusReporter;
use crate::status_reporter::StatusReporter;

pub type FnvIndexMap<K, V> = IndexMap<K, V, FnvBuildHasher>;

type PostArtifactsWriter = Box<
    dyn Fn(&Config) -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>>
        + Send
        + Sync,
>;

type OperationPersisterCreator =
    Box<dyn Fn(&ProjectConfig) -> Option<Box<dyn OperationPersister + Send + Sync>> + Send + Sync>;

type UpdateCompilerStateFromSavedState =
    Option<Box<dyn Fn(&mut CompilerState, &Config) + Send + Sync>>;

type ShouldExtractFullSource = Box<dyn Fn(&str) -> bool + Send + Sync>;

type GenerateVirtualIdFieldName =
    Box<dyn Fn(&ProjectConfig, &OperationDefinition, &Program) -> Option<StringKey> + Send + Sync>;

type CustomExtractRelayResolvers = Box<
    dyn Fn(
            ProjectName,
            &FnvIndexMap<ScalarName, CustomType>,
            &CompilerState,
            Option<&GraphQLAsts>,
            &FeatureFlag,
        ) -> DiagnosticsResult<(Vec<DocblockIr>, Vec<DocblockIr>)>
        // (Types, Fields)
        + Send
        + Sync,
>;

type CustomOverrideSchemaDeterminator =
    Box<dyn Fn(&ProjectConfig, &OperationDefinition) -> Option<String> + Send + Sync>;

/// Reason the daemon should exit and be restarted by its supervisor.
#[derive(Debug, Clone)]
pub enum RestartReason {
    /// The on-disk config file's bytes differ from the snapshot taken at
    /// daemon startup. `before`/`after` are SHA1 hex digests for logging.
    ConfigChanged {
        path: PathBuf,
        before: String,
        after: String,
    },
    /// The on-disk binary at `path` has a different mtime than at startup,
    /// implying a deploy landed under the running daemon.
    BinaryChanged { path: PathBuf },
}

/// Snapshot of the inputs that contribute to a saved-state version match,
/// captured at daemon startup. Used by [`Compiler::watch`] to detect when
/// the running daemon has drifted from the on-disk Relay binary or config
/// and should exit so a fresh process can match the current saved state.
///
/// Motivation: the dominant source of saved-state version mismatches on
/// user OD instances is a Relay binary or config change landing after the
/// daemon was started (during OD warmup), so the warmed cache on disk no
/// longer matches what the long-lived daemon expects. Restarting the
/// daemon when the on-disk binary/config drifts eliminates that class of
/// mismatch — the next client invocation respawns a fresh daemon via
/// `ensure_daemon_running` against the current `current_exe()`.
#[derive(Debug, Clone)]
pub struct DaemonRestartSignals {
    /// Path to the on-disk config file the daemon was started with.
    config_path: PathBuf,
    /// SHA1 hex of `config_path`'s raw bytes at daemon startup. Compared
    /// only as a fallback when [`Self::startup_config_mtime`] /
    /// [`Self::startup_config_size`] indicate a possible change, to avoid
    /// re-reading the full file on every check.
    startup_config_hash: String,
    /// mtime of `config_path` at startup, used as a cheap pre-filter.
    startup_config_mtime: Option<SystemTime>,
    /// Size of `config_path` at startup, used as a cheap pre-filter.
    startup_config_size: Option<u64>,
    /// Path to the running binary (`std::env::current_exe()`), if detectable.
    /// On non-Linux platforms or unusual launch paths this can be `None`,
    /// in which case binary-change detection is skipped.
    binary_path: Option<PathBuf>,
    /// mtime of `binary_path` at startup, if detectable.
    startup_binary_mtime: Option<SystemTime>,
}

impl DaemonRestartSignals {
    /// Snapshot the config bytes and binary mtime. Returns `None` if the
    /// config file at `config_path` can't be read (e.g. tests using a
    /// virtual path); detection is silently disabled in that case.
    ///
    /// `binary_path` is normally [`std::env::current_exe`] in production —
    /// taking it as a parameter lets tests inject a controllable tempfile
    /// for `BinaryChanged` coverage. Pass `None` to disable binary
    /// detection (the daemon will only react to config changes).
    pub fn try_capture(config_path: &Path, binary_path: Option<PathBuf>) -> Option<Self> {
        let config_bytes = std::fs::read(config_path).ok()?;
        let mut hasher = Sha1::new();
        hasher.update(&config_bytes);
        let startup_config_hash = hex::encode(hasher.finalize());

        let config_metadata = std::fs::metadata(config_path).ok();
        let startup_config_mtime = config_metadata.as_ref().and_then(|m| m.modified().ok());
        let startup_config_size = config_metadata.as_ref().map(|m| m.len());

        let startup_binary_mtime = binary_path
            .as_deref()
            .and_then(|p| std::fs::metadata(p).ok())
            .and_then(|m| m.modified().ok());

        Some(Self {
            config_path: config_path.to_owned(),
            startup_config_hash,
            startup_config_mtime,
            startup_config_size,
            binary_path,
            startup_binary_mtime,
        })
    }

    /// Re-read the on-disk config and binary metadata; return the first
    /// detected change, or `None` if nothing relevant has drifted.
    ///
    /// The config-side path uses an `(mtime, size)` pre-filter so the
    /// steady-state cost is a single `stat` syscall; only if mtime or size
    /// drifted do we re-read and re-hash the file. This is important
    /// because [`crate::Compiler::watch`]'s `incremental_build_loop` calls
    /// this on every Watchman notify — see knowledge entry
    /// `flag-performance-impact-of-file-io-in-the-compiler-hot-path-*`.
    ///
    /// Uses `tokio::fs` because the caller runs inside the Tokio runtime;
    /// blocking `std::fs` here would block the worker thread for the
    /// duration of the stat/read syscalls.
    pub async fn check(&self) -> Option<RestartReason> {
        if let Some(reason) = self.check_config().await {
            return Some(reason);
        }
        self.check_binary().await
    }

    async fn check_config(&self) -> Option<RestartReason> {
        // Cheap pre-filter: if both mtime and size match the startup
        // snapshot, the file is overwhelmingly likely unchanged. Skip the
        // expensive read+hash in the common case.
        //
        // False-negative caveat: if a writer preserves mtime AND keeps
        // the same file length (e.g. `cp --preserve=timestamps`, `touch
        // -r`, in-place edit that ends at the same offset), this branch
        // returns `None` and the hash comparison that would have caught
        // the change is skipped. In practice, builds spawn fresh daemons
        // routinely, so any missed change is caught at next daemon spawn
        // at the latest. If false negatives become a real problem,
        // remove the pre-filter and always hash.
        if let (Some(startup_mtime), Some(startup_size)) =
            (self.startup_config_mtime, self.startup_config_size)
            && let Ok(metadata) = tokio::fs::metadata(&self.config_path).await
            && let Ok(now_mtime) = metadata.modified()
            && now_mtime == startup_mtime
            && metadata.len() == startup_size
        {
            return None;
        }

        let bytes = match tokio::fs::read(&self.config_path).await {
            Ok(bytes) => bytes,
            Err(e) => {
                // Don't silently disable detection — the config file used
                // to be readable (we read it in `try_capture`), so a read
                // failure here is unexpected and worth surfacing in logs.
                warn!(
                    "DaemonRestartSignals: could not re-read config at {}: {e}; \
                     restart detection skipped for this iteration",
                    self.config_path.display()
                );
                return None;
            }
        };
        let mut hasher = Sha1::new();
        hasher.update(&bytes);
        let now_hash = hex::encode(hasher.finalize());
        if now_hash == self.startup_config_hash {
            return None;
        }
        Some(RestartReason::ConfigChanged {
            path: self.config_path.clone(),
            before: self.startup_config_hash.clone(),
            after: now_hash,
        })
    }

    async fn check_binary(&self) -> Option<RestartReason> {
        let (Some(path), Some(startup_mtime)) =
            (self.binary_path.as_deref(), self.startup_binary_mtime)
        else {
            return None;
        };
        let metadata = match tokio::fs::metadata(path).await {
            Ok(m) => m,
            Err(e) => {
                // Same rationale as `check_config` above — surface the
                // unexpected failure rather than silently disabling
                // detection. The binary path was readable at startup.
                warn!(
                    "DaemonRestartSignals: could not stat binary at {}: {e}; \
                     restart detection skipped for this iteration",
                    path.display()
                );
                return None;
            }
        };
        let now_mtime = metadata.modified().ok()?;
        (now_mtime != startup_mtime).then(|| RestartReason::BinaryChanged {
            path: path.to_owned(),
        })
    }
}

/// The full compiler config. This is a combination of:
/// - the configuration file
/// - the absolute path to the root of the compiled projects
/// - command line options
/// - TODO: injected code to produce additional files
pub struct Config {
    /// Optional name for this config. This might be used by compiler extension
    /// code like logging or extra artifact generation.
    pub name: Option<String>,
    /// Root directory of all projects to compile. Any other paths in the
    /// compiler should be relative to this root unless otherwise noted.
    pub root_dir: PathBuf,
    pub sources: FnvIndexMap<PathBuf, ProjectSet>,
    pub excludes: Vec<String>,
    /// Some projects may need to include extra source directories without being
    /// affected by exclusion globs from the `excludes` config (e.g. generated
    /// directories).
    pub generated_sources: FnvIndexMap<PathBuf, ProjectSet>,
    pub projects: FnvIndexMap<ProjectName, ProjectConfig>,
    pub is_multi_project: bool,
    pub header: Vec<String>,
    pub codegen_command: Option<String>,
    /// If set, tries to initialize the compiler from the saved state file.
    /// Consumed (taken) by the first file_source query so subsequent watch()
    /// loop iterations (e.g. after a source-control update) don't re-deserialize
    /// a now-stale snapshot — they fall back to the normal saved-state path.
    pub load_saved_state_file: Mutex<Option<PathBuf>>,
    /// Path to a JSON file listing files changed since `load_saved_state_file`'s
    /// snapshot, in the format produced by Meerkat for `--changed-files-list`.
    /// When BOTH this and `load_saved_state_file` are set, the first iteration
    /// of `compiler.watch()` skips the Watchman query entirely and seeds initial
    /// state from `(saved_state + changed_files)`. Subsequent iterations fall
    /// back to the normal Watchman path. Consume-once via Mutex&lt;Option&gt;.
    pub initial_external_changed_files_list: Mutex<Option<PathBuf>>,
    /// Function to generate extra
    pub generate_extra_artifacts: Option<GenerateExtraArtifactsFn>,
    pub generate_virtual_id_file_name: Option<GenerateVirtualIdFieldName>,

    /// Path to which to write the output of the compilation
    pub artifact_writer: Box<dyn ArtifactWriter + Send + Sync>,
    // Function to get the file hash for an artifact file.
    pub get_artifacts_file_hash_map: Option<GetArtifactsFileHashMapFn>,

    /// Compile all files. Persist ids are still re-used unless
    /// `Config::repersist_operations` is also set.
    pub compile_everything: bool,

    /// Do not reuse persist ids from artifacts even if the text hash matches.
    pub repersist_operations: bool,

    pub saved_state_config: Option<ScmAwareClockData>,
    pub saved_state_loader: Option<Box<dyn SavedStateLoader + Send + Sync>>,
    pub saved_state_version: String,

    /// Function that creates a function that is
    /// called to save operation text (e.g. to a database) and to generate an id.
    pub create_operation_persister: Option<OperationPersisterCreator>,

    pub post_artifacts_write: Option<PostArtifactsWriter>,

    /// Validations that can be added to the config that will be called in addition to default
    /// validation rules.
    pub additional_validations: Option<AdditionalValidations>,

    pub status_reporter: Box<dyn StatusReporter + Send + Sync>,

    /// Optional build status for coordinating between daemon and clients.
    /// When set, the compiler will notify this status object of file changes
    /// and build completion, allowing the client to wait for builds.
    pub daemon_build_status: Option<Arc<BuildStatus>>,

    /// We may generate some content in the artifacts that's stripped in production if __DEV__ variable is set
    /// This config option is here to define the name of that special variable
    pub is_dev_variable_name: Option<String>,

    /// Type of file source to use in the Compiler
    pub file_source_config: FileSourceKind,

    /// Reads compiler inputs (sources, schemas, extensions) under `root_dir`.
    /// Defaults to [`StdFileSystem`]; hosts may inject a backend that talks
    /// to their virtual file system directly.
    pub file_system: Arc<dyn FileSystem>,

    /// A set of custom transform functions, that can be applied before,
    /// and after each major transformation step (common, operations, etc)
    /// in the `apply_transforms(...)`.
    pub custom_transforms: Option<CustomTransformsConfig>,
    pub custom_override_schema_determinator: Option<CustomOverrideSchemaDeterminator>,
    pub export_persisted_query_ids_to_file: Option<PathBuf>,

    /// The async function is called before the compiler connects to the file
    /// source.
    pub initialize_resources: Option<Box<dyn Fn() + Send + Sync>>,

    /// Runs in `try_saved_state` when the compiler state is initialized from saved state.
    pub update_compiler_state_from_saved_state: UpdateCompilerStateFromSavedState,

    /// Allow incremental build for some schema changes
    pub has_schema_change_incremental_build: bool,

    /// Detect schema changes by parsing and diffing only the changed chunks
    /// of a schema split across files, in parallel, instead of the whole old
    /// and new schema as two joined documents. Same result whenever the
    /// current schema builds; kill switch for the faster path.
    pub schema_diff_changed_sources_only: bool,

    /// A custom function to extract resolver Dockblock IRs from sources
    pub custom_extract_relay_resolvers: Option<CustomExtractRelayResolvers>,

    /// A function to determine if full file source should be extracted instead of docblock
    pub should_extract_full_source: Option<ShouldExtractFullSource>,

    /// Names of directives that will be automatically copied from the parent fragment to refetchable queries
    pub transferrable_refetchable_query_directives: Vec<DirectiveName>,

    /// Inputs the daemon polls each iteration to decide whether to exit so
    /// a fresh process can pick up a new binary/config. `None` when the
    /// config came from in-memory data (tests, `SingleProjectConfigFile`
    /// → virtual path) or when the config file isn't readable.
    /// Only consulted by [`Compiler::watch`] in daemon mode.
    pub restart_signals: Option<DaemonRestartSignals>,
}

pub enum FileSourceKind {
    Watchman,
    /// List with changed files in format "file_path,exists".
    /// This can be used to replace watchman queries
    External(PathBuf),
    WalkDir,
    /// Test file source for testing the daemon. Allows external test code to push
    /// file changes and trigger builds without requiring Watchman.
    Test(TestFileSourceConfig),
}

/// Events that can be sent through the test file source to simulate
/// various file system and source control scenarios.
#[derive(Debug, Clone)]
pub enum TestFileSourceEvent {
    /// Regular file changes detected (triggers WalkDir rescan)
    FileChanged,
    /// Source control update started (e.g. hg.update in progress).
    /// Pauses build processing until leave/complete.
    SourceControlUpdateEnter,
    /// Source control update finished without a base revision change.
    /// Resumes normal build processing.
    SourceControlUpdateLeave,
    /// Source control update finished with a new base revision.
    /// Triggers a full watch loop restart (new subscription, fresh initial build).
    SourceControlUpdate,
}

/// Configuration for test file source.
///
/// This enables testing of watch mode by allowing external code to trigger
/// file rescans and source control events. Uses a broadcast channel so that
/// watch loop restarts (after `SourceControlUpdate`) can create fresh
/// receivers from the same sender.
#[derive(Clone)]
pub struct TestFileSourceConfig {
    sender: broadcast::Sender<TestFileSourceEvent>,
}

impl TestFileSourceConfig {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(16);
        Self { sender }
    }

    /// Notify the compiler of file changes (backward-compatible).
    pub fn notify(&self) {
        let _ = self.sender.send(TestFileSourceEvent::FileChanged);
    }

    /// Send a specific event to the test subscription.
    pub fn send_event(&self, event: TestFileSourceEvent) {
        let _ = self.sender.send(event);
    }

    /// Create a new broadcast receiver. Called each time a subscription is created,
    /// including after watch loop restarts.
    pub fn subscribe(&self) -> broadcast::Receiver<TestFileSourceEvent> {
        self.sender.subscribe()
    }
}

impl Default for TestFileSourceConfig {
    fn default() -> Self {
        Self::new()
    }
}

fn normalize_path_from_config(
    current_dir: PathBuf,
    common_path: PathBuf,
    path_from_config: PathBuf,
) -> PathBuf {
    let mut src = current_dir.join(path_from_config.clone());

    src = canonicalize(src.clone())
        .unwrap_or_else(|err| panic!("Unable to canonicalize file {:?}. Error: {:?}", src, err));

    src.strip_prefix(common_path.clone())
        .unwrap_or_else(|_| {
            panic!(
                "Expect to be able to strip common_path from {:?} {:?}",
                src,
                common_path.clone(),
            );
        })
        .to_path_buf()
}

impl From<SingleProjectConfigFile> for Config {
    fn from(config: SingleProjectConfigFile) -> Self {
        Self::from_struct(
            "/virtual/path".into(),
            ConfigFile::SingleProject(config),
            false,
        )
        .unwrap()
    }
}

impl Config {
    pub fn search(start_dir: &Path) -> Result<Self> {
        Self::load_config(start_dir, &Self::default_loader_sources())
    }

    /// Find the path to a Relay config file by walking up from `start_dir`,
    /// using the same loaders as [`Self::search`] but without parsing the
    /// config. Useful when only the path is needed (e.g. deriving a stable
    /// hash for the daemon socket path).
    pub fn find_path(start_dir: &Path) -> Result<Option<PathBuf>> {
        match js_config_loader::load::<Value>(start_dir, &Self::default_loader_sources()) {
            Ok(found) => Ok(found.map(|c| c.path)),
            Err(error) => Err(Error::ConfigError {
                details: format!("Error searching config: {error}"),
            }),
        }
    }

    fn default_loader_sources() -> [LoaderSource; 5] {
        [
            LoaderSource::PackageJson("relay".to_string()),
            LoaderSource::Json("relay.config.json".to_string()),
            LoaderSource::Js("relay.config.js".to_string()),
            LoaderSource::Js("relay.config.cjs".to_string()),
            LoaderSource::Js("relay.config.mjs".to_string()),
        ]
    }

    pub fn load(config_path: PathBuf) -> Result<Self> {
        // `package.json` is a Relay config only via its `"relay"` sub-key —
        // dispatch to `PackageJsonLoader` so the rest of the file (e.g.
        // `browserslist`) isn't parsed as the Relay config. Ancestor walk
        // starts at the file's parent so the explicitly-requested file is
        // found first.
        if config_path.file_name() == Some(OsStr::new("package.json")) {
            let start_dir = config_path
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| {
                    current_dir().expect("Unable to get current working directory.")
                });
            return Self::load_config(
                &start_dir,
                &[LoaderSource::PackageJson("relay".to_string())],
            );
        }

        let loader = if config_path.extension() == Some(OsStr::new("js"))
            || config_path.extension() == Some(OsStr::new("cjs"))
            || config_path.extension() == Some(OsStr::new("mjs"))
        {
            LoaderSource::Js(config_path.display().to_string())
        } else if config_path.extension() == Some(OsStr::new("json")) {
            LoaderSource::Json(config_path.display().to_string())
        } else {
            return Err(Error::ConfigError {
                details: format!(
                    "Invalid file extension. Expected `.js`, `.cjs`, `.mjs` or `.json`. Provided file \"{}\".",
                    config_path.display()
                ),
            });
        };
        Self::load_config(
            &current_dir().expect("Unable to get current working directory."),
            &[loader],
        )
    }

    fn load_config(start_dir: &Path, loaders_sources: &[LoaderSource]) -> Result<Self> {
        match js_config_loader::load(start_dir, loaders_sources) {
            Ok(Some(config)) => Self::from_struct(config.path, config.value, true),
            Ok(None) => Err(Error::ConfigError {
                details: format!(
                    r#"
 Configuration for Relay compiler not found.

 Please make sure that the configuration file is created in {}.

 You can also pass the path to the configuration file as `relay-compiler ./path-to-config/relay.json`.

 Example file:
 {{
   "src": "./src",
   "schema": "./path-to/schema.graphql",
   "language": "javascript"
 }}
 "#,
                    match loaders_sources.len() {
                        1 => loaders_sources[0].to_string(),
                        2 => format!("{} or {}", loaders_sources[0], loaders_sources[1]),
                        _ => {
                            let mut loaders_str = loaders_sources
                                .iter()
                                .map(|loader| loader.to_string())
                                .collect::<Vec<_>>();
                            let last_option = loaders_str.pop().unwrap();
                            format!("{}, or {}", loaders_str.join(", "), last_option)
                        }
                    }
                ),
            }),
            Err(error) => Err(Error::ConfigError {
                details: format!("Error searching config: {error}"),
            }),
        }
    }

    /// Loads a config file without validation for use in tests.
    pub fn from_string_for_test(config_string: &str) -> Result<Self> {
        let path = PathBuf::from("/virtual/root/virtual_config.json");
        let config_file: ConfigFile =
            serde_json::from_str(config_string).map_err(|err| Error::ConfigError {
                details: format!("Failed to parse config file `{}`: {}", path.display(), err,),
            })?;
        Self::from_struct(path, config_file, false)
    }

    /// `validate_fs` disables all filesystem checks for existence of files
    fn from_struct(
        config_path: PathBuf,
        config_file: ConfigFile,
        validate_fs: bool,
    ) -> Result<Self> {
        let mut hash = Sha1::new();
        serde_json::to_writer(&mut hash, &config_file).unwrap();

        let is_multi_project = match config_file {
            ConfigFile::MultiProject(_) => true,
            ConfigFile::SingleProject(_) => false,
        };

        let config_file = match config_file {
            ConfigFile::MultiProject(config) => *config,
            ConfigFile::SingleProject(config) => {
                config.create_multi_project_config(&config_path)?
            }
        };

        let config_file_dir = config_path.parent().unwrap();

        let root_dir = if let Some(config_root) = config_file.root {
            canonicalize(config_file_dir.join(config_root)).unwrap()
        } else {
            config_file_dir.to_owned()
        };

        let MultiProjectConfigFile {
            feature_flags: config_file_feature_flags,
            projects,
            ..
        } = config_file;
        let projects = projects
            .into_iter()
            .map(|(project_name, config_file_project)| {
                let schema_location = match (
                    config_file_project.schema,
                    config_file_project.schema_dir,
                    config_file_project.schema_compact,
                ) {
                    (Some(schema_file), None, None) => Ok(SchemaLocation::File(
                        normalize_relative_path(&root_dir, &schema_file),
                    )),
                    (None, Some(schema_dir), None) => Ok(SchemaLocation::Directory(
                        normalize_relative_path(&root_dir, &schema_dir),
                    )),
                    (None, None, Some(schema_compact)) => Ok(SchemaLocation::CompactFile(
                        normalize_relative_path(&root_dir, &schema_compact),
                    )),
                    _ => Err(Error::ConfigFileValidation {
                        config_path: config_path.clone(),
                        validation_errors: vec![
                            ConfigValidationError::ProjectNeedsSchemaXorSchemaDir { project_name },
                        ],
                    }),
                }?;

                let shard_strip_regex = config_file_project
                    .shard_strip_regex
                    .map(|s| Regex::new(&s))
                    .transpose()
                    .map_err(|error| Error::ConfigFileValidation {
                        config_path: config_path.clone(),
                        validation_errors: vec![ConfigValidationError::InvalidRegex {
                            key: "shardStripRegex",
                            project_name,
                            error,
                        }],
                    })?;

                let test_path_regex = config_file_project
                    .test_path_regex
                    .map(|s| Regex::new(&s))
                    .transpose()
                    .map_err(|error| Error::ConfigFileValidation {
                        config_path: config_path.clone(),
                        validation_errors: vec![ConfigValidationError::InvalidRegex {
                            key: "testDirectoryRegex",
                            project_name,
                            error,
                        }],
                    })?;

                let excludes_extensions_set = match &config_file_project.excludes_extensions {
                    Some(extensions) => {
                        let mut builder = GlobSetBuilder::new();
                        for ext in extensions {
                            match Glob::new(ext) {
                                Ok(glob) => {
                                    builder.add(glob);
                                }
                                Err(e) => {
                                    return Err(Error::ConfigFileValidation {
                                        config_path: config_path.clone(),
                                        validation_errors: vec![
                                            ConfigValidationError::InvalidGlobPattern {
                                                field: "excludesExtensions".to_string(),
                                                pattern: ext.clone(),
                                                reason: e.to_string(),
                                            },
                                        ],
                                    });
                                }
                            }
                        }
                        Some(builder.build().unwrap())
                    }
                    None => None,
                };

                let feature_flags = Arc::new(feature_flags_for_project(
                    config_file_project.feature_flags,
                    &config_file_feature_flags,
                    is_multi_project,
                ));
                let project_config = ProjectConfig {
                    name: project_name,
                    base: config_file_project.base,
                    enabled: true,
                    schema_extensions: config_file_project
                        .schema_extensions
                        .into_iter()
                        .map(|extension_path| normalize_relative_path(&root_dir, &extension_path))
                        .collect(),
                    extra_artifacts_config: None,
                    extra: config_file_project.extra,
                    excludes_extensions: excludes_extensions_set,
                    output: config_file_project.output,
                    extra_artifacts_output: config_file_project.extra_artifacts_output,
                    shard_output: config_file_project.shard_output,
                    shard_strip_regex,
                    schema_location,
                    schema_name: config_file_project.schema_name,
                    schema_config: config_file_project.schema_config,
                    typegen_config: config_file_project.typegen_config,
                    persist: config_file_project.persist,
                    variable_names_comment: config_file_project.variable_names_comment,
                    test_path_regex,
                    feature_flags,
                    relay_rsc: config_file_project.relay_rsc,
                    rollout: config_file_project.rollout,
                    js_module_format: config_file_project.js_module_format,
                    relativize_js_module_paths: config_file_project.relativize_js_module_paths,
                    module_import_config: config_file_project.module_import_config,
                    diagnostic_report_config: config_file_project.diagnostic_report_config,
                    resolvers_schema_module: config_file_project.resolvers_schema_module,
                    codegen_command: config_file_project.codegen_command,
                    get_custom_path_for_artifact: None,
                };
                Ok((project_name, project_config))
            })
            .collect::<Result<FnvIndexMap<_, _>>>()?;

        let config = Self {
            name: config_file.name,
            artifact_writer: Box::new(ArtifactFileWriter::new(
                match config_file.no_source_control {
                    Some(true) => None,
                    _ => source_control_for_root(&root_dir),
                },
                root_dir.clone(),
            )),
            status_reporter: Box::new(ConsoleStatusReporter::new(
                root_dir.clone(),
                is_multi_project,
            )),
            daemon_build_status: None,
            file_system: Arc::new(StdFileSystem::new(root_dir.clone())),
            root_dir,
            sources: config_file.sources,
            excludes: config_file.excludes,
            generated_sources: config_file.generated_sources,
            projects,
            is_multi_project,
            header: config_file.header,
            codegen_command: config_file.codegen_command,
            load_saved_state_file: Mutex::new(None),
            initial_external_changed_files_list: Mutex::new(None),
            generate_extra_artifacts: None,
            generate_virtual_id_file_name: None,
            get_artifacts_file_hash_map: None,
            saved_state_config: config_file.saved_state_config,
            saved_state_loader: None,
            saved_state_version: hex::encode(hash.finalize()),
            create_operation_persister: None,
            compile_everything: false,
            repersist_operations: false,
            post_artifacts_write: None,
            additional_validations: None,
            is_dev_variable_name: config_file.is_dev_variable_name,
            file_source_config: FileSourceKind::Watchman,
            custom_transforms: None,
            custom_override_schema_determinator: None,
            export_persisted_query_ids_to_file: None,
            initialize_resources: None,
            update_compiler_state_from_saved_state: None,
            has_schema_change_incremental_build: false,
            schema_diff_changed_sources_only: true,
            custom_extract_relay_resolvers: None,
            should_extract_full_source: None,
            transferrable_refetchable_query_directives: vec![],
            restart_signals: DaemonRestartSignals::try_capture(
                &config_path,
                std::env::current_exe().ok(),
            ),
        };

        let mut validation_errors = Vec::new();
        config.validate_consistency(&mut validation_errors);
        if validate_fs {
            config.validate_paths(&mut validation_errors);
        }
        if validation_errors.is_empty() {
            Ok(config)
        } else {
            Err(Error::ConfigFileValidation {
                config_path,
                validation_errors,
            })
        }
    }

    /// Daemon-only restart-signal check. Returns `Some(reason)` if the
    /// daemon should exit so a fresh process can pick up the current
    /// on-disk binary/config; `None` otherwise (including in non-daemon
    /// mode and when no signals were captured at startup).
    ///
    /// Extracted into a `Config` method so the gating logic
    /// (`daemon_build_status.is_some() && signals.is_some()`) can be unit
    /// tested without spinning up the watch loop. The caller —
    /// [`crate::Compiler::watch`]'s `incremental_build_loop` — only needs
    /// to await this and act on the returned reason.
    pub async fn check_restart_if_daemon(&self) -> Option<RestartReason> {
        self.daemon_build_status.as_ref()?;
        let signals = self.restart_signals.as_ref()?;
        signals.check().await
    }

    /// Iterator over projects that are enabled.
    pub fn enabled_projects(&self) -> impl Iterator<Item = &ProjectConfig> {
        self.projects
            .values()
            .filter(|project_config| project_config.enabled)
    }

    /// Rayon parallel iterator over projects that are enabled.
    pub fn par_enabled_projects(&self) -> impl ParallelIterator<Item = &ProjectConfig> {
        self.projects
            .par_iter()
            .map(|(_project_name, project_config)| project_config)
            .filter(|project_config| project_config.enabled)
    }

    /// Validated internal consistency of the config.
    fn validate_consistency(&self, errors: &mut Vec<ConfigValidationError>) {
        let mut project_names = FnvHashSet::default();
        for (source_dir, project_set) in self.sources.iter() {
            for name in project_set.iter() {
                if self.projects.get(name).is_none() {
                    errors.push(ConfigValidationError::ProjectDefinitionMissing {
                        source_dir: source_dir.clone(),
                        project_name: *name,
                    });
                }

                project_names.insert(*name);
            }
        }

        for (&project_name, project_config) in &self.projects {
            // there should be a source for each project matching the project name
            if !project_names.contains(&project_name) {
                errors.push(ConfigValidationError::ProjectSourceMissing { project_name });
            }

            // If a base of the project is set, it should exist
            if let Some(base_name) = project_config.base
                && self.projects.get(&base_name).is_none()
            {
                errors.push(ConfigValidationError::ProjectBaseMissing {
                    project_name,
                    base_project_name: base_name,
                })
            }
        }
    }

    /// Validates that all paths actually exist on disk.
    pub fn validate_paths(&self, errors: &mut Vec<ConfigValidationError>) {
        if !self.root_dir.is_dir() {
            errors.push(ConfigValidationError::RootNotDirectory {
                root_dir: self.root_dir.clone(),
            });
            // early return, no point in continuing validation
            return;
        }

        // Validate glob patterns in excludes
        for exclude in &self.excludes {
            if let Err(e) = glob::Pattern::new(exclude) {
                errors.push(ConfigValidationError::InvalidGlobPattern {
                    field: "excludes".to_string(),
                    pattern: exclude.clone(),
                    reason: e.msg.to_string(),
                });
            }
        }

        let mut validator = PathValidator::new(self.root_dir.clone(), &self.excludes);

        // each source should point to an existing directory
        for source_dir in self.sources.keys() {
            validator.assert_is_included_source_dir(source_dir);
        }

        for (_, project) in &self.projects {
            match &project.schema_location {
                SchemaLocation::CompactFile(schema_file) | SchemaLocation::File(schema_file) => {
                    validator.assert_is_included_schema_file(schema_file);
                }
                SchemaLocation::Directory(schema_dir) => {
                    validator.assert_is_included_schema_dir(schema_dir);
                }
            }

            // Validate schema extensions
            for extension_path in &project.schema_extensions {
                validator.assert_exists(extension_path, "schema extension file or directory");
            }
        }

        errors.extend(validator.into_errors());
    }

    /// Compute all root paths that we need to query. All files relevant to the
    /// compiler should be in these directories.
    pub fn get_all_roots(&self) -> Vec<PathBuf> {
        let source_roots = self.get_source_roots();
        let extra_sources_roots = self.get_generated_sources_roots();
        let output_roots = self.get_output_dir_paths();
        let extension_roots = self.get_extension_roots();
        let schema_file_roots = self.get_schema_file_roots();
        let schema_dir_roots = self.get_schema_dir_paths();

        unify_roots(
            source_roots
                .into_iter()
                .chain(extra_sources_roots)
                .chain(output_roots)
                .chain(extension_roots)
                .chain(schema_file_roots)
                .chain(schema_dir_roots)
                .collect(),
        )
    }

    /// Returns all root directories of JS source files for the config.
    pub fn get_source_roots(&self) -> Vec<PathBuf> {
        self.sources.keys().cloned().collect()
    }

    /// Returns all root directories of JS source files for the config.
    pub fn get_generated_sources_roots(&self) -> Vec<PathBuf> {
        self.generated_sources.keys().cloned().collect()
    }

    /// Returns all paths to GraphQL schema extension files or directories for
    /// the config.
    pub fn get_extension_roots(&self) -> Vec<PathBuf> {
        self.projects
            .values()
            .flat_map(|project_config| project_config.schema_extensions.iter().cloned())
            .collect()
    }

    /// Returns all output and extra artifact output directories for the config.
    pub fn get_output_dir_paths(&self) -> Vec<PathBuf> {
        let output_dirs = self
            .projects
            .values()
            .filter_map(|project_config| project_config.output.clone());

        let extra_artifact_output_dirs = self
            .projects
            .values()
            .filter_map(|project_config| project_config.extra_artifacts_output.clone());

        output_dirs.chain(extra_artifact_output_dirs).collect()
    }

    /// Returns all paths that contain GraphQL schema files for the config.
    pub fn get_schema_file_paths(&self) -> Vec<PathBuf> {
        self.projects
            .values()
            .filter_map(|project_config| match &project_config.schema_location {
                SchemaLocation::File(schema_file) | SchemaLocation::CompactFile(schema_file) => {
                    Some(schema_file.clone())
                }
                SchemaLocation::Directory(_) => None,
            })
            .collect()
    }

    /// Returns all GraphQL schema directories for the config.
    pub fn get_schema_dir_paths(&self) -> Vec<PathBuf> {
        self.projects
            .values()
            .filter_map(|project_config| match &project_config.schema_location {
                SchemaLocation::File(_) | SchemaLocation::CompactFile(_) => None,
                SchemaLocation::Directory(schema_dir) => Some(schema_dir.clone()),
            })
            .collect()
    }

    /// Returns root directories that contain GraphQL schema files.
    pub fn get_schema_file_roots(&self) -> impl Iterator<Item = PathBuf> + use<> {
        self.get_schema_file_paths().into_iter().map(|schema_path| {
            schema_path
                .parent()
                .expect("A schema in the project root directory is currently not supported.")
                .to_owned()
        })
    }
}

fn feature_flags_for_project(
    project_feature_flags: Option<FeatureFlags>,
    global_feature_flags: &FeatureFlags,
    is_multi_project: bool,
) -> FeatureFlags {
    let mut feature_flags = project_feature_flags.unwrap_or_else(|| global_feature_flags.clone());
    if is_multi_project {
        feature_flags.disable_deduping_common_structures_in_raw_response_types =
            global_feature_flags
                .disable_deduping_common_structures_in_raw_response_types
                .clone();
    }
    feature_flags
}

/// Finds the roots of a set of paths. This filters any paths
/// that are a subdirectory of other paths in the input.
fn unify_roots(mut paths: Vec<PathBuf>) -> Vec<PathBuf> {
    paths.sort();
    let mut roots = Vec::new();
    for path in paths {
        match roots.last() {
            Some(prev) if path.starts_with(prev) => {
                // skip
            }
            _ => {
                roots.push(path);
            }
        }
    }
    roots
}

#[cfg(test)]
mod test {
    use common::FeatureFlag;
    use relay_config::RelayRscCapabilities;

    use super::*;

    #[test]
    fn raw_response_type_deduplication_killswitch_is_global() {
        let global_feature_flags = FeatureFlags {
            disable_deduping_common_structures_in_raw_response_types: FeatureFlag::Enabled,
            ..Default::default()
        };
        let project_feature_flags = FeatureFlags {
            disable_full_argument_type_validation: FeatureFlag::Enabled,
            ..Default::default()
        };

        let merged_feature_flags =
            feature_flags_for_project(Some(project_feature_flags), &global_feature_flags, true);

        assert!(
            merged_feature_flags
                .disable_deduping_common_structures_in_raw_response_types
                .is_fully_enabled()
        );
        assert!(
            merged_feature_flags
                .disable_full_argument_type_validation
                .is_fully_enabled()
        );
    }

    #[test]
    fn single_project_raw_response_type_deduplication_killswitch_is_preserved() {
        let config = Config::from_string_for_test(
            r#"{
                "src": ".",
                "schema": ".",
                "language": "flow",
                "featureFlags": {
                    "disable_deduping_common_structures_in_raw_response_types": {
                        "kind": "enabled"
                    }
                }
            }"#,
        )
        .expect("should parse single-project config");
        let project = config
            .projects
            .values()
            .next()
            .expect("should contain the single project");

        assert!(
            project
                .feature_flags
                .disable_deduping_common_structures_in_raw_response_types
                .is_fully_enabled()
        );
    }

    fn relay_rsc_capabilities_from_config(config: &str) -> Option<RelayRscCapabilities> {
        Config::from_string_for_test(config)
            .expect("should parse Relay RSC config")
            .projects
            .values()
            .next()
            .expect("should contain one project")
            .relay_rsc_capabilities()
    }

    #[test]
    fn relay_rsc_is_project_gated_and_defaults_to_nextjs() {
        let directly_constructed_project = ProjectConfig {
            feature_flags: Arc::new(FeatureFlags {
                enable_relay_rsc: true,
                ..Default::default()
            }),
            ..Default::default()
        };
        let nextjs_capabilities = RelayRscCapabilities {
            allow_client_rooted_operations: false,
            allow_incremental_delivery: true,
            enable_cells: false,
        };

        assert_eq!(
            directly_constructed_project.relay_rsc_capabilities(),
            Some(nextjs_capabilities)
        );
        assert_eq!(
            relay_rsc_capabilities_from_config(
                r#"{
                "src": ".",
                "schema": ".",
                "language": "flow",
                "relayRsc": {"mode": "cometjs"}
            }"#
            ),
            None
        );
        assert_eq!(
            relay_rsc_capabilities_from_config(
                r#"{
                "src": ".",
                "schema": ".",
                "language": "flow",
                "featureFlags": {"enable_relay_rsc": true}
            }"#
            ),
            Some(nextjs_capabilities)
        );
    }

    #[test]
    fn relay_rsc_host_modes_resolve_defaults_and_overrides() {
        let all_capabilities = RelayRscCapabilities {
            allow_client_rooted_operations: true,
            allow_incremental_delivery: true,
            enable_cells: true,
        };

        assert_eq!(
            relay_rsc_capabilities_from_config(
                r#"{
                "src": ".",
                "schema": ".",
                "language": "flow",
                "featureFlags": {"enable_relay_rsc": true},
                "relayRsc": {"mode": "cometjs"}
            }"#
            ),
            Some(all_capabilities)
        );
        assert_eq!(
            relay_rsc_capabilities_from_config(
                r#"{
                "src": ".",
                "schema": ".",
                "language": "flow",
                "featureFlags": {"enable_relay_rsc": true},
                "relayRsc": {
                    "mode": "nextjs",
                    "allowClientRootedOperations": true,
                    "enableCells": true
                }
            }"#
            ),
            Some(all_capabilities)
        );
        assert_eq!(
            relay_rsc_capabilities_from_config(
                r#"{
                "src": ".",
                "schema": ".",
                "language": "flow",
                "featureFlags": {"enable_relay_rsc": true},
                "relayRsc": {
                    "mode": "cometjs",
                    "allowIncrementalDelivery": false
                }
            }"#
            ),
            Some(RelayRscCapabilities {
                allow_client_rooted_operations: true,
                allow_incremental_delivery: false,
                enable_cells: true,
            })
        );
    }

    #[test]
    fn relay_rsc_config_resolves_in_multi_project_files() {
        assert_eq!(
            relay_rsc_capabilities_from_config(
                r#"{
                "sources": {"src": "app"},
                "projects": {
                    "app": {
                        "schema": ".",
                        "language": "flow",
                        "featureFlags": {"enable_relay_rsc": true},
                        "relayRsc": {
                            "mode": "cometjs",
                            "enableCells": false
                        }
                    }
                }
            }"#
            ),
            Some(RelayRscCapabilities {
                allow_client_rooted_operations: true,
                allow_incremental_delivery: true,
                enable_cells: false,
            })
        );
    }

    #[test]
    fn relay_rsc_rejects_unknown_configuration() {
        for invalid_relay_rsc in [
            r#"{"mode": "unknown"}"#,
            r#"{"mode": "nextjs", "unknownSetting": true}"#,
        ] {
            let config = format!(
                r#"{{
                    "src": ".",
                    "schema": ".",
                    "language": "flow",
                    "relayRsc": {invalid_relay_rsc}
                }}"#,
            );

            Config::from_string_for_test(&config)
                .expect_err("unknown Relay RSC configuration should be rejected");
        }
    }

    /// Asserts the consume-once invariant of `load_saved_state_file` and
    /// `initial_external_changed_files_list` — once `take()`d, the slot is
    /// empty so a re-entry of `compiler.watch()` (e.g. after a source-control
    /// update) won't re-deserialize a now-stale snapshot from the same path.
    #[test]
    fn test_consume_once_mutex_option_path() {
        let slot: Mutex<Option<PathBuf>> = Mutex::new(Some(PathBuf::from("/tmp/state.bin")));

        // First take consumes the value.
        let first = slot.lock().unwrap().take();
        assert_eq!(first, Some(PathBuf::from("/tmp/state.bin")));

        // Second take observes the now-empty slot.
        let second = slot.lock().unwrap().take();
        assert_eq!(second, None);

        // Restoring the slot (the no-changes-list fallback in
        // try_initial_external_state) puts the value back so the caller's
        // fallback path can consume it.
        *slot.lock().unwrap() = Some(PathBuf::from("/tmp/restored.bin"));
        assert_eq!(
            slot.lock().unwrap().take(),
            Some(PathBuf::from("/tmp/restored.bin"))
        );
    }

    #[tokio::test]
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    async fn test_restart_signals_detects_config_change() {
        let tmp = tempfile::NamedTempFile::new().expect("create tempfile");
        std::fs::write(tmp.path(), b"original config").expect("write tempfile");

        let signals = DaemonRestartSignals::try_capture(tmp.path(), None)
            .expect("config file exists, capture should succeed");

        // No change → no restart reason.
        assert!(
            signals.check().await.is_none(),
            "fresh signals should report no change"
        );

        // Bump bytes + mtime so the cheap (mtime,size) pre-filter is
        // forced through to the hash comparison.
        std::fs::write(tmp.path(), b"different config bytes").expect("rewrite tempfile");
        set_mtime_in_future(tmp.path());

        match signals.check().await {
            Some(RestartReason::ConfigChanged {
                path,
                before,
                after,
            }) => {
                assert_eq!(path, tmp.path());
                assert_ne!(before, after, "hashes must differ when content differs");
            }
            other => panic!("expected ConfigChanged, got {other:?}"),
        }
    }

    /// Pre-filter must fall through to the hash comparison when mtime
    /// drifts but content is identical (e.g. `touch` of an unchanged
    /// file, or a build-system tag that bumps mtime without rewriting).
    /// If this regresses (e.g. the pre-filter starts returning `None`
    /// based on mtime alone, or the hash comparison gets inverted), the
    /// daemon will spuriously restart on every `touch` of the config
    /// file. Existing tests cover the "both content AND mtime changed"
    /// path; this one specifically exercises the "mtime changed but
    /// content didn't" case the pre-filter is designed to handle.
    #[tokio::test]
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    async fn test_restart_signals_mtime_bump_without_content_change() {
        let tmp = tempfile::NamedTempFile::new().expect("create tempfile");
        std::fs::write(tmp.path(), b"stable content").expect("write tempfile");
        let signals = DaemonRestartSignals::try_capture(tmp.path(), None).expect("capture");

        // Bump only mtime; bytes unchanged. The pre-filter sees the
        // mtime drift and falls through to the hash comparison, which
        // sees the bytes match and returns `None`.
        set_mtime_in_future(tmp.path());

        assert!(
            signals.check().await.is_none(),
            "mtime drift without content change must fall through pre-filter \
             to hash compare and return None — otherwise daemon restarts \
             spuriously on every `touch` of the config file"
        );
    }

    #[tokio::test]
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    async fn test_restart_signals_detects_binary_change() {
        let config = tempfile::NamedTempFile::new().expect("create config tempfile");
        std::fs::write(config.path(), b"config").expect("write config");

        let binary = tempfile::NamedTempFile::new().expect("create binary tempfile");
        std::fs::write(binary.path(), b"binary v1").expect("write binary");

        let signals =
            DaemonRestartSignals::try_capture(config.path(), Some(binary.path().to_owned()))
                .expect("capture should succeed");

        assert!(signals.check().await.is_none(), "no drift yet");

        // Simulate a deploy under the running daemon by bumping mtime.
        set_mtime_in_future(binary.path());

        match signals.check().await {
            Some(RestartReason::BinaryChanged { path }) => assert_eq!(path, binary.path()),
            other => panic!("expected BinaryChanged, got {other:?}"),
        }
    }

    #[test]
    fn test_restart_signals_missing_config_returns_none() {
        // Pointing at a path that doesn't exist must not panic — production
        // tests and `from_string_for_test` rely on this behavior to silently
        // disable restart detection for virtual config paths.
        let signals = DaemonRestartSignals::try_capture(
            Path::new("/definitely/does/not/exist/relay-restart-test.json"),
            None,
        );
        assert!(signals.is_none(), "missing file should disable detection");
    }

    #[tokio::test]
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    async fn test_check_restart_if_daemon_gating() {
        // SingleProjectConfigFile → Config gives us a Config with
        // `daemon_build_status = None` and `restart_signals = None` (the
        // virtual config path doesn't exist on disk). We mutate the two
        // relevant fields to cover the three combinations.
        let mut config: Config = SingleProjectConfigFile::default().into();

        let tmp = tempfile::NamedTempFile::new().expect("create tempfile");
        std::fs::write(tmp.path(), b"orig").expect("write tempfile");

        // Case 1: daemon_build_status = None → never report a restart.
        config.restart_signals = DaemonRestartSignals::try_capture(tmp.path(), None);
        assert!(
            config.check_restart_if_daemon().await.is_none(),
            "non-daemon mode must never report a restart"
        );

        // Case 2: daemon mode, no signals → no restart.
        config.daemon_build_status = Some(Arc::new(BuildStatus::new(
            Box::new(ConsoleStatusReporter::new(PathBuf::from("/tmp"), false)),
            PathBuf::from("/tmp"),
            false,
        )));
        config.restart_signals = None;
        assert!(
            config.check_restart_if_daemon().await.is_none(),
            "daemon mode without signals must not report a restart"
        );

        // Case 3: daemon mode + signals that will fire → Some(reason).
        config.restart_signals = DaemonRestartSignals::try_capture(tmp.path(), None);
        std::fs::write(tmp.path(), b"different bytes here").expect("rewrite tempfile");
        set_mtime_in_future(tmp.path());
        match config.check_restart_if_daemon().await {
            Some(RestartReason::ConfigChanged { .. }) => {}
            other => panic!("expected ConfigChanged, got {other:?}"),
        }
    }

    /// Force `path`'s mtime forward so tests aren't sensitive to the host
    /// filesystem's mtime resolution (some FSes round to 1s).
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn set_mtime_in_future(path: &Path) {
        use std::time::Duration;
        let f = std::fs::OpenOptions::new()
            .write(true)
            .open(path)
            .expect("open for mtime bump");
        f.set_modified(SystemTime::now() + Duration::from_secs(10))
            .expect("set_modified");
    }

    #[test]
    fn test_unify_roots() {
        assert_eq!(unify_roots(vec![]).len(), 0);
        assert_eq!(
            unify_roots(vec!["Apps".into(), "Libraries".into()]),
            &[PathBuf::from("Apps"), PathBuf::from("Libraries")]
        );
        assert_eq!(
            unify_roots(vec!["Apps".into(), "Apps/Foo".into()]),
            &[PathBuf::from("Apps")]
        );
        assert_eq!(
            unify_roots(vec!["Apps/Foo".into(), "Apps".into()]),
            &[PathBuf::from("Apps")]
        );
        assert_eq!(
            unify_roots(vec!["Foo".into(), "Foo2".into()]),
            &[PathBuf::from("Foo"), PathBuf::from("Foo2"),]
        );
    }
}

fn normalize_relative_path(root_dir: &Path, path: &PathBuf) -> PathBuf {
    let absolute = root_dir.join(path);

    absolute.strip_prefix(root_dir).unwrap().to_path_buf()
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let Config {
            name,
            artifact_writer: _,
            root_dir,
            sources,
            excludes,
            generated_sources,
            compile_everything,
            repersist_operations,
            projects,
            header,
            codegen_command,
            load_saved_state_file,
            initial_external_changed_files_list,
            generate_extra_artifacts,
            saved_state_config,
            saved_state_loader,
            saved_state_version,
            create_operation_persister,
            post_artifacts_write,
            ..
        } = self;

        fn option_fn_to_string<T>(option: Option<&T>) -> &'static str {
            if option.is_some() { "Some(Fn)" } else { "None" }
        }

        f.debug_struct("Config")
            .field("name", name)
            .field("root_dir", root_dir)
            .field("sources", sources)
            .field("excludes", excludes)
            .field("generated_sources", generated_sources)
            .field("compile_everything", compile_everything)
            .field("repersist_operations", repersist_operations)
            .field("projects", projects)
            .field("header", header)
            .field("codegen_command", codegen_command)
            .field(
                "load_saved_state_file",
                &load_saved_state_file.lock().map(|guard| guard.clone()).ok(),
            )
            .field(
                "initial_external_changed_files_list",
                &initial_external_changed_files_list
                    .lock()
                    .map(|guard| guard.clone())
                    .ok(),
            )
            .field("saved_state_config", saved_state_config)
            .field(
                "create_operation_persister",
                &option_fn_to_string(create_operation_persister.as_ref()),
            )
            .field(
                "generate_extra_artifacts",
                &option_fn_to_string(generate_extra_artifacts.as_ref()),
            )
            .field(
                "saved_state_loader",
                &option_fn_to_string(saved_state_loader.as_ref()),
            )
            .field("saved_state_version", saved_state_version)
            .field(
                "post_artifacts_write",
                &option_fn_to_string(post_artifacts_write.as_ref()),
            )
            .finish()
    }
}

fn get_default_excludes() -> Vec<String> {
    vec![
        "**/node_modules/**".to_string(),
        "**/__mocks__/**".to_string(),
        "**/__generated__/**".to_string(),
    ]
}

fn default_true() -> bool {
    true
}

/// Schema of the compiler configuration JSON file.
#[derive(Debug, Serialize, Deserialize, Default, JsonSchema)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MultiProjectConfigFile {
    /// The user may hard-code the JSON Schema for their version of the config.
    #[serde(rename = "$schema")]
    json_schema: Option<String>,

    /// Optional name for this config, might be used for logging or custom extra
    /// artifact generator code.
    #[serde(default)]
    name: Option<String>,

    /// Root directory relative to the config file. Defaults to the directory
    /// where the config is located.
    #[serde(default)]
    root: Option<PathBuf>,

    #[serde(default)]
    header: Vec<String>,

    #[serde(default)]
    codegen_command: Option<String>,

    /// A mapping from directory paths (relative to the root) to a source set.
    /// If a path is a subdirectory of another path, the more specific path
    /// wins.
    #[schemars(with = "FnvIndexMap<PathBuf, DeserializableProjectSet>")]
    sources: FnvIndexMap<PathBuf, ProjectSet>,

    /// Glob patterns that should not be part of the sources even if they are
    /// in the source set directories.
    #[serde(default = "get_default_excludes")]
    excludes: Vec<String>,

    /// Similar to sources but not affected by excludes.
    #[serde(default)]
    generated_sources: FnvIndexMap<PathBuf, ProjectSet>,

    /// Configuration of projects to compile.
    projects: FnvIndexMap<ProjectName, ConfigFileProject>,

    /// Enable and disable experimental or legacy behaviors.
    /// WARNING! These are not stable and may change at any time.
    #[serde(default)]
    feature_flags: FeatureFlags,

    /// Watchman saved state config.
    #[schemars(with = "Option<ScmAwareClockDataJsonSchemaDef>")]
    saved_state_config: Option<ScmAwareClockData>,

    /// Then name of the global __DEV__ variable to use in generated artifacts
    is_dev_variable_name: Option<String>,

    /// Opt out of source control checks/integration.
    no_source_control: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields, rename_all = "camelCase", default)]
pub struct SingleProjectConfigFile {
    /// The user may hard-code the JSON Schema for their version of the config.
    #[serde(rename = "$schema")]
    pub json_schema: Option<String>,

    #[serde(skip)]
    pub project_name: ProjectName,

    /// Path to schema.graphql
    pub schema: PathBuf,

    /// Root directory of application code
    pub src: PathBuf,

    /// A specific directory to output all artifacts to. When enabling this
    /// the babel plugin needs `artifactDirectory` set as well.
    pub artifact_directory: Option<PathBuf>,

    /// Directories to ignore under src
    /// default: ['**/node_modules/**', '**/__mocks__/**', '**/__generated__/**'],
    #[serde(default = "get_default_excludes")]
    pub excludes: Vec<String>,

    /// List of files or directories with schema extensions.
    pub schema_extensions: Vec<PathBuf>,

    #[serde(flatten)]
    pub typegen_config: TypegenConfig,

    /// Query Persist Configuration
    /// It contains URL and addition parameters that will be included
    /// with the request (think API_KEY, APP_ID, etc...)
    pub persist_config: Option<PersistConfig>,

    /// We may generate some content in the artifacts that's stripped in production if __DEV__ variable is set
    /// This config option is here to define the name of that special variable
    pub is_dev_variable_name: Option<String>,

    /// Name of the command that runs the relay compiler. This will be added at
    /// the top of generated code to let readers know how to regenerate the file.
    pub codegen_command: Option<String>,

    /// Import/export style to use in generated JavaScript modules.
    pub js_module_format: JsModuleFormat,

    /// Whether to treat all JS module names as relative to './' (true) or not.
    /// default: true
    #[serde(default = "default_true")]
    pub relativize_js_module_paths: bool,

    /// Extra configuration for the GraphQL schema itself.
    pub schema_config: SchemaConfig,

    /// Configuration for @module
    #[serde(default)]
    pub module_import_config: ModuleImportConfig,

    /// Enable and disable experimental or legacy behaviors.
    /// WARNING! These are not stable and may change at any time.
    #[serde(default)]
    pub feature_flags: Option<FeatureFlags>,

    /// Relay RSC host defaults and project-specific capability overrides.
    #[serde(default)]
    pub relay_rsc: RelayRscProjectConfig,

    #[serde(default)]
    pub resolvers_schema_module: Option<ResolversSchemaModuleConfig>,

    /// Opt out of source control checks/integration.
    #[serde(default)]
    pub no_source_control: Option<bool>,

    /// A placeholder for allowing extra information in the config file
    #[serde(default)]
    pub extra: serde_json::Value,
}

impl Default for SingleProjectConfigFile {
    fn default() -> Self {
        Self {
            json_schema: None,
            project_name: ProjectName::default(),
            schema: Default::default(),
            src: Default::default(),
            artifact_directory: Default::default(),
            excludes: get_default_excludes(),
            schema_extensions: vec![],
            schema_config: Default::default(),
            typegen_config: Default::default(),
            persist_config: None,
            is_dev_variable_name: None,
            codegen_command: None,
            js_module_format: JsModuleFormat::CommonJS,
            relativize_js_module_paths: true,
            feature_flags: None,
            relay_rsc: Default::default(),
            module_import_config: Default::default(),
            resolvers_schema_module: Default::default(),
            no_source_control: Some(false),
            extra: Default::default(),
        }
    }
}

impl SingleProjectConfigFile {
    fn get_common_root(
        &self,
        root_dir: PathBuf,
    ) -> std::result::Result<PathBuf, ConfigValidationError> {
        let mut paths = vec![];
        if let Some(artifact_directory_path) = self.artifact_directory.clone() {
            paths.push(
                canonicalize(root_dir.join(artifact_directory_path.clone())).map_err(|_| {
                    ConfigValidationError::ArtifactDirectoryNotExistent {
                        path: artifact_directory_path,
                    }
                })?,
            );
        }
        paths.push(canonicalize(root_dir.join(self.src.clone())).map_err(|_| {
            ConfigValidationError::SourceNotExistent {
                source_dir: self.src.clone(),
            }
        })?);
        paths.push(
            canonicalize(root_dir.join(self.schema.clone())).map_err(|_| {
                ConfigValidationError::SchemaFileNotExistent {
                    project_name: self.project_name,
                    schema_file: self.schema.clone(),
                }
            })?,
        );
        for extension_path in self.schema_extensions.iter() {
            paths.push(
                canonicalize(root_dir.join(extension_path.clone())).map_err(|_| {
                    ConfigValidationError::ExtensionPathNotExistent {
                        project_name: self.project_name,
                        extension_path: extension_path.clone(),
                    }
                })?,
            );
        }
        common_path::common_path_all(paths.iter().map(|path| path.as_path()))
            .ok_or(ConfigValidationError::CommonPathNotFound)
    }

    fn create_multi_project_config(self, config_path: &Path) -> Result<MultiProjectConfigFile> {
        let current_dir = std::env::current_dir().unwrap();
        let common_root_dir = self.get_common_root(current_dir.clone()).map_err(|err| {
            Error::ConfigFileValidation {
                config_path: config_path.to_path_buf(),
                validation_errors: vec![err],
            }
        })?;

        let project_config = ConfigFileProject {
            output: self.artifact_directory.map(|dir| {
                normalize_path_from_config(current_dir.clone(), common_root_dir.clone(), dir)
            }),
            schema: Some(normalize_path_from_config(
                current_dir.clone(),
                common_root_dir.clone(),
                self.schema,
            )),
            schema_config: self.schema_config,
            schema_extensions: self
                .schema_extensions
                .iter()
                .map(|path| {
                    normalize_path_from_config(
                        current_dir.clone(),
                        common_root_dir.clone(),
                        path.clone(),
                    )
                })
                .collect(),
            persist: self.persist_config,
            typegen_config: self.typegen_config,
            js_module_format: self.js_module_format,
            feature_flags: self.feature_flags,
            relay_rsc: self.relay_rsc,
            module_import_config: self.module_import_config,
            relativize_js_module_paths: self.relativize_js_module_paths,
            resolvers_schema_module: self.resolvers_schema_module,
            extra: self.extra,
            ..Default::default()
        };

        let mut projects = FnvIndexMap::default();
        projects.insert(self.project_name, project_config);

        let mut sources = FnvIndexMap::default();
        let src = normalize_path_from_config(current_dir, common_root_dir.clone(), self.src);

        sources.insert(src, ProjectSet::of(self.project_name));

        Ok(MultiProjectConfigFile {
            root: Some(common_root_dir),
            projects,
            sources,
            excludes: self.excludes,
            is_dev_variable_name: self.is_dev_variable_name,
            codegen_command: self.codegen_command,
            no_source_control: self.no_source_control,
            ..Default::default()
        })
    }
}

/// Relay's configuration file. Supports a single project config for simple use
/// cases and a multi-project config for cases where multiple projects live in
/// the same repository.
///
/// In general, start with the SingleProjectConfigFile.
#[derive(Serialize, JsonSchema)]
#[serde(untagged)]
#[allow(clippy::large_enum_variant)]
pub enum ConfigFile {
    /// Base case configuration (mostly of OSS) where the project
    /// have single schema, and single source directory
    SingleProject(SingleProjectConfigFile),
    /// Relay can support multiple projects with multiple schemas
    /// and different options (output, typegen, etc...).
    /// This MultiProjectConfigFile is responsible for configuring
    /// these type of projects (complex)
    MultiProject(Box<MultiProjectConfigFile>),
}

impl ConfigFile {
    pub fn json_schema() -> String {
        let settings: SchemaSettings = Default::default();
        let generator = SchemaGenerator::from(settings);
        let schema = generator.into_root_schema_for::<Self>();
        serde_json::to_string_pretty(&schema).unwrap()
    }
}

impl<'de> Deserialize<'de> for ConfigFile {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        let value = Value::deserialize(deserializer)?;
        match MultiProjectConfigFile::deserialize(value.clone()) {
            Ok(config) => Ok(ConfigFile::MultiProject(Box::new(config))),
            Err(multi_project_error) => match SingleProjectConfigFile::deserialize(value) {
                Ok(single_project_config) => Ok(ConfigFile::SingleProject(single_project_config)),
                Err(single_project_error) => {
                    let error_message = format!(
                        r#"The config file cannot be parsed as a single-project config file due to:
 - {single_project_error:?}.

 It also cannot be a multi-project config file due to:
 - {multi_project_error:?}."#
                    );

                    Err(DeError::custom(error_message))
                }
            },
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Default, JsonSchema)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ConfigFileProject {
    /// If a base project is set, the documents of that project can be
    /// referenced, but won't produce output artifacts.
    /// Extensions from the base project will be added as well and the schema
    /// of the base project should be a subset of the schema of this project.
    #[serde(default)]
    base: Option<ProjectName>,

    /// A project without an output directory will put the generated files in
    /// a __generated__ directory next to the input file.
    /// All files in these directories should be generated by the Relay
    /// compiler, so that the compiler can cleanup extra files.
    #[serde(default)]
    output: Option<PathBuf>,

    /// Some projects may need to generate extra artifacts. For those, we may
    /// need to provide an additional directory to put them.
    /// By default the will use `output` *if available
    extra_artifacts_output: Option<PathBuf>,

    /// Some projects may need to exclude files with certain extensions.
    excludes_extensions: Option<Vec<String>>,

    /// If `output` is provided and `shard_output` is `true`, shard the files
    /// by putting them under `{output_dir}/{source_relative_path}`
    #[serde(default)]
    shard_output: bool,

    /// Regex to match and strip parts of the `source_relative_path`
    #[serde(default)]
    shard_strip_regex: Option<String>,

    /// File or directory containing *.graphql files with schema extensions.
    #[serde(default)]
    schema_extensions: Vec<PathBuf>,

    /// Path to the schema.graphql or a directory containing a schema broken up
    /// in multiple *.graphql files.
    /// Exactly 1 of these options needs to be defined.
    schema: Option<PathBuf>,
    schema_dir: Option<PathBuf>,
    schema_compact: Option<PathBuf>,

    /// Schema name, if differs from project name.
    /// If schema name is unset, the project name will be used as schema name.
    #[serde(default)]
    schema_name: Option<StringKey>,

    /// If this option is set, the compiler will persist queries using this
    /// config.
    persist: Option<PersistConfig>,

    #[serde(flatten)]
    pub typegen_config: TypegenConfig,

    /// Optional regex to restrict @relay_test_operation to directories matching
    /// this regex. Defaults to no limitations.
    #[serde(default)]
    test_path_regex: Option<String>,

    /// Generates a `// @relayVariables name1 name2` header in generated operation files
    #[serde(default)]
    variable_names_comment: bool,

    /// A placeholder for allowing extra information in the config file
    #[serde(default)]
    extra: serde_json::Value,

    /// Enable and disable experimental or legacy behaviors.
    /// WARNING! These are not stable and may change at any time.
    #[serde(default)]
    pub feature_flags: Option<FeatureFlags>,

    /// Relay RSC host defaults and project-specific capability overrides.
    #[serde(default)]
    pub relay_rsc: RelayRscProjectConfig,

    /// A generic rollout state for larger codegen changes. The default is to
    /// pass, otherwise it should be a number between 0 and 100 as a percentage.
    #[serde(default)]
    pub rollout: Rollout,

    /// Import/export style to use in generated JavaScript modules.
    #[serde(default)]
    pub js_module_format: JsModuleFormat,

    /// Whether to treat all JS module names as relative to './' (true) or not.
    /// default: true
    #[serde(default = "default_true")]
    pub relativize_js_module_paths: bool,

    /// Extra configuration for the GraphQL schema itself.
    #[serde(default)]
    pub schema_config: SchemaConfig,

    /// Configuration for the @module GraphQL directive.
    #[serde(default)]
    pub module_import_config: ModuleImportConfig,

    /// Threshold for diagnostics to be critical to the compiler's execution.
    /// All diagnostic with severities at and below this level will cause the
    /// compiler to fatally exit.
    #[serde(default)]
    pub diagnostic_report_config: DiagnosticReportConfig,

    #[serde(default)]
    pub resolvers_schema_module: Option<ResolversSchemaModuleConfig>,

    /// Name of the command that runs the relay compiler. This will be added at
    /// the top of generated code to let readers know how to regenerate the file.
    #[serde(default)]
    pub codegen_command: Option<String>,
}

pub type PersistId = String;

pub type PersistResult<T> = std::result::Result<T, PersistError>;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ArtifactForPersister {
    pub text: String,
    pub relative_path: PathBuf,
    pub override_schema: Option<String>,
    /// The schema this document was compiled against, when the project's
    /// persist config asks for it to be sent. Shared rather than copied: every
    /// artifact in a build carries the same schema, which routinely runs to
    /// hundreds of kilobytes.
    pub schema_text: Option<Arc<String>>,
}

#[async_trait]
pub trait OperationPersister {
    async fn persist_artifact(&self, artifact: ArtifactForPersister) -> PersistResult<PersistId>;

    async fn persist_artifact_with_previous_id(
        &self,
        artifact: ArtifactForPersister,
        previous_id: Option<PersistId>,
    ) -> PersistResult<PersistId> {
        match previous_id {
            Some(previous_id) => Ok(previous_id),
            None => self.persist_artifact(artifact).await,
        }
    }

    async fn finalize(&self) -> PersistResult<()> {
        Ok(())
    }
}

// Below are structs that we use as part of our config that are defined in
// crates that are not part of Relay. We are not able to implement `JsonSchema`
// for these structs directly, so we define these shadow structs which match the
// deserialization shape of the original. We can then use `#[serde(with =
// "...")]` to have JsonSchema use these shadow structs to generate the schema.
//
// See [Schemars docs](https://graham.cool/schemars/examples/5-remote_derive/)
// for more context on this pattern.

/// Holds extended clock data that includes source control aware
/// query metadata.
/// <https://facebook.github.io/watchman/docs/scm-query.html>
#[derive(JsonSchema)]
#[serde(remote = "ScmAwareClockData")]
pub struct ScmAwareClockDataJsonSchemaDef {
    pub mergebase: Option<String>,
    #[serde(rename = "mergebase-with")]
    pub mergebase_with: Option<String>,
    #[serde(rename = "saved-state")]
    pub saved_state: Option<SavedStateClockDataJsonSchemaDef>,
}

/// Holds extended clock data that includes source control aware
/// query metadata.
/// <https://facebook.github.io/watchman/docs/scm-query.html>
#[derive(JsonSchema)]
#[serde(remote = "SavedStateClockData")]
pub struct SavedStateClockDataJsonSchemaDef {
    pub storage: Option<String>,
    #[serde(rename = "commit-id")]
    pub commit: Option<String>,
    pub config: Option<Value>,
}
