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

/* global jest */

import type {
  CacheConfig,
  ConcreteRequest,
  EnvironmentConfig,
  GraphQLSingularResponse,
  GraphQLTaggedNode,
  IEnvironment,
  OperationDescriptor,
  RequestParameters,
  Variables,
} from 'relay-runtime';
import type {Sink} from 'relay-runtime/network/RelayObservable';

const areEqual = require('areEqual');
const invariant = require('invariant');
const {
  Environment,
  Network,
  Observable,
  QueryResponseCache,
  RecordSource,
  Store,
  createOperationDescriptor,
  getRequest,
} = require('relay-runtime');

type PendingRequest = {
  readonly request: RequestParameters,
  readonly variables: Variables,
  readonly cacheConfig: CacheConfig,
  readonly sink: Sink<GraphQLSingularResponse>,
};

const MAX_SIZE = 10;
const MAX_TTL = 5 * 60 * 1000; // 5 min

function mockInstanceMethod(object: $FlowFixMe, key: string) {
  object[key] = jest.fn(object[key].bind(object));
}

function mockDisposableMethod(object: $FlowFixMe, key: string) {
  const fn = object[key].bind(object);
  object[key] = jest.fn((...args) => {
    const disposable = fn(...args);
    const dispose = jest.fn(() => disposable.dispose());
    object[key].mock.dispose = dispose;
    return {dispose};
  });
  const mockClear = object[key].mockClear.bind(object[key]);
  object[key].mockClear = () => {
    mockClear();
    object[key].mock.dispose = null;
  };
}

function mockObservableMethod(object: $FlowFixMe, key: string) {
  const fn = object[key].bind(object);
  const subscriptions = [];
  object[key] = jest.fn((...args) =>
    fn(...args).do({
      start: subscription => {
        subscriptions.push(subscription);
      },
    }),
  );
  object[key].mock.subscriptions = subscriptions;
  const mockClear = object[key].mockClear.bind(object[key]);
  object[key].mockClear = () => {
    mockClear();
    object[key].mock.subscriptions = [];
  };
}

type OperationMockResolver = (
  operation: OperationDescriptor,
) => ?GraphQLSingularResponse | ?Error;

type MockFunctions = {
  readonly clearCache: () => void,
  readonly cachePayload: (
    request: ConcreteRequest | OperationDescriptor,
    variables: Variables,
    payload: GraphQLSingularResponse,
  ) => void,
  readonly isLoading: (
    request: ConcreteRequest | OperationDescriptor,
    variables: Variables,
    cacheConfig?: CacheConfig,
  ) => boolean,
  readonly reject: (
    request: ConcreteRequest | OperationDescriptor,
    error: Error | string,
  ) => void,
  readonly nextValue: (
    request: ConcreteRequest | OperationDescriptor,
    payload: GraphQLSingularResponse,
  ) => void,
  readonly complete: (request: ConcreteRequest | OperationDescriptor) => void,
  readonly resolve: (
    request: ConcreteRequest | OperationDescriptor,
    payload: ReadonlyArray<GraphQLSingularResponse> | GraphQLSingularResponse,
  ) => void,
  readonly getAllOperations: () => ReadonlyArray<OperationDescriptor>,
  readonly findOperation: (
    findFn: (operation: OperationDescriptor) => boolean,
  ) => OperationDescriptor,
  readonly queuePendingOperation: (
    query: GraphQLTaggedNode,
    variables: Variables,
  ) => void,
  readonly getMostRecentOperation: () => OperationDescriptor,
  readonly resolveMostRecentOperation: (
    payload: | GraphQLSingularResponse
    | ((operation: OperationDescriptor) => GraphQLSingularResponse),
  ) => void,
  readonly rejectMostRecentOperation: (
    error: Error | ((operation: OperationDescriptor) => Error),
  ) => void,
  readonly queueOperationResolver: (resolver: OperationMockResolver) => void,
};

interface MockEnvironment {
  readonly mock: MockFunctions;
  readonly mockClear: () => void;
}

export interface RelayMockEnvironment extends MockEnvironment, IEnvironment {}

/**
 * Creates an instance of the `Environment` interface defined in
 * RelayStoreTypes with a mocked network layer.
 *
 * Usage:
 *
 * ```
 * const environment = RelayModernMockEnvironment.createMockEnvironment();
 * ```
 *
 * Mock API:
 *
 * Helpers are available as `environment.mock.<helper>`:
 *
 * - `isLoading(query, variables): boolean`: Determine whether the given query
 *   is currently being loaded (not yet rejected/resolved).
 * - `reject(query, error: Error): void`: Reject a query that has been fetched
 *   by the environment.
 * - `resolve(query, payload: PayloadData): void`: Resolve a query that has been
 *   fetched by the environment.
 * - `nextValue(...) - will add payload to the processing, but won't complete
 *   the request ()
 * - getAllOperations() - every time there is an operation created by
 *   the Relay Component (query, mutation, subscription) this operation will be
 *   added to the internal list on the Mock Environment. This method will return
 *   an array of all pending operations in the order they occurred.
 * - findOperation(findFn) - should find operation if findFn(...) return `true`
 *   for it. Otherwise, it will throw.
 * - getMostRecentOperation(...) - should return the most recent operation
 *   generated by Relay Component.
 * - resolveMostRecentOperation(...) - is accepting `GraphQLSingularResponse` or a
 *   callback function that will receive `operation` and should return
 *  `GraphQLSingularResponse`
 * - rejectMostRecentOperation(...) - should reject the most recent operation
 *   with a specific error
 */
function createMockEnvironment(
  config?: Partial<EnvironmentConfig>,
): RelayMockEnvironment {
  const store = config?.store ?? new Store(new RecordSource());
  const cache = new QueryResponseCache({
    size: MAX_SIZE,
    ttl: MAX_TTL,
  });

  let pendingRequests: ReadonlyArray<PendingRequest> = [];
  let pendingOperations: ReadonlyArray<OperationDescriptor> = [];
  const queuePendingOperation = (
    query: GraphQLTaggedNode,
    variables: Variables,
  ): void => {
    const operationDescriptor = createOperationDescriptor(
      getRequest(query),
      variables,
    );
    pendingOperations = pendingOperations.concat([operationDescriptor]);
  };
  let resolversQueue: ReadonlyArray<OperationMockResolver> = [];

  // When loadQuery() is used, network.execute() is called BEFORE executeWithSource() which
  // adds the operation to pendingOperations. We store pending matches here so that
  // when createExecuteProxy adds the operation, we can resolve it using already queued resolvers.
  // Used for scenarios when queing resolvers for refetchable fragments.
  type PendingMatch = {
    +request: RequestParameters,
    +variables: Variables,
    +resolve: (operation: OperationDescriptor) => void,
  };
  let pendingMatches: Array<PendingMatch> = [];

  const queueOperationResolver = (resolver: OperationMockResolver): void => {
    resolversQueue = resolversQueue.concat([resolver]);
  };

  const requestMatchesOperation = (
    request: RequestParameters,
    variables: Variables,
    operation: OperationDescriptor,
  ): boolean => {
    const requestId = request.cacheID ?? request.id ?? request.text;
    const opParams = operation.request.node.params;
    const opRequestId = opParams.cacheID ?? opParams.id ?? opParams.text;
    return (
      requestId === opRequestId &&
      areEqual(variables, operation.request.variables)
    );
  };

  const tryExecuteQueuedResolver = (
    operation: OperationDescriptor,
    sink: Sink<GraphQLSingularResponse>,
    pendingRequest: PendingRequest,
  ): boolean => {
    if (resolversQueue.length === 0) {
      return false;
    }

    const currentResolver = resolversQueue[0];
    const result = currentResolver(operation);
    if (result != null) {
      resolversQueue = resolversQueue.filter(r => r !== currentResolver);
      pendingOperations = pendingOperations.filter(op => op !== operation);
      pendingRequests = pendingRequests.filter(r => r !== pendingRequest);

      if (result instanceof Error) {
        sink.error(result);
      } else {
        sink.next(result);
        sink.complete();
      }
      return true;
    }
    return false;
  };

  const execute = (
    request: RequestParameters,
    variables: Variables,
    cacheConfig: CacheConfig,
  ) => {
    const {id, text} = request;
    const cacheID = id ?? text;

    let cachedPayload = null;
    if (
      (cacheConfig?.force == null || cacheConfig?.force === false) &&
      cacheID != null
    ) {
      cachedPayload = cache.get(cacheID, variables);
    }
    if (cachedPayload !== null) {
      // $FlowFixMe[incompatible-type]
      return Observable.from<GraphQLSingularResponse>(cachedPayload);
    }

    return Observable.create<GraphQLSingularResponse>(sink => {
      const nextRequest = {request, variables, cacheConfig, sink};
      pendingRequests = pendingRequests.concat([nextRequest]);

      const currentOperation = pendingOperations.find(op =>
        requestMatchesOperation(request, variables, op),
      );
      if (currentOperation != null) {
        if (tryExecuteQueuedResolver(currentOperation, sink, nextRequest)) {
          return () => {};
        }
      }

      if (resolversQueue.length > 0) {
        pendingMatches.push({
          request,
          variables,
          resolve: (operation: OperationDescriptor) => {
            tryExecuteQueuedResolver(operation, sink, nextRequest);
          },
        });
      }

      return () => {
        pendingRequests = pendingRequests.filter(
          pending => !areEqual(pending, nextRequest),
        );
        pendingMatches = pendingMatches.filter(
          m =>
            !(areEqual(m.request, request) && areEqual(m.variables, variables)),
        );
        const opToRemove = pendingOperations.find(op =>
          requestMatchesOperation(request, variables, op),
        );
        pendingOperations = pendingOperations.filter(op => op !== opToRemove);
      };
    });
  };

  function getConcreteRequest(
    input: ConcreteRequest | OperationDescriptor,
  ): ConcreteRequest {
    if (input.kind === 'Request') {
      const request: ConcreteRequest = input as $FlowFixMe;
      return request;
    } else {
      const operationDescriptor: OperationDescriptor = input as $FlowFixMe;
      invariant(
        pendingOperations.includes(operationDescriptor),
        'RelayModernMockEnvironment: Operation "%s" was not found in the list of pending operations',
        operationDescriptor.request.node.operation.name,
      );
      return operationDescriptor.request.node;
    }
  }

  // The same request may be made by multiple query renderers
  function getRequests(
    input: ConcreteRequest | OperationDescriptor,
  ): ReadonlyArray<PendingRequest> {
    let concreteRequest: ConcreteRequest;
    let operationDescriptor: OperationDescriptor;
    if (input.kind === 'Request') {
      concreteRequest = input as $FlowFixMe;
    } else {
      operationDescriptor = input as $FlowFixMe;
      concreteRequest = operationDescriptor.request.node;
    }
    const foundRequests = pendingRequests.filter(pending => {
      if (!areEqual(pending.request, concreteRequest.params)) {
        return false;
      }
      if (operationDescriptor) {
        // If we handling `OperationDescriptor` we also need to check variables
        // and return only pending request with equal variables
        return areEqual(
          operationDescriptor.request.variables,
          pending.variables,
        );
      } else {
        // In the case we received `ConcreteRequest` as input we will return
        // all pending request, even if they have different variables
        return true;
      }
    });
    invariant(
      foundRequests.length,
      'MockEnvironment: Cannot respond to request, it has not been requested yet.',
    );
    foundRequests.forEach(foundRequest => {
      invariant(
        foundRequest.sink,
        'MockEnvironment: Cannot respond to `%s`, it has not been requested yet.',
        concreteRequest.params.name,
      );
    });
    return foundRequests;
  }

  function ensureValidPayload(payload: GraphQLSingularResponse) {
    invariant(
      typeof payload === 'object' &&
        /* $FlowFixMe[invalid-compare] Error discovered during Constant
         * Condition roll out. See https://fburl.com/workplace/5whu3i34. */
        payload !== null &&
        payload.hasOwnProperty('data'),
      'MockEnvironment(): Expected payload to be an object with a `data` key.',
    );
    return payload;
  }

  const cachePayload = (
    request: ConcreteRequest | OperationDescriptor,
    variables: Variables,
    payload: GraphQLSingularResponse,
  ): void => {
    const {id, text} = getConcreteRequest(request).params;
    const cacheID = id ?? text;
    invariant(cacheID != null, 'CacheID should not be null');

    cache.set(cacheID, variables, payload);
  };

  const clearCache = (): void => {
    cache.clear();
  };

  // Helper to determine if a given query/variables pair is pending
  const isLoading = (
    request: ConcreteRequest | OperationDescriptor,
    variables: Variables,
    cacheConfig?: CacheConfig,
  ): boolean => {
    return pendingRequests.some(
      pending =>
        areEqual(pending.request, getConcreteRequest(request).params) &&
        areEqual(pending.variables, variables) &&
        areEqual(pending.cacheConfig, cacheConfig ?? {}),
    );
  };

  // Helpers to reject or resolve the payload for an individual request.
  const reject = (
    request: ConcreteRequest | OperationDescriptor,
    error: Error | string,
  ): void => {
    const rejectError = typeof error === 'string' ? new Error(error) : error;
    getRequests(request).forEach(foundRequest => {
      const {sink} = foundRequest;
      /* $FlowFixMe[invalid-compare] Error discovered during Constant Condition
       * roll out. See https://fburl.com/workplace/5whu3i34. */
      invariant(sink !== null, 'Sink should be defined.');
      sink.error(rejectError);
    });
  };

  const nextValue = (
    request: ConcreteRequest | OperationDescriptor,
    payload: GraphQLSingularResponse,
  ): void => {
    getRequests(request).forEach(foundRequest => {
      const {sink} = foundRequest;
      /* $FlowFixMe[invalid-compare] Error discovered during Constant Condition
       * roll out. See https://fburl.com/workplace/5whu3i34. */
      invariant(sink !== null, 'Sink should be defined.');
      sink.next(ensureValidPayload(payload));
    });
  };

  const complete = (request: ConcreteRequest | OperationDescriptor): void => {
    getRequests(request).forEach(foundRequest => {
      const {sink} = foundRequest;
      /* $FlowFixMe[invalid-compare] Error discovered during Constant Condition
       * roll out. See https://fburl.com/workplace/5whu3i34. */
      invariant(sink !== null, 'Sink should be defined.');
      sink.complete();
    });
  };

  const resolve = (
    request: ConcreteRequest | OperationDescriptor,
    response: ReadonlyArray<GraphQLSingularResponse> | GraphQLSingularResponse,
  ): void => {
    getRequests(request).forEach(foundRequest => {
      const {sink} = foundRequest;
      /* $FlowFixMe[invalid-compare] Error discovered during Constant Condition
       * roll out. See https://fburl.com/workplace/5whu3i34. */
      invariant(sink !== null, 'Sink should be defined.');
      const payloads = Array.isArray(response) ? response : [response];
      payloads.forEach(payload => {
        sink.next(ensureValidPayload(payload));
      });
      sink.complete();
    });
  };

  const getMostRecentOperation = (): OperationDescriptor => {
    const mostRecentOperation = pendingOperations[pendingOperations.length - 1];
    invariant(
      mostRecentOperation != null,
      'RelayModernMockEnvironment: There are no pending operations in the list',
    );
    return mostRecentOperation;
  };

  const findOperation = (
    findFn: (operation: OperationDescriptor) => boolean,
  ): OperationDescriptor => {
    const pendingOperation = pendingOperations.find(findFn);
    invariant(
      pendingOperation != null,
      'RelayModernMockEnvironment: Operation was not found in the list of pending operations',
    );
    return pendingOperation;
  };

  // $FlowExpectedError[incompatible-type]
  const environment: RelayMockEnvironment = new Environment({
    configName: 'RelayModernMockEnvironment',
    network: Network.create(execute, execute),
    store,
    ...config,
  });

  const createExecuteProxy = (
    env: IEnvironment,
    fn:
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      | IEnvironment['execute']
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      | IEnvironment['executeSubscription']
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      | IEnvironment['executeWithSource']
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      | IEnvironment['executeMutation'],
  ) => {
    return (...argumentsList: $FlowFixMe) => {
      const [{operation}] = argumentsList;
      pendingOperations = pendingOperations.concat([operation]);

      const matchIndex = pendingMatches.findIndex(m =>
        requestMatchesOperation(m.request, m.variables, operation),
      );
      if (matchIndex >= 0) {
        const match = pendingMatches[matchIndex];
        pendingMatches = [
          ...pendingMatches.slice(0, matchIndex),
          ...pendingMatches.slice(matchIndex + 1),
        ];
        match.resolve(operation);
      }

      return fn.apply(env, argumentsList);
    };
  };

  // $FlowExpectedError[cannot-write]
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  /* $FlowFixMe[incompatible-type] Error exposed after fixing this typing
   * unsoundness in flow */
  environment.execute = createExecuteProxy(environment, environment.execute);
  // $FlowExpectedError[cannot-write]
  environment.executeSubscription = createExecuteProxy(
    environment,
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    /* $FlowFixMe[incompatible-type] Error exposed after fixing this typing
     * unsoundness in flow */
    environment.executeSubscription,
  );
  // $FlowExpectedError[cannot-write]
  environment.executeWithSource = createExecuteProxy(
    environment,
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    /* $FlowFixMe[incompatible-type] Error exposed after fixing this typing
     * unsoundness in flow */
    environment.executeWithSource,
  );
  // $FlowExpectedError[cannot-write]
  environment.executeMutation = createExecuteProxy(
    environment,
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    /* $FlowFixMe[incompatible-type] Error exposed after fixing this typing
     * unsoundness in flow */
    environment.executeMutation,
  );

  // $FlowFixMe[incompatible-type]
  /* $FlowFixMe[invalid-compare] Error discovered during Constant Condition
   * roll out. See https://fburl.com/workplace/4oq3zi07. */
  if (global?.process?.env?.NODE_ENV === 'test') {
    // Mock all the functions with their original behavior
    mockDisposableMethod(environment, 'applyUpdate');
    mockInstanceMethod(environment, 'commitPayload');
    mockInstanceMethod(environment, 'getStore');
    mockInstanceMethod(environment, 'lookup');
    mockInstanceMethod(environment, 'check');
    mockDisposableMethod(environment, 'subscribe');
    mockDisposableMethod(environment, 'retain');
    mockObservableMethod(environment, 'execute');
    mockObservableMethod(environment, 'executeSubscription');
    mockObservableMethod(environment, 'executeWithSource');
    mockObservableMethod(environment, 'executeMutation');

    mockInstanceMethod(store, 'getSource');
    mockInstanceMethod(store, 'lookup');
    mockInstanceMethod(store, 'notify');
    mockInstanceMethod(store, 'publish');
    mockDisposableMethod(store, 'retain');
    mockDisposableMethod(store, 'subscribe');
  }

  const mock: MockFunctions = {
    cachePayload,
    clearCache,
    isLoading,
    reject,
    resolve,
    nextValue,
    complete,
    getMostRecentOperation,
    resolveMostRecentOperation(payload): void {
      const operation = getMostRecentOperation();
      const data = typeof payload === 'function' ? payload(operation) : payload;
      return resolve(operation, data);
    },
    rejectMostRecentOperation(error): void {
      const operation = getMostRecentOperation();
      const rejector = typeof error === 'function' ? error(operation) : error;
      return reject(operation, rejector);
    },
    findOperation,
    queuePendingOperation,
    getAllOperations() {
      return pendingOperations;
    },
    queueOperationResolver,
  };

  // $FlowExpectedError[cannot-write]
  environment.mock = mock;

  // $FlowExpectedError[cannot-write]
  environment.mockClear = () => {
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.applyUpdate.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.commitPayload.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.getStore.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.lookup.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.check.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.subscribe.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.retain.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.execute.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.executeMutation.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.executeSubscription.mockClear();

    // $FlowExpectedError[prop-missing]
    store.getSource().clear?.();

    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    store.getSource.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    store.lookup.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    store.notify.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    store.publish.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    store.retain.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    store.subscribe.mockClear();

    cache.clear();
    pendingOperations = [];
    pendingRequests = [];
    pendingMatches = [];
  };

  return environment;
}

module.exports = {createMockEnvironment};
