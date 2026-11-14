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
    query observeFragmentTestToPromiseQuery {
      me {
        ...observeFragmentTestToPromiseFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestToPromiseFragment on User {
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
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.me);
  const result = await observable.toPromise();
  expect(result).toEqual({state: 'ok', value: {name: 'Elizabeth'}});
});

test('resolver suspense suspends', async () => {
  const query = graphql`
    query observeFragmentTestToResolverSuspenseQuery {
      me {
        ...observeFragmentTestToResolverSuspenseFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestToResolverSuspenseFragment on User {
      counter_suspends_when_odd
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
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.me);
  withObservableValues(observable, results => {
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    expect(results).toEqual([
      {state: 'ok', value: {counter_suspends_when_odd: 0}},
      {state: 'loading'},
      {state: 'ok', value: {counter_suspends_when_odd: 2}},
      {state: 'loading'},
    ]);
  });
});

test('Missing required data', async () => {
  const query = graphql`
    query observeFragmentTestMissingRequiredQuery {
      me {
        ...observeFragmentTestMissingRequiredFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestMissingRequiredFragment on User {
      name @required(action: THROW)
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
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.me);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          // fieldValue is null (server returned null), no server error
          "Relay: Missing @required value at path 'name' in 'observeFragmentTestMissingRequiredFragment': the server returned null.",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Keep loading on network error', async () => {
  const query = graphql`
    query observeFragmentTestNetworkErrorQuery {
      ...observeFragmentTestNetworkErrorFragment
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestNetworkErrorFragment on Query {
      me {
        name
      }
    }
  `;

  const environment = createMockEnvironment();
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  fetchQuery(environment, query, variables).subscribe({});
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type] Data is untyped
  const observable = observeFragment(environment, fragment, data);
  withObservableValues(observable, results => {
    expect(results).toEqual([{state: 'loading'}]);
    environment.mock.reject(operation, new Error('Network error'));
    expect(results).toEqual([{state: 'loading'}]);
  });
});

test('Field error with @throwOnFieldError', async () => {
  const query = graphql`
    query observeFragmentTestThrowOnFieldErrorQuery {
      me {
        ...observeFragmentTestThrowOnFieldErrorFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestThrowOnFieldErrorFragment on User
    @throwOnFieldError {
      name
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

  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.me);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          "Relay: Received a field error in the server response for field 'name' in 'observeFragmentTestThrowOnFieldErrorFragment'. Message: error",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Resolver error with @throwOnFieldError', async () => {
  const query = graphql`
    query observeFragmentTestResolverErrorWithThrowOnFieldErrorQuery {
      me {
        ...observeFragmentTestResolverErrorWithThrowOnFieldErrorFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestResolverErrorWithThrowOnFieldErrorFragment on User
    @throwOnFieldError {
      always_throws
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {me: {id: '7', __typename: 'User'}});
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.me);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          "Relay: Resolver error at path 'always_throws' in 'observeFragmentTestResolverErrorWithThrowOnFieldErrorFragment'. Message: I always throw. What did you expect?",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Resolver with client edge to server object', async () => {
  const query = graphql`
    query observeFragmentTestClientEdgeToServerQuery {
      me {
        ...observeFragmentTestClientEdgeToServerFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestClientEdgeToServerFragment on User {
      client_edge @waterfall {
        name
      }
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {me: {id: '7', __typename: 'User'}});
  const {data} = environment.lookup(operation.fragment);
  let result;
  try {
    // $FlowFixMe[incompatible-type]
    // $FlowFixMe[incompatible-use] Data is untyped
    const observable = observeFragment(environment, fragment, data.me);
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

test('read deferred fragment', async () => {
  const query = graphql`
    query observeFragmentTestDeferQuery {
      me {
        ...observeFragmentTestDeferFragment @defer
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestDeferFragment on User {
      name
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

  // Note: Running environment.execute() here does not populate the response
  // cache which breaks our ability to suspend, so we must use fetchQuery
  // instead.
  fetchQuery(environment, query, variables).subscribe({});

  invariant(dataSource != null, 'Expected data source to be set');

  dataSource.next({data: {me: {id: '1', __typename: 'User'}}});

  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.me);
  withObservableValues(observable, results => {
    dataSource.next({
      data: {id: '1', __typename: 'User', name: 'Elizabeth'},
      label:
        'observeFragmentTestDeferQuery$defer$observeFragmentTestDeferFragment',
      path: ['me'],
      extensions: {is_final: true},
    });
    expect(results).toEqual([
      {state: 'loading'},
      {state: 'ok', value: {name: 'Elizabeth'}},
    ]);
  });
});

test('observes a plural fragment', async () => {
  const query = graphql`
    query observeFragmentTestPluralQuery {
      nodes(ids: ["1", "2"]) {
        ...observeFragmentTestPluralFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestPluralFragment on User @relay(plural: true) {
      name
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    nodes: [
      {id: '1', __typename: 'User', name: 'Alice'},
      {id: '2', __typename: 'User', name: 'Bob'},
    ],
  });
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.nodes);
  const result = await observable.toPromise();
  expect(result).toEqual({
    state: 'ok',
    value: [{name: 'Alice'}, {name: 'Bob'}],
  });
});

test('Missing required data on plural fragment', async () => {
  const query = graphql`
    query observeFragmentTestMissingRequiredPluralQuery {
      nodes(ids: ["1", "2"]) {
        ...observeFragmentTestMissingRequiredPluralFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestMissingRequiredPluralFragment on User
    @relay(plural: true) {
      name @required(action: THROW)
    }
  `;

  const environment = createMockEnvironment();
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    nodes: [
      // Name is null despite being required
      {id: '1', __typename: 'User', name: null},
      {id: '2', __typename: 'User', name: 'Bob'},
    ],
  });

  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.nodes);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          // fieldValue is null (server returned null), no server error
          "Relay: Missing @required value at path 'name' in 'observeFragmentTestMissingRequiredPluralFragment': the server returned null.",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Field error with @relay(plural: true) @throwOnFieldError', async () => {
  const query = graphql`
    query observeFragmentTestPluralThrowOnFieldErrorQuery {
      nodes(ids: ["1", "2"]) {
        ...observeFragmentTestPluralThrowOnFieldErrorFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestPluralThrowOnFieldErrorFragment on User
    @relay(plural: true)
    @throwOnFieldError {
      name
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
    data: {
      nodes: [
        {id: '1', __typename: 'User', name: null},
        {id: '2', __typename: 'User', name: 'Bob'},
      ],
    },
    errors: [{message: 'error', path: ['nodes', 0, 'name']}],
  });

  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.nodes);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          "Relay: Received a field error in the server response for field 'name' in 'observeFragmentTestPluralThrowOnFieldErrorFragment'. Message: error",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Resolver error with @relay(plural: true) @throwOnFieldError', async () => {
  const query = graphql`
    query observeFragmentTestResolverErrorWithPluralThrowOnFieldErrorQuery {
      nodes(ids: ["7", "8"]) {
        ...observeFragmentTestResolverErrorWithPluralThrowOnFieldErrorFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestResolverErrorWithPluralThrowOnFieldErrorFragment on User
    @relay(plural: true)
    @throwOnFieldError {
      always_throws
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    nodes: [
      {id: '7', __typename: 'User'},
      {id: '8', __typename: 'User'},
    ],
  });
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.nodes);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {
        error: new Error(
          "Relay: Resolver error at path 'always_throws' in 'observeFragmentTestResolverErrorWithPluralThrowOnFieldErrorFragment'. Message: I always throw. What did you expect?",
        ),
        state: 'error',
      },
    ]);
  });
});

test('Store update across list items notifies multiple times', async () => {
  const query = graphql`
    query observeFragmentTestListUpdateQuery {
      nodes(ids: ["1", "2"]) {
        ...observeFragmentTestListUpdateFragment
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestListUpdateFragment on User
    @relay(plural: true) {
      name
    }
  `;

  const environment = createMockEnvironment({
    store: new LiveResolverStore(new RelayRecordSource()),
  });
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    nodes: [
      {id: '1', __typename: 'User', name: 'Alice'},
      {id: '2', __typename: 'User', name: 'Bob'},
    ],
  });
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-use] Data is untyped
  const observable = observeFragment(environment, fragment, data.nodes);
  withObservableValues(observable, results => {
    expect(results).toEqual([
      {state: 'ok', value: [{name: 'Alice'}, {name: 'Bob'}]},
    ]);

    environment.commitPayload(operation, {
      nodes: [
        {id: '1', __typename: 'User', name: 'Alice updated'},
        {id: '2', __typename: 'User', name: 'Bob updated'},
      ],
    });
    expect(results).toEqual([
      {state: 'ok', value: [{name: 'Alice'}, {name: 'Bob'}]},
      {state: 'ok', value: [{name: 'Alice updated'}, {name: 'Bob'}]},
      {state: 'ok', value: [{name: 'Alice updated'}, {name: 'Bob updated'}]},
    ]);
  });
});

test('data goes missing due to unrelated query response', async () => {
  const query = graphql`
    query observeFragmentTestMissingDataQuery {
      ...observeFragmentTestMissingDataFragment
    }
  `;

  const unrelatedQuery = graphql`
    query observeFragmentTestMissingDataUnrelatedQuery {
      me {
        # Does not fetch name
        __typename
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestMissingDataFragment on Query {
      me {
        name
      }
    }
  `;

  const environment = createMockEnvironment();
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    me: {id: '7', __typename: 'User', name: 'Elizabeth'},
  });
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type] Data is untyped
  const observable = observeFragment(environment, fragment, data);

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
    query observeFragmentTestMissingDataThrowOnFieldErrorQuery {
      ...observeFragmentTestMissingDataThrowOnFieldErrorFragment
    }
  `;

  const unrelatedQuery = graphql`
    query observeFragmentTestMissingDataUnrelatedThrowOnFieldErrorQuery {
      me {
        # Does not fetch name
        __typename
      }
    }
  `;

  const fragment = graphql`
    fragment observeFragmentTestMissingDataThrowOnFieldErrorFragment on Query
    @throwOnFieldError {
      me {
        name
      }
    }
  `;

  const environment = createMockEnvironment();
  const variables = {};
  const operation = createOperationDescriptor(query, variables);
  environment.commitPayload(operation, {
    me: {id: '7', __typename: 'User', name: 'Elizabeth'},
  });
  const {data} = environment.lookup(operation.fragment);
  // $FlowFixMe[incompatible-type] Data is untyped
  const observable = observeFragment(environment, fragment, data);

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
