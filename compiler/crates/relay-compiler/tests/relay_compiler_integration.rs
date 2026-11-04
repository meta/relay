/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Cargo resolves modules declared in an integration test root relative to
// `tests/`, so point it at the file's actual location next to the fixtures.
#[path = "relay_compiler_integration/mock_persister.rs"]
mod mock_persister;
#[path = "relay_compiler_integration/rsc_contract_tests.rs"]
mod rsc_contract_tests;

use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;

use common::ConsoleLogger;
use fixture_tests::Fixture;
use futures_util::FutureExt;
use graphql_test_helpers::FileChange;
use graphql_test_helpers::ProjectFixture;
use graphql_test_helpers::TestDir;
use relay_compiler::File;
use relay_compiler::FileSourceKind;
use relay_compiler::FileSourceResult;
use relay_compiler::LocalPersister;
use relay_compiler::OperationPersister;
use relay_compiler::ProcessPersister;
use relay_compiler::RemotePersister;
use relay_compiler::WalkDirFileSourceResult;
use relay_compiler::build_project::generate_extra_artifacts::default_generate_extra_artifacts_fn;
use relay_compiler::compiler::Compiler;
use relay_compiler::config::Config;
use relay_compiler::errors::Error;
use relay_compiler::print_compiler_error;
use relay_config::PersistConfig;

pub async fn transform_fixture(fixture: &Fixture<'_>) -> Result<String, String> {
    let project_fixture = ProjectFixture::deserialize(fixture.content);
    let has_extra_artifacts = !fixture.content.contains("%without_extra_artifacts%");

    if project_fixture.file_changes().is_empty() {
        return transform_project_fixture_with_extra_artifacts(
            &project_fixture,
            has_extra_artifacts,
        )
        .await;
    }

    let incremental_result =
        transform_project_fixture_with_extra_artifacts(&project_fixture, has_extra_artifacts).await;
    let full_result = transform_project_fixture_with_extra_artifacts(
        &project_fixture.with_file_changes_applied(),
        has_extra_artifacts,
    )
    .await;

    if incremental_result == full_result {
        return incremental_result;
    }

    let incremental_string = match incremental_result {
        Ok(incremental_result) => incremental_result,
        Err(incremental_error) => incremental_error,
    };
    let full_string = match full_result {
        Ok(full_result) => full_result,
        Err(full_error) => full_error,
    };

    Err(format!(
        "INCREMENTAL COMPILATION BUG DETECTED!\n\nIncremental and full results differ!\n\nIncremental:\n{}\n\nFull:\n{}\n",
        incremental_string, full_string
    ))
}

/// Given a file system state run the compiler and return the compiler output.
///
/// If there are file changes in the ProjectFixture, an initial build will be
/// done followed by an incremental build with the file changes applied.
pub async fn transform_project_fixture(project_fixture: &ProjectFixture) -> Result<String, String> {
    transform_project_fixture_with_extra_artifacts(project_fixture, true).await
}

/// The cwd is process-global but tests run in parallel. Without this, one test
/// can record another's temp dir as its "original" cwd and fail to restore it
/// once that dir has been deleted.
static CWD_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn transform_project_fixture_with_extra_artifacts(
    project_fixture: &ProjectFixture,
    has_extra_artifacts: bool,
) -> Result<String, String> {
    let has_file_changes = !project_fixture.file_changes().is_empty();

    let test_dir = TestDir::new();

    project_fixture.write_to_dir(test_dir.path());

    let _cwd_guard = CWD_LOCK.lock().await;
    let original_cwd = std::env::current_dir().expect("Could not get cwd");

    std::env::set_current_dir(test_dir.path()).expect("Could not set cwd");

    let run_future = async {
        let config = match Config::search(&PathBuf::from(test_dir.path())) {
            Ok(config) => config,
            Err(config_error) => {
                return format_compiler_error(test_dir.path(), config_error);
            }
        };

        let (config, captured_requests) = configure_test_config(config, has_extra_artifacts);
        let config = Arc::new(config);

        let compiler = Compiler::new(Arc::clone(&config), Arc::new(ConsoleLogger));
        let compiler_result = compiler.compile().await;

        match compiler_result {
            Ok(mut state) => {
                // If there are file changes, apply them and do an incremental rebuild
                if has_file_changes {
                    // Write file changes to disk
                    project_fixture.flush_file_changes_to_dir(test_dir.path());

                    // Build the list of changed files for the compiler
                    let changed_files: Vec<File> = project_fixture
                        .file_changes()
                        .iter()
                        .map(|(path, change)| File {
                            name: path.clone(),
                            exists: match change {
                                FileChange::Change(_) => true,
                                FileChange::Delete => false,
                            },
                        })
                        .collect();

                    // Push file changes to compiler state
                    state.pending_file_source_changes.write().unwrap().push(
                        FileSourceResult::WalkDir(WalkDirFileSourceResult {
                            files: changed_files,
                            resolved_root: config.root_dir.clone(),
                        }),
                    );

                    // Do incremental build
                    let incremental_result = compiler.build_with_changed_files(&mut state).await;

                    match incremental_result {
                        Ok(()) => {
                            // Persist requests are omitted for incremental fixtures: the
                            // initial full-build requests and the final full-build requests
                            // (from the comparison path) would differ whenever operations
                            // change, producing false "incremental bug" reports.
                            format_successful_output(test_dir.path(), project_fixture, &state, &[])
                        }
                        Err(compiler_error) => {
                            format_compiler_error(test_dir.path(), compiler_error)
                        }
                    }
                } else {
                    let requests = captured_requests.lock().unwrap();
                    format_successful_output(test_dir.path(), project_fixture, &state, &requests)
                }
            }
            Err(compiler_error) => {
                let error_string = format_compiler_error(test_dir.path(), compiler_error);
                if has_file_changes {
                    panic!(
                        "Invalid incremental test fixutre. Test fixtures with file changes must compile successfully in the initial build. Errored with:\n\n{}",
                        error_string
                    );
                }
                error_string
            }
        }
    };

    let result = match std::panic::AssertUnwindSafe(run_future)
        .catch_unwind()
        .await
    {
        Err(panic_err) => {
            std::env::set_current_dir(original_cwd)
                .expect("Could set cwd (while handling panic from test)");
            std::panic::resume_unwind(panic_err)
        }
        Ok(ok) => Ok(ok),
    };

    std::env::set_current_dir(original_cwd).expect("Could set cwd");

    result
}

fn configure_test_config(
    mut config: Config,
    has_extra_artifacts: bool,
) -> (
    Config,
    Arc<Mutex<Vec<mock_persister::CapturedPersistRequest>>>,
) {
    let captured: Arc<Mutex<Vec<mock_persister::CapturedPersistRequest>>> =
        Arc::new(Mutex::new(Vec::new()));
    let captured_for_closure = Arc::clone(&captured);

    config.file_source_config = FileSourceKind::WalkDir;
    config.has_schema_change_incremental_build = true;
    config.create_operation_persister = Some(Box::new(move |project_config| {
        project_config.persist.as_ref().map(
            |persist_config| -> Box<dyn OperationPersister + Send + Sync> {
                match persist_config {
                    PersistConfig::Process(process_config) => {
                        Box::new(ProcessPersister::new(process_config.clone()))
                    }
                    PersistConfig::Remote(remote_config)
                        if remote_config
                            .url
                            .starts_with(mock_persister::TEST_PERSIST_URL_PREFIX) =>
                    {
                        Box::new(mock_persister::MockPersister::new(
                            remote_config.clone(),
                            Arc::clone(&captured_for_closure),
                        ))
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
    if has_extra_artifacts {
        config.generate_extra_artifacts = Some(Box::new(default_generate_extra_artifacts_fn));
    }
    (config, captured)
}

fn format_successful_output(
    test_dir: &Path,
    project_fixture: &ProjectFixture,
    state: &relay_compiler::compiler_state::CompilerState,
    persist_requests: &[mock_persister::CapturedPersistRequest],
) -> String {
    // Get the effective input state (initial files with any file changes applied)
    let effective_input = project_fixture.with_file_changes_applied();

    // Diff the directory against the effective input to find what the compiler
    // added, modified, or deleted.
    let diff = effective_input.with_changes_from_dir(test_dir);

    let mut expected = diff
        .serialize_changes()
        .replace(&format!("{}generated", '@'), "<auto-generated>");

    expected.push_str(&mock_persister::serialize_captured_requests(
        persist_requests,
    ));
    expected.push_str(&format!("\n\nArtifact Map:\n{:?}", state.artifacts));
    expected
}

fn format_compiler_error(root_dir: &Path, error: Error) -> String {
    let output = print_compiler_error(root_dir, error);
    // Replace the test directory path with a placeholder for deterministic test output
    // On Windows, paths use backslashes, so we first replace the root directory,
    // then normalize all remaining backslashes to forward slashes for consistent output
    let output = output.replace(root_dir.to_str().unwrap(), "<TEST_DIR>");
    // Normalize path separators for cross-platform consistency
    output.replace('\\', "/")
}
