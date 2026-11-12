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
import type {
  DataIDSet,
  LogFunction,
  OperationDescriptor,
  RecordSource,
  RequestDescriptor,
  ResolverContext,
  Snapshot,
  StoreSubscriptions,
} from './RelayStoreTypes';
import type {ResolverCache} from './ResolverCache';

const deepFreeze = require('../util/deepFreeze');
const recycleNodesInto = require('../util/recycleNodesInto');
const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const hasOverlappingIDs = require('./hasOverlappingIDs');
const hasOverlappingIDsPerf = require('./hasOverlappingIDsPerf');
const hasSignificantOverlappingIDs = require('./hasSignificantOverlappingIDs');
const RelayReader = require('./RelayReader');

type Subscription = {
  callback: (snapshot: Snapshot) => void,
  snapshot: Snapshot,
  stale: boolean,
  backup: ?Snapshot,
};

class RelayStoreSubscriptions implements StoreSubscriptions {
  _subscriptions: Set<Subscription>;
  __log: ?LogFunction;
  _resolverCache: ResolverCache;
  _resolverContext: ?ResolverContext;
  // Stores `subscriptions` with stale snapshots, used for reducing the traversal
  // that has to happen on `notify`
  _staleSubscriptions: Set<Subscription>;
  // Read once per store, so that `_updateSubscription` keeps a single call.
  _hasOverlappingIDs: (
    seenRecords: DataIDSet,
    updatedRecordIDs: DataIDSet,
  ) => boolean;

  constructor(
    log?: ?LogFunction,
    resolverCache: ResolverCache,
    resolverContext?: ResolverContext,
  ) {
    this._subscriptions = new Set();
    this._staleSubscriptions = new Set();
    this.__log = log;
    this._resolverCache = resolverCache;
    this._resolverContext = resolverContext;
    this._hasOverlappingIDs = RelayFeatureFlags.ENABLE_PERF_NOTIFY
      ? hasOverlappingIDsPerf
      : hasOverlappingIDs;
  }

  subscribe(
    snapshot: Snapshot,
    callback: (snapshot: Snapshot) => void,
  ): Disposable {
    const subscription: Subscription = {
      backup: null,
      callback,
      snapshot,
      stale: false,
    };
    const dispose = () => {
      this._subscriptions.delete(subscription);
      if (RelayFeatureFlags.OPTIMIZE_NOTIFY && subscription.stale) {
        this._staleSubscriptions.delete(subscription);
      }
    };
    this._subscriptions.add(subscription);
    return {dispose};
  }

  snapshotSubscriptions(source: RecordSource) {
    this._subscriptions.forEach(subscription => {
      // Backup occurs after writing a new "final" payload(s) and before (re)applying
      // optimistic changes. Each subscription's `snapshot` represents what was *last
      // published to the subscriber*, which notably may include previous optimistic
      // updates. Therefore a subscription can be in any of the following states:
      // - stale=true: This subscription was restored to a different value than
      //   `snapshot`. That means this subscription has changes relative to its base,
      //   but its base has changed (we just applied a final payload): recompute
      //   a backup so that we can later restore to the state the subscription
      //   should be in.
      // - stale=false: This subscription was restored to the same value as
      //   `snapshot`. That means this subscription does *not* have changes relative
      //   to its base, so the current `snapshot` is valid to use as a backup.
      if (!subscription.stale) {
        subscription.backup = subscription.snapshot;
        return;
      }
      const snapshot = subscription.snapshot;
      const backup = RelayReader.read(
        source,
        snapshot.selector,
        this.__log,
        this._resolverCache,
        this._resolverContext,
      );
      const nextData = recycleNodesInto(snapshot.data, backup.data);
      (backup as $FlowFixMe).data = nextData; // backup owns the snapshot and can safely mutate
      subscription.backup = backup;
    });
  }

  restoreSubscriptions() {
    this._subscriptions.forEach(subscription => {
      const backup = subscription.backup;
      subscription.backup = null;
      if (backup) {
        if (backup.data !== subscription.snapshot.data) {
          // This subscription's data changed in the optimistic state. We will
          // need to re-read.
          subscription.stale = true;
          if (RelayFeatureFlags.OPTIMIZE_NOTIFY) {
            this._staleSubscriptions.add(subscription);
          }
        }
        subscription.snapshot = {
          data: subscription.snapshot.data,
          fieldErrors: backup.fieldErrors,
          isMissingData: backup.isMissingData,
          missingClientEdges: backup.missingClientEdges,
          missingLiveResolverFields: backup.missingLiveResolverFields,
          seenRecords: backup.seenRecords,
          selector: backup.selector,
        };
      } else {
        // This subscription was created during the optimisitic state. We should
        // re-read.
        subscription.stale = true;
        if (RelayFeatureFlags.OPTIMIZE_NOTIFY) {
          this._staleSubscriptions.add(subscription);
        }
      }
    });
  }

  updateSubscriptions(
    source: RecordSource,
    updatedRecordIDs: DataIDSet,
    updatedOwners: Array<RequestDescriptor>,
    sourceOperation?: OperationDescriptor,
  ) {
    const hasUpdatedRecords = updatedRecordIDs.size !== 0;
    this._subscriptions.forEach(subscription => {
      const owner = this._updateSubscription(
        source,
        subscription,
        updatedRecordIDs,
        hasUpdatedRecords,
        sourceOperation,
      );
      if (owner != null) {
        updatedOwners.push(owner);
      }
    });
  }

  updateStaleSubscriptions(
    source: RecordSource,
    updatedRecordIDs: DataIDSet,
    updatedOwners: Array<RequestDescriptor>,
    sourceOperation?: OperationDescriptor,
  ) {
    const hasUpdatedRecords = updatedRecordIDs.size !== 0;
    this._staleSubscriptions.forEach(subscription => {
      const owner = this._updateSubscription(
        source,
        subscription,
        updatedRecordIDs,
        hasUpdatedRecords,
        sourceOperation,
      );
      if (owner != null) {
        updatedOwners.push(owner);
      }
    });
  }

  /**
   * Notifies the callback for the subscription if the data for the associated
   * snapshot has changed.
   * Additionally, updates the subscription snapshot with the latest snapshot,
   * and marks it as not stale.
   * Returns the owner (RequestDescriptor) if the subscription was affected by the
   * latest update, or null if it was not affected.
   */
  _updateSubscription(
    source: RecordSource,
    subscription: Subscription,
    updatedRecordIDs: DataIDSet,
    hasUpdatedRecords: boolean,
    sourceOperation?: OperationDescriptor,
  ): ?RequestDescriptor {
    const {backup, callback, snapshot, stale} = subscription;
    const hasOverlappingUpdates =
      hasUpdatedRecords &&
      this._hasOverlappingIDs(snapshot.seenRecords, updatedRecordIDs);
    if (!stale && !hasOverlappingUpdates) {
      return;
    }
    let nextSnapshot: Snapshot =
      hasOverlappingUpdates || !backup
        ? RelayReader.read(
            source,
            snapshot.selector,
            this.__log,
            this._resolverCache,
            this._resolverContext,
          )
        : backup;
    const nextData = recycleNodesInto(snapshot.data, nextSnapshot.data);
    nextSnapshot = {
      data: nextData,
      fieldErrors: nextSnapshot.fieldErrors,
      isMissingData: nextSnapshot.isMissingData,
      missingClientEdges: nextSnapshot.missingClientEdges,
      missingLiveResolverFields: nextSnapshot.missingLiveResolverFields,
      seenRecords: nextSnapshot.seenRecords,
      selector: nextSnapshot.selector,
    } as Snapshot;
    if (__DEV__) {
      deepFreeze(nextSnapshot);
    }
    subscription.snapshot = nextSnapshot;
    subscription.stale = false;
    if (RelayFeatureFlags.OPTIMIZE_NOTIFY && stale) {
      this._staleSubscriptions.delete(subscription);
    }
    if (nextSnapshot.data !== snapshot.data) {
      if (this.__log && RelayFeatureFlags.ENABLE_NOTIFY_SUBSCRIPTION) {
        this.__log({
          name: 'store.notify.subscription',
          nextSnapshot,
          snapshot,
          sourceOperation,
        });
      }
      callback(nextSnapshot);
      return snapshot.selector.owner;
    }
    // While there were some overlapping IDs that affected this subscription,
    // none of the read fields were actually affected.
    if (
      RelayFeatureFlags.ENABLE_LOOSE_SUBSCRIPTION_ATTRIBUTION &&
      (stale ||
        hasSignificantOverlappingIDs(snapshot.seenRecords, updatedRecordIDs))
    ) {
      // With loose attribution enabled, we'll attribute this anyway.
      return snapshot.selector.owner;
    }
  }

  size(): number {
    return this._subscriptions.size;
  }
}

module.exports = RelayStoreSubscriptions;
