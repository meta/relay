/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 * @jest-environment jsdom
 */

'use strict';

import type {Observer, Sink, Subscription} from 'relay-runtime';

const loadQueryModule = require('../loadQuery');
const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const usePreloadedQuery = require('../usePreloadedQuery');
const useQueryLoader = require('../useQueryLoader');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const {
  Network,
  Observable,
  PreloadableQueryRegistry,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');

const query = graphql`
  query useQueryLoaderMultipleCallsTestQuery($id: ID!) {
    node(id: $id) {
      id
    }
  }
`;

const preloadableConcreteRequest = {
  kind: 'PreloadableConcreteRequest' as const,
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

// Only queries with an ID are preloadable
const ID = '12345';
(query.params as $FlowFixMe).id = ID;

const variables = {id: '4'};

let environment;
let fetch;
let sink;
let executeObservable;
let networkUnsubscribe;

beforeEach(() => {
  jest.spyOn(loadQueryModule, 'loadQuery');

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

  const originalExecuteWithSource =
    environment.executeWithSource.getMockImplementation();
  executeObservable = undefined;

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
          const executeUnsubscribeFn = jest.fn<
            ReadonlyArray<unknown>,
            unknown,
          >();
          return {unsubscribe: executeUnsubscribeFn};
        });
      return executeObservable;
    });
});

describe('when loading and disposing same query multiple times', () => {
  it('loads correctly when ast is loaded in between calls to load and initial query ref is disposed', async () => {
    let loadedQuery;
    let queryLoaderCallback;

    const QueryRenderer = function ({queryRef}: $FlowFixMe) {
      const data = usePreloadedQuery(query, queryRef);
      return data.node?.id;
    };
    const Inner = function ({
      initialPreloadedQuery,
    }: {
      initialPreloadedQuery: $FlowFixMe,
    }) {
      [loadedQuery, queryLoaderCallback] = useQueryLoader(
        preloadableConcreteRequest,
        initialPreloadedQuery,
      );
      return (
        <React.Suspense fallback="Loading">
          {loadedQuery != null ? (
            <QueryRenderer queryRef={loadedQuery} />
          ) : null}
        </React.Suspense>
      );
    };
    // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
    const Container = function ({initialPreloadedQuery = undefined}: {}) {
      return (
        <RelayEnvironmentProvider environment={environment}>
          <Inner initialPreloadedQuery={initialPreloadedQuery} />
        </RelayEnvironmentProvider>
      );
    };
    let instance;
    const render = async () => {
      await act(() => {
        instance = ReactTestingLibrary.render(
          <RelayEnvironmentProvider environment={environment}>
            <Container />
          </RelayEnvironmentProvider>,
        );
      });
    };
    await render();
    if (!instance) {
      throw new Error('Expected renderer instance to be defined');
    }

    await act(() => {
      queryLoaderCallback(variables);
      // Provide the query module ast
      PreloadableQueryRegistry.set(ID, query);
      queryLoaderCallback(variables);
    });
    expect(instance.container.textContent).toEqual('Loading');

    await act(() => {
      sink.next(response);
      sink.complete();
      jest.runAllImmediates();
    });

    expect(instance.container.textContent).toEqual('4');
  });
});
