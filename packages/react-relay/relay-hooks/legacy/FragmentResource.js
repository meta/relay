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

import type {Cache} from '../LRUCache';
import type {QueryResource, QueryResult} from '../QueryResource';
import type {
  ConcreteRequest,
  DataID,
  Disposable,
  IEnvironment,
  ReaderFragment,
  RequestDescriptor,
  Snapshot,
} from 'relay-runtime';

const LRUCache = require('../LRUCache');
const {getQueryResourceForEnvironment} = require('../QueryResource');
const SuspenseResource = require('../SuspenseResource');
const invariant = require('invariant');
const {
  __internal: {fetchQuery, getPromiseForActiveRequest},
  RelayFeatureFlags,
  createOperationDescriptor,
  getFragmentIdentifier,
  getPendingOperationsForFragment,
  getSelector,
  getVariablesFromFragment,
  handlePotentialSnapshotErrors,
  isPromise,
  recycleNodesInto,
} = require('relay-runtime');

export type FragmentResource = FragmentResourceImpl;

type FragmentResourceCache = Cache<
  | {
      kind: 'pending',
      pendingOperations: ReadonlyArray<RequestDescriptor>,
      promise: Promise<unknown>,
      result: FragmentResult,
    }
  | {kind: 'done', result: FragmentResult}
  | {
      kind: 'missing',
      result: FragmentResult,
      snapshot: SingularOrPluralSnapshot,
    },
>;

const WEAKMAP_SUPPORTED = typeof WeakMap === 'function';
interface IMap<K, V> {
  get(key: K): V | void;
  set(key: K, value: V): IMap<K, V>;
}

type SingularOrPluralSnapshot = Snapshot | ReadonlyArray<Snapshot>;

opaque type FragmentResult: {data: unknown, ...} = {
  cacheKey: string,
  data: unknown,
  isMissingData: boolean,
  snapshot: SingularOrPluralSnapshot | null,
  storeEpoch: number,
};

// TODO: Fix to not rely on LRU. If the number of active fragments exceeds this
// capacity, readSpec() will fail to find cached entries and break object
// identity even if data hasn't changed.
const CACHE_CAPACITY = 1000000;

// this is frozen so that users don't accidentally push data into the array
const CONSTANT_READONLY_EMPTY_ARRAY: ReadonlyArray<$FlowFixMe> = Object.freeze(
  [],
);

function isMissingData(snapshot: SingularOrPluralSnapshot): boolean {
  if (Array.isArray(snapshot)) {
    return snapshot.some(s => s.isMissingData);
  }
  return snapshot.isMissingData;
}

function hasMissingClientEdges(snapshot: SingularOrPluralSnapshot): boolean {
  if (Array.isArray(snapshot)) {
    return snapshot.some(s => (s.missingClientEdges?.length ?? 0) > 0);
  }
  return (snapshot.missingClientEdges?.length ?? 0) > 0;
}

function missingLiveResolverFields(
  snapshot: SingularOrPluralSnapshot,
): ?ReadonlyArray<DataID> {
  if (Array.isArray(snapshot)) {
    return snapshot
      .map(s => s.missingLiveResolverFields)
      .filter(Boolean)
      .flat();
  }
  return snapshot.missingLiveResolverFields;
}

function singularOrPluralForEach(
  snapshot: SingularOrPluralSnapshot,
  f: (v: Snapshot) => void,
): void {
  if (Array.isArray(snapshot)) {
    snapshot.forEach(f);
  } else {
    f(snapshot);
  }
}

function getFragmentResult(
  cacheKey: string,
  snapshot: SingularOrPluralSnapshot,
  storeEpoch: number,
): FragmentResult {
  if (Array.isArray(snapshot)) {
    return {
      cacheKey,
      snapshot,
      data: snapshot.map(s => s.data),
      isMissingData: isMissingData(snapshot),
      storeEpoch,
    };
  }
  return {
    cacheKey,
    snapshot,
    data: snapshot.data,
    isMissingData: isMissingData(snapshot),
    storeEpoch,
  };
}

/**
 * The purpose of this cache is to allow information to be passed from an
 * initial read which suspends through to the commit that follows a subsequent
 * successful read. Specifically, the QueryResource result for the data fetch
 * is passed through so that that query can be retained on commit.
 */
class ClientEdgeQueryResultsCache {
  _cache: Map<string, [Array<QueryResult>, SuspenseResource]> = new Map();
  _retainCounts: Map<string, number> = new Map();
  _environment: IEnvironment;

  constructor(environment: IEnvironment) {
    this._environment = environment;
  }

  get(fragmentIdentifier: string): void | Array<QueryResult> {
    return this._cache.get(fragmentIdentifier)?.[0] ?? undefined;
  }

  recordQueryResults(
    fragmentIdentifier: string,
    value: Array<QueryResult>, // may be mutated after being passed here
  ): void {
    const existing = this._cache.get(fragmentIdentifier);
    if (!existing) {
      const suspenseResource = new SuspenseResource(() =>
        this._retain(fragmentIdentifier),
      );
      this._cache.set(fragmentIdentifier, [value, suspenseResource]);
      suspenseResource.temporaryRetain(this._environment);
    } else {
      const [existingResults, suspenseResource] = existing;
      value.forEach(queryResult => {
        existingResults.push(queryResult);
      });
      suspenseResource.temporaryRetain(this._environment);
    }
  }

  _retain(id: string): {dispose: () => void} {
    const retainCount = (this._retainCounts.get(id) ?? 0) + 1;
    this._retainCounts.set(id, retainCount);
    return {
      dispose: () => {
        const newRetainCount = (this._retainCounts.get(id) ?? 0) - 1;
        if (newRetainCount > 0) {
          this._retainCounts.set(id, newRetainCount);
        } else {
          this._retainCounts.delete(id);
          this._cache.delete(id);
        }
      },
    };
  }
}

class FragmentResourceImpl {
  _environment: IEnvironment;
  _cache: FragmentResourceCache;
  _clientEdgeQueryResultsCache: void | ClientEdgeQueryResultsCache;

  constructor(environment: IEnvironment) {
    this._environment = environment;
    this._cache = LRUCache.create(CACHE_CAPACITY);
    this._clientEdgeQueryResultsCache = new ClientEdgeQueryResultsCache(
      environment,
    );
  }

  /**
   * This function should be called during a Component's render function,
   * to read the data for a fragment, or suspend if the fragment is being
   * fetched.
   */
  read(
    fragmentNode: ReaderFragment,
    fragmentRef: unknown,
    componentDisplayName: string,
    fragmentKey?: string,
  ): FragmentResult {
    return this.readWithIdentifier(
      fragmentNode,
      fragmentRef,
      getFragmentIdentifier(fragmentNode, fragmentRef),
      componentDisplayName,
      fragmentKey,
    );
  }

  /**
   * Like `read`, but with a pre-computed fragmentIdentifier that should be
   * equal to `getFragmentIdentifier(fragmentNode, fragmentRef)` from the
   * arguments.
   */
  readWithIdentifier(
    fragmentNode: ReaderFragment,
    fragmentRef: unknown,
    fragmentIdentifier: string,
    componentDisplayName: string,
    fragmentKey?: ?string,
  ): FragmentResult {
    const environment = this._environment;

    // If fragmentRef is null or undefined, pass it directly through.
    // This is a convenience when consuming fragments via a HOC API, when the
    // prop corresponding to the fragment ref might be passed as null.
    if (fragmentRef == null) {
      return {
        cacheKey: fragmentIdentifier,
        data: null,
        isMissingData: false,
        snapshot: null,
        storeEpoch: 0,
      };
    }

    const storeEpoch = environment.getStore().getEpoch();

    // If fragmentRef is plural, ensure that it is an array.
    // If it's empty, return the empty array directly before doing any more work.
    if (fragmentNode?.metadata?.plural === true) {
      invariant(
        Array.isArray(fragmentRef),
        'Relay: Expected fragment pointer%s for fragment `%s` to be ' +
          'an array, instead got `%s`. Remove `@relay(plural: true)` ' +
          'from fragment `%s` to allow the prop to be an object.',
        fragmentKey != null ? ` for key \`${fragmentKey}\`` : '',
        fragmentNode.name,
        typeof fragmentRef,
        fragmentNode.name,
      );
      if (fragmentRef.length === 0) {
        return {
          cacheKey: fragmentIdentifier,
          data: CONSTANT_READONLY_EMPTY_ARRAY,
          isMissingData: false,
          snapshot: CONSTANT_READONLY_EMPTY_ARRAY,
          storeEpoch,
        };
      }
    }

    // Now we actually attempt to read the fragment:

    // 1. Check if there's a cached value for this fragment
    const cachedValue = this._cache.get(fragmentIdentifier);
    if (cachedValue != null) {
      if (cachedValue.kind === 'pending' && isPromise(cachedValue.promise)) {
        environment.__log({
          name: 'suspense.fragment',
          data: cachedValue.result.data,
          fragment: fragmentNode,
          isRelayHooks: true,
          isMissingData: cachedValue.result.isMissingData,
          isPromiseCached: true,
          pendingOperations: cachedValue.pendingOperations,
        });
        throw cachedValue.promise;
      }

      if (
        cachedValue.kind === 'done' &&
        cachedValue.result.snapshot &&
        !missingLiveResolverFields(cachedValue.result.snapshot)?.length
      ) {
        this._throwOrLogErrorsInSnapshot(
          // $FlowFixMe[incompatible-type]
          cachedValue.result.snapshot,
        );

        // This cache gets populated directly whenever the store notifies us of
        // an update. That mechanism does not check for missing data, or
        // in-flight requests.
        if (cachedValue.result.isMissingData) {
          environment.__log({
            name: 'fragmentresource.missing_data',
            data: cachedValue.result.data,
            fragment: fragmentNode,
            isRelayHooks: true,
            cached: true,
          });
        }
        return cachedValue.result;
      }
    }

    // 2. If not, try reading the fragment from the Relay store.
    // If the snapshot has data, return it and save it in cache
    const fragmentSelector = getSelector(fragmentNode, fragmentRef);
    invariant(
      fragmentSelector != null,
      'Relay: Expected to receive an object where `...%s` was spread, ' +
        'but the fragment reference was not found`. This is most ' +
        'likely the result of:\n' +
        "- Forgetting to spread `%s` in `%s`'s parent's fragment.\n" +
        '- Conditionally fetching `%s` but unconditionally passing %s prop ' +
        'to `%s`. If the parent fragment only fetches the fragment conditionally ' +
        '- with e.g. `@include`, `@skip`, or inside a `... on SomeType { }` ' +
        'spread  - then the fragment reference will not exist. ' +
        'This issue can generally be fixed by adding `@alias` after `...%s`.\n' +
        'See https://relay.dev/docs/next/guides/alias-directive/',
      fragmentNode.name,
      fragmentNode.name,
      componentDisplayName,
      fragmentNode.name,
      fragmentKey == null ? 'a fragment reference' : `the \`${fragmentKey}\``,
      componentDisplayName,
      fragmentNode.name,
    );

    let fragmentResult = null;
    let snapshot = null;
    // Fall through to existing logic if it's 'missing' state so it would check and save promise into cache.
    if (
      RelayFeatureFlags.ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE &&
      cachedValue != null &&
      cachedValue.kind === 'missing'
    ) {
      fragmentResult = cachedValue.result;
      snapshot = cachedValue.snapshot;
    } else {
      snapshot =
        fragmentSelector.kind === 'PluralReaderSelector'
          ? fragmentSelector.selectors.map(s => environment.lookup(s))
          : environment.lookup(fragmentSelector);

      fragmentResult = getFragmentResult(
        fragmentIdentifier,
        snapshot,
        storeEpoch,
      );
    }
    if (!fragmentResult.isMissingData) {
      this._throwOrLogErrorsInSnapshot(snapshot);

      this._cache.set(fragmentIdentifier, {
        kind: 'done',
        result: fragmentResult,
      });
      return fragmentResult;
    }

    // 3. If we don't have data in the store, there's two cases where we should
    // suspend to await the data: First if any client edges were traversed where
    // the destination record was missing data; in that case we initiate a query
    // here to fetch the missing data. Second, there may already be a request
    // in flight for the fragment's parent query, or for another operation that
    //  may affect the parent's query data, such as a mutation or subscription.
    // For any of these cases we can get a promise, which we will cache and
    // suspend on.

    // First, initiate a query for any client edges that were missing data:
    let clientEdgeRequests: ?Array<RequestDescriptor> = null;
    if (
      fragmentNode.metadata?.hasClientEdges === true &&
      hasMissingClientEdges(snapshot)
    ) {
      clientEdgeRequests = [];
      const queryResource = getQueryResourceForEnvironment(this._environment);
      const queryResults = [];
      singularOrPluralForEach(snapshot, snap => {
        snap.missingClientEdges?.forEach(
          ({request, clientEdgeDestinationID}) => {
            const {queryResult, requestDescriptor} =
              this._performClientEdgeQuery(
                queryResource,
                fragmentNode,
                fragmentRef,
                request,
                clientEdgeDestinationID,
              );
            queryResults.push(queryResult);
            clientEdgeRequests?.push(requestDescriptor);
          },
        );
      });
      // Store the query so that it can be retained when our own fragment is
      // subscribed to. This merges with any existing query results:
      invariant(
        this._clientEdgeQueryResultsCache != null,
        'Client edge query result cache should exist when ENABLE_CLIENT_EDGES is on.',
      );
      this._clientEdgeQueryResultsCache.recordQueryResults(
        fragmentIdentifier,
        queryResults,
      );
    }
    let clientEdgePromises: Array<Promise<void>> = [];
    if (clientEdgeRequests) {
      clientEdgePromises = clientEdgeRequests
        .map(request => getPromiseForActiveRequest(this._environment, request))
        .filter(Boolean);
    }

    // Finally look for operations in flight for our parent query:
    const fragmentOwner =
      fragmentSelector.kind === 'PluralReaderSelector'
        ? fragmentSelector.selectors[0].owner
        : fragmentSelector.owner;
    const parentQueryPromiseResult =
      this._getAndSavePromiseForFragmentRequestInFlight(
        fragmentIdentifier,
        fragmentNode,
        fragmentOwner,
        fragmentResult,
      );
    const parentQueryPromiseResultPromise = parentQueryPromiseResult?.promise; // for refinement
    const missingResolverFieldPromises =
      missingLiveResolverFields(snapshot)?.map(liveStateID => {
        const store = environment.getStore();

        // $FlowFixMe[prop-missing] This is expected to be a RelayModernStore
        return store.getLiveResolverPromise(liveStateID);
      }) ?? [];

    if (
      clientEdgePromises.length ||
      missingResolverFieldPromises.length ||
      isPromise(parentQueryPromiseResultPromise)
    ) {
      environment.__log({
        name: 'suspense.fragment',
        data: fragmentResult.data,
        fragment: fragmentNode,
        isRelayHooks: true,
        isPromiseCached: false,
        isMissingData: fragmentResult.isMissingData,
        // TODO! Attach information here about missing live resolver fields
        pendingOperations: [
          ...(parentQueryPromiseResult?.pendingOperations ?? []),
          ...(clientEdgeRequests ?? []),
        ],
      });
      let promises = [];
      if (clientEdgePromises.length > 0) {
        promises = promises.concat(clientEdgePromises);
      }
      if (missingResolverFieldPromises.length > 0) {
        promises = promises.concat(missingResolverFieldPromises);
      }

      if (promises.length > 0) {
        if (parentQueryPromiseResultPromise) {
          promises.push(parentQueryPromiseResultPromise);
        }
        throw Promise.all(promises);
      }

      // Note: we are re-throwing the `parentQueryPromiseResultPromise` here,
      // because some of our suspense-related code is relying on the instance equality
      // of thrown promises. See FragmentResource-test.js
      if (parentQueryPromiseResultPromise) {
        throw parentQueryPromiseResultPromise;
      }
    }

    // set it as done if has missing data and no pending operations
    if (
      RelayFeatureFlags.ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE &&
      fragmentResult.isMissingData
    ) {
      this._cache.set(fragmentIdentifier, {
        kind: 'done',
        result: fragmentResult,
      });
    }

    this._throwOrLogErrorsInSnapshot(snapshot);

    // At this point, there's nothing we can do. We don't have all the expected
    // data, but there's no indication the missing data will be fulfilled. So we
    // choose to return potentially non-typesafe data. The data returned here
    // might not match the generated types for this fragment/operation.
    environment.__log({
      name: 'fragmentresource.missing_data',
      data: fragmentResult.data,
      fragment: fragmentNode,
      isRelayHooks: true,
      cached: false,
    });
    return getFragmentResult(fragmentIdentifier, snapshot, storeEpoch);
  }

  _performClientEdgeQuery(
    queryResource: QueryResource,
    fragmentNode: ReaderFragment,
    fragmentRef: unknown,
    request: ConcreteRequest,
    clientEdgeDestinationID: DataID,
  ): {queryResult: QueryResult, requestDescriptor: RequestDescriptor} {
    const originalVariables = getVariablesFromFragment(
      fragmentNode,
      fragmentRef,
    );
    const variables = {
      ...originalVariables,
      id: clientEdgeDestinationID, // TODO should be a reserved name
    };
    const operation = createOperationDescriptor(
      request,
      variables,
      {}, //  TODO cacheConfig should probably inherent from parent operation
    );
    const fetchObservable = fetchQuery(this._environment, operation);
    const queryResult = queryResource.prepare(
      operation,
      fetchObservable,
      // TODO should inherent render policy etc. from parent operation
    );
    return {
      requestDescriptor: operation.request,
      queryResult,
    };
  }

  _throwOrLogErrorsInSnapshot(snapshot: SingularOrPluralSnapshot) {
    if (Array.isArray(snapshot)) {
      snapshot.forEach(s => {
        handlePotentialSnapshotErrors(this._environment, s.fieldErrors);
      });
    } else {
      handlePotentialSnapshotErrors(this._environment, snapshot.fieldErrors);
    }
  }

  readSpec(
    fragmentNodes: {[key: string]: ReaderFragment, ...},
    fragmentRefs: {[key: string]: unknown, ...},
    componentDisplayName: string,
  ): {[key: string]: FragmentResult, ...} {
    const result: {[key: string]: FragmentResult} = {};
    for (const key in fragmentNodes) {
      result[key] = this.read(
        fragmentNodes[key],
        fragmentRefs[key],
        componentDisplayName,
        key,
      );
    }
    return result;
  }

  subscribe(fragmentResult: FragmentResult, callback: () => void): Disposable {
    const environment = this._environment;
    const {cacheKey} = fragmentResult;
    const renderedSnapshot = fragmentResult.snapshot;
    if (!renderedSnapshot) {
      return {dispose: () => {}};
    }

    // 1. Check for any updates missed during render phase
    // TODO(T44066760): More efficiently detect if we missed an update
    const [didMissUpdates, currentSnapshot] =
      this.checkMissedUpdates(fragmentResult);

    // 2. If an update was missed, notify the component so it updates with
    // the latest data.
    if (didMissUpdates) {
      callback();
    }

    // 3. Establish subscriptions on the snapshot(s)
    const disposables = [];
    if (Array.isArray(renderedSnapshot)) {
      invariant(
        Array.isArray(currentSnapshot),
        'Relay: Expected snapshots to be plural. ' +
          "If you're seeing this, this is likely a bug in Relay.",
      );
      currentSnapshot.forEach((snapshot, idx) => {
        disposables.push(
          environment.subscribe(snapshot, latestSnapshot => {
            const storeEpoch = environment.getStore().getEpoch();
            this._updatePluralSnapshot(
              cacheKey,
              currentSnapshot,
              latestSnapshot,
              idx,
              storeEpoch,
            );
            callback();
          }),
        );
      });
    } else {
      invariant(
        currentSnapshot != null && !Array.isArray(currentSnapshot),
        'Relay: Expected snapshot to be singular. ' +
          "If you're seeing this, this is likely a bug in Relay.",
      );
      disposables.push(
        environment.subscribe(currentSnapshot, latestSnapshot => {
          const storeEpoch = environment.getStore().getEpoch();
          const result = getFragmentResult(
            cacheKey,
            latestSnapshot,
            storeEpoch,
          );
          if (
            RelayFeatureFlags.ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE &&
            result.isMissingData
          ) {
            this._cache.set(cacheKey, {
              kind: 'missing',
              result: result,
              snapshot: latestSnapshot,
            });
          } else {
            this._cache.set(cacheKey, {
              kind: 'done',
              result: getFragmentResult(cacheKey, latestSnapshot, storeEpoch),
            });
          }
          callback();
        }),
      );
    }

    const clientEdgeQueryResults =
      this._clientEdgeQueryResultsCache?.get(cacheKey) ?? undefined;
    if (clientEdgeQueryResults?.length) {
      const queryResource = getQueryResourceForEnvironment(this._environment);
      clientEdgeQueryResults.forEach(queryResult => {
        disposables.push(queryResource.retain(queryResult));
      });
    }

    return {
      dispose: () => {
        disposables.forEach(s => s.dispose());
        this._cache.delete(cacheKey);
      },
    };
  }

  subscribeSpec(
    fragmentResults: {[key: string]: FragmentResult, ...},
    callback: () => void,
  ): Disposable {
    const disposables = Object.keys(fragmentResults).map(key =>
      this.subscribe(fragmentResults[key], callback),
    );
    return {
      dispose: () => {
        disposables.forEach(disposable => {
          disposable.dispose();
        });
      },
    };
  }

  checkMissedUpdates(
    fragmentResult: FragmentResult,
  ): [boolean /* were updates missed? */, SingularOrPluralSnapshot | null] {
    const environment = this._environment;
    const renderedSnapshot = fragmentResult.snapshot;
    if (!renderedSnapshot) {
      return [false, null];
    }

    let storeEpoch = null;
    // Bail out if the store hasn't been written since last read
    storeEpoch = environment.getStore().getEpoch();
    if (fragmentResult.storeEpoch === storeEpoch) {
      return [false, fragmentResult.snapshot];
    }

    const {cacheKey} = fragmentResult;

    if (Array.isArray(renderedSnapshot)) {
      let didMissUpdates = false;
      const currentSnapshots = [];
      renderedSnapshot.forEach((snapshot, idx) => {
        let currentSnapshot: Snapshot = environment.lookup(snapshot.selector);
        const renderData = snapshot.data;
        const currentData = currentSnapshot.data;
        const updatedData = recycleNodesInto(renderData, currentData);
        if (updatedData !== renderData) {
          currentSnapshot = {...currentSnapshot, data: updatedData};
          didMissUpdates = true;
        }
        currentSnapshots[idx] = currentSnapshot;
      });
      // Only update the cache when the data is changed to avoid
      // returning different `data` instances
      if (didMissUpdates) {
        const result = getFragmentResult(
          cacheKey,
          currentSnapshots,
          storeEpoch,
        );
        if (
          RelayFeatureFlags.ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE &&
          result.isMissingData
        ) {
          this._cache.set(cacheKey, {
            kind: 'missing',
            result,
            snapshot: currentSnapshots,
          });
        } else {
          this._cache.set(cacheKey, {
            kind: 'done',
            result,
          });
        }
      }
      return [didMissUpdates, currentSnapshots];
    }
    const currentSnapshot = environment.lookup(renderedSnapshot.selector);
    const renderData = renderedSnapshot.data;
    const currentData = currentSnapshot.data;
    const updatedData = recycleNodesInto(renderData, currentData);
    const updatedCurrentSnapshot: Snapshot = {
      data: updatedData,
      isMissingData: currentSnapshot.isMissingData,
      missingClientEdges: currentSnapshot.missingClientEdges,
      missingLiveResolverFields: currentSnapshot.missingLiveResolverFields,
      seenRecords: currentSnapshot.seenRecords,
      selector: currentSnapshot.selector,
      fieldErrors: currentSnapshot.fieldErrors,
    };
    if (updatedData !== renderData) {
      const result = getFragmentResult(
        cacheKey,
        updatedCurrentSnapshot,
        storeEpoch,
      );
      if (
        RelayFeatureFlags.ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE &&
        result.isMissingData
      ) {
        this._cache.set(cacheKey, {
          kind: 'missing',
          result: result,
          snapshot: updatedCurrentSnapshot,
        });
      } else {
        this._cache.set(cacheKey, {
          kind: 'done',
          result,
        });
      }
    }
    return [updatedData !== renderData, updatedCurrentSnapshot];
  }

  checkMissedUpdatesSpec(fragmentResults: {
    [key: string]: FragmentResult,
    ...
  }): boolean {
    return Object.keys(fragmentResults).some(
      key => this.checkMissedUpdates(fragmentResults[key])[0],
    );
  }

  _getAndSavePromiseForFragmentRequestInFlight(
    cacheKey: string,
    fragmentNode: ReaderFragment,
    fragmentOwner: RequestDescriptor,
    fragmentResult: FragmentResult,
  ): {
    promise: Promise<void>,
    pendingOperations: ReadonlyArray<RequestDescriptor>,
  } | null {
    const pendingOperationsResult = getPendingOperationsForFragment(
      this._environment,
      fragmentNode,
      fragmentOwner,
    );
    if (pendingOperationsResult == null) {
      return null;
    }

    // When the Promise for the request resolves, we need to make sure to
    // update the cache with the latest data available in the store before
    // resolving the Promise
    const networkPromise = pendingOperationsResult.promise;
    const pendingOperations = pendingOperationsResult.pendingOperations;
    const promise = networkPromise
      .then(() => {
        this._cache.delete(cacheKey);
      })
      .catch<void>((error: Error) => {
        this._cache.delete(cacheKey);
      });
    // $FlowExpectedError[prop-missing] Expando to annotate Promises.
    promise.displayName = networkPromise.displayName;
    this._cache.set(cacheKey, {
      kind: 'pending',
      pendingOperations,
      promise,
      result: fragmentResult,
    });
    return {promise, pendingOperations};
  }

  _updatePluralSnapshot(
    cacheKey: string,
    baseSnapshots: ReadonlyArray<Snapshot>,
    latestSnapshot: Snapshot,
    idx: number,
    storeEpoch: number,
  ): void {
    const currentFragmentResult = this._cache.get(cacheKey);
    if (isPromise(currentFragmentResult)) {
      reportInvalidCachedData(latestSnapshot.selector.node.name);
      return;
    }

    const currentSnapshot = currentFragmentResult?.result?.snapshot;
    if (currentSnapshot && !Array.isArray(currentSnapshot)) {
      reportInvalidCachedData(latestSnapshot.selector.node.name);
      return;
    }

    const nextSnapshots = currentSnapshot
      ? [...currentSnapshot]
      : [...baseSnapshots];
    nextSnapshots[idx] = latestSnapshot;
    const result = getFragmentResult(cacheKey, nextSnapshots, storeEpoch);
    if (
      RelayFeatureFlags.ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE &&
      result.isMissingData
    ) {
      this._cache.set(cacheKey, {
        kind: 'missing',
        result,
        snapshot: nextSnapshots,
      });
    } else {
      this._cache.set(cacheKey, {
        kind: 'done',
        result,
      });
    }
  }
}

function reportInvalidCachedData(nodeName: string): void {
  invariant(
    false,
    'Relay: Expected to find cached data for plural fragment `%s` when ' +
      'receiving a subscription. ' +
      "If you're seeing this, this is likely a bug in Relay.",
    nodeName,
  );
}

function createFragmentResource(environment: IEnvironment): FragmentResource {
  return new FragmentResourceImpl(environment);
}

const dataResources: IMap<IEnvironment, FragmentResource> = WEAKMAP_SUPPORTED
  ? new WeakMap()
  : new Map();

function getFragmentResourceForEnvironment(
  environment: IEnvironment,
): FragmentResourceImpl {
  const cached = dataResources.get(environment);
  if (cached) {
    return cached;
  }
  const newDataResource = createFragmentResource(environment);
  dataResources.set(environment, newDataResource);
  return newDataResource;
}

module.exports = {
  createFragmentResource,
  getFragmentResourceForEnvironment,
};
