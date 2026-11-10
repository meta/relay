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
import type {Snapshot} from '../../RelayStoreTypes';

const {
  live_external_greeting: LiveExternalGreeting,
} = require('./LiveExternalGreeting');
const {__debug: LiveUserSuspendsWhenOdd} = require('./LiveUserSuspendsWhenOdd');
const {suspenseSentinel} = require('relay-runtime');
const RelayNetwork = require('relay-runtime/network/RelayNetwork');
const {graphql} = require('relay-runtime/query/GraphQLTag');
const {
  GLOBAL_STORE,
  resetStore,
} = require('relay-runtime/store/__tests__/resolvers/ExampleExternalStateStore');
const RelayModernEnvironment = require('relay-runtime/store/RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('relay-runtime/store/RelayModernOperationDescriptor');
const RelayModernStore = require('relay-runtime/store/RelayModernStore');
const RelayRecordSource = require('relay-runtime/store/RelayRecordSource');
const {
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

beforeEach(() => {
  resetStore();
});

const SUSPENDS_QUERY = graphql`
  query LiveResolversTestUnsubscribesWhenSuspendsQuery {
    user: live_user_suspends_when_odd @waterfall {
      id
    }
    greeting: live_external_greeting
  }
`;

const OPTIMISTIC_UPDATES_QUERY = graphql`
  query LiveResolversTestOptimisticUpdatesQuery {
    me {
      greeting
    }
  }
`;

const OPTIMISTIC_UPDATES_MUTATION = graphql`
  mutation LiveResolversTestOptimisticUpdatesMutation(
    $input: ActorNameChangeInput!
  ) {
    actorNameChange(input: $input) {
      actor {
        name
      }
    }
  }
`;

test('unsubscribe happens when record is updated due to missing data', () => {
  const source = RelayRecordSource.create({
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
    },
    '0': {
      __id: '0',
      __typename: 'User',
      id: '0',
      name: 'user 0',
    },
    '1': {
      __id: '1',
      __typename: 'User',
      id: '1',
      name: 'user 1',
    },
    '2': {
      __id: '2',
      __typename: 'User',
      id: '2',
      name: 'user 2',
    },
  });
  const operation = createOperationDescriptor(SUSPENDS_QUERY, {});
  const store = new RelayModernStore(source, {
    gcReleaseBufferSize: 0,
  });
  const environment = new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store,
  });

  const snapshot = environment.lookup(operation.fragment);
  // lookup() doesn't have the nice types of reading a fragment through the actual APIs
  let data: $FlowFixMe = snapshot.data;
  const environmentUpdateHandler = jest.fn(() => {
    data = environment.lookup(operation.fragment).data;
  });
  // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
  environment.subscribe(snapshot, environmentUpdateHandler);

  const {__debug} = LiveExternalGreeting;

  // Initial values
  expect(environmentUpdateHandler).not.toHaveBeenCalled();
  expect(data.user.id).toBe('0');
  expect(data.greeting).toBe('Welcome user 0');
  expect(__debug.state.subscribers.size).toBe(1);

  // Make `live_user_suspends_when_odd` update & suspend
  GLOBAL_STORE.dispatch({type: 'INCREMENT'});
  expect(environmentUpdateHandler).toHaveBeenCalledTimes(1);
  expect(data.user).toBe(suspenseSentinel());
  expect(data.greeting).toBe(undefined);
  expect(__debug.state.subscribers.size).toBe(0);

  // Make `live_custom_external_greeting` update
  // This shouldn't do anything since unsubscribe has happened
  expect(() => {
    __debug.updateSalutation('Yo');
  }).not.toThrow();

  // Make `live_user_suspends_when_odd` update & unsuspend
  GLOBAL_STORE.dispatch({type: 'INCREMENT'});
  expect(environmentUpdateHandler).toHaveBeenCalledTimes(2);
  expect(data.user.id).toBe('2');
  expect(data.greeting).toBe('Yo user 2');
  expect(__debug.state.subscribers.size).toBe(1);
});

describe('batching', () => {
  const operation = createOperationDescriptor(
    graphql`
      query LiveResolversTestBatchingQuery {
        # Together these fields create two subscriptions to the underlying
        # GLOBAL_STORE.
        counter_no_fragment
        counter_no_fragment_with_arg(prefix: "sup")
      }
    `,
    {},
  );
  test('Updates can be batched', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
      },
    });

    const log = jest.fn();
    const store = new RelayModernStore(source, {
      gcReleaseBufferSize: 0,
      log,
    });
    const environment = new RelayModernEnvironment({
      network: RelayNetwork.create(jest.fn()),
      store,
      log,
    });

    function getBatchLogEventNames(): string[] {
      return log.mock.calls
        .map(log => log[0].name)
        .filter(name => {
          return name.startsWith('liveresolver.batch');
        });
    }

    const snapshot = environment.lookup(operation.fragment);

    const handler = jest.fn<[Snapshot], void>();
    environment.subscribe(snapshot, handler);

    expect(handler.mock.calls.length).toBe(0);

    // Update without batching
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});

    // We get notified once per live resolver. :(
    expect(handler.mock.calls.length).toBe(2);

    let lastCallCount = handler.mock.calls.length;

    expect(getBatchLogEventNames()).toEqual([]);

    // Update _with_ batching.
    store.batchLiveStateUpdates(() => {
      GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    });

    expect(getBatchLogEventNames()).toEqual([
      'liveresolver.batch.start',
      'liveresolver.batch.end',
    ]);

    // We get notified once per batch! :)
    expect(handler.mock.calls.length - lastCallCount).toBe(1);

    lastCallCount = handler.mock.calls.length;

    // Update with batching, but update throws.
    // This might happen if some other subscriber to the store throws when they
    // get notified of an error.
    expect(() => {
      store.batchLiveStateUpdates(() => {
        GLOBAL_STORE.dispatch({type: 'INCREMENT'});
        throw new Error('An Example Error');
      });
    }).toThrowError('An Example Error');

    expect(getBatchLogEventNames()).toEqual([
      'liveresolver.batch.start',
      'liveresolver.batch.end',
      'liveresolver.batch.start',
      'liveresolver.batch.end',
    ]);

    // We still notify our subscribers
    expect(handler.mock.calls.length - lastCallCount).toBe(1);

    // Nested calls to batchLiveStateUpdate throw
    expect(() => {
      store.batchLiveStateUpdates(() => {
        store.batchLiveStateUpdates(() => {});
      });
    }).toThrow('Unexpected nested call to batchLiveStateUpdates.');

    expect(getBatchLogEventNames()).toEqual([
      'liveresolver.batch.start',
      'liveresolver.batch.end',
      'liveresolver.batch.start',
      'liveresolver.batch.end',
      // Here we can see the nesting
      'liveresolver.batch.start',
      'liveresolver.batch.start',
      'liveresolver.batch.end',
      'liveresolver.batch.end',
    ]);
  });
});

test('Errors thrown during _initial_ read() are caught as resolver errors', () => {
  GLOBAL_STORE.dispatch({type: 'INCREMENT'});
  const source = RelayRecordSource.create({
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
    },
  });
  const operation = createOperationDescriptor(
    graphql`
      query LiveResolversTestHandlesErrorOnReadQuery {
        counter_throws_when_odd
      }
    `,
    {},
  );
  const store = new RelayModernStore(source, {
    gcReleaseBufferSize: 0,
  });
  const environment = new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store,
  });

  const snapshot = environment.lookup(operation.fragment);
  expect(snapshot.fieldErrors).toEqual([
    {
      kind: 'relay_resolver.error',
      error: Error('What?'),
      owner: 'LiveResolversTestHandlesErrorOnReadQuery',
      fieldPath: 'counter_throws_when_odd',
      shouldThrow: false,
      handled: false,
    },
  ]);
  const data: $FlowFixMe = snapshot.data;
  expect(data.counter_throws_when_odd).toBe(null);
});

test('Errors thrown during read() _after update_ are caught as resolver errors', () => {
  const source = RelayRecordSource.create({
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
    },
  });
  const operation = createOperationDescriptor(
    graphql`
      query LiveResolversTestHandlesErrorOnUpdateQuery {
        counter_throws_when_odd
      }
    `,
    {},
  );
  const store = new RelayModernStore(source, {
    gcReleaseBufferSize: 0,
  });
  const environment = new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store,
  });

  const snapshot = environment.lookup(operation.fragment);

  const handler = jest.fn<[Snapshot], void>();
  environment.subscribe(snapshot, handler);

  // Confirm there are no initial errors
  expect(snapshot.fieldErrors).toEqual(null);
  const data: $FlowFixMe = snapshot.data;
  expect(data.counter_throws_when_odd).toBe(0);

  // This should trigger a read that throws
  GLOBAL_STORE.dispatch({type: 'INCREMENT'});

  expect(handler).toHaveBeenCalled();

  const nextSnapshot = handler.mock.calls[0][0];

  expect(nextSnapshot.fieldErrors).toEqual([
    {
      kind: 'relay_resolver.error',
      error: Error('What?'),
      owner: 'LiveResolversTestHandlesErrorOnUpdateQuery',
      fieldPath: 'counter_throws_when_odd',
      shouldThrow: false,
      handled: false,
    },
  ]);
  const nextData: $FlowFixMe = nextSnapshot.data;
  expect(nextData.counter_throws_when_odd).toBe(null);

  handler.mockReset();

  // Put the live resolver back into a state where it is valid
  GLOBAL_STORE.dispatch({type: 'INCREMENT'});

  const finalSnapshot = handler.mock.calls[0][0];

  // Confirm there are no initial errors
  expect(finalSnapshot.fieldErrors).toEqual(null);
  const finalData: $FlowFixMe = finalSnapshot.data;
  expect(finalData.counter_throws_when_odd).toBe(2);
});

test('Reflects optimistic updates, and reverts of optimistic updates', () => {
  const source = RelayRecordSource.create({
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
      me: {__ref: '4'},
    },
    '4': {
      __id: '4',
      __typename: 'User',
      name: 'Alice',
    },
  });
  const operation = createOperationDescriptor(OPTIMISTIC_UPDATES_QUERY, {});

  const store = new RelayModernStore(source, {
    gcReleaseBufferSize: 0,
  });
  const environment = new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store,
  });

  const snapshot = environment.lookup(operation.fragment);

  // When we start we greet Alice
  expect(snapshot.data).toEqual({me: {greeting: 'Hello, Alice!'}});

  const handler = jest.fn<[Snapshot], void>();
  environment.subscribe(snapshot, handler);

  const mutationSub = environment.applyMutation({
    operation: createOperationDescriptor(OPTIMISTIC_UPDATES_MUTATION, {
      input: {newName: 'Bob'},
    }),
    response: {
      actorNameChange: {
        actor: {
          __typename: 'User',
          id: '4',
          name: 'Bob',
        },
      },
    },
    updater: null,
  });

  // In optimistic state we greet Bob
  expect(handler.mock.calls.length).toBe(1);
  expect(handler.mock.calls[0][0].data).toEqual({
    me: {greeting: 'Hello, Bob!'},
  });

  mutationSub.dispose();
  // When the optimistic update is disposed we greet Alice again
  expect(handler.mock.calls.length).toBe(2);
  expect(handler.mock.calls[1][0].data).toEqual({
    me: {greeting: 'Hello, Alice!'},
  });
});

test('does not warn after reverting an optimistic resolver update', () => {
  const source = RelayRecordSource.create({
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
      me: {__ref: '4'},
    },
    '4': {
      __id: '4',
      __typename: 'User',
      name: 'Alice',
    },
  });
  const operation = createOperationDescriptor(OPTIMISTIC_UPDATES_QUERY, {});
  const store = new RelayModernStore(source, {
    gcReleaseBufferSize: 0,
  });
  const environment = new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store,
  });

  expect(environment.lookup(operation.fragment).data).toEqual({
    me: {greeting: 'Hello, Alice!'},
  });

  const mutationSub = environment.applyMutation({
    operation: createOperationDescriptor(OPTIMISTIC_UPDATES_MUTATION, {
      input: {newName: 'Bob'},
    }),
    response: {
      actorNameChange: {
        actor: {
          __typename: 'User',
          id: '4',
          name: 'Bob',
        },
      },
    },
    updater: null,
  });

  mutationSub.dispose();
  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (user == null) {
      throw new Error('Expected to find user record');
    }
    user.setValue('Claire', 'name');
  });

  expect(environment.lookup(operation.fragment).data).toEqual({
    me: {greeting: 'Hello, Claire!'},
  });
});

// `getSuspenseDisplayName` exists only to name the suspense promise, so it must
// not participate in change detection: implementing it must not add a single
// store notification, and it must never be consulted on the ordinary read
// path.
describe('getSuspenseDisplayName does not affect change detection', () => {
  function subscribedEnvironment() {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
      },
      '0': {__id: '0', __typename: 'User', id: '0', name: 'user 0'},
      '1': {__id: '1', __typename: 'User', id: '1', name: 'user 1'},
      '2': {__id: '2', __typename: 'User', id: '2', name: 'user 2'},
    });
    const operation = createOperationDescriptor(SUSPENDS_QUERY, {});
    const store = new RelayModernStore(source, {gcReleaseBufferSize: 0});
    const environment = new RelayModernEnvironment({
      network: RelayNetwork.create(jest.fn()),
      store,
    });
    const snapshot = environment.lookup(operation.fragment);
    let data: $FlowFixMe = snapshot.data;
    const handler = jest.fn(() => {
      data = environment.lookup(operation.fragment).data;
    });
    // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
    environment.subscribe(snapshot, handler);
    return {getData: () => data, handler};
  }

  beforeEach(() => {
    LiveUserSuspendsWhenOdd.resetDisplayNameCallCount();
  });

  test('suspending and resuming notifies exactly once each way', () => {
    const {getData, handler} = subscribedEnvironment();

    expect(handler).not.toHaveBeenCalled();
    expect(getData().user.id).toBe('0');

    // Suspend.
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getData().user).toBe(suspenseSentinel());

    // Re-read repeatedly while suspended, without changing state. The resolver
    // returns the shared sentinel singleton every time, so nothing should be
    // reported as changed.
    GLOBAL_STORE.notify();
    GLOBAL_STORE.notify();
    GLOBAL_STORE.notify();
    expect(handler).toHaveBeenCalledTimes(1);

    // Resume.
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    expect(handler).toHaveBeenCalledTimes(2);
    expect(getData().user.id).toBe('2');
  });

  test('the method is never consulted by reads or updates', () => {
    const {handler} = subscribedEnvironment();

    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    GLOBAL_STORE.notify();
    GLOBAL_STORE.dispatch({type: 'INCREMENT'});
    expect(handler).toHaveBeenCalledTimes(2);

    // Only the suspense-promise path may call it, and nothing above builds a
    // suspense promise.
    expect(LiveUserSuspendsWhenOdd.getDisplayNameCallCount()).toBe(0);
  });
});
