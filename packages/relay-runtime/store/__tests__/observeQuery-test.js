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

import type {GraphQLResponse} from '../../network/RelayNetworkTypes';
import type {Sink} from '../../network/RelayObservable';
import type {RequestParameters} from 'relay-runtime/util/RelayConcreteNode';
import type {
  CacheConfig,
  Variables,
} from 'relay-runtime/util/RelayRuntimeTypes';

const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const fetchQuery = require('../../query/fetchQuery');
const {graphql} = require('../../query/GraphQLTag');
const LiveResolverStore = require('../live-resolvers/LiveResolverStore');
const {observeFragment} = require('../observeFragmentExperimental');
const {observeQuery} = require('../observeQueryExperimental');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayRecordSource = require('../RelayRecordSource');
const {GLOBAL_STORE} = require('./resolvers/ExampleExternalStateStore');
const invariant = require('invariant');
const {createMockEnvironment} = require('relay-test-utils-internal');

afterEach(() => {
  GLOBAL_STORE.reset();
});

test('toPromise state ok', async () => {
  const query = graphql`
    query observeQueryTestToPromiseQuery {
      me {
        name
      }
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    me: {id: '7', __typename: 'User', name: 'Elizabeth'},
  });
  const observable = observeQuery(environment, query, variables);
  const result = await observable.toPromise();
  expect(result).toEqual({state: 'ok', value: {me: {name: 'Elizabeth'}}});
});

test('toPromise state ok chain with observeFragment', async () => {
  const query = graphql`
    query observeQueryTestToPromiseChainQuery {
      me @required(action: THROW) {
        ...observeQueryTestToPromiseFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeQueryTestToPromiseFragment on User {
      name
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    me: {id: '7', __typename: 'User', name: 'Elizabeth'},
  });
  const observable = observeQuery(environment, query, variables);
  const result = await observable.toPromise();
  if (result == null || result.state !== 'ok') {
    throw new Error('Expected state to be ok');
  }
  const fragmentObservable = observeFragment(
    environment,
    fragment,
    result.value.me,
  );

  const fragmentResult = await fragmentObservable.toPromise();

  expect(fragmentResult).toEqual({state: 'ok', value: {name: 'Elizabeth'}});
});

test('resolver suspense suspends', async () => {
  const query = graphql`
    query observeQueryTestToResolverSuspenseQuery {
      me {
        counter_suspends_when_odd
      }
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    me: {id: '7', __typename: 'User', name: 'Elizabeth'},
  });
  const observable = observeQuery(environment, query, variables);
  withObservableValues(observable, results => {
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    expect(results).toEqual([
      {state: 'ok', value: {me: {counter_suspends_when_odd: 0}}},
      {state: 'loading'},
      {state: 'ok', value: {me: {counter_suspends_when_odd: 2}}},
      {state: 'loading'},
    ]);
  });
});

test('Missing required data', async () => {
  const query = graphql`
    query observeQueryTestMissingRequiredQuery {
      me {
        name @required(action: THROW)
      }
    }
  `;

  const environment = createMockEnvironment();
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    me: {
      id: '7',
      __typename: 'User',
      // Name is null despite being required
      name: null,
    },
  });
  const observable = observeQuery(environment, query, variables);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          // fieldValue is null (server returned null), no server error
          "Relay: Missing @required value at path 'me.name' in 'observeQueryTestMissingRequiredQuery': the server returned null.",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Keep loading on network error', async () => {
  const query = graphql`
    query observeQueryTestNetworkErrorQuery {
      me {
        name
      }
    }
  `;

  const environment = createMockEnvironment();
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  fetchQuery(environment, query, variables).subscribe({});
  const observable = observeQuery(environment, query, variables);
  withObservableValues(observable, results => {
    expect(results).toEqual([{state: 'loading'}]);
    environment.mock.reject(operation, new Error('Network error'));
    expect(results).toEqual([{state: 'loading'}]);
  });
});

test('Field error with @throwOnFieldError', async () => {
  const query = graphql`
    query observeQueryTestThrowOnFieldErrorQuery @throwOnFieldError {
      me {
        name
      }
    }
  `;

  let dataSource: Sink<GraphQLResponse>;
  const fetch = (
    _query: RequestParameters,
    _variables: Variables,
    _cacheConfig: CacheConfig,
  ) => {
    // $FlowFixMe[missing-local-annot] Error found while enabling LTI on this file
    return RelayObservable.create(sink => {
      dataSource = sink;
    });
  };

  const environment = createMockEnvironment({
    network: RelayNetwork.create(fetch),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);

  environment.execute({operation}).subscribe({});
  invariant(dataSource != null, 'Expected data source to be set');
  dataSource.next({
    data: {me: {id: '1', __typename: 'User', name: null}},
    errors: [{message: 'error', path: ['me', 'name']}],
  });

  const observable = observeQuery(environment, query, variables);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          "Relay: Received a field error in the server response for field 'me.name' in 'observeQueryTestThrowOnFieldErrorQuery'. Message: error",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Resolver error with @throwOnFieldError', async () => {
  const query = graphql`
    query observeQueryTestResolverErrorWithThrowOnFieldErrorQuery
    @throwOnFieldError {
      me {
        always_throws
      }
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {me: {id: '7', __typename: 'User'}});
  const observable = observeQuery(environment, query, variables);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          "Relay: Resolver error at path 'me.always_throws' in 'observeQueryTestResolverErrorWithThrowOnFieldErrorQuery'. Message: I always throw. What did you expect?",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Resolver with client edge to server object', async () => {
  const query = graphql`
    query observeQueryTestClientEdgeToServerQuery {
      me {
        client_edge @waterfall {
          name
        }
      }
    }
  `;
  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {me: {id: '7', __typename: 'User'}});
  let result;
  try {
    const observable = observeQuery(environment, query, variables);
    // Today we never get to this, but once client edges are supported, we will
    withObservableValues(observable, results => {
      expect(results).toEqual([{state: 'error'}]);
    });
  } catch (e) {
    result = e;
  }
  // Until we support client edges, we throw an error
  expect(result?.message).toEqual("Client edges aren't supported yet.");
});

test('data goes missing due to unrelated query response', async () => {
  const query = graphql`
    query observeQueryTestMissingDataQuery {
      me {
        name
      }
    }
  `;

  const unrelatedQuery = graphql`
    query observeQueryTestMissingDataUnrelatedQuery {
      me {
        # Does not fetch name
        __typename
      }
    }
  `;

  const environment = createMockEnvironment();
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    me: {id: '7', __typename: 'User', name: 'Elizabeth'},
  });
  const observable = observeQuery(environment, query, variables);

  // Now an unrelated query comes in and changes the Query.me relationship to a
  // new user, but does not fetch `name` for that user. Now we are missing data
  // for the initial fragment, but there is no request in flight to fetch it.
  const unrelatedOperation = createOperationDescriptor(unrelatedQuery, {});
  withObservableValues(observable, results => {
    environment.commitPayload(unrelatedOperation, {
      // Note: This is a _different_ user than last time
      me: {id: '99', __typename: 'User'},
    });
    expect(results).toEqual([
      {state: 'ok', value: {me: {name: 'Elizabeth'}}},
      {state: 'ok', value: {me: {name: undefined}}},
    ]);
  });
});

test('data goes missing due to unrelated query response (@throwOnFieldErrro)', async () => {
  const query = graphql`
    query observeQueryTestMissingDataThrowOnFieldErrorQuery @throwOnFieldError {
      me {
        name
      }
    }
  `;

  const unrelatedQuery = graphql`
    query observeQueryTestMissingDataUnrelatedThrowOnFieldErrorQuery {
      me {
        # Does not fetch name
        __typename
      }
    }
  `;

  const environment = createMockEnvironment();
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    me: {id: '7', __typename: 'User', name: 'Elizabeth'},
  });
  const observable = observeQuery(environment, query, variables);

  // Now an unrelated query comes in and changes the Query.me relationship to a
  // new user, but does not fetch `name` for that user. Now we are missing data
  // for the initial fragment, but there is no request in flight to fetch it.
  const unrelatedOperation = createOperationDescriptor(unrelatedQuery, {});
  withObservableValues(observable, results => {
    environment.commitPayload(unrelatedOperation, {
      // Note: This is a _different_ user than last time
      me: {id: '99', __typename: 'User'},
    });
    expect(results).toEqual([
      {state: 'ok', value: {me: {name: 'Elizabeth'}}},
      {state: 'error', error: expect.anything()},
    ]);
  });
});

// Helper function to test that a given Observable emits the expected values.
// The callback is called with an array of the values emitted by the Observable.
// The array is mutated as values are emitted, so the callback can always check
// the current state of the array.
function withObservableValues<T>(
  observable: RelayObservable<T>,
  callback: (values: Array<T>) => void,
) {
  const values = [];
  const subscription = observable.subscribe({
    next: value => values.push(value),
  });
  callback(values);
  subscription.unsubscribe();
}
