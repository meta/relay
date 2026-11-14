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

import type {RelayMockEnvironment} from '../../../relay-test-utils/RelayModernMockEnvironment';
import type {
  useRefetchableFragmentNodeTest1FragmentRefetchQuery$data,
  useRefetchableFragmentNodeTest1FragmentRefetchQuery$variables,
} from './__generated__/useRefetchableFragmentNodeTest1FragmentRefetchQuery.graphql';
import type {
  useRefetchableFragmentNodeTest1Query$data,
  useRefetchableFragmentNodeTest1Query$variables,
} from './__generated__/useRefetchableFragmentNodeTest1Query.graphql';
import type {
  useRefetchableFragmentNodeTest2Query$data,
  useRefetchableFragmentNodeTest2Query$variables,
} from './__generated__/useRefetchableFragmentNodeTest2Query.graphql';
import type {
  useRefetchableFragmentNodeTest3FragmentRefetchQuery$data,
  useRefetchableFragmentNodeTest3FragmentRefetchQuery$variables,
} from './__generated__/useRefetchableFragmentNodeTest3FragmentRefetchQuery.graphql';
import type {
  useRefetchableFragmentNodeTestUserFragmentRefetchQuery$data,
  useRefetchableFragmentNodeTestUserFragmentRefetchQuery$variables,
} from './__generated__/useRefetchableFragmentNodeTestUserFragmentRefetchQuery.graphql';
import type {
  useRefetchableFragmentNodeTestUserQuery$data,
  useRefetchableFragmentNodeTestUserQuery$variables,
} from './__generated__/useRefetchableFragmentNodeTestUserQuery.graphql';
import type {RelayContext} from 'relay-runtime';
import type {
  FetchPolicy,
  OperationDescriptor,
  RenderPolicy,
  Variables,
} from 'relay-runtime';
import type {Query} from 'relay-runtime/util/RelayRuntimeTypes';

const {MockPayloadGenerator} = require('relay-test-utils');
const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useRefetchableFragmentInternal = require('../useRefetchableFragmentInternal');
const invariant = require('invariant');
const React = require('react');
const ReactRelayContext = require('react-relay/ReactRelayContext');
const TestRenderer = require('react-test-renderer');
const {
  __internal: {fetchQuery},
  FRAGMENT_OWNER_KEY,
  FRAGMENTS_KEY,
  ID_KEY,
  Observable,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {
  createMockEnvironment,
  injectPromisePolyfill__DEPRECATED,
  trackRetentionForEnvironment,
} = require('relay-test-utils-internal');
const Scheduler = require('scheduler');

injectPromisePolyfill__DEPRECATED();

const {useMemo, useState, useEffect} = React;

describe('useRefetchableFragmentInternal (%s)', () => {
  let environment;
  let gqlQuery:
    | Query<
        useRefetchableFragmentNodeTest1Query$variables,
        useRefetchableFragmentNodeTest1Query$data,
      >
    | Query<
        useRefetchableFragmentNodeTest2Query$variables,
        useRefetchableFragmentNodeTest2Query$data,
      >
    | Query<
        useRefetchableFragmentNodeTestUserQuery$variables,
        useRefetchableFragmentNodeTestUserQuery$data,
      >;
  let gqlQueryNestedFragment;
  let gqlRefetchQuery:
    | Query<
        useRefetchableFragmentNodeTest1FragmentRefetchQuery$variables,
        useRefetchableFragmentNodeTest1FragmentRefetchQuery$data,
      >
    | Query<
        useRefetchableFragmentNodeTest3FragmentRefetchQuery$variables,
        useRefetchableFragmentNodeTest3FragmentRefetchQuery$data,
      >
    | Query<
        useRefetchableFragmentNodeTestUserFragmentRefetchQuery$variables,
        useRefetchableFragmentNodeTestUserFragmentRefetchQuery$data,
      >;
  let gqlQueryWithArgs;
  let gqlQueryWithLiteralArgs;
  let gqlRefetchQueryWithArgs;
  let gqlFragment;
  let gqlFragmentWithArgs;
  let query;
  let queryNestedFragment;
  let refetchQuery;
  let queryWithArgs;
  let queryWithLiteralArgs;
  let refetchQueryWithArgs;
  let variables:
    | {id: string, scale: number}
    | {id: string}
    | {nodeID: string, scale: number};
  let variablesNestedFragment;
  let forceUpdate;
  let setEnvironment;
  let setOwner;
  let fetchPolicy: FetchPolicy;
  let renderPolicy;
  let renderFragment;
  let commitSpy;
  let refetch;
  let callDuringRenderCount;
  let Renderer;

  class ErrorBoundary extends React.Component<any, any> {
    state: {error: ?Error} = {error: null};
    componentDidCatch(error: Error) {
      this.setState({error});
    }
    render(): React.Node {
      const {children, fallback: Fallback} = this.props;
      const {error} = this.state;
      if (error) {
        return <Fallback error={error} />;
      }
      return children;
    }
  }

  function useRefetchableFragmentNode(fragmentNode: any, fragmentRef: any) {
    const result = useRefetchableFragmentInternal<any, any>(
      fragmentNode,
      fragmentRef,
      'TestDisplayName',
    );
    refetch = result.refetch;
    useEffect(() => {
      commitSpy(result.fragmentData, refetch);
    });
    return result;
  }

  function assertCall(expected: {data: any}, idx: number) {
    const actualData = commitSpy.mock.calls[idx][0];

    expect(actualData).toEqual(expected.data);
  }

  function expectFragmentResults(
    expectedCalls: ReadonlyArray<{data: $FlowFixMe}>,
  ) {
    // This ensures that useEffect runs
    TestRenderer.act(() => jest.runAllImmediates());
    expect(commitSpy).toBeCalledTimes(expectedCalls.length);
    expectedCalls.forEach((expected, idx) => assertCall(expected, idx));
    commitSpy.mockClear();
  }

  function createFragmentRef(
    id: string,
    owner: OperationDescriptor,
    fragmentName: string = 'useRefetchableFragmentNodeTestNestedUserFragment',
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
    jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
    jest.mock('warning');
    jest.mock('scheduler', () => require('../../__tests__/mockScheduler'));
    /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
     * enabling Flow LTI mode */
    commitSpy = jest.fn<_, unknown>();

    fetchPolicy = 'store-or-network';
    renderPolicy = 'partial' as RenderPolicy;
    callDuringRenderCount = 0;

    // Set up environment and base data
    environment = createMockEnvironment();
    graphql`
      fragment useRefetchableFragmentNodeTestNestedUserFragment on User {
        username
      }
    `;
    gqlFragmentWithArgs = graphql`
      fragment useRefetchableFragmentNodeTestUserFragmentWithArgs on User
      @refetchable(
        queryName: "useRefetchableFragmentNodeTestUserFragmentWithArgsRefetchQuery"
      )
      @argumentDefinitions(scaleLocal: {type: "Float!"}) {
        id
        name
        profile_picture(scale: $scaleLocal) {
          uri
        }
        ...useRefetchableFragmentNodeTestNestedUserFragment
      }
    `;
    gqlFragment = graphql`
      fragment useRefetchableFragmentNodeTestUserFragment on User
      @refetchable(
        queryName: "useRefetchableFragmentNodeTestUserFragmentRefetchQuery"
      ) {
        id
        name
        profile_picture(scale: $scale) {
          uri
        }
        ...useRefetchableFragmentNodeTestNestedUserFragment
      }
    `;
    gqlQuery = graphql`
      query useRefetchableFragmentNodeTestUserQuery($id: ID!, $scale: Float!) {
        node(id: $id) {
          ...useRefetchableFragmentNodeTestUserFragment
            @dangerously_unaliased_fixme
        }
      }
    `;
    gqlQueryNestedFragment = graphql`
      query useRefetchableFragmentNodeTestUserQueryNestedFragmentQuery(
        $id: ID!
        $scale: Float!
      ) {
        node(id: $id) {
          actor {
            ...useRefetchableFragmentNodeTestUserFragment
              @dangerously_unaliased_fixme
          }
        }
      }
    `;
    gqlQueryWithArgs = graphql`
      query useRefetchableFragmentNodeTestUserQueryWithArgsQuery(
        $id: ID!
        $scale: Float!
      ) {
        node(id: $id) {
          ...useRefetchableFragmentNodeTestUserFragmentWithArgs
            @dangerously_unaliased_fixme
            @arguments(scaleLocal: $scale)
        }
      }
    `;
    gqlQueryWithLiteralArgs = graphql`
      query useRefetchableFragmentNodeTestUserQueryWithLiteralArgsQuery(
        $id: ID!
      ) {
        node(id: $id) {
          ...useRefetchableFragmentNodeTestUserFragmentWithArgs
            @dangerously_unaliased_fixme
            @arguments(scaleLocal: 16)
        }
      }
    `;
    variables = {id: '1', scale: 16};
    variablesNestedFragment = {id: '<feedbackid>', scale: 16};
    gqlRefetchQuery = require('./__generated__/useRefetchableFragmentNodeTestUserFragmentRefetchQuery.graphql');
    gqlRefetchQueryWithArgs = require('./__generated__/useRefetchableFragmentNodeTestUserFragmentWithArgsRefetchQuery.graphql');

    invariant(
      gqlFragment.metadata?.refetch?.operation === gqlRefetchQuery,
      'useRefetchableFragment-test: Expected refetchable fragment metadata to contain operation.',
    );
    invariant(
      gqlFragmentWithArgs.metadata?.refetch?.operation ===
        gqlRefetchQueryWithArgs,
      'useRefetchableFragment-test: Expected refetchable fragment metadata to contain operation.',
    );

    query = createOperationDescriptor(gqlQuery, variables);
    queryNestedFragment = createOperationDescriptor(
      gqlQueryNestedFragment,
      variablesNestedFragment,
    );
    refetchQuery = createOperationDescriptor(gqlRefetchQuery, variables, {
      force: true,
    });
    queryWithArgs = createOperationDescriptor(gqlQueryWithArgs, variables);
    queryWithLiteralArgs = createOperationDescriptor(gqlQueryWithLiteralArgs, {
      id: variables.id,
    });
    refetchQueryWithArgs = createOperationDescriptor(
      gqlRefetchQueryWithArgs,
      variables,
      {force: true},
    );
    environment.commitPayload(query, {
      node: {
        __typename: 'User',
        id: '1',
        name: 'Alice',
        profile_picture: null,
        username: 'useralice',
      },
    });

    // Set up renderers
    Renderer = (props: {user: unknown}) => null;

    const Container = (props: {
      userRef?: {...},
      owner: OperationDescriptor,
      fragment?: $FlowFixMe,
      callDuringRenderKey?: ?number,
      ...
    }) => {
      // We need a render a component to run a Hook
      const [owner, setOwner_] = useState<OperationDescriptor>(props.owner);
      const [, setCount_] = useState(0);
      const fragment = props.fragment ?? gqlFragment;
      const artificialUserRef = useMemo(
        () => ({
          [FRAGMENT_OWNER_KEY]: owner.request,
          [FRAGMENTS_KEY]: {
            // $FlowFixMe[invalid-computed-prop] Error found while enabling LTI on this file
            [fragment.name]: {},
          },
          [ID_KEY]:
            owner.request.variables.id ?? owner.request.variables.nodeID,
        }),
        [owner, fragment.name],
      );
      const userRef = props.hasOwnProperty('userRef')
        ? props.userRef
        : artificialUserRef;

      forceUpdate = setCount_;
      setOwner = setOwner_;

      const {fragmentData: userData, refetch: refetchInternal} =
        useRefetchableFragmentNode(fragment, userRef);

      if (
        props.callDuringRenderKey != null &&
        props.callDuringRenderKey !== callDuringRenderCount
      ) {
        callDuringRenderCount++;
        refetchInternal({});
      }
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
      callDuringRenderKey?: ?number,
      ...
    }): $FlowFixMe => {
      const {isConcurrent = false, ...props} = args ?? {};
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
        jest.runAllImmediates();
      });
      return renderer;
    };
  });

  afterEach(() => {
    environment.mockClear();
    commitSpy.mockClear();
  });

  describe('initial render', () => {
    // The bulk of initial render behavior is covered in useFragmentNode-test,
    // so this suite covers the basic cases as a sanity check.
    it('should throw error if fragment is plural', () => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});

      const UserFragment = graphql`
        fragment useRefetchableFragmentNodeTest4Fragment on User
        @relay(plural: true) {
          id
        }
      `;
      const renderer = renderFragment({fragment: UserFragment});
      expect(
        renderer
          .toJSON()
          .includes('Remove `@relay(plural: true)` from fragment'),
      ).toEqual(true);
    });

    it('should throw error if fragment is missing @refetchable directive', () => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});

      const UserFragment = graphql`
        fragment useRefetchableFragmentNodeTest5Fragment on User {
          id
        }
      `;
      const renderer = renderFragment({fragment: UserFragment});
      expect(
        renderer
          .toJSON()
          .includes(
            'Did you forget to add a @refetchable directive to the fragment?',
          ),
      ).toEqual(true);
    });

    it('should render fragment without error when data is available', () => {
      renderFragment();
      expectFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', query),
          },
        },
      ]);
    });

    it('should render fragment without error when ref is null', () => {
      renderFragment({userRef: null});
      expectFragmentResults([{data: null}]);
    });

    it('should render fragment without error when ref is undefined', () => {
      renderFragment({userRef: undefined});
      expectFragmentResults([{data: null}]);
    });

    it('should update when fragment data changes', () => {
      renderFragment();
      expectFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', query),
          },
        },
      ]);

      TestRenderer.act(() => {
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '1',
            // Update name
            name: 'Alice in Wonderland',
          },
        });
      });
      expectFragmentResults([
        {
          data: {
            id: '1',
            // Assert that name is updated
            name: 'Alice in Wonderland',
            profile_picture: null,
            ...createFragmentRef('1', query),
          },
        },
      ]);
    });

    it('should throw a promise if data is missing for fragment and request is in flight', () => {
      // This prevents console.error output in the test, which is expected
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});

      const missingDataVariables = {...variables, id: '4'};
      const missingDataQuery = createOperationDescriptor(
        gqlQuery,
        missingDataVariables,
      );
      // Commit a payload with name and profile_picture are missing
      TestRenderer.act(() => {
        environment.commitPayload(missingDataQuery, {
          node: {
            __typename: 'User',
            id: '4',
          },
        });
      });

      fetchQuery(environment, missingDataQuery).subscribe({});

      const renderer = renderFragment({owner: missingDataQuery});
      expect(renderer.toJSON()).toEqual('Fallback');
    });
  });

  describe('refetch', () => {
    let release;
    let isOperationRetained;

    beforeEach(() => {
      ({release_DEPRECATED: release, isOperationRetained} =
        trackRetentionForEnvironment(environment));
    });

    function expectRequestIsInFlight(
      expected: any,
      requestEnvironment: RelayMockEnvironment = environment,
    ) {
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(requestEnvironment.executeWithSource).toBeCalledTimes(
        expected.requestCount,
      );
      expect(
        requestEnvironment.mock.isLoading(
          expected.gqlRefetchQuery ?? gqlRefetchQuery,
          expected.refetchVariables,
          {force: true},
        ),
      ).toEqual(expected.inFlight);
    }

    function expectFragmentIsRefetching(
      renderer: any,
      expected: {
        refetchVariables: Variables,
        refetchQuery?: OperationDescriptor,
        gqlRefetchQuery?: $FlowFixMe,
      },
      env: RelayMockEnvironment = environment,
    ) {
      expect(commitSpy).toBeCalledTimes(0);
      commitSpy.mockClear();

      // Assert refetch query was fetched
      expectRequestIsInFlight(
        {...expected, inFlight: true, requestCount: 1},
        env,
      );

      // Assert component suspended
      expect(commitSpy).toBeCalledTimes(0);
      expect(renderer.toJSON()).toEqual('Fallback');

      // Assert query is retained by loadQuery and
      // temporarily retained while component is suspended
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(env.retain).toBeCalledTimes(2);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(env.retain.mock.calls[0][0]).toEqual(
        expected.refetchQuery ?? refetchQuery,
      );
    }

    it('does not refetch and warns if component has unmounted', () => {
      const warning = require('warning');
      // $FlowFixMe[prop-missing]
      warning.mockClear();
      const renderer = renderFragment();
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      TestRenderer.act(() => {
        renderer.unmount();
      });
      TestRenderer.act(() => {
        refetch({id: '4'});
      });

      expect(warning).toHaveBeenCalledTimes(1);
      expect(
        // $FlowFixMe[prop-missing]
        warning.mock.calls[0][1].includes(
          'Relay: Unexpected call to `refetch` on unmounted component',
        ),
      ).toEqual(true);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.executeWithSource).toHaveBeenCalledTimes(0);
    });

    it('warns if fragment ref passed to useRefetchableFragmentNode() was null', () => {
      const warning = require('warning');
      // $FlowFixMe[prop-missing]
      warning.mockClear();

      renderFragment({userRef: null});
      expectFragmentResults([{data: null}]);

      TestRenderer.act(() => {
        refetch({id: '4'});
      });

      expect(warning).toHaveBeenCalledTimes(1);
      expect(
        // $FlowFixMe[prop-missing]
        warning.mock.calls[0][1].includes(
          'Relay: Unexpected call to `refetch` while using a null fragment ref',
        ),
      ).toEqual(true);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
    });

    it('throws error when error occurs during refetch', () => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});

      const callback = jest.fn<[Error | null], void>();
      const renderer = renderFragment();
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      TestRenderer.act(() => {
        refetch({id: '4'}, {onComplete: callback});
      });

      // Assert that fragment is refetching with the right variables and
      // suspends upon refetch
      const refetchVariables = {
        id: '4',
        scale: 16,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );
      expectFragmentIsRefetching(renderer, {
        refetchQuery,
        refetchVariables,
      });

      // Mock network error
      TestRenderer.act(() => {
        environment.mock.reject(gqlRefetchQuery, new Error('Oops'));
      });
      TestRenderer.act(() => {
        jest.runAllImmediates();
      });

      // Assert error is caught in Error boundary
      expect(renderer.toJSON()).toEqual('Error: Oops');
      expect(callback).toBeCalledTimes(1);
      expect(callback.mock.calls[0][0]).toMatchObject({message: 'Oops'});

      // Assert refetch query wasn't retained
      TestRenderer.act(() => {
        jest.runAllTimers();
      });
      expect(isOperationRetained(refetchQuery)).toBe(false);
    });

    it('refetches new variables correctly when refetching new id', () => {
      const renderer = renderFragment();
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      TestRenderer.act(() => {
        refetch({id: '4'});
      });

      // Assert that fragment is refetching with the right variables and
      // suspends upon refetch
      const refetchVariables = {
        id: '4',
        scale: 16,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );
      expectFragmentIsRefetching(renderer, {
        refetchQuery,
        refetchVariables,
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              username: 'usermark',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchedUser = {
        id: '4',
        name: 'Mark',
        profile_picture: {
          uri: 'scale16',
        },
        ...createFragmentRef('4', refetchQuery),
      };
      expectFragmentResults([{data: refetchedUser}]);

      // Assert refetch query was retained
      expect(isOperationRetained(refetchQuery)).toBe(true);
    });

    it('refetches new variables correctly when refetching same id', () => {
      const renderer = renderFragment();
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      TestRenderer.act(() => {
        refetch({scale: 32});
      });

      // Assert that fragment is refetching with the right variables and
      // suspends upon refetch
      const refetchVariables = {
        id: '1',
        scale: 32,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );
      expectFragmentIsRefetching(renderer, {
        refetchQuery,
        refetchVariables,
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '1',
              name: 'Alice',
              profile_picture: {
                uri: 'scale32',
              },
              username: 'useralice',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchedUser = {
        id: '1',
        name: 'Alice',
        profile_picture: {
          uri: 'scale32',
        },
        ...createFragmentRef('1', refetchQuery),
      };
      expectFragmentResults([{data: refetchedUser}]);
      expect(isOperationRetained(refetchQuery)).toBe(true);
    });

    it('refetches new variables correctly when refetching same id and queued resolver', () => {
      const renderer = renderFragment();
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      // Mock network response upfront using queueOperationResolver
      // With the pending match fix, this will resolve synchronously when
      // refetch() is called, without needing queuePendingOperation
      environment.mock.queueOperationResolver(operation =>
        MockPayloadGenerator.generate(operation, {
          User: () => ({
            id: '1',
            name: 'Alice',
            profile_picture: {
              uri: 'scale32',
            },
            username: 'useralice',
          }),
        }),
      );

      const refetchVariables = {
        id: '1',
        scale: 32,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );

      TestRenderer.act(() => {
        refetch({scale: 32});
      });

      // With the pending match fix, the resolver executes synchronously
      // so the component renders with the refetched data without suspending
      const refetchedUser = {
        id: '1',
        name: 'Alice',
        profile_picture: {
          uri: 'scale32',
        },
        ...createFragmentRef('1', refetchQuery),
      };
      expectFragmentResults([{data: refetchedUser}]);
      expect(isOperationRetained(refetchQuery)).toBe(true);
    });

    it('with correct id from refetchable fragment when using nested fragment', () => {
      // Populate store with data for query using nested fragment
      TestRenderer.act(() => {
        environment.commitPayload(queryNestedFragment, {
          node: {
            __typename: 'Feedback',
            actor: {
              __typename: 'User',
              id: '1',
              name: 'Alice',
              profile_picture: null,
              username: 'useralice',
            },
            id: '<feedbackid>',
          },
        });
      });

      // Get fragment ref for user using nested fragment
      const userRef = (
        environment.lookup(queryNestedFragment.fragment).data as $FlowFixMe
      )?.node?.actor;

      const renderer = renderFragment({owner: queryNestedFragment, userRef});
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', queryNestedFragment),
      };
      expectFragmentResults([{data: initialUser}]);

      TestRenderer.act(() => {
        refetch({scale: 32});
      });

      // Assert that fragment is refetching with the right variables and
      // suspends upon refetch
      const refetchVariables = {
        // The id here should correspond to the user id, and not the
        // feedback id from the query variables (i.e. `<feedbackid>`)
        id: '1',
        scale: 32,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );
      expectFragmentIsRefetching(renderer, {
        refetchQuery,
        refetchVariables,
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '1',
              name: 'Alice',
              profile_picture: {
                uri: 'scale32',
              },
              username: 'useralice',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchedUser = {
        id: '1',
        name: 'Alice',
        profile_picture: {
          uri: 'scale32',
        },
        ...createFragmentRef('1', refetchQuery),
      };
      expectFragmentResults([{data: refetchedUser}]);
      expect(isOperationRetained(refetchQuery)).toBe(true);
    });

    it('refetches new variables correctly when using @arguments', () => {
      const userRef = environment.lookup(queryWithArgs.fragment).data?.node;
      const renderer = renderFragment({
        fragment: gqlFragmentWithArgs,
        userRef,
      });
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', queryWithArgs),
      };
      expectFragmentResults([{data: initialUser}]);

      TestRenderer.act(() => {
        refetch({scaleLocal: 32});
      });

      // Assert that fragment is refetching with the right variables and
      // suspends upon refetch
      const refetchVariables = {
        id: '1',
        scaleLocal: 32,
      };
      refetchQueryWithArgs = createOperationDescriptor(
        gqlRefetchQueryWithArgs,
        refetchVariables,
        {force: true},
      );
      expectFragmentIsRefetching(renderer, {
        gqlRefetchQuery: gqlRefetchQueryWithArgs,
        refetchQuery: refetchQueryWithArgs,
        refetchVariables,
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQueryWithArgs, {
          data: {
            node: {
              __typename: 'User',
              id: '1',
              name: 'Alice',
              profile_picture: {
                uri: 'scale32',
              },
              username: 'useralice',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchedUser = {
        id: '1',
        name: 'Alice',
        profile_picture: {
          uri: 'scale32',
        },
        ...createFragmentRef('1', refetchQueryWithArgs),
      };
      expectFragmentResults([{data: refetchedUser}]);
      expect(isOperationRetained(refetchQueryWithArgs)).toBe(true);
    });

    it('refetches new variables correctly when using @arguments with literal values', () => {
      const userRef = environment.lookup(queryWithLiteralArgs.fragment).data
        ?.node;
      const renderer = renderFragment({
        fragment: gqlFragmentWithArgs,
        userRef,
      });
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', queryWithLiteralArgs),
      };
      expectFragmentResults([{data: initialUser}]);

      TestRenderer.act(() => {
        refetch({id: '4'});
      });

      // Assert that fragment is refetching with the right variables and
      // suspends upon refetch
      const refetchVariables = {
        id: '4',
        scaleLocal: 16,
      };
      refetchQueryWithArgs = createOperationDescriptor(
        gqlRefetchQueryWithArgs,
        refetchVariables,
        {force: true},
      );
      expectFragmentIsRefetching(renderer, {
        gqlRefetchQuery: gqlRefetchQueryWithArgs,
        refetchQuery: refetchQueryWithArgs,
        refetchVariables,
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQueryWithArgs, {
          data: {
            node: {
              __typename: 'User',
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              username: 'usermark',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchedUser = {
        id: '4',
        name: 'Mark',
        profile_picture: {
          uri: 'scale16',
        },
        ...createFragmentRef('4', refetchQueryWithArgs),
      };
      expectFragmentResults([{data: refetchedUser}]);
      expect(isOperationRetained(refetchQueryWithArgs)).toBe(true);
    });

    it('subscribes to changes in refetched data', () => {
      renderFragment();
      commitSpy.mockClear();
      TestRenderer.act(() => {
        refetch({id: '4'});
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              username: 'usermark',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchVariables = {
        id: '4',
        scale: 16,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );
      const refetchedUser = {
        id: '4',
        name: 'Mark',
        profile_picture: {
          uri: 'scale16',
        },
        ...createFragmentRef('4', refetchQuery),
      };
      expectFragmentResults([{data: refetchedUser}]);
      expect(isOperationRetained(refetchQuery)).toBe(true);

      // Update refetched data
      TestRenderer.act(() => {
        environment.commitPayload(refetchQuery, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated',
          },
        });
      });

      // Assert that refetched data is updated
      expectFragmentResults([
        {
          data: {
            id: '4',
            // Name is updated
            name: 'Mark Updated',
            profile_picture: {
              uri: 'scale16',
            },
            ...createFragmentRef('4', refetchQuery),
          },
        },
      ]);
    });

    it('resets to parent data when environment changes', () => {
      renderFragment();
      commitSpy.mockClear();
      TestRenderer.act(() => {
        refetch({id: '4'});
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              username: 'usermark',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchVariables = {
        id: '4',
        scale: 16,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );
      const refetchedUser = {
        id: '4',
        name: 'Mark',
        profile_picture: {
          uri: 'scale16',
        },
        ...createFragmentRef('4', refetchQuery),
      };
      expectFragmentResults([{data: refetchedUser}]);
      expect(isOperationRetained(refetchQuery)).toBe(true);

      // Set new environment
      const newEnvironment = createMockEnvironment();
      newEnvironment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Alice in a different env',
          profile_picture: null,
          username: 'useralice',
        },
      });
      TestRenderer.act(() => {
        setEnvironment(newEnvironment);
      });

      // Assert that parent data is rendered
      const expectedUser = {
        id: '1',
        name: 'Alice in a different env',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: expectedUser}]);

      // FIXME I think this should be false and the test was missing a bug here.
      expect(isOperationRetained(refetchQuery)).toBe(true);

      // Update data in new environment
      TestRenderer.act(() => {
        newEnvironment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '1',
            name: 'Alice Updated',
          },
        });
      });

      // Assert that data in new environment is updated
      expectFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice Updated',
            profile_picture: null,
            ...createFragmentRef('1', query),
          },
        },
      ]);
    });

    it('refetches with new environment when environment changes', () => {
      const renderer = renderFragment();
      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      // Set new environment
      const newEnvironment = createMockEnvironment();
      newEnvironment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Alice in a different env',
          profile_picture: null,
          username: 'useralice',
        },
      });
      TestRenderer.act(() => {
        setEnvironment(newEnvironment);
      });

      TestRenderer.act(() => {
        refetch({}, {fetchPolicy: 'network-only'});
      });
      commitSpy.mockClear();

      // Assert fragment is refetched with new environment
      expectFragmentIsRefetching(
        renderer,
        {
          refetchQuery,
          refetchVariables: variables,
        },
        newEnvironment,
      );

      // Mock network response
      TestRenderer.act(() => {
        newEnvironment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '1',
              name: 'Alice in a different env refetched',
              profile_picture: null,
              username: 'useralice',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchedUser = {
        id: '1',
        name: 'Alice in a different env refetched',
        profile_picture: null,
        ...createFragmentRef('1', refetchQuery),
      };
      expectFragmentResults([{data: refetchedUser}]);
    });

    it('resets to parent data when parent fragment ref changes', () => {
      renderFragment();
      commitSpy.mockClear();
      TestRenderer.act(() => {
        refetch({id: '4'});
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              username: 'usermark',
            },
          },
        });
      });

      // Assert fragment is rendered with new data
      const refetchVariables = {
        id: '4',
        scale: 16,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );
      const refetchedUser = {
        id: '4',
        name: 'Mark',
        profile_picture: {
          uri: 'scale16',
        },
        ...createFragmentRef('4', refetchQuery),
      };
      expectFragmentResults([{data: refetchedUser}]);

      expect(isOperationRetained(refetchQuery)).toBe(true);

      // Pass new parent fragment ref with different variables
      const newVariables = {...variables, scale: 32};
      const newQuery = createOperationDescriptor(gqlQuery, newVariables);
      environment.commitPayload(newQuery, {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Alice',
          profile_picture: {
            uri: 'uri32',
          },
          username: 'useralice',
        },
      });
      TestRenderer.act(() => {
        setOwner(newQuery);
      });

      // Assert that parent data is rendered
      const expectedUser = {
        id: '1',
        name: 'Alice',
        profile_picture: {
          uri: 'uri32',
        },
        ...createFragmentRef('1', newQuery),
      };
      expectFragmentResults([{data: expectedUser}]);

      // FIXME I think this should be false and the test was not revealing a bug here
      expect(isOperationRetained(refetchQuery)).toBe(true);

      // Update new parent data
      TestRenderer.act(() => {
        environment.commitPayload(newQuery, {
          node: {
            __typename: 'User',
            id: '1',
            name: 'Alice Updated',
          },
        });
      });

      // Assert that new data from parent is updated
      expectFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice Updated',
            profile_picture: {
              uri: 'uri32',
            },
            ...createFragmentRef('1', newQuery),
          },
        },
      ]);
    });

    it('warns if data returned has different __typename', () => {
      const warning = require('warning');
      // $FlowFixMe[prop-missing]
      warning.mockClear();

      const renderer = renderFragment();

      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      const refetchVariables = {
        id: '1',
        scale: 32,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );

      commitSpy.mockClear();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.executeWithSource.mockClear();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.retain.mockClear();
      release.mockClear();

      TestRenderer.act(() => {
        refetch({scale: 32}, {fetchPolicy: 'network-only'});
      });

      expectFragmentIsRefetching(renderer, {
        refetchQuery,
        refetchVariables,
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'MessagingParticipant',
              id: '1',
              name: 'Alice',
              profile_picture: {
                uri: 'scale32',
              },
              username: 'useralice',
            },
          },
        });
      });

      TestRenderer.act(() => {
        jest.runAllImmediates();
      });

      // $FlowFixMe[prop-missing]
      const warningCalls = warning.mock.calls.filter(call => call[0] === false);
      expect(
        warningCalls.some(([_condition, format, ..._args]) =>
          format.includes(
            'Relay: Call to `refetch` returned data with a different __typename:',
          ),
        ),
      ).toBe(true);
    });

    it('does not error if returned node is null', () => {
      const warning = require('warning');
      // $FlowFixMe[prop-missing]
      warning.mockClear();

      const renderer = renderFragment();

      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      const refetchVariables = {
        id: '1',
        scale: 32,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );

      commitSpy.mockClear();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.executeWithSource.mockClear();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.retain.mockClear();
      release.mockClear();

      TestRenderer.act(() => {
        refetch({scale: 32}, {fetchPolicy: 'network-only'});
      });

      expectFragmentIsRefetching(renderer, {
        refetchQuery,
        refetchVariables,
      });

      // Mock network response
      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: null, // Demonstrate data that is nolonger avaliable on the server
          },
        });
      });

      TestRenderer.act(() => {
        jest.runAllImmediates();
      });

      expect(renderer.toJSON()).toEqual(null);
    });

    it('warns if a different id is returned', () => {
      const warning = require('warning');
      // $FlowFixMe[prop-missing]
      warning.mockClear();
      const renderer = renderFragment();

      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      const refetchVariables = {
        id: '1',
        scale: 32,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );

      commitSpy.mockClear();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.executeWithSource.mockClear();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.retain.mockClear();
      release.mockClear();

      TestRenderer.act(() => {
        refetch({scale: 32}, {fetchPolicy: 'network-only'});
      });

      expectFragmentIsRefetching(renderer, {
        refetchQuery,
        refetchVariables,
      });

      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '2',
              name: 'Mark',
              profile_picture: {
                uri: 'scale32',
              },
              username: 'usermark',
            },
          },
        });
      });

      TestRenderer.act(() => {
        jest.runAllImmediates();
      });

      // $FlowFixMe[prop-missing]
      const warningCalls = warning.mock.calls.filter(call => call[0] === false);
      expect(warningCalls.length).toEqual(2);
      expect(
        warningCalls[0][1].includes(
          'Relay: Call to `refetch` returned a different id, expected',
        ),
      ).toEqual(true);
    });

    it("doesn't warn if refetching on a different id than the current one in display", () => {
      const warning = require('warning');
      // $FlowFixMe[prop-missing]
      warning.mockClear();

      renderFragment();

      const initialUser = {
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', query),
      };
      expectFragmentResults([{data: initialUser}]);

      const refetchVariables = {
        id: '1',
        scale: 32,
      };
      refetchQuery = createOperationDescriptor(
        gqlRefetchQuery,
        refetchVariables,
        {force: true},
      );

      commitSpy.mockClear();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.executeWithSource.mockClear();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      environment.retain.mockClear();
      release.mockClear();

      TestRenderer.act(() => {
        refetch({id: '2', scale: 32}, {fetchPolicy: 'network-only'});
        jest.runAllImmediates();
      });

      TestRenderer.act(() => {
        refetch({id: '3', scale: 32}, {fetchPolicy: 'network-only'});
      });

      TestRenderer.act(() => {
        environment.mock.resolve(gqlRefetchQuery, {
          data: {
            node: {
              __typename: 'User',
              id: '3',
              name: 'Mark',
              profile_picture: {
                uri: 'scale32',
              },
              username: 'usermark',
            },
          },
        });
      });

      TestRenderer.act(() => {
        jest.runAllTimers();
      });

      expect(
        // $FlowFixMe[prop-missing]
        warning.mock.calls.filter(call => call[0] === false).length,
      ).toEqual(0);
    });

    describe('multiple refetches', () => {
      const internalRuntime = require('relay-runtime').__internal;
      const originalFetchQueryDeduped = internalRuntime.fetchQueryDeduped;
      const fetchSpy = jest.fn<Array<any>, unknown>();
      jest
        .spyOn(internalRuntime, 'fetchQueryDeduped')
        .mockImplementation((...args) => {
          const originalObservable = originalFetchQueryDeduped(...args);
          return {
            ...originalObservable,
            subscribe: (...subscribeArgs) => {
              fetchSpy(...args);
              return originalObservable.subscribe(...subscribeArgs);
            },
          };
        });

      beforeEach(() => {
        fetchSpy.mockClear();
      });

      it('refetches correctly when refetching multiple times in a row', () => {
        const renderer = renderFragment();
        const initialUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef('1', query),
        };
        expectFragmentResults([{data: initialUser}]);

        const refetchVariables = {
          id: '1',
          scale: 32,
        };
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        const refetchedUser = {
          id: '1',
          name: 'Alice',
          profile_picture: {
            uri: 'scale32',
          },
          ...createFragmentRef('1', refetchQuery),
        };

        const doAndAssertRefetch = (fragmentResults: Array<{data: any}>) => {
          commitSpy.mockClear();
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          environment.executeWithSource.mockClear();
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          environment.retain.mockClear();

          TestRenderer.act(() => {
            // We use fetchPolicy network-only to ensure the call to refetch
            // always suspends
            refetch({scale: 32}, {fetchPolicy: 'network-only'});
          });

          // Assert that fragment is refetching with the right variables and
          // suspends upon refetch
          expectFragmentIsRefetching(renderer, {
            refetchQuery,
            refetchVariables,
          });

          // Mock network response
          TestRenderer.act(() => {
            environment.mock.resolve(gqlRefetchQuery, {
              data: {
                node: {
                  __typename: 'User',
                  id: '1',
                  name: 'Alice',
                  profile_picture: {
                    uri: 'scale32',
                  },
                  username: 'useralice',
                },
              },
            });
          });

          // Assert fragment is rendered with new data
          expectFragmentResults(fragmentResults);

          // Assert refetch query was retained
          expect(isOperationRetained(refetchQuery)).toBe(true);
        };

        // Refetch once
        doAndAssertRefetch([{data: refetchedUser}]);

        // Refetch twice
        doAndAssertRefetch([{data: refetchedUser}]);
      });

      it('refetches correctly when a second refetch starts while the first is one suspended', () => {
        const renderer = renderFragment();
        commitSpy.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {
              UNSTABLE_renderPolicy: renderPolicy,
              fetchPolicy: 'network-only',
            },
          );
        });

        // Assert request is started
        const refetchVariables1 = {id: '1', scale: 16};
        const refetchQuery1 = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables1,
          {force: true},
        );

        // Assert we suspend on intial refetch request
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery1,
          refetchVariables: refetchVariables1,
        });

        // Call refetch a second time
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.executeWithSource.mockClear();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.retain.mockClear();
        const refetchVariables2 = {id: '4', scale: 16};
        const refetchQuery2 = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables2,
          {force: true},
        );
        TestRenderer.act(() => {
          refetch(
            {id: '4'},
            {
              UNSTABLE_renderPolicy: renderPolicy,
              fetchPolicy: 'network-only',
            },
          );
        });

        // Assert we suspend on the second refetch request
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery2,
          refetchVariables: refetchVariables2,
        });

        // Mock response for initial refetch request
        TestRenderer.act(() => {
          environment.mock.resolve(refetchQuery1, {
            data: {
              node: {
                __typename: 'User',
                id: '1',
                name: 'User 1',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'user1',
              },
            },
          });
        });

        // Assert that we are still suspended the second refetch request
        // since that one hasn't resolved and that's the latest one we want
        // to render
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery2,
          refetchVariables: refetchVariables2,
        });

        // Mock response for second refetch request
        TestRenderer.act(() => {
          environment.mock.resolve(refetchQuery2, {
            data: {
              node: {
                __typename: 'User',
                id: '4',
                name: 'Mark',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'usermark',
              },
            },
          });
        });

        // Assert component is rendered with data from second request
        const refetchedUser = {
          id: '4',
          name: 'Mark',
          profile_picture: {uri: 'scale16'},
          ...createFragmentRef('4', refetchQuery2),
        };
        expectFragmentResults([{data: refetchedUser}]);

        expect(fetchSpy).toBeCalledTimes(4);
      });

      it('does not re-issue initial refetch request if second refetch is interrupted by high-pri update', () => {
        const renderer = renderFragment();
        commitSpy.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {
              UNSTABLE_renderPolicy: renderPolicy,
              fetchPolicy: 'network-only',
            },
          );
        });

        // Assert request is started
        const refetchVariables1 = {id: '1', scale: 16};
        const refetchQuery1 = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables1,
          {force: true},
        );

        // Assert we suspend on intial refetch request
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery1,
          refetchVariables: refetchVariables1,
        });

        // Call refetch a second time
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.executeWithSource.mockClear();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.retain.mockClear();
        const refetchVariables2 = {id: '4', scale: 16};
        const refetchQuery2 = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables2,
          {force: true},
        );
        TestRenderer.act(() => {
          refetch(
            {id: '4'},
            {
              UNSTABLE_renderPolicy: renderPolicy,
              fetchPolicy: 'network-only',
            },
          );
        });

        // Assert we suspend on the second refetch request
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery2,
          refetchVariables: refetchVariables2,
        });

        // Schedule a high-pri update while the component is
        // suspended on pagination
        TestRenderer.act(() => {
          Scheduler.unstable_runWithPriority(
            Scheduler.unstable_UserBlockingPriority,
            () => {
              forceUpdate(prev => prev + 1);
            },
          );
        });

        // Assert that we are still suspended the second refetch request
        // since that one hasn't resolved and that's the latest one we want
        // to render
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery2,
          refetchVariables: refetchVariables2,
        });

        // Mock response for initial refetch request
        TestRenderer.act(() => {
          environment.mock.resolve(refetchQuery1, {
            data: {
              node: {
                __typename: 'User',
                id: '1',
                name: 'User 1',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'user1',
              },
            },
          });
        });

        // Assert that we are still suspended the second refetch request
        // since that one hasn't resolved and that's the latest one we want
        // to render
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery2,
          refetchVariables: refetchVariables2,
        });

        // Mock response for second refetch request
        TestRenderer.act(() => {
          environment.mock.resolve(refetchQuery2, {
            data: {
              node: {
                __typename: 'User',
                id: '4',
                name: 'Mark',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'usermark',
              },
            },
          });
        });

        // Assert component is rendered with data from second request
        const refetchedUser = {
          id: '4',
          name: 'Mark',
          profile_picture: {uri: 'scale16'},
          ...createFragmentRef('4', refetchQuery2),
        };
        expectFragmentResults([{data: refetchedUser}]);

        expect(fetchSpy).toBeCalledTimes(4);
      });

      it('refetches correctly when switching between multiple refetches', () => {
        const renderer = renderFragment();
        commitSpy.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {
              UNSTABLE_renderPolicy: renderPolicy,
              fetchPolicy: 'network-only',
            },
          );
        });

        // Assert request is started
        const refetchVariables1 = {id: '1', scale: 16};
        const refetchQuery1 = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables1,
          {force: true},
        );

        // Assert we suspend on initial refetch request
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery1,
          refetchVariables: refetchVariables1,
        });

        // Call refetch a second time
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.executeWithSource.mockClear();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.retain.mockClear();
        const refetchVariables2 = {id: '4', scale: 16};
        const refetchQuery2 = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables2,
          {force: true},
        );
        TestRenderer.act(() => {
          refetch(
            {id: '4'},
            {
              UNSTABLE_renderPolicy: renderPolicy,
              fetchPolicy: 'network-only',
            },
          );
        });

        // Assert we suspend on the second refetch request
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery2,
          refetchVariables: refetchVariables2,
        });

        // Switch back to initial refetch
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.retain.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {
              UNSTABLE_renderPolicy: renderPolicy,
              fetchPolicy: 'network-only',
            },
          );
        });

        // Mock response for second refetch request
        TestRenderer.act(() => {
          environment.mock.resolve(refetchQuery2, {
            data: {
              node: {
                __typename: 'User',
                id: '4',
                name: 'Mark',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'usermark',
              },
            },
          });
        });

        // Assert that we are still suspended the initial refetch request
        // since that one hasn't resolved and that's the latest one we want
        // to render
        expectFragmentIsRefetching(renderer, {
          refetchQuery: refetchQuery1,
          refetchVariables: refetchVariables1,
        });

        // Mock response for initial refetch request
        TestRenderer.act(() => {
          environment.mock.resolve(refetchQuery1, {
            data: {
              node: {
                __typename: 'User',
                id: '1',
                name: 'User 1',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'user1',
              },
            },
          });
        });

        // Assert component is rendered with data from second request
        const refetchedUser = {
          id: '1',
          name: 'User 1',
          profile_picture: {uri: 'scale16'},
          ...createFragmentRef('1', refetchQuery1),
        };
        expectFragmentResults([{data: refetchedUser}]);

        expect(fetchSpy).toBeCalledTimes(5);
      });

      it('does not dispose ongoing request if refetch is called again', () => {
        const renderer = renderFragment();
        commitSpy.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {
              UNSTABLE_renderPolicy: renderPolicy,
              fetchPolicy: 'store-and-network',
            },
          );
        });

        // Assert request is started
        const refetchVariables1 = {id: '1', scale: 16};
        const refetchQuery1 = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables1,
          {force: true},
        );
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables: refetchVariables1,
          requestCount: 1,
        });

        // Component renders immediately even though request is in flight
        // since data is cached
        const refetchingUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef('1', refetchQuery1),
        };
        expectFragmentResults([{data: refetchingUser}]);

        // Call refetch a second time
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.executeWithSource.mockClear();
        const refetchVariables2 = {id: '4', scale: 16};
        TestRenderer.act(() => {
          refetch(
            {id: '4'},
            {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
          );
        });

        // Assert first request is not cancelled
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables: refetchVariables1,
          requestCount: 1,
        });

        // Assert second request is started
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables: refetchVariables2,
          requestCount: 1,
        });
        // Assert component suspended
        expect(commitSpy).toBeCalledTimes(0);
        expect(renderer.toJSON()).toEqual('Fallback');

        expect(fetchSpy).toBeCalledTimes(4);
      });

      it('preserves referential equality after refetch if data & variables have not changed', async () => {
        let refetchCount = 0;
        const ComponentWithUseEffectRefetch = (props: {
          fragmentKey: any,
        }): null => {
          const {fragmentData, refetch} = useRefetchableFragmentNode(
            graphql`
              fragment useRefetchableFragmentNodeTestIdentityTestFragment on User
              @refetchable(
                queryName: "useRefetchableFragmentNodeTestIdentityTestFragmentRefetchQuery"
              ) {
                id
                name
                profile_picture(scale: $scale) {
                  uri
                }
              }
            `,
            props.fragmentKey,
          );
          if (refetchCount > 2) {
            throw new Error('Detected refetch loop.');
          }
          useEffect(() => {
            refetchCount++;
            // $FlowFixMe[incompatible-use] useRefetchableFragmentNode is untyped
            refetch({id: fragmentData.id});
          }, [fragmentData, refetch]);

          return null;
        };
        const variables = {id: '1', scale: 16};
        const query = createOperationDescriptor(gqlRefetchQuery, variables, {});
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '1',
            name: 'Alice',
            profile_picture: null,
          },
        });
        let renderer;
        TestRenderer.act(() => {
          renderer = TestRenderer.create(
            <ErrorBoundary fallback={({error}) => `Error: ${error.message}`}>
              <React.Suspense fallback={'Loading'}>
                <RelayEnvironmentProvider environment={environment}>
                  <ComponentWithUseEffectRefetch
                    fragmentKey={createFragmentRef(
                      '1',
                      query,
                      'useRefetchableFragmentNodeTestIdentityTestFragment',
                    )}
                  />
                </RelayEnvironmentProvider>
              </React.Suspense>
            </ErrorBoundary>,
            // $FlowFixMe[incompatible-type] - error revealed when flow-typing ReactTestRenderer
            {unstable_isConcurrent: true},
          );
          jest.runAllImmediates();
        });
        expect(refetchCount).toBe(2);
        expect(renderer?.toJSON()).toBe(null);
      });
    });

    describe('fetchPolicy', () => {
      describe('store-or-network', () => {
        beforeEach(() => {
          fetchPolicy = 'store-or-network';
        });

        describe('renderPolicy: partial', () => {
          beforeEach(() => {
            renderPolicy = 'partial';
          });
          it("doesn't start network request if refetch query is fully cached", () => {
            renderFragment();
            commitSpy.mockClear();
            TestRenderer.act(() => {
              refetch(
                {id: '1'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert request is not started
            const refetchVariables = {...variables};
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            expectRequestIsInFlight({
              gqlRefetchQuery,
              inFlight: false,
              refetchVariables,
              requestCount: 0,
            });

            // Assert component renders immediately since data is cached
            const refetchingUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', refetchQuery),
            };
            expectFragmentResults([{data: refetchingUser}]);
          });

          it('starts network request if refetch query is not fully cached and suspends if fragment has missing data', () => {
            const renderer = renderFragment();
            const initialUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', query),
            };
            expectFragmentResults([{data: initialUser}]);

            TestRenderer.act(() => {
              refetch(
                {id: '4'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert that fragment is refetching with the right variables and
            // suspends upon refetch
            const refetchVariables = {
              id: '4',
              scale: 16,
            };
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            expectFragmentIsRefetching(renderer, {
              refetchQuery,
              refetchVariables,
            });

            // Mock network response
            TestRenderer.act(() => {
              environment.mock.resolve(gqlRefetchQuery, {
                data: {
                  node: {
                    __typename: 'User',
                    id: '4',
                    name: 'Mark',
                    profile_picture: {
                      uri: 'scale16',
                    },
                    username: 'usermark',
                  },
                },
              });
            });

            // Assert fragment is rendered with new data
            const refetchedUser = {
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              ...createFragmentRef('4', refetchQuery),
            };
            expectFragmentResults([{data: refetchedUser}]);
          });

          it("starts network request if refetch query is not fully cached and doesn't suspend if fragment doesn't have missing data", () => {
            // Cache user with missing username
            const refetchVariables = {id: '4', scale: 16};
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            environment.commitPayload(refetchQuery, {
              node: {
                __typename: 'User',
                id: '4',
                name: 'Mark',
                profile_picture: null,
              },
            });

            renderFragment();
            commitSpy.mockClear();
            TestRenderer.act(() => {
              refetch(
                {id: '4'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert request is started
            expectRequestIsInFlight({
              gqlRefetchQuery,
              inFlight: true,
              refetchVariables,
              requestCount: 1,
            });

            // Assert component renders immediately since data is cached
            const refetchingUser = {
              id: '4',
              name: 'Mark',
              profile_picture: null,
              ...createFragmentRef('4', refetchQuery),
            };
            expectFragmentResults([{data: refetchingUser}]);
          });
        });

        describe('renderPolicy: full', () => {
          beforeEach(() => {
            renderPolicy = 'full';
          });
          it("doesn't start network request if refetch query is fully cached", () => {
            renderFragment();
            commitSpy.mockClear();
            TestRenderer.act(() => {
              refetch(
                {id: '1'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert request is not started
            const refetchVariables = {...variables};
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            expectRequestIsInFlight({
              gqlRefetchQuery,
              inFlight: false,
              refetchVariables,
              requestCount: 0,
            });

            // Assert component renders immediately since data is cached
            const refetchingUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', refetchQuery),
            };
            expectFragmentResults([{data: refetchingUser}]);
          });

          it('starts network request if refetch query is not fully cached and suspends if fragment has missing data', () => {
            const renderer = renderFragment();
            const initialUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', query),
            };
            expectFragmentResults([{data: initialUser}]);

            TestRenderer.act(() => {
              refetch(
                {id: '4'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert that fragment is refetching with the right variables and
            // suspends upon refetch
            const refetchVariables = {
              id: '4',
              scale: 16,
            };
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            expectFragmentIsRefetching(renderer, {
              refetchQuery,
              refetchVariables,
            });

            // Mock network response
            TestRenderer.act(() => {
              environment.mock.resolve(gqlRefetchQuery, {
                data: {
                  node: {
                    __typename: 'User',
                    id: '4',
                    name: 'Mark',
                    profile_picture: {
                      uri: 'scale16',
                    },
                    username: 'usermark',
                  },
                },
              });
            });

            // Assert fragment is rendered with new data
            const refetchedUser = {
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              ...createFragmentRef('4', refetchQuery),
            };
            expectFragmentResults([{data: refetchedUser}]);
          });

          it("starts network request if refetch query is not fully cached and suspends even if fragment doesn't have missing data", () => {
            // Cache user with missing username
            const refetchVariables = {id: '4', scale: 16};
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            environment.commitPayload(refetchQuery, {
              node: {
                __typename: 'User',
                id: '4',
                name: 'Mark',
                profile_picture: null,
              },
            });

            const renderer = renderFragment();
            const initialUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', query),
            };
            expectFragmentResults([{data: initialUser}]);

            TestRenderer.act(() => {
              refetch(
                {id: '4'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            expectFragmentIsRefetching(renderer, {
              refetchQuery,
              refetchVariables,
            });

            // Mock network response
            TestRenderer.act(() => {
              environment.mock.resolve(gqlRefetchQuery, {
                data: {
                  node: {
                    __typename: 'User',
                    id: '4',
                    name: 'Mark',
                    profile_picture: {
                      uri: 'scale16',
                    },
                    username: 'usermark',
                  },
                },
              });
            });

            // Assert fragment is rendered with new data
            const refetchedUser = {
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              ...createFragmentRef('4', refetchQuery),
            };
            expectFragmentResults([{data: refetchedUser}]);
          });
        });
      });

      describe('store-and-network', () => {
        beforeEach(() => {
          fetchPolicy = 'store-and-network';
        });

        describe('renderPolicy: partial', () => {
          beforeEach(() => {
            renderPolicy = 'partial';
          });

          it('starts network request if refetch query is fully cached', () => {
            renderFragment();
            commitSpy.mockClear();
            TestRenderer.act(() => {
              refetch(
                {id: '1'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert request is not started
            const refetchVariables = {...variables};
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            expectRequestIsInFlight({
              gqlRefetchQuery,
              inFlight: true,
              refetchVariables,
              requestCount: 1,
            });

            // Assert component renders immediately since data is cached
            const refetchingUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', refetchQuery),
            };
            expectFragmentResults([{data: refetchingUser}]);
          });

          it('starts network request if refetch query is not fully cached and suspends if fragment has missing data', () => {
            const renderer = renderFragment();
            const initialUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', query),
            };
            expectFragmentResults([{data: initialUser}]);

            TestRenderer.act(() => {
              refetch(
                {id: '4'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert that fragment is refetching with the right variables and
            // suspends upon refetch
            const refetchVariables = {
              id: '4',
              scale: 16,
            };
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            expectFragmentIsRefetching(renderer, {
              refetchQuery,
              refetchVariables,
            });

            // Mock network response
            TestRenderer.act(() => {
              environment.mock.resolve(gqlRefetchQuery, {
                data: {
                  node: {
                    __typename: 'User',
                    id: '4',
                    name: 'Mark',
                    profile_picture: {
                      uri: 'scale16',
                    },
                    username: 'usermark',
                  },
                },
              });
            });

            // Assert fragment is rendered with new data
            const refetchedUser = {
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              ...createFragmentRef('4', refetchQuery),
            };
            expectFragmentResults([{data: refetchedUser}]);
          });

          it("starts network request if refetch query is not fully cached and doesn't suspend if fragment doesn't have missing data", () => {
            // Cache user with missing username
            const refetchVariables = {id: '4', scale: 16};
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            environment.commitPayload(refetchQuery, {
              node: {
                __typename: 'User',
                id: '4',
                name: 'Mark',
                profile_picture: null,
              },
            });

            renderFragment();
            commitSpy.mockClear();
            TestRenderer.act(() => {
              refetch(
                {id: '4'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert request is started
            expectRequestIsInFlight({
              gqlRefetchQuery,
              inFlight: true,
              refetchVariables,
              requestCount: 1,
            });

            // Assert component renders immediately since data is cached
            const refetchingUser = {
              id: '4',
              name: 'Mark',
              profile_picture: null,
              ...createFragmentRef('4', refetchQuery),
            };
            expectFragmentResults([{data: refetchingUser}]);
          });
        });

        describe('renderPolicy: full', () => {
          beforeEach(() => {
            renderPolicy = 'full';
          });

          it('starts network request if refetch query is fully cached', () => {
            renderFragment();
            commitSpy.mockClear();
            TestRenderer.act(() => {
              refetch(
                {id: '1'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert request is not started
            const refetchVariables = {...variables};
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            expectRequestIsInFlight({
              gqlRefetchQuery,
              inFlight: true,
              refetchVariables,
              requestCount: 1,
            });

            // Assert component renders immediately since data is cached
            const refetchingUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', refetchQuery),
            };
            expectFragmentResults([{data: refetchingUser}]);
          });

          it('starts network request if refetch query is not fully cached and suspends if fragment has missing data', () => {
            const renderer = renderFragment();
            const initialUser = {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', query),
            };
            expectFragmentResults([{data: initialUser}]);

            TestRenderer.act(() => {
              refetch(
                {id: '4'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert that fragment is refetching with the right variables and
            // suspends upon refetch
            const refetchVariables = {
              id: '4',
              scale: 16,
            };
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            expectFragmentIsRefetching(renderer, {
              refetchQuery,
              refetchVariables,
            });

            // Mock network response
            TestRenderer.act(() => {
              environment.mock.resolve(gqlRefetchQuery, {
                data: {
                  node: {
                    __typename: 'User',
                    id: '4',
                    name: 'Mark',
                    profile_picture: {
                      uri: 'scale16',
                    },
                    username: 'usermark',
                  },
                },
              });
            });

            // Assert fragment is rendered with new data
            const refetchedUser = {
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              ...createFragmentRef('4', refetchQuery),
            };
            expectFragmentResults([{data: refetchedUser}]);
          });

          it("starts network request if refetch query is not fully cached and doesn't suspend if fragment doesn't have missing data", () => {
            // Cache user with missing username
            const refetchVariables = {id: '4', scale: 16};
            refetchQuery = createOperationDescriptor(
              gqlRefetchQuery,
              refetchVariables,
              {force: true},
            );
            environment.commitPayload(refetchQuery, {
              node: {
                __typename: 'User',
                id: '4',
                name: 'Mark',
                profile_picture: null,
              },
            });

            const renderer = renderFragment();
            commitSpy.mockClear();
            TestRenderer.act(() => {
              refetch(
                {id: '4'},
                {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
              );
            });

            // Assert component suspended
            expectFragmentIsRefetching(renderer, {
              refetchQuery,
              refetchVariables,
            });

            // Mock network response
            TestRenderer.act(() => {
              environment.mock.resolve(gqlRefetchQuery, {
                data: {
                  node: {
                    __typename: 'User',
                    id: '4',
                    name: 'Mark',
                    profile_picture: {
                      uri: 'scale16',
                    },
                    username: 'usermark',
                  },
                },
              });
            });

            // Assert fragment is rendered with new data
            const refetchedUser = {
              id: '4',
              name: 'Mark',
              profile_picture: {
                uri: 'scale16',
              },
              ...createFragmentRef('4', refetchQuery),
            };
            expectFragmentResults([{data: refetchedUser}]);
          });
        });
      });

      describe('network-only', () => {
        beforeEach(() => {
          fetchPolicy = 'network-only';
        });

        it('starts network request and suspends if refetch query is fully cached', () => {
          const renderer = renderFragment();
          const initialUser = {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', query),
          };
          expectFragmentResults([{data: initialUser}]);

          TestRenderer.act(() => {
            refetch(
              {id: '1'},
              {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
            );
          });

          // Assert that fragment is refetching with the right variables and
          // suspends upon refetch
          const refetchVariables = {
            ...variables,
          };
          refetchQuery = createOperationDescriptor(
            gqlRefetchQuery,
            refetchVariables,
            {force: true},
          );
          expectFragmentIsRefetching(renderer, {
            refetchQuery,
            refetchVariables,
          });

          // Mock network response
          TestRenderer.act(() => {
            environment.mock.resolve(gqlRefetchQuery, {
              data: {
                node: {
                  __typename: 'User',
                  id: '1',
                  name: 'Alice',
                  profile_picture: null,
                  username: 'useralice',
                },
              },
            });
          });

          // Assert fragment is rendered with new data
          const refetchedUser = {
            ...initialUser,
            ...createFragmentRef('1', refetchQuery),
          };
          expectFragmentResults([{data: refetchedUser}]);
        });

        it('starts network request and suspends if refetch query is not fully cached', () => {
          const renderer = renderFragment();
          const initialUser = {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', query),
          };
          expectFragmentResults([{data: initialUser}]);

          TestRenderer.act(() => {
            refetch(
              {id: '4'},
              {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
            );
          });

          // Assert that fragment is refetching with the right variables and
          // suspends upon refetch
          const refetchVariables = {
            id: '4',
            scale: 16,
          };
          refetchQuery = createOperationDescriptor(
            gqlRefetchQuery,
            refetchVariables,
            {force: true},
          );
          expectFragmentIsRefetching(renderer, {
            refetchQuery,
            refetchVariables,
          });

          // Mock network response
          TestRenderer.act(() => {
            environment.mock.resolve(gqlRefetchQuery, {
              data: {
                node: {
                  __typename: 'User',
                  id: '4',
                  name: 'Mark',
                  profile_picture: {
                    uri: 'scale16',
                  },
                  username: 'usermark',
                },
              },
            });
          });

          // Assert fragment is rendered with new data
          const refetchedUser = {
            id: '4',
            name: 'Mark',
            profile_picture: {
              uri: 'scale16',
            },
            ...createFragmentRef('4', refetchQuery),
          };
          expectFragmentResults([{data: refetchedUser}]);
        });
      });

      describe('store-only', () => {
        beforeEach(() => {
          fetchPolicy = 'store-only';
        });

        it("doesn't start network request if refetch query is fully cached", () => {
          renderFragment();
          commitSpy.mockClear();
          TestRenderer.act(() => {
            refetch(
              {id: '1'},
              {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
            );
          });

          // Assert request is not started
          const refetchVariables = {...variables};
          refetchQuery = createOperationDescriptor(
            gqlRefetchQuery,
            refetchVariables,
            {force: true},
          );
          expectRequestIsInFlight({
            gqlRefetchQuery,
            inFlight: false,
            refetchVariables,
            requestCount: 0,
          });

          // Assert component renders immediately since data is cached
          const refetchingUser = {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', refetchQuery),
          };
          expectFragmentResults([{data: refetchingUser}]);
        });

        it("doesn't start network request if refetch query is not fully cached", () => {
          renderFragment();
          commitSpy.mockClear();
          TestRenderer.act(() => {
            refetch(
              {id: '4'},
              {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
            );
          });

          // Assert request is not started
          const refetchVariables = {id: '4', scale: 16};
          refetchQuery = createOperationDescriptor(
            gqlRefetchQuery,
            refetchVariables,
            {force: true},
          );
          expectRequestIsInFlight({
            gqlRefetchQuery,
            inFlight: false,
            refetchVariables,
            requestCount: 0,
          });

          // Assert component renders immediately with empty data
          expectFragmentResults([{data: null}]);
        });

        it("doesn't use data from previous network fetch and releases previous query", () => {
          const renderer = renderFragment();
          commitSpy.mockClear();
          TestRenderer.act(() => {
            refetch(
              {id: '4'},
              {
                UNSTABLE_renderPolicy: renderPolicy,
                fetchPolicy: 'network-only',
              },
            );
          });

          // Assert initial request is started
          let refetchVariables = {id: '4', scale: 16};
          refetchQuery = createOperationDescriptor(
            gqlRefetchQuery,
            refetchVariables,
            {force: true},
          );
          expectFragmentIsRefetching(renderer, {
            refetchQuery,
            refetchVariables,
          });
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          environment.executeWithSource.mockClear();

          // Mock network response
          TestRenderer.act(() => {
            environment.mock.resolve(gqlRefetchQuery, {
              data: {
                node: {
                  __typename: 'User',
                  id: '4',
                  name: 'Mark',
                  profile_picture: {
                    uri: 'scale16',
                  },
                  username: 'usermark',
                },
              },
            });
          });

          // Assert fragment is rendered with new data
          const refetchedUser = {
            id: '4',
            name: 'Mark',
            profile_picture: {
              uri: 'scale16',
            },
            ...createFragmentRef('4', refetchQuery),
          };
          expectFragmentResults([{data: refetchedUser}]);
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          environment.retain.mockClear();
          release.mockClear();

          // Call refetch again with store-only policy
          commitSpy.mockClear();
          TestRenderer.act(() => {
            refetch(
              {id: '6'},
              {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
            );
          });

          // Assert request is not started
          refetchVariables = {id: '6', scale: 16};
          refetchQuery = createOperationDescriptor(
            gqlRefetchQuery,
            refetchVariables,
            {force: true},
          );
          expectRequestIsInFlight({
            gqlRefetchQuery,
            inFlight: false,
            refetchVariables,
            requestCount: 0,
          });

          // Assert component renders immediately with empty data
          expectFragmentResults([{data: null}]);
          // FIXME should be released
          expect(isOperationRetained(refetchQuery)).toBe(true);
        });
      });
    });

    describe('disposing', () => {
      const unsubscribe = jest.fn<[], unknown>();
      jest.doMock('relay-runtime', () => {
        const originalRuntime = jest.requireActual<any>('relay-runtime');
        const originalInternal = originalRuntime.__internal;
        return {
          ...originalRuntime,
          __internal: {
            ...originalInternal,
            fetchQueryDeduped: (...args) => {
              const observable = originalInternal.fetchQueryDeduped(...args);
              return Observable.create(sink => {
                const sub = observable.subscribe(sink);
                return () => {
                  unsubscribe();
                  sub.unsubscribe();
                };
              });
            },
          },
        };
      });
      beforeEach(() => {
        fetchPolicy = 'store-and-network';
        unsubscribe.mockClear();
      });

      it('does not cancel ongoing request if environment changes', () => {
        renderFragment();
        commitSpy.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
          );
        });

        // Assert request is started
        const refetchVariables = {id: '1', scale: 16};
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables,
          requestCount: 1,
        });

        // Component renders immediately even though request is in flight
        // since data is cached
        const refetchingUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef('1', refetchQuery),
        };
        expectFragmentResults([{data: refetchingUser}]);

        // Set new environment
        const newEnvironment = createMockEnvironment();
        newEnvironment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '1',
            name: 'Alice in a different env',
            profile_picture: null,
            username: 'useralice',
          },
        });
        TestRenderer.act(() => {
          setEnvironment(newEnvironment);
        });

        // Assert request is not cancelled, since useQueryLoader does not
        // cancel network requests when disposing query refs.
        expect(unsubscribe).toBeCalledTimes(0);
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables,
          requestCount: 1,
        });

        // Assert newly rendered data
        const expectedUser = {
          id: '1',
          name: 'Alice in a different env',
          profile_picture: null,
          ...createFragmentRef('1', query),
        };
        expectFragmentResults([{data: expectedUser}]);
      });

      it('does not cancel ongoing request if fragment ref changes', () => {
        renderFragment();
        commitSpy.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
          );
        });

        // Assert request is started
        const refetchVariables = {id: '1', scale: 16};
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables,
          requestCount: 1,
        });

        // Component renders immediately even though request is in flight
        // since data is cached
        const refetchingUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef('1', refetchQuery),
        };
        expectFragmentResults([{data: refetchingUser}]);

        // Pass new parent fragment ref with different variables
        const newVariables = {...variables, scale: 32};
        const newQuery = createOperationDescriptor(gqlQuery, newVariables, {
          force: true,
        });
        environment.commitPayload(newQuery, {
          node: {
            __typename: 'User',
            id: '1',
            name: 'Alice',
            profile_picture: {
              uri: 'uri32',
            },
            username: 'useralice',
          },
        });
        TestRenderer.act(() => {
          setOwner(newQuery);
        });

        // Assert request is not cancelled, since useQueryLoader does not
        // cancel network requests when disposing query refs.
        expect(unsubscribe).toBeCalledTimes(0);
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables,
          requestCount: 1,
        });

        // Assert newly rendered data
        const expectedUser = {
          id: '1',
          name: 'Alice',
          profile_picture: {
            uri: 'uri32',
          },
          ...createFragmentRef('1', newQuery),
        };
        expectFragmentResults([{data: expectedUser}]);
      });

      it('does not cancel ongoing request on unmount when refetch suspends', () => {
        const renderer = renderFragment();
        commitSpy.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '2'},
            {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
          );
        });

        // Assert request is started
        const refetchVariables = {id: '2', scale: 16};
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );

        expectFragmentIsRefetching(renderer, {
          refetchQuery,
          refetchVariables,
        });

        TestRenderer.act(() => {
          renderer.unmount();
        });

        // Assert request is not cancelled. useQueryLoader does not cancel
        // network requests when disposing query refs.
        expect(unsubscribe).toBeCalledTimes(0);
      });

      it('does not cancel ongoing request on unmount when refetch does not suspend', () => {
        const renderer = renderFragment();
        commitSpy.mockClear();
        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
          );
        });

        // Assert request is started
        const refetchVariables = {id: '1', scale: 16};
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables,
          requestCount: 1,
        });

        // Component renders immediately even though request is in flight
        // since data is cached
        const refetchingUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef('1', refetchQuery),
        };
        expectFragmentResults([{data: refetchingUser}]);

        TestRenderer.act(() => {
          renderer.unmount();
        });

        // Assert request is not cancelled. useQueryLoader does not cancel
        // network requests when disposing query refs.
        expect(unsubscribe).toBeCalledTimes(0);
      });

      it('disposes ongoing request if it is manually disposed when refetch suspends', () => {
        const renderer = renderFragment();
        commitSpy.mockClear();
        let disposable;
        TestRenderer.act(() => {
          disposable = refetch(
            {id: '2'},
            {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
          );
        });

        // Assert request is started
        const refetchVariables = {id: '2', scale: 16};
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          refetchQuery,
          refetchVariables,
        });

        TestRenderer.act(() => {
          disposable && disposable.dispose();
          jest.runAllImmediates();
        });

        // The request is not able to be cancelled
        // since the new query reference is never able to
        // commit, and we only dispose of network requests
        // in the commit phase for concurrent safety.
        // From the perspective of React, the refetch never
        // occurred and a new query reference was not committed,
        // so there is nothing to cancel.
        expect(unsubscribe).toBeCalledTimes(0);
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables,
          requestCount: 1,
        });

        // Assert that when the refetch is disposed we reset to rendering the
        // original data before the refetch
        const initialUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef('1', query),
        };
        expectFragmentResults([{data: initialUser}]);
      });

      it('disposes ongoing request if it is manually disposed when refetch does not suspend', () => {
        renderFragment();
        commitSpy.mockClear();
        let disposable;
        TestRenderer.act(() => {
          disposable = refetch(
            {id: '1'},
            {UNSTABLE_renderPolicy: renderPolicy, fetchPolicy},
          );
        });

        // Assert request is started
        const refetchVariables = {id: '1', scale: 16};
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectRequestIsInFlight({
          gqlRefetchQuery,
          inFlight: true,
          refetchVariables,
          requestCount: 1,
        });

        // Component renders immediately even though request is in flight
        // since data is cached
        const refetchingUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef('1', refetchQuery),
        };
        expectFragmentResults([{data: refetchingUser}]);

        TestRenderer.act(() => {
          disposable && disposable.dispose();
          jest.runAllImmediates();
        });

        // Assert request is not cancelled. useQueryLoader does not cancel
        // network requests when disposing query refs.
        expect(unsubscribe).toBeCalledTimes(0);

        // Assert that when the refetch is disposed we reset to rendering the
        // original data before the refetch
        const initialUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef('1', query),
        };
        expectFragmentResults([{data: initialUser}]);
      });
    });

    describe('refetching @fetchable types', () => {
      beforeEach(() => {
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-type]
        gqlFragment = graphql`
          fragment useRefetchableFragmentNodeTest1Fragment on NonNodeStory
          @refetchable(
            queryName: "useRefetchableFragmentNodeTest1FragmentRefetchQuery"
          ) {
            actor {
              name
            }
          }
        `;

        gqlQuery = graphql`
          query useRefetchableFragmentNodeTest1Query($id: ID!) {
            nonNodeStory(id: $id) {
              ...useRefetchableFragmentNodeTest1Fragment
            }
          }
        `;

        variables = {id: 'a'};
        gqlRefetchQuery = require('./__generated__/useRefetchableFragmentNodeTest1FragmentRefetchQuery.graphql');

        invariant(
          gqlFragment.metadata?.refetch?.operation === gqlRefetchQuery,
          'useRefetchableFragment-test: Expected refetchable fragment metadata to contain operation.',
        );

        refetchQuery = createOperationDescriptor(gqlRefetchQuery, variables, {
          force: true,
        });
        query = createOperationDescriptor(gqlQuery, variables, {force: true});

        environment.commitPayload(query, {
          nonNodeStory: {
            __typename: 'NonNodeStory',
            actor: {__typename: 'User', id: '1', name: 'Alice'},
            fetch_id: 'fetch:a',
            id: 'a',
          },
        });
      });

      it('refetches new variables correctly when refetching new id', () => {
        const renderer = renderFragment();
        const initialUser = {
          actor: {name: 'Alice'},
          fetch_id: 'fetch:a',
        };
        expectFragmentResults([
          {
            data: initialUser,
          },
        ]);

        TestRenderer.act(() => {
          refetch({id: 'fetch:b'});
        });

        // Assert that fragment is refetching with the right variables and
        // suspends upon refetch
        const refetchVariables = {
          id: 'fetch:b',
        };
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          refetchQuery,
          refetchVariables,
        });

        // Mock network response
        TestRenderer.act(() => {
          environment.mock.resolve(gqlRefetchQuery, {
            data: {
              fetch__NonNodeStory: {
                __typename: 'NonNodeStory',
                actor: {__typename: 'User', id: '4', name: 'Mark'},
                fetch_id: 'fetch:b',
                id: 'b',
              },
            },
          });
        });

        // Assert fragment is rendered with new data
        const refetchedUser = {
          actor: {name: 'Mark'},
          fetch_id: 'fetch:b',
        };
        expectFragmentResults([{data: refetchedUser}]);
        expect(isOperationRetained(refetchQuery)).toBe(true);
      });

      it('refetches new variables correctly when refetching same id', () => {
        const renderer = renderFragment();
        const initialUser = {
          actor: {name: 'Alice'},
          fetch_id: 'fetch:a',
        };
        expectFragmentResults([
          {
            data: initialUser,
          },
        ]);

        TestRenderer.act(() => {
          refetch({}, {fetchPolicy: 'network-only'});
        });

        // Assert that fragment is refetching with the right variables and
        // suspends upon refetch
        const refetchVariables = {
          id: 'fetch:a',
        };
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          refetchQuery,
          refetchVariables,
        });

        // Mock network response
        TestRenderer.act(() => {
          environment.mock.resolve(gqlRefetchQuery, {
            data: {
              fetch__NonNodeStory: {
                __typename: 'NonNodeStory',
                actor: {__typename: 'User', id: '1', name: 'Alice (updated)'},
                fetch_id: 'fetch:a',
                id: 'a',
              },
            },
          });
        });

        // Assert fragment is rendered with new data
        const refetchedUser = {
          actor: {name: 'Alice (updated)'},
          fetch_id: 'fetch:a',
        };
        expectFragmentResults([{data: refetchedUser}]);
        expect(isOperationRetained(refetchQuery)).toBe(true);
      });

      it('refetches new variables correctly when refetching after the id from the parent has changed', () => {
        // add data for second query
        const query2 = createOperationDescriptor(
          gqlQuery,
          {
            id: 'b',
          },
          {force: true},
        );
        environment.commitPayload(query2, {
          nonNodeStory: {
            __typename: 'NonNodeStory',
            actor: {__typename: 'User', id: '4', name: 'Zuck'},
            fetch_id: 'fetch:b',
            id: 'b',
          },
        });

        const renderer = renderFragment();
        const initialUser = {
          actor: {name: 'Alice'},
          fetch_id: 'fetch:a',
        };
        expectFragmentResults([
          {
            data: initialUser,
          },
        ]);

        TestRenderer.act(() => {
          setOwner(query2);
        });

        const nextUser = {
          actor: {name: 'Zuck'},
          fetch_id: 'fetch:b',
        };
        expectFragmentResults([
          {
            data: nextUser,
          },
        ]);
        TestRenderer.act(() => {
          refetch({}, {fetchPolicy: 'network-only'});
        });

        // Assert that fragment is refetching with the right variables and
        // suspends upon refetch
        const refetchVariables = {
          id: 'fetch:b',
        };
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          refetchQuery,
          refetchVariables,
        });

        // Mock network response
        TestRenderer.act(() => {
          environment.mock.resolve(gqlRefetchQuery, {
            data: {
              fetch__NonNodeStory: {
                __typename: 'NonNodeStory',
                actor: {__typename: 'User', id: '4', name: 'Zuck (updated)'},
                fetch_id: 'fetch:b',
                id: 'b',
              },
            },
          });
        });

        // Assert fragment is rendered with new data
        const refetchedUser = {
          actor: {name: 'Zuck (updated)'},
          fetch_id: 'fetch:b',
        };
        expectFragmentResults([{data: refetchedUser}]);
        expect(isOperationRetained(refetchQuery)).toBe(true);
      });
    });

    describe('when id variable has a different variable name in original query', () => {
      beforeEach(() => {
        graphql`
          fragment useRefetchableFragmentNodeTest2Fragment on User {
            username
          }
        `;
        // $FlowFixMe[incompatible-type]
        gqlFragment = graphql`
          fragment useRefetchableFragmentNodeTest3Fragment on User
          @refetchable(
            queryName: "useRefetchableFragmentNodeTest3FragmentRefetchQuery"
          ) {
            id
            name
            profile_picture(scale: $scale) {
              uri
            }
            ...useRefetchableFragmentNodeTest2Fragment
          }
        `;
        gqlQuery = graphql`
          query useRefetchableFragmentNodeTest2Query(
            $nodeID: ID!
            $scale: Float!
          ) {
            node(id: $nodeID) {
              ...useRefetchableFragmentNodeTest3Fragment
                @dangerously_unaliased_fixme
            }
          }
        `;
        gqlRefetchQuery = require('./__generated__/useRefetchableFragmentNodeTest3FragmentRefetchQuery.graphql');

        variables = {nodeID: '1', scale: 16};

        invariant(
          gqlFragment.metadata?.refetch?.operation === gqlRefetchQuery,
          'useRefetchableFragment-test: Expected refetchable fragment metadata to contain operation.',
        );

        query = createOperationDescriptor(gqlQuery, variables, {force: true});
        refetchQuery = createOperationDescriptor(gqlRefetchQuery, variables, {
          force: true,
        });

        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '1',
            name: 'Alice',
            profile_picture: null,
            username: 'useralice',
          },
        });
      });

      it('refetches new variables correctly when refetching new id', () => {
        const renderer = renderFragment();
        const initialUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef(
            '1',
            query,
            'useRefetchableFragmentNodeTest2Fragment',
          ),
        };
        expectFragmentResults([
          {
            data: initialUser,
          },
        ]);

        TestRenderer.act(() => {
          refetch({id: '4'});
        });

        // Assert that fragment is refetching with the right variables and
        // suspends upon refetch
        const refetchVariables = {
          id: '4',
          scale: 16,
        };
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          refetchQuery,
          refetchVariables,
        });

        // Mock network response
        TestRenderer.act(() => {
          environment.mock.resolve(gqlRefetchQuery, {
            data: {
              node: {
                __typename: 'User',
                id: '4',
                name: 'Mark',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'usermark',
              },
            },
          });
        });

        // Assert fragment is rendered with new data
        const refetchedUser = {
          id: '4',
          name: 'Mark',
          profile_picture: {
            uri: 'scale16',
          },
          ...createFragmentRef(
            '4',
            refetchQuery,
            'useRefetchableFragmentNodeTest2Fragment',
          ),
        };
        expectFragmentResults([{data: refetchedUser}]);
        expect(isOperationRetained(refetchQuery)).toBe(true);
      });

      it('refetches new variables correctly when refetching same id', () => {
        const renderer = renderFragment();
        const initialUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef(
            '1',
            query,
            'useRefetchableFragmentNodeTest2Fragment',
          ),
        };
        expectFragmentResults([
          {
            data: initialUser,
          },
        ]);

        TestRenderer.act(() => {
          refetch({scale: 32});
        });

        // Assert that fragment is refetching with the right variables and
        // suspends upon refetch
        const refetchVariables = {
          id: '1',
          scale: 32,
        };
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );
        expectFragmentIsRefetching(renderer, {
          refetchQuery,
          refetchVariables,
        });

        // Mock network response
        TestRenderer.act(() => {
          environment.mock.resolve(gqlRefetchQuery, {
            data: {
              node: {
                __typename: 'User',
                id: '1',
                name: 'Alice',
                profile_picture: {
                  uri: 'scale32',
                },
                username: 'useralice',
              },
            },
          });
        });

        // Assert fragment is rendered with new data
        const refetchedUser = {
          id: '1',
          name: 'Alice',
          profile_picture: {
            uri: 'scale32',
          },
          ...createFragmentRef(
            '1',
            refetchQuery,
            'useRefetchableFragmentNodeTest2Fragment',
          ),
        };
        expectFragmentResults([{data: refetchedUser}]);
        expect(isOperationRetained(refetchQuery)).toBe(true);
      });
    });

    describe('internal environment option', () => {
      let newRelease;
      let isOperationRetainedInNewEnvironment;
      let newEnvironment;

      beforeEach(() => {
        newEnvironment = createMockEnvironment();
        ({
          release_DEPRECATED: newRelease,
          isOperationRetained: isOperationRetainedInNewEnvironment,
        } = trackRetentionForEnvironment(newEnvironment));
      });

      it('reloads new data into new environment, and renders successfully', () => {
        const renderer = renderFragment();
        const initialUser = {
          id: '1',
          name: 'Alice',
          profile_picture: null,
          ...createFragmentRef(
            '1',
            query,
            'useRefetchableFragmentNodeTestNestedUserFragment',
          ),
        };
        // initial data on default environment
        expectFragmentResults([{data: initialUser}]);

        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {
              __environment: newEnvironment,
            },
          );
        });
        const refetchVariables = {
          id: '1',
          scale: 16,
        };
        refetchQuery = createOperationDescriptor(
          gqlRefetchQuery,
          refetchVariables,
          {force: true},
        );

        // Fetch on newEnvironment
        expectFragmentIsRefetching(
          renderer,
          {
            refetchQuery,
            refetchVariables,
          },
          newEnvironment,
        );

        TestRenderer.act(() => {
          newEnvironment.mock.resolve(gqlRefetchQuery, {
            data: {
              node: {
                __typename: 'User',
                id: '1',
                name: 'Mark',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'usermark',
              },
            },
          });
        });
        TestRenderer.act(() => jest.runAllImmediates());

        // Data should be loaded on the newEnvironment
        const dataInSource = {
          __id: '1',
          __typename: 'User',
          id: '1',
          name: 'Mark',
          'profile_picture(scale:16)': {
            __ref: 'client:1:profile_picture(scale:16)',
          },
          username: 'usermark',
        };
        const source = newEnvironment.getStore().getSource();
        expect(source.get('1')).toEqual(dataInSource);

        // Assert refetch query was retained
        expect(isOperationRetainedInNewEnvironment(refetchQuery)).toBe(true);

        // Should be able to use the new data if switched to new environment
        commitSpy.mockClear();
        newRelease.mockClear();
        TestRenderer.act(() => {
          setEnvironment(newEnvironment);
        });
        // refetch on the same newEnvironment after switching should not be reset
        expect(release).not.toBeCalled(); // FIXME not sure what this is trying to say

        const refetchedUser = {
          id: '1',
          name: 'Mark',
          profile_picture: {
            uri: 'scale16',
          },
          ...createFragmentRef('1', refetchQuery),
        };

        expectFragmentResults([{data: refetchedUser}]);

        // Refetch on another enironment afterwards should work
        commitSpy.mockClear();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        environment.executeWithSource.mockClear();
        const anotherNewEnvironment = createMockEnvironment();
        TestRenderer.act(() => jest.runAllImmediates());

        TestRenderer.act(() => {
          refetch(
            {id: '1'},
            {
              __environment: anotherNewEnvironment,
            },
          );
        });
        expectFragmentIsRefetching(
          renderer,
          {
            refetchQuery,
            refetchVariables,
          },
          anotherNewEnvironment,
        );

        TestRenderer.act(() => {
          anotherNewEnvironment.mock.resolve(gqlRefetchQuery, {
            data: {
              node: {
                __typename: 'User',
                id: '1',
                name: 'Mark',
                profile_picture: {
                  uri: 'scale16',
                },
                username: 'usermark',
              },
            },
          });
        });
        expect(anotherNewEnvironment.getStore().getSource().get('1')).toEqual(
          dataInSource,
        );
      });
    });
  });
});
