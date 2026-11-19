/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

'use strict';
import type {
  Direction,
  OperationDescriptor,
  RelayContext,
  Variables,
} from 'relay-runtime';
import type {Disposable} from 'relay-runtime/util/RelayRuntimeTypes';

const useBlockingPaginationFragmentOriginal = require('../legacy/useBlockingPaginationFragment');
const invariant = require('invariant');
const React = require('react');
const ReactRelayContext = require('react-relay/ReactRelayContext');
const TestRenderer = require('react-test-renderer');
const {
  ConnectionHandler,
  FRAGMENT_OWNER_KEY,
  FRAGMENTS_KEY,
  ID_KEY,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');
const Scheduler = require('scheduler');

const {useEffect, useTransition, useMemo, useState} = React;

describe('useBlockingPaginationFragment with useTransition', () => {
  if (typeof useTransition !== 'function') {
    it('empty test to prevent Jest from failing', () => {
      // This suite is only useful with experimental React build
    });
  } else {
    let environment;
    let initialUser;
    let gqlQuery;
    let gqlQueryWithoutID;
    let gqlPaginationQuery;
    let gqlFragment;
    let query;
    let queryWithoutID;
    let paginationQuery;
    let variables;
    let variablesWithoutID;
    let setOwner;
    let renderFragment;
    let loadNext;
    let refetch;
    let forceUpdate;
    let release;
    let Renderer;

    class ErrorBoundary extends React.Component<any, any> {
      state: any | {error: null} = {error: null};
      componentDidCatch(error: Error) {
        this.setState({error});
      }
      render(): any | React.Node {
        const {children, fallback: Fallback} = this.props;
        const {error} = this.state;
        if (error) {
          return <Fallback error={error} />;
        }
        return children;
      }
    }

    function useBlockingPaginationFragmentWithSuspenseTransition(
      fragmentNode: any,
      fragmentRef: any,
    ) {
      const [isPendingNext, startTransition] = useTransition();
      const {data, ...result} = useBlockingPaginationFragmentOriginal(
        fragmentNode,
        fragmentRef,
      );
      loadNext = (...args: Array<any>) => {
        let disposable: Disposable | {dispose: () => void} = {
          dispose: () => {},
        };
        startTransition(() => {
          disposable = result.loadNext(...args);
        });
        return disposable;
      };
      refetch = result.refetch;
      // $FlowFixMe[prop-missing]
      result.isPendingNext = isPendingNext;

      useEffect(() => {
        Scheduler.log({data, ...result});
      });

      return {data, ...result};
    }

    function assertYieldsWereCleared() {
      const actualYields = Scheduler.unstable_clearLog();
      if (actualYields.length !== 0) {
        throw new Error(
          'Log of yielded values is not empty. ' +
            'Call expect(Scheduler).toHaveYielded(...) first.',
        );
      }
    }

    function assertYield(
      expected: {
        data: any,
        hasNext: boolean,
        hasPrevious: boolean,
        isPendingNext: boolean,
      },
      actual: any,
    ) {
      expect(actual.data).toEqual(expected.data);
      expect(actual.isPendingNext).toEqual(expected.isPendingNext);
      expect(actual.hasNext).toEqual(expected.hasNext);
      expect(actual.hasPrevious).toEqual(expected.hasPrevious);
    }

    function expectFragmentResults(
      expectedYields: ReadonlyArray<{
        data: $FlowFixMe,
        isPendingNext: boolean,
        hasNext: boolean,
        hasPrevious: boolean,
      }>,
    ) {
      assertYieldsWereCleared();
      Scheduler.unstable_flushNumberOfYields(expectedYields.length);
      expectYieldedFragmentResults(expectedYields);
    }

    function expectYieldedFragmentResults(
      expectedYields: ReadonlyArray<{
        data: $FlowFixMe,
        isPendingNext: boolean,
        hasNext: boolean,
        hasPrevious: boolean,
      }>,
    ) {
      const actualYields = Scheduler.unstable_clearLog();
      expect(actualYields.length).toEqual(expectedYields.length);
      expectedYields.forEach((expected, idx) =>
        assertYield(expected, actualYields[idx]),
      );
    }

    function expectRequestIsInFlight(expected: any) {
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.execute).toBeCalledTimes(expected.requestCount);
      expect(
        environment.mock.isLoading(
          gqlPaginationQuery,
          expected.paginationVariables,
          {force: true},
        ),
      ).toEqual(expected.inFlight);
    }

    function expectFragmentIsPendingOnPagination(
      renderer: any,
      direction: Direction,
      expected: {
        data: unknown,
        hasNext: boolean,
        hasPrevious: boolean,
        paginationVariables: Variables,
      },
    ) {
      // Assert fragment sets isPending to true
      expectFragmentResults([
        {
          data: expected.data,
          hasNext: expected.hasNext,
          hasPrevious: expected.hasPrevious,
          isPendingNext: direction === 'forward',
        },
      ]);

      // Assert refetch query was fetched
      expectRequestIsInFlight({...expected, inFlight: true, requestCount: 1});
    }

    function createFragmentRef(id: string, owner: OperationDescriptor) {
      return {
        [FRAGMENT_OWNER_KEY]: owner.request,
        [FRAGMENTS_KEY]: {
          useBlockingPaginationFragmentWithSuspenseTransitionTestNestedUserFragment:
            {},
        },
        [ID_KEY]: id,
      };
    }

    beforeEach(() => {
      // Set up mocks
      jest.resetModules();
      jest.mock('warning');
      jest.mock('scheduler', () => require('../../__tests__/mockScheduler'));

      // Supress `act` warnings since we are intentionally not
      // using it for most tests here. `act` currently always
      // flushes Suspense fallbacks, and that's not what we want
      // when asserting pending/suspended states,
      const originalLogError = console.error.bind(console);
      jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
        if (typeof message === 'string' && message.includes('act(...)')) {
          return;
        }
        originalLogError(message, ...args);
      });

      // Set up environment and base data
      environment = createMockEnvironment({
        handlerProvider: () => ConnectionHandler,
      });
      release = jest.fn<ReadonlyArray<unknown>, unknown>();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.retain.mockImplementation((...args) => {
        return {
          dispose: release,
        };
      });
      graphql`
        fragment useBlockingPaginationFragmentWithSuspenseTransitionTestNestedUserFragment on User {
          username
        }
      `;

      gqlFragment = graphql`
        fragment useBlockingPaginationFragmentWithSuspenseTransitionTestUserFragment on User
        @refetchable(
          queryName: "useBlockingPaginationFragmentWithSuspenseTransitionTestUserFragmentPaginationQuery"
        )
        @argumentDefinitions(
          isViewerFriendLocal: {type: "Boolean", defaultValue: false}
          orderby: {type: "[String]"}
        ) {
          id
          name
          friends(
            after: $after
            first: $first
            before: $before
            last: $last
            orderby: $orderby
            isViewerFriend: $isViewerFriendLocal
          ) @connection(key: "UserFragment_friends") {
            edges {
              node {
                id
                name
                ...useBlockingPaginationFragmentWithSuspenseTransitionTestNestedUserFragment
              }
            }
          }
        }
      `;

      gqlQuery = graphql`
        query useBlockingPaginationFragmentWithSuspenseTransitionTestUserQuery(
          $id: ID!
          $after: ID
          $first: Int
          $before: ID
          $last: Int
          $orderby: [String]
          $isViewerFriend: Boolean
        ) {
          node(id: $id) {
            actor {
              ...useBlockingPaginationFragmentWithSuspenseTransitionTestUserFragment
                @dangerously_unaliased_fixme
                @arguments(
                  isViewerFriendLocal: $isViewerFriend
                  orderby: $orderby
                )
            }
          }
        }
      `;

      gqlQueryWithoutID = graphql`
        query useBlockingPaginationFragmentWithSuspenseTransitionTestUserQueryWithoutIDQuery(
          $after: ID
          $first: Int
          $before: ID
          $last: Int
          $orderby: [String]
          $isViewerFriend: Boolean
        ) {
          viewer {
            actor {
              ...useBlockingPaginationFragmentWithSuspenseTransitionTestUserFragment
                @dangerously_unaliased_fixme
                @arguments(
                  isViewerFriendLocal: $isViewerFriend
                  orderby: $orderby
                )
            }
          }
        }
      `;

      variablesWithoutID = {
        after: null,
        before: null,
        first: 1,
        isViewerFriend: false,
        last: null,
        orderby: ['name'],
      };
      variables = {
        ...variablesWithoutID,
        id: '<feedbackid>',
      };
      gqlPaginationQuery = require('./__generated__/useBlockingPaginationFragmentWithSuspenseTransitionTestUserFragmentPaginationQuery.graphql');

      query = createOperationDescriptor(gqlQuery, variables);
      queryWithoutID = createOperationDescriptor(
        gqlQueryWithoutID,
        variablesWithoutID,
      );
      paginationQuery = createOperationDescriptor(
        gqlPaginationQuery,
        variables,
      );
      environment.commitPayload(query, {
        node: {
          __typename: 'Feedback',
          actor: {
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:1',
                  node: {
                    __typename: 'User',
                    id: 'node:1',
                    name: 'name:node:1',
                    username: 'username:node:1',
                  },
                },
              ],
              pageInfo: {
                endCursor: 'cursor:1',
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: 'cursor:1',
              },
            },
            id: '1',
            name: 'Alice',
          },
          id: '<feedbackid>',
        },
      });
      environment.commitPayload(queryWithoutID, {
        viewer: {
          actor: {
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:1',
                  node: {
                    __typename: 'User',
                    id: 'node:1',
                    name: 'name:node:1',
                    username: 'username:node:1',
                  },
                },
              ],
              pageInfo: {
                endCursor: 'cursor:1',
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: 'cursor:1',
              },
            },
            id: '1',
            name: 'Alice',
          },
        },
      });

      // Set up renderers
      Renderer = (props: {user: any}) => null;

      const Container = (props: {
        userRef?: {...},
        owner: $FlowFixMe,
        fragment?: $FlowFixMe,
        ...
      }) => {
        // We need a render a component to run a Hook
        const [owner, _setOwner] = useState(props.owner);
        const [, setCount] = useState(0);
        const fragment = props.fragment ?? gqlFragment;
        const artificialUserRef = useMemo(() => {
          const snapshot = environment.lookup(owner.fragment);
          return (snapshot.data as $FlowFixMe)?.node?.actor;
        }, [owner]);
        const userRef = props.hasOwnProperty('userRef')
          ? props.userRef
          : artificialUserRef;

        setOwner = _setOwner;
        forceUpdate = setCount;

        const {data: userData} =
          useBlockingPaginationFragmentWithSuspenseTransition(
            fragment,
            userRef,
          );
        return <Renderer user={userData} />;
      };

      const ContextProvider = ({children}: {children: React.Node}) => {
        // TODO(T39494051) - We set empty variables in relay context to make
        // Flow happy, but useBlockingPaginationFragment does not use them, instead it uses
        // the variables from the fragment owner.
        const relayContext = useMemo((): RelayContext => ({environment}), []);

        return (
          <ReactRelayContext.Provider value={relayContext}>
            {children}
          </ReactRelayContext.Provider>
        );
      };

      const Fallback = () => {
        useEffect(() => {
          Scheduler.log('Fallback');
        });

        return 'Fallback';
      };

      renderFragment = (args?: {
        isConcurrent?: boolean,
        owner?: $FlowFixMe,
        userRef?: $FlowFixMe,
        fragment?: $FlowFixMe,
        ...
      }): $FlowFixMe => {
        const {isConcurrent = true, ...props} = args ?? {};
        let renderer;
        TestRenderer.act(() => {
          renderer = TestRenderer.create(
            <ErrorBoundary fallback={({error}) => `Error: ${error.message}`}>
              <React.Suspense fallback={<Fallback />}>
                <ContextProvider>
                  <Container owner={query} {...props} />
                </ContextProvider>
              </React.Suspense>
            </ErrorBoundary>,
            // $FlowFixMe[incompatible-type] - error revealed when flow-typing ReactTestRenderer
            {unstable_isConcurrent: isConcurrent},
          );
        });
        return renderer;
      };

      initialUser = {
        friends: {
          edges: [
            {
              cursor: 'cursor:1',
              node: {
                __typename: 'User',
                id: 'node:1',
                name: 'name:node:1',
                ...createFragmentRef('node:1', query),
              },
            },
          ],
          pageInfo: {
            endCursor: 'cursor:1',
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: 'cursor:1',
          },
        },
        id: '1',
        name: 'Alice',
      };
    });

    afterEach(() => {
      environment.mockClear();
      jest.dontMock('scheduler');
    });

    describe('loadNext', () => {
      const direction = 'forward';

      // Sanity check test, should already be tested in useBlockingPagination test
      it('loads and renders next items in connection', () => {
        const callback = jest.fn<ReadonlyArray<unknown>, unknown>();
        const renderer = renderFragment();
        expectYieldedFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);

        loadNext(1, {onComplete: callback});

        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
        };
        expectFragmentIsPendingOnPagination(renderer, direction, {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);
        expect(renderer.toJSON()).toEqual(null);

        environment.mock.resolve(gqlPaginationQuery, {
          data: {
            node: {
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      __typename: 'User',
                      id: 'node:2',
                      name: 'name:node:2',
                      username: 'username:node:2',
                    },
                  },
                ],
                pageInfo: {
                  endCursor: 'cursor:2',
                  hasNextPage: true,
                  hasPreviousPage: true,
                  startCursor: 'cursor:2',
                },
              },
              id: '1',
              name: 'Alice',
            },
          },
        });

        const expectedUser = {
          ...initialUser,
          friends: {
            ...initialUser.friends,
            edges: [
              {
                cursor: 'cursor:1',
                node: {
                  __typename: 'User',
                  id: 'node:1',
                  name: 'name:node:1',
                  ...createFragmentRef('node:1', query),
                },
              },
              {
                cursor: 'cursor:2',
                node: {
                  __typename: 'User',
                  id: 'node:2',
                  name: 'name:node:2',
                  ...createFragmentRef('node:2', query),
                },
              },
            ],
            pageInfo: {
              endCursor: 'cursor:2',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'cursor:1',
            },
          },
        };
        expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('renders pending flag correctly if pagination update is interrupted before it commits (unsuspends)', () => {
        const callback = jest.fn<ReadonlyArray<unknown>, unknown>();
        const renderer = renderFragment();
        expectYieldedFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);

        loadNext(1, {onComplete: callback});

        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
        };
        expectFragmentIsPendingOnPagination(renderer, direction, {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);
        expect(renderer.toJSON()).toEqual(null);

        // Schedule a high-pri update while the component is
        // suspended on pagination
        Scheduler.unstable_runWithPriority(
          Scheduler.unstable_UserBlockingPriority,
          () => {
            forceUpdate(prev => prev + 1);
          },
        );

        // Assert high-pri update is rendered when initial update
        // that suspended hasn't committed
        // Assert that the avoided Suspense fallback isn't rendered
        expect(renderer.toJSON()).toEqual(null);
        expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
            // Assert that isPending flag is still true
            isPendingNext: true,
          },
        ]);

        // Assert list is updated after pagination request completes
        environment.mock.resolve(gqlPaginationQuery, {
          data: {
            node: {
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      __typename: 'User',
                      id: 'node:2',
                      name: 'name:node:2',
                      username: 'username:node:2',
                    },
                  },
                ],
                pageInfo: {
                  endCursor: 'cursor:2',
                  hasNextPage: true,
                  hasPreviousPage: true,
                  startCursor: 'cursor:2',
                },
              },
              id: '1',
              name: 'Alice',
            },
          },
        });

        const expectedUser = {
          ...initialUser,
          friends: {
            ...initialUser.friends,
            edges: [
              {
                cursor: 'cursor:1',
                node: {
                  __typename: 'User',
                  id: 'node:1',
                  name: 'name:node:1',
                  ...createFragmentRef('node:1', query),
                },
              },
              {
                cursor: 'cursor:2',
                node: {
                  __typename: 'User',
                  id: 'node:2',
                  name: 'name:node:2',
                  ...createFragmentRef('node:2', query),
                },
              },
            ],
            pageInfo: {
              endCursor: 'cursor:2',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'cursor:1',
            },
          },
        };

        expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('loads more correctly when original variables do not include an id', () => {
        const callback = jest.fn<ReadonlyArray<unknown>, unknown>();
        const viewer = environment.lookup(queryWithoutID.fragment).data?.viewer;
        const userRef =
          typeof viewer === 'object' && viewer != null ? viewer?.actor : null;
        invariant(userRef != null, 'Expected to have cached test data');

        let expectedUser = {
          ...initialUser,
          friends: {
            ...initialUser.friends,
            edges: [
              {
                cursor: 'cursor:1',
                node: {
                  __typename: 'User',
                  id: 'node:1',
                  name: 'name:node:1',
                  ...createFragmentRef('node:1', queryWithoutID),
                },
              },
            ],
          },
        };

        const renderer = renderFragment({owner: queryWithoutID, userRef});
        expectYieldedFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);

        loadNext(1, {onComplete: callback});

        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
        };
        expectFragmentIsPendingOnPagination(renderer, direction, {
          data: expectedUser,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);
        expect(renderer.toJSON()).toEqual(null);

        environment.mock.resolve(gqlPaginationQuery, {
          data: {
            node: {
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      __typename: 'User',
                      id: 'node:2',
                      name: 'name:node:2',
                      username: 'username:node:2',
                    },
                  },
                ],
                pageInfo: {
                  endCursor: 'cursor:2',
                  hasNextPage: true,
                  hasPreviousPage: true,
                  startCursor: 'cursor:2',
                },
              },
              id: '1',
              name: 'Alice',
            },
          },
        });

        expectedUser = {
          ...initialUser,
          friends: {
            ...initialUser.friends,
            edges: [
              {
                cursor: 'cursor:1',
                node: {
                  __typename: 'User',
                  id: 'node:1',
                  name: 'name:node:1',
                  ...createFragmentRef('node:1', queryWithoutID),
                },
              },
              {
                cursor: 'cursor:2',
                node: {
                  __typename: 'User',
                  id: 'node:2',
                  name: 'name:node:2',
                  ...createFragmentRef('node:2', queryWithoutID),
                },
              },
            ],
            pageInfo: {
              endCursor: 'cursor:2',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'cursor:1',
            },
          },
        };
        expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('calls callback with error when error occurs during fetch', () => {
        const callback = jest.fn<ReadonlyArray<unknown>, unknown>();
        const renderer = renderFragment();
        expectYieldedFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);

        loadNext(1, {onComplete: callback});

        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
        };
        expectFragmentIsPendingOnPagination(renderer, direction, {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);
        expect(renderer.toJSON()).toEqual(null);

        const error = new Error('Oops');
        environment.mock.reject(gqlPaginationQuery, error);

        // We pass the error in the callback, but do not throw during render
        // since we want to continue rendering the existing items in the
        // connection
        expect(callback).toBeCalledTimes(1);
        expect(callback).toBeCalledWith(error);
      });

      it('preserves pagination request if re-rendered with same fragment ref', () => {
        const callback = jest.fn<ReadonlyArray<unknown>, unknown>();
        const renderer = renderFragment();
        expectYieldedFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);

        loadNext(1, {onComplete: callback});

        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
        };
        expectFragmentIsPendingOnPagination(renderer, direction, {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);
        expect(renderer.toJSON()).toEqual(null);

        setOwner({...query});

        // Assert that request is still in flight after re-rendering
        // with new fragment ref that points to the same data.
        expectRequestIsInFlight({
          gqlPaginationQuery,
          inFlight: true,
          paginationVariables,
          requestCount: 1,
        });
        expect(callback).toBeCalledTimes(0);

        environment.mock.resolve(gqlPaginationQuery, {
          data: {
            node: {
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      __typename: 'User',
                      id: 'node:2',
                      name: 'name:node:2',
                      username: 'username:node:2',
                    },
                  },
                ],
                pageInfo: {
                  endCursor: 'cursor:2',
                  hasNextPage: true,
                  hasPreviousPage: true,
                  startCursor: 'cursor:2',
                },
              },
              id: '1',
              name: 'Alice',
            },
          },
        });

        const expectedUser = {
          ...initialUser,
          friends: {
            ...initialUser.friends,
            edges: [
              {
                cursor: 'cursor:1',
                node: {
                  __typename: 'User',
                  id: 'node:1',
                  name: 'name:node:1',
                  ...createFragmentRef('node:1', query),
                },
              },
              {
                cursor: 'cursor:2',
                node: {
                  __typename: 'User',
                  id: 'node:2',
                  name: 'name:node:2',
                  ...createFragmentRef('node:2', query),
                },
              },
            ],
            pageInfo: {
              endCursor: 'cursor:2',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'cursor:1',
            },
          },
        };
        expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: true,
          },
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });
    });

    describe('refetch', () => {
      // The bulk of refetch behavior is covered in useRefetchableFragmentNode-test,
      // so this suite covers the pagination-related test cases.
      function expectRefetchRequestIsInFlight(expected: any) {
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.executeWithSource).toBeCalledTimes(
          expected.requestCount,
        );
        expect(
          environment.mock.isLoading(
            expected.gqlRefetchQuery ?? gqlPaginationQuery,
            expected.refetchVariables,
            {force: true},
          ),
        ).toEqual(expected.inFlight);
      }

      function expectFragmentSuspendedOnRefetch(
        renderer: any,
        expected: {
          data: unknown,
          hasNext: boolean,
          hasPrevious: boolean,
          refetchVariables: Variables,
          refetchQuery?: OperationDescriptor,
          gqlRefetchQuery?: $FlowFixMe,
        },
        flushFallback: boolean = true,
      ) {
        assertYieldsWereCleared();

        TestRenderer.act(() => {
          // Wrap in act to ensure passive effects are run
          jest.runAllImmediates();
        });

        Scheduler.unstable_flushNumberOfYields(1);
        const actualYields = Scheduler.unstable_clearLog();

        if (flushFallback) {
          // Flushing fallbacks by running a timer could cause other side-effects
          // such as releasing retained queries. Until React has a better way to flush
          // fallbacks, we can't test fallbacks and other timeout based effects at the same time.
          jest.runOnlyPendingTimers(); // Tigger fallbacks.

          // Assert component suspendeds
          expect(actualYields.length).toEqual(1);
          expect(actualYields[0]).toEqual('Fallback');
          expect(renderer.toJSON()).toEqual('Fallback');
        }

        // Assert refetch query was fetched
        expectRefetchRequestIsInFlight({
          ...expected,
          inFlight: true,
          requestCount: 1,
        });

        // Assert query is retained by loadQuery
        // and tentatively retained while component is suspended
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.retain).toBeCalledTimes(2);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.retain.mock.calls[0][0]).toEqual(
          expected.refetchQuery,
        );
      }

      // TODO: T150701964
      xit('loads more items correctly after refetching', () => {
        const renderer = renderFragment();
        expectYieldedFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);

        refetch({isViewerFriendLocal: true, orderby: ['lastname']});

        // Assert that fragment is refetching with the right variables and
        // suspends upon refetch
        const refetchVariables = {
          after: null,
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: true,
          last: null,
          orderby: ['lastname'],
        };
        paginationQuery = createOperationDescriptor(
          gqlPaginationQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentSuspendedOnRefetch(
          renderer,
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
            refetchQuery: paginationQuery,
            refetchVariables,
          },
          false,
        );

        // Mock network response
        environment.mock.resolve(gqlPaginationQuery, {
          data: {
            node: {
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:100',
                    node: {
                      __typename: 'User',
                      id: 'node:100',
                      name: 'name:node:100',
                      username: 'username:node:100',
                    },
                  },
                ],
                pageInfo: {
                  endCursor: 'cursor:100',
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: 'cursor:100',
                },
              },
              id: '1',
              name: 'Alice',
            },
          },
        });

        // Assert fragment is rendered with new data
        const expectedUser = {
          friends: {
            edges: [
              {
                cursor: 'cursor:100',
                node: {
                  __typename: 'User',
                  id: 'node:100',
                  name: 'name:node:100',
                  ...createFragmentRef('node:100', paginationQuery),
                },
              },
            ],
            pageInfo: {
              endCursor: 'cursor:100',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'cursor:100',
            },
          },
          id: '1',
          name: 'Alice',
        };

        jest.runAllImmediates();
        expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
            isPendingNext: false,
          },
        ]);

        // Assert refetch query was retained by loadQuery and component
        expect(release).not.toBeCalled();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.retain).toBeCalledTimes(2);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.retain.mock.calls[0][0]).toEqual(paginationQuery);

        // Paginate after refetching
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.execute.mockClear();
        loadNext(1);

        const paginationVariables = {
          after: 'cursor:100',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: true,
          last: null,
          orderby: ['lastname'],
        };
        expectFragmentIsPendingOnPagination(renderer, 'forward', {
          data: expectedUser,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });

        environment.mock.resolve(gqlPaginationQuery, {
          data: {
            node: {
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:200',
                    node: {
                      __typename: 'User',
                      id: 'node:200',
                      name: 'name:node:200',
                      username: 'username:node:200',
                    },
                  },
                ],
                pageInfo: {
                  endCursor: 'cursor:200',
                  hasNextPage: true,
                  hasPreviousPage: true,
                  startCursor: 'cursor:200',
                },
              },
              id: '1',
              name: 'Alice',
            },
          },
        });

        const paginatedUser = {
          ...expectedUser,
          friends: {
            ...expectedUser.friends,
            edges: [
              {
                cursor: 'cursor:100',
                node: {
                  __typename: 'User',
                  id: 'node:100',
                  name: 'name:node:100',
                  ...createFragmentRef('node:100', paginationQuery),
                },
              },
              {
                cursor: 'cursor:200',
                node: {
                  __typename: 'User',
                  id: 'node:200',
                  name: 'name:node:200',
                  ...createFragmentRef('node:200', paginationQuery),
                },
              },
            ],
            pageInfo: {
              endCursor: 'cursor:200',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'cursor:100',
            },
          },
        };
        expectFragmentResults([
          {
            data: paginatedUser,
            hasNext: true,
            hasPrevious: false,
            // Assert pending flag is set back to false
            isPendingNext: false,
          },
        ]);
      });
    });
  }
});
