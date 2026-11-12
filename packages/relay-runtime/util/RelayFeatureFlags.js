/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall relay
 */

'use strict';

import type {Disposable} from '../util/RelayRuntimeTypes';

export type FeatureFlags = {
  ENABLE_GETFRAGMENTIDENTIFIER_OPTIMIZATION: boolean,
  ENABLE_FRIENDLY_QUERY_NAME_GQL_URL: boolean,
  ENABLE_DO_NOT_WRAP_LIVE_QUERY: boolean,
  ENABLE_NOTIFY_SUBSCRIPTION: boolean,
  BATCH_ASYNC_MODULE_UPDATES_FN: ?(v: () => void) => Disposable,
  MAX_DATA_ID_LENGTH: ?number,
  STRING_INTERN_LEVEL: number,
  LOG_MISSING_RECORDS_IN_PROD: boolean,
  ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE: boolean,
  ENABLE_UI_CONTEXT_ON_RELAY_LOGGER: boolean,

  // Some GraphQL servers are noncompliant with the GraphQL specification and
  // return an empty list instead of null when there is a field error on a list.
  //
  // If this describes your server, enable this flag so that Relay will treat
  // empty lists as null when deciding whether or not to check for field errors
  // in the response.
  ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS: boolean,

  // Configure RelayStoreSubscriptions to mark a subscription as affected by an
  // update if there are any overlapping IDs other than ROOT_ID or VIWER_ID,
  // even if none of the read fields were affected. The strict behavior (current
  // default) requires eagerly reading fragments as they change which is
  // incompatible with lazily notifying React of updats using `setState(() =>
  // read())`, so we are experimenting with this loose behavior which should be
  // more compatible.
  ENABLE_LOOSE_SUBSCRIPTION_ATTRIBUTION: boolean,
  ENABLE_OPERATION_TRACKER_OPTIMISTIC_UPDATES: boolean,

  PROCESS_OPTIMISTIC_UPDATE_BEFORE_SUBSCRIPTION: boolean,

  // Temporary flag to enable a gradual rollout of the fix for T185969900
  MARK_RESOLVER_VALUES_AS_CLEAN_AFTER_FRAGMENT_REREAD: boolean,

  ENABLE_CYLE_DETECTION_IN_VARIABLES: boolean,

  // Temporary flag to experiment to enable compatibility with React's unstable <Activity> API
  ENABLE_ACTIVITY_COMPATIBILITY: boolean,

  // Enable logging an ID collision in the Relay store
  ENABLE_STORE_ID_COLLISION_LOGGING: boolean,

  // Throw on nested store updates
  DISALLOW_NESTED_UPDATES: boolean,

  // Relay previously had a bug where it would fail to check for missing client
  // edge to server data in fragments nested within client edge Relay Resolver
  // fields. This feature flag fixes the behavior but comes with a perf cost.
  // This flag is here to allow us to gradually rollout the fix and track the perf
  // impact.
  //
  // See https://github.com/facebook/relay/issues/4882
  CHECK_ALL_FRAGMENTS_FOR_MISSING_CLIENT_EDGES: boolean,

  // When enabled, records created for Relay Resolvers will be filtered out
  // from the store when serializing to JSON.
  FILTER_OUT_RELAY_RESOLVER_RECORDS: boolean,

  // Reduce the work on store.notify
  OPTIMIZE_NOTIFY: boolean,

  // Enable per-field subscription granularity on specific records (e.g. client:root).
  // When enabled, subscriptions reading a field-granular record are only notified
  // when the specific fields they read have changed, rather than on any change
  // to the record.
  ENABLE_FIELD_GRANULAR_NOTIFICATIONS: boolean,

  // Enable logging for reader reading fragment spreads and fragments. Useful for logging unused fragments.
  ENABLE_READER_FRAGMENTS_LOGGING: boolean,

  // When enabled, outer @catch boundaries ignore field errors that have already
  // been handled by an inner @catch. Without this flag, a handled error from an
  // inner @catch still causes the outer @catch(to: NULL) to null its field and
  // outer @catch(to: RESULT) to report {ok: false}, even though the inner
  // boundary already consumed the error.
  //
  // See https://github.com/facebook/relay/issues/5339
  ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS: boolean,

  // Temporary flag for the gradual rollout of the ifEmpty cancellation fix.
  // When enabled, `ifEmpty` captures the primary subscription via the `start`
  // callback so an alternate selected during synchronous completion of the
  // primary (e.g. a network request chosen after a synchronous cache miss)
  // stays reachable by `unsubscribe`. Defaults off; without it the alternate is
  // orphaned and runs to completion, matching prior behavior.
  ENABLE_IF_EMPTY_CANCELLATION: boolean,

  // When enabled (the default), an explicitly passed `null` fragment argument
  // is the argument's value when the Store binds a non-inlined fragment's
  // arguments (`@no_inline`, `@module`), as it is for the Reader and the
  // server. When disabled, it is replaced by the argument's default value, as
  // before, so the response is written under a key the Reader never reads.
  // Relay RSC requires it.
  ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS: boolean,

  // Temporary flag for the rollout of a useFragment fix: a store update that a
  // subscription delivers keeps the store epoch it was read at.
  ENABLE_FRAGMENT_SUBSCRIPTION_UPDATE_FIX: boolean,

  // Performance optimizations of the runtime, by the code they change. Each
  // keeps the previous implementation for when its flag is off. They don't
  // change results. Set them once, to true, before creating any environment:
  // a store picks some of its helpers when it is created.
  //
  // Storage keys and type IDs.
  ENABLE_PERF_STORAGE_KEYS: boolean,
  // RelayReader.
  ENABLE_PERF_READER: boolean,
  // Records, mutations, normalization and publishing to the store.
  ENABLE_PERF_PUBLISH: boolean,
  // recycleNodesInto.
  ENABLE_PERF_NOTIFY: boolean,
};

const RelayFeatureFlags: FeatureFlags = {
  ENABLE_GETFRAGMENTIDENTIFIER_OPTIMIZATION: false,
  ENABLE_FRIENDLY_QUERY_NAME_GQL_URL: false,
  ENABLE_DO_NOT_WRAP_LIVE_QUERY: false,
  ENABLE_NOTIFY_SUBSCRIPTION: false,
  BATCH_ASYNC_MODULE_UPDATES_FN: null,
  MAX_DATA_ID_LENGTH: null,
  STRING_INTERN_LEVEL: 0,
  LOG_MISSING_RECORDS_IN_PROD: false,
  ENABLE_STORE_ID_COLLISION_LOGGING: false,
  ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS: false,
  ENABLE_LOOSE_SUBSCRIPTION_ATTRIBUTION: false,
  ENABLE_OPERATION_TRACKER_OPTIMISTIC_UPDATES: false,
  ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE: false,
  PROCESS_OPTIMISTIC_UPDATE_BEFORE_SUBSCRIPTION: false,
  MARK_RESOLVER_VALUES_AS_CLEAN_AFTER_FRAGMENT_REREAD: false,
  ENABLE_CYLE_DETECTION_IN_VARIABLES: false,
  ENABLE_ACTIVITY_COMPATIBILITY: true,
  DISALLOW_NESTED_UPDATES: false,
  ENABLE_UI_CONTEXT_ON_RELAY_LOGGER: false,
  CHECK_ALL_FRAGMENTS_FOR_MISSING_CLIENT_EDGES: false,
  FILTER_OUT_RELAY_RESOLVER_RECORDS: false,
  OPTIMIZE_NOTIFY: false,
  ENABLE_FIELD_GRANULAR_NOTIFICATIONS: false,
  ENABLE_READER_FRAGMENTS_LOGGING: false,
  ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS: false,
  ENABLE_IF_EMPTY_CANCELLATION: false,
  ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS: true,
  ENABLE_FRAGMENT_SUBSCRIPTION_UPDATE_FIX: false,
  ENABLE_PERF_STORAGE_KEYS: false,
  ENABLE_PERF_READER: false,
  ENABLE_PERF_PUBLISH: false,
  ENABLE_PERF_NOTIFY: false,
};

module.exports = RelayFeatureFlags;
