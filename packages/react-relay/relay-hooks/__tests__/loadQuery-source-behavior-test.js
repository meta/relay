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
  LoadQueryOptions,
  PreloadableConcreteRequest,
} from '../EntryPointTypes.flow';
import type {loadQuerySourceBehaviorTestQuery} from './__generated__/loadQuerySourceBehaviorTestQuery.graphql';
import type {
  Observer,
  OperationType,
  Query,
  Sink,
  Subscription,
} from 'relay-runtime';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';

const {loadQuery} = require('../loadQuery');
const {
  Network,
  Observable,
  PreloadableQueryRegistry,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');
const {
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

const query = graphql`
  query loadQuerySourceBehaviorTestQuery($id: ID!) {
    node(id: $id) {
      id
    }
  }
`;

const preloadableConcreteRequest: PreloadableConcreteRequest<loadQuerySourceBehaviorTestQuery> =
  {
    kind: 'PreloadableConcreteRequest',
    params: query.params,
  };

const response = {
  data: {
    node: {
      __typename: 'User',
      id: '4',
    },
  },
  extensions: {
    is_final: true,
  },
};

const networkError = new Error('A wild, uncaught error appeared');

// Only queries with an ID are preloadable
const ID = '12345';
(query.params as $FlowFixMe).id = ID;

const variables = {id: '4'};

let callLoadQuery;
let environment;
let fetch;
let writeDataToStore;
let sink;
let next: JestMockFn<Array<GraphQLResponse>, empty>;
let error: JestMockFn<Array<Error>, empty>;
let complete: JestMockFn<Array<empty>, empty>;
let executeObservable;
let executeUnsubscribe: ?JestMockFn<ReadonlyArray<unknown>, unknown>;
let networkUnsubscribe;

beforeEach(() => {
  next = jest.fn();
  error = jest.fn();
  complete = jest.fn();

  // In several tests, we expect unhandled errors from network requests
  // that emit errors after the query reference has been disposed.
  // The default behavior when encountering unhandled errors is to fail
  // the current test.
  //
  // Re-enable the default, test-failing behavior here; it is turned off
  // in tests where unhandled errors are expected.
  Observable.onUnhandledError(uncaughtError => {
    declare function fail(message: string): void;
    if (typeof fail === 'function') {
      // In test environments (Jest), fail() immediately fails the current test.
      fail(String(uncaughtError));
    }
  });
  PreloadableQueryRegistry.clear();

  fetch = jest.fn((_query, _variables, _cacheConfig) => {
    // $FlowFixMe[missing-local-annot] Error found while enabling LTI on this file
    const observable = Observable.create(_sink => {
      sink = _sink;
    });
    const originalSubscribe: (
      observer: Observer<unknown> | Sink<unknown>,
    ) => Subscription = observable.subscribe.bind(observable);
    networkUnsubscribe = jest.fn<[], $FlowFixMe>();
    jest.spyOn(observable, 'subscribe').mockImplementation((...args) => {
      const subscription = originalSubscribe(...args);
      jest
        .spyOn(subscription, 'unsubscribe')
        .mockImplementation(() => networkUnsubscribe());
      return subscription;
    });
    return observable;
  });

  // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
  environment = createMockEnvironment({network: Network.create(fetch)});
  const store = environment.getStore();
  const operation = createOperationDescriptor(query, variables);

  const originalExecuteWithSource =
    environment.executeWithSource.getMockImplementation();
  executeObservable = undefined;
  executeUnsubscribe = undefined;

  jest
    .spyOn(environment, 'executeWithSource')
    .mockImplementation((...params) => {
      executeObservable = originalExecuteWithSource(...params);
      const originalSubscribe =
        executeObservable.subscribe.bind(executeObservable);
      jest
        .spyOn(executeObservable, 'subscribe')
        .mockImplementation(subscriptionCallbacks => {
          originalSubscribe(subscriptionCallbacks);
          executeUnsubscribe = jest.fn();
          return {unsubscribe: executeUnsubscribe};
        });
      return executeObservable;
    });

  writeDataToStore = () => {
    loadQuery(environment, preloadableConcreteRequest, variables);
    sink.next(response);
    sink.complete();
    PreloadableQueryRegistry.set(ID, query);
    expect(store.check(operation).status).toBe('available');
    // N.B. we are not testing the case where data is written to the store
    // from other sources after loadQuery is complete, so clearing the
    // PreloadableQueryRegistry is a sane thing to do.
    PreloadableQueryRegistry.clear();
  };

  callLoadQuery = <TOperation extends OperationType>(
    queryAstOrRequest:
      | Query<TOperation['variables'], TOperation['response']>
      | PreloadableConcreteRequest<TOperation>,
    options?: LoadQueryOptions,
    // $FlowFixMe[missing-local-annot]
  ) => {
    const loadedQuery = loadQuery(
      environment,
      queryAstOrRequest,
      variables,
      options,
    );
    expect(fetch).toHaveBeenCalled();

    next = jest.fn();
    error = jest.fn();
    complete = jest.fn();
    if (loadedQuery.source) {
      loadedQuery.source.subscribe({
        complete,
        error,
        next,
      });
    }

    return loadedQuery;
  };
});

describe('when passed a PreloadableConcreteRequest', () => {
  describe('when the query AST is available synchronously', () => {
    it('should pass network responses onto source', () => {
      PreloadableQueryRegistry.set(ID, query);
      callLoadQuery(preloadableConcreteRequest);

      expect(next).not.toHaveBeenCalled();
      sink.next(response);
      expect(next).toHaveBeenCalledWith(response);
    });

    it('should dedupe network request if called multiple times', () => {
      PreloadableQueryRegistry.set(ID, query);
      const res1 = callLoadQuery(preloadableConcreteRequest);
      const res2 = callLoadQuery(preloadableConcreteRequest);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(res1.source).toBeDefined();
      expect(res2.source).toBeDefined();
      // Each query reference should retain the query even
      // if we made a single request.
      expect(environment.retain).toHaveBeenCalledTimes(2);
    });

    it('should pass network errors onto source', () => {
      PreloadableQueryRegistry.set(ID, query);
      callLoadQuery(preloadableConcreteRequest);

      expect(error).not.toHaveBeenCalled();
      sink.error(networkError);
      expect(error).toHaveBeenCalledWith(networkError);
    });

    describe('when dispose is called before the network response is available', () => {
      it('should not pass network responses onto source', () => {
        PreloadableQueryRegistry.set(ID, query);
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        dispose();
        sink.next(response);
        expect(next).not.toHaveBeenCalled();
      });
      it('should not pass network errors onto source', done => {
        PreloadableQueryRegistry.set(ID, query);
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        dispose();

        // We expect an unhandled error here from the network emitting an
        // error after the network.execute observable has been unsubcribed
        Observable.onUnhandledError(() => done());
        sink.error(networkError);
        expect(error).not.toHaveBeenCalled();
      });
    });
  });

  describe('when the query is unavailable synchronously', () => {
    it('should dedupe network request if called multiple times', () => {
      const res1 = callLoadQuery(preloadableConcreteRequest);
      const res2 = callLoadQuery(preloadableConcreteRequest);
      expect(fetch).toHaveBeenCalledTimes(1);

      expect(res1.source).toBeDefined();
      expect(res2.source).toBeDefined();

      // When the query ast becomes available we each query reference
      // should retain the query even if we made a single request.
      PreloadableQueryRegistry.set(ID, query);
      expect(environment.retain).toHaveBeenCalledTimes(2);
    });
    it('should dedupe operation execution if called multiple times', () => {
      const res1 = callLoadQuery(preloadableConcreteRequest);
      const res2 = callLoadQuery(preloadableConcreteRequest);
      expect(fetch).toHaveBeenCalledTimes(1);

      PreloadableQueryRegistry.set(ID, query);
      // We only process the network request once.
      expect(environment.executeWithSource).toBeCalledTimes(1);
      expect(res1.source).toBeDefined();
      expect(res2.source).toBeDefined();
      // Each query reference should retain the query even
      // if we made a single request.
      expect(environment.retain).toHaveBeenCalledTimes(2);
    });

    describe('when the query AST is available before the network response', () => {
      it('should pass network responses onto source', () => {
        callLoadQuery(preloadableConcreteRequest);

        expect(next).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(next).not.toHaveBeenCalled();
        sink.next(response);
        expect(next).toHaveBeenCalledWith(response);
      });
      it('should pass network errors onto source', () => {
        callLoadQuery(preloadableConcreteRequest);

        expect(error).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(error).not.toHaveBeenCalled();
        sink.error(networkError);
        expect(error).toHaveBeenCalledWith(networkError);
      });
    });

    describe('when the network response is available before the query AST', () => {
      it('should pass network responses onto source', () => {
        callLoadQuery(preloadableConcreteRequest);

        expect(next).not.toHaveBeenCalled();
        sink.next(response);
        expect(next).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(next).toHaveBeenCalledWith(response);
      });
      it('should pass network errors onto source', () => {
        callLoadQuery(preloadableConcreteRequest);

        expect(error).not.toHaveBeenCalled();
        sink.error(networkError);
        expect(error).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(error).toHaveBeenCalledWith(networkError);
      });
    });

    describe('when dispose is called before the query AST and network response are available', () => {
      it('should not pass network responses onto source', () => {
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        dispose();
        sink.next(response);
        expect(next).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(next).not.toHaveBeenCalled();
      });
      it('should not pass network errors onto source', done => {
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        dispose();

        // We expect an unhandled error here from the network emitting an
        // error after the network.execute observable has been unsubcribed
        Observable.onUnhandledError(() => done());
        sink.error(networkError);
        expect(error).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(error).not.toHaveBeenCalled();
      });
    });
    describe('when dispose is called before the network response and query AST are available', () => {
      it('should not pass network responses onto source', () => {
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        dispose();
        sink.next(response);
        expect(next).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(next).not.toHaveBeenCalled();
      });
      it('should not pass network errors onto source', done => {
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        dispose();

        // We expect an unhandled error here from the network emitting an
        // error after the network.execute observable has been unsubcribed
        Observable.onUnhandledError(() => done());
        sink.error(networkError);
        expect(error).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(error).not.toHaveBeenCalled();
      });
    });
    describe('when dispose is called after the network response and before the query AST are available', () => {
      it('should not pass network responses onto source', () => {
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        sink.next(response);
        expect(next).not.toHaveBeenCalled();
        dispose();
        expect(next).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(next).not.toHaveBeenCalled();
      });
      it('should not pass network errors onto source', () => {
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        sink.error(networkError);
        expect(error).not.toHaveBeenCalled();
        dispose();
        expect(error).not.toHaveBeenCalled();
        PreloadableQueryRegistry.set(ID, query);
        expect(error).not.toHaveBeenCalled();
      });
    });
    describe('when dispose is called after the query AST and before the network response are available', () => {
      it('should not pass network responses onto source', () => {
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        PreloadableQueryRegistry.set(ID, query);
        expect(next).not.toHaveBeenCalled();
        dispose();
        sink.next(response);
        expect(next).not.toHaveBeenCalled();
      });
      it('should not pass network errors onto source', done => {
        const {dispose} = callLoadQuery(preloadableConcreteRequest);

        PreloadableQueryRegistry.set(ID, query);
        expect(error).not.toHaveBeenCalled();
        dispose();

        // We expect an unhandled error here from the network emitting an
        // error after the network.execute observable has been unsubcribed
        Observable.onUnhandledError(() => done());
        sink.error(networkError);
        expect(error).not.toHaveBeenCalled();
      });
    });

    describe('when loading and disposing same query multiple times', () => {
      it('loads correctly when ast is loaded in between calls to load and initial query ref is disposed', () => {
        // This test case simulates what happens in useQueryLoader or useEntryPointLoader, where the load
        // function can be called multiple times, and all previous query references corresponding to prior
        // calls to load will get disposed

        // Start initial load of query
        const queryRef1 = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {fetchPolicy: 'store-or-network'},
        );

        // Assert that we start a network request, but we can't start
        // processing results (executeWithSource) since the query ast module
        // isn't available yet.
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(environment.executeWithSource).toBeCalledTimes(0);

        // Provide the query module ast
        PreloadableQueryRegistry.set(ID, query);
        // Assert that we are now able to start processing query results.
        expect(environment.executeWithSource).toBeCalledTimes(1);

        // Start second load of query
        const queryRef2 = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {fetchPolicy: 'store-or-network'},
        );

        // Assert that we don't start a new network request or
        // processing execution, since they should be deduped with
        // the ones already in flight.
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(environment.executeWithSource).toBeCalledTimes(1);

        // Dispose of the initial query reference, like
        // useQueryLoader or useEntryPointLoader would
        queryRef1.dispose();
        expect(networkUnsubscribe).toHaveBeenCalledTimes(0);
        expect(executeUnsubscribe).toHaveBeenCalledTimes(0);

        // Provide the initial response from the network
        sink.next(response);
        sink.complete();

        // Subscribe to the query reference and assert that
        // we can observe the query results
        queryRef2.source?.subscribe({
          complete,
          error,
          next,
        });
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(response);
        expect(complete).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe.each(['before', 'between', 'after'])(
  'deduplicated execution disposal with AST registration %s the two loads',
  registration => {
    function loadTwoReferences() {
      if (registration === 'before') {
        PreloadableQueryRegistry.set(ID, query);
      }
      const first = loadQuery(
        environment,
        preloadableConcreteRequest,
        variables,
        {fetchPolicy: 'network-only'},
      );
      if (registration === 'between') {
        PreloadableQueryRegistry.set(ID, query);
      }
      const second = loadQuery(
        environment,
        preloadableConcreteRequest,
        variables,
        {fetchPolicy: 'network-only'},
      );
      if (registration === 'after') {
        PreloadableQueryRegistry.set(ID, query);
      }
      expect(fetch).toHaveBeenCalledTimes(1);
      return [first, second];
    }

    it.each([
      [0, 1],
      [1, 0],
    ])(
      'releases the execution only after disposing refs %i then %i',
      (firstIndex: number, lastIndex: number) => {
        const refs = loadTwoReferences();
        refs[firstIndex].dispose();
        expect(executeUnsubscribe).not.toHaveBeenCalled();
        expect(networkUnsubscribe).not.toHaveBeenCalled();
        refs[lastIndex].dispose();
        expect(executeUnsubscribe).toHaveBeenCalledTimes(1);
        refs[lastIndex].dispose();
        refs[firstIndex].dispose();
        expect(executeUnsubscribe).toHaveBeenCalledTimes(1);
      },
    );

    it('releases followers even after the shared execution settles without completing', () => {
      const [creator, follower] = loadTwoReferences();
      sink.next(response);
      const operation = createOperationDescriptor(query, variables);
      expect(environment.isRequestActive(operation.request.identifier)).toBe(
        false,
      );
      creator.dispose();
      expect(executeUnsubscribe).not.toHaveBeenCalled();
      follower.dispose();
      expect(executeUnsubscribe).toHaveBeenCalledTimes(1);
    });
  },
);

describe('when passed a query AST', () => {
  it('should pass network responses onto source', () => {
    callLoadQuery<loadQuerySourceBehaviorTestQuery>(query);

    expect(next).not.toHaveBeenCalled();
    sink.next(response);
    expect(next).toHaveBeenCalledWith(response);
  });

  it('should pass network errors onto source', () => {
    callLoadQuery<loadQuerySourceBehaviorTestQuery>(query);

    expect(error).not.toHaveBeenCalled();
    sink.error(networkError);
    expect(error).toHaveBeenCalledWith(networkError);
  });

  describe('when dispose is called before the network response is available', () => {
    it('should not pass network responses onto source', () => {
      const {dispose} = callLoadQuery<loadQuerySourceBehaviorTestQuery>(query);

      dispose();
      sink.next(response);
      expect(next).not.toHaveBeenCalled();
    });
    it('should not pass network errors onto source', done => {
      const {dispose} = callLoadQuery<loadQuerySourceBehaviorTestQuery>(query);

      dispose();

      // We expect an unhandled error here from the network emitting an
      // error after the network.execute observable has been unsubcribed
      Observable.onUnhandledError(() => done());
      sink.error(networkError);
      expect(error).not.toHaveBeenCalled();
    });
  });
});

describe("with the query fulfillable from the store and fetchPolicy === 'network-only'", () => {
  it('should pass network responses onto source', () => {
    writeDataToStore();
    PreloadableQueryRegistry.set(ID, query);
    callLoadQuery(preloadableConcreteRequest, {fetchPolicy: 'network-only'});

    expect(next).not.toHaveBeenCalled();
    sink.next(response);
    expect(next).toHaveBeenCalledWith(response);
  });

  it('should pass network errors onto source', () => {
    writeDataToStore();
    PreloadableQueryRegistry.set(ID, query);
    callLoadQuery(preloadableConcreteRequest, {fetchPolicy: 'network-only'});

    expect(error).not.toHaveBeenCalled();

    sink.error(networkError);
    expect(error).toHaveBeenCalledWith(networkError);
  });

  describe('when dispose is called before the network response is available', () => {
    it('should not pass network responses onto source', () => {
      writeDataToStore();
      PreloadableQueryRegistry.set(ID, query);
      const {dispose} = callLoadQuery(preloadableConcreteRequest, {
        fetchPolicy: 'network-only',
      });

      dispose();
      sink.next(response);
      expect(next).not.toHaveBeenCalled();
    });
    it('should not pass network errors onto source', done => {
      writeDataToStore();
      PreloadableQueryRegistry.set(ID, query);
      const {dispose} = callLoadQuery(preloadableConcreteRequest, {
        fetchPolicy: 'network-only',
      });

      dispose();

      // We expect an unhandled error here from the network emitting an
      // error after the network.execute observable has been unsubcribed
      Observable.onUnhandledError(() => done());
      sink.error(networkError);
      expect(error).not.toHaveBeenCalled();
    });
  });
});
