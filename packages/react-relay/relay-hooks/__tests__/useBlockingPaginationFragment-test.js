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

import type {
  Direction,
  OperationDescriptor,
  RelayContext,
  Variables,
} from 'relay-runtime';

const useBlockingPaginationFragmentOriginal = require('../legacy/useBlockingPaginationFragment');
const ReactTestingLibrary = require('@testing-library/react');
const invariant = require('invariant');
const React = require('react');
const {act} = require('react');
const ReactRelayContext = require('react-relay/ReactRelayContext');
const {
  __internal: {fetchQuery},
  ConnectionHandler,
  FRAGMENT_OWNER_KEY,
  FRAGMENTS_KEY,
  ID_KEY,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');
const Scheduler = require('scheduler');

const {disallowWarnings, expectWarningWillFire} = jest.requireActual(
  'relay-test-utils-internal',
) as $FlowFixMe;

const {useMemo, useState} = React;

disallowWarnings();

describe('useBlockingPaginationFragment', () => {
  let environment;
  let initialUser;
  let gqlQuery;
  let gqlQueryNestedFragment;
  let gqlQueryWithoutID;
  let gqlQueryWithLiteralArgs;
  let gqlNodeQuery;
  let gqlPaginationQuery;
  let gqlFragment;
  let query;
  let queryNestedFragment;
  let queryWithoutID;
  let queryWithLiteralArgs;
  let paginationQuery;
  let variables;
  let variablesNestedFragment;
  let variablesWithoutID;
  let setEnvironment;
  let setOwner;
  let renderFragment;
  let renderSpy;
  let loadNext;
  let refetch;
  let forceUpdate;
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

  function useBlockingPaginationFragment(
    fragmentNode: any,
    fragmentRef: unknown,
  ) {
    const {data, ...result} = useBlockingPaginationFragmentOriginal(
      fragmentNode,
      // $FlowFixMe[incompatible-type]
      fragmentRef,
    );
    loadNext = result.loadNext;
    refetch = result.refetch;
    renderSpy(data, result);
    return {data, ...result};
  }

  function assertCall(
    expected: {data: any, hasNext: boolean, hasPrevious: boolean},
    idx: number,
  ) {
    const actualData = renderSpy.mock.calls[idx][0];
    const actualResult = renderSpy.mock.calls[idx][1];
    const actualHasNext = actualResult.hasNext;
    const actualHasPrevious = actualResult.hasPrevious;

    expect(actualData).toEqual(expected.data);
    expect(actualHasNext).toEqual(expected.hasNext);
    expect(actualHasPrevious).toEqual(expected.hasPrevious);
  }

  async function expectFragmentResults(
    expectedCalls: ReadonlyArray<{
      data: $FlowFixMe,
      hasNext: boolean,
      hasPrevious: boolean,
    }>,
  ) {
    // This ensures that useEffect runs
    await act(async () => jest.runAllImmediates());
    expect(renderSpy).toBeCalledTimes(expectedCalls.length);
    expectedCalls.forEach((expected, idx) => assertCall(expected, idx));
    renderSpy.mockClear();
  }

  function createFragmentRef(
    id: string,
    owner: OperationDescriptor,
    fragmentName: string = 'useBlockingPaginationFragmentTestNestedUserFragment',
  ) {
    return {
      [FRAGMENT_OWNER_KEY]: owner.request,
      [FRAGMENTS_KEY]: {
        [fragmentName]: {},
      },
      [ID_KEY]: id,
    };
  }

  beforeEach(() => {
    // Set up mocks
    renderSpy = jest.fn<_, unknown>();

    // Set up environment and base data
    environment = createMockEnvironment({
      handlerProvider: () => ConnectionHandler,
    });
    graphql`
      fragment useBlockingPaginationFragmentTestNestedUserFragment on User {
        username
      }
    `;
    gqlFragment = graphql`
      fragment useBlockingPaginationFragmentTestUserFragment on User
      @refetchable(
        queryName: "useBlockingPaginationFragmentTestUserFragmentPaginationQuery"
      )
      @argumentDefinitions(
        isViewerFriendLocal: {type: "Boolean", defaultValue: false}
        orderby: {type: "[String]"}
        scale: {type: "Float"}
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
          scale: $scale
        )
          @connection(
            key: "UserFragment_friends"
            filters: ["orderby", "isViewerFriend"]
          ) {
          edges {
            node {
              id
              name
              ...useBlockingPaginationFragmentTestNestedUserFragment
            }
          }
        }
      }
    `;
    gqlQuery = graphql`
      query useBlockingPaginationFragmentTestUserQuery(
        $id: ID!
        $after: ID
        $first: Int
        $before: ID
        $last: Int
        $orderby: [String]
        $isViewerFriend: Boolean
      ) {
        node(id: $id) {
          ...useBlockingPaginationFragmentTestUserFragment
            @dangerously_unaliased_fixme
            @arguments(isViewerFriendLocal: $isViewerFriend, orderby: $orderby)
        }
      }
    `;
    gqlQueryNestedFragment = graphql`
      query useBlockingPaginationFragmentTestUserQueryNestedFragmentQuery(
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
            ...useBlockingPaginationFragmentTestUserFragment
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
      query useBlockingPaginationFragmentTestUserQueryWithoutIDQuery(
        $after: ID
        $first: Int
        $before: ID
        $last: Int
        $orderby: [String]
        $isViewerFriend: Boolean
      ) {
        viewer {
          actor {
            ...useBlockingPaginationFragmentTestUserFragment
              @dangerously_unaliased_fixme
              @arguments(
                isViewerFriendLocal: $isViewerFriend
                orderby: $orderby
              )
          }
        }
      }
    `;
    gqlQueryWithLiteralArgs = graphql`
      query useBlockingPaginationFragmentTestUserQueryWithLiteralArgsQuery(
        $id: ID!
        $after: ID
        $first: Int
        $before: ID
        $last: Int
      ) {
        node(id: $id) {
          ...useBlockingPaginationFragmentTestUserFragment
            @dangerously_unaliased_fixme
            @arguments(isViewerFriendLocal: true, orderby: ["name"])
        }
      }
    `;
    gqlNodeQuery = graphql`
      query useBlockingPaginationFragmentTestNodeQuery($id: ID!) {
        node(id: $id) {
          ... on User {
            name
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
      id: '1',
    };
    variablesNestedFragment = {
      ...variablesWithoutID,
      id: '<feedbackid>',
    };

    gqlPaginationQuery = require('./__generated__/useBlockingPaginationFragmentTestUserFragmentPaginationQuery.graphql');

    query = createOperationDescriptor(gqlQuery, variables);
    queryNestedFragment = createOperationDescriptor(
      gqlQueryNestedFragment,
      variablesNestedFragment,
    );
    queryWithoutID = createOperationDescriptor(
      gqlQueryWithoutID,
      variablesWithoutID,
    );
    queryWithLiteralArgs = createOperationDescriptor(
      gqlQueryWithLiteralArgs,
      variables,
    );
    paginationQuery = createOperationDescriptor(gqlPaginationQuery, variables);
    environment.commitPayload(query, {
      node: {
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
    environment.commitPayload(queryWithLiteralArgs, {
      node: {
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
      const [owner, setOwner_] = useState(props.owner);
      const [, setCount] = useState(0);
      const fragment = props.fragment ?? gqlFragment;
      const artificialUserRef = useMemo(
        () => environment.lookup(owner.fragment).data?.node,
        [owner],
      );
      const userRef = props.hasOwnProperty('userRef')
        ? props.userRef
        : artificialUserRef;

      setOwner = setOwner_;
      forceUpdate = setCount;

      const {data: userData} = useBlockingPaginationFragment(fragment, userRef);
      return <Renderer user={userData} />;
    };

    const ContextProvider = ({children}: {children: React.Node}) => {
      const [env, _setEnv] = useState(environment);
      const relayContext = useMemo(
        (): RelayContext => ({environment: env}),
        [env],
      );

      setEnvironment = _setEnv;

      return (
        <ReactRelayContext.Provider value={relayContext}>
          {children}
        </ReactRelayContext.Provider>
      );
    };

    renderFragment = async (args?: {
      owner?: $FlowFixMe,
      userRef?: $FlowFixMe,
      fragment?: $FlowFixMe,
      ...
    }) => {
      let renderer;
      await act(async () => {
        renderer = ReactTestingLibrary.render(
          <ErrorBoundary fallback={({error}) => `Error: ${error.message}`}>
            <React.Suspense fallback="Fallback">
              <ContextProvider>
                <Container owner={query} {...args} />
              </ContextProvider>
            </React.Suspense>
          </ErrorBoundary>,
        );
      });
      if (!renderer) {
        throw new Error('Expected component to render');
      }
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
    renderSpy.mockClear();
  });

  describe('initial render', () => {
    // The bulk of initial render behavior is covered in useFragmentNode-test,
    // so this suite covers the basic cases as a sanity check.
    it('should throw error if fragment is plural', async () => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});

      const UserFragment = graphql`
        fragment useBlockingPaginationFragmentTest1Fragment on User
        @relay(plural: true) {
          id
        }
      `;
      const renderer = await renderFragment({fragment: UserFragment});
      expect(
        renderer
          .asFragment()
          .ownerDocument.documentElement.innerHTML.includes(
            'Remove `@relay(plural: true)` from fragment',
          ),
      ).toEqual(true);
    });

    it('should throw error if fragment uses stream', async () => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});

      const UserFragment = graphql`
        fragment useBlockingPaginationFragmentTest2Fragment on User
        @refetchable(
          queryName: "useBlockingPaginationFragmentTest2FragmentPaginationQuery"
        ) {
          id
          friends(
            after: $after
            first: $first
            before: $before
            last: $last
            orderby: $orderby
            isViewerFriend: $isViewerFriendLocal
          ) @stream_connection(key: "UserFragment_friends", initial_count: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      `;

      const renderer = await renderFragment({fragment: UserFragment});
      expect(
        renderer
          .asFragment()
          .ownerDocument.documentElement.innerHTML.includes(
            'Use `useStreamingPaginationFragment` instead',
          ),
      ).toEqual(true);
    });

    it('should throw error if fragment is missing @refetchable directive', async () => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});

      const UserFragment = graphql`
        fragment useBlockingPaginationFragmentTest3Fragment on User {
          id
        }
      `;
      const renderer = await renderFragment({fragment: UserFragment});
      expect(
        renderer
          .asFragment()
          .ownerDocument.documentElement.innerHTML.includes(
            'Did you forget to add a @refetchable directive to the fragment?',
          ),
      ).toEqual(true);
    });

    it('should throw error if fragment is missing @connection directive', async () => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});

      const UserFragment = graphql`
        fragment useBlockingPaginationFragmentTest4Fragment on User
        @refetchable(
          queryName: "useBlockingPaginationFragmentTest4FragmentRefetchQuery"
        ) {
          id
        }
      `;

      const renderer = await renderFragment({fragment: UserFragment});
      expect(
        renderer
          .asFragment()
          .ownerDocument.documentElement.innerHTML.includes(
            'Did you forget to add a @connection directive to the connection field in the fragment?',
          ),
      ).toEqual(true);
    });

    it('should render fragment without error when data is available', async () => {
      await renderFragment();
      await expectFragmentResults([
        {
          data: initialUser,

          hasNext: true,
          hasPrevious: false,
        },
      ]);
    });

    it('should render fragment without error when ref is null', async () => {
      await renderFragment({userRef: null});
      await expectFragmentResults([
        {
          data: null,
          hasNext: false,
          hasPrevious: false,
        },
      ]);
    });

    it('should render fragment without error when ref is undefined', async () => {
      await renderFragment({userRef: undefined});
      await expectFragmentResults([
        {
          data: null,
          hasNext: false,
          hasPrevious: false,
        },
      ]);
    });

    it('should update when fragment data changes', async () => {
      await renderFragment();
      await expectFragmentResults([
        {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
        },
      ]);
      await act(async () => {
        // Update parent record
        environment.commitPayload(
          createOperationDescriptor(gqlNodeQuery, {id: '1'}),
          {
            node: {
              __typename: 'User',
              id: '1',
              // Update name
              name: 'Alice in Wonderland',
            },
          },
        );
      });
      await expectFragmentResults([
        {
          data: {
            ...initialUser,
            // Assert that name is updated
            name: 'Alice in Wonderland',
          },
          hasNext: true,
          hasPrevious: false,
        },
      ]);

      // Update edge
      await act(async () => {
        environment.commitPayload(
          createOperationDescriptor(gqlNodeQuery, {id: 'node:1'}),
          {
            node: {
              __typename: 'User',
              id: 'node:1',
              // Update name
              name: 'name:node:1-updated',
            },
          },
        );
      });
      await expectFragmentResults([
        {
          data: {
            ...initialUser,
            friends: {
              ...initialUser.friends,
              edges: [
                {
                  cursor: 'cursor:1',
                  node: {
                    __typename: 'User',
                    id: 'node:1',
                    // Assert that name is updated
                    name: 'name:node:1-updated',
                    ...createFragmentRef('node:1', query),
                  },
                },
              ],
            },
            name: 'Alice in Wonderland',
          },

          hasNext: true,
          hasPrevious: false,
        },
      ]);
    });

    it('should throw a promise if data is missing for fragment and request is in flight', async () => {
      // Commit a payload for the initial node query, where the friends
      // is missing
      environment.commitPayload(
        createOperationDescriptor(gqlNodeQuery, {id: '4'}),
        {
          node: {
            __typename: 'User',
            id: '4',
            name: 'test',
          },
        },
      );

      const missingDataVariables = {...variables, id: '4'};
      const missingDataQuery = createOperationDescriptor(
        gqlQuery,
        missingDataVariables,
      );

      // Make sure query is in flight
      fetchQuery(environment, missingDataQuery).subscribe({});

      const renderer = await renderFragment({owner: missingDataQuery});
      expect(renderer.asFragment().textContent).toContain('Fallback');
    });
  });

  describe('pagination', () => {
    let release;

    beforeEach(() => {
      release = jest.fn<ReadonlyArray<unknown>, unknown>();
      environment.retain.mockImplementation((...args) => {
        return {
          dispose: release,
        };
      });
    });

    function expectRequestIsInFlight(expected: any) {
      expect(environment.execute).toBeCalledTimes(expected.requestCount);
      expect(
        environment.mock.isLoading(
          expected.gqlPaginationQuery ?? gqlPaginationQuery,
          expected.paginationVariables,
          {force: true},
        ),
      ).toEqual(expected.inFlight);
    }

    function expectFragmentIsLoadingMore(
      renderer: any,
      direction: Direction,
      expected: {
        data: unknown,
        hasNext: boolean,
        hasPrevious: boolean,
        paginationVariables: Variables,
        gqlPaginationQuery?: $FlowFixMe,
      },
    ) {
      expect(renderSpy).toBeCalledTimes(0);
      renderSpy.mockClear();

      // Assert refetch query was fetched
      expectRequestIsInFlight({...expected, inFlight: true, requestCount: 1});

      // Assert component suspended
      expect(renderSpy).toBeCalledTimes(0);
      expect(renderer?.asFragment().textContent).toContain('Fallback');
    }

    // TODO
    // - backward pagination
    // - simultaneous pagination
    // - TODO(T41131846): Fetch/Caching policies for loadMore / when network
    //   returns or errors synchronously
    describe('loadNext', () => {
      const direction = 'forward';

      it('does not load more if component has unmounted', async () => {
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          renderer.unmount();
        });

        expectWarningWillFire(
          'Relay: Unexpected fetch on unmounted component for fragment `useBlockingPaginationFragmentTestUserFragment` in `useBlockingPaginationFragment()`. It looks like some instances of your component are still trying to fetch data but they already unmounted. Please make sure you clear all timers, intervals, async calls, etc that may trigger a fetch.',
        );

        await act(async () => {
          loadNext(1);
        });

        expect(environment.execute).toHaveBeenCalledTimes(0);
      });

      it('does not load more if fragment ref passed to useBlockingPaginationFragment() was null', async () => {
        await renderFragment({userRef: null});
        await expectFragmentResults([
          {
            data: null,
            hasNext: false,
            hasPrevious: false,
          },
        ]);
        expectWarningWillFire(
          "Relay: Unexpected fetch while using a null fragment ref for fragment `useBlockingPaginationFragmentTestUserFragment` in `useBlockingPaginationFragment()`. When fetching more items, we expect initial fragment data to be non-null. Please make sure you're passing a valid fragment ref to `useBlockingPaginationFragment()` before paginating.",
        );

        await act(async () => {
          loadNext(1);
        });

        expect(environment.execute).toHaveBeenCalledTimes(0);
      });

      it('does not load more if request is already in flight', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });

        expect(callback).toBeCalledTimes(0);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });

        expect(environment.execute).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);
        expect(renderSpy).toBeCalledTimes(0);
      });

      it('does not load more if parent query is already active (i.e. during streaming)', async () => {
        fetchQuery(environment, query).subscribe({});

        const callback = jest.fn<[Error | null], void>();
        environment.execute.mockClear();
        await renderFragment();

        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        expect(environment.execute).toBeCalledTimes(0);
        expect(callback).toBeCalledTimes(1);
        expect(renderSpy).toBeCalledTimes(0);
      });

      describe('cancellation', () => {
        it('does not cancel load more if component unmounts', async () => {
          const callback = jest.fn<[Error | null], void>();
          const renderer = await renderFragment();
          await expectFragmentResults([
            {
              data: initialUser,

              hasNext: true,
              hasPrevious: false,
            },
          ]);
          expect(environment.execute.mock.subscriptions.length).toBe(0);
          await act(async () => {
            loadNext(1, {onComplete: callback});
          });
          expect(environment.execute.mock.subscriptions.length).toBe(1);
          const unsubscribe = jest.spyOn(
            environment.execute.mock.subscriptions[0],
            'unsubscribe',
          );

          const paginationVariables = {
            after: 'cursor:1',
            before: null,
            first: 1,
            id: '1',
            isViewerFriendLocal: false,
            last: null,
            orderby: ['name'],
            scale: null,
          };
          expectFragmentIsLoadingMore(renderer, direction, {
            data: initialUser,
            gqlPaginationQuery,
            hasNext: true,
            hasPrevious: false,
            paginationVariables,
          });
          expect(unsubscribe).toHaveBeenCalledTimes(0);

          await act(async () => {
            renderer.unmount();
          });
          // not cancelled, for activity compatibility
          expect(unsubscribe).toHaveBeenCalledTimes(0);
          expect(environment.execute).toBeCalledTimes(1);
          expect(callback).toBeCalledTimes(0);
          expect(renderSpy).toBeCalledTimes(0);
        });

        it('cancels load more if refetch is called', async () => {
          const callback = jest.fn<[Error | null], void>();
          const renderer = await renderFragment();
          await expectFragmentResults([
            {
              data: initialUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);
          expect(environment.execute.mock.subscriptions.length).toBe(0);
          await act(async () => {
            loadNext(1, {onComplete: callback});
          });
          expect(environment.execute.mock.subscriptions.length).toBe(1);
          const unsubscribe = jest.spyOn(
            environment.execute.mock.subscriptions[0],
            'unsubscribe',
          );

          const paginationVariables = {
            after: 'cursor:1',
            before: null,
            first: 1,
            id: '1',
            isViewerFriendLocal: false,
            last: null,
            orderby: ['name'],
            scale: null,
          };
          expectFragmentIsLoadingMore(renderer, direction, {
            data: initialUser,
            gqlPaginationQuery,
            hasNext: true,
            hasPrevious: false,
            paginationVariables,
          });
          expect(unsubscribe).toHaveBeenCalledTimes(0);

          await act(async () => {
            refetch({id: '4'});
          });
          expect(unsubscribe).toHaveBeenCalledTimes(1);
          expect(environment.execute).toBeCalledTimes(1); // loadMore
          expect(environment.executeWithSource).toBeCalledTimes(1); // refetch
          expect(callback).toBeCalledTimes(0);
          expect(renderSpy).toBeCalledTimes(0);
        });
      });

      it('attempts to load more even if there are no more items to load', async () => {
        (environment.getStore().getSource() as $FlowFixMe).clear();
        environment.commitPayload(query, {
          node: {
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
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: 'cursor:1',
              },
            },
            id: '1',
            name: 'Alice',
          },
        });
        const callback = jest.fn<[Error | null], void>();

        const renderer = await renderFragment();
        const expectedUser = {
          ...initialUser,
          friends: {
            ...initialUser.friends,
            pageInfo: expect.objectContaining({hasNextPage: false}),
          },
        };
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: false,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });

        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: false,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);

        environment.mock.resolve(gqlPaginationQuery, {
          data: {
            node: {
              __typename: 'User',
              friends: {
                edges: [],
                pageInfo: {
                  endCursor: null,
                  hasNextPage: null,
                  hasPreviousPage: null,
                  startCursor: null,
                },
              },
              id: '1',
              name: 'Alice',
            },
          },
        });

        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: false,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('loads and renders next items in connection', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('loads more correctly using fragment variables from literal @argument values', async () => {
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
                  ...createFragmentRef('node:1', queryWithLiteralArgs),
                },
              },
            ],
          },
        };

        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment({owner: queryWithLiteralArgs});
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: true,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expect(paginationVariables.isViewerFriendLocal).not.toBe(
          variables.isViewerFriend,
        );
        expectFragmentIsLoadingMore(renderer, direction, {
          data: expectedUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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

        expectedUser = {
          ...expectedUser,
          friends: {
            ...expectedUser.friends,
            edges: [
              {
                cursor: 'cursor:1',
                node: {
                  __typename: 'User',
                  id: 'node:1',
                  name: 'name:node:1',
                  ...createFragmentRef('node:1', queryWithLiteralArgs),
                },
              },
              {
                cursor: 'cursor:2',
                node: {
                  __typename: 'User',
                  id: 'node:2',
                  name: 'name:node:2',
                  ...createFragmentRef('node:2', queryWithLiteralArgs),
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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('correctly loads and renders next items when paginating multiple times', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        let paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);

        // Paginate a second time
        renderSpy.mockClear();
        callback.mockClear();
        environment.execute.mockClear();
        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        paginationVariables = {
          ...paginationVariables,
          after: 'cursor:2',
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: expectedUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);

        environment.mock.resolve(gqlPaginationQuery, {
          data: {
            node: {
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:3',
                    node: {
                      __typename: 'User',
                      id: 'node:3',
                      name: 'name:node:3',
                      username: 'username:node:3',
                    },
                  },
                ],
                pageInfo: {
                  endCursor: 'cursor:3',
                  hasNextPage: true,
                  hasPreviousPage: true,
                  startCursor: 'cursor:3',
                },
              },
              id: '1',
              name: 'Alice',
            },
          },
        });

        expectedUser = {
          ...expectedUser,
          friends: {
            ...expectedUser.friends,
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
              {
                cursor: 'cursor:3',
                node: {
                  __typename: 'User',
                  id: 'node:3',
                  name: 'name:node:3',
                  ...createFragmentRef('node:3', query),
                },
              },
            ],
            pageInfo: {
              endCursor: 'cursor:3',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'cursor:1',
            },
          },
        };
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      // TODO(T64875643): Re-enable after next React sync to fbsource
      // eslint-disable-next-line jest/no-disabled-tests
      it.skip('does not suspend if pagination update is interruped before it commits (unsuspends)', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        loadNext(1, {onComplete: callback});
        Scheduler.unstable_flushAll();
        jest.runAllTimers();
        Scheduler.unstable_flushAll();

        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);

        // Schedule a high-pri update while the component is
        // suspended on pagination
        Scheduler.unstable_runWithPriority(
          Scheduler.unstable_UserBlockingPriority,
          () => {
            forceUpdate(prev => prev + 1);
          },
        );

        Scheduler.unstable_flushAll();

        // Assert high-pri update when initial update
        // that suspended hasn't committed
        // Assert fallback is still rendered despite high-pri update
        // as per React's expected behavior
        expect(renderSpy).toBeCalledTimes(0);
        expect(renderer?.asFragment().textContent).toEqual('Fallback');

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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('updates are ignored while loading more (i.e. while suspended)', async () => {
        jest.doMock('../useLoadMoreFunction');
        const useLoadMoreFunction = require('../useLoadMoreFunction');
        // $FlowFixMe[prop-missing]
        useLoadMoreFunction.mockImplementation((...args: any) =>
          jest.requireActual<any>('../useLoadMoreFunction')(...args),
        );

        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);
        // $FlowFixMe[prop-missing]
        useLoadMoreFunction.mockClear();

        environment.commitPayload(
          createOperationDescriptor(gqlNodeQuery, {id: '1'}),
          {
            node: {
              __typename: 'User',
              id: '1',
              name: 'Alice updated',
            },
          },
        );

        // Assert that component did not re-render while suspended
        await act(async () => jest.runAllImmediates());
        expect(renderSpy).toBeCalledTimes(0);
        expect(useLoadMoreFunction).toBeCalledTimes(0);

        jest.dontMock('../useLoadMoreFunction');
      });

      it('renders with latest updated data from any updates missed while suspended for pagination', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);

        environment.commitPayload(
          createOperationDescriptor(gqlNodeQuery, {id: '1'}),
          {
            node: {
              __typename: 'User',
              id: '1',
              name: 'Alice updated',
            },
          },
        );

        // Assert that component did not re-render while suspended
        await act(async () => jest.runAllImmediates());
        expect(renderSpy).toBeCalledTimes(0);

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
          name: 'Alice',
        };
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('correctly updates when fragment data changes after pagination', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,

            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);

        // Update parent record
        await act(async () => {
          environment.commitPayload(
            createOperationDescriptor(gqlNodeQuery, {id: '1'}),
            {
              node: {
                __typename: 'User',
                id: '1',
                // Update name
                name: 'Alice in Wonderland',
              },
            },
          );
        });
        await expectFragmentResults([
          {
            data: {
              ...expectedUser,
              // Assert that name is updated
              name: 'Alice in Wonderland',
            },
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        // Update edge
        await act(async () => {
          environment.commitPayload(
            createOperationDescriptor(gqlNodeQuery, {id: 'node:1'}),
            {
              node: {
                __typename: 'User',
                id: 'node:1',
                // Update name
                name: 'name:node:1-updated',
              },
            },
          );
        });
        await expectFragmentResults([
          {
            data: {
              ...expectedUser,
              friends: {
                ...expectedUser.friends,
                edges: [
                  {
                    cursor: 'cursor:1',
                    node: {
                      __typename: 'User',
                      id: 'node:1',
                      // Assert that name is updated
                      name: 'name:node:1-updated',
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
              },
              name: 'Alice in Wonderland',
            },

            hasNext: true,
            hasPrevious: false,
          },
        ]);
      });

      it('(currently) reset the pagination to the initial state (even after a successful `loadNext`) in cases when a payload with missing data for the connection is published to the store.', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,

            hasNext: true,
            hasPrevious: false,
          },
        ]);
        // loading the next page in the connection
        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);

        // server resolved the payload for the next page
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

        // new data has new page in it
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
        // data is rendered correctly
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);

        // now, let's publish payload with missing connection data
        expectWarningWillFire(
          'RelayResponseNormalizer: Payload did not contain a value for field `friends: friends(first:1,isViewerFriend:false,orderby:["name"])`. Check that you are parsing with the same query that was used to fetch the payload.',
        );

        await act(async () => {
          environment.commitPayload(query, {
            node: {
              __typename: 'User',
              id: '1',
              // Update name
              name: 'Alice in Wonderland',
            },
          });
        });

        await expectFragmentResults([
          {
            data: {
              // BUG! Currently, this resets the data in pagination fragment to the initial state (before the loadNext)
              ...initialUser,
              // But, it changes the name
              name: 'Alice in Wonderland',
            },
            hasNext: true,
            hasPrevious: false,
          },
        ]);
      });

      it('loads more correctly when original variables do not include an id', async () => {
        const callback = jest.fn<[Error | null], void>();
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

        const renderer = await renderFragment({owner: queryWithoutID, userRef});
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: expectedUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('loads more with correct id from refetchable fragment when using a nested fragment', async () => {
        const callback = jest.fn<[Error | null], void>();

        // Populate store with data for query using nested fragment
        environment.commitPayload(queryNestedFragment, {
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

        // Get fragment ref for user using nested fragment
        const userRef = (
          environment.lookup(queryNestedFragment.fragment).data as $FlowFixMe
        )?.node?.actor;

        initialUser = {
          friends: {
            edges: [
              {
                cursor: 'cursor:1',
                node: {
                  __typename: 'User',
                  id: 'node:1',
                  name: 'name:node:1',
                  ...createFragmentRef('node:1', queryNestedFragment),
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

        const renderer = await renderFragment({
          owner: queryNestedFragment,
          userRef,
        });
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          // The id here should correspond to the user id, and not the
          // feedback id from the query variables (i.e. `<feedbackid>`)
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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
                  ...createFragmentRef('node:1', queryNestedFragment),
                },
              },
              {
                cursor: 'cursor:2',
                node: {
                  __typename: 'User',
                  id: 'node:2',
                  name: 'name:node:2',
                  ...createFragmentRef('node:2', queryNestedFragment),
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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('calls callback with error when error occurs during fetch', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,

            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);

        const error = new Error('Oops');
        environment.mock.reject(gqlPaginationQuery, error);

        // We pass the error in the callback, but do not throw during render
        // since we want to continue rendering the existing items in the
        // connection
        expect(callback).toBeCalledTimes(1);
        expect(callback).toBeCalledWith(error);

        // FIXME: Something strange is happening with this testfetchQuery
        // Someone is caching the error which makes react re-render
        // the component twice: `expectFragmentResults` will fail in the next
        // test
        jest.resetModules();
      });

      it('preserves pagination request if re-rendered with same fragment ref', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
        });
        expect(callback).toBeCalledTimes(0);

        await act(async () => {
          setOwner({...query});
        });

        // Assert that request is still in flight after re-rendering
        // with new fragment ref that points to the same data.
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      describe('extra variables', () => {
        it('loads and renders the next items in the connection when passing extra variables', async () => {
          const callback = jest.fn<[Error | null], void>();
          const renderer = await renderFragment();
          await expectFragmentResults([
            {
              data: initialUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);

          await act(async () => {
            loadNext(1, {
              // Pass extra variables that are different from original request
              UNSTABLE_extraVariables: {scale: 2.0},
              onComplete: callback,
            });
          });
          const paginationVariables = {
            after: 'cursor:1',
            before: null,
            first: 1,
            id: '1',
            isViewerFriendLocal: false,
            last: null,
            orderby: ['name'],
            // Assert that value from extra variables is used
            scale: 2.0,
          };
          expectFragmentIsLoadingMore(renderer, direction, {
            data: initialUser,
            gqlPaginationQuery,
            hasNext: true,
            hasPrevious: false,
            paginationVariables,
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
          await expectFragmentResults([
            {
              data: expectedUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);
          expect(callback).toBeCalledTimes(1);
        });

        it('loads the next items in the connection and ignores any pagination vars passed as extra vars', async () => {
          const callback = jest.fn<[Error | null], void>();
          const renderer = await renderFragment();
          await expectFragmentResults([
            {
              data: initialUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);

          expectWarningWillFire(
            'Relay: `UNSTABLE_extraVariables` provided by caller should not contain cursor variable `after`. This variable is automatically determined by Relay.',
          );
          expectWarningWillFire(
            'Relay: `UNSTABLE_extraVariables` provided by caller should not contain count variable `first`. This variable is automatically determined by Relay.',
          );

          await act(async () => {
            loadNext(1, {
              // Pass pagination vars as extra variables
              UNSTABLE_extraVariables: {after: 'foo', first: 100},
              onComplete: callback,
            });
          });
          const paginationVariables = {
            // Assert that pagination vars from extra variables are ignored
            after: 'cursor:1',
            before: null,
            first: 1,
            id: '1',
            isViewerFriendLocal: false,
            last: null,
            orderby: ['name'],
            scale: null,
          };
          expectFragmentIsLoadingMore(renderer, direction, {
            data: initialUser,
            gqlPaginationQuery,
            hasNext: true,
            hasPrevious: false,
            paginationVariables,
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
          await expectFragmentResults([
            {
              data: expectedUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);
          expect(callback).toBeCalledTimes(1);
        });
      });

      describe('disposing', () => {
        it('disposes ongoing request if environment changes', async () => {
          const callback = jest.fn<[Error | null], void>();
          const renderer = await renderFragment();
          await expectFragmentResults([
            {
              data: initialUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);
          expect(environment.execute.mock.subscriptions.length).toBe(0);
          await act(async () => {
            loadNext(1, {onComplete: callback});
          });
          expect(environment.execute.mock.subscriptions.length).toBe(1);
          const unsubscribe = jest.spyOn(
            environment.execute.mock.subscriptions[0],
            'unsubscribe',
          );

          // Assert request is started
          const paginationVariables = {
            after: 'cursor:1',
            before: null,
            first: 1,
            id: '1',
            isViewerFriendLocal: false,
            last: null,
            orderby: ['name'],
            scale: null,
          };
          expectFragmentIsLoadingMore(renderer, direction, {
            data: initialUser,
            gqlPaginationQuery,
            hasNext: true,
            hasPrevious: false,
            paginationVariables,
          });
          expect(callback).toBeCalledTimes(0);

          // Set new environment
          const newEnvironment = createMockEnvironment({
            handlerProvider: () => ConnectionHandler,
          });
          newEnvironment.commitPayload(query, {
            node: {
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
              name: 'Alice in a different environment',
            },
          });
          await act(async () => {
            setEnvironment(newEnvironment);
          });

          // Assert request was canceled
          expect(unsubscribe).toBeCalledTimes(1);
          expectRequestIsInFlight({
            gqlPaginationQuery,
            inFlight: false,
            paginationVariables,
            requestCount: 1,
          });

          // Assert newly rendered data
          await expectFragmentResults([
            {
              data: {
                ...initialUser,
                name: 'Alice in a different environment',
              },
              hasNext: true,
              hasPrevious: false,
            },
            {
              data: {
                ...initialUser,
                name: 'Alice in a different environment',
              },
              hasNext: true,
              hasPrevious: false,
            },
          ]);
        });

        it('disposes ongoing request if fragment ref changes', async () => {
          const callback = jest.fn<[Error | null], void>();
          const renderer = await renderFragment();
          await expectFragmentResults([
            {
              data: initialUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);
          expect(environment.execute.mock.subscriptions.length).toBe(0);
          await act(async () => {
            loadNext(1, {onComplete: callback});
          });
          expect(environment.execute.mock.subscriptions.length).toBe(1);
          const unsubscribe = jest.spyOn(
            environment.execute.mock.subscriptions[0],
            'unsubscribe',
          );

          // Assert request is started
          const paginationVariables = {
            after: 'cursor:1',
            before: null,
            first: 1,
            id: '1',
            isViewerFriendLocal: false,
            last: null,
            orderby: ['name'],
            scale: null,
          };
          expectFragmentIsLoadingMore(renderer, direction, {
            data: initialUser,
            gqlPaginationQuery,
            hasNext: true,
            hasPrevious: false,
            paginationVariables,
          });
          expect(callback).toBeCalledTimes(0);

          // Pass new parent fragment ref with different variables
          const newVariables = {...variables, isViewerFriend: true};
          const newQuery = createOperationDescriptor(gqlQuery, newVariables);
          environment.commitPayload(newQuery, {
            node: {
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
          });
          await act(async () => {
            setOwner(newQuery);
          });

          // Assert request was canceled
          expect(unsubscribe).toBeCalledTimes(1);
          expectRequestIsInFlight({
            gqlPaginationQuery,
            inFlight: false,
            paginationVariables,
            requestCount: 1,
          });

          // Assert newly rendered data
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
                    // Assert fragment ref points to owner with new variables
                    ...createFragmentRef('node:1', newQuery),
                  },
                },
              ],
            },
          };
          await expectFragmentResults([
            {
              data: expectedUser,
              hasNext: true,
              hasPrevious: false,
            },
            {
              data: expectedUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);
        });

        it('does not dispose ongoing request on unmount', async () => {
          const callback = jest.fn<[Error | null], void>();
          const renderer = await renderFragment();
          await expectFragmentResults([
            {
              data: initialUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);
          expect(environment.execute.mock.subscriptions.length).toBe(0);
          await act(async () => {
            loadNext(1, {onComplete: callback});
          });
          expect(environment.execute.mock.subscriptions.length).toBe(1);
          const unsubscribe = jest.spyOn(
            environment.execute.mock.subscriptions[0],
            'unsubscribe',
          );

          // Assert request is started
          const paginationVariables = {
            after: 'cursor:1',
            before: null,
            first: 1,
            id: '1',
            isViewerFriendLocal: false,
            last: null,
            orderby: ['name'],
            scale: null,
          };
          expectFragmentIsLoadingMore(renderer, direction, {
            data: initialUser,
            gqlPaginationQuery,
            hasNext: true,
            hasPrevious: false,
            paginationVariables,
          });
          expect(callback).toBeCalledTimes(0);
          expect(unsubscribe).toBeCalledTimes(0);
          await act(async () => {
            renderer.unmount();
          });

          // Assert request was not canceled (for activity compatibility)
          expect(unsubscribe).toBeCalledTimes(0);
          expectRequestIsInFlight({
            gqlPaginationQuery,
            inFlight: true,
            paginationVariables,
            requestCount: 1,
          });
        });

        it('does not dispose ongoing request if it is manually disposed', async () => {
          const callback = jest.fn<[Error | null], void>();
          const renderer = await renderFragment();
          await expectFragmentResults([
            {
              data: initialUser,
              hasNext: true,
              hasPrevious: false,
            },
          ]);

          let disposable;
          expect(environment.execute.mock.subscriptions.length).toBe(0);
          await act(async () => {
            disposable = loadNext(1, {onComplete: callback});
          });
          expect(environment.execute.mock.subscriptions.length).toBe(1);
          const unsubscribe = jest.spyOn(
            environment.execute.mock.subscriptions[0],
            'unsubscribe',
          );

          // Assert request is started
          const paginationVariables = {
            after: 'cursor:1',
            before: null,
            first: 1,
            id: '1',
            isViewerFriendLocal: false,
            last: null,
            orderby: ['name'],
            scale: null,
          };
          expectFragmentIsLoadingMore(renderer, direction, {
            data: initialUser,
            gqlPaginationQuery,
            hasNext: true,
            hasPrevious: false,
            paginationVariables,
          });
          expect(callback).toBeCalledTimes(0);

          // $FlowFixMe[incompatible-use]
          disposable.dispose();

          // Assert request was not canceled (for activity compatibility)
          expect(unsubscribe).toBeCalledTimes(0);
          expectRequestIsInFlight({
            gqlPaginationQuery,
            inFlight: true,
            paginationVariables,
            requestCount: 1,
          });
          expect(renderSpy).toHaveBeenCalledTimes(0);
        });
      });
    });

    describe('hasNext', () => {
      const direction = 'forward';

      it('returns true if it has more items', async () => {
        (environment.getStore().getSource() as $FlowFixMe).clear();
        environment.commitPayload(query, {
          node: {
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
        });

        await renderFragment();
        await expectFragmentResults([
          {
            data: {
              ...initialUser,
              friends: {
                ...initialUser.friends,
                pageInfo: expect.objectContaining({hasNextPage: true}),
              },
            },
            // Assert hasNext is true
            hasNext: true,
            hasPrevious: false,
          },
        ]);
      });

      it('returns false if edges are null', async () => {
        (environment.getStore().getSource() as $FlowFixMe).clear();
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            friends: {
              edges: null,
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
        });

        await renderFragment();
        await expectFragmentResults([
          {
            data: {
              ...initialUser,
              friends: {
                ...initialUser.friends,
                edges: null,
                pageInfo: expect.objectContaining({hasNextPage: true}),
              },
            },
            // Assert hasNext is false
            hasNext: false,
            hasPrevious: false,
          },
        ]);
      });

      it('returns false if edges are undefined', async () => {
        (environment.getStore().getSource() as $FlowFixMe).clear();
        expectWarningWillFire(
          'RelayResponseNormalizer: Payload did not contain a value for field `edges: edges`. Check that you are parsing with the same query that was used to fetch the payload.',
        );
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            friends: {
              edges: undefined,
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
        });

        await renderFragment();
        await expectFragmentResults([
          {
            data: {
              ...initialUser,
              friends: {
                ...initialUser.friends,
                edges: undefined,
                pageInfo: expect.objectContaining({hasNextPage: true}),
              },
            },
            // Assert hasNext is false
            hasNext: false,
            hasPrevious: false,
          },
        ]);
      });

      it('returns false if end cursor is null', async () => {
        (environment.getStore().getSource() as $FlowFixMe).clear();
        environment.commitPayload(query, {
          node: {
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
                // endCursor is null
                endCursor: null,
                // but hasNextPage is still true
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: null,
              },
            },
            id: '1',
            name: 'Alice',
          },
        });

        await renderFragment();
        await expectFragmentResults([
          {
            data: {
              ...initialUser,
              friends: {
                ...initialUser.friends,
                pageInfo: expect.objectContaining({
                  endCursor: null,
                  hasNextPage: true,
                }),
              },
            },
            // Assert hasNext is false
            hasNext: false,
            hasPrevious: false,
          },
        ]);
      });

      it('returns false if end cursor is undefined', async () => {
        (environment.getStore().getSource() as $FlowFixMe).clear();
        expectWarningWillFire(
          'RelayResponseNormalizer: Payload did not contain a value for field `endCursor: endCursor`. Check that you are parsing with the same query that was used to fetch the payload.',
        );
        expectWarningWillFire(
          'RelayResponseNormalizer: Payload did not contain a value for field `startCursor: startCursor`. Check that you are parsing with the same query that was used to fetch the payload.',
        );
        environment.commitPayload(query, {
          node: {
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
                // endCursor is undefined
                endCursor: undefined,
                // but hasNextPage is still true
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: undefined,
              },
            },
            id: '1',
            name: 'Alice',
          },
        });

        await renderFragment();
        await expectFragmentResults([
          {
            data: {
              ...initialUser,
              friends: {
                ...initialUser.friends,
                pageInfo: expect.objectContaining({
                  endCursor: null,
                  hasNextPage: true,
                }),
              },
            },
            // Assert hasNext is false
            hasNext: false,
            hasPrevious: false,
          },
        ]);
      });

      it('returns false if pageInfo.hasNextPage is false-ish', async () => {
        (environment.getStore().getSource() as $FlowFixMe).clear();
        environment.commitPayload(query, {
          node: {
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
                hasNextPage: null,
                hasPreviousPage: false,
                startCursor: 'cursor:1',
              },
            },
            id: '1',
            name: 'Alice',
          },
        });

        await renderFragment();
        await expectFragmentResults([
          {
            data: {
              ...initialUser,
              friends: {
                ...initialUser.friends,
                pageInfo: expect.objectContaining({
                  hasNextPage: null,
                }),
              },
            },
            // Assert hasNext is false
            hasNext: false,
            hasPrevious: false,
          },
        ]);
      });

      it('returns false if pageInfo.hasNextPage is false', async () => {
        (environment.getStore().getSource() as $FlowFixMe).clear();
        environment.commitPayload(query, {
          node: {
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
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: 'cursor:1',
              },
            },
            id: '1',
            name: 'Alice',
          },
        });

        await renderFragment();
        await expectFragmentResults([
          {
            data: {
              ...initialUser,
              friends: {
                ...initialUser.friends,
                pageInfo: expect.objectContaining({
                  hasNextPage: false,
                }),
              },
            },
            // Assert hasNext is false
            hasNext: false,
            hasPrevious: false,
          },
        ]);
      });

      it('updates after pagination if more results are available', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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
        await expectFragmentResults([
          {
            // First update has updated connection
            data: expectedUser,
            // Assert hasNext reflects server response
            hasNext: true,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });

      it('updates after pagination if no more results are available', async () => {
        const callback = jest.fn<[Error | null], void>();
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          loadNext(1, {onComplete: callback});
        });
        const paginationVariables = {
          after: 'cursor:1',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, direction, {
          data: initialUser,
          gqlPaginationQuery,
          hasNext: true,
          hasPrevious: false,
          paginationVariables,
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
                  hasNextPage: false,
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
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: 'cursor:1',
            },
          },
        };
        await expectFragmentResults([
          {
            data: expectedUser,
            // Assert hasNext reflects server response
            hasNext: false,
            hasPrevious: false,
          },
        ]);
        expect(callback).toBeCalledTimes(1);
      });
    });

    describe('refetch', () => {
      // The bulk of refetch behavior is covered in useRefetchableFragmentNode-test,
      // so this suite covers the pagination-related test cases.
      function expectRefetchRequestIsInFlight(expected: any) {
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

      function expectFragmentIsRefetching(
        renderer: any,
        expected: {
          data: unknown,
          hasNext: boolean,
          hasPrevious: boolean,
          refetchVariables: Variables,
          refetchQuery?: OperationDescriptor,
          gqlRefetchQuery?: $FlowFixMe,
        },
      ) {
        expect(renderSpy).toBeCalledTimes(0);
        renderSpy.mockClear();

        // Assert refetch query was fetched
        expectRefetchRequestIsInFlight({
          ...expected,
          inFlight: true,
          requestCount: 1,
        });

        // Assert component suspended
        expect(renderSpy).toBeCalledTimes(0);
        expect(renderer?.asFragment().textContent).toEqual('Fallback');

        // Assert query is retained by loadQuery
        // and tentatively retained while component is suspended
        expect(environment.retain).toBeCalledTimes(2);
        expect(environment.retain.mock.calls[0][0]).toEqual(
          expected.refetchQuery ?? paginationQuery,
        );
      }

      it('refetches new variables correctly when refetching new id', async () => {
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          refetch({id: '4'});
        });

        // Assert that fragment is refetching with the right variables and
        // suspends upon refetch
        const refetchVariables = {
          after: null,
          before: null,
          first: 1,
          id: '4',
          isViewerFriendLocal: false,
          last: null,
          orderby: ['name'],
          scale: null,
        };
        paginationQuery = createOperationDescriptor(
          gqlPaginationQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
          refetchQuery: paginationQuery,
          refetchVariables,
        });

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
              id: '4',
              name: 'Mark',
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
          id: '4',
          name: 'Mark',
        };
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        // Assert refetch query was retained by loadQuery and the component
        expect(release).not.toBeCalled();
        expect(environment.retain).toBeCalledTimes(2);
        expect(environment.retain.mock.calls[0][0]).toEqual(paginationQuery);
      });

      it('refetches new variables correctly when refetching same id', async () => {
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          refetch({isViewerFriendLocal: true, orderby: ['lastname']});
        });

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
          scale: null,
        };
        paginationQuery = createOperationDescriptor(
          gqlPaginationQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
          refetchQuery: paginationQuery,
          refetchVariables,
        });

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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        // Assert refetch query was retained by loadQuery and the component
        expect(release).not.toBeCalled();
        expect(environment.retain).toBeCalledTimes(2);
        expect(environment.retain.mock.calls[0][0]).toEqual(paginationQuery);
      });

      it('refetches with correct id from refetchable fragment when using nested fragment', async () => {
        // Populate store with data for query using nested fragment
        environment.commitPayload(queryNestedFragment, {
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

        // Get fragment ref for user using nested fragment
        const userRef = (
          environment.lookup(queryNestedFragment.fragment).data as $FlowFixMe
        )?.node?.actor;

        initialUser = {
          friends: {
            edges: [
              {
                cursor: 'cursor:1',
                node: {
                  __typename: 'User',
                  id: 'node:1',
                  name: 'name:node:1',
                  ...createFragmentRef('node:1', queryNestedFragment),
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

        const renderer = await renderFragment({
          owner: queryNestedFragment,
          userRef,
        });
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          refetch({isViewerFriendLocal: true, orderby: ['lastname']});
        });

        // Assert that fragment is refetching with the right variables and
        // suspends upon refetch
        const refetchVariables = {
          after: null,
          before: null,
          first: 1,
          // The id here should correspond to the user id, and not the
          // feedback id from the query variables (i.e. `<feedbackid>`)
          id: '1',
          isViewerFriendLocal: true,
          last: null,
          orderby: ['lastname'],
          scale: null,
        };
        paginationQuery = createOperationDescriptor(
          gqlPaginationQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
          refetchQuery: paginationQuery,
          refetchVariables,
        });

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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        // Assert refetch query was retained by loadQuery and the component
        expect(release).not.toBeCalled();
        expect(environment.retain).toBeCalledTimes(2);
        expect(environment.retain.mock.calls[0][0]).toEqual(paginationQuery);
      });

      it('loads more items correctly after refetching', async () => {
        const renderer = await renderFragment();
        await expectFragmentResults([
          {
            data: initialUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        await act(async () => {
          refetch({isViewerFriendLocal: true, orderby: ['lastname']});
        });

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
          scale: null,
        };
        paginationQuery = createOperationDescriptor(
          gqlPaginationQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          data: initialUser,
          hasNext: true,
          hasPrevious: false,
          refetchQuery: paginationQuery,
          refetchVariables,
        });

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
        await expectFragmentResults([
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
          {
            data: expectedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);

        // Assert refetch query was retained by loadQuery and the component
        expect(release).not.toBeCalled();
        expect(environment.retain).toBeCalledTimes(2);
        expect(environment.retain.mock.calls[0][0]).toEqual(paginationQuery);

        // Paginate after refetching
        environment.execute.mockClear();
        await act(async () => {
          loadNext(1);
        });
        const paginationVariables = {
          after: 'cursor:100',
          before: null,
          first: 1,
          id: '1',
          isViewerFriendLocal: true,
          last: null,
          orderby: ['lastname'],
          scale: null,
        };
        expectFragmentIsLoadingMore(renderer, 'forward', {
          data: expectedUser,
          gqlPaginationQuery,
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
        await expectFragmentResults([
          {
            // Second update sets isLoading flag back to false
            data: paginatedUser,
            hasNext: true,
            hasPrevious: false,
          },
        ]);
      });
    });
  });
});
