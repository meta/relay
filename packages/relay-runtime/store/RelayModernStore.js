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

import type {ActorIdentifier} from '../multi-actor-environment/ActorIdentifier';
import type {DataID, Disposable} from '../util/RelayRuntimeTypes';
import type {Availability} from './DataChecker';
import type {UpdatedRecords} from './live-resolvers/LiveResolverCache';
import type {GetDataID} from './RelayResponseNormalizer';
import type {NormalizationOptions} from './RelayResponseNormalizer';
import type {
  CheckOptions,
  DataIDSet,
  LogFunction,
  MutableRecordSource,
  OperationAvailability,
  OperationDescriptor,
  OperationLoader,
  RecordSource,
  RequestDescriptor,
  ResolverContext,
  Scheduler,
  SingularReaderSelector,
  Snapshot,
  Store,
  StoreSubscriptions,
} from './RelayStoreTypes';

const {
  INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
  assertInternalActorIdentifier,
} = require('../multi-actor-environment/ActorIdentifier');
const deepFreeze = require('../util/deepFreeze');
const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const resolveImmediate = require('../util/resolveImmediate');
const DataChecker = require('./DataChecker');
const defaultGetDataID = require('./defaultGetDataID');
const {
  LiveResolverCache,
  RELAY_RESOLVER_LIVE_STATE_SUBSCRIPTION_KEY,
  getUpdatedDataIDs,
} = require('./live-resolvers/LiveResolverCache');
const RelayModernRecord = require('./RelayModernRecord');
const RelayOptimisticRecordSource = require('./RelayOptimisticRecordSource');
const RelayReader = require('./RelayReader');
const RelayReferenceMarker = require('./RelayReferenceMarker');
const RelayStoreSubscriptions = require('./RelayStoreSubscriptions');
const RelayStoreUtils = require('./RelayStoreUtils');
const {
  FIELD_GRANULAR_NOTIFICATIONS_KEY,
  ROOT_ID,
  ROOT_TYPE,
  getFieldNotificationKey,
} = require('./RelayStoreUtils');
const invariant = require('invariant');

export opaque type InvalidationState = {
  dataIDs: ReadonlyArray<DataID>,
  invalidations: Map<DataID, ?number>,
};

type InvalidationSubscription = {
  callback: () => void,
  invalidationState: InvalidationState,
};

type Batch = {
  sourceOperations: Array<OperationDescriptor>,
  invalidateStore: boolean,
};

const DEFAULT_RELEASE_BUFFER_SIZE = 10;

/**
 * @public
 *
 * An implementation of the `Store` interface defined in `RelayStoreTypes`.
 *
 * Note that a Store takes ownership of all records provided to it: other
 * objects may continue to hold a reference to such records but may not mutate
 * them. The static Relay core is architected to avoid mutating records that may have been
 * passed to a store: operations that mutate records will either create fresh
 * records or clone existing records and modify the clones. Record immutability
 * is also enforced in development mode by freezing all records passed to a store.
 */
class RelayModernStore implements Store {
  _currentWriteEpoch: number;
  _gcHoldCounter: number;
  _gcReleaseBufferSize: number;
  _gcRun: ?Generator<void, void, void>;
  _gcScheduler: Scheduler;
  _getDataID: GetDataID;
  _globalInvalidationEpoch: ?number;
  // True if an operation is stamped at an epoch the clock has not reached yet,
  // so the next `notify()` must increment. See `publishWithDeferredNotify`.
  _hasPendingSourceOperation: boolean;
  _invalidationSubscriptions: Set<InvalidationSubscription>;
  _invalidatedRecordIDs: DataIDSet;
  __log: ?LogFunction;
  _queryCacheExpirationTime: ?number;
  _operationLoader: ?OperationLoader;
  _optimisticSource: ?MutableRecordSource;
  _recordSource: MutableRecordSource;
  _resolverCache: LiveResolverCache;
  _releaseBuffer: Array<string>;
  _roots: Map<
    string,
    {
      operation: OperationDescriptor,
      refCount: number,
      epoch: ?number,
      fetchTime: ?number,
    },
  >;
  _shouldRetainWithinTTL_EXPERIMENTAL: boolean;
  _shouldScheduleGC: boolean;
  _shouldScheduleGCAfterPublish: ?() => boolean;
  _storeSubscriptions: StoreSubscriptions;
  _updatedRecordIDs: DataIDSet;
  _resolverContext: ?ResolverContext;
  _actorIdentifier: ?ActorIdentifier;
  _treatMissingFieldsAsNull: boolean;
  _deferDeduplicatedFields: boolean;
  _batch: Batch | null;

  constructor(
    source: MutableRecordSource,
    options?: {
      gcScheduler?: ?Scheduler,
      log?: ?LogFunction,
      operationLoader?: ?OperationLoader,
      getDataID?: ?GetDataID,
      gcReleaseBufferSize?: ?number,
      queryCacheExpirationTime?: ?number,
      resolverContext?: ResolverContext,

      // Experimental
      shouldRetainWithinTTL_EXPERIMENTAL?: boolean,
      // Called after each publish(); returning true schedules a GC, in
      // addition to the release-buffer trigger.
      shouldScheduleGCAfterPublish_EXPERIMENTAL?: ?() => boolean,

      // These additional config options are only used if the experimental
      // @outputType resolver feature is used
      treatMissingFieldsAsNull?: ?boolean,
      deferDeduplicatedFields?: ?boolean,
      actorIdentifier?: ?ActorIdentifier,
    },
  ) {
    // Prevent mutation of a record from outside the store.
    if (__DEV__) {
      const storeIDs = source.getRecordIDs();
      for (let ii = 0; ii < storeIDs.length; ii++) {
        const record = source.get(storeIDs[ii]);
        if (record) {
          RelayModernRecord.freeze(record);
        }
      }
    }
    this._currentWriteEpoch = 0;
    this._gcHoldCounter = 0;
    this._gcReleaseBufferSize =
      options?.gcReleaseBufferSize ?? DEFAULT_RELEASE_BUFFER_SIZE;
    this._shouldRetainWithinTTL_EXPERIMENTAL =
      options?.shouldRetainWithinTTL_EXPERIMENTAL ?? false;
    this._gcRun = null;
    this._gcScheduler = options?.gcScheduler ?? resolveImmediate;
    this._getDataID = options?.getDataID ?? defaultGetDataID;
    this._globalInvalidationEpoch = null;
    this._hasPendingSourceOperation = false;
    this._invalidationSubscriptions = new Set();
    this._invalidatedRecordIDs = new Set();
    this.__log = options?.log ?? null;
    this._queryCacheExpirationTime = options?.queryCacheExpirationTime;
    this._operationLoader = options?.operationLoader ?? null;
    this._optimisticSource = null;
    this._recordSource = source;
    this._releaseBuffer = [];
    this._roots = new Map();
    this._shouldScheduleGC = false;
    this._shouldScheduleGCAfterPublish =
      options?.shouldScheduleGCAfterPublish_EXPERIMENTAL ?? null;
    this._resolverCache = new LiveResolverCache(
      () => this._getMutableRecordSource(),
      this,
    );
    this._resolverContext = options?.resolverContext;
    this._storeSubscriptions = new RelayStoreSubscriptions(
      options?.log,
      this._resolverCache,
      this._resolverContext,
    );
    this._updatedRecordIDs = new Set();
    this._treatMissingFieldsAsNull = options?.treatMissingFieldsAsNull ?? false;
    this._deferDeduplicatedFields = options?.deferDeduplicatedFields ?? false;
    this._actorIdentifier = options?.actorIdentifier;
    this._batch = null;

    initializeRecordSource(this._recordSource);
  }

  getSource(): RecordSource {
    return this._optimisticSource ?? this._recordSource;
  }

  getOperationLoader(): ?OperationLoader {
    return this._operationLoader;
  }

  _getMutableRecordSource(): MutableRecordSource {
    return this._optimisticSource ?? this._recordSource;
  }

  getLiveResolverPromise(recordID: DataID): Promise<void> {
    return this._resolverCache.getLiveResolverPromise(recordID);
  }

  /**
   * When an external data provider knows it's going to notify us about multiple
   * Live Resolver state updates in a single tick, it can batch them into a
   * single Relay update by notifying us within a batch. All updates received by
   * Relay during the evaluation of the provided `callback` will be aggregated
   * into a single Relay update.
   *
   * A typical use with a Flux store might look like this:
   *
   * const originalDispatch = fluxStore.dispatch;
   *
   * function wrapped(action) {
   *   relayStore.batchLiveStateUpdates(() => {
   *     originalDispatch(action);
   *   })
   * }
   *
   * fluxStore.dispatch = wrapped;
   */
  batchLiveStateUpdates(callback: () => void) {
    if (this.__log != null) {
      this.__log({name: 'liveresolver.batch.start'});
    }
    try {
      this._resolverCache.batchLiveStateUpdates(callback);
    } finally {
      if (this.__log != null) {
        this.__log({name: 'liveresolver.batch.end'});
      }
    }
  }

  /**
   * Batch multiple store updates into a single notification pass.
   *
   * Fragments will still correctly Suspend on their own parent query during
   * a batch. However, cross-operation Suspense (a fragment suspending on a
   * *different* in-flight operation) may not work correctly for operations
   * that complete during the batch.
   */
  experimental_batchUpdates(callback: () => void): void {
    if (this._batch != null) {
      throw new Error(
        'RelayModernStore: Cannot batch updates while already batching updates.',
      );
    }
    const log = this.__log;
    if (log != null) {
      log({name: 'store.batch.start'});
    }
    const batch: Batch = {sourceOperations: [], invalidateStore: false};
    this._batch = batch;
    try {
      callback();
    } finally {
      this._batch = null;
      this.notify(undefined, batch.invalidateStore);
      for (const sourceOperation of batch.sourceOperations) {
        this._recordSourceOperation(
          sourceOperation,
          this._currentWriteEpoch,
          false,
        );
      }
      if (log != null) {
        log({
          name: 'store.batch.complete',
          sourceOperations: batch.sourceOperations,
          invalidateStore: batch.invalidateStore,
        });
      }
    }
  }

  batchLiveStateUpdatesWithoutNotify(callback: () => void): boolean {
    if (this.__log != null) {
      this.__log({name: 'liveresolver.batch.start'});
    }
    let hasPublished = false;
    try {
      hasPublished =
        this._resolverCache.batchLiveStateUpdatesWithoutNotify(callback);
    } finally {
      if (this.__log != null) {
        this.__log({name: 'liveresolver.batch.end'});
      }
    }
    return hasPublished;
  }

  check(
    operation: OperationDescriptor,
    options?: CheckOptions,
  ): OperationAvailability {
    const selector = operation.root;
    const source = this._getMutableRecordSource();
    const globalInvalidationEpoch = this._globalInvalidationEpoch;
    const useExecTimeResolvers =
      operation.request.node.operation.use_exec_time_resolvers ??
      operation.request.node.operation.exec_time_resolvers_enabled_provider?.get() ===
        true ??
      false;

    const rootEntry = this._roots.get(operation.request.identifier);
    const operationLastWrittenAt = rootEntry != null ? rootEntry.epoch : null;

    // Check if store has been globally invalidated
    if (globalInvalidationEpoch != null) {
      // If so, check if the operation we're checking was last written
      // before or after invalidation occurred.
      if (
        operationLastWrittenAt == null ||
        operationLastWrittenAt <= globalInvalidationEpoch
      ) {
        // If the operation was written /before/ global invalidation occurred,
        // or if this operation has never been written to the store before,
        // we will consider the data for this operation to be stale
        // (i.e. not resolvable from the store).
        return {status: 'stale'};
      }
    }

    const handlers = options?.handlers ?? [];
    const getSourceForActor =
      options?.getSourceForActor ??
      (actorIdentifier => {
        assertInternalActorIdentifier(actorIdentifier);
        return source;
      });
    const getTargetForActor =
      options?.getTargetForActor ??
      (actorIdentifier => {
        assertInternalActorIdentifier(actorIdentifier);
        return source;
      });

    const operationAvailability = DataChecker.check(
      getSourceForActor,
      getTargetForActor,
      options?.defaultActorIdentifier ?? INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      selector,
      handlers,
      this._operationLoader,
      this._getDataID,
      this.__log,
      useExecTimeResolvers,
    );

    return getAvailabilityStatus(
      operationAvailability,
      operationLastWrittenAt,
      rootEntry?.fetchTime,
      this._queryCacheExpirationTime,
    );
  }

  retain(operation: OperationDescriptor): Disposable {
    const id = operation.request.identifier;
    let disposed = false;
    const dispose = () => {
      // Ensure each retain can only dispose once
      if (disposed) {
        return;
      }
      disposed = true;
      // For Flow: guard against the entry somehow not existing
      const rootEntry = this._roots.get(id);
      if (rootEntry == null) {
        return;
      }
      // Decrement the ref count: if it becomes zero it is eligible
      // for release.
      rootEntry.refCount--;

      if (rootEntry.refCount === 0) {
        const {_queryCacheExpirationTime} = this;
        const rootEntryIsStale =
          rootEntry.fetchTime != null &&
          _queryCacheExpirationTime != null &&
          rootEntry.fetchTime <= Date.now() - _queryCacheExpirationTime;

        if (rootEntryIsStale) {
          if (!this._shouldRetainWithinTTL_EXPERIMENTAL) {
            this._roots.delete(id);
          }
          this.scheduleGC();
        } else {
          this._pushToReleaseBuffer(id);
        }
      }
    };

    const rootEntry = this._roots.get(id);
    if (rootEntry != null) {
      if (rootEntry.refCount === 0) {
        // This entry should be in the release buffer, but it no longer belongs
        // there since it's retained. Remove it to maintain the invariant that
        // all release buffer entries have a refCount of 0.
        this._releaseBuffer = this._releaseBuffer.filter(_id => _id !== id);
        if (this._shouldRetainWithinTTL_EXPERIMENTAL && this._gcRun != null) {
          // GC may have skipped this unretained root. Reinsert the same entry
          // so the live Map iterator revisits it without losing fetch metadata.
          this._roots.delete(id);
          this._roots.set(id, rootEntry);
        }
      }
      // If we've previously retained this operation, increment the refCount
      rootEntry.refCount += 1;
    } else {
      // Otherwise create a new entry for the operation
      this._roots.set(id, {
        operation,
        refCount: 1,
        epoch: null,
        fetchTime: null,
      });
    }

    return {dispose};
  }

  lookup(selector: SingularReaderSelector): Snapshot {
    const log = this.__log;
    if (log != null) {
      log({
        name: 'store.lookup.start',
        selector,
      });
    }
    const source = this.getSource();
    const snapshot = RelayReader.read(
      source,
      selector,
      log,
      this._resolverCache,
      this._resolverContext,
    );
    if (__DEV__) {
      deepFreeze(snapshot);
    }
    if (log != null) {
      log({
        name: 'store.lookup.end',
        selector,
      });
    }
    return snapshot;
  }

  // This method will return a list of updated owners from the subscriptions
  notify(
    sourceOperation?: OperationDescriptor,
    invalidateStore?: boolean,
  ): ReadonlyArray<RequestDescriptor> {
    // If we're inside a batchUpdates() call, defer notification.
    const batch = this._batch;
    if (batch != null) {
      if (sourceOperation != null) {
        batch.sourceOperations.push(sourceOperation);
      }
      if (invalidateStore === true) {
        batch.invalidateStore = true;
      }
      // Returning [] here means the OperationExecutor's _updateOperationTracker
      // will be a no-op for this call, since it relies on notify() returning
      // the list of affected owners. See the experimental_batchUpdates JSDoc.
      return [];
    }

    const log = this.__log;
    if (log != null) {
      log({
        name: 'store.notify.start',
        sourceOperation,
      });
    }

    if (!RelayFeatureFlags.OPTIMIZE_NOTIFY) {
      // Increment the current write when notifying after executing
      // a set of changes to the store.
      this._currentWriteEpoch++;

      if (invalidateStore === true) {
        this._globalInvalidationEpoch = this._currentWriteEpoch;
      }
    }

    // When a record is updated, we need to also handle records that depend on it,
    // specifically Relay Resolver result records containing results based on the
    // updated records. This both adds to updatedRecordIDs and invalidates any
    // cached data as needed.
    if (!RelayFeatureFlags.OPTIMIZE_NOTIFY || this._updatedRecordIDs.size > 0) {
      this._resolverCache.invalidateDataIDs(this._updatedRecordIDs);
    }

    const source = this.getSource();
    const updatedOwners: Array<RequestDescriptor> = [];
    if (!RelayFeatureFlags.OPTIMIZE_NOTIFY || this._updatedRecordIDs.size > 0) {
      this._storeSubscriptions.updateSubscriptions(
        source,
        this._updatedRecordIDs,
        updatedOwners,
        sourceOperation,
      );
    } else {
      // If no record is updated, we still need to traverse stale subscriptions for
      // subscriptions that were using values from optimistic updates
      this._storeSubscriptions.updateStaleSubscriptions(
        source,
        this._updatedRecordIDs,
        updatedOwners,
        sourceOperation,
      );
    }

    if (
      RelayFeatureFlags.OPTIMIZE_NOTIFY &&
      (this._updatedRecordIDs.size > 0 ||
        updatedOwners.length > 0 ||
        this._invalidatedRecordIDs.size > 0 ||
        invalidateStore === true ||
        // An operation is already stamped at the epoch this notify produces,
        // so skipping the increment would leave it above the clock.
        this._hasPendingSourceOperation ||
        this._globalInvalidationEpoch === this._currentWriteEpoch)
    ) {
      // Increment the current write when notifying after executing
      // a set of changes to the store.
      this._currentWriteEpoch++;

      if (invalidateStore === true) {
        this._globalInvalidationEpoch = this._currentWriteEpoch;
      }
    }

    if (
      !RelayFeatureFlags.OPTIMIZE_NOTIFY ||
      this._invalidatedRecordIDs.size > 0 ||
      invalidateStore === true
    ) {
      this._invalidationSubscriptions.forEach(subscription => {
        this._updateInvalidationSubscription(
          subscription,
          invalidateStore === true,
        );
      });
    }

    if (sourceOperation != null) {
      this._recordSourceOperation(
        sourceOperation,
        this._currentWriteEpoch,
        false,
      );
    }

    if (log != null) {
      log({
        name: 'store.notify.complete',
        sourceOperation,
        updatedRecordIDs: this._updatedRecordIDs,
        invalidatedRecordIDs: this._invalidatedRecordIDs,
        subscriptionsSize: this._storeSubscriptions.size(),
        updatedOwners,
      });
    }

    this._updatedRecordIDs.clear();
    this._invalidatedRecordIDs.clear();
    this._hasPendingSourceOperation = false;

    return updatedOwners;
  }

  /**
   * Record that a source operation was written at the given epoch.
   * We only track the epoch at which the operation was written if
   * it was previously retained, to keep the size of our operation
   * epoch map bounded. If a query wasn't retained, we assume it can
   * be deleted at any moment and thus is not relevant for us to track
   * for the purposes of invalidation.
   *
   * `forceRootEntry` creates the entry even when the release buffer is full,
   * for a caller that needs the operation's records reachable from a root.
   */
  _recordSourceOperation(
    sourceOperation: OperationDescriptor,
    epoch: number,
    forceRootEntry: boolean,
  ): void {
    const id = sourceOperation.request.identifier;
    const rootEntry = this._roots.get(id);
    if (rootEntry != null) {
      rootEntry.epoch = epoch;
      rootEntry.fetchTime = Date.now();
    } else if (
      sourceOperation.request.node.params.operationKind === 'query' &&
      this._gcReleaseBufferSize > 0 &&
      (forceRootEntry || this._releaseBuffer.length < this._gcReleaseBufferSize)
    ) {
      // The operation isn't retained but there is space in the release buffer:
      // temporarily track this operation in case the data can be reused soon.
      const temporaryRootEntry = {
        operation: sourceOperation,
        refCount: 0,
        epoch,
        fetchTime: Date.now(),
      };
      /* $FlowFixMe[incompatible-type] Natural Inference rollout. See
       * https://fburl.com/gdoc/y8dn025u */
      this._roots.set(id, temporaryRootEntry);
      this._pushToReleaseBuffer(id);
    }
  }

  /**
   * Add a released (refCount 0) root to the release buffer, evicting the
   * least-recently-added entry and scheduling a GC if that puts the buffer
   * over its bound. The eviction deletes from `_roots` too: the buffer is the
   * only removal path for a refCount-0 root.
   */
  _pushToReleaseBuffer(id: DataID): void {
    this._releaseBuffer.push(id);
    if (this._releaseBuffer.length > this._gcReleaseBufferSize) {
      const evictedID = this._releaseBuffer.shift();
      if (evictedID != null && !this._shouldRetainWithinTTL_EXPERIMENTAL) {
        this._roots.delete(evictedID);
      }
      this.scheduleGC();
    }
  }

  publish(source: RecordSource, idsMarkedForInvalidation?: DataIDSet): void {
    const target = this._getMutableRecordSource();
    updateTargetFromSource(
      target,
      source,
      // We increment the current epoch at the end of the set of updates,
      // in notify(). Here, we pass what will be the incremented value of
      // the epoch to use to write to invalidated records.
      this._currentWriteEpoch + 1,
      idsMarkedForInvalidation,
      this._updatedRecordIDs,
      this._invalidatedRecordIDs,
    );
    // NOTE: log *after* processing the source so that even if a bad log function
    // mutates the source, it doesn't affect Relay processing of it.
    const log = this.__log;
    if (log != null) {
      log({
        name: 'store.publish',
        source,
        optimistic: target === this._optimisticSource,
      });
    }
    if (this._shouldScheduleGCAfterPublish?.() === true) {
      this.scheduleGC();
    }
  }

  publishWithDeferredNotify(
    source: RecordSource,
    sourceOperation: OperationDescriptor,
    idsMarkedForInvalidation?: DataIDSet,
  ): void {
    this.publish(source, idsMarkedForInvalidation);

    // Keeps that notify from skipping its increment and leaving the operation
    // stamped above the clock, which would outlive an invalidation.
    this._hasPendingSourceOperation = true;

    // `notify()` is what increments, so this data belongs to the next epoch —
    // the same prediction the `publish()` above made for `INVALIDATED_AT_KEY`.
    // The root entry is forced because it is also what keeps these records
    // reachable from a root until the notify; a GC before then would sweep them.
    this._recordSourceOperation(
      sourceOperation,
      this._currentWriteEpoch + 1,
      true,
    );
  }

  subscribe(
    snapshot: Snapshot,
    callback: (snapshot: Snapshot) => void,
  ): Disposable {
    return this._storeSubscriptions.subscribe(snapshot, callback);
  }

  holdGC(): Disposable {
    if (this._gcRun) {
      this._gcRun = null;
      this._shouldScheduleGC = true;
    }
    this._gcHoldCounter++;
    const dispose = () => {
      if (this._gcHoldCounter > 0) {
        this._gcHoldCounter--;
        if (this._gcHoldCounter === 0 && this._shouldScheduleGC) {
          this.scheduleGC();
          this._shouldScheduleGC = false;
        }
      }
    };
    return {dispose};
  }

  toJSON(): unknown {
    return 'RelayModernStore()';
  }

  getEpoch(): number {
    return this._currentWriteEpoch;
  }

  // Internal API
  __getUpdatedRecordIDs(): DataIDSet {
    return this._updatedRecordIDs;
  }

  lookupInvalidationState(dataIDs: ReadonlyArray<DataID>): InvalidationState {
    const invalidations = new Map<DataID, ?number>();
    dataIDs.forEach(dataID => {
      const record = this.getSource().get(dataID);
      invalidations.set(
        dataID,
        RelayModernRecord.getInvalidationEpoch(record) ?? null,
      );
    });
    invalidations.set('global', this._globalInvalidationEpoch);
    return {
      dataIDs,
      invalidations,
    };
  }

  checkInvalidationState(prevInvalidationState: InvalidationState): boolean {
    const latestInvalidationState = this.lookupInvalidationState(
      prevInvalidationState.dataIDs,
    );
    const currentInvalidations = latestInvalidationState.invalidations;
    const prevInvalidations = prevInvalidationState.invalidations;

    // Check if global invalidation has changed
    if (
      currentInvalidations.get('global') !== prevInvalidations.get('global')
    ) {
      return true;
    }

    // Check if the invalidation state for any of the ids has changed.
    for (const dataID of prevInvalidationState.dataIDs) {
      if (currentInvalidations.get(dataID) !== prevInvalidations.get(dataID)) {
        return true;
      }
    }

    return false;
  }

  subscribeToInvalidationState(
    invalidationState: InvalidationState,
    callback: () => void,
  ): Disposable {
    const subscription = {callback, invalidationState};
    const dispose = () => {
      this._invalidationSubscriptions.delete(subscription);
    };
    this._invalidationSubscriptions.add(subscription);
    return {dispose};
  }

  _updateInvalidationSubscription(
    subscription: InvalidationSubscription,
    invalidatedStore: boolean,
  ) {
    const {callback, invalidationState} = subscription;
    const {dataIDs} = invalidationState;
    const isSubscribedToInvalidatedIDs =
      invalidatedStore ||
      dataIDs.some(dataID => this._invalidatedRecordIDs.has(dataID));
    if (!isSubscribedToInvalidatedIDs) {
      return;
    }
    callback();
  }

  snapshot(): void {
    invariant(
      this._optimisticSource == null,
      'RelayModernStore: Unexpected call to snapshot() while a previous ' +
        'snapshot exists.',
    );
    const log = this.__log;
    if (log != null) {
      log({
        name: 'store.snapshot',
      });
    }
    this._storeSubscriptions.snapshotSubscriptions(this.getSource());
    if (this._gcRun) {
      this._gcRun = null;
      this._shouldScheduleGC = true;
    }
    this._optimisticSource = RelayOptimisticRecordSource.create(
      this.getSource(),
    );
  }

  restore(): void {
    const optimisticSource = this._optimisticSource;
    invariant(
      optimisticSource,
      'RelayModernStore: Unexpected call to restore(), expected a snapshot ' +
        'to exist (make sure to call snapshot()).',
    );
    const log = this.__log;
    if (log != null) {
      log({
        name: 'store.restore',
      });
    }
    const optimisticIDs =
      RelayOptimisticRecordSource.getOptimisticRecordIDs(optimisticSource);

    // Clean up any LiveResolver subscriptions made while in the optimistic
    // state.
    this._resolverCache.unsubscribeFromLiveResolverRecords(optimisticIDs);
    this._optimisticSource = null;
    if (this._shouldScheduleGC) {
      this.scheduleGC();
    }
    this._storeSubscriptions.restoreSubscriptions();
    this._resolverCache.invalidateResolverRecords(optimisticIDs);
  }

  scheduleGC() {
    if (this._gcHoldCounter > 0) {
      this._shouldScheduleGC = true;
      return;
    }
    if (this._gcRun) {
      return;
    }
    this._gcRun = this._collect();
    this._gcScheduler(this._gcStep);
  }

  /**
   * Run a full GC synchronously.
   */
  __gc(): void {
    // Don't run GC while there are optimistic updates applied
    if (this._optimisticSource != null) {
      return;
    }
    const gcRun = this._collect();
    while (gcRun.next().done !== true) {}
  }

  _gcStep = () => {
    if (this._gcRun) {
      if (this._gcRun.next().done === true) {
        this._gcRun = null;
      } else {
        this._gcScheduler(this._gcStep);
      }
    }
  };

  *_collect(): Generator<void, void, void> {
    if (
      this._shouldRetainWithinTTL_EXPERIMENTAL &&
      this._queryCacheExpirationTime == null
    ) {
      // Null expiration time indicates infinite TTL, so we don't need to
      // run GC.
      return;
    }
    /* eslint-disable no-labels */
    const log = this.__log;
    top: while (true) {
      if (log != null) {
        log({
          name: 'store.gc.start',
        });
      }
      const startEpoch = this._currentWriteEpoch;
      const references = new Set<DataID>();

      for (const [
        dataID,
        {operation, refCount, fetchTime},
      ] of this._roots.entries()) {
        if (this._shouldRetainWithinTTL_EXPERIMENTAL) {
          // Do not mark records that should be garbage collected
          const {_queryCacheExpirationTime} = this;
          invariant(
            _queryCacheExpirationTime != null,
            'Query cache expiration time should be non-null if executing GC',
          );
          const recordHasExpired =
            fetchTime == null ||
            fetchTime <= Date.now() - _queryCacheExpirationTime;
          const recordShouldBeCollected =
            recordHasExpired &&
            refCount === 0 &&
            !this._releaseBuffer.includes(dataID);
          if (recordShouldBeCollected) {
            continue;
          }
        }

        // Mark all records that are traversable from a root that is still valid
        const selector = operation.root;
        const useExecTimeResolvers =
          operation.request.node.operation.use_exec_time_resolvers ??
          operation.request.node.operation.exec_time_resolvers_enabled_provider?.get() ===
            true ??
          false;
        RelayReferenceMarker.mark(
          this._recordSource,
          selector,
          references,
          this._operationLoader,
          useExecTimeResolvers,
        );
        // Yield for other work after each operation
        yield;

        // If the store was updated, restart
        if (startEpoch !== this._currentWriteEpoch) {
          if (log != null) {
            log({
              name: 'store.gc.interrupted',
            });
          }
          continue top;
        }
      }

      // NOTE: It may be tempting to use `this._recordSource.clear()`
      // when no references are found, but that would prevent calling
      // maybeResolverSubscription() on any records that have an active
      // resolver subscription. This would result in a memory leak.

      // Evict any unreferenced nodes
      const storeIDs = this._recordSource.getRecordIDs();
      for (let ii = 0; ii < storeIDs.length; ii++) {
        const dataID = storeIDs[ii];
        if (!references.has(dataID)) {
          const record = this._recordSource.get(dataID);
          if (record != null) {
            const maybeResolverSubscription = RelayModernRecord.getValue(
              record,
              RELAY_RESOLVER_LIVE_STATE_SUBSCRIPTION_KEY,
            );
            if (maybeResolverSubscription != null) {
              // $FlowFixMe[not-a-function] - this value if it is not null, it is a function
              maybeResolverSubscription();
            }
          }
          this._recordSource.remove(dataID);
          if (this._shouldRetainWithinTTL_EXPERIMENTAL) {
            // Note: A record that was never retained will not be in the roots map
            // but the following line should not throw
            this._roots.delete(dataID);
          }
        }
      }

      if (log != null) {
        log({
          name: 'store.gc.end',
          references,
        });
      }
      return;
    }
  }

  // Internal API for normalizing @outputType payloads in LiveResolverCache.
  __getNormalizationOptions(path: ReadonlyArray<string>): NormalizationOptions {
    return {
      path,
      getDataID: this._getDataID,
      log: this.__log,
      treatMissingFieldsAsNull: this._treatMissingFieldsAsNull,
      deferDeduplicatedFields: this._deferDeduplicatedFields,
      actorIdentifier: this._actorIdentifier,
    };
  }

  // Internal API that can be only invoked from the LiveResolverCache
  // to notify subscribers of `updatedRecords`.
  __notifyUpdatedSubscribers(updatedRecords: UpdatedRecords): void {
    const nextUpdatedRecordIDs = getUpdatedDataIDs(updatedRecords);
    const prevUpdatedRecordIDs = this._updatedRecordIDs;
    this._updatedRecordIDs = nextUpdatedRecordIDs;
    this.notify();
    this._updatedRecordIDs = prevUpdatedRecordIDs;
  }
}

function initializeRecordSource(target: MutableRecordSource) {
  if (!target.has(ROOT_ID)) {
    const rootRecord = RelayModernRecord.create(ROOT_ID, ROOT_TYPE);
    if (RelayFeatureFlags.ENABLE_FIELD_GRANULAR_NOTIFICATIONS) {
      RelayModernRecord.setValue(
        rootRecord,
        FIELD_GRANULAR_NOTIFICATIONS_KEY,
        true,
      );
    }
    target.set(ROOT_ID, rootRecord);
  }
}

/**
 * Updates the target with information from source, also updating a mapping of
 * which records in the target were changed as a result.
 * Additionally, will mark records as invalidated at the current write epoch
 * given the set of record ids marked as stale in this update.
 */
function updateTargetFromSource(
  target: MutableRecordSource,
  source: RecordSource,
  currentWriteEpoch: number,
  idsMarkedForInvalidation: ?DataIDSet,
  updatedRecordIDs: DataIDSet,
  invalidatedRecordIDs: DataIDSet,
): void {
  // First, update any records that were marked for invalidation.
  // For each provided dataID that was invalidated, we write the
  // INVALIDATED_AT_KEY on the record, indicating
  // the epoch at which the record was invalidated.
  if (idsMarkedForInvalidation) {
    idsMarkedForInvalidation.forEach(dataID => {
      const targetRecord = target.get(dataID);
      const sourceRecord = source.get(dataID);

      // If record was deleted during the update (and also invalidated),
      // we don't need to count it as an invalidated id
      if (sourceRecord === null) {
        return;
      }

      let nextRecord;
      if (targetRecord != null) {
        // If the target record exists, use it to set the epoch
        // at which it was invalidated. This record will be updated with
        // any changes from source in the section below
        // where we update the target records based on the source.
        nextRecord = RelayModernRecord.clone(targetRecord);
      } else {
        // If the target record doesn't exist, it means that a new record
        // in the source was created (and also invalidated), so we use that
        // record to set the epoch at which it was invalidated. This record
        // will be updated with any changes from source in the section below
        // where we update the target records based on the source.
        nextRecord =
          sourceRecord != null ? RelayModernRecord.clone(sourceRecord) : null;
      }
      if (!nextRecord) {
        return;
      }
      RelayModernRecord.setValue(
        nextRecord,
        RelayStoreUtils.INVALIDATED_AT_KEY,
        currentWriteEpoch,
      );
      invalidatedRecordIDs.add(dataID);
      target.set(dataID, nextRecord);
    });
  }

  // Update the target based on the changes present in source
  const dataIDs = source.getRecordIDs();
  for (let ii = 0; ii < dataIDs.length; ii++) {
    const dataID = dataIDs[ii];
    const sourceRecord = source.get(dataID);
    const targetRecord = target.get(dataID);

    // Prevent mutation of a record from outside the store.
    if (__DEV__) {
      if (sourceRecord) {
        RelayModernRecord.freeze(sourceRecord);
      }
    }
    if (sourceRecord && targetRecord) {
      const nextRecord = RelayModernRecord.update(targetRecord, sourceRecord);
      if (nextRecord !== targetRecord) {
        // Prevent mutation of a record from outside the store.
        if (__DEV__) {
          RelayModernRecord.freeze(nextRecord);
        }
        updatedRecordIDs.add(dataID);
        target.set(dataID, nextRecord);

        // Add per-field notification keys for field-granular records
        if (
          RelayModernRecord.getValue(
            nextRecord,
            FIELD_GRANULAR_NOTIFICATIONS_KEY,
          )
        ) {
          const fields = RelayModernRecord.getFields(nextRecord);
          for (let jj = 0; jj < fields.length; jj++) {
            const storageKey = fields[jj];
            // Skip internal metadata keys (all start with '__')
            if (storageKey.startsWith('__')) {
              continue;
            }
            if (
              RelayModernRecord.hasFieldChanged(
                targetRecord,
                nextRecord,
                storageKey,
              )
            ) {
              updatedRecordIDs.add(getFieldNotificationKey(dataID, storageKey));
            }
          }
        }
      }
    } else if (sourceRecord === null) {
      target.delete(dataID);
      if (targetRecord !== null) {
        updatedRecordIDs.add(dataID);
      }
    } else if (sourceRecord) {
      target.set(dataID, sourceRecord);
      updatedRecordIDs.add(dataID);
    } // don't add explicit undefined
  }
}

/**
 * Returns an OperationAvailability given the Availability returned
 * by checking an operation, and when that operation was last written to the store.
 * Specifically, the provided Availability of an operation will contain the
 * value of when a record referenced by the operation was most recently
 * invalidated; given that value, and given when this operation was last
 * written to the store, this function will return the overall
 * OperationAvailability for the operation.
 */
function getAvailabilityStatus(
  operationAvailability: Availability,
  operationLastWrittenAt: ?number,
  operationFetchTime: ?number,
  queryCacheExpirationTime: ?number,
): OperationAvailability {
  const {mostRecentlyInvalidatedAt, status} = operationAvailability;
  if (typeof mostRecentlyInvalidatedAt === 'number') {
    // If some record referenced by this operation is stale, then the operation itself is stale
    // if either the operation itself was never written *or* the operation was last written
    // before the most recent invalidation of its reachable records.
    if (
      operationLastWrittenAt == null ||
      mostRecentlyInvalidatedAt > operationLastWrittenAt
    ) {
      return {status: 'stale'};
    }
  }

  if (status === 'missing') {
    return {status: 'missing'};
  }

  if (operationFetchTime != null && queryCacheExpirationTime != null) {
    const isStale = operationFetchTime <= Date.now() - queryCacheExpirationTime;
    if (isStale) {
      return {status: 'stale'};
    }
  }

  // There were no invalidations of any reachable records *or* the operation is known to have
  // been fetched after the most recent record invalidation.
  return {status: 'available', fetchTime: operationFetchTime ?? null};
}

module.exports = RelayModernStore;
