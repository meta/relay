/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::fmt;
use std::path::MAIN_SEPARATOR;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;

use common::DirectiveName;
use common::FeatureFlags;
use common::Rollout;
use common::SourceLocationKey;
use common::WithLocation;
use fmt::Debug;
use fnv::FnvBuildHasher;
use globset::GlobSet;
use indexmap::IndexMap;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use regex::Regex;
use schemars::JsonSchema;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::de::Error;
use serde_json::Value;

use crate::JsModuleFormat;
use crate::ProjectName;
use crate::TypegenConfig;
use crate::TypegenLanguage;
use crate::connection_interface::ConnectionInterface;
use crate::defer_stream_interface::DeferStreamInterface;
use crate::diagnostic_report_config::DiagnosticReportConfig;
use crate::module_import_config::ModuleImportConfig;
use crate::module_import_config::ModuleProvider;
use crate::non_node_id_fields_config::NonNodeIdFieldsConfig;
use crate::resolvers_schema_module_config::ResolversSchemaModuleConfig;

type FnvIndexMap<K, V> = IndexMap<K, V, FnvBuildHasher>;

/// The POST parameter carrying the schema when
/// `RemotePersistConfig::include_schema_text` is set, alongside the operation
/// itself in `text`.
pub const SCHEMA_TEXT_PARAM: &str = "schema_text";

/// The host integration whose Relay RSC capability defaults should be used.
#[derive(
    Clone,
    Copy,
    Debug,
    Default,
    Deserialize,
    Eq,
    JsonSchema,
    PartialEq,
    Serialize
)]
pub enum RelayRscHostMode {
    /// A server-owned integration with no client-rooted operations or Cells by
    /// default. Incremental delivery is enabled by default.
    #[default]
    #[serde(rename = "nextjs")]
    NextJs,
    /// The CometJS integration, including client-rooted operations,
    /// incremental delivery, and Cells by default.
    #[serde(rename = "cometjs")]
    CometJs,
}

/// Host defaults and project-specific overrides for Relay RSC compilation.
#[derive(
    Clone,
    Copy,
    Debug,
    Default,
    Deserialize,
    Eq,
    JsonSchema,
    PartialEq,
    Serialize
)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct RelayRscProjectConfig {
    /// Selects the host capability defaults. Defaults to `nextjs`.
    #[serde(default)]
    mode: RelayRscHostMode,
    /// Whether client-rooted operations may reach Relay RSC fields.
    #[serde(default)]
    allow_client_rooted_operations: Option<bool>,
    /// Whether the host accepts Relay's supported incremental RSC responses.
    #[serde(default)]
    allow_incremental_delivery: Option<bool>,
    /// Whether the compiler may generate Relay RSC Cell definitions.
    #[serde(default)]
    enable_cells: Option<bool>,
}

/// The fully resolved Relay RSC capabilities consumed by compiler passes.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RelayRscCapabilities {
    /// Whether client-rooted operations may reach Relay RSC fields.
    pub allow_client_rooted_operations: bool,
    /// Whether the host accepts Relay's supported incremental RSC responses.
    pub allow_incremental_delivery: bool,
    /// Whether the compiler may generate Relay RSC Cell definitions.
    pub enable_cells: bool,
}

impl RelayRscProjectConfig {
    fn resolve(&self) -> RelayRscCapabilities {
        let defaults = match self.mode {
            RelayRscHostMode::NextJs => RelayRscCapabilities {
                allow_client_rooted_operations: false,
                allow_incremental_delivery: true,
                enable_cells: false,
            },
            RelayRscHostMode::CometJs => RelayRscCapabilities {
                allow_client_rooted_operations: true,
                allow_incremental_delivery: true,
                enable_cells: true,
            },
        };

        RelayRscCapabilities {
            allow_client_rooted_operations: self
                .allow_client_rooted_operations
                .unwrap_or(defaults.allow_client_rooted_operations),
            allow_incremental_delivery: self
                .allow_incremental_delivery
                .unwrap_or(defaults.allow_incremental_delivery),
            enable_cells: self.enable_cells.unwrap_or(defaults.enable_cells),
        }
    }
}

/// Configuration for remote persistence of GraphQL documents.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct RemotePersistConfig {
    /// URL that the document should be persisted to via a POST request.
    pub url: String,
    /// Additional parameters to include in the POST request.
    ///
    /// The main document will be in a POST parameter `text`. This map can contain
    /// additional parameters to send.
    #[serde(default)]
    pub params: FnvIndexMap<String, String>,

    /// Additional headers to include in the POST request.
    #[serde(default)]
    pub headers: FnvIndexMap<String, String>,

    /// Send the project's schema with every persist request, as the
    /// `schema_text` POST parameter next to the operation in `text`.
    ///
    /// Use it when the persist endpoint cannot look the schema up by name — an
    /// app that composes its schema at build time, for instance, whose
    /// documents the endpoint has no other way to validate.
    ///
    /// What is sent is the project's server schema. Client-side additions are
    /// not included — neither `schemaExtensions` nor the types Relay Resolvers
    /// add through docblocks — since the compiler strips selections on those
    /// out of a document before persisting it.
    ///
    /// Not supported for `schemaCompact` projects, which keep the schema as
    /// bytes and have no text to send.
    ///
    /// While the schema is being sent, persist requests are capped at 16
    /// concurrent unless `concurrency` says otherwise, since each in-flight
    /// request holds its own copy of the schema.
    #[serde(default)]
    pub include_schema_text: bool,

    /// Number of concurrent requests that can be made to the server.
    #[serde(
        default,
        rename = "concurrency",
        deserialize_with = "deserialize_semaphore_permits"
    )]
    pub semaphore_permits: Option<usize>,

    /// Whether to include the query text in the persisted document.
    #[serde(default)]
    pub include_query_text: bool,
}

fn deserialize_semaphore_permits<'de, D>(d: D) -> Result<Option<usize>, D::Error>
where
    D: Deserializer<'de>,
{
    let permits: usize = Deserialize::deserialize(d)?;
    if permits == 0 {
        return Err(Error::custom(
            "Invalid `persistConfig.concurrency` value. Please, increase the number of concurrent request for query persisting. 0 is not going to work.",
        ));
    }
    Ok(Some(permits))
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[derive(JsonSchema)]
pub enum LocalPersistAlgorithm {
    #[default]
    MD5,
    SHA1,
    SHA256,
}

/// Configuration for local persistence of GraphQL documents.
///
/// This struct contains settings that control how GraphQL documents are persisted locally.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct LocalPersistConfig {
    /// The file path where the persisted documents will be written.
    pub file: PathBuf,

    /// The algorithm to use for hashing the operation text.
    #[serde(default)]
    pub algorithm: LocalPersistAlgorithm,

    /// Whether to include the query text in the persisted document.
    #[serde(default)]
    pub include_query_text: bool,
}

/// Configuration for a persistent process that exchanges one JSON object per line.
///
/// For each operation, the compiler writes a request to the process's stdin:
/// `{"type":"persist","text":"...","relativePath":"...","overrideSchema":null,"previousId":null}`.
/// `text` is the GraphQL operation, and `relativePath` is its generated artifact path.
/// `overrideSchema` and `previousId` are strings when available, otherwise `null`.
/// `schemaText` is present only when `includeSchemaText` is enabled.
/// The process writes `{"type":"persisted","id":"..."}` to stdout in reply.
/// After all operations succeed, the compiler sends `{"type":"finalize"}` and
/// expects `{"type":"finalized"}`. Each request receives one response line;
/// process diagnostics should go to stderr rather than stdout.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ProcessPersistConfig {
    /// Executable to start directly, without a shell.
    pub command: PathBuf,

    /// Arguments passed to the executable.
    #[serde(default)]
    pub args: Vec<String>,

    /// Whether to retain the query text in the generated artifact alongside the persisted ID.
    #[serde(default)]
    pub include_query_text: bool,

    /// Whether to send the project's server SDL as `schemaText` with each persist request.
    /// Client schema extensions are excluded. Requires `schema` or `schemaDir`,
    /// not `schemaCompact`, and a worker that accepts `schemaText`.
    #[serde(default)]
    pub include_schema_text: bool,
}

/// Configuration for how the Relay Compiler should persist GraphQL queries.
#[derive(Debug, Serialize, Clone, JsonSchema)]
#[serde(untagged)]
pub enum PersistConfig {
    /// This variant represents a persistent child process used for query persistence.
    Process(ProcessPersistConfig),
    /// This variant represents a remote persistence configuration, where GraphQL queries are sent to a remote endpoint for persistence.
    Remote(RemotePersistConfig),
    /// This variant represents a local persistence configuration, where GraphQL queries are persisted to a local JSON file.
    ///
    /// When this variant is used, the compiler will attempt to read the local file as a hash map,
    /// add new queries to the map, and then serialize and write the resulting map to the configured path.
    /// The file (and any missing parent directories) is created if it does not already exist.
    Local(LocalPersistConfig),
}

impl PersistConfig {
    pub fn include_query_text(&self) -> bool {
        match self {
            PersistConfig::Process(process_config) => process_config.include_query_text,
            PersistConfig::Remote(remote_config) => remote_config.include_query_text,
            PersistConfig::Local(local_config) => local_config.include_query_text,
        }
    }

    /// Whether the project's schema should be sent with each persist request.
    pub fn include_schema_text(&self) -> bool {
        match self {
            PersistConfig::Process(process_config) => process_config.include_schema_text,
            PersistConfig::Remote(remote_config) => remote_config.include_schema_text,
            PersistConfig::Local(_) => false,
        }
    }
}

impl<'de> Deserialize<'de> for PersistConfig {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        let value = Value::deserialize(deserializer)?;
        match ProcessPersistConfig::deserialize(value.clone()) {
            Ok(process_config) => Ok(PersistConfig::Process(process_config)),
            Err(process_error) => match RemotePersistConfig::deserialize(value.clone()) {
                Ok(remote_config) => {
                    // Both would be sent, and which one the endpoint honors is
                    // unspecified. The parameter is ours to set when
                    // `includeSchemaText` is on, so a configured one is a mistake.
                    if remote_config.include_schema_text
                        && remote_config.params.contains_key(SCHEMA_TEXT_PARAM)
                    {
                        return Err(Error::custom(format!(
                            "`persistConfig.params.{SCHEMA_TEXT_PARAM}` cannot be set together with `includeSchemaText`, which sends the project's schema under that same parameter. Remove one of them."
                        )));
                    }

                    Ok(PersistConfig::Remote(remote_config))
                }
                Err(remote_error) => match LocalPersistConfig::deserialize(value) {
                    Ok(local_config) => Ok(PersistConfig::Local(local_config)),
                    Err(local_error) => {
                        let error_message = format!(
                            r#"Persist configuration cannot be parsed as a process configuration due to:
- {process_error:?}.

It also cannot be parsed as a remote configuration due to:
- {remote_error:?}.

It also cannot be a local persist configuration due to:
- {local_error:?}."#
                        );

                        Err(Error::custom(error_message))
                    }
                },
            },
        }
    }
}

/// Specifies the type of location of a GraphQL schema, and the path to the schema location.
#[derive(Clone, Debug, JsonSchema)]
pub enum SchemaLocation {
    /// A single file containing the schema.
    File(PathBuf),
    /// A directory containing multiple schema files.
    Directory(PathBuf),
    /// A single file containing a compact-serialized schema.
    CompactFile(PathBuf),
}

pub struct ExtraArtifactsConfig {
    pub filename_for_artifact: Box<dyn (Fn(SourceLocationKey, StringKey) -> String) + Send + Sync>,
    pub skip_types_for_artifact: Box<dyn (Fn(SourceLocationKey) -> bool) + Send + Sync>,
}

impl Debug for ExtraArtifactsConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ExtraArtifactsConfig")
            .field("filename_for_artifact", &"Fn")
            .field("skip_types_for_artifact", &"Fn")
            .finish()
    }
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SchemaConfig {
    /// Configuration for connection field names in the schema.
    ///
    /// **Important**: When you configure this option in the compiler, you must also configure
    /// the Relay runtime to match by calling `ConnectionInterface.inject()` with the same values.
    /// See: <https://relay.dev/docs/api-reference/runtime-config/#connectioninterface>
    #[serde(default)]
    pub connection_interface: ConnectionInterface,

    /// The name of the `id` field that exists on the `Node` interface.
    #[serde(default = "default_node_interface_id_field")]
    pub node_interface_id_field: StringKey,

    #[serde(default)]
    pub defer_stream_interface: DeferStreamInterface,

    /// The name of the variable expected by the `node` query.
    #[serde(default = "default_node_interface_id_variable_name")]
    pub node_interface_id_variable_name: StringKey,

    #[serde(default)]
    pub non_node_id_fields: Option<NonNodeIdFieldsConfig>,

    /// The name of the directive indicating fields that cannot be selected
    #[serde(default = "default_unselectable_directive_name")]
    pub unselectable_directive_name: DirectiveName,

    /// If we should select __token field on fetchable types
    #[serde(default = "default_enable_token_field")]
    pub enable_token_field: bool,
}

fn default_node_interface_id_field() -> StringKey {
    "id".intern()
}

fn default_node_interface_id_variable_name() -> StringKey {
    "id".intern()
}

fn default_unselectable_directive_name() -> DirectiveName {
    DirectiveName("unselectable".intern())
}

fn default_enable_token_field() -> bool {
    false
}

impl Default for SchemaConfig {
    fn default() -> Self {
        Self {
            connection_interface: ConnectionInterface::default(),
            defer_stream_interface: DeferStreamInterface::default(),
            node_interface_id_field: default_node_interface_id_field(),
            node_interface_id_variable_name: default_node_interface_id_variable_name(),
            non_node_id_fields: None,
            unselectable_directive_name: default_unselectable_directive_name(),
            enable_token_field: default_enable_token_field(),
        }
    }
}

type CustomArtifactFilePath = Box<dyn Fn(&PathBuf) -> PathBuf + Send + Sync>;

/// Configuration for a Relay project.
///
/// This struct contains various settings and options that control how Relay compiles and generates code for a project.
pub struct ProjectConfig {
    /// The name of the project.
    pub name: ProjectName,
    /// The base project configuration to inherit from.
    pub base: Option<ProjectName>,
    /// The output directory for extra artifacts.
    pub extra_artifacts_output: Option<PathBuf>,
    /// The configuration for extra artifacts.
    pub extra_artifacts_config: Option<ExtraArtifactsConfig>,
    /// A list of glob patterns specifying file extensions to exclude from compilation.
    pub excludes_extensions: Option<GlobSet>,
    /// The output directory for compiled artifacts.
    pub output: Option<PathBuf>,
    /// Whether to shard output into separate files.
    pub shard_output: bool,
    /// A regular expression to strip from file paths when sharding output.
    pub shard_strip_regex: Option<Regex>,
    /// A list of schema extensions to include in the project.
    pub schema_extensions: Vec<PathBuf>,
    /// Whether the project is enabled.
    pub enabled: bool,
    /// The name of the schema to use for this project.
    pub schema_name: Option<StringKey>,
    /// The location of the schema for this project.
    pub schema_location: SchemaLocation,
    /// The schema configuration for this project.
    pub schema_config: SchemaConfig,
    /// The typegen configuration for this project.
    pub typegen_config: TypegenConfig,
    /// The persist configuration for this project.
    pub persist: Option<PersistConfig>,
    /// Whether to include variable names in comments.
    pub variable_names_comment: bool,
    /// Additional metadata for the project.
    pub extra: serde_json::Value,
    /// Feature flags for the project.
    pub feature_flags: Arc<FeatureFlags>,
    /// Relay RSC host defaults and project-specific capability overrides.
    pub relay_rsc: RelayRscProjectConfig,
    /// Regular expression to match test files.
    pub test_path_regex: Option<Regex>,
    /// Rollout configuration for the project.
    pub rollout: Rollout,
    /// Format for JavaScript modules.
    pub js_module_format: JsModuleFormat,
    /// Configuration for module imports.
    pub module_import_config: ModuleImportConfig,
    /// Configuration for diagnostic reports.
    pub diagnostic_report_config: DiagnosticReportConfig,
    /// Configuration for resolvers schema module.
    pub resolvers_schema_module: Option<ResolversSchemaModuleConfig>,
    /// Command to run after code generation.
    pub codegen_command: Option<String>,
    /// Custom function to get the path for an artifact.
    pub get_custom_path_for_artifact: Option<CustomArtifactFilePath>,
    /// Treats JS module paths as relative to './' when true, and leaves JS
    /// module paths unmodified when false.
    pub relativize_js_module_paths: bool,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            name: ProjectName::default(),
            feature_flags: Default::default(),
            base: None,
            extra_artifacts_output: None,
            extra_artifacts_config: None,
            excludes_extensions: None,
            output: None,
            shard_output: false,
            shard_strip_regex: None,
            schema_extensions: vec![],
            enabled: true,
            schema_location: SchemaLocation::File(PathBuf::default()),
            schema_name: None,
            schema_config: Default::default(),
            typegen_config: Default::default(),
            persist: None,
            variable_names_comment: false,
            extra: Default::default(),
            relay_rsc: Default::default(),
            test_path_regex: None,
            rollout: Default::default(),
            js_module_format: Default::default(),
            module_import_config: Default::default(),
            diagnostic_report_config: Default::default(),
            resolvers_schema_module: Default::default(),
            codegen_command: Default::default(),
            get_custom_path_for_artifact: None,
            relativize_js_module_paths: true,
        }
    }
}

impl Debug for ProjectConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let ProjectConfig {
            name,
            base,
            extra_artifacts_output,
            extra_artifacts_config,
            excludes_extensions,
            output,
            shard_output,
            shard_strip_regex,
            schema_extensions,
            enabled,
            schema_location,
            schema_name,
            schema_config,
            typegen_config,
            persist,
            variable_names_comment,
            extra,
            feature_flags,
            relay_rsc,
            test_path_regex,
            rollout,
            js_module_format,
            module_import_config,
            diagnostic_report_config,
            resolvers_schema_module,
            codegen_command,
            get_custom_path_for_artifact: _,
            relativize_js_module_paths,
        } = self;
        f.debug_struct("ProjectConfig")
            .field("name", name)
            .field("base", base)
            .field("output", output)
            .field("extra_artifacts_config", extra_artifacts_config)
            .field("extra_artifacts_output", extra_artifacts_output)
            .field("excludes_extensions", excludes_extensions)
            .field("shard_output", shard_output)
            .field("shard_strip_regex", shard_strip_regex)
            .field("schema_extensions", schema_extensions)
            .field("enabled", enabled)
            .field("schema_location", schema_location)
            .field("schema_name", schema_name)
            .field("schema_config", schema_config)
            .field("typegen_config", typegen_config)
            .field("persist", persist)
            .field("variable_names_comment", variable_names_comment)
            .field("extra", extra)
            .field("feature_flags", feature_flags)
            .field("relay_rsc", relay_rsc)
            .field("test_path_regex", test_path_regex)
            .field("rollout", rollout)
            .field("js_module_format", js_module_format)
            .field("module_import_config", module_import_config)
            .field("diagnostic_report_config", diagnostic_report_config)
            .field("resolvers_schema_module", resolvers_schema_module)
            .field("codegen_command", codegen_command)
            .field("relativize_js_module_paths", relativize_js_module_paths)
            .finish()
    }
}

impl ProjectConfig {
    /// Returns Relay RSC host capabilities when the project-wide gate is on.
    pub fn relay_rsc_capabilities(&self) -> Option<RelayRscCapabilities> {
        self.feature_flags
            .enable_relay_rsc
            .then(|| self.relay_rsc.resolve())
    }

    /// Gets the correct path for a generated artifact based on its originating source file's
    /// location, and the project's configuration.
    pub fn create_path_for_artifact(
        &self,
        source_file: SourceLocationKey,
        artifact_file_name: String,
    ) -> PathBuf {
        if let Some(output) = &self.output {
            // If an output directory is specified, output into that directory.
            if self.shard_output {
                if let Some(ref regex) = self.shard_strip_regex {
                    let full_source_path = regex.replace_all(source_file.path(), "");
                    let mut output = output.join(full_source_path.to_string());
                    output.pop();
                    output
                } else {
                    output.join(source_file.get_dir())
                }
                .join(artifact_file_name)
            } else {
                output.join(artifact_file_name)
            }
        } else {
            // Otherwise, output into a file relative to the source.
            source_file
                .get_dir()
                .join("__generated__")
                .join(artifact_file_name)
        }
    }

    /// Gets the path for a generated *extra* artifact based on its
    /// originating source file's location and the project's configuration.
    ///
    /// Mirrors [`Self::create_path_for_artifact`], except the output root is
    /// `extra_artifacts_output`. Sharding is opt-in via `should_shard` —
    /// callers gate this on a feature flag while the new behavior is rolled
    /// out, so that passing `should_shard = false` reproduces the legacy
    /// flat layout (`extra_artifacts_output.join(file_name)`).
    ///
    /// When `should_shard` is true but the project does not set
    /// `shardOutput`, the call silently falls back to the flat layout. This
    /// is intentional: the feature flag may be enabled across many projects
    /// during rollout, but only those that already opt into `shardOutput`
    /// get the new sharded layout.
    ///
    /// Panics if `extra_artifacts_output` is unset; only projects that
    /// configure `extraArtifactsOutput` produce extra artifacts, so reaching
    /// this with no output configured indicates an internal invariant
    /// violation rather than user misconfiguration.
    pub fn create_path_for_extra_artifact(
        &self,
        source_file: SourceLocationKey,
        artifact_file_name: String,
        should_shard: bool,
    ) -> PathBuf {
        let output = self.extra_artifacts_output.as_ref().expect(
            "create_path_for_extra_artifact called without `extraArtifactsOutput` set on the project config",
        );
        if should_shard && self.shard_output {
            let sharded_dir = if let Some(ref regex) = self.shard_strip_regex {
                let full_source_path = regex.replace_all(source_file.path(), "");
                let mut path = output.join(full_source_path.to_string());
                // `full_source_path` still includes the source file name; pop it to get the directory.
                path.pop();
                path
            } else {
                output.join(source_file.get_dir())
            };
            // Sharding mirrors the source directory structure into the output path. Some source
            // dirs (e.g. Comet RSC `[id]` route dirs) contain characters disallowed by the
            // `invalid-filename` path linter; emitting such a path would make the artifact
            // unlandable. Fall back to the flat layout for those sources.
            if path_has_disallowed_filename_chars(&sharded_dir) {
                output.join(artifact_file_name)
            } else {
                sharded_dir.join(artifact_file_name)
            }
        } else {
            output.join(artifact_file_name)
        }
    }

    /// Generates a path for an artifact file based on a definition name and its location.
    pub fn artifact_path_for_definition(
        &self,
        definition_name: WithLocation<impl Into<StringKey>>,
    ) -> PathBuf {
        let source_location = definition_name.location.source_location();
        let artifact_name = definition_name.item.into();
        let path = if let Some(extra_artifacts_config) = &self.extra_artifacts_config {
            let filename =
                (extra_artifacts_config.filename_for_artifact)(source_location, artifact_name);

            self.create_path_for_artifact(source_location, filename)
        } else {
            self.path_for_language_specific_artifact(
                source_location,
                format!("{artifact_name}.graphql"),
            )
        };
        if let Some(get_custom_path_for_artifact) = &self.get_custom_path_for_artifact {
            get_custom_path_for_artifact(&path)
        } else {
            path
        }
    }

    /// Generates a path for an artifact file that is specific to the programming language being used.
    pub fn path_for_language_specific_artifact(
        &self,
        source_file: SourceLocationKey,
        artifact_file_name: String,
    ) -> PathBuf {
        let filename = match &self.typegen_config.language {
            TypegenLanguage::Flow | TypegenLanguage::JavaScript => {
                format!("{artifact_file_name}.js")
            }
            TypegenLanguage::TypeScript => format!("{artifact_file_name}.ts"),
        };

        self.create_path_for_artifact(source_file, filename)
    }

    /// Returns `module_import_config` with `dynamic_module_provider` filled in when absent.
    /// For non-Haste (CommonJS) projects the default is `() => import('<$module>')`, which
    /// generates standard ES dynamic-import expressions without any extra user configuration.
    pub fn effective_module_import_config(&self) -> ModuleImportConfig {
        if self.module_import_config.dynamic_module_provider.is_none()
            && !matches!(self.js_module_format, JsModuleFormat::Haste)
        {
            ModuleImportConfig {
                dynamic_module_provider: Some(ModuleProvider::Custom {
                    statement: "() => import('<$module>')".intern(),
                }),
                ..self.module_import_config
            }
        } else {
            self.module_import_config
        }
    }

    /// Generates identifier for importing module at `target_module_path` from module at `importing_artifact_path`.
    /// Import Identifier is a relative path in CommonJS projects and a module name in Haste projects.
    pub fn js_module_import_identifier(
        &self,
        importing_artifact_path: &PathBuf,
        target_module_path: &PathBuf,
    ) -> StringKey {
        match self.js_module_format {
            JsModuleFormat::CommonJS => {
                let importing_artifact_directory = importing_artifact_path.parent().unwrap_or_else(||{
                    panic!(
                        "expected importing_artifact_path: {importing_artifact_path:?} to have a parent path, maybe it's not a file?"
                    );
                });
                let target_module_directory = target_module_path.parent().unwrap_or_else(||{
                    panic!(
                        "expected target_module_path: {target_module_path:?} to have a parent path, maybe it's not a file?"
                    );
                });
                let target_module_file_name = target_module_path.file_name().unwrap_or_else(|| {
                    panic!(
                        "expected target_module_path: {target_module_path:?} to have a file name"
                    )
                });
                let relative_path =
                    pathdiff::diff_paths(target_module_directory, importing_artifact_directory)
                        .unwrap();

                format_normalized_path(&relative_path.join(target_module_file_name)).intern()
            }
            JsModuleFormat::Haste => target_module_path
                .file_stem()
                .unwrap()
                .to_string_lossy()
                .intern(),
        }
    }
}

/// Returns true if `path` contains any character the `invalid-filename` path linter
/// rejects. The linter allows only `[A-Za-z0-9._@+/$-]`; anything else (e.g. the `[`/`]`
/// in Comet RSC `[id]` route dirs) would make a sharded artifact path unlandable.
fn path_has_disallowed_filename_chars(path: &Path) -> bool {
    !path.to_string_lossy().chars().all(|c| {
        c.is_ascii_alphanumeric()
            || std::path::is_separator(c)
            || matches!(c, '.' | '-' | '_' | '@' | '+' | '$')
    })
}

// Stringify a path such that it is stable across operating systems.
fn format_normalized_path(path: &Path) -> String {
    path.to_string_lossy()
        .to_string()
        .replace(MAIN_SEPARATOR, "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project_with_extra(
        extra_artifacts_output: Option<&str>,
        shard_output: bool,
        shard_strip_regex: Option<&str>,
    ) -> ProjectConfig {
        ProjectConfig {
            extra_artifacts_output: extra_artifacts_output.map(PathBuf::from),
            shard_output,
            shard_strip_regex: shard_strip_regex.map(|r| Regex::new(r).unwrap()),
            ..Default::default()
        }
    }

    #[test]
    fn extra_artifact_path_unsharded_keeps_legacy_flat_layout() {
        let config = project_with_extra(Some("out/extra"), true, Some("^src/"));
        let path = config.create_path_for_extra_artifact(
            SourceLocationKey::standalone("src/components/foo/Bar.js"),
            "BarOperation.graphql.js".to_owned(),
            false,
        );
        assert_eq!(
            path,
            PathBuf::from("out/extra/BarOperation.graphql.js"),
            "shard=false should produce the same flat path as the legacy call site"
        );
    }

    #[test]
    fn extra_artifact_path_sharded_with_regex_mirrors_normal_artifact_layout() {
        let config = project_with_extra(Some("out/extra"), true, Some("^src/"));
        let path = config.create_path_for_extra_artifact(
            SourceLocationKey::standalone("src/components/foo/Bar.js"),
            "BarOperation.graphql.js".to_owned(),
            true,
        );
        assert_eq!(
            path,
            PathBuf::from("out/extra/components/foo/BarOperation.graphql.js"),
            "Source 'src/components/foo/Bar.js' with regex '^src/' should shard under 'components/foo/'"
        );
    }

    #[test]
    fn extra_artifact_path_sharded_without_regex_uses_full_source_dir() {
        let config = project_with_extra(Some("out/extra"), true, None);
        let path = config.create_path_for_extra_artifact(
            SourceLocationKey::standalone("a/b/c/Bar.js"),
            "BarOperation.graphql.js".to_owned(),
            true,
        );
        assert_eq!(
            path,
            PathBuf::from("out/extra/a/b/c/BarOperation.graphql.js"),
        );
    }

    #[test]
    fn extra_artifact_path_with_disallowed_chars_falls_back_to_flat_layout() {
        // Comet RSC route directories such as `[id]` contain `[`/`]`, which the
        // `invalid-filename` path linter rejects. Mirroring such a source directory into
        // the sharded output would write an unlandable bracketed path, so sharding must
        // fall back to the flat layout for these sources.
        let config = project_with_extra(Some("out/extra"), true, Some("^src/"));
        let path = config.create_path_for_extra_artifact(
            SourceLocationKey::standalone("src/comet/routes/[id]/Bar.js"),
            "BarOperation.graphql.js".to_owned(),
            true,
        );
        assert_eq!(
            path,
            PathBuf::from("out/extra/BarOperation.graphql.js"),
            "a source dir with disallowed filename chars (brackets) must not be sharded"
        );
    }

    #[test]
    fn extra_artifact_path_shard_arg_ignored_when_project_does_not_shard() {
        let config = project_with_extra(Some("out/extra"), false, Some("^src/"));
        let path = config.create_path_for_extra_artifact(
            SourceLocationKey::standalone("src/components/foo/Bar.js"),
            "BarOperation.graphql.js".to_owned(),
            true,
        );
        assert_eq!(path, PathBuf::from("out/extra/BarOperation.graphql.js"),);
    }

    #[test]
    #[should_panic(expected = "extraArtifactsOutput")]
    fn extra_artifact_path_panics_without_extra_artifacts_output() {
        let config = project_with_extra(None, true, Some("^src/"));
        let _ = config.create_path_for_extra_artifact(
            SourceLocationKey::standalone("src/components/foo/Bar.js"),
            "Bar.graphql.js".to_owned(),
            true,
        );
    }

    fn parse_persist_config(json: &str) -> Result<PersistConfig, serde_json::Error> {
        serde_json::from_str(json)
    }

    #[test]
    fn persist_config_with_url_is_a_remote_config() {
        let config = parse_persist_config(r#"{"url": "https://example.com/persist"}"#).unwrap();
        match config {
            PersistConfig::Remote(remote_config) => {
                assert_eq!(remote_config.url, "https://example.com/persist");
                assert!(
                    !remote_config.include_schema_text,
                    "sending the schema is opt-in; omitting the key must not send one"
                );
            }
            other => panic!("expected a remote config, got {other:?}"),
        }
    }

    #[test]
    fn remote_persist_config_accepts_include_schema_text() {
        let config = parse_persist_config(
            r#"{"url": "https://example.com/persist", "includeSchemaText": true}"#,
        )
        .unwrap();
        match config {
            PersistConfig::Remote(remote_config) => {
                assert!(remote_config.include_schema_text);
            }
            other => panic!("expected a remote config, got {other:?}"),
        }
    }

    #[test]
    fn remote_persist_config_rejects_a_schema_text_param_alongside_include_schema_text() {
        let error = parse_persist_config(
            r#"{"url": "https://example.com/persist", "includeSchemaText": true, "params": {"schema_text": "..."}}"#,
        )
        .unwrap_err();
        let message = error.to_string();
        assert!(
            message.contains("cannot be set together with `includeSchemaText`"),
            "the conflict must be named: {message}"
        );
    }

    #[test]
    fn remote_persist_config_allows_a_schema_text_param_without_include_schema_text() {
        // Nothing of ours is sent, so a caller who wants to manage the
        // parameter by hand still can.
        let config = parse_persist_config(
            r#"{"url": "https://example.com/persist", "params": {"schema_text": "..."}}"#,
        )
        .unwrap();
        assert!(matches!(config, PersistConfig::Remote(_)), "got {config:?}");
    }

    #[test]
    fn persist_config_with_command_is_a_process_config() {
        let config = parse_persist_config(
            r#"{"command": "/path/to/persister", "args": ["--mode", "relay"]}"#,
        )
        .expect("process config should parse");
        match config {
            PersistConfig::Process(process_config) => {
                assert_eq!(process_config.command, PathBuf::from("/path/to/persister"));
                assert_eq!(
                    process_config.args,
                    vec!["--mode".to_owned(), "relay".to_owned()]
                );
            }
            other => panic!("expected a process config, got {other:?}"),
        }
    }

    #[test]
    fn process_persist_config_does_not_include_query_or_schema_text() {
        let config = parse_persist_config(r#"{"command": "/path/to/persister"}"#)
            .expect("process config should parse");
        assert!(!config.include_query_text());
        assert!(!config.include_schema_text());
    }

    #[test]
    fn process_persist_config_accepts_include_query_text() {
        let config =
            parse_persist_config(r#"{"command": "/path/to/persister", "includeQueryText": true}"#)
                .expect("process config should parse");
        assert!(matches!(config, PersistConfig::Process(_)));
        assert!(config.include_query_text());
    }

    #[test]
    fn process_persist_config_accepts_include_schema_text() {
        let config =
            parse_persist_config(r#"{"command": "/path/to/persister", "includeSchemaText": true}"#)
                .expect("process config should parse");
        assert!(matches!(config, PersistConfig::Process(_)));
        assert!(config.include_schema_text());
        assert!(!config.include_query_text());
    }
}
