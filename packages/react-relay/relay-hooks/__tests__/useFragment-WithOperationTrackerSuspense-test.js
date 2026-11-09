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

import type {LogEvent} from 'relay-runtime/store/RelayStoreTypes';

const ReactRelayContext = require('../../ReactRelayContext');
const useFragment = require('../useFragment');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const {
  createOperationDescriptor,
  createReaderSelector,
  graphql,
} = require('relay-runtime');
const RelayOperationTracker = require('relay-runtime/store/RelayOperationTracker');
const RelayFeatureFlags = require('relay-runtime/util/RelayFeatureFlags');
const {createMockEnvironment} = require('relay-test-utils');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe('useFragment with Operation Tracker and Suspense behavior', () => {
  let environment;
  let UserFragment;
  let operationTracker;
  let nodeOperation;
  let logger;
  let UserQuery;
  let ViewerFriendsQuery;
  let viewerOperation;
  let UsersFragment;
  let UsersQuery;
  let pluralOperation;
  let render;

  const pluralVariables = {ids: ['user-id-1']};

  beforeEach(() => {
    RelayFeatureFlags.ENABLE_OPERATION_TRACKER_OPTIMISTIC_UPDATES = true;
    RelayFeatureFlags.ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE = true;
    RelayFeatureFlags.ENABLE_IN_FLIGHT_OPERATION_CORRELATION = true;
    operationTracker = new RelayOperationTracker();
    logger = jest.fn<[LogEvent], void>();
    environment = createMockEnvironment({
      operationTracker,
      log: logger,
    });

    UserFragment = graphql`
      fragment useFragmentWithOperationTrackerSuspenseTestFragment on User {
        id
        name
      }
    `;
    UserQuery = graphql`
      query useFragmentWithOperationTrackerSuspenseTestQuery($id: ID!) {
        node(id: $id) {
          __typename
          ...useFragmentWithOperationTrackerSuspenseTestFragment
            @dangerously_unaliased_fixme
        }
      }
    `;

    UsersFragment = graphql`
      fragment useFragmentWithOperationTrackerSuspenseTest2Fragment on User
      @relay(plural: true) {
        id
        name
      }
    `;

    UsersQuery = graphql`
      query useFragmentWithOperationTrackerSuspenseTest2Query($ids: [ID!]!) {
        nodes(ids: $ids) {
          __typename
          ...useFragmentWithOperationTrackerSuspenseTest2Fragment
        }
      }
    `;

    ViewerFriendsQuery = graphql`
      query useFragmentWithOperationTrackerSuspenseTestViewerFriendsQuery {
        viewer {
          actor {
            friends(first: 1) @connection(key: "Viewer_friends") {
              edges {
                node {
                  ...useFragmentWithOperationTrackerSuspenseTestFragment
                }
              }
            }
          }
        }
      }
    `;
    nodeOperation = createOperationDescriptor(UserQuery, {
      id: 'user-id-1',
    });
    viewerOperation = createOperationDescriptor(ViewerFriendsQuery, {});
    pluralOperation = createOperationDescriptor(UsersQuery, pluralVariables);

    environment.execute({operation: viewerOperation}).subscribe({});
    environment.execute({operation: nodeOperation}).subscribe({});
    environment.execute({operation: pluralOperation}).subscribe({});

    environment.subscribe(
      environment.lookup(viewerOperation.fragment),
      jest.fn(),
    );

    // We need to subscribe to a fragment in order for OperationTracker
    // to be able to notify owners if they are affected by any pending operation
    environment.subscribe(
      environment.lookup(
        createReaderSelector(
          UserFragment,
          'user-id-1',
          viewerOperation.request.variables,
          viewerOperation.request,
        ),
      ),
      jest.fn(),
    );
    environment.subscribe(
      environment.lookup(
        createReaderSelector(
          UsersFragment,
          'user-id-1',
          pluralOperation.request.variables,
          pluralOperation.request,
        ),
      ),
      jest.fn(),
    );
    environment.subscribe(
      environment.lookup(
        createReaderSelector(
          UserFragment,
          'user-id-1',
          nodeOperation.request.variables,
          nodeOperation.request,
        ),
      ),
      jest.fn(),
    );

    const ContextProvider = ({children}: {children: React.Node}) => {
      return (
        <ReactRelayContext.Provider value={{environment}}>
          {children}
        </ReactRelayContext.Provider>
      );
    };

    const Container = (props: {userRef: $FlowFixMe, ...}) => {
      const isPlural = Array.isArray(props.userRef);
      // $FlowFixMe[incompatible-type]
      const userData = useFragment(
        isPlural ? UsersFragment : UserFragment,
        props.userRef,
      );
      return Array.isArray(userData)
        ? userData.map(user => (
            <React.Fragment key={user.id}>{user.name}</React.Fragment>
          ))
        : userData.name;
    };

    render = async function (props: $FlowFixMe) {
      let instance;
      await act(() => {
        instance = ReactTestingLibrary.render(
          <React.Suspense fallback="Singular Fallback">
            <ContextProvider>
              <Container {...props} />
            </ContextProvider>
          </React.Suspense>,
        );
      });
      return instance;
    };
  });

  afterEach(() => {
    RelayFeatureFlags.ENABLE_OPERATION_TRACKER_OPTIMISTIC_UPDATES = false;
    RelayFeatureFlags.ENABLE_RELAY_OPERATION_TRACKER_SUSPENSE = false;
    RelayFeatureFlags.ENABLE_IN_FLIGHT_OPERATION_CORRELATION = false;
  });

  it('should throw promise for pending operation affecting fragment owner', async () => {
    environment.commitPayload(viewerOperation, {
      viewer: {
        actor: {
          id: 'viewer-id',
          __typename: 'User',
          friends: {
            pageInfo: {
              hasNextPage: true,
              hasPrevPage: false,
              startCursor: 'cursor-1',
              endCursor: 'cursor-1',
            },
            edges: [
              {
                cursor: 'cursor-1',
                node: {
                  id: 'user-id-1',
                  name: 'Alice',
                  __typename: 'User',
                },
              },
            ],
          },
        },
      },
    });

    const fragmentRef = {
      __id: 'user-id-1',
      __fragments: {
        useFragmentWithOperationTrackerSuspenseTestFragment: {},
      },
      __fragmentOwner: nodeOperation.request,
    };

    const renderer = await render({userRef: fragmentRef});
    expect(renderer?.container.textContent).toBe('Alice'); // should show the name

    await act(() => {
      environment
        .executeMutation({
          operation: nodeOperation,
          optimisticUpdater: store => {
            const record = store.get('user-id-1');
            record?.setValue(undefined, 'name');
          },
        })
        .subscribe({});
      jest.runAllImmediates();
    });

    expect(renderer?.container.textContent).toBe('Singular Fallback'); // Component is suspended now for optimistic update
    await act(() => {
      environment.mock.nextValue(nodeOperation, {
        data: {
          node: {
            __typename: 'User',
            id: 'user-id-1',
            name: 'Alice222',
          },
        },
      });
      environment.mock.complete(nodeOperation.request.node);
    });

    expect(renderer?.container.textContent).toBe('Alice222');
  });

  it('should throw promise for plural fragment', async () => {
    environment.commitPayload(viewerOperation, {
      viewer: {
        actor: {
          id: 'viewer-id',
          __typename: 'User',
          friends: {
            pageInfo: {
              hasNextPage: true,
              hasPrevPage: false,
              startCursor: 'cursor-1',
              endCursor: 'cursor-1',
            },
            edges: [
              {
                cursor: 'cursor-1',
                node: {
                  id: 'user-id-1',
                  name: 'Alice',
                  __typename: 'User',
                },
              },
              {
                cursor: 'cursor-2',
                node: {
                  id: 'user-id-2',
                  name: 'Bob',
                  __typename: 'User',
                },
              },
            ],
          },
        },
      },
    });

    const fragmentPluralRef = [
      {
        __id: 'user-id-1',
        __fragments: {
          useFragmentWithOperationTrackerSuspenseTest2Fragment: {},
        },
        __fragmentOwner: pluralOperation.request,
      },
      {
        __id: 'user-id-2',
        __fragments: {
          useFragmentWithOperationTrackerSuspenseTest2Fragment: {},
        },
        __fragmentOwner: pluralOperation.request,
      },
    ];

    const rendererPlural = await render({userRef: fragmentPluralRef});
    expect(rendererPlural?.container.textContent).toEqual('AliceBob');

    await act(() => {
      // Execute the nodeOperation query with executeMutation and set the record as undefined in optimistic updater
      environment
        .executeMutation({
          operation: nodeOperation,
          optimisticUpdater: store => {
            const record = store.get('user-id-1');
            record?.setValue(undefined, 'name');
          },
        })
        .subscribe({});
      jest.runAllImmediates();
    });

    expect(rendererPlural?.container.textContent).toEqual('Singular Fallback');

    await act(() => {
      environment.mock.nextValue(nodeOperation, {
        data: {
          node: {
            __typename: 'User',
            id: 'user-id-1',
            name: 'Alice222',
          },
        },
      });
      environment.mock.complete(nodeOperation.request.node);
    });

    expect(rendererPlural?.container.textContent).toEqual('Alice222Bob');
  });

  it('logs suspense.missing_data with isMount=true when suspending during initial mount', async () => {
    // Commit complete data first, then use an optimistic mutation to clear
    // the 'name' field before mounting the component. This ensures
    // isMissingData is true with a pending operation, triggering suspension
    // on initial mount.
    environment.commitPayload(viewerOperation, {
      viewer: {
        actor: {
          id: 'viewer-id',
          __typename: 'User',
          friends: {
            pageInfo: {
              hasNextPage: true,
              hasPrevPage: false,
              startCursor: 'cursor-1',
              endCursor: 'cursor-1',
            },
            edges: [
              {
                cursor: 'cursor-1',
                node: {
                  id: 'user-id-1',
                  name: 'Alice',
                  __typename: 'User',
                },
              },
            ],
          },
        },
      },
    });

    // Use optimistic mutation to remove the name field before mounting
    await act(() => {
      environment
        .executeMutation({
          operation: nodeOperation,
          optimisticUpdater: store => {
            const record = store.get('user-id-1');
            record?.setValue(undefined, 'name');
          },
        })
        .subscribe({});
      jest.runAllImmediates();
    });

    // Clear logs so we only capture events from the mount
    logger.mockClear();

    const fragmentRef = {
      __id: 'user-id-1',
      __fragments: {
        useFragmentWithOperationTrackerSuspenseTestFragment: {},
      },
      __fragmentOwner: nodeOperation.request,
    };

    const renderer = await render({userRef: fragmentRef});

    // Component should be suspended due to missing data with pending operation
    expect(renderer?.container.textContent).toBe('Singular Fallback');

    const missingDataEvents = logger.mock.calls
      .map(call => call[0])
      .filter(event => event.name === 'suspense.missing_data');
    expect(missingDataEvents.length).toBeGreaterThan(0);
    // Component hasn't mounted yet, so isMount should be true
    expect(missingDataEvents[0]).toMatchObject({
      name: 'suspense.missing_data',
      isMount: true,
    });
    expect(missingDataEvents[0].fragment.name).toBe(
      'useFragmentWithOperationTrackerSuspenseTestFragment',
    );
    expect(missingDataEvents[0].fragmentOwner.node.params.name).toBe(
      'useFragmentWithOperationTrackerSuspenseTestQuery',
    );
  });

  it('logs suspense.missing_data with isMount=false when suspending after mount', async () => {
    // Commit complete data so the component can mount
    environment.commitPayload(viewerOperation, {
      viewer: {
        actor: {
          id: 'viewer-id',
          __typename: 'User',
          friends: {
            pageInfo: {
              hasNextPage: true,
              hasPrevPage: false,
              startCursor: 'cursor-1',
              endCursor: 'cursor-1',
            },
            edges: [
              {
                cursor: 'cursor-1',
                node: {
                  id: 'user-id-1',
                  name: 'Alice',
                  __typename: 'User',
                },
              },
            ],
          },
        },
      },
    });

    const fragmentRef = {
      __id: 'user-id-1',
      __fragments: {
        useFragmentWithOperationTrackerSuspenseTestFragment: {},
      },
      __fragmentOwner: nodeOperation.request,
    };

    const renderer = await render({userRef: fragmentRef});
    expect(renderer?.container.textContent).toBe('Alice');

    // Clear logs, then trigger suspense via optimistic update that removes data
    logger.mockClear();

    await act(() => {
      environment
        .executeMutation({
          operation: nodeOperation,
          optimisticUpdater: store => {
            const record = store.get('user-id-1');
            record?.setValue(undefined, 'name');
          },
        })
        .subscribe({});
      jest.runAllImmediates();
    });

    expect(renderer?.container.textContent).toBe('Singular Fallback');

    const missingDataEvents = logger.mock.calls
      .map(call => call[0])
      .filter(event => event.name === 'suspense.missing_data');
    expect(missingDataEvents.length).toBeGreaterThan(0);
    // Component was already mounted, so isMount should be false
    expect(missingDataEvents[0]).toMatchObject({
      name: 'suspense.missing_data',
      isMount: false,
    });
    expect(missingDataEvents[0].fragment.name).toBe(
      'useFragmentWithOperationTrackerSuspenseTestFragment',
    );
    expect(missingDataEvents[0].fragmentOwner.node.params.name).toBe(
      'useFragmentWithOperationTrackerSuspenseTestQuery',
    );
  });

  it('should throw promise while the fragment owner operation is still in flight but has no request-cache entry', async () => {
    // Start the operation directly via environment.execute — this creates
    // an OperationExecutor (registering it with the in-flight-operation
    // registry) without populating fetchQueryDeduped's request cache. That
    // matches the state that surfaces mid-stream on incremental responses
    // when the request-cache subject has been drained.
    environment.execute({operation: nodeOperation}).subscribe({});

    const fragmentRef = {
      __id: 'user-id-1',
      __fragments: {
        useFragmentWithOperationTrackerSuspenseTestFragment: {},
      },
      __fragmentOwner: nodeOperation.request,
    };

    const renderer = await render({userRef: fragmentRef});
    expect(renderer?.container.textContent).toBe('Singular Fallback');

    await act(() => {
      environment.mock.nextValue(nodeOperation, {
        data: {
          node: {
            __typename: 'User',
            id: 'user-id-1',
            name: 'Alice',
          },
        },
      });
      environment.mock.complete(nodeOperation.request.node);
    });

    expect(renderer?.container.textContent).toBe('Alice');
  });

  it('should throw promise via in-flight correlation even when isRequestActive returns false', async () => {
    environment.execute({operation: nodeOperation}).subscribe({});

    const realIsRequestActive =
      environment.isRequestActive.bind(environment);
    const isRequestActiveSpy = jest
      .spyOn(environment, 'isRequestActive')
      .mockImplementation(id => {
        if (id === nodeOperation.request.identifier) {
          return false;
        }
        return realIsRequestActive(id);
      });

    expect(
      environment.getPromiseForInFlightOperation(
        nodeOperation.request.identifier,
      ),
    ).not.toBeNull();
    expect(
      environment.isRequestActive(nodeOperation.request.identifier),
    ).toBe(false);

    const fragmentRef = {
      __id: 'user-id-1',
      __fragments: {
        useFragmentWithOperationTrackerSuspenseTestFragment: {},
      },
      __fragmentOwner: nodeOperation.request,
    };

    const renderer = await render({userRef: fragmentRef});
    expect(renderer?.container.textContent).toBe('Singular Fallback');

    isRequestActiveSpy.mockRestore();

    await act(() => {
      environment.mock.nextValue(nodeOperation, {
        data: {
          node: {
            __typename: 'User',
            id: 'user-id-1',
            name: 'Alice',
          },
        },
      });
      environment.mock.complete(nodeOperation.request.node);
    });

    expect(renderer?.container.textContent).toBe('Alice');
  });
});
