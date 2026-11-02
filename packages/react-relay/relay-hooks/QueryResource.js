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

import type {Cache} from './LRUCache';
import type {
  Disposable,
  FetchPolicy,
  GraphQLResponse,
  IEnvironment,
  Observable,
  Observer,
  OperationAvailability,
  OperationDescriptor,
  ReaderFragment,
  RenderPolicy,
  Snapshot,
  Subscription,
} from 'relay-runtime';

const {isExecTimeResolversEnabled} = require('./execTimeResolvers');
const LRUCache = require('./LRUCache');
const SuspenseResource = require('./SuspenseResource');
const invariant = require('invariant');
const {isPromise} = require('relay-runtime');
const warning = require('warning');

const CACHE_CAPACITY = 1000;
const DEFAULT_FETCH_POLICY = 'store-or-network';
const DEFAULT_LIVE_FETCH_POLICY = 'store-and-network';

export type QueryResource = QueryResourceImpl;

type QueryResourceCache = Cache<QueryResourceCacheEntry>;
type QueryResourceCacheEntry = {
  readonly id: number,
  readonly cacheIdentifier: string,
  readonly operationAvailability: ?OperationAvailability,
  // The number of received payloads for the operation.
  // We want to differentiate the initial graphql response for the operation
  // from the incremental responses, so later we can choose how to handle errors
  // in the incremental payloads.
  processedPayloadsCount: number,
  setNetworkSubscription(?Subscription): void,
  getValue(): Error | Promise<void> | QueryResult,
  setValue(Error | Promise<void> | QueryResult): void,
  temporaryRetain(environment: IEnvironment): Disposable,
  permanentRetain(environment: IEnvironment): Disposable,
  releaseTemporaryRetain(): void,
};
export opaque type QueryResult: {
  fragmentNode: ReaderFragment,
  fragmentRef: unknown,
  ...
} = {
  cacheIdentifier: string,
  fragmentNode: ReaderFragment,
  fragmentRef: unknown,
  operation: OperationDescriptor,
};

const WEAKMAP_SUPPORTED = typeof WeakMap === 'function';
interface IMap<K, V> {
  get(key: K): V | void;
  set(key: K, value: V): IMap<K, V>;
}

function operationIsLiveQuery(operation: OperationDescriptor): boolean {
  return (
    operation.request.node.params.metadata.live !== undefined ||
    isExecTimeResolversEnabled(operation.request.node.operation)
  );
}

function getDefaultFetchPolicy(operation: OperationDescriptor): FetchPolicy {
  if (operationIsLiveQuery(operation)) {
    return DEFAULT_LIVE_FETCH_POLICY;
  }
  const request = operation.request.node;
  if (request.params.id == null && request.params.text == null) {
    return 'store-only';
  }
  return DEFAULT_FETCH_POLICY;
}

function getQueryCacheIdentifier(
  environment: IEnvironment,
  operation: OperationDescriptor,
  maybeFetchPolicy: ?FetchPolicy,
  maybeRenderPolicy: ?RenderPolicy,
  cacheBreaker?: ?string | ?number,
): string {
  const fetchPolicy = maybeFetchPolicy ?? getDefaultFetchPolicy(operation);
  const renderPolicy =
    maybeRenderPolicy ?? environment.UNSTABLE_getDefaultRenderPolicy();
  const cacheIdentifier = `${fetchPolicy}-${renderPolicy}-${operation.request.identifier}`;
  if (cacheBreaker != null) {
    return `${cacheIdentifier}-${cacheBreaker}`;
  }
  return cacheIdentifier;
}

function getQueryResult(
  operation: OperationDescriptor,
  cacheIdentifier: string,
): QueryResult {
  const rootFragmentRef = {
    __id: operation.fragment.dataID,
    __fragments: {
      [operation.fragment.node.name]: operation.request.variables,
    },
    __fragmentOwner: operation.request,
  };
  return {
    cacheIdentifier,
    fragmentNode: operation.request.node.fragment,
    fragmentRef: rootFragmentRef,
    operation,
  };
}

let nextID = 200000;

function createCacheEntry(
  cacheIdentifier: string,
  operation: OperationDescriptor,
  operationAvailability: ?OperationAvailability,
  value: Error | Promise<void> | QueryResult,
  networkSubscription: ?Subscription,
  onDispose: QueryResourceCacheEntry => void,
): QueryResourceCacheEntry {
  const isLiveQuery = operationIsLiveQuery(operation);

  let currentValue: Error | Promise<void> | QueryResult = value;
  let currentNetworkSubscription: ?Subscription = networkSubscription;

  const suspenseResource = new SuspenseResource(environment => {
    const retention = environment.retain(operation);
    return {
      dispose: () => {
        // Normally if this entry never commits, the request would've ended by the
        // time this timeout expires and the temporary retain is released. However,
        // we need to do this for live queries which remain open indefinitely.
        if (isLiveQuery && currentNetworkSubscription != null) {
          currentNetworkSubscription.unsubscribe();
        }
        retention.dispose();
        onDispose(cacheEntry);
      },
    };
  });

  const cacheEntry: {
    cacheIdentifier: string,
    getValue(): QueryResult | Promise<void> | Error,
    id: number,
    operationAvailability: ?OperationAvailability,
    permanentRetain(environment: IEnvironment): Disposable,
    processedPayloadsCount: number,
    releaseTemporaryRetain(): void,
    setNetworkSubscription(subscription: ?Subscription): void,
    setValue(val: QueryResult | Promise<void> | Error): void,
    temporaryRetain(environment: IEnvironment): Disposable,
  } = {
    cacheIdentifier,
    id: nextID++,
    processedPayloadsCount: 0,
    operationAvailability,
    getValue() {
      return currentValue;
    },
    setValue(val: QueryResult | Promise<void> | Error) {
      currentValue = val;
    },
    setNetworkSubscription(subscription: ?Subscription) {
      if (isLiveQuery && currentNetworkSubscription != null) {
        currentNetworkSubscription.unsubscribe();
      }
      currentNetworkSubscription = subscription;
    },
    temporaryRetain(environment: IEnvironment): Disposable {
      return suspenseResource.temporaryRetain(environment);
    },
    permanentRetain(environment: IEnvironment): Disposable {
      return suspenseResource.permanentRetain(environment);
    },
    releaseTemporaryRetain() {
      suspenseResource.releaseTemporaryRetain();
    },
  };

  return cacheEntry;
}

class QueryResourceImpl {
  _environment: IEnvironment;
  _cache: QueryResourceCache;

  constructor(environment: IEnvironment) {
    this._environment = environment;
    this._cache = LRUCache.create(CACHE_CAPACITY);
  }

  prepare(
    operation: OperationDescriptor,
    fetchObservable: Observable<GraphQLResponse>,
    maybeFetchPolicy: ?FetchPolicy,
    maybeRenderPolicy: ?RenderPolicy,
    observer: ?Observer<Snapshot>,
    cacheBreaker: ?string | ?number,
    profilerContext: unknown,
  ): QueryResult {
    const cacheIdentifier = getQueryCacheIdentifier(
      this._environment,
      operation,
      maybeFetchPolicy,
      maybeRenderPolicy,
      cacheBreaker,
    );
    return this.prepareWithIdentifier(
      cacheIdentifier,
      operation,
      fetchObservable,
      maybeFetchPolicy,
      maybeRenderPolicy,
      observer,
      profilerContext,
    );
  }

  /**
   * This function should be called during a Component's render function,
   * to either read an existing cached value for the query, or fetch the query
   * and suspend.
   */
  prepareWithIdentifier(
    cacheIdentifier: string,
    operation: OperationDescriptor,
    fetchObservable: Observable<GraphQLResponse>,
    maybeFetchPolicy: ?FetchPolicy,
    maybeRenderPolicy: ?RenderPolicy,
    observer: ?Observer<Snapshot>,
    profilerContext: unknown,
  ): QueryResult {
    const environment = this._environment;
    const fetchPolicy = maybeFetchPolicy ?? getDefaultFetchPolicy(operation);
    const renderPolicy =
      maybeRenderPolicy ?? environment.UNSTABLE_getDefaultRenderPolicy();

    // 1. Check if there's a cached value for this operation, and reuse it if
    // it's available
    let cacheEntry = this._cache.get(cacheIdentifier);
    let temporaryRetainDisposable: ?Disposable = null;
    const entryWasCached = cacheEntry != null;
    if (cacheEntry == null) {
      // 2. If a cached value isn't available, try fetching the operation.
      // _fetchAndSaveQuery will update the cache with either a Promise or
      // an Error to throw, or a QueryResult to return.
      cacheEntry = this._fetchAndSaveQuery(
        cacheIdentifier,
        operation,
        fetchObservable,
        fetchPolicy,
        renderPolicy,
        profilerContext,
        {
          ...observer,
          unsubscribe(subscription) {
            // 4. If the request is cancelled, make sure to dispose
            // of the temporary retain; this will ensure that a promise
            // doesn't remain unnecessarily cached until the temporary retain
            // expires. Not clearing the temporary retain might cause the
            // query to incorrectly re-suspend.
            if (temporaryRetainDisposable != null) {
              temporaryRetainDisposable.dispose();
            }
            const observerUnsubscribe = observer?.unsubscribe;
            observerUnsubscribe && observerUnsubscribe(subscription);
          },
        },
      );
    }

    // 3. Temporarily retain here in render phase. When the component reading
    // the operation is committed, we will transfer ownership of data retention
    // to the component.
    // In case the component never commits (mounts or updates) from this render,
    // this data retention hold will auto-release itself after a timeout.
    temporaryRetainDisposable = cacheEntry.temporaryRetain(environment);

    const cachedValue = cacheEntry.getValue();
    if (isPromise(cachedValue)) {
      environment.__log({
        name: 'suspense.query',
        fetchPolicy,
        isPromiseCached: entryWasCached,
        operation: operation,
        queryAvailability: cacheEntry.operationAvailability,
        renderPolicy,
      });
      throw cachedValue;
    }
    if (cachedValue instanceof Error) {
      throw cachedValue;
    }
    return cachedValue;
  }

  /**
   * This function should be called during a component's commit phase
   * (e.g. inside useEffect), in order to retain the operation in the Relay store
   * and transfer ownership of the operation to the component lifecycle.
   */
  retain(queryResult: QueryResult, profilerContext: unknown): Disposable {
    const environment = this._environment;
    const {cacheIdentifier, operation} = queryResult;
    const cacheEntry = this._getOrCreateCacheEntry(
      cacheIdentifier,
      operation,
      null,
      queryResult,
      null,
    );
    const disposable = cacheEntry.permanentRetain(environment);
    environment.__log({
      name: 'queryresource.retain',
      profilerContext,
      resourceID: cacheEntry.id,
    });

    return {
      dispose: () => {
        disposable.dispose();
      },
    };
  }

  releaseTemporaryRetain(queryResult: QueryResult) {
    const cacheEntry = this._cache.get(queryResult.cacheIdentifier);
    if (cacheEntry != null) {
      cacheEntry.releaseTemporaryRetain();
    }
  }

  TESTS_ONLY__getCacheEntry(
    operation: OperationDescriptor,
    maybeFetchPolicy?: ?FetchPolicy,
    maybeRenderPolicy?: ?RenderPolicy,
    cacheBreaker?: ?string,
  ): ?QueryResourceCacheEntry {
    const environment = this._environment;
    const cacheIdentifier = getQueryCacheIdentifier(
      environment,
      operation,
      maybeFetchPolicy,
      maybeRenderPolicy,
      cacheBreaker,
    );
    return this._cache.get(cacheIdentifier);
  }

  _clearCacheEntry = (cacheEntry: QueryResourceCacheEntry): void => {
    if (this._cache.get(cacheEntry.cacheIdentifier) === cacheEntry) {
      this._cache.delete(cacheEntry.cacheIdentifier);
    }
  };

  _getOrCreateCacheEntry(
    cacheIdentifier: string,
    operation: OperationDescriptor,
    operationAvailability: ?OperationAvailability,
    value: Error | Promise<void> | QueryResult,
    networkSubscription: ?Subscription,
  ): QueryResourceCacheEntry {
    let cacheEntry = this._cache.get(cacheIdentifier);
    if (cacheEntry == null) {
      cacheEntry = createCacheEntry(
        cacheIdentifier,
        operation,
        operationAvailability,
        value,
        networkSubscription,
        this._clearCacheEntry,
      );
      this._cache.set(cacheIdentifier, cacheEntry);
    }
    return cacheEntry;
  }

  _fetchAndSaveQuery(
    cacheIdentifier: string,
    operation: OperationDescriptor,
    fetchObservable: Observable<GraphQLResponse>,
    fetchPolicy: FetchPolicy,
    renderPolicy: RenderPolicy,
    profilerContext: unknown,
    observer: Observer<Snapshot>,
  ): QueryResourceCacheEntry {
    const environment = this._environment;

    // NOTE: Running `check` will write missing data to the store using any
    // missing data handlers specified on the environment;
    // We run it here first to make the handlers get a chance to populate
    // missing data.
    const queryAvailability = environment.check(operation);
    const queryStatus = queryAvailability.status;
    const hasFullQuery = queryStatus === 'available';
    const canPartialRender =
      hasFullQuery || (renderPolicy === 'partial' && queryStatus !== 'stale');

    let shouldFetch;
    let shouldAllowRender;
    // Different definitions for Promise in our repos can cause this variable
    // to cause errors when synced elsewhere
    let resolveNetworkPromise: $FlowFixMe = () => {};
    switch (fetchPolicy) {
      case 'store-only': {
        shouldFetch = false;
        shouldAllowRender = true;
        break;
      }
      case 'store-or-network': {
        shouldFetch = !hasFullQuery;
        shouldAllowRender = canPartialRender;
        break;
      }
      case 'store-and-network': {
        shouldFetch = true;
        shouldAllowRender = canPartialRender;
        break;
      }
      case 'network-only':
      default: {
        shouldFetch = true;
        shouldAllowRender = false;
        break;
      }
    }

    // NOTE: If this value is false, we will cache a promise for this
    // query, which means we will suspend here at this query root.
    // If it's true, we will cache the query resource and allow rendering to
    // continue.
    if (shouldAllowRender) {
      const queryResult = getQueryResult(operation, cacheIdentifier);
      const cacheEntry = createCacheEntry(
        cacheIdentifier,
        operation,
        queryAvailability,
        queryResult,
        null,
        this._clearCacheEntry,
      );
      this._cache.set(cacheIdentifier, cacheEntry);
    }

    if (shouldFetch) {
      const queryResult = getQueryResult(operation, cacheIdentifier);
      let networkSubscription: ?Subscription;
      fetchObservable.subscribe({
        start: subscription => {
          networkSubscription = subscription;
          const cacheEntry = this._cache.get(cacheIdentifier);
          if (cacheEntry) {
            cacheEntry.setNetworkSubscription(networkSubscription);
          }
          const observerStart = observer?.start;
          if (observerStart) {
            const subscriptionWithConditionalCancelation = {
              ...subscription,
              unsubscribe: () => {
                // Only live queries should have their network requests canceled.
                if (operationIsLiveQuery(operation)) {
                  subscription.unsubscribe();
                }
              },
            };
            observerStart(subscriptionWithConditionalCancelation);
          }
        },
        next: () => {
          const cacheEntry = this._getOrCreateCacheEntry(
            cacheIdentifier,
            operation,
            queryAvailability,
            queryResult,
            networkSubscription,
          );
          cacheEntry.processedPayloadsCount += 1;
          cacheEntry.setValue(queryResult);
          resolveNetworkPromise();

          const observerNext = observer?.next;
          if (observerNext != null) {
            const snapshot = environment.lookup(operation.fragment);
            observerNext(snapshot);
          }
        },
        error: error => {
          const cacheEntry = this._getOrCreateCacheEntry(
            cacheIdentifier,
            operation,
            queryAvailability,
            error,
            networkSubscription,
          );

          // If, this is the first thing we receive for the query,
          // before any other payload handled is error, we will cache and
          // re-throw that error later.

          // We will ignore errors for any incremental payloads we receive.
          if (cacheEntry.processedPayloadsCount === 0) {
            cacheEntry.setValue(error);
          } else {
            // TODO:T92030819 Remove this warning and actually throw the network error
            // To complete this task we need to have a way of precisely tracking suspendable points
            warning(
              false,
              'QueryResource: An incremental payload for query `%s` returned an error: `%s`.',
              operation.fragment.node.name,
              String(error.message),
            );
          }
          resolveNetworkPromise();

          networkSubscription = null;
          cacheEntry.setNetworkSubscription(null);
          const observerError = observer?.error;
          observerError && observerError(error);
        },
        complete: () => {
          resolveNetworkPromise();

          networkSubscription = null;
          const cacheEntry = this._cache.get(cacheIdentifier);
          if (cacheEntry) {
            cacheEntry.setNetworkSubscription(null);
          }
          const observerComplete = observer?.complete;
          observerComplete && observerComplete();
        },
        unsubscribe: observer?.unsubscribe,
      });

      let cacheEntry = this._cache.get(cacheIdentifier);
      if (!cacheEntry) {
        const networkPromise = new Promise<void>(resolve => {
          resolveNetworkPromise = resolve;
        });

        // $FlowExpectedError[prop-missing] Expando to annotate Promises.
        networkPromise.displayName =
          'Relay(' + operation.fragment.node.name + ')';

        cacheEntry = createCacheEntry(
          cacheIdentifier,
          operation,
          queryAvailability,
          networkPromise,
          networkSubscription,
          this._clearCacheEntry,
        );
        this._cache.set(cacheIdentifier, cacheEntry);
      }
    } else {
      const observerComplete = observer?.complete;
      observerComplete && observerComplete();
    }
    const cacheEntry = this._cache.get(cacheIdentifier);
    invariant(
      cacheEntry != null,
      'Relay: Expected to have cached a result when attempting to fetch query.' +
        "If you're seeing this, this is likely a bug in Relay.",
    );
    environment.__log({
      name: 'queryresource.fetch',
      resourceID: cacheEntry.id,
      operation,
      profilerContext,
      fetchPolicy,
      renderPolicy,
      queryAvailability,
      shouldFetch,
    });
    return cacheEntry;
  }
}

function createQueryResource(environment: IEnvironment): QueryResource {
  return new QueryResourceImpl(environment);
}

const dataResources: IMap<IEnvironment, QueryResource> = WEAKMAP_SUPPORTED
  ? new WeakMap()
  : new Map();

function getQueryResourceForEnvironment(
  environment: IEnvironment,
): QueryResourceImpl {
  const cached = dataResources.get(environment);
  if (cached) {
    return cached;
  }
  const newDataResource = createQueryResource(environment);
  dataResources.set(environment, newDataResource);
  return newDataResource;
}

module.exports = {
  createQueryResource,
  getQueryResourceForEnvironment,
  getQueryCacheIdentifier,
};
