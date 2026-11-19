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

const {
  getFragmentResourceForEnvironment,
} = require('react-relay/relay-hooks/legacy/FragmentResource');
const {getFragment} = require('relay-runtime');
const {graphql} = require('relay-runtime/query/GraphQLTag');
const {
  createOperationDescriptor,
} = require('relay-runtime/store/RelayModernOperationDescriptor');
const {
  createMockEnvironment,
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

const BASIC_QUERY = graphql`
  query FragmentResourceClientEdgesTest1Query($id: ID!) {
    node(id: $id) {
      __typename
      ...FragmentResourceClientEdgesTestFragment1 @dangerously_unaliased_fixme
    }
  }
`;

const BASIC_FRAGMENT = graphql`
  fragment FragmentResourceClientEdgesTestFragment1 on User {
    client_edge @waterfall {
      name
    }
  }
`;

describe('FragmentResource Client Edges behavior', () => {
  let environment;
  let FragmentResource;
  let query;
  let fragmentNode;
  let fragmentRef;
  let retain;
  let release;

  beforeEach(() => {
    environment = createMockEnvironment();
    FragmentResource = getFragmentResourceForEnvironment(environment);
    query = createOperationDescriptor(BASIC_QUERY, {id: '1'});
    environment.commitPayload(query, {
      node: {
        __typename: 'User',
        id: '1',
        name: 'Alice',
      },
    });
    fragmentNode = getFragment(BASIC_FRAGMENT);
    fragmentRef = {
      __fragmentOwner: query.request,
      __fragments: {
        FragmentResourceClientEdgesTestFragment1: {},
      },
      __id: '1',
    };

    release = jest.fn<ReadonlyArray<unknown>, unknown>();
    environment.retain.mockImplementation((...args) => {
      return {
        dispose: release,
      };
    });
    retain = environment.retain; // so that we don't have to suppress method-unbinding throughout.
  });

  it('Fetches the query operation when a client edge is traversed and the destination record is missing', async () => {
    // When we first read the fragment, it should throw a Promise to suspend
    // so that we wait for the client edge query to be executed:
    let thrown = null;
    try {
      FragmentResource.read(fragmentNode, fragmentRef, 'componentDisplayName');
    } catch (p) {
      expect(p).toBeInstanceOf(Promise);
      thrown = p;
    }
    expect(thrown).not.toBe(null);

    // There should now be an operation in flight to retrieve the client
    // edge destination record:
    const operation = environment.mock.findOperation(
      op =>
        op.fragment.node.name ===
        'ClientEdgeQuery_FragmentResourceClientEdgesTestFragment1_client_edge',
    );
    expect(operation).not.toBe(null);
    expect(operation.fragment.variables.id).toBe('1337');

    // Once that operation is completed, the Promise should resolve:
    environment.mock.resolve(operation, {
      data: {
        node: {
          __typename: 'User',
          id: '1337',
          name: 'Bob',
        },
      },
    });
    await expect(thrown).resolves.not.toThrow();

    // When we read the fragment again, we should be able to access
    // the data across the client edge:
    // eslint-disable-next-line ft-flow/no-flow-fix-me-comments
    let result: $FlowFixMe; // it's an opaque type

    expect(() => {
      result = FragmentResource.read(
        fragmentNode,
        fragmentRef,
        'componentDisplayName',
      );
    }).not.toThrow();
    expect(result?.data?.client_edge.name).toBe('Bob');
    expect(result?.snapshot?.isMissingData).toBe(false);
    expect(result?.snapshot?.missingClientEdges?.size ?? 0).toBe(0);
  });

  it('Does not execute the query if no data is missing', () => {
    environment.commitUpdate(store => {
      const bob = store.create('1337', 'User');
      bob.setValue('Bob', 'name');
    });
    const result = FragmentResource.read(
      fragmentNode,
      fragmentRef,
      'componentDisplayName',
    );
    // eslint-disable-next-line ft-flow/no-flow-fix-me-comments
    expect((result.data as $FlowFixMe).client_edge.name).toBe('Bob');
    expect(environment.mock.getAllOperations().length).toBe(0);
  });

  it('Subscribes the components to changes to the destination record', async () => {
    // First simulate suspending on the client edge query and then having
    // that query be resolved:
    let thrown;
    try {
      FragmentResource.read(fragmentNode, fragmentRef, 'componentDisplayName');
    } catch (p) {
      expect(p).toBeInstanceOf(Promise);
      thrown = p;
    }
    const operation = environment.mock.findOperation(
      op =>
        op.fragment.node.name ===
        'ClientEdgeQuery_FragmentResourceClientEdgesTestFragment1_client_edge',
    );
    environment.mock.resolve(operation, {
      data: {
        node: {
          __typename: 'User',
          id: '1337',
          name: 'Bob',
        },
      },
    });
    await expect(thrown).resolves.not.toThrow();

    // Now that the operation is fulfilled, this read won't suspend and we have
    // a result that we can subscribe to:
    const result = FragmentResource.read(
      fragmentNode,
      fragmentRef,
      'componentDisplayName',
    );

    // Updating the destination record should trigger the subscription:
    let called = false;
    const subscription = FragmentResource.subscribe(result, () => {
      called = true;
    });
    environment.commitUpdate(store => {
      const bob = store.get('1337');
      bob?.setValue('Robert', 'name');
    });
    expect(called).toBe(true);

    // Unsubscribing also works:
    called = false;
    subscription.dispose();
    environment.commitUpdate(store => {
      const bob = store.get('1337');
      bob?.setValue('Doctor Robert', 'name');
    });
    expect(called).toBe(false);
  });

  it('Temporarily retains the client edge query upon read', () => {
    expect(retain).toBeCalledTimes(0);
    try {
      FragmentResource.read(fragmentNode, fragmentRef, 'componentDisplayName');
    } catch (p) {
      expect(p).toBeInstanceOf(Promise);
    }
    expect(retain).toBeCalledTimes(1);
    expect(release).toBeCalledTimes(0);
    jest.runAllTimers();
    expect(release).toBeCalledTimes(1);
  });

  it('Permanently retains the client edge query when subscribed to', async () => {
    // Use our own simulation of setTimeout due to bugs in Jest's.
    // We can't mock SuspenseResource's setTimeout using Jest mocks because
    // they aren't imported from a module, so we swizzle the global one.
    const timeouts = new Map<number, $FlowFixMe>();
    let nextTimeoutID = 0;
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    try {
      // eslint-disable-next-line ft-flow/no-flow-fix-me-comments
      // $FlowFixMe[cannot-write]
      global.setTimeout = fn => {
        const id = nextTimeoutID++;
        timeouts.set(id, fn);
        return id;
      };
      // eslint-disable-next-line ft-flow/no-flow-fix-me-comments
      // $FlowFixMe[cannot-write]
      global.clearTimeout = id => {
        // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
        timeouts.delete(id);
      };
      function runAllTimeouts() {
        expect(timeouts.size).toBeGreaterThan(0);
        timeouts.forEach(fn => fn());
        timeouts.clear();
      }

      let thrown;
      try {
        FragmentResource.read(
          fragmentNode,
          fragmentRef,
          'componentDisplayName',
        );
      } catch (p) {
        expect(p).toBeInstanceOf(Promise);
        thrown = p;
      }

      const operation = environment.mock.findOperation(
        op =>
          op.fragment.node.name ===
          'ClientEdgeQuery_FragmentResourceClientEdgesTestFragment1_client_edge',
      );
      environment.mock.resolve(operation, {
        data: {
          node: {
            __typename: 'User',
            id: '1337',
            name: 'Bob',
          },
        },
      });
      await expect(thrown).resolves.not.toThrow();

      // It's temporarily retained from initially reading it:
      expect(retain).toBeCalledTimes(1);
      expect(release).toBeCalledTimes(0);

      // No change from reading it again now that the data is available:
      const result = FragmentResource.read(
        fragmentNode,
        fragmentRef,
        'componentDisplayName',
      );
      expect(retain).toBeCalledTimes(1);
      expect(release).toBeCalledTimes(0);

      // Subscribing makes the existing retain permanent (it doesn't call
      // environment.retain a second time):
      const subscription = FragmentResource.subscribe(result, () => {});
      expect(retain).toBeCalledTimes(1);
      expect(release).toBeCalledTimes(0);

      // Simulate running the timeout; this should do nothing since
      // it's now permanently retained instead of temporarily retained:
      runAllTimeouts();
      expect(retain).toBeCalledTimes(1);
      expect(release).toBeCalledTimes(0);

      // Permanent retain should be released by disposing of the subscription:
      subscription.dispose();
      expect(release).toBeCalledTimes(1);
    } finally {
      // eslint-disable-next-line ft-flow/no-flow-fix-me-comments
      // $FlowFixMe[cannot-write]
      global.setTimeout = originalSetTimeout;
      // eslint-disable-next-line ft-flow/no-flow-fix-me-comments
      // $FlowFixMe[cannot-write]
      global.clearTimeout = originalClearTimeout;
    }
  });
});
