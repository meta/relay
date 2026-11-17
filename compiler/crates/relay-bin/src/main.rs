/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::env;
use std::env::current_dir;
#[cfg(unix)]
use std::path::Path;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;

use clap::Parser;
use clap::ValueEnum;
use common::ConsoleLogger;
use intern::string_key::Intern;
use log::error;
use log::info;
use relay_codemod::AvailableCodemod;
use relay_codemod::run_codemod;
#[cfg(unix)]
use relay_compiler::DeferredArtifactCache;
#[cfg(unix)]
use relay_compiler::DeferredArtifactWriter;
use relay_compiler::FileSourceKind;
use relay_compiler::LocalPersister;
#[cfg(unix)]
use relay_compiler::NoopArtifactWriter;
use relay_compiler::OperationPersister;
use relay_compiler::PersistConfig;
use relay_compiler::ProcessPersister;
use relay_compiler::ProjectName;
use relay_compiler::RemotePersister;
use relay_compiler::build_project::artifact_writer::ArtifactValidationWriter;
use relay_compiler::build_project::generate_extra_artifacts::default_generate_extra_artifacts_fn;
use relay_compiler::compiler::Compiler;
use relay_compiler::config::Config;
use relay_compiler::config::ConfigFile;
use relay_compiler::errors::Error as CompilerError;
use relay_compiler::get_programs;
#[cfg(unix)]
use relay_compiler::server_daemon;
#[cfg(unix)]
use relay_compiler::server_daemon::protocol::DaemonRequest;
#[cfg(unix)]
use relay_compiler::server_daemon::protocol::DaemonResponse;
#[cfg(unix)]
use relay_compiler::server_daemon::socket::ServerConfig as DaemonServerConfig;
#[cfg(unix)]
use relay_compiler::status_reporter::BuildStatus;
#[cfg(unix)]
use relay_compiler::status_reporter::NoopStatusReporter;
use relay_compiler::subschema_extraction::compile_and_extract_subschema;
use relay_lsp::DummyExtraDataProvider;
use relay_lsp::FieldDefinitionSourceInfo;
use relay_lsp::FieldSchemaInfo;
use relay_lsp::LSPExtraDataProvider;
use relay_lsp::start_language_server;
use schema::SDLSchema;
use schema_documentation::SchemaDocumentationLoader;
use simplelog::ColorChoice;
use simplelog::ConfigBuilder as SimpleLogConfigBuilder;
use simplelog::LevelFilter;
use simplelog::TermLogger;
use simplelog::TerminalMode;

mod errors;

use errors::Error;

#[derive(Parser)]
#[clap(
     name = "Relay Compiler",
     version = option_env!("CARGO_PKG_VERSION").unwrap_or("unknown"),
     about = "Compiles Relay files and writes generated files.",
     rename_all = "camel_case",
     args_conflicts_with_subcommands = true
 )]
struct Opt {
    #[clap(subcommand)]
    command: Option<Commands>,

    #[clap(flatten)]
    compile: CompileCommand,
}

#[derive(Parser)]
#[clap(
    rename_all = "camel_case",
    about = "Apply codemod (verification with auto-applied fixes)"
)]
struct CodemodCommand {
    /// Compile only this project. You can pass this argument multiple times.
    /// to compile multiple projects. If excluded, all projects will be compiled.
    #[clap(name = "project", long, short)]
    projects: Vec<String>,

    /// Compile using this config file. If not provided, searches for a config in
    /// package.json under the `relay` key or `relay.config.json` files among other up
    /// from the current working directory.
    config: Option<PathBuf>,

    /// The name of the codemod to run
    #[clap(subcommand)]
    codemod: AvailableCodemod,
}

#[derive(Parser)]
#[clap(
    rename_all = "camel_case",
    about = "Compiles Relay files and writes generated files."
)]
struct CompileCommand {
    /// Compile and watch for changes
    #[clap(long, short)]
    watch: bool,

    /// Compile only this project. You can pass this argument multiple times.
    /// to compile multiple projects. If excluded, all projects will be compiled.
    #[clap(name = "project", long, short)]
    projects: Vec<String>,

    /// Compile using this config file. If not provided, searches for a config in
    /// package.json under the `relay` key or `relay.config.json` files among other up
    /// from the current working directory.
    config: Option<PathBuf>,

    #[clap(flatten)]
    cli_config: CliConfig,

    /// Run the persister even if the query has not changed.
    #[clap(long)]
    repersist: bool,

    /// Disable watchman and use directory traversal to find source files.
    /// Watch mode is not supported without watchman.
    #[clap(long, conflicts_with = "watch")]
    no_watchman: bool,

    /// Verbosity level
    #[clap(long, value_enum, default_value = "verbose")]
    output: OutputKind,

    /// Looks for pending changes and exits with non-zero code instead of
    /// writing to disk
    #[clap(long)]
    validate: bool,

    /// Send this build through the compiler daemon instead of compiling
    /// in-process. The daemon is started in the background on first use and
    /// reused across invocations, eliminating per-build startup cost. Pass
    /// `--daemon=false` to force an in-process build. When the working
    /// directory is mid-rebase / mid-merge, the build falls back to
    /// in-process automatically. Not compatible with `--watch`,
    /// `--validate`, `--repersist`, `--no-watchman`, or inline-config
    /// flags (`--src`, `--schema`, `--artifactDirectory`) — these all
    /// imply per-build behavior the daemon's in-memory state can't honor.
    /// Unix-only.
    #[cfg(unix)]
    #[clap(
        long,
        conflicts_with_all = &[
            "watch",
            "validate",
            "repersist",
            "no_watchman",
            "src",
            "schema",
            "artifact_directory",
        ],
    )]
    daemon: Option<bool>,
}

#[derive(Parser)]
#[clap(
    rename_all = "camel_case",
    about = "EXPERIMENTAL! Replaces the currently configured schema file with the portion of the provided --fullSchema that is actually used by this Relay project."
)]
struct UpdateSchemaCommand {
    /// Compile using this config file. If not provided, searches for a config in
    /// package.json under the `relay` key or `relay.config.json` files among other up
    /// from the current working directory.
    #[clap(long)]
    config: Option<PathBuf>,

    /// Path to the full schema file or directory to use as the source for extracting the used subset
    #[clap(long)]
    full_schema: PathBuf,

    /// Verbosity level
    #[clap(long, value_enum, default_value = "verbose")]
    output: OutputKind,
}

#[derive(Parser)]
#[clap(
    about = "Run the language server. Used by IDEs.",
    rename_all = "camel_case"
)]
struct LspCommand {
    /// Run the LSP using this config file. If not provided, searches for a config in
    /// package.json under the `relay` key or `relay.config.json` files among other up
    /// from the current working directory.
    config: Option<PathBuf>,

    /// Verbosity level
    #[clap(long, value_enum, default_value = "quiet-with-errors")]
    output: OutputKind,

    /// Script to be called to lookup the actual definition of a GraphQL entity for
    /// implementation-first GraphQL schemas.
    #[clap(long)]
    locate_command: Option<String>,
}

#[derive(Parser)]
#[clap(about = "Print the Json Schema definition for the Relay compiler config.")]
struct ConfigJsonSchemaCommand {}

#[derive(Parser)]
#[clap(
    rename_all = "camel_case",
    about = "EXPERIMENTAL! Compare intermediate representations (IR) of documents passed via left and right, outputs selections that exists in left but not in right."
)]
struct CompareDocumentIRCommand {
    /// Document in string, must contain exactly 1 operation.
    #[clap(long)]
    left: String,

    /// Document in string, must contain exactly 1 operation.
    #[clap(long)]
    right: String,

    /// Path(s) to the full schema file(s) to convert documents to intermediate representation (IR) for comparison.
    #[clap(long, num_args = 1..)]
    schema_paths: Vec<String>,
}

#[derive(clap::Subcommand)]
enum Commands {
    Compiler(CompileCommand),
    Lsp(LspCommand),
    ConfigJsonSchema(ConfigJsonSchemaCommand),
    Codemod(CodemodCommand),
    ExperimentalRegenerateSubSchema(UpdateSchemaCommand),
    ExperimentalCompareDocumentIR(CompareDocumentIRCommand),
    /// Manage the compiler daemon server.
    ///
    /// The daemon keeps an in-memory compiler state for fast incremental
    /// rebuilds and writes artifacts on demand via `relay server write`
    /// instead of after every build.
    #[cfg(unix)]
    Server(ServerOpt),
}

#[cfg(unix)]
#[derive(Parser)]
#[clap(rename_all = "camel_case")]
struct ServerOpt {
    /// Compile only this project. You can pass this argument multiple times.
    /// If excluded, all projects will be compiled.
    #[clap(long, short)]
    project: Vec<String>,

    /// Compile using this config file. If not provided, searches for a config
    /// in package.json under the `relay` key or `relay.config.json` files
    /// among other up from the current working directory.
    #[clap(long)]
    config: Option<PathBuf>,

    #[clap(subcommand)]
    command: ServerCommand,
}

#[cfg(unix)]
#[derive(Debug, clap::Subcommand)]
enum ServerCommand {
    /// Start the compiler daemon server.
    Start {
        /// Run the server in the foreground (default: spawn a background process).
        #[clap(long)]
        foreground: bool,
        /// [internal] Path to a saved-state file to use for the daemon's
        /// initial compiler setup, instead of fetching saved-state from
        /// infrastructure. Consumed once on first build; subsequent builds
        /// (e.g. after a source-control update inside the watch loop) use
        /// the normal saved-state path.
        #[clap(long)]
        initial_import_state: Option<PathBuf>,
        /// [internal] Path to a JSON file of files changed since the
        /// `initial_import_state` snapshot. When set together with
        /// `initial_import_state`, the daemon skips the Watchman SCM-aware
        /// query on its first build and seeds state from
        /// `(saved_state + changed_files)` directly. Subsequent builds use
        /// Watchman normally.
        #[clap(long, requires("initial_import_state"))]
        initial_changed_files_list: Option<PathBuf>,
    },
    /// Request the daemon to write cached artifacts to disk.
    Write,
    /// Check the daemon's compiler version.
    Version,
    /// Shut down the daemon.
    Shutdown,
    /// Print the path of the daemon log file.
    LogFilePath,
    /// List all known daemon instances and their status.
    List {
        /// Remove stale socket files and gone metadata files.
        #[clap(long)]
        cleanup: bool,
        /// Shut down all active daemons.
        #[clap(long)]
        shutdown: bool,
    },
}

#[derive(ValueEnum, Clone, Copy)]
enum OutputKind {
    Debug,
    Quiet,
    QuietWithErrors,
    Verbose,
}

#[derive(Parser)]
#[clap(rename_all = "camel_case")]
pub struct CliConfig {
    /// Path for the directory where to search for source code
    #[clap(long)]
    pub src: Option<String>,
    /// Path to schema file
    #[clap(long)]
    pub schema: Option<String>,
    /// Path to a directory, where the compiler should write artifacts
    #[clap(long)]
    pub artifact_directory: Option<String>,
}

impl CliConfig {
    fn is_defined(&self) -> bool {
        self.src.is_some() || self.schema.is_some() || self.artifact_directory.is_some()
    }

    fn get_config_string(self) -> String {
        let src = self.src.unwrap_or_else(|| "./src".into());
        let schema = self.schema.unwrap_or_else(|| "./path-to-schema".into());
        let artifact_directory = self.artifact_directory.map_or("".to_string(), |a| {
            format!("\n  \"artifactDirectory\": \"{}\",", a)
        });
        format!(
            r#"
 {{
   "src": "{}",
   "schema": "{}",{}
   "language": "javascript"
 }}"#,
            src, schema, artifact_directory
        )
    }
}

#[tokio::main]
async fn main() {
    let opt = Opt::parse();

    let command = opt.command.unwrap_or(Commands::Compiler(opt.compile));

    let result = match command {
        Commands::Compiler(command) => handle_compiler_command(command).await,
        Commands::Lsp(command) => handle_lsp_command(command).await,
        Commands::ConfigJsonSchema(_) => {
            println!("{}", ConfigFile::json_schema());
            Ok(())
        }
        Commands::Codemod(command) => handle_codemod_command(command).await,
        Commands::ExperimentalRegenerateSubSchema(command) => {
            handle_regenerate_subschema_command(command).await
        }
        Commands::ExperimentalCompareDocumentIR(command) => {
            handle_compare_document_ir_command(command)
        }
        #[cfg(unix)]
        Commands::Server(opt) => handle_server_command(opt).await,
    };

    if let Err(err) = result {
        error!("{}", err);
        std::process::exit(1);
    }
}

fn get_config(config_path: Option<PathBuf>) -> Result<Config, Error> {
    let result = match config_path {
        Some(config_path) => Config::load(config_path),
        None => Config::search(&current_dir().expect("Unable to get current working directory.")),
    };
    result.map_err(|err| {
        let is_config_error = matches!(
            err,
            CompilerError::ConfigError { .. } | CompilerError::ConfigFileValidation { .. }
        );
        let mut err = Error::ConfigError(err);
        if is_config_error {
            err = Error::ConfigErrorWithHint {
                source: Box::new(err),
            };
        }
        err
    })
}

/// Wire up the OSS CLI's default config extensions: the standard operation
/// persister (Process/Remote/Local from `project_config.persist`) and the default
/// extra-artifacts generator. Used by every entry point that drives a real
/// build.
fn apply_default_cli_extensions(config: &mut Config) {
    config.create_operation_persister = Some(Box::new(|project_config| {
        project_config.persist.as_ref().map(
            |persist_config| -> Box<dyn OperationPersister + Send + Sync> {
                match persist_config {
                    PersistConfig::Process(process_config) => {
                        Box::new(ProcessPersister::new(process_config.clone()))
                    }
                    PersistConfig::Remote(remote_config) => {
                        Box::new(RemotePersister::new(remote_config.clone()))
                    }
                    PersistConfig::Local(local_config) => {
                        Box::new(LocalPersister::new(local_config.clone()))
                    }
                }
            },
        )
    }));
    config.generate_extra_artifacts = Some(Box::new(default_generate_extra_artifacts_fn));
}

fn configure_logger(output: OutputKind, terminal_mode: TerminalMode) {
    let log_level = match output {
        OutputKind::Debug => LevelFilter::Debug,
        OutputKind::Quiet => LevelFilter::Off,
        OutputKind::QuietWithErrors => LevelFilter::Error,
        OutputKind::Verbose => LevelFilter::Info,
    };

    let log_config = SimpleLogConfigBuilder::new()
        .set_time_level(LevelFilter::Off)
        .set_target_level(LevelFilter::Off)
        .set_location_level(LevelFilter::Off)
        .set_thread_level(LevelFilter::Off)
        .build();

    TermLogger::init(log_level, log_config, terminal_mode, ColorChoice::Auto).unwrap();
}

/// Update Config if the `project` flag is set
fn set_project_flag(config: &mut Config, projects: &Vec<String>) -> Result<(), Error> {
    if projects.is_empty() {
        return Ok(());
    }

    for project_config in config.projects.values_mut() {
        project_config.enabled = false;
    }
    for selected_project in projects {
        let selected_project = ProjectName::from(selected_project.intern());

        if let Some(project_config) = config.projects.get_mut(&selected_project) {
            project_config.enabled = true;
        } else {
            return Err(Error::ProjectFilterError {
                details: format!(
                    "Project `{}` not found, available projects: {}.",
                    selected_project,
                    config
                        .projects
                        .keys()
                        .map(|name| name.to_string())
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
            });
        }
    }

    Ok(())
}

async fn handle_codemod_command(command: CodemodCommand) -> Result<(), Error> {
    let mut config = get_config(command.config)?;
    let root_dir = config.root_dir.clone();
    set_project_flag(&mut config, &command.projects)?;
    let programs = get_programs(config, Arc::new(ConsoleLogger))
        .await
        .map(|(programs, _, _)| programs.values().cloned().collect());

    match run_codemod(programs, root_dir, command.codemod).await {
        Ok(_) => Ok(()),
        Err(e) => Err(Error::CodemodError {
            details: format!("{:?}", e),
        }),
    }
}

async fn handle_regenerate_subschema_command(command: UpdateSchemaCommand) -> Result<(), Error> {
    configure_logger(command.output, TerminalMode::Mixed);
    let config = get_config(command.config)?;

    let result = compile_and_extract_subschema(config, &command.full_schema)
        .await
        .map_err(|e| Error::CompilerError {
            details: format!("{}", e),
        })?;

    // Write the used schema back to the original schema location
    std::fs::write(&result.original_schema_path, &result.schema_content).map_err(|e| {
        Error::ConfigError(CompilerError::ConfigError {
            details: format!(
                "Failed to write used schema file to {}: {}",
                result.original_schema_path.to_string_lossy(),
                e
            ),
        })
    })
}

fn handle_compare_document_ir_command(command: CompareDocumentIRCommand) -> Result<(), Error> {
    configure_logger(OutputKind::Verbose, TerminalMode::Mixed);

    let (_, message) =
        graphql_ir_diff::compare(command.schema_paths, &command.left, &command.right).map_err(
            |e| Error::CompilerError {
                details: format!("{}", e),
            },
        )?;

    info!("{}", message);
    Ok(())
}

async fn handle_compiler_command(command: CompileCommand) -> Result<(), Error> {
    configure_logger(command.output, TerminalMode::Mixed);

    if command.cli_config.is_defined() {
        return Err(Error::ConfigError(CompilerError::ConfigError {
            details: format!(
                "\nPassing Relay compiler configuration is not supported. Please add `relay.config.json` file,\nor \"relay\" section to your `package.json` file.\n\nCompiler configuration JSON:{}",
                command.cli_config.get_config_string(),
            ),
        }));
    }

    // `--daemon=true`: send this build through the compiler daemon (start it
    // in the background on first use, reuse on subsequent invocations). When
    // the working directory is mid-rebase / mid-merge we fall through to the
    // in-process build path below — the daemon's cached artifacts would be
    // derived from pre-merge state and applying them mid-merge can stomp on
    // the user's in-progress resolution.
    #[cfg(unix)]
    if matches!(command.daemon, Some(true)) && try_daemon_build(&command).await? {
        return Ok(());
    }

    let mut config = get_config(command.config)?;

    set_project_flag(&mut config, &command.projects)?;

    if command.validate {
        config.artifact_writer = Box::<ArtifactValidationWriter>::default();
    }

    apply_default_cli_extensions(&mut config);

    config.file_source_config = if should_use_watchman(command.no_watchman) {
        FileSourceKind::Watchman
    } else {
        FileSourceKind::WalkDir
    };
    config.repersist_operations = command.repersist;

    if command.watch && !matches!(&config.file_source_config, FileSourceKind::Watchman) {
        return Err(Error::CompilerError {
            details: "Cannot run relay in watch mode if `watchman` is not available. Install watchman or remove the --watch flag.".to_string(),
        });
    }

    let compiler = Compiler::new(Arc::new(config), Arc::new(ConsoleLogger));

    if command.watch {
        compiler.watch().await.map_err(|err| Error::CompilerError {
            details: format!("{:?}", err),
        })?;
    } else {
        compiler
            .compile()
            .await
            .map_err(|err| Error::CompilerError {
                details: format!("{}", err),
            })?;
    }

    info!("Done.");
    Ok(())
}

struct ExtraDataProvider {
    locate_command: String,
}

impl ExtraDataProvider {
    pub fn new(locate_command: String) -> ExtraDataProvider {
        ExtraDataProvider { locate_command }
    }
}

impl LSPExtraDataProvider for ExtraDataProvider {
    fn fetch_query_stats(&self, _search_token: &str) -> Vec<String> {
        vec![]
    }

    fn resolve_field_definition(
        &self,
        project_name: String,
        parent_type: String,
        field_info: Option<FieldSchemaInfo>,
    ) -> Result<Option<FieldDefinitionSourceInfo>, String> {
        let entity_name = match field_info {
            Some(field_info) => format!("{}.{}", parent_type, field_info.name),
            None => parent_type,
        };
        let result = Command::new(&self.locate_command)
            .arg(project_name)
            .arg(entity_name)
            .output()
            .map_err(|e| format!("Failed to run locate command: {}", e))?;

        let result = String::from_utf8(result.stdout).expect("Failed to parse output");

        // Parse file_path:line_number:column_number
        let result_trimmed = result.trim();
        let result = result_trimmed.split(':').collect::<Vec<_>>();
        if result.len() != 3 {
            return Err(format!(
                "Result '{}' did not match expected format. Please return 'file_path:line_number:column_number'",
                result_trimmed
            ));
        }
        let file_path = result[0];
        let line_number = result[1].parse::<u64>().unwrap() - 1;
        let column_number = result[2].parse::<u64>().unwrap_or(1_u64) - 1;

        Ok(Some(FieldDefinitionSourceInfo {
            file_path: file_path.to_string(),
            line_number,
            column_number,
            is_local: true,
        }))
    }
}

async fn handle_lsp_command(command: LspCommand) -> Result<(), Error> {
    configure_logger(command.output, TerminalMode::Stderr);

    let config = get_config(command.config)?;

    let extra_data_provider: Box<dyn LSPExtraDataProvider + Send + Sync> =
        match command.locate_command {
            Some(locate_command) => Box::new(ExtraDataProvider::new(locate_command)),
            None => Box::new(DummyExtraDataProvider::new()),
        };

    let perf_logger = Arc::new(ConsoleLogger);
    let schema_documentation_loader: Option<Box<dyn SchemaDocumentationLoader<SDLSchema>>> = None;

    start_language_server(
        config,
        perf_logger,
        extra_data_provider,
        schema_documentation_loader,
    )
    .await
    .map_err(|err| Error::LSPError {
        details: format!("Relay LSP unexpectedly terminated: {:?}", err),
    })?;

    info!("Relay LSP exited successfully.");

    Ok(())
}

/// Check if `watchman` is available.
/// Returns `false` if `no_watchman_flag` is set (via `--noWatchman` CLI flag),
/// or if the `FORCE_NO_WATCHMAN` environment variable is set,
/// or if the `watchman` binary is not found on `$PATH`.
fn should_use_watchman(no_watchman_flag: bool) -> bool {
    if no_watchman_flag || env::var("FORCE_NO_WATCHMAN").is_ok() {
        return false;
    }
    Command::new("watchman")
        .args(["list-capabilities"])
        .output()
        .is_ok()
}

/// Compiler version string used by the daemon for client/server version checks.
#[cfg(unix)]
fn compiler_version() -> String {
    option_env!("CARGO_PKG_VERSION")
        .unwrap_or("unknown")
        .to_string()
}

#[cfg(unix)]
async fn handle_server_command(opt: ServerOpt) -> Result<(), Error> {
    configure_logger(OutputKind::Verbose, TerminalMode::Mixed);

    // Resolve the config path eagerly — the daemon's socket and log file
    // paths are derived from it, and `start` and other subcommands must
    // agree on the hash to talk to the same daemon.
    let config_path = match opt.config.clone() {
        Some(p) => p,
        None => Config::find_path(
            &current_dir().expect("Unable to get current working directory."),
        )
        .map_err(Error::ConfigError)?
        .ok_or_else(|| {
            Error::ConfigError(CompilerError::ConfigError {
                details: "No Relay config found from current directory. Pass --config to specify one explicitly.".to_string(),
            })
        })?,
    };

    match opt.command {
        ServerCommand::Start {
            foreground,
            initial_import_state,
            initial_changed_files_list,
        } => {
            if foreground {
                start_server_foreground(
                    &config_path,
                    &opt.project,
                    opt.config,
                    initial_import_state,
                    initial_changed_files_list,
                )
                .await
            } else {
                let extra_args = vec![
                    "--config".to_string(),
                    config_path.to_string_lossy().into_owned(),
                ];
                let start_extra_args = server_daemon::build_initial_external_state_args(
                    initial_import_state.as_deref(),
                    initial_changed_files_list.as_deref(),
                );
                server_daemon::start_daemon_process(
                    &config_path,
                    &opt.project,
                    &extra_args,
                    &start_extra_args,
                )
                .await;
                Ok(())
            }
        }
        ServerCommand::LogFilePath => {
            let log_path = server_daemon::get_log_file_path(&config_path, &opt.project);
            println!("{}", log_path.display());
            Ok(())
        }
        ServerCommand::List { cleanup, shutdown } => {
            if let Err(e) = server_daemon::list_daemons(cleanup, shutdown).await {
                error!("Failed to list daemons: {}", e);
                std::process::exit(1);
            }
            Ok(())
        }
        cmd @ (ServerCommand::Write | ServerCommand::Version | ServerCommand::Shutdown) => {
            let request = match cmd {
                ServerCommand::Write => DaemonRequest::Write {
                    flush_manifest_path: None,
                    flush_shard_dir: None,
                },
                ServerCommand::Version => DaemonRequest::Version,
                ServerCommand::Shutdown => DaemonRequest::Shutdown,
                _ => unreachable!(),
            };
            let socket_path = server_daemon::get_socket_path(&config_path, &opt.project);

            // For Write, check the daemon's version first and restart it on
            // mismatch so artifacts aren't written by a stale compiler.
            if matches!(&request, DaemonRequest::Write { .. })
                && let Some(response) =
                    server_daemon::send_request(&socket_path, DaemonRequest::Version).await
                && server_daemon::has_version_mismatch(&response, &compiler_version())
            {
                server_daemon::restart_daemon(
                    &socket_path,
                    &config_path,
                    &opt.project,
                    &daemon_subprocess_extra_args(&config_path),
                    &[],
                )
                .await;
            }

            info!("Sending {:?} to {}", request, socket_path.display());
            let response = server_daemon::send_request(&socket_path, request).await;
            log_daemon_response(response)
        }
    }
}

#[cfg(unix)]
async fn start_server_foreground(
    config_path: &Path,
    projects: &[String],
    user_config_arg: Option<PathBuf>,
    initial_import_state: Option<PathBuf>,
    initial_changed_files_list: Option<PathBuf>,
) -> Result<(), Error> {
    info!("Starting Relay compiler in server mode...");

    let mut config = get_config(user_config_arg)?;
    set_project_flag(&mut config, &projects.to_vec())?;
    apply_default_cli_extensions(&mut config);
    server_daemon::apply_initial_external_state_hints(
        &mut config,
        initial_import_state,
        initial_changed_files_list,
    );

    // Wrap the existing status reporter so daemon clients can observe build
    // lifecycle and so handle_write can wait_for_idle.
    let base_reporter =
        std::mem::replace(&mut config.status_reporter, Box::new(NoopStatusReporter));
    let mut build_status = BuildStatus::new(
        base_reporter,
        config.root_dir.clone(),
        config.is_multi_project,
    );
    let log_path = server_daemon::get_log_file_path(config_path, projects);
    build_status.set_log_path(log_path);
    let build_status = Arc::new(build_status);
    config.daemon_build_status = Some(Arc::clone(&build_status));
    config.status_reporter = Box::new(Arc::clone(&build_status));

    // Swap the real artifact writer for the deferred one. The cache holds the
    // original writer; flush_to_disk runs the original writer's writes.
    let original_artifact_writer =
        std::mem::replace(&mut config.artifact_writer, Box::new(NoopArtifactWriter));
    let artifact_cache = Arc::new(DeferredArtifactCache::new(original_artifact_writer));
    config.artifact_writer = Box::new(DeferredArtifactWriter::new(Arc::clone(&artifact_cache)));

    let socket_path = server_daemon::get_socket_path(config_path, projects);
    info!("Starting server on {}", socket_path.display());

    let perf_logger = Arc::new(ConsoleLogger);
    server_daemon::start_server(DaemonServerConfig {
        socket_path,
        config_path: config_path.to_path_buf(),
        projects: projects.to_vec(),
        compiler_config: config,
        perf_logger,
        artifact_cache,
        build_status,
        compiler_version: compiler_version(),
        flush_writer_factory: None,
    })
    .await
    .map_err(|e| Error::CompilerError {
        details: format!("Daemon server error: {e}"),
    })
}

/// Compute the OSS-CLI extra args (passes `--config <path>` so the spawned
/// foreground daemon subprocess re-resolves to the same config file).
#[cfg(unix)]
fn daemon_subprocess_extra_args(config_path: &Path) -> Vec<String> {
    vec![
        "--config".to_string(),
        config_path.to_string_lossy().into_owned(),
    ]
}

/// Log a daemon response and return `Err` if it indicates failure.
/// Individual error messages are surfaced via `error!` before returning so
/// the caller can `?`-propagate to `main`, which prints the wrapper error
/// and exits non-zero — no `process::exit(1)` here, so any tokio cleanup
/// or trailing telemetry the caller wants to run still gets a chance.
#[cfg(unix)]
fn log_daemon_response(response: Option<DaemonResponse>) -> Result<(), Error> {
    if server_daemon::log_daemon_response(response) {
        Ok(())
    } else {
        Err(Error::DaemonCommandFailed)
    }
}

/// Attempt a daemon-driven build for `--daemon=true`. Returns:
///   - `Ok(true)`  — daemon flushed the build (caller should return).
///   - `Ok(false)` — caller should fall through to the in-process build path
///     (currently: rebase / merge / cherry-pick in progress, where the
///     daemon's cached artifacts would be derived from pre-merge state).
///   - `Err(_)`    — failed to locate the Relay config.
///
/// Exits the process via `log_daemon_response` if the daemon reports an
/// error (matching the OSS CLI's behavior for `server write` failures).
#[cfg(unix)]
async fn try_daemon_build(command: &CompileCommand) -> Result<bool, Error> {
    let config_path = match command.config.clone() {
        Some(p) => p,
        None => Config::find_path(
            &current_dir().expect("Unable to get current working directory."),
        )
        .map_err(Error::ConfigError)?
        .ok_or_else(|| {
            Error::ConfigError(CompilerError::ConfigError {
                details: "No Relay config found from current directory. Pass --config to specify one explicitly.".to_string(),
            })
        })?,
    };

    let in_transient_vcs_state = config_path
        .parent()
        .and_then(server_daemon::vcs_state::find_repo_root)
        .as_deref()
        .map(server_daemon::vcs_state::is_in_rebase_or_merge_state)
        .unwrap_or(false);
    if in_transient_vcs_state {
        info!("Rebase/merge in progress, running in-process build instead of using daemon");
        return Ok(false);
    }

    let extra_args = daemon_subprocess_extra_args(&config_path);
    let (socket_path, _outcome) = server_daemon::ensure_daemon_running(
        &config_path,
        &command.projects,
        &compiler_version(),
        &extra_args,
        &[],
    )
    .await;
    info!("Sending Write to {}", socket_path.display());
    let response = server_daemon::send_request(
        &socket_path,
        DaemonRequest::Write {
            flush_manifest_path: None,
            flush_shard_dir: None,
        },
    )
    .await;
    log_daemon_response(response)?;
    Ok(true)
}
