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

import type {
  CacheConfig,
  Disposable,
  IEnvironment,
  Observable,
  OperationDescriptor,
  Snapshot,
} from 'relay-runtime';

const invariant = require('invariant');
const {
  __internal: {fetchQuery},
  createOperationDescriptor,
  isRelayModernEnvironment,
} = require('relay-runtime');

type OnDataChange = (v: {error?: Error, snapshot?: Snapshot, ...}) => void;

/** The external API of 'fetch' **/
export type FetchOptions = {
  environment: IEnvironment,
  onDataChange?: null | OnDataChange,
  operation: OperationDescriptor,
};

// Internally we keep an array of onDataChange callbacks, to support reusing
// the queryRenderer for multiple components.
type FetchOptionsInternal = {
  environment: IEnvironment,
  onDataChangeCallbacks: Array<OnDataChange>,
  operation: OperationDescriptor,
};

export type ExecuteConfig = {
  environment: IEnvironment,
  operation: OperationDescriptor,
  // Allows pagination container to retain results from previous queries
  preservePreviousReferences?: boolean,
};

class ReactRelayQueryFetcher {
  _fetchOptions: ?FetchOptionsInternal;
  _pendingRequest: ?Disposable;
  _rootSubscription: ?Disposable;
  _selectionReferences: Array<Disposable> = [];
  _snapshot: ?Snapshot; // results of the root fragment;
  _error: ?Error; // fetch error
  _cacheSelectionReference: ?Disposable;
  _didFetchFinish: boolean = false;

  constructor(args?: {
    cacheSelectionReference: ?Disposable,
    selectionReferences: Array<Disposable>,
    ...
  }) {
    if (args != null) {
      this._cacheSelectionReference = args.cacheSelectionReference;
      this._selectionReferences = args.selectionReferences;
    }
  }

  getSelectionReferences(): {
    cacheSelectionReference: ?Disposable,
    selectionReferences: Array<Disposable>,
  } {
    return {
      cacheSelectionReference: this._cacheSelectionReference,
      selectionReferences: this._selectionReferences,
    };
  }

  lookupInStore(
    environment: IEnvironment,
    operation: OperationDescriptor,
    fetchPolicy: ?('store-and-network' | 'network-only' | 'store-or-network'),
  ): ?Snapshot {
    if (
      fetchPolicy === 'store-and-network' ||
      fetchPolicy === 'store-or-network'
    ) {
      if (environment.check(operation).status === 'available') {
        this._retainCachedOperation(environment, operation);
        return environment.lookup(operation.fragment);
      }
    }
    return null;
  }

  getFetchResult(): ?{error?: Error, snapshot?: Snapshot} {
    if (this._didFetchFinish) {
      // We don't reset '_didFetchFinish' because another callback may be set
      if (this._error != null) {
        return {error: this._error};
      } else if (this._snapshot != null) {
        return {snapshot: this._snapshot};
      }
    } else {
      return null;
    }
  }

  execute({
    environment,
    operation,
    preservePreviousReferences = false,
  }: ExecuteConfig): Observable<unknown> {
    const reference = environment.retain(operation);
    const error = () => {
      // We may have partially fulfilled the request, so let the next request
      // or the unmount dispose of the references.
      this._selectionReferences = this._selectionReferences.concat(reference);
    };
    const complete = () => {
      if (!preservePreviousReferences) {
        this.disposeSelectionReferences();
      }
      this._selectionReferences = this._selectionReferences.concat(reference);
    };
    const unsubscribe = () => {
      // Let the next request or the unmount code dispose of the references.
      // We may have partially fulfilled the request.
      this._selectionReferences = this._selectionReferences.concat(reference);
    };
    if (!isRelayModernEnvironment(environment)) {
      return environment.execute({operation}).do({
        error,
        complete,
        unsubscribe,
      });
    }
    return fetchQuery(environment, operation).do({
      error,
      complete,
      unsubscribe,
    });
  }

  setOnDataChange(onDataChange: OnDataChange): void {
    invariant(
      this._fetchOptions,
      'ReactRelayQueryFetcher: `setOnDataChange` should have been called after having called `fetch`',
    );

    if (typeof onDataChange === 'function') {
      // Mutate the most recent fetchOptions in place,
      // So that in-progress requests can access the updated callback.
      this._fetchOptions.onDataChangeCallbacks =
        this._fetchOptions.onDataChangeCallbacks || [];
      this._fetchOptions.onDataChangeCallbacks.push(onDataChange);

      if (this._didFetchFinish) {
        // We don't reset '_didFetchFinish' because another callback may be set
        if (this._error != null) {
          onDataChange({error: this._error});
        } else if (this._snapshot != null) {
          onDataChange({snapshot: this._snapshot});
        }
      }
    }
  }

  /**
   * `fetch` fetches the data for the given operation.
   * If a result is immediately available synchronously, it will be synchronously
   * returned by this function.
   *
   * Otherwise, the fetched result will be communicated via the `onDataChange` callback.
   * `onDataChange` will be called with the first result (**if it wasn't returned synchronously**),
   * and then subsequently whenever the data changes.
   */
  fetch(
    fetchOptions: FetchOptions,
    cacheConfigOverride?: CacheConfig,
  ): ?Snapshot {
    const {environment, operation, onDataChange} = fetchOptions;
    let fetchHasReturned = false;
    let error;

    this.disposeRequest();
    const oldOnDataChangeCallbacks =
      this._fetchOptions && this._fetchOptions.onDataChangeCallbacks;
    this._fetchOptions = {
      environment,
      onDataChangeCallbacks: oldOnDataChangeCallbacks || [],
      operation,
    };

    if (
      onDataChange &&
      this._fetchOptions.onDataChangeCallbacks.indexOf(onDataChange) === -1
    ) {
      // $FlowFixMe[incompatible-use]
      this._fetchOptions.onDataChangeCallbacks.push(onDataChange);
    }

    const operationOverride = cacheConfigOverride
      ? createOperationDescriptor(
          operation.request.node,
          operation.request.variables,
          cacheConfigOverride,
        )
      : operation;

    const request = this.execute({
      environment,
      operation: operationOverride,
    })
      .finally(() => {
        this._pendingRequest = null;
      })
      .subscribe({
        next: () => {
          // If we received a response,
          // Make a note that to notify the callback when it's later added.
          this._didFetchFinish = true;
          this._error = null;

          // Only notify of the first result if `next` is being called **asynchronously**
          // (i.e. after `fetch` has returned).
          this._onQueryDataAvailable({notifyFirstResult: fetchHasReturned});
        },
        error: err => {
          // If we received a response when we didn't have a change callback,
          // Make a note that to notify the callback when it's later added.
          this._didFetchFinish = true;
          this._error = err;
          this._snapshot = null;

          const onDataChangeCallbacks =
            this._fetchOptions && this._fetchOptions.onDataChangeCallbacks;

          // Only notify of error if `error` is being called **asynchronously**
          // (i.e. after `fetch` has returned).
          if (fetchHasReturned) {
            if (onDataChangeCallbacks) {
              onDataChangeCallbacks.forEach(onDataChange => {
                onDataChange({error: err});
              });
            }
          } else {
            error = err;
          }
        },
      });

    this._pendingRequest = {
      dispose() {
        request.unsubscribe();
      },
    };

    fetchHasReturned = true;

    if (error) {
      throw error;
    }

    return this._snapshot;
  }

  retry(cacheConfigOverride?: CacheConfig): ?Snapshot {
    invariant(
      this._fetchOptions,
      'ReactRelayQueryFetcher: `retry` should be called after having called `fetch`',
    );
    return this.fetch(
      {
        environment: this._fetchOptions.environment,
        operation: this._fetchOptions.operation,
        onDataChange: null, // If there are onDataChangeCallbacks they will be reused
      },
      cacheConfigOverride,
    );
  }

  dispose() {
    this.disposeRequest();
    this.disposeSelectionReferences();
  }

  disposeRequest() {
    this._error = null;
    this._snapshot = null;

    // order is important, dispose of pendingFetch before selectionReferences
    if (this._pendingRequest) {
      this._pendingRequest.dispose();
    }
    if (this._rootSubscription) {
      this._rootSubscription.dispose();
      this._rootSubscription = null;
    }
  }

  _retainCachedOperation(
    environment: IEnvironment,
    operation: OperationDescriptor,
  ) {
    this._disposeCacheSelectionReference();
    this._cacheSelectionReference = environment.retain(operation);
  }

  _disposeCacheSelectionReference() {
    this._cacheSelectionReference && this._cacheSelectionReference.dispose();
    this._cacheSelectionReference = null;
  }

  disposeSelectionReferences() {
    this._disposeCacheSelectionReference();
    this._selectionReferences.forEach(r => r.dispose());
    this._selectionReferences = [];
  }

  _onQueryDataAvailable({
    notifyFirstResult,
  }: {
    notifyFirstResult: boolean,
    ...
  }): void {
    invariant(
      this._fetchOptions,
      'ReactRelayQueryFetcher: `_onQueryDataAvailable` should have been called after having called `fetch`',
    );
    const {environment, onDataChangeCallbacks, operation} = this._fetchOptions;

    // `_onQueryDataAvailable` can be called synchronously the first time and can be called
    // multiple times by network layers that support data subscriptions.
    // Wait until the first payload to call `onDataChange` and subscribe for data updates.
    if (this._snapshot) {
      return;
    }

    this._snapshot = environment.lookup(operation.fragment);

    // Subscribe to changes in the data of the root fragment
    this._rootSubscription = environment.subscribe(this._snapshot, snapshot => {
      // Read from this._fetchOptions in case onDataChange() was lazily added.
      if (this._fetchOptions != null) {
        const maybeNewOnDataChangeCallbacks =
          this._fetchOptions.onDataChangeCallbacks;
        if (Array.isArray(maybeNewOnDataChangeCallbacks)) {
          maybeNewOnDataChangeCallbacks.forEach(onDataChange =>
            onDataChange({snapshot}),
          );
        }
      }
    });

    if (
      this._snapshot &&
      notifyFirstResult &&
      Array.isArray(onDataChangeCallbacks)
    ) {
      const snapshot = this._snapshot;
      onDataChangeCallbacks.forEach(onDataChange => onDataChange({snapshot}));
    }
  }
}

module.exports = ReactRelayQueryFetcher;
