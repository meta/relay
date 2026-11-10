/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! The compiler module compiles Relay source code into efficient and optimized runtime artifacts.
//!
//! The main entrypoint function for this module is `compile`. It performs several steps including:
//! * Parsing GraphQL sources into an abstract syntax tree (AST)
//! * Validating the AST against the GraphQL specification
//! * Applying transformations to the AST
//! * Generating output files based on the transformed AST
use std::collections::HashSet;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering::SeqCst;

use common::Diagnostic;
use common::PerfLogEvent;
use common::PerfLogger;
use common::WithDiagnostics;
use docblock_shared::ResolverSourceHash;
use futures::future::join_all;
use graphql_watchman::WatchmanFileSourceSubscriptionNextChange;
use log::debug;
use log::info;
use rayon::prelude::*;
use tokio::sync::Notify;
use tokio::task;
use tokio::task::JoinHandle;

use crate::FileSourceResult;
use crate::artifact_map::ArtifactSourceKey;
use crate::build_project::BuildProjectFailure;
use crate::build_project::build_project;
use crate::build_project::commit_project;
use crate::build_project::get_artifacts_file_hash_map::spawn_artifact_hash_map_prefetch;
use crate::compiler_state::ArtifactMapKind;
use crate::compiler_state::CompilerState;
use crate::compiler_state::DocblockSources;
use crate::compiler_state::FullSources;
use crate::config::Config;
use crate::errors::Error;
use crate::errors::Result;
use crate::file_source::FileSource;
use crate::file_source::FileSourceSubscriptionNextChange;
use crate::file_source::LocatedDocblockSource;
use crate::graphql_asts::GraphQLAsts;
use crate::red_to_green::RedToGreen;

/// Output of the per-iteration watch-mode setup block in [`Compiler::watch`]:
/// the freshly built compiler state, the notify receiver the build loop awaits
/// on, the spawned Watchman subscription task handle, and the cross-task flag
/// the build loop sets to request a Leave-arm re-wake after a deferred restart.
type WatchSetupOutput = (CompilerState, Arc<Notify>, JoinHandle<()>, Arc<AtomicBool>);

pub struct Compiler<TPerfLogger>
where
    TPerfLogger: PerfLogger + 'static,
{
    config: Arc<Config>,
    perf_logger: Arc<TPerfLogger>,
}

impl<TPerfLogger: PerfLogger> Compiler<TPerfLogger> {
    pub fn new(config: Arc<Config>, perf_logger: Arc<TPerfLogger>) -> Self {
        Self {
            config,
            perf_logger,
        }
    }

    pub async fn compile(&self) -> Result<CompilerState> {
        let setup_event = self.perf_logger.create_event("compiler_setup");
        self.config.status_reporter.build_starts();
        let result: Result<(CompilerState, Vec<Diagnostic>)> = async {
            if let Some(initialize_resources) = &self.config.initialize_resources {
                let timer = setup_event.start("load_resources");
                initialize_resources();
                setup_event.stop(timer);
            }
            let load_compiler_state_timer = setup_event.start("load_compiler_state_time");
            let file_source = FileSource::connect(&self.config, &setup_event).await?;
            let mut compiler_state = file_source
                .query(&setup_event, self.perf_logger.as_ref())
                .await?;
            setup_event.stop(load_compiler_state_timer);

            let diagnostics = self
                .build_projects(&mut compiler_state, &setup_event)
                .await?;

            Ok((compiler_state, diagnostics))
        }
        .await;
        setup_event.complete();

        match result {
            Ok((compiler_state, non_fatal_diagnostics)) => {
                self.config
                    .status_reporter
                    .build_completes(&non_fatal_diagnostics);
                Ok(compiler_state)
            }
            Err(error) => {
                self.config.status_reporter.build_errors(&error);
                Err(error)
            }
        }
    }

    /// Exposed for testing.
    ///
    /// Perform an incremental build using an existing compiler state.
    ///
    /// This method is useful for testing incremental compilation. The caller should:
    /// 1. Push file source changes to `compiler_state.pending_file_source_changes`
    /// 2. Call this method to merge changes and rebuild
    pub async fn build_with_changed_files(&self, compiler_state: &mut CompilerState) -> Result<()> {
        let setup_event = self.perf_logger.create_event("incremental_build");
        self.config.status_reporter.build_starts();

        let result: Result<Vec<Diagnostic>> = async {
            let had_new_changes = compiler_state.merge_file_source_changes(
                &self.config,
                self.perf_logger.as_ref(),
                false,
            )?;

            if had_new_changes {
                let diagnostics = self.build_projects(compiler_state, &setup_event).await?;
                Ok(diagnostics)
            } else {
                Ok(vec![])
            }
        }
        .await;
        setup_event.complete();

        match result {
            Ok(non_fatal_diagnostics) => {
                self.config
                    .status_reporter
                    .build_completes(&non_fatal_diagnostics);
                Ok(())
            }
            Err(error) => {
                self.config.status_reporter.build_errors(&error);
                Err(error)
            }
        }
    }

    /// Run the compiler in watch mode, looping until either a setup
    /// error occurs (`Err`) or — in daemon mode only — the on-disk Relay
    /// binary or config file has drifted from what this daemon was
    /// started with and a clean restart is required (`Ok(())`).
    ///
    /// Non-daemon callers (`fb-relay-compiler` Watch, `relay-bin`) can
    /// treat `Ok(())` as unreachable: the restart-on-drift check is
    /// gated on `Config::daemon_build_status.is_some()`, so the loop
    /// never exits cleanly outside daemon mode.
    ///
    /// In daemon mode, when this returns `Ok(())`, the surrounding
    /// `server_daemon::start_server` task observes the completion, takes
    /// the restart reason via [`BuildStatus::take_restart_reason`],
    /// unblocks any in-flight clients via [`BuildStatus::daemon_restarting`]
    /// (so they receive an info-severity "daemon restarting, retry"
    /// message rather than a crash error), and exits cleanly. The next
    /// client invocation respawns a fresh daemon via
    /// `ensure_daemon_running` against the current `current_exe()`.
    pub async fn watch(&self) -> Result<()> {
        'watch: loop {
            // Clear any stale cached artifact operations from a previous watch
            // loop iteration. After a source control update (rebase), the old
            // cached operations are derived from the pre-rebase compiler state
            // and may reference artifacts for files that no longer exist.
            self.config.artifact_writer.reset();

            let setup_event = self.perf_logger.create_event("compiler_setup");
            let initial_watch_compile_timer = setup_event.start("initial_watch_compile");
            self.config.status_reporter.build_starts();

            if let Some(build_status) = &self.config.daemon_build_status {
                build_status.changes_pending();
            }

            let result: Result<WatchSetupOutput> = async {
                // In daemon mode, skip `initialize_resources` (e.g. dumping
                // GraphQL schemas via `phps GraphQLDumpSchemas`). The client is
                // responsible for re-dumping schemas before each operation, and
                // re-dumping here causes a feedback loop: the dump rewrites
                // many files, Watchman returns a fresh-instance result on the
                // next subscription, that triggers a reset, and the outer loop
                // re-dumps again. The initial schema load happens once at
                // server startup before `Compiler::watch()` is entered.
                if self.config.daemon_build_status.is_none()
                    && let Some(initialize_resources) = &self.config.initialize_resources
                {
                    let timer = setup_event.start("load_resources");
                    initialize_resources();
                    setup_event.stop(timer);
                }
                let file_source = FileSource::connect(&self.config, &setup_event).await?;

                let (compiler_state, mut subscription) = file_source
                    .subscribe(&setup_event, self.perf_logger.as_ref())
                    .await?;

                let pending_file_source_changes =
                    compiler_state.pending_file_source_changes.clone();
                let source_control_update_status =
                    Arc::clone(&compiler_state.source_control_update_status);

                let notify_sender = Arc::new(Notify::new());
                let notify_receiver = notify_sender.clone();
                // Cross-task flag: set by the build loop's post-await
                // guard when it drops a restart due to `is_started`, read
                // (and cleared) by the subscription task's Leave arms.
                // Only Leaves that follow a deferred restart wake the
                // loop — clean rebases (the common case) stay silent so
                // `wait_for_idle()` callers aren't briefly blocked on
                // every `hg up .` / no-op `hg pull --rebase`.
                let restart_recheck_pending = Arc::new(AtomicBool::new(false));
                let restart_recheck_pending_for_subscription =
                    Arc::clone(&restart_recheck_pending);
                let is_daemon = self.config.daemon_build_status.is_some();

                // In daemon mode, initialize the synchronized Watchman state so
                // that both the build loop and write handler query Watchman
                // through the same serialized path.
                if let Some(build_status) = &self.config.daemon_build_status {
                    build_status
                        .init_watchman_sync(
                            compiler_state.clock.clone(),
                            compiler_state.pending_file_source_changes.clone(),
                            notify_sender.clone(),
                        )
                        .await;
                }

                // First, set up watchman subscription
                let subscription_handle = task::spawn(async move {
                    loop {
                        let next_change = subscription.next_change().await;
                        match next_change {
                            Ok(FileSourceSubscriptionNextChange::Watchman(watchman_next_change)) => {
                                match *watchman_next_change {
                                    WatchmanFileSourceSubscriptionNextChange::Result(file_source_changes) => {
                                        if is_daemon {
                                            // Daemon mode: the subscription is just a signal.
                                            // Don't read the clock or file changes from it —
                                            // sync_file_changes() will query Watchman directly.
                                            notify_sender.notify_one();
                                        } else {
                                            pending_file_source_changes
                                                .write()
                                                .unwrap()
                                                .push(FileSourceResult::Watchman(Box::new(file_source_changes)));
                                            notify_sender.notify_one();
                                        }
                                    }
                                    WatchmanFileSourceSubscriptionNextChange::SourceControlUpdateEnter => {
                                        info!("hg.update started...");
                                        source_control_update_status.mark_as_started();
                                    }
                                    WatchmanFileSourceSubscriptionNextChange::SourceControlUpdateLeave => {
                                        info!("hg.update completed.");
                                        source_control_update_status.set_to_default();
                                        // Only wake the build loop if a prior
                                        // iteration's post-await guard deferred a
                                        // restart due to `is_started` — otherwise
                                        // there's nothing to recheck and the wake
                                        // would briefly flip `is_building=true`
                                        // (blocking any concurrent `wait_for_idle`
                                        // caller) on every clean rebase event.
                                        if restart_recheck_pending_for_subscription
                                            .swap(false, SeqCst)
                                        {
                                            notify_sender.notify_one();
                                        }
                                    }
                                    WatchmanFileSourceSubscriptionNextChange::SourceControlUpdate => {
                                        info!("hg.update completed. Detected new base revision...");
                                        source_control_update_status.mark_as_completed();
                                        notify_sender.notify_one();
                                        break;
                                    }
                                    WatchmanFileSourceSubscriptionNextChange::None => {}
                                }
                            }
                            Ok(FileSourceSubscriptionNextChange::Test(file_source_changes)) => {
                                pending_file_source_changes
                                    .write()
                                    .unwrap()
                                    .push(FileSourceResult::WalkDir(file_source_changes));
                                notify_sender.notify_one();
                            }
                            Ok(FileSourceSubscriptionNextChange::TestSourceControlUpdateEnter) => {
                                info!("Test: source control update started...");
                                source_control_update_status.mark_as_started();
                            }
                            Ok(FileSourceSubscriptionNextChange::TestSourceControlUpdateLeave) => {
                                info!("Test: source control update completed.");
                                source_control_update_status.set_to_default();
                                if restart_recheck_pending_for_subscription.swap(false, SeqCst) {
                                    notify_sender.notify_one();
                                }
                            }
                            Ok(FileSourceSubscriptionNextChange::TestSourceControlUpdate) => {
                                info!("Test: source control update with new base revision...");
                                source_control_update_status.mark_as_completed();
                                notify_sender.notify_one();
                                break;
                            }
                            Err(err) => {
                                panic!("Watchman subscription error: {err}");
                            }
                        }
                    }
                });

                Ok((compiler_state, notify_receiver, subscription_handle, restart_recheck_pending))

            }
            .await;

            match result {
                Ok((
                    mut compiler_state,
                    notify_receiver,
                    subscription_handle,
                    restart_recheck_pending,
                )) => {
                    let mut red_to_green = RedToGreen::new();
                    match self.build_projects(&mut compiler_state, &setup_event).await {
                        Ok(diagnostics) => {
                            self.config.status_reporter.build_completes(&diagnostics);
                        }
                        Err(err) => {
                            red_to_green.log_error();
                            self.config.status_reporter.build_errors(&err);
                        }
                    };
                    setup_event.stop(initial_watch_compile_timer);
                    setup_event.complete();
                    info!("Watching for new changes...");

                    if let Some(reason) = self
                        .incremental_build_loop(
                            compiler_state,
                            notify_receiver,
                            &subscription_handle,
                            restart_recheck_pending,
                        )
                        .await
                    {
                        info!(
                            "Relay daemon exiting so a fresh process picks up the current binary/config: {reason:?}"
                        );
                        // Side-channel signal to `server_daemon::start_server`
                        // so its `compiler_handle` select arm can distinguish
                        // this intentional restart from an unexpected crash
                        // (`take_restart_reason` returns `Some` here, so the
                        // arm logs `info!` instead of `error!` and avoids
                        // misattributing the restart in client telemetry).
                        // The watch loop returns `Ok(())`; the surrounding
                        // server task observes the completion and breaks the
                        // accept loop. The next client invocation respawns
                        // the daemon through `ensure_daemon_running` with the
                        // now-current `current_exe()`.
                        if let Some(build_status) = &self.config.daemon_build_status {
                            build_status.restart_initiated(format!("{reason:?}"));
                        }
                        break 'watch Ok(());
                    }
                }
                Err(err) => {
                    self.config.status_reporter.build_errors(&err);
                    break 'watch Err(err);
                }
            }
        }
    }

    /// Returns `Some(reason)` if the daemon should shut down so a fresh
    /// process can reload the on-disk binary/config; `None` otherwise (the
    /// caller — `watch()` — will then re-enter the outer initialization
    /// loop as usual).
    async fn incremental_build_loop(
        &self,
        mut compiler_state: CompilerState,
        notify_receiver: Arc<Notify>,
        subscription_handle: &JoinHandle<()>,
        restart_recheck_pending: Arc<AtomicBool>,
    ) -> Option<crate::config::RestartReason> {
        let mut red_to_green = RedToGreen::new();

        loop {
            notify_receiver.notified().await;

            // Clear any deferred-restart wake-request from a prior iteration.
            // Without this, a deferred restart that gets woken by a non-Leave
            // notify and then recovers without re-firing (signal=None on the
            // next check — e.g. config bytes reverted, or mtime/size pre-filter
            // matches again) would leave the flag set on this Arc for the rest
            // of the build-loop lifetime. Every subsequent Leave would then
            // fire a spurious notify and briefly flip `is_building=true` for
            // any `wait_for_idle()` caller — exactly the latency cost the
            // narrower-Leave-notify design was supposed to avoid. Clearing
            // here is safe: if Leave woke us, swap already cleared it; if the
            // wake was from a file change, we want a fresh per-iteration arm.
            restart_recheck_pending.store(false, SeqCst);

            // Signal that changes have been detected and processing may occur.
            // This must happen before any checks/debouncing so that clients
            // calling wait_for_idle() are blocked during the entire period.
            if let Some(build_status) = &self.config.daemon_build_status {
                build_status.changes_pending();

                // If a reset was requested (e.g. Watchman returned a fresh
                // instance or the sync query errored), abort the subscription
                // and return so the outer watch() loop reinitializes from
                // saved state — falling back to a full build if unavailable.
                // is_building stays true via changes_pending() above so
                // wait_for_idle() blocks through the entire reset cycle.
                if build_status.take_reset_requested() {
                    info!("Reset requested: reinitializing compiler state from saved state...");
                    subscription_handle.abort();
                    return None;
                }
            }

            if compiler_state.source_control_update_status.is_started() {
                // Clear pending changes since we're skipping this notification
                if let Some(build_status) = &self.config.daemon_build_status {
                    build_status.no_pending_changes();
                }
                continue;
            }

            if compiler_state.source_control_update_status.is_completed() {
                subscription_handle.abort();
                return None;
            }

            // Daemon mode only: if the on-disk Relay binary or config file
            // has drifted from what this daemon was started with, signal
            // the outer `watch()` to exit so a fresh process can pick up
            // the current binary/config. The in-memory compiler state —
            // including `Config::saved_state_version` — is bound to the
            // startup-time binary+config and would otherwise produce a
            // "Saved state version mismatch" against a freshly-warmed
            // cache. See `DaemonRestartSignals` for motivation.
            //
            // Placement matters: this runs AFTER the source-control
            // update guards above so a mid-rebase config edit (e.g.
            // `hg goto` across a commit that touches the config file)
            // goes through the existing reset path rather than racing
            // with our (mtime, size) pre-filter while the working copy
            // is in a transient state.
            //
            // `check_restart_if_daemon` is awaited (uses `tokio::fs`) and
            // uses an mtime+size pre-filter so the steady-state cost is
            // ~one `stat` per file — see knowledge entry
            // `flag-performance-impact-of-file-io-in-the-compiler-hot-path-*`.
            // Note: `tokio::fs::metadata` dispatches to `spawn_blocking`,
            // so the userspace cost is stat-syscall + thread-pool round
            // trip. The wrapping perf event captures this for observability
            // per `new-daemon-code-paths-that-are-called-in-performance-sensitive-loops-should`.
            let restart_signal = self.config.check_restart_if_daemon().await;
            // Only log the perf event when the check actually fires — the
            // production `PerfpipeLogger` allocates a per-event DashMap +
            // HashMap clone + scribe write inside `complete()`, which would
            // dominate the steady-state cost (target: ~2 stat syscalls per
            // notify; an unconditional event is dozens of allocations + a
            // scribe write per notify). Restart events are rare (once per
            // daemon lifetime) so logging on the trigger path only is the
            // right tradeoff — we lose steady-state timing visibility but
            // keep visibility on what matters.
            if restart_signal.is_some() {
                let check_event = self.perf_logger.create_event("check_restart_signals");
                check_event.bool("triggered", true);
                check_event.complete();
            }
            if let Some(reason) = restart_signal {
                // Re-check the source-control guards: `check_restart_if_daemon`
                // dispatches `tokio::fs::metadata` through `spawn_blocking`, so
                // the subscription task can interleave during the await and flip
                // `is_started()` to true on a fresh `state-enter("hg.update")`.
                // If that happened, the bytes we just read may be mid-rebase
                // transient state — drop the restart and let the next iteration's
                // top-of-loop guards handle the source-control update.
                //
                // Pre-arm the Leave-arm wake-up signal BEFORE checking
                // `is_started()` to close a thread-preemption race: without this
                // ordering, a `state-leave` landing between the `is_started()`
                // read and the `.store()` would see the flag still false, skip
                // the notify, and leave the daemon parked on
                // `notify_receiver.notified()` with a known-stale snapshot. If
                // `is_started()` turns out to be false (we end up firing the
                // restart instead of deferring), the flag staying set is
                // harmless — either `watch()` exits (the `AtomicBool` is GC'd
                // along with its `Arc`s) or the outer loop reinits and a fresh
                // `AtomicBool` is created.
                restart_recheck_pending.store(true, SeqCst);
                if compiler_state.source_control_update_status.is_started() {
                    info!(
                        "Restart signal dropped: source-control update started during \
                         check; will re-check after rebase settles: {reason:?}"
                    );
                    if let Some(build_status) = &self.config.daemon_build_status {
                        build_status.no_pending_changes();
                    }
                    continue;
                }
                if compiler_state.source_control_update_status.is_completed() {
                    info!(
                        "Restart signal deferred: source-control update completed during \
                         check; will re-check after compiler reinit: {reason:?}"
                    );
                    subscription_handle.abort();
                    return None;
                }
                subscription_handle.abort();
                return Some(reason);
            }

            // Single change to file sometimes produces 2 watchman change events for the same file
            // wait for 50ms in case there is a subsequent request
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;

            // In daemon mode, query Watchman directly for changes since the
            // last clock. This is the single authoritative sync path — the
            // subscription only signals us to check, it doesn't carry the
            // changes or the clock.
            if let Some(build_status) = &self.config.daemon_build_status {
                build_status.sync_file_changes(&self.config).await;
            }

            if compiler_state.has_pending_file_source_changes() {
                let incremental_build_event =
                    self.perf_logger.create_event("incremental_build_event");
                incremental_build_event
                    .bool("is_daemon_build", self.config.daemon_build_status.is_some());
                let incremental_build_time =
                    incremental_build_event.start("incremental_build_time");

                // When running as a daemon, collect changes to generated
                // artifacts so that external modifications trigger
                // recompilation of the affected source definitions.
                let should_collect_changed_artifacts = self.config.daemon_build_status.is_some();
                let had_new_changes = match compiler_state.merge_file_source_changes(
                    &self.config,
                    self.perf_logger.as_ref(),
                    should_collect_changed_artifacts,
                ) {
                    Ok(b) => b,
                    Err(err) => {
                        let error_event = self.perf_logger.create_event("watch_build_error");
                        error_event.string("error", format!("Ignored Compilation Error: {err}"));
                        error_event.complete();
                        return None;
                    }
                };

                // Also rebuild when generated artifacts changed on disk,
                // even if no source files changed.
                let had_new_changes =
                    had_new_changes || !compiler_state.dirty_artifact_paths.is_empty();

                if had_new_changes {
                    self.config.status_reporter.build_starts();
                    info!("Change detected, start compiling...");

                    match self
                        .build_projects(&mut compiler_state, &incremental_build_event)
                        .await
                    {
                        Ok(diagnostics) => {
                            self.config.status_reporter.build_completes(&diagnostics);
                            red_to_green.clear_error_and_log(self.perf_logger.as_ref());
                        }
                        Err(err) => {
                            red_to_green.log_error();
                            self.config.status_reporter.build_errors(&err);
                        }
                    }

                    incremental_build_event.stop(incremental_build_time);
                    info!("Watching for new changes...");
                } else {
                    debug!("No new changes detected.");
                    // Clear the pending changes flag since there were no actual changes
                    if let Some(build_status) = &self.config.daemon_build_status {
                        build_status.no_pending_changes();
                    }
                    incremental_build_event.stop(incremental_build_time);
                }
                incremental_build_event.complete();
            } else {
                // The notification resolved (possibly from a stored Notify
                // permit) but all pending changes were already consumed by a
                // prior iteration. Clear is_building so clients aren't blocked
                // indefinitely in wait_for_idle().
                if let Some(build_status) = &self.config.daemon_build_status {
                    build_status.no_pending_changes();
                }
            }
        }
    }

    async fn build_projects(
        &self,
        compiler_state: &mut CompilerState,
        setup_event: &impl PerfLogEvent,
    ) -> Result<Vec<Diagnostic>> {
        let build_projects_time = setup_event.start("build_projects_time");
        let result = build_projects(
            Arc::clone(&self.config),
            Arc::clone(&self.perf_logger),
            setup_event,
            compiler_state,
        )
        .await;
        setup_event.stop(build_projects_time);
        setup_event.time("post_build_projects_time", || {
            result.and_then(|diagnostics| {
                compiler_state.complete_compilation(self.config.projects.values(), |name| {
                    self.config.projects[&name].enabled
                });
                self.config.artifact_writer.finalize()?;
                if let Some(post_artifacts_write) = &self.config.post_artifacts_write {
                    post_artifacts_write(&self.config)
                        .map_err(|error| Error::PostArtifactsError { error })?;
                }

                Ok(diagnostics)
            })
        })
    }
}

async fn build_projects<TPerfLogger: PerfLogger + 'static>(
    config: Arc<Config>,
    perf_logger: Arc<TPerfLogger>,
    setup_event: &impl PerfLogEvent,
    compiler_state: &mut CompilerState,
) -> Result<Vec<Diagnostic>> {
    let dirty_artifact_sources = compiler_state.get_dirty_artifact_sources(&config);
    let mut graphql_asts = setup_event.time("parse_sources_time", || {
        GraphQLAsts::from_graphql_sources_map(
            &compiler_state.graphql_sources,
            &dirty_artifact_sources,
            &config,
        )
    })?;

    if compiler_state.should_cancel_current_build() {
        debug!("Build is cancelled: new file changes are pending.");
        return Err(Error::Cancelled);
    }

    // Pre-parse unique server schemas shared by multiple projects.
    // This avoids redundant parsing when many projects (e.g. intern_www,
    // facebook_www, oculus_www) all reference the same schema source.
    compiler_state.parsed_server_asts_cache =
        setup_event.time("preparse_unique_server_schemas_time", || {
            crate::build_project::build_schema::preparse_unique_server_schemas(
                &config,
                compiler_state,
            )
        });
    setup_event.number(
        "preparse_unique_server_schemas_count",
        compiler_state.parsed_server_asts_cache.len(),
    );

    let build_results: Vec<_> = config
        .par_enabled_projects()
        .filter(|project_config| {
            if let Some(base) = project_config.base
                && compiler_state.project_has_pending_changes(base)
            {
                return true;
            }
            compiler_state.project_has_pending_changes(project_config.name)
        })
        .map(|project_config| {
            build_project(
                &config,
                project_config,
                compiler_state,
                &graphql_asts,
                Arc::clone(&perf_logger),
            )
        })
        .collect();
    let build_commit_state_timer = setup_event.start("build_commit_state_time");
    let mut results = Vec::new();
    let mut errors = Vec::new();
    for result in build_results {
        match result {
            Ok(result) => results.push(result),
            Err(error) => match error {
                BuildProjectFailure::Error(error) => errors.push(error),
                BuildProjectFailure::Cancelled => {
                    return Err(Error::Cancelled);
                }
            },
        }
    }

    if !errors.is_empty() {
        return Err(Error::BuildProjectsErrors { errors });
    }

    if compiler_state.should_cancel_current_build() {
        debug!("Build is cancelled: updates in source code/or new file changes are pending.");
        return Err(Error::Cancelled);
    }

    let mut handles: Vec<JoinHandle<std::result::Result<_, BuildProjectFailure>>> = Vec::new();
    for WithDiagnostics {
        item: (project_name, schema, programs, artifacts),
        diagnostics,
    } in results
    {
        let config = Arc::clone(&config);
        let perf_logger = Arc::clone(&perf_logger);
        let artifact_map = compiler_state
            .artifacts
            .0
            .get(&project_name)
            .cloned()
            .unwrap_or_else(|| Arc::new(ArtifactMapKind::Unconnected(Default::default())));
        let mut removed_artifact_sources = graphql_asts
            .remove(&project_name)
            .expect("Expect GraphQLAsts to exist.")
            .removed_definition_names;

        let removed_docblock_artifact_sources =
            get_removed_docblock_artifact_source_keys(compiler_state.docblocks.get(&project_name));

        removed_artifact_sources.extend(removed_docblock_artifact_sources);
        removed_artifact_sources.extend(get_removed_full_sources(
            compiler_state.full_sources.get(&project_name),
        ));

        let dirty_artifact_paths = compiler_state
            .dirty_artifact_paths
            .get(&project_name)
            .cloned()
            .unwrap_or_default();

        let source_control_update_status = Arc::clone(&compiler_state.source_control_update_status);
        // Assembled here, the last point that holds the compiler state the
        // schema was built from, so what goes over the wire is the schema the
        // documents were validated against rather than a second read of the
        // same files.
        let schema_text = schema_text_for_persist(compiler_state, &config, project_name);
        handles.push(task::spawn(async move {
            // Spawn the Eden hash map RPC inside this per-project tokio task so
            // (a) the synchronous artifact-path extraction parallelizes across
            //     projects via the tokio worker pool instead of running serially
            //     in the build_commit_state loop, and
            // (b) the RPC still fires before commit_project's persist/generate
            //     work — preserving the original "early start" intent.
            //
            // Skip the spawn if a source control update is in progress —
            // commit_project will short-circuit with `Cancelled` at its first
            // SCM check, so the RPC would be wasted. Mirrors the pre-diff
            // gating where the spawn lived inside commit_project after the
            // SCM check.
            let hash_map_handle = if source_control_update_status.is_started() {
                None
            } else {
                spawn_artifact_hash_map_prefetch(
                    config.get_artifacts_file_hash_map.as_ref(),
                    &artifacts,
                )
            };
            let project_config = &config.projects[&project_name];
            let artifact_map = commit_project(
                &config,
                project_config,
                perf_logger,
                &schema,
                programs,
                artifacts,
                artifact_map,
                removed_artifact_sources,
                dirty_artifact_paths,
                source_control_update_status,
                hash_map_handle,
                schema_text,
            )
            .await?;
            Ok(((project_name, artifact_map, schema), diagnostics))
        }));
    }
    setup_event.stop(build_commit_state_timer);

    let commit_all_projects_timer = setup_event.start("commit_all_projects_time");
    let mut build_cancelled_during_commit = false;
    let mut all_diagnostics: Vec<Diagnostic> = Vec::new();
    for commit_result in join_all(handles).await {
        let commit_result: std::result::Result<std::result::Result<_, _>, _> = commit_result;
        let mut inner_result = commit_result.map_err(|e| Error::JoinError {
            error: e.to_string(),
        })?;
        match inner_result {
            Ok(((project_name, next_artifact_map, schema), ref mut diagnostics)) => {
                let next_artifact_map = Arc::new(ArtifactMapKind::Mapping(next_artifact_map));
                compiler_state
                    .artifacts
                    .0
                    .insert(project_name, next_artifact_map);
                compiler_state.schema_cache.insert(project_name, schema);

                all_diagnostics.append(diagnostics);
            }
            Err(BuildProjectFailure::Error(error)) => {
                errors.push(error);
            }
            Err(BuildProjectFailure::Cancelled) => {
                build_cancelled_during_commit = true;
            }
        }
    }
    setup_event.stop(commit_all_projects_timer);

    if !errors.is_empty() {
        return Err(Error::BuildProjectsErrors { errors });
    }

    if build_cancelled_during_commit {
        return Err(Error::Cancelled);
    }

    Ok(all_diagnostics)
}

/// The schema text to send alongside this project's persisted documents, or
/// `None` when the project does not ask for it or has none to send.
///
/// The project's server schema SDL, taken from compiler state rather than
/// re-read from disk, so a mid-build edit cannot swap the schema out from under
/// documents already validated against it.
///
/// Deliberately *only* the server schema. `compiler_state.extensions` — the
/// project's `schemaExtensions` and its base project's — is client schema
/// extensions, which the client-extensions transform strips out of a document
/// before it is persisted. Sending them would describe fields that no document
/// the endpoint receives can select.
///
/// The other client-side additions have no SDL sources to concatenate here
/// anyway: `build_schema_impl` folds in `RELAY_EXTENSIONS` and the types Relay
/// Resolvers contribute from docblocks. Their absence is consistent with
/// dropping the extensions above. `BUILTINS`, which the `schema` crate injects,
/// is likewise absent — any spec-compliant SDL parser supplies it.
///
/// A `schemaCompact` project keeps its schema as bytes rather than SDL and so
/// has no text to send; that returns `None` too, and the persister reports it
/// against the config that asked for it.
fn schema_text_for_persist(
    compiler_state: &CompilerState,
    config: &Config,
    project_name: relay_config::ProjectName,
) -> Option<Arc<String>> {
    let project_config = &config.projects[&project_name];
    if !project_config
        .persist
        .as_ref()
        .is_some_and(|persist| persist.include_schema_text())
    {
        return None;
    }

    let sources = compiler_state.schemas.get(&project_name)?.get_sources();
    if sources.is_empty() {
        return None;
    }

    Some(Arc::new(
        sources
            .into_iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .join("\n"),
    ))
}

/// Get the list of removed docblock sources.
fn get_removed_docblock_artifact_source_keys(
    docblock_sources: Option<&DocblockSources>,
) -> Vec<ArtifactSourceKey> {
    let mut removed_docblocks: Vec<ArtifactSourceKey> = vec![];

    if let Some(docblock_sources) = docblock_sources {
        for (file_name, pending_docblock_sources_for_file) in docblock_sources.pending.iter() {
            let mut docblocks_in_file = HashSet::new();

            for LocatedDocblockSource {
                docblock_source, ..
            } in pending_docblock_sources_for_file
            {
                docblocks_in_file.insert(&docblock_source.text_source().text);
            }

            if let Some(processed) = docblock_sources.processed.get(file_name) {
                for LocatedDocblockSource {
                    docblock_source, ..
                } in processed
                {
                    // If new content of the file doesn't contain the docblock, we should remove
                    // the generated artifacts for this docblock.
                    if !docblocks_in_file.contains(&docblock_source.text_source().text) {
                        removed_docblocks.push(ArtifactSourceKey::ResolverHash(
                            ResolverSourceHash::new(&docblock_source.text_source().text),
                        ));
                    }
                }
            }
        }
    }

    removed_docblocks
}

/// Get the list of removed full sources.
fn get_removed_full_sources(full_sources: Option<&FullSources>) -> Vec<ArtifactSourceKey> {
    let mut removed_full_sources: Vec<ArtifactSourceKey> = vec![];
    if let Some(full_sources) = full_sources {
        for (file, pending_source_text) in full_sources.pending.iter() {
            if let Some(processed_source_text) = full_sources.processed.get(file) {
                // Full sources are keyed by a hash of their contents.
                // Therefore if the contents of a file have changed we must
                // treat the hash of the old version of that file as removed.
                if pending_source_text != processed_source_text {
                    // For now, full sources are only used for ResolverHash
                    removed_full_sources.push(ArtifactSourceKey::ResolverHash(
                        ResolverSourceHash::new(processed_source_text),
                    ))
                }
            }
        }
    }
    removed_full_sources
}
