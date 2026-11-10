/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;

use common::PerfLogEvent;
use common::PerfLogger;
use graphql_watchman::WatchmanFile;
use graphql_watchman::WatchmanFileSourceResult;
use graphql_watchman::WatchmanFileSourceSubscription;
use log::debug;
use log::info;
use log::warn;
use relay_saved_state_loader::SavedStateConfig;
use relay_saved_state_loader::SavedStateLoader;
pub use watchman_client::prelude::Clock;
use watchman_client::prelude::*;

use super::FileSourceResult;
use super::external_file_source::ExternalFileSource;
use super::watchman_query_builder::get_watchman_expr;
use crate::compiler_state::CompilerState;
use crate::config::Config;
use crate::errors::Error;
use crate::errors::Result;

pub struct WatchmanFileSource {
    client: Arc<Client>,
    config: Arc<Config>,
    resolved_root: ResolvedRoot,
}

impl WatchmanFileSource {
    pub async fn connect(
        config: &Arc<Config>,
        perf_logger_event: &impl PerfLogEvent,
    ) -> Result<WatchmanFileSource> {
        let connect_timer = perf_logger_event.start("file_source_connect_time");
        let client = Connector::new().connect().await?;
        let canonical_root = CanonicalPath::canonicalize(&config.root_dir).map_err(|err| {
            Error::CanonicalizeRoot {
                root: config.root_dir.clone(),
                source: err,
            }
        })?;
        let resolved_root = client.resolve_root(canonical_root).await?;
        perf_logger_event.stop(connect_timer);
        debug!("WatchmanFileSource::connect(...) resolved_root = {resolved_root:?}");
        Ok(Self {
            client: Arc::new(client),
            config: config.clone(),
            resolved_root,
        })
    }

    /// Executes a point query (as opposed to a subscription) to find all files
    /// to compile and returns the result.
    pub async fn query(
        &self,
        perf_logger_event: &impl PerfLogEvent,
        perf_logger: &impl PerfLogger,
    ) -> Result<CompilerState> {
        info!("Querying files to compile...");
        let query_time = perf_logger_event.start("file_source_query_time");
        // Consume-on-attempt take() — the path is dropped whether this
        // branch succeeds or returns Err via `?` further down. Safety:
        //
        //   - **Success.** Subsequent `WatchmanFileSource::query()` calls
        //     (from later `compiler.watch()` loop iterations, e.g. after a
        //     source-control update) see `None` and fall through to
        //     `try_saved_state` below, which fetches a fresh saved-state
        //     from infrastructure at the post-rebase mergebase. Re-using
        //     the original snapshot here would mis-build.
        //
        //   - **Failure via `?` below** (deserialize / Watchman query /
        //     merge). The path is dropped, `query()` returns Err, and the
        //     caller propagates: `subscribe()` -> `Compiler::watch()` ->
        //     the daemon's spawned task ends -> the daemon's
        //     `tokio::select!` notices the dead task and tears down the
        //     daemon. The next client invocation spawns a fresh daemon
        //     with a fresh `--initial-import-state` from `DaemonStartHints`,
        //     so a transient failure (e.g. corrupt-on-disk saved-state)
        //     doesn't put the daemon into a stuck state. A future watch()
        //     iteration on a hypothetical surviving daemon would have
        //     fallen through to `try_saved_state` harmlessly anyway.
        //
        //   - **Concurrency.** `compiler.watch()` runs in a single tokio
        //     task; there are no concurrent `query()` calls on a shared
        //     `Arc<Config>`, so the take() doesn't race against a peer.
        //     If a future change adds a second caller, the `Mutex` guards
        //     the take itself — a racing peer would see `None` and fall
        //     through, which is still correct (just loses the optimization
        //     for that one call).
        let saved_state_override = self
            .config
            .load_saved_state_file
            .lock()
            .ok()
            .and_then(|mut guard| guard.take());
        if let Some(saved_state_path) = saved_state_override {
            let mut compiler_state = perf_logger_event.time("deserialize_saved_state", || {
                CompilerState::deserialize_from_file_with_frames(
                    &saved_state_path,
                    self.config.parallel_saved_state_frames,
                )
            })?;
            let query_timer = perf_logger_event.start("watchman_query_time");
            let file_source_result = query_file_result(
                &self.config,
                &self.client,
                &self.resolved_root.clone(),
                compiler_state.clock.clone(),
                false,
            )
            .await?;
            perf_logger_event.stop(query_timer);
            compiler_state
                .pending_file_source_changes
                .write()
                .unwrap()
                .push(file_source_result);
            compiler_state.merge_file_source_changes(&self.config, perf_logger, true)?;
            perf_logger_event.stop(query_time);
            return Ok(compiler_state);
        }

        // If saved state is configured, try using saved state unless the config
        // forces a full build.
        if let Config {
            compile_everything: false,
            saved_state_config: Some(saved_state_config),
            saved_state_loader: Some(saved_state_loader),
            saved_state_version,
            ..
        } = self.config.as_ref()
        {
            match self
                .try_saved_state(
                    perf_logger,
                    perf_logger_event,
                    saved_state_config.clone(),
                    saved_state_loader.as_ref(),
                    saved_state_version,
                )
                .await
            {
                Ok(load_result) => {
                    perf_logger_event.stop(query_time);
                    perf_logger_event.string("try_saved_state_result", "success".to_owned());
                    return load_result;
                }
                Err(saved_state_failure) => {
                    perf_logger_event
                        .string("try_saved_state_result", saved_state_failure.to_owned());
                    warn!(
                        "Unable to load saved state, falling back to full build: {saved_state_failure}"
                    );
                }
            }
        }

        // Finally, do a simple full query.
        let full_query_result = self.full_query(perf_logger_event, perf_logger).await;

        perf_logger_event.stop(query_time);
        full_query_result
    }

    pub async fn full_query(
        &self,
        perf_logger_event: &impl PerfLogEvent,
        perf_logger: &impl PerfLogger,
    ) -> Result<CompilerState> {
        let file_source_result = query_file_result(
            &self.config,
            &self.client,
            &self.resolved_root.clone(),
            None,
            false,
        )
        .await?;
        let compiler_state = perf_logger_event.time("from_file_source_changes", || {
            CompilerState::from_file_source_changes(
                &self.config,
                &file_source_result,
                perf_logger_event,
                perf_logger,
            )
        })?;
        Ok(compiler_state)
    }

    /// Cold daemon fast-path: when the client (e.g. meerkat) provided both a
    /// saved-state file and a changed-files-list, build the initial
    /// `CompilerState` from those locally instead of paying the slow
    /// saved-state-from-Manifold fetch + Watchman SCM-aware query.
    ///
    /// The two paths are an *optimization hint*, not a constraint — on any
    /// failure (missing input, deserialize error, version mismatch, etc.)
    /// this returns `None` and the caller falls back to the normal Watchman
    /// path (which will fetch a fresh saved-state from infrastructure).
    ///
    /// Both inputs are consumed once. On subsequent `watch()` iterations
    /// (e.g. after a source-control update), this returns `None` and the
    /// caller goes through the normal Watchman path.
    fn try_initial_external_state(
        &self,
        perf_logger_event: &impl PerfLogEvent,
        perf_logger: &impl PerfLogger,
    ) -> Option<CompilerState> {
        let (saved_state_path, changed_files_list) = take_initial_external_paths(
            &self.config.load_saved_state_file,
            &self.config.initial_external_changed_files_list,
        )?;
        let initial_external_timer = perf_logger_event.start("initial_external_state_time");
        let external = ExternalFileSource::new(
            saved_state_path,
            changed_files_list,
            Arc::clone(&self.config),
        );
        let result = external.create_compiler_state(perf_logger);
        perf_logger_event.stop(initial_external_timer);
        match result {
            Ok(state) => {
                info!(
                    "Seeded daemon state from client-provided saved-state + \
                     changed-files-list (skipping watchman SCM-aware query)."
                );
                perf_logger_event.bool("used_initial_external_state", true);
                Some(state)
            }
            Err(err) => {
                // Note the asymmetry with the `None` arm of
                // `take_initial_external_paths`: that arm restores
                // `saved_state_path` to its Mutex slot when the changed-files
                // list is absent, but here on `Err` we do NOT restore — the
                // path has been moved into `ExternalFileSource` and consumed
                // by deserialize_from_file, and a saved-state that failed to
                // load is exactly what we don't want to retry on the fallback
                // path. Letting the fallback go through `try_saved_state`
                // gets a fresh saved-state from infrastructure instead.
                perf_logger_event.string("initial_external_state_error", format!("{err:?}"));
                warn!(
                    "Unable to seed initial daemon state from client-provided \
                     saved-state + changed-files: {err:?}. Falling back to watchman query."
                );
                None
            }
        }
    }

    /// Starts a subscription sending updates since the given clock.
    pub async fn subscribe(
        self,
        perf_logger_event: &impl PerfLogEvent,
        perf_logger: &impl PerfLogger,
    ) -> Result<(CompilerState, WatchmanFileSourceSubscription)> {
        let timer = perf_logger_event.start("file_source_subscribe_time");
        let mut compiler_state =
            match self.try_initial_external_state(perf_logger_event, perf_logger) {
                Some(state) => state,
                None => self.query(perf_logger_event, perf_logger).await?,
            };

        let expression = get_watchman_expr(&self.config);

        let query_timer = perf_logger_event.start("watchman_query_time_before_subscribe");
        let file_source_result = query_file_result(
            &self.config,
            &self.client,
            &self.resolved_root.clone(),
            compiler_state.clock.clone(),
            true,
        )
        .await?;
        perf_logger_event.stop(query_timer);
        compiler_state.clock = file_source_result.clock();

        let query_timer = perf_logger_event.start("watchman_query_time_subscribe");
        let (subscription, _initial) = self
            .client
            .subscribe::<WatchmanFile>(
                &self.resolved_root,
                SubscribeRequest {
                    expression: Some(expression),
                    since: file_source_result.clock(),
                    defer: vec!["hg.update"],
                    ..Default::default()
                },
            )
            .await?;
        perf_logger_event.stop(query_timer);

        perf_logger_event.stop(timer);

        Ok((
            compiler_state,
            WatchmanFileSourceSubscription::new(self.resolved_root.clone(), subscription),
        ))
    }

    /// Tries to load saved state with a watchman query.
    /// The return value is a nested Result:
    /// The outer Result indicates the result of a possible saved state infrastructure failure.
    /// The inner Result is a potential parse error.
    async fn try_saved_state(
        &self,
        perf_logger: &impl PerfLogger,
        perf_logger_event: &impl PerfLogEvent,
        saved_state_config: ScmAwareClockData,
        saved_state_loader: &'_ (dyn SavedStateLoader + Send + Sync),
        saved_state_version: &str,
    ) -> std::result::Result<Result<CompilerState>, &'static str> {
        let try_saved_state_event = perf_logger_event.start("try_saved_state_time");
        let scm_since = Clock::ScmAware(FatClockData {
            clock: ClockSpec::null(),
            scm: Some(saved_state_config),
        });
        debug!(
            "WatchmanFileSource::try_saved_state(...) scm_since = {:?}",
            scm_since
        );

        // Issue two watchman queries: One to get the saved state info, and one to get the changed files.
        // We'll download and deserialize saved state from manifold while the second watchman query executes.

        let since = Some(scm_since.clone());
        let root = self.resolved_root.clone();
        let saved_state_query_timer = perf_logger_event.start("saved_state_info_query_time");
        let saved_state_result = query_file_result(&self.config, &self.client, &root, since, true)
            .await
            .map_err(|_| "query failed")?;
        perf_logger_event.stop(saved_state_query_timer);

        let since = Some(scm_since.clone());
        let config = Arc::clone(&self.config);
        let client = Arc::clone(&self.client);
        let root = self.resolved_root.clone();
        let changed_files_result_future = tokio::task::spawn(async move {
            query_file_result(&config, &client, &root, since, false)
                .await
                .map_err(|_| "query failed")
        });

        // First, use saved state query to download saved state from manifold.
        debug!(
            "WatchmanFileSource::try_saved_state(...) saved_state_result = {:?}",
            saved_state_result
        );
        let saved_state_info = saved_state_result
            .saved_state_info()
            .ok_or("no saved state in watchman response")?;
        debug!(
            "WatchmanFileSource::saved_state_info(...) file_source_result = {:?}",
            saved_state_info
        );

        let saved_state_load_timer = perf_logger_event.start("saved_state_loading_time");
        let saved_state_path = saved_state_loader
            .load(
                saved_state_info,
                &SavedStateConfig {
                    saved_state_version: self.config.saved_state_version.clone(),
                },
            )
            .await
            .ok_or("unable to load")?;
        perf_logger_event.stop(saved_state_load_timer);

        let mut compiler_state = perf_logger_event
            .time("deserialize_saved_state", || {
                CompilerState::deserialize_from_file_with_frames(
                    &saved_state_path,
                    self.config.parallel_saved_state_frames,
                )
            })
            .map_err(|err| {
                let error_event = perf_logger.create_event("saved_state_loader_error");
                error_event.string("error", format!("Failed to deserialize: {err}"));
                error_event.complete();
                "failed to deserialize"
            })?;
        // For cases, where we want to debug saved state integration, that doesn't include
        // saved_state format changes we may need to disable this by adding this env variable
        if std::env::var("RELAY_COMPILER_IGNORE_SAVED_STATE_VERSION").is_err()
            && compiler_state.saved_state_version != saved_state_version
        {
            return Err("Saved state version doesn't match.");
        }

        // Then await the changed files query.
        let saved_state_await_changed_files_time =
            perf_logger_event.start("saved_state_await_changed_files_time");
        let file_source_result = changed_files_result_future
            .await
            .map_err(|_| "query failed")??;
        perf_logger_event.stop(saved_state_await_changed_files_time);

        compiler_state
            .pending_file_source_changes
            .write()
            .unwrap()
            .push(file_source_result);

        if let Some(update_compiler_state_from_saved_state) =
            &self.config.update_compiler_state_from_saved_state
        {
            let update_compiler_state_from_saved_state_time =
                perf_logger_event.start("update_compiler_state_from_saved_state_time");
            update_compiler_state_from_saved_state(&mut compiler_state, &self.config);
            perf_logger_event.stop(update_compiler_state_from_saved_state_time);
        }

        match perf_logger_event.time("merge_file_source_changes", || {
            let result = compiler_state.merge_file_source_changes(&self.config, perf_logger, true);
            perf_logger_event.stop(try_saved_state_event);
            result
        }) {
            Err(parse_error) => Ok(Err(parse_error)),
            _ => Ok(Ok(compiler_state)),
        }
    }
}

async fn query_file_result(
    config: &Config,
    client: &Client,
    resolved_root: &ResolvedRoot,
    since_clock: Option<Clock>,
    omit_changed_files: bool,
) -> Result<FileSourceResult> {
    let expression = get_watchman_expr(config);
    debug!(
        "WatchmanFileSource::query_file_result(...) get_watchman_expr = {:?}",
        expression
    );

    // If `since` is available, we should not pass the `path` parameter.
    // Watchman ignores `since` parameter if both `path` and `since` are
    // passed as the request params
    let request = if since_clock.is_some() {
        QueryRequestCommon {
            omit_changed_files,
            empty_on_fresh_instance: omit_changed_files,
            expression: Some(expression),
            since: since_clock,
            ..Default::default()
        }
    } else {
        let query_roots = config
            .get_all_roots()
            .into_iter()
            .map(PathGeneratorElement::RecursivePath)
            .collect();
        QueryRequestCommon {
            omit_changed_files,
            empty_on_fresh_instance: omit_changed_files,
            expression: Some(expression),
            path: Some(query_roots),
            ..Default::default()
        }
    };
    debug!(
        "WatchmanFileSource::query_file_result(...) request = {:?}",
        request
    );
    let query_result = client.query::<WatchmanFile>(resolved_root, request).await?;

    // print debug information for this result
    // (file list will include only files with specified extension)
    debug_query_results(&query_result, "graphql");

    let files = query_result.files.ok_or(Error::EmptyQueryResult)?;
    Ok(FileSourceResult::Watchman(Box::new(
        WatchmanFileSourceResult {
            files,
            resolved_root: resolved_root.clone(),
            clock: query_result.clock,
            saved_state_info: query_result.saved_state_info,
        },
    )))
}

/// Raw result of a Watchman `since` query against the compiler's expression.
///
/// Callers interpret these fields to decide what to do:
/// - `is_fresh_instance == true` means the incremental answer is untrustworthy
///   and the caller must reset state.
/// - `files == Some(..)` carries the changed files for an incremental build.
/// - `files == None` means no relevant files changed.
#[derive(Debug)]
pub struct ChangesSinceQuery {
    pub files: Option<FileSourceResult>,
    pub clock: Clock,
    pub is_fresh_instance: bool,
}

/// Query watchman for file changes since the given clock.
///
/// Opens a short-lived watchman connection and checks if any files
/// matching the compiler's watchman expression have changed since
/// `since_clock`. Returns the raw [`ChangesSinceQuery`] for the caller
/// to interpret.
pub async fn query_changes_since(
    config: &Arc<Config>,
    since_clock: Clock,
) -> Result<ChangesSinceQuery> {
    let client = Connector::new().connect().await?;
    let canonical_root =
        CanonicalPath::canonicalize(&config.root_dir).map_err(|err| Error::CanonicalizeRoot {
            root: config.root_dir.clone(),
            source: err,
        })?;
    let resolved_root = client.resolve_root(canonical_root).await?;

    let expression = get_watchman_expr(config);

    let request = QueryRequestCommon {
        expression: Some(expression),
        since: Some(since_clock),
        ..Default::default()
    };

    let query_result = client
        .query::<WatchmanFile>(&resolved_root, request)
        .await?;

    let clock = query_result.clock;
    let is_fresh_instance = query_result.is_fresh_instance;

    let files = query_result.files.unwrap_or_default();
    let files = if files.is_empty() {
        None
    } else {
        Some(FileSourceResult::Watchman(Box::new(
            WatchmanFileSourceResult {
                files,
                resolved_root,
                clock: clock.clone(),
                saved_state_info: query_result.saved_state_info,
            },
        )))
    };

    Ok(ChangesSinceQuery {
        files,
        clock,
        is_fresh_instance,
    })
}

fn debug_query_results(query_result: &QueryResult<WatchmanFile>, extension_filter: &str) {
    if let Ok(rust_log) = std::env::var("RUST_LOG")
        && rust_log == *"debug"
    {
        debug!(
            "WatchmanFileSource::query_file_result(...) query_result.version = {:?}",
            query_result.version
        );
        debug!(
            "WatchmanFileSource::query_file_result(...) query_result.clock = {:?}",
            query_result.clock
        );
        debug!(
            "WatchmanFileSource::query_file_result(...) query_result.is_fresh_instance = {:?}",
            query_result.is_fresh_instance
        );
        debug!(
            "WatchmanFileSource::query_file_result(...) query_result.saved_state_info = {:?}",
            query_result.saved_state_info
        );
        debug!(
            "WatchmanFileSource::query_file_result(...) query_result.state_metadata = {:?}",
            query_result.state_metadata
        );
        if let Some(files) = &query_result.files {
            debug!(
                "WatchmanFileSource::query_file_result(...) query_result.files(only=*.{}) = \n{}",
                extension_filter,
                files
                    .iter()
                    .filter_map(|file| {
                        if file.name.extension().is_some()
                            && file.name.extension().unwrap() == extension_filter
                        {
                            Some(format!("name: {:?}, exists: {}", *file.name, *file.exists))
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<String>>()
                    .join("\n")
            );
        } else {
            debug!("WatchmanFileSource::query_file_result(...): no files found");
        }
    }
}

/// Atomically (from the perspective of `compiler.watch()`'s single-threaded
/// caller) take the saved-state path and the changed-files-list path that
/// the client provided as cold-start hints. If both are present, returns
/// `Some((saved_state, changed_files))` and leaves both slots empty so a
/// subsequent `watch()` iteration won't re-consume stale paths.
///
/// **Restore semantics on `None`.** If saved-state is missing entirely,
/// changed-files is not touched (no half-consume). If saved-state is present
/// but changed-files is missing, the saved-state is *restored* to its slot
/// so the caller's fallback (`WatchmanFileSource::query`) can still consume
/// it. This preserves the saved-state-only fast path (only `--initial-import-state`
/// set, no `--initial-changed-files-list`) that the prior commit added.
///
/// The asymmetry with the `try_initial_external_state` `Err` arm is intentional:
/// there, the saved-state path has already been moved into `ExternalFileSource`
/// and consumed by `deserialize_from_file`; a saved-state that failed to load
/// is exactly what we don't want to retry. See the comment on that `Err` arm.
fn take_initial_external_paths(
    saved_state_slot: &Mutex<Option<PathBuf>>,
    changed_files_slot: &Mutex<Option<PathBuf>>,
) -> Option<(PathBuf, PathBuf)> {
    let saved_state_path = {
        let mut guard = saved_state_slot.lock().ok()?;
        guard.take()?
    };
    match changed_files_slot.lock().ok().and_then(|mut g| g.take()) {
        Some(changes) => Some((saved_state_path, changes)),
        None => {
            // Restore so the fallback (try_saved_state-from-file branch of
            // WatchmanFileSource::query) can consume the saved-state path.
            if let Ok(mut guard) = saved_state_slot.lock() {
                *guard = Some(saved_state_path);
            }
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_take_initial_external_paths_returns_both_when_both_present() {
        let saved_state = Mutex::new(Some(PathBuf::from("/state.bin")));
        let changes = Mutex::new(Some(PathBuf::from("/changes.json")));

        let result = take_initial_external_paths(&saved_state, &changes);

        assert_eq!(
            result,
            Some((PathBuf::from("/state.bin"), PathBuf::from("/changes.json")))
        );
        // Both slots are now empty — subsequent watch() iterations won't
        // re-consume stale paths.
        assert!(saved_state.lock().unwrap().is_none());
        assert!(changes.lock().unwrap().is_none());
    }

    #[test]
    fn test_take_initial_external_paths_restores_saved_state_when_changes_missing() {
        let saved_state = Mutex::new(Some(PathBuf::from("/state.bin")));
        let changes: Mutex<Option<PathBuf>> = Mutex::new(None);

        let result = take_initial_external_paths(&saved_state, &changes);

        assert!(result.is_none());
        // Saved-state was restored so the fallback Watchman query path
        // (WatchmanFileSource::query's load_saved_state_file branch) can
        // still consume it — this preserves the saved-state-only fast path
        // that the prior commit added.
        assert_eq!(
            *saved_state.lock().unwrap(),
            Some(PathBuf::from("/state.bin"))
        );
        assert!(changes.lock().unwrap().is_none());
    }

    #[test]
    fn test_take_initial_external_paths_returns_none_when_saved_state_missing() {
        let saved_state: Mutex<Option<PathBuf>> = Mutex::new(None);
        let changes = Mutex::new(Some(PathBuf::from("/changes.json")));

        let result = take_initial_external_paths(&saved_state, &changes);

        assert!(result.is_none());
        // Changes slot is NOT consumed when saved-state is missing — no
        // half-consume — so a future caller that does have a saved-state
        // could still use the changes list (defensive; today nothing
        // exercises this path).
        assert!(saved_state.lock().unwrap().is_none());
        assert_eq!(
            *changes.lock().unwrap(),
            Some(PathBuf::from("/changes.json"))
        );
    }

    /// Documents the `Err` arm consume-and-don't-restore behavior of
    /// `try_initial_external_state`: when `ExternalFileSource::create_compiler_state`
    /// returns an error, the saved-state path is NOT restored to its slot
    /// — it was moved into `ExternalFileSource` and consumed by
    /// `deserialize_from_file`. After the error, both slots are empty so
    /// the fallback `WatchmanFileSource::query` goes through `try_saved_state`
    /// (which fetches a fresh saved-state from Manifold) rather than
    /// re-deserializing the same failed file.
    ///
    /// This test exercises the helper-level invariant since we can't easily
    /// construct an `ExternalFileSource` in isolation without a real Config;
    /// the assertion is that *after* `take_initial_external_paths` returns
    /// the pair, neither slot still has anything for a fallback to consume.
    #[test]
    fn test_external_failure_leaves_both_slots_empty() {
        let saved_state = Mutex::new(Some(PathBuf::from("/state.bin")));
        let changes = Mutex::new(Some(PathBuf::from("/changes.json")));

        let (taken_state, taken_changes) =
            take_initial_external_paths(&saved_state, &changes).unwrap();

        // Pretend ExternalFileSource consumed both and then failed —
        // we drop them without restoring.
        drop(taken_state);
        drop(taken_changes);

        // Both slots are empty; a subsequent WatchmanFileSource::query()
        // will see load_saved_state_file=None and fall through to
        // try_saved_state (the desired behavior for the Err fallback).
        assert!(saved_state.lock().unwrap().is_none());
        assert!(changes.lock().unwrap().is_none());
    }
}
