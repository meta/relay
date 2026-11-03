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

import type {HandlerProvider} from '../handlers/RelayDefaultHandlerProvider';
import type {Disposable} from '../util/RelayRuntimeTypes';
import type {GetDataID} from './RelayResponseNormalizer';
import type {
  LogFunction,
  MissingFieldHandler,
  MutationParameters,
  OperationDescriptor,
  OptimisticUpdate,
  PublishQueue,
  RecordSource,
  RelayResponsePayload,
  RequestDescriptor,
  SelectorData,
  SelectorStoreUpdater,
  SingularReaderSelector,
  Store,
  StoreUpdater,
} from './RelayStoreTypes';

const RelayRecordSourceMutator = require('../mutations/RelayRecordSourceMutator');
const {
  createRelayRecordSourceProxy,
} = require('../mutations/RelayRecordSourceProxyOptimized');
const RelayRecordSourceSelectorProxy = require('../mutations/RelayRecordSourceSelectorProxy');
const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const RelayReader = require('./RelayReader');
const RelayRecordSource = require('./RelayRecordSource');
const invariant = require('invariant');
const warning = require('warning');

type PendingCommit<TMutation extends MutationParameters> =
  PendingRelayPayload<TMutation> | PendingRecordSource | PendingUpdater;
type PendingRelayPayload<TMutation extends MutationParameters> = {
  readonly kind: 'payload',
  readonly operation: OperationDescriptor,
  readonly payload: RelayResponsePayload,
  readonly updater: ?SelectorStoreUpdater<TMutation['response']>,
  // No `notify()` follows this commit in the same turn, so the publish has to
  // record the operation itself. See `publishWithDeferredNotify`.
  readonly deferNotify?: boolean,
};
type PendingRecordSource = {
  readonly kind: 'source',
  readonly source: RecordSource,
};
type PendingUpdater = {
  readonly kind: 'updater',
  readonly updater: StoreUpdater,
};

const _global: typeof global | $FlowFixMe =
  typeof global !== 'undefined'
    ? global
    : // $FlowFixMe[cannot-resolve-name]
      typeof window !== 'undefined'
      ? // $FlowFixMe[cannot-resolve-name]
        window
      : undefined;

const applyWithGuard =
  _global?.ErrorUtils?.applyWithGuard ??
  ((callback, context, args, onError, name) => callback.apply(context, args));

/**
 * Coordinates the concurrent modification of a `Store` due to optimistic and
 * non-revertable client updates and server payloads:
 * - Applies optimistic updates.
 * - Reverts optimistic updates, rebasing any subsequent updates.
 * - Commits client updates (typically for client schema extensions).
 * - Commits server updates:
 *   - Normalizes query/mutation/subscription responses.
 *   - Executes handlers for "handle" fields.
 *   - Reverts and reapplies pending optimistic updates.
 */
class RelayPublishQueue implements PublishQueue {
  _store: Store;
  _handlerProvider: ?HandlerProvider;
  _missingFieldHandlers: ReadonlyArray<MissingFieldHandler>;
  _getDataID: GetDataID;
  _log: ?LogFunction;

  _hasStoreSnapshot: boolean;
  // True if the next `run()` should apply the backup and rerun all optimistic
  // updates performing a rebase.
  _pendingBackupRebase: boolean;
  // A global invalidation raised by `_commitData()`, owed to the next
  // `notify()`.
  _pendingInvalidatedStore: boolean;
  // True if data was published without notifying, so the next `run()` must not
  // short-circuit as a noop and leave those subscribers untold.
  _pendingNotify: boolean;
  // Payloads to apply or Sources to publish to the store with the next `run()`.
  // $FlowFixMe[unclear-type] See explanation below.
  _pendingData: Set<PendingCommit<any>>;
  // Optimistic updaters to add with the next `run()`.
  // $FlowFixMe[unclear-type] See explanation below.
  _pendingOptimisticUpdates: Set<OptimisticUpdate<any>>;
  // Optimistic updaters that are already added and might be rerun in order to
  // rebase them.
  // $FlowFixMe[unclear-type] See explanation below.
  _appliedOptimisticUpdates: Set<OptimisticUpdate<any>>;
  // For _pendingOptimisticUpdates, _appliedOptimisticUpdates, and _pendingData,
  // we want to parametrize by "any" since the type is effectively
  // "the union of all T's that PublishQueue's methods were called with".

  // Garbage collection hold, should rerun gc on dispose
  _gcHold: ?Disposable;
  _isRunning: ?boolean;

  constructor(
    store: Store,
    handlerProvider?: ?HandlerProvider,
    getDataID: GetDataID,
    missingFieldHandlers: ReadonlyArray<MissingFieldHandler>,
    log: LogFunction,
  ) {
    this._hasStoreSnapshot = false;
    this._handlerProvider = handlerProvider || null;
    this._pendingBackupRebase = false;
    this._pendingInvalidatedStore = false;
    this._pendingNotify = false;
    this._pendingData = new Set();
    this._pendingOptimisticUpdates = new Set();
    this._store = store;
    this._appliedOptimisticUpdates = new Set();
    this._gcHold = null;
    this._getDataID = getDataID;
    this._missingFieldHandlers = missingFieldHandlers;
    this._log = log;
  }

  /**
   * Schedule applying an optimistic updates on the next `run()`.
   */
  applyUpdate<TMutation extends MutationParameters>(
    updater: OptimisticUpdate<TMutation>,
  ): void {
    invariant(
      !this._appliedOptimisticUpdates.has(updater) &&
        !this._pendingOptimisticUpdates.has(updater),
      'RelayPublishQueue: Cannot apply the same update function more than ' +
        'once concurrently.',
    );
    this._pendingOptimisticUpdates.add(updater);
  }

  /**
   * Schedule reverting an optimistic updates on the next `run()`.
   */
  revertUpdate<TMutation extends MutationParameters>(
    updater: OptimisticUpdate<TMutation>,
  ): void {
    if (this._pendingOptimisticUpdates.has(updater)) {
      // Reverted before it was applied
      this._pendingOptimisticUpdates.delete(updater);
    } else if (this._appliedOptimisticUpdates.has(updater)) {
      this._pendingBackupRebase = true;
      this._appliedOptimisticUpdates.delete(updater);
    }
  }

  /**
   * Schedule a revert of all optimistic updates on the next `run()`.
   */
  revertAll(): void {
    this._pendingBackupRebase = true;
    this._pendingOptimisticUpdates.clear();
    this._appliedOptimisticUpdates.clear();
  }

  /**
   * Schedule applying a payload to the store on the next `run()`.
   */
  commitPayload<TMutation extends MutationParameters>(
    operation: OperationDescriptor,
    payload: RelayResponsePayload,
    updater?: ?SelectorStoreUpdater<TMutation['response']>,
  ): void {
    this._pendingBackupRebase = true;
    this._pendingData.add({
      kind: 'payload',
      operation,
      payload,
      updater,
    });
  }

  /**
   * Schedule an updater to mutate the store on the next `run()` typically to
   * update client schema fields.
   */
  commitUpdate(updater: StoreUpdater): void {
    this._pendingBackupRebase = true;
    this._pendingData.add({
      kind: 'updater',
      updater,
    });
  }

  /**
   * Schedule a publish to the store from the provided source on the next
   * `run()`. As an example, to update the store with substituted fields that
   * are missing in the store.
   */
  commitSource(source: RecordSource): void {
    this._pendingBackupRebase = true;
    this._pendingData.add({kind: 'source', source});
  }

  /**
   * Publish a payload into the store replaying any pending optimistic updates
   * but without triggering a notification. Instead a continuation function is
   * returned which will trigger a notification if needed.
   *
   * **It is the responsibility of the caller to invoke the returned
   * continuation function before the next browser paint**.
   */
  publishWithDeferredNotify(
    operation: OperationDescriptor,
    payload: RelayResponsePayload,
  ): () => void {
    this._assertNotRunning();
    // `commitPayload`, but flagged so the publish routes to the store's
    // `publishWithDeferredNotify`.
    this._pendingBackupRebase = true;
    this._pendingData.add({
      kind: 'payload',
      operation,
      payload,
      updater: null,
      deferNotify: true,
    });
    this._isRunning = true;
    this._runWithoutNotifying();
    this._isRunning = false;
    this._pendingNotify = true;

    // Holds no state: flushes whatever notify is pending, so extra or stale
    // calls are free and two publishes in one render share one flush.
    return () => {
      // Already discharged, by an earlier call or by an unrelated `run()`.
      if (this._pendingNotify) {
        this.run();
      }
    };
  }

  /**
   * Execute all queued up operations from the other public methods.
   */
  run(sourceOperation?: OperationDescriptor): ReadonlyArray<RequestDescriptor> {
    const runWillClearGcHold =
      this._appliedOptimisticUpdates.size === 0 && !!this._gcHold;
    const runIsANoop =
      // this._pendingBackupRebase is true if an applied optimistic
      // update has potentially been reverted or if this._pendingData is not empty.
      !this._pendingBackupRebase &&
      this._pendingOptimisticUpdates.size === 0 &&
      // A non-notifying publish already committed its data, so none of the
      // above is pending — but its subscribers still have not been told.
      !this._pendingNotify &&
      !runWillClearGcHold;

    warning(
      !runIsANoop,
      'RelayPublishQueue.run was called, but the call would have been a noop.',
    );
    this._assertNotRunning();
    this._isRunning = true;

    if (runIsANoop) {
      this._isRunning = false;
      return [];
    }

    this._runWithoutNotifying();
    const invalidatedStore = this._pendingInvalidatedStore;
    this._pendingInvalidatedStore = false;
    this._pendingNotify = false;
    this._isRunning = false;
    // Any deferred publish this flush covers was stamped at publish time, so
    // this only has to record the caller's own operation, if it has one.
    return this._store.notify(sourceOperation, invalidatedStore);
  }

  /**
   * The store-mutating half of `run()`: restore the pre-optimistic base, commit
   * the pending data, then re-snapshot and rebase the applied optimistic
   * updates on top of it. Reaches no subscriber — only `notify()` does that.
   *
   * A global invalidation raised by a commit is left on
   * `_pendingInvalidatedStore` for the next `notify()`.
   */
  _runWithoutNotifying(): void {
    if (this._pendingBackupRebase) {
      if (this._hasStoreSnapshot) {
        this._store.restore();
        this._hasStoreSnapshot = false;
      }
    }
    if (this._commitData()) {
      this._pendingInvalidatedStore = true;
    }
    if (
      this._pendingOptimisticUpdates.size ||
      (this._pendingBackupRebase && this._appliedOptimisticUpdates.size)
    ) {
      if (!this._hasStoreSnapshot) {
        this._store.snapshot();
        this._hasStoreSnapshot = true;
      }
      this._applyUpdates();
    }
    this._pendingBackupRebase = false;
    if (this._appliedOptimisticUpdates.size > 0) {
      if (!this._gcHold) {
        this._gcHold = this._store.holdGC();
      }
    } else {
      if (this._gcHold) {
        this._gcHold.dispose();
        this._gcHold = null;
      }
    }
  }

  _assertNotRunning(): void {
    RelayFeatureFlags.DISALLOW_NESTED_UPDATES
      ? invariant(
          this._isRunning !== true,
          'A store update was detected within another store update. Please ' +
            "make sure new store updates aren't being executed within an " +
            'updater function for a different update.',
        )
      : warning(
          this._isRunning !== true,
          'A store update was detected within another store update. Please ' +
            "make sure new store updates aren't being executed within an " +
            'updater function for a different update.',
        );
  }

  /**
   * _publishSourceFromPayload will return a boolean indicating if the
   * publish caused the store to be globally invalidated.
   */
  _publishSourceFromPayload<TMutation extends MutationParameters>(
    pendingPayload: PendingRelayPayload<TMutation>,
  ): boolean {
    const {payload, operation, updater, deferNotify} = pendingPayload;
    const {source, fieldPayloads} = payload;
    const mutator = new RelayRecordSourceMutator(
      this._store.getSource(),
      source,
    );
    const recordSourceProxy = createRelayRecordSourceProxy(
      mutator,
      this._getDataID,
      this._handlerProvider,
      this._missingFieldHandlers,
      this._log,
    );
    if (fieldPayloads && fieldPayloads.length) {
      fieldPayloads.forEach(fieldPayload => {
        const handler =
          this._handlerProvider && this._handlerProvider(fieldPayload.handle);
        invariant(
          handler,
          'RelayModernEnvironment: Expected a handler to be provided for ' +
            'handle `%s`.',
          fieldPayload.handle,
        );
        handler.update(recordSourceProxy, fieldPayload);
      });
    }
    if (updater) {
      const selector = operation.fragment;
      invariant(
        selector != null,
        'RelayModernEnvironment: Expected a selector to be provided with updater function.',
      );
      const recordSourceSelectorProxy = new RelayRecordSourceSelectorProxy(
        mutator,
        recordSourceProxy,
        selector,
        this._missingFieldHandlers,
      );
      const selectorData = lookupSelector(source, selector);
      updater(recordSourceSelectorProxy, selectorData);
    }
    const idsMarkedForInvalidation =
      recordSourceProxy.getIDsMarkedForInvalidation();
    if (deferNotify === true) {
      this._store.publishWithDeferredNotify(
        source,
        operation,
        idsMarkedForInvalidation,
      );
    } else {
      this._store.publish(source, idsMarkedForInvalidation);
    }
    return recordSourceProxy.isStoreMarkedForInvalidation();
  }

  /**
   * _commitData will return a boolean indicating if any of
   * the pending commits caused the store to be globally invalidated.
   */
  _commitData(): boolean {
    if (!this._pendingData.size) {
      return false;
    }
    let invalidatedStore = false;
    this._pendingData.forEach(data => {
      if (data.kind === 'payload') {
        const payloadInvalidatedStore = this._publishSourceFromPayload(data);
        invalidatedStore = invalidatedStore || payloadInvalidatedStore;
      } else if (data.kind === 'source') {
        const source = data.source;
        this._store.publish(source);
      } else {
        const updater = data.updater;
        const sink = RelayRecordSource.create();
        const mutator = new RelayRecordSourceMutator(
          this._store.getSource(),
          sink,
        );
        const recordSourceProxy = createRelayRecordSourceProxy(
          mutator,
          this._getDataID,
          this._handlerProvider,
          this._missingFieldHandlers,
          this._log,
        );
        applyWithGuard(
          updater,
          null,
          [recordSourceProxy],
          null,
          'RelayPublishQueue:commitData',
        );
        invalidatedStore =
          invalidatedStore || recordSourceProxy.isStoreMarkedForInvalidation();
        const idsMarkedForInvalidation =
          recordSourceProxy.getIDsMarkedForInvalidation();

        this._store.publish(sink, idsMarkedForInvalidation);
      }
    });
    this._pendingData.clear();
    return invalidatedStore;
  }

  /**
   * Note that unlike _commitData, _applyUpdates will NOT return a boolean
   * indicating if the store was globally invalidated, since invalidating the
   * store during an optimistic update is a no-op.
   */
  _applyUpdates(): void {
    const sink = RelayRecordSource.create();
    const mutator = new RelayRecordSourceMutator(this._store.getSource(), sink);
    const recordSourceProxy = createRelayRecordSourceProxy(
      mutator,
      this._getDataID,
      this._handlerProvider,
      this._missingFieldHandlers,
      this._log,
    );

    // $FlowFixMe[unclear-type] see explanation above.
    const processUpdate = (optimisticUpdate: OptimisticUpdate<any>) => {
      if (optimisticUpdate.storeUpdater) {
        const {storeUpdater} = optimisticUpdate;
        applyWithGuard(
          storeUpdater,
          null,
          [recordSourceProxy],
          null,
          'RelayPublishQueue:applyUpdates',
        );
      } else {
        const {operation, payload, updater} = optimisticUpdate;
        const {source, fieldPayloads} = payload;
        if (source) {
          recordSourceProxy.publishSource(source, fieldPayloads);
        }
        if (updater) {
          let selectorData;
          if (source) {
            selectorData = lookupSelector(source, operation.fragment);
          }
          const recordSourceSelectorProxy = new RelayRecordSourceSelectorProxy(
            mutator,
            recordSourceProxy,
            operation.fragment,
            this._missingFieldHandlers,
          );
          applyWithGuard(
            updater,
            null,
            [recordSourceSelectorProxy, selectorData],
            null,
            'RelayPublishQueue:applyUpdates',
          );
        }
      }
    };

    // rerun all updaters in case we are running a rebase
    if (this._pendingBackupRebase && this._appliedOptimisticUpdates.size) {
      this._appliedOptimisticUpdates.forEach(processUpdate);
    }

    // apply any new updaters
    if (this._pendingOptimisticUpdates.size) {
      this._pendingOptimisticUpdates.forEach(optimisticUpdate => {
        processUpdate(optimisticUpdate);
        this._appliedOptimisticUpdates.add(optimisticUpdate);
      });
      this._pendingOptimisticUpdates.clear();
    }

    this._store.publish(sink);
  }
}

function lookupSelector(
  source: RecordSource,
  selector: SingularReaderSelector,
): ?SelectorData {
  const selectorData = RelayReader.read(
    source,
    selector,
    // The reader here is used to read the selector data for the updater.
    // It is normal to not use all data in the update, so we don't pass
    // the logger to skip tracking usages.
    null,
    undefined,
    undefined,
  ).data;
  if (__DEV__) {
    const deepFreeze = require('../util/deepFreeze');
    if (selectorData) {
      deepFreeze(selectorData);
    }
  }
  return selectorData;
}

module.exports = RelayPublishQueue;
