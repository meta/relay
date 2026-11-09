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
  CheckOperation,
  OperationAvailabilityConfig,
} from '../../relay-runtime/network/RelayNetworkTypes';
import type {
  EnvironmentProviderOptions,
  LoadQueryOptions,
  PreloadableConcreteRequest,
  PreloadedQueryInner,
} from './EntryPointTypes.flow';
import type {
  ConcreteRequest,
  FetchPolicy,
  GraphQLResponse,
  GraphQLTaggedNode,
  IEnvironment,
  OperationDescriptor,
  OperationType,
  Query,
  RequestIdentifier,
  RequestParameters,
} from 'relay-runtime';

const {isExecTimeResolversEnabled} = require('./execTimeResolvers');
const invariant = require('invariant');
const {
  __internal: {fetchQueryDeduped},
  Observable,
  PreloadableQueryRegistry,
  ReplaySubject,
  createOperationDescriptor,
  getRequest,
  getRequestIdentifier,
} = require('relay-runtime');

const DEFAULT_FETCH_POLICY: FetchPolicy = 'store-or-network';
const DEFAULT_LIVE_FETCH_POLICY: FetchPolicy = 'store-and-network';

function getDefaultFetchPolicy(request: ConcreteRequest): FetchPolicy {
  if (
    request.params.metadata.live !== undefined ||
    isExecTimeResolversEnabled(request.operation)
  ) {
    return DEFAULT_LIVE_FETCH_POLICY;
  }
  if (request.params.id == null && request.params.text == null) {
    // A client-only query using read-time resolvers has no server operation to fetch.
    return 'store-only';
  }
  return DEFAULT_FETCH_POLICY;
}

let fetchKey = 100001;

export type QueryType<T> =
  T extends Query<infer V, infer D, infer RR>
    ? {
        variables: V,
        response: D,
        rawResponse?: NonNullable<RR>,
      }
    : [readonly t: T] extends [readonly t: PreloadableConcreteRequest<infer V>]
      ? V
      : empty;

declare function loadQuery<
  T,
  TEnvironmentProviderOptions = EnvironmentProviderOptions,
>(
  environment: IEnvironment,
  preloadableRequest: T,
  variables: QueryType<T>['variables'],
  options?: ?LoadQueryOptions,
  environmentProviderOptions?: ?TEnvironmentProviderOptions,
): PreloadedQueryInner<QueryType<T>, TEnvironmentProviderOptions>;

function loadQuery<
  TQuery extends OperationType,
  TEnvironmentProviderOptions = EnvironmentProviderOptions,
>(
  environment: IEnvironment,
  preloadableRequest: PreloadableConcreteRequest<TQuery>,
  variables: TQuery['variables'],
  options?: ?LoadQueryOptions,
  environmentProviderOptions?: ?TEnvironmentProviderOptions,
): PreloadedQueryInner<TQuery, TEnvironmentProviderOptions> {
  // Every time you call loadQuery, we will generate a new fetchKey.
  // This will ensure that every query reference that is created and
  // passed to usePreloadedQuery is independently evaluated,
  // even if they are for the same query/variables.
  // Specifically, we want to avoid a case where we try to refetch a
  // query by calling loadQuery a second time, and have the Suspense
  // cache in usePreloadedQuery reuse the cached result instead of
  // re-evaluating the new query ref and triggering a refetch if
  // necessary.
  fetchKey++;

  const providedFetchPolicy = options?.fetchPolicy;
  // Keep the existing default for params-only preloadable requests. Full
  // ConcreteRequests get an exec-time-aware default below.
  let fetchPolicy: FetchPolicy = providedFetchPolicy ?? DEFAULT_FETCH_POLICY;
  const networkCacheConfig = {
    force: true,
    ...options?.networkCacheConfig,
  };

  // executeWithNetworkSource will retain and execute an operation
  // against the Relay store, given an Observable that would provide
  // the network events for the operation.
  let retainReference;
  let didExecuteNetworkSource = false;
  const checkOperation: CheckOperation = candidateOperation =>
    environment.check(candidateOperation);
  const executeWithNetworkSource = (
    operation: OperationDescriptor,
    networkObservable: Observable<GraphQLResponse>,
  ): Observable<GraphQLResponse> => {
    didExecuteNetworkSource = true;
    return environment.executeWithSource({
      operation,
      source: networkObservable,
    });
  };

  // N.B. For loadQuery, we unconventionally want to return an Observable
  // that isn't lazily executed, meaning that we don't want to wait
  // until the returned Observable is subscribed to to actually start
  // fetching and executing an operation; i.e. we want to execute the
  // operation eagerly, when loadQuery is called.
  // For this reason, we use an intermediate executionSubject which
  // allows us to capture the events that occur during the eager execution
  // of the operation, and then replay them to the Observable we
  // ultimately return.
  const executionSubject = new ReplaySubject<GraphQLResponse>();
  const returnedObservable = Observable.create<GraphQLResponse>(sink =>
    executionSubject.subscribe(sink),
  );

  let unsubscribeFromNetworkRequest;
  let networkError = null;
  // makeNetworkRequest will immediately start a raw network request if
  // one isn't already in flight and return an Observable that when
  // subscribed to will replay the network events that have occurred so far,
  // as well as subsequent events.
  let didMakeNetworkRequest = false;
  const makeNetworkRequest = (
    params: RequestParameters,
    parentOperation: ?OperationDescriptor,
  ): Observable<GraphQLResponse> => {
    // N.B. this function is called synchronously or not at all
    // didMakeNetworkRequest is safe to rely on in the returned value
    // Even if the request gets deduped below, we still wan't to return an
    // observable that provides the replayed network events for the query,
    // so we set this to true before deduping, to guarantee that the
    // `source` observable is returned.
    didMakeNetworkRequest = true;

    const subject = new ReplaySubject<GraphQLResponse>();

    // Here, we are calling fetchQueryDeduped at the network layer level,
    // which ensures that only a single network request is active for a given
    // (environment, identifier) pair.
    // Since network requests can be started /before/ we have the query ast
    // necessary to process the results, we need to dedupe the raw requests
    // separately from deduping the operation execution; specifically,
    // if `loadQuery` is called multiple times before the query ast is available,
    // we still want the network request to be deduped.
    // - If a duplicate active network request is found, it will return an
    // Observable that replays the events of the already active request.
    // - If no duplicate active network request is found, it will call the fetchFn
    // to start the request, and return an Observable that will replay
    // the events from the network request.
    // We provide an extra key to the identifier to distinguish deduping
    // of raw network requests vs deduping of operation executions.
    const identifier: RequestIdentifier =
      'raw-network-request-' + getRequestIdentifier(params, variables);
    const observable = fetchQueryDeduped(environment, identifier, () => {
      const network = environment.getNetwork();
      const operationAvailability: OperationAvailabilityConfig = {
        checkOperation,
        parentOperation,
      };
      return network.execute(
        params,
        variables,
        networkCacheConfig,
        undefined,
        undefined,
        undefined,
        undefined,
        operationAvailability,
      );
    });

    const {unsubscribe} = observable.subscribe({
      complete() {
        subject.complete();
      },
      error(err) {
        networkError = err;
        subject.error(err);
      },
      next(data) {
        subject.next(data);
      },
    });
    unsubscribeFromNetworkRequest = unsubscribe;
    return Observable.create(sink => {
      const subjectSubscription = subject.subscribe(sink);
      return () => {
        subjectSubscription.unsubscribe();
        unsubscribeFromNetworkRequest();
      };
    });
  };

  let unsubscribeFromExecution;
  const executeDeduped = (
    operation: OperationDescriptor,
    fetchFn: () => Observable<GraphQLResponse>,
  ) => {
    // N.B. at this point, if we're calling execute with a query ast (OperationDescriptor),
    // we are guaranteed to have started a network request. We set this to
    // true here as well since `makeNetworkRequest` might get skipped in the case
    // where the query ast is already available and the query executions get deduped.
    // Even if the execution gets deduped below, we still wan't to return
    // an observable that provides the replayed network events for the query,
    // so we set this to true before deduping, to guarantee that the `source`
    // observable is returned.
    didMakeNetworkRequest = true;

    // Here, we are calling fetchQueryDeduped, which ensures that only
    // a single operation is active for a given (environment, identifier) pair,
    // and also tracks the active state of the operation, which is necessary
    // for our Suspense infra to later be able to suspend (or not) on
    // active operations. Even though we already dedupe raw network requests,
    // we also need to dedupe and keep track operation execution for our Suspense
    // infra, and we also want to avoid processing responses more than once, for
    // the cases where `loadQuery` might be called multiple times after the query ast
    // is available.
    // - If a duplicate active operation is found, it will return an
    // Observable that replays the events of the already active operation.
    // - If no duplicate active operation is found, it will call the fetchFn
    // to execute the operation, and return an Observable that will provide
    // the events for executing the operation.
    ({unsubscribe: unsubscribeFromExecution} = fetchQueryDeduped(
      environment,
      operation.request.identifier,
      fetchFn,
    ).subscribe({
      complete() {
        executionSubject.complete();
      },
      error(err) {
        executionSubject.error(err);
      },
      next(data) {
        executionSubject.next(data);
      },
    }));
  };

  const checkAvailabilityAndExecute = (concreteRequest: ConcreteRequest) => {
    if (providedFetchPolicy == null) {
      fetchPolicy = getDefaultFetchPolicy(concreteRequest);
    }
    const operation = createOperationDescriptor(
      concreteRequest,
      variables,
      networkCacheConfig,
    );
    retainReference = environment.retain(operation);
    if (fetchPolicy === 'store-only') {
      return;
    }

    // N.B. If the fetch policy allows fulfillment from the store but the
    // environment already has the data for that operation cached in the store,
    // then we do nothing.
    const shouldFetch =
      fetchPolicy !== 'store-or-network' ||
      // environment.check can trigger store updates through missing field handlers,
      // short circuiting the check avoids unnecessary updates
      environment.check(operation).status !== 'available';

    if (shouldFetch) {
      executeDeduped(operation, () => {
        // N.B. Since we have the operation synchronously available here,
        // we can immediately fetch and execute the operation.
        const networkObservable = makeNetworkRequest(
          concreteRequest.params,
          operation,
        );
        const executeObservable = executeWithNetworkSource(
          operation,
          networkObservable,
        );
        return executeObservable;
      });
    }
  };

  let params;
  let cancelOnLoadCallback: () => void;
  let queryId;
  if (preloadableRequest.kind === 'PreloadableConcreteRequest') {
    const preloadableConcreteRequest: PreloadableConcreteRequest<TQuery> =
      preloadableRequest as $FlowFixMe;
    ({params} = preloadableConcreteRequest);

    queryId = params.id ?? params.cacheID;
    invariant(
      queryId != null,
      'Relay: `loadQuery` requires that preloadable query `%s` has a persisted query id or cache id',
      params.name,
    );

    const module = PreloadableQueryRegistry.get(queryId);

    if (module != null) {
      checkAvailabilityAndExecute(module);
    } else {
      // If the module isn't synchronously available, we launch the
      // network request immediately if the fetchPolicy might produce
      // a network fetch, regardless of the state of the store cache. We
      // do this because we can't check if a query is cached without the
      // ast, and we know that if we don't have the query ast
      // available, then this query could've never been written to the
      // store in the first place, so it couldn't have been cached.
      const shouldCheckAvailabilityOnLoad =
        fetchPolicy !== 'store-only' &&
        params.id == null &&
        params.text == null;
      const networkObservable =
        fetchPolicy === 'store-only' || shouldCheckAvailabilityOnLoad
          ? null
          : makeNetworkRequest(params, null);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      /* $FlowFixMe[incompatible-type] Error exposed after fixing this typing
       * unsoundness in flow */
      ({dispose: cancelOnLoadCallback} = PreloadableQueryRegistry.onLoad(
        queryId,
        preloadedModule => {
          cancelOnLoadCallback();
          if (shouldCheckAvailabilityOnLoad) {
            checkAvailabilityAndExecute(preloadedModule);
            return;
          }
          if (providedFetchPolicy == null) {
            fetchPolicy = getDefaultFetchPolicy(preloadedModule);
          }
          const operation = createOperationDescriptor(
            preloadedModule,
            variables,
            networkCacheConfig,
          );
          retainReference = environment.retain(operation);
          if (networkObservable != null) {
            executeDeduped(operation, () => {
              const network = environment.getNetwork();
              const executeWithPreloadedSource =
                network.executeWithPreloadedSource;
              const source =
                preloadedModule.params.metadata.operation == null ||
                executeWithPreloadedSource == null
                  ? networkObservable
                  : executeWithPreloadedSource(
                      preloadedModule.params,
                      variables,
                      networkCacheConfig,
                      networkObservable,
                      {
                        checkOperation,
                        parentOperation: operation,
                      },
                    );
              return executeWithNetworkSource(operation, source);
            });
          }
        },
      ));
    }
  } else {
    const graphQlTaggedNode: GraphQLTaggedNode =
      preloadableRequest as $FlowFixMe;
    const request = getRequest(graphQlTaggedNode);
    params = request.params;
    queryId = params.cacheID != null ? params.cacheID : params.id;
    checkAvailabilityAndExecute(request);
  }

  let isDisposed = false;
  let isReleased = false;
  let isNetworkRequestCancelled = false;
  const releaseQuery = () => {
    if (isReleased) {
      return;
    }
    retainReference && retainReference.dispose();
    isReleased = true;
  };
  const cancelNetworkRequest = () => {
    if (isNetworkRequestCancelled) {
      return;
    }
    if (unsubscribeFromExecution != null) {
      unsubscribeFromExecution();
    }
    if (!didExecuteNetworkSource) {
      /* $FlowFixMe[constant-condition] Error discovered during Constant
       * Condition roll out. See https://fburl.com/workplace/1v97vimq. */
      unsubscribeFromNetworkRequest && unsubscribeFromNetworkRequest();
    }
    /* $FlowFixMe[constant-condition] Error discovered during Constant
     * Condition roll out. See https://fburl.com/workplace/1v97vimq. */
    cancelOnLoadCallback && cancelOnLoadCallback();
    isNetworkRequestCancelled = true;
  };
  const preloadedQuery = {
    cancelNetworkRequest,
    dispose() {
      if (isDisposed) {
        return;
      }
      releaseQuery();
      cancelNetworkRequest();
      isDisposed = true;
    },
    environment,
    environmentProviderOptions,
    fetchKey,
    // $FlowFixMe[unsafe-getters-setters] - this has no side effects
    get fetchPolicy() {
      return fetchPolicy;
    },
    id: queryId,
    // $FlowFixMe[unsafe-getters-setters] - this has no side effects
    get isDisposed() {
      return isDisposed || isReleased;
    },
    kind: 'PreloadedQuery' as const,
    name: params.name,
    networkCacheConfig,
    // $FlowFixMe[unsafe-getters-setters] - this has no side effects
    get networkError() {
      return networkError;
    },
    releaseQuery,
    // $FlowFixMe[unsafe-getters-setters] - this has no side effects
    get source() {
      return didMakeNetworkRequest ? returnedObservable : undefined;
    },
    variables,
  };
  return preloadedQuery;
}

module.exports = {
  loadQuery,
};
