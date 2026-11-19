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

import type {RecordSourceProxy} from '../../../relay-runtime/store/RelayStoreTypes';
import type {
  useFragmentNodeTestUserFragment$data,
  useFragmentNodeTestUserFragment$fragmentType,
} from './__generated__/useFragmentNodeTestUserFragment.graphql';
import type {
  useFragmentNodeTestUsersFragment$data,
  useFragmentNodeTestUsersFragment$fragmentType,
} from './__generated__/useFragmentNodeTestUsersFragment.graphql';
import type {OperationDescriptor, RelayContext} from 'relay-runtime';
import type {Fragment} from 'relay-runtime/util/RelayRuntimeTypes';

const {act: actInternal} = require('../../jest-react');
const useFragmentNode_LEGACY = require('../legacy/useFragmentNode');
const useFragmentInternal_CURRENT = require('../useFragmentInternal_CURRENT');
const useFragmentInternal_EXPERIMENTAL = require('../useFragmentInternal_EXPERIMENTAL');
const invariant = require('invariant');
const React = require('react');
const ReactRelayContext = require('react-relay/ReactRelayContext');
const ReactTestRenderer = require('react-test-renderer');
const {
  __internal: {fetchQuery},
  FRAGMENT_OWNER_KEY,
  FRAGMENTS_KEY,
  ID_KEY,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const RelayFeatureFlags = require('relay-runtime/util/RelayFeatureFlags');
const {
  createMockEnvironment,
  disallowWarnings,
  expectWarningWillFire,
} = require('relay-test-utils-internal');

disallowWarnings();
// TODO: T114709507 Add disallowConsoleErrors() with update to React 18.

const {useEffect, useMemo, useState} = React;

function assertYieldsWereCleared(_scheduler: any) {
  const actualYields = _scheduler.unstable_clearLog();
  if (actualYields.length !== 0) {
    throw new Error(
      'Log of yielded values is not empty. ' +
        'Call expect(Scheduler).toHaveYielded(...) first.',
    );
  }
}

function expectSchedulerToHaveYielded(expectedYields: any) {
  const Scheduler = require('scheduler');
  const actualYields = Scheduler.unstable_clearLog();
  expect(actualYields).toEqual(expectedYields);
}

function flushScheduler() {
  const Scheduler = require('scheduler');
  assertYieldsWereCleared(Scheduler);
  Scheduler.unstable_flushAllWithoutAsserting();
  return Scheduler.unstable_clearLog();
}

function expectSchedulerToFlushAndYield(expectedYields: any) {
  const actualYields = flushScheduler();
  expect(actualYields).toEqual(expectedYields);
}

function expectSchedulerToFlushAndYieldThrough(expectedYields: any) {
  const Scheduler = require('scheduler');
  assertYieldsWereCleared(Scheduler);
  Scheduler.unstable_flushNumberOfYields(expectedYields.length);
  const actualYields = Scheduler.unstable_clearLog();
  expect(actualYields).toEqual(expectedYields);
}

// The current tests are against useFragmentNode which as a different Flow signature
// than the external API useFragment. I want to keep the more accurate types
// for useFragmentInternal, though, so this wrapper adapts it.
type ReturnType<TFragmentData extends unknown> = {
  data: TFragmentData,
  disableStoreUpdates: () => void,
  enableStoreUpdates: () => void,
};
hook useFragmentNode_CURRENT<TFragmentData extends unknown>(
  fragment:
    | Fragment<
        useFragmentNodeTestUserFragment$fragmentType,
        useFragmentNodeTestUserFragment$data,
      >
    | Fragment<
        useFragmentNodeTestUsersFragment$fragmentType,
        useFragmentNodeTestUsersFragment$data,
      >,
  key: any,
  displayName: string,
): ReturnType<TFragmentData> {
  const data = useFragmentInternal_CURRENT(fragment, key, displayName);
  return {
    // $FlowFixMe[incompatible-type]
    data,
    disableStoreUpdates: () => {},
    enableStoreUpdates: () => {},
  };
}
hook useFragmentNode_EXPERIMENTAL<TFragmentData extends unknown>(
  fragment:
    | Fragment<
        useFragmentNodeTestUserFragment$fragmentType,
        useFragmentNodeTestUserFragment$data,
      >
    | Fragment<
        useFragmentNodeTestUsersFragment$fragmentType,
        useFragmentNodeTestUsersFragment$data,
      >,
  key: any,
  displayName: string,
): ReturnType<TFragmentData> {
  const data = useFragmentInternal_EXPERIMENTAL(fragment, key, displayName);
  return {
    // $FlowFixMe[incompatible-type]
    data,
    disableStoreUpdates: () => {},
    enableStoreUpdates: () => {},
  };
}

describe.each([
  ['Experimental', useFragmentNode_EXPERIMENTAL, true],
  ['Experimental', useFragmentNode_EXPERIMENTAL, false],
  ['Current', useFragmentNode_CURRENT, true],
  ['Current', useFragmentNode_CURRENT, false],
  ['Legacy', useFragmentNode_LEGACY, true],
  ['Legacy', useFragmentNode_LEGACY, false],
])(
  'useFragmentNode / useFragment (%s)',
  (_hookName, useFragmentNodeOriginal, optimizeNotify) => {
    const isUsingNewImplementation =
      useFragmentNodeOriginal === useFragmentNode_CURRENT ||
      useFragmentNodeOriginal === useFragmentNode_EXPERIMENTAL;
    let environment;
    let disableStoreUpdates;
    let enableStoreUpdates;
    let gqlSingularQuery;
    let gqlSingularMissingDataQuery;
    let gqlSingularFragment;
    let gqlPluralQuery;
    let gqlPluralMissingDataQuery;
    let gqlPluralFragment;
    let singularQuery;
    let pluralQuery;
    let singularVariables;
    let pluralVariables;
    let setEnvironment;
    let setSingularOwner;
    let renderSingularFragment;
    let createSingularFragmentElement;
    let renderPluralFragment;
    let forceSingularUpdate;
    let commitSpy;
    let renderSpy;
    let SingularRenderer;
    let PluralRenderer;

    function useFragmentNode(
      fragmentNode:
        | Fragment<
            useFragmentNodeTestUserFragment$fragmentType,
            useFragmentNodeTestUserFragment$data,
          >
        | Fragment<
            useFragmentNodeTestUsersFragment$fragmentType,
            useFragmentNodeTestUsersFragment$data,
          >,
      fragmentRef: any,
    ) {
      const result = useFragmentNodeOriginal<any>(
        fragmentNode,
        fragmentRef,
        'TestDisplayName',
      );
      const {data} = result;
      disableStoreUpdates = result.disableStoreUpdates;
      enableStoreUpdates = result.enableStoreUpdates;
      useEffect(() => {
        commitSpy(data);
      });
      renderSpy(data);

      return [data];
    }

    function assertFragmentResults(
      expectedCalls: ReadonlyArray<{data: $FlowFixMe}>,
    ) {
      expect(commitSpy).toBeCalledTimes(expectedCalls.length);
      expectedCalls.forEach((expected, idx) => {
        const [actualData] = commitSpy.mock.calls[idx];
        expect(actualData).toEqual(expected.data);
      });
      commitSpy.mockClear();
    }

    /// Asserts that a single rendering *batch* occurred, with possibly multiple render
    /// calls and a single commit. `expectedCalls` describes the expected result as follows:
    /// * items 0..length-1 (for length > 1) are calls expected to be rendered, but not committed
    /// * item length-1 is expected to be rendered and committed
    function assertRenderBatch(
      expectedCalls: ReadonlyArray<{data: $FlowFixMe}>,
    ) {
      expect(expectedCalls.length >= 1).toBeTruthy(); // must expect at least one value
      expect(renderSpy).toBeCalledTimes(expectedCalls.length);
      expectedCalls.forEach((expected, idx) => {
        const [actualData] = renderSpy.mock.calls[idx];
        expect(actualData).toEqual(expected.data);
      });
      renderSpy.mockClear();

      expect(commitSpy).toBeCalledTimes(1);
      const [actualData] = commitSpy.mock.calls[0];
      expect(actualData).toEqual(expectedCalls[expectedCalls.length - 1].data);
      commitSpy.mockClear();
    }

    function createFragmentRef(id: string, owner: OperationDescriptor) {
      return {
        [FRAGMENT_OWNER_KEY]: owner.request,
        [FRAGMENTS_KEY]: {
          useFragmentNodeTestNestedUserFragment: {},
        },
        [ID_KEY]: id,
      };
    }

    const defaultOptimizeNotify = RelayFeatureFlags.OPTIMIZE_NOTIFY;

    beforeEach(() => {
      RelayFeatureFlags.OPTIMIZE_NOTIFY = optimizeNotify;
      jest.mock('scheduler', () => require('../../__tests__/mockScheduler'));
      commitSpy = jest.fn<any | [any], unknown>();
      renderSpy = jest.fn<[any], unknown>();

      // Set up environment and base data
      ReactTestRenderer.act(() => {
        environment = createMockEnvironment();
      });
      graphql`
        fragment useFragmentNodeTestNestedUserFragment on User {
          username
        }
      `;
      singularVariables = {id: '1', scale: 16};
      pluralVariables = {ids: ['1', '2'], scale: 16};
      gqlSingularQuery = graphql`
        query useFragmentNodeTestUserQuery($id: ID!, $scale: Float!) {
          node(id: $id) {
            ...useFragmentNodeTestUserFragment @dangerously_unaliased_fixme
          }
        }
      `;
      gqlSingularMissingDataQuery = graphql`
        query useFragmentNodeTestMissingDataQuery($id: ID!) {
          node(id: $id) {
            __typename
            id
          }
        }
      `;

      gqlPluralMissingDataQuery = graphql`
        query useFragmentNodeTestMissingDataPluralQuery($ids: [ID!]!) {
          nodes(ids: $ids) {
            __typename
            id
          }
        }
      `;

      gqlSingularFragment = graphql`
        fragment useFragmentNodeTestUserFragment on User {
          id
          name
          profile_picture(scale: $scale) {
            uri
          }
          ...useFragmentNodeTestNestedUserFragment
        }
      `;
      gqlPluralQuery = graphql`
        query useFragmentNodeTestUsersQuery($ids: [ID!]!, $scale: Float!) {
          nodes(ids: $ids) {
            ...useFragmentNodeTestUsersFragment
          }
        }
      `;
      gqlPluralFragment = graphql`
        fragment useFragmentNodeTestUsersFragment on User @relay(plural: true) {
          id
          name
          profile_picture(scale: $scale) {
            uri
          }
          ...useFragmentNodeTestNestedUserFragment
        }
      `;
      singularQuery = createOperationDescriptor(
        gqlSingularQuery,
        singularVariables,
      );
      pluralQuery = createOperationDescriptor(gqlPluralQuery, pluralVariables);
      environment.commitPayload(singularQuery, {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Alice',
          profile_picture: null,
          username: 'useralice',
        },
      });
      environment.commitPayload(pluralQuery, {
        nodes: [
          {
            __typename: 'User',
            id: '1',
            name: 'Alice',
            profile_picture: null,
            username: 'useralice',
          },
          {
            __typename: 'User',
            id: '2',
            name: 'Bob',
            profile_picture: null,
            username: 'userbob',
          },
        ],
      });

      // Set up renderers
      SingularRenderer = (props: {user: any}) => null;
      PluralRenderer = (props: {users: any}) => null;

      const SingularContainer = (props: {
        userRef?: {...},
        owner: OperationDescriptor,
        ...
      }) => {
        // We need a render a component to run a Hook
        const [owner, _setOwner] = useState<OperationDescriptor>(props.owner);
        const [, setCount] = useState(0);
        const userRef = props.hasOwnProperty('userRef')
          ? props.userRef
          : {
              [FRAGMENT_OWNER_KEY]: owner.request,
              [FRAGMENTS_KEY]: {
                useFragmentNodeTestUserFragment: {},
              },
              [ID_KEY]: owner.request.variables.id,
            };

        setSingularOwner = _setOwner;
        forceSingularUpdate = () => setCount(count => count + 1);

        const [userData] = useFragmentNode(gqlSingularFragment, userRef);
        return <SingularRenderer user={userData} />;
      };

      const PluralContainer = (props: {
        usersRef?: {...},
        owner: $FlowFixMe,
        ...
      }) => {
        // We need a render a component to run a Hook
        const owner = props.owner;
        const usersRef = props.hasOwnProperty('usersRef')
          ? props.usersRef
          : owner.request.variables.ids.map(id => ({
              [FRAGMENT_OWNER_KEY]: owner.request,
              [FRAGMENTS_KEY]: {
                useFragmentNodeTestUsersFragment: {},
              },
              [ID_KEY]: id,
            }));

        const [usersData] = useFragmentNode(gqlPluralFragment, usersRef);
        return <PluralRenderer users={usersData} />;
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

      createSingularFragmentElement = () => (
        <React.Suspense fallback="Singular Fallback">
          <ContextProvider>
            <SingularContainer owner={singularQuery} />
          </ContextProvider>
        </React.Suspense>
      );

      renderSingularFragment = (props?: {
        owner?: $FlowFixMe,
        userRef?: $FlowFixMe,
        ...
      }) => {
        let instance;
        ReactTestRenderer.act(() => {
          instance = ReactTestRenderer.create(
            <React.Suspense fallback="Singular Fallback">
              <ContextProvider>
                <SingularContainer owner={singularQuery} {...props} />
              </ContextProvider>
            </React.Suspense>,
            // $FlowFixMe[incompatible-type] - error revealed when flow-typing ReactTestRenderer
            {
              unstable_isConcurrent: true,
            },
          );
        });
        return instance;
      };

      renderPluralFragment = (
        props?: {
          owner?: $FlowFixMe,
          usersRef?: $FlowFixMe,
          ...
        },
        existing: any,
      ) => {
        const elements = (
          <React.Suspense fallback="Plural Fallback">
            <ContextProvider>
              <PluralContainer owner={pluralQuery} {...props} />
            </ContextProvider>
          </React.Suspense>
        );
        if (existing) {
          existing.update(elements);
          return existing;
        } else {
          let instance;
          ReactTestRenderer.act(() => {
            instance = ReactTestRenderer.create(
              elements,
              // $FlowFixMe[incompatible-type] - error revealed when flow-typing ReactTestRenderer
              {
                unstable_isConcurrent: true,
              },
            );
          });
          return instance;
        }
      };
    });

    afterEach(() => {
      RelayFeatureFlags.OPTIMIZE_NOTIFY = defaultOptimizeNotify;
      flushScheduler();
      environment.mockClear();
      commitSpy.mockClear();
      renderSpy.mockClear();
    });

    it('should render singular fragment without error when data is available', () => {
      ReactTestRenderer.act(() => {
        renderSingularFragment();
      });
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);
    });

    it('should render singular fragment without error when ref is null', () => {
      renderSingularFragment({userRef: null});
      assertFragmentResults([
        {
          data: null,
        },
      ]);
    });

    it('should render singular fragment without error when ref is undefined', () => {
      renderSingularFragment({userRef: undefined});
      assertFragmentResults([
        {
          data: null,
        },
      ]);
    });

    it('should render plural fragment without error when data is available', () => {
      renderPluralFragment();
      assertFragmentResults([
        {
          data: [
            {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', pluralQuery),
            },
            {
              id: '2',
              name: 'Bob',
              profile_picture: null,
              ...createFragmentRef('2', pluralQuery),
            },
          ],
        },
      ]);
    });

    it('should render plural fragment without error when plural field is empty', () => {
      renderPluralFragment({usersRef: []});
      assertFragmentResults([
        {
          data: [],
        },
      ]);
    });

    it('should render plural fragment with a constant reference when plural field is empty', () => {
      let container;
      ReactTestRenderer.act(() => {
        container = renderPluralFragment({usersRef: []});
      });
      ReactTestRenderer.act(() => {
        renderPluralFragment({usersRef: []}, container);
      });

      expect(commitSpy.mock.calls).toHaveLength(2);
      const [[firstRender], [secondRender]] = commitSpy.mock.calls;
      expect(firstRender).toBe(secondRender);
    });

    it('should update when fragment data changes', () => {
      renderSingularFragment();
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      ReactTestRenderer.act(() => {
        environment.commitPayload(singularQuery, {
          node: {
            __typename: 'User',
            id: '1',
            // Update name
            name: 'Alice in Wonderland',
            profile_picture: null,
            username: null,
          },
        });
      });
      assertFragmentResults([
        {
          data: {
            id: '1',
            // Assert that name is updated
            name: 'Alice in Wonderland',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);
    });

    it('should preserve object identity when fragment data changes', () => {
      ReactTestRenderer.act(() => {
        renderSingularFragment();
      });
      expect(commitSpy).toBeCalledTimes(1);
      const prevData = commitSpy.mock.calls[0][0];
      expect(prevData).toEqual({
        id: '1',
        name: 'Alice',
        profile_picture: null,
        ...createFragmentRef('1', singularQuery),
      });
      commitSpy.mockClear();

      ReactTestRenderer.act(() => {
        environment.commitPayload(singularQuery, {
          node: {
            __typename: 'User',
            id: '1',
            // Update name
            name: 'Alice in Wonderland',
            profile_picture: null,
            username: null,
          },
        });
      });
      expect(commitSpy).toBeCalledTimes(1);
      const nextData = commitSpy.mock.calls[0][0];
      expect(nextData).toEqual({
        id: '1',
        // Assert that name is updated
        name: 'Alice in Wonderland',
        profile_picture: null,
        ...createFragmentRef('1', singularQuery),
      });
      expect(nextData.__fragments).toBe(prevData.__fragments);
    });

    it('should re-read and resubscribe to fragment when environment changes', () => {
      renderSingularFragment();
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      const newEnvironment = createMockEnvironment();
      newEnvironment.commitPayload(singularQuery, {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Alice in a different env',
          profile_picture: null,
          username: null,
        },
      });

      ReactTestRenderer.act(() => {
        setEnvironment(newEnvironment);
      });

      const expectedUser = {
        id: '1',
        name: 'Alice in a different env',
        profile_picture: null,
        ...createFragmentRef('1', singularQuery),
      };
      assertFragmentResults([{data: expectedUser}]);

      ReactTestRenderer.act(() => {
        newEnvironment.commitPayload(singularQuery, {
          node: {
            __typename: 'User',
            id: '1',
            // Update name
            name: 'Alice in Wonderland',
            profile_picture: null,
            username: null,
          },
        });
      });
      assertFragmentResults([
        {
          data: {
            id: '1',
            // Assert that name is updated
            name: 'Alice in Wonderland',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);
    });

    it('should supsend when the environment changes and there is query in flight', () => {
      const renderer = renderSingularFragment();
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      const newEnvironment = createMockEnvironment();

      ReactTestRenderer.act(() => {
        // Let there be an operation in flight
        fetchQuery(newEnvironment, singularQuery).subscribe({});

        setEnvironment(newEnvironment);
      });

      // It should suspend when the environment changes and there is a query
      // in flight.
      expect(renderer?.toJSON()).toEqual('Singular Fallback');
    });

    it('should re-read and resubscribe to fragment when fragment pointers change', () => {
      renderSingularFragment();
      assertRenderBatch([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      const newVariables = {...singularVariables, id: '200'};
      const newQuery = createOperationDescriptor(
        gqlSingularQuery,
        newVariables,
      );
      environment.commitPayload(newQuery, {
        node: {
          __typename: 'User',
          id: '200',
          name: 'Foo',
          profile_picture: null,
          username: 'userfoo',
        },
      });

      ReactTestRenderer.act(() => {
        environment.commitUpdate(store => {
          store.delete('1');
        });
        setSingularOwner(newQuery);
      });

      const expectedUser = {
        // Assert updated data
        id: '200',
        name: 'Foo',
        profile_picture: null,
        // Assert that ref now points to newQuery owner
        ...createFragmentRef('200', newQuery),
      };
      if (isUsingNewImplementation) {
        // React Cache renders twice (because it has to update state for derived data),
        // but avoids rendering with stale data on the initial update
        assertRenderBatch([{data: expectedUser}, {data: expectedUser}]);
      } else {
        assertRenderBatch([{data: expectedUser}]);
      }

      ReactTestRenderer.act(() => {
        environment.commitPayload(newQuery, {
          node: {
            __typename: 'User',
            id: '200',
            // Update name
            name: 'Foo Updated',
            profile_picture: null,
            username: 'userfoo',
          },
        });
      });
      assertRenderBatch([
        {
          data: {
            id: '200',
            // Assert that name is updated
            name: 'Foo Updated',
            profile_picture: null,
            ...createFragmentRef('200', newQuery),
          },
        },
      ]);
    });

    it('should render correct data when changing fragment refs multiple times', () => {
      // Render component with data for ID 1
      renderSingularFragment();
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      // Update fragment refs to render data for ID 200
      const newVariables = {...singularVariables, id: '200'};
      const newQuery = createOperationDescriptor(
        gqlSingularQuery,
        newVariables,
      );
      environment.commitPayload(newQuery, {
        node: {
          __typename: 'User',
          id: '200',
          name: 'Foo',
          profile_picture: null,
          username: 'userfoo',
        },
      });

      ReactTestRenderer.act(() => {
        setSingularOwner(newQuery);
      });

      let expectedUser = {
        // Assert updated data
        id: '200',
        name: 'Foo',
        profile_picture: null,
        // Assert that ref now points to newQuery owner
        ...createFragmentRef('200', newQuery),
      };
      assertFragmentResults([{data: expectedUser}]);

      // Udpate data for ID 1
      environment.commitPayload(singularQuery, {
        node: {
          __typename: 'User',
          id: '1',
          // Update name
          name: 'Alice in Wonderland',
          profile_picture: null,
          username: 'userfoo',
        },
      });

      // Switch back to rendering data for ID 1
      ReactTestRenderer.act(() => {
        setSingularOwner(singularQuery);
      });

      // We expect to see the latest data
      expectedUser = {
        // Assert updated data
        id: '1',
        name: 'Alice in Wonderland',
        profile_picture: null,
        // Assert that ref points to original singularQuery owner
        ...createFragmentRef('1', singularQuery),
      };
      assertFragmentResults([{data: expectedUser}]);

      // Assert it correctly subscribes to new data
      ReactTestRenderer.act(() => {
        environment.commitPayload(singularQuery, {
          node: {
            __typename: 'User',
            id: '1',
            // Update name
            name: 'Alice Updated',
            profile_picture: null,
            username: 'userfoo',
          },
        });
      });
      assertFragmentResults([
        {
          data: {
            id: '1',
            // Assert anme is updated
            name: 'Alice Updated',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);
    });

    it('should ignore updates to initially rendered data when fragment pointers change', () => {
      const Scheduler = require('scheduler');
      const YieldChild = (props: any) => {
        // NOTE the unstable_yield method will move to the static renderer.
        // When React sync runs we need to update this.
        Scheduler.log(props.children);
        return props.children;
      };
      const YieldyUserComponent = ({user}: any) => (
        <>
          <YieldChild>Hey user,</YieldChild>
          <YieldChild>{user.name}</YieldChild>
          <YieldChild>with id {user.id}!</YieldChild>
        </>
      );

      // Assert initial render
      // $FlowFixMe[incompatible-type]
      SingularRenderer = YieldyUserComponent;
      renderSingularFragment();
      expectSchedulerToHaveYielded([
        'Hey user,',
        'Alice',
        ['with id ', '1', '!'],
      ]);
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      const newVariables = {...singularVariables, id: '200'};
      const newQuery = createOperationDescriptor(
        gqlSingularQuery,
        newVariables,
      );

      ReactTestRenderer.act(() => {
        environment.commitPayload(newQuery, {
          node: {
            __typename: 'User',
            id: '200',
            name: 'Foo',
            profile_picture: null,
            username: 'userfoo',
          },
        });
      });

      // Pass new fragment ref that points to new ID 200
      setSingularOwner(newQuery);

      // Flush some of the changes, but don't commit
      expectSchedulerToFlushAndYieldThrough([
        'Hey user,',
        'Foo',
        ['with id ', '200', '!'],
      ]);

      // Trigger an update for initially rendered data while second
      // render is in progress
      environment.commitPayload(singularQuery, {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Alice in Wonderland',
          profile_picture: null,
          username: 'userfoo',
        },
      });

      // Assert the component renders the data from newQuery/newVariables,
      // ignoring any updates triggered while render was in progress.
      const expectedData = {
        data: {
          id: '200',
          name: 'Foo',
          profile_picture: null,
          ...createFragmentRef('200', newQuery),
        },
      };

      if (isUsingNewImplementation) {
        // The new implementation simply finishes the render in progress.
        expectSchedulerToFlushAndYield([]);
        assertFragmentResults([expectedData]);
      } else {
        // The old implementation also does an extra re-render.
        expectSchedulerToFlushAndYield([
          'Hey user,',
          'Foo',
          ['with id ', '200', '!'],
        ]);
        assertFragmentResults([expectedData, expectedData]);
      }
      // Update latest rendered data
      environment.commitPayload(newQuery, {
        node: {
          __typename: 'User',
          id: '200',
          // Update name
          name: 'Foo Updated',
          profile_picture: null,
          username: 'userfoo',
        },
      });

      expectSchedulerToFlushAndYield([
        'Hey user,',
        'Foo Updated',
        ['with id ', '200', '!'],
      ]);

      assertFragmentResults([
        {
          data: {
            id: '200',
            // Assert name is updated
            name: 'Foo Updated',
            profile_picture: null,
            ...createFragmentRef('200', newQuery),
          },
        },
      ]);
    });

    it('should ignore updates to initially rendered data when fragment pointers change, but still handle updates to the new data', () => {
      const Scheduler = require('scheduler');
      const YieldChild = (props: any) => {
        // NOTE the unstable_yield method will move to the static renderer.
        // When React sync runs we need to update this.
        Scheduler.log(props.children);
        return props.children;
      };
      const YieldyUserComponent = ({user}: any) => (
        <>
          <YieldChild>Hey user,</YieldChild>
          <YieldChild>{user.name}</YieldChild>
          <YieldChild>with id {user.id}!</YieldChild>
        </>
      );

      // Assert initial render
      // $FlowFixMe[incompatible-type]
      SingularRenderer = YieldyUserComponent;
      ReactTestRenderer.act(() => {
        renderSingularFragment();
      });
      expectSchedulerToHaveYielded([
        'Hey user,',
        'Alice',
        ['with id ', '1', '!'],
      ]);
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      const newVariables = {...singularVariables, id: '200'};
      const newQuery = createOperationDescriptor(
        gqlSingularQuery,
        newVariables,
      );
      environment.commitPayload(newQuery, {
        node: {
          __typename: 'User',
          id: '200',
          name: 'Foo',
          profile_picture: null,
          username: 'userfoo',
        },
      });

      // Pass new fragment ref that points to new ID 200
      setSingularOwner(newQuery);

      // Flush some of the changes, but don't commit
      expectSchedulerToFlushAndYieldThrough([
        'Hey user,',
        'Foo',
        ['with id ', '200', '!'],
      ]);

      // Trigger an update for initially rendered data and for the new data
      // while second render is in progress
      environment.commitUpdate(store => {
        store.get('1')?.setValue('Alice in Wonderland', 'name');
        store.get('200')?.setValue('Foo Bar', 'name');
      });

      // Assert the component renders the data from newQuery/newVariables,
      // ignoring any updates triggered while render was in progress.
      const expectedData = {
        data: {
          id: '200',
          name: 'Foo',
          profile_picture: null,
          ...createFragmentRef('200', newQuery),
        },
      };
      expectSchedulerToFlushAndYield([
        'Hey user,',
        'Foo Bar',
        ['with id ', '200', '!'],
      ]);
      assertFragmentResults([
        expectedData,
        {
          data: {
            id: '200',
            name: 'Foo Bar',
            profile_picture: null,
            ...createFragmentRef('200', newQuery),
          },
        },
      ]);

      // Update latest rendered data
      environment.commitPayload(newQuery, {
        node: {
          __typename: 'User',
          id: '200',
          // Update name
          name: 'Foo Updated',
          profile_picture: null,
          username: 'userfoo',
        },
      });
      expectSchedulerToFlushAndYield([
        'Hey user,',
        'Foo Updated',
        ['with id ', '200', '!'],
      ]);
      assertFragmentResults([
        {
          data: {
            id: '200',
            // Assert name is updated
            name: 'Foo Updated',
            profile_picture: null,
            ...createFragmentRef('200', newQuery),
          },
        },
      ]);
    });

    it('should return the latest data when the hi-priority update happens at the same time as the low-priority store update', () => {
      const startTransition = React.startTransition;
      if (startTransition != null) {
        ReactTestRenderer.act(() => {
          renderSingularFragment();
        });
        assertFragmentResults([
          {
            data: {
              id: '1',
              name: 'Alice',
              profile_picture: null,
              ...createFragmentRef('1', singularQuery),
            },
          },
        ]);

        ReactTestRenderer.act(() => {
          // Trigger store update with the lower priority
          startTransition(() => {
            environment.commitUpdate(store => {
              store.get('1')?.setValue('Alice Updated Name', 'name');
            });
          });
        });

        ReactTestRenderer.act(() => {
          // Trigger a hi-pri update with the higher priority, that should force component to re-render
          forceSingularUpdate();
        });

        // Assert that the component re-renders twice, both times with the latest data
        assertFragmentResults([
          {
            data: {
              id: '1',
              name: 'Alice Updated Name',
              profile_picture: null,
              ...createFragmentRef('1', singularQuery),
            },
          },
          {
            data: {
              id: '1',
              name: 'Alice Updated Name',
              profile_picture: null,
              ...createFragmentRef('1', singularQuery),
            },
          },
        ]);
      }
    });

    it('should re-read and resubscribe to fragment when variables change', () => {
      renderSingularFragment();
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      const newVariables = {...singularVariables, id: '1', scale: 32};
      const newQuery = createOperationDescriptor(
        gqlSingularQuery,
        newVariables,
      );
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

      ReactTestRenderer.act(() => {
        setSingularOwner(newQuery);
      });

      const expectedUser = {
        id: '1',
        name: 'Alice',
        profile_picture: {
          // Asset updated uri
          uri: 'uri32',
        },
        // Assert that ref now points to newQuery owner
        ...createFragmentRef('1', newQuery),
      };
      assertFragmentResults([{data: expectedUser}]);

      ReactTestRenderer.act(() => {
        environment.commitPayload(newQuery, {
          node: {
            __typename: 'User',
            id: '1',
            // Update name
            name: 'Alice in Wonderland',
            profile_picture: {
              uri: 'uri32',
            },
            username: 'useralice',
          },
        });
      });
      assertFragmentResults([
        {
          data: {
            id: '1',
            // Assert that name is updated
            name: 'Alice in Wonderland',
            profile_picture: {
              uri: 'uri32',
            },
            ...createFragmentRef('1', newQuery),
          },
        },
      ]);
    });

    it('should ignore updates to initially rendered data when variables change', () => {
      const Scheduler = require('scheduler');
      const YieldChild = (props: any) => {
        Scheduler.log(props.children);
        return props.children;
      };
      const YieldyUserComponent = ({user}: any) => (
        <>
          <YieldChild>Hey user,</YieldChild>
          <YieldChild>{user.profile_picture?.uri ?? 'no uri'}</YieldChild>
          <YieldChild>with id {user.id}!</YieldChild>
        </>
      );

      // Assert initial render
      // $FlowFixMe[incompatible-type]
      SingularRenderer = YieldyUserComponent;
      renderSingularFragment();
      expectSchedulerToHaveYielded([
        'Hey user,',
        'no uri',
        ['with id ', '1', '!'],
      ]);
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      const newVariables = {...singularVariables, id: '1', scale: 32};
      const newQuery = createOperationDescriptor(
        gqlSingularQuery,
        newVariables,
      );
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

      // Pass new fragment ref which contains newVariables
      setSingularOwner(newQuery);

      // Flush some of the changes, but don't commit
      expectSchedulerToFlushAndYieldThrough([
        'Hey user,',
        'uri32',
        ['with id ', '1', '!'],
      ]);

      // Trigger an update for initially rendered data while second
      // render is in progress
      environment.commitPayload(singularQuery, {
        node: {
          __typename: 'User',
          id: '1',
          // Update name
          name: 'Alice',
          // Update profile_picture value
          profile_picture: {
            uri: 'uri16',
          },
          username: null,
        },
      });

      // Assert the component renders the data from newQuery/newVariables,
      // ignoring any updates triggered while render was in progress
      const expectedData = {
        data: {
          id: '1',
          name: 'Alice',
          profile_picture: {
            uri: 'uri32',
          },
          ...createFragmentRef('1', newQuery),
        },
      };
      if (isUsingNewImplementation) {
        // The new implementation simply finishes the render in progress.
        expectSchedulerToFlushAndYield([]);
        assertFragmentResults([expectedData]);
      } else {
        // The old implementation also does an extra re-render.
        expectSchedulerToFlushAndYield([
          'Hey user,',
          'uri32',
          ['with id ', '1', '!'],
        ]);
        assertFragmentResults([expectedData, expectedData]);
      }
      // Update latest rendered data
      environment.commitPayload(newQuery, {
        node: {
          __typename: 'User',
          id: '1',
          // Update name
          name: 'Alice latest update',
          profile_picture: {
            uri: 'uri32',
          },
          username: null,
        },
      });

      expectSchedulerToFlushAndYield([
        'Hey user,',
        'uri32',
        ['with id ', '1', '!'],
      ]);

      assertFragmentResults([
        {
          data: {
            id: '1',
            // Assert name is updated
            name: 'Alice latest update',
            profile_picture: {
              uri: 'uri32',
            },
            ...createFragmentRef('1', newQuery),
          },
        },
      ]);
    });

    it('should NOT update if fragment refs dont change', () => {
      renderSingularFragment();
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      // Force a re-render with the exact same fragment refs
      ReactTestRenderer.act(() => {
        forceSingularUpdate();
      });

      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);
    });

    it('should NOT update even if fragment ref changes but doesnt point to a different ID', () => {
      renderSingularFragment();
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      // Setting a new owner with the same query/variables will cause new
      // fragment refs that point to the same IDs to be passed
      const newOwner = createOperationDescriptor(
        gqlSingularQuery,
        singularVariables,
      );
      ReactTestRenderer.act(() => {
        setSingularOwner(newOwner);
      });

      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);
    });

    it('should throw a promise if if data is missing for fragment and request is in flight', () => {
      const missingDataVariables = {...singularVariables, id: '4'};
      const missingDataQuery = createOperationDescriptor(
        gqlSingularQuery,
        missingDataVariables,
      );
      // Commit a payload with name and profile_picture are missing
      environment.commitPayload(
        createOperationDescriptor(
          gqlSingularMissingDataQuery,
          missingDataVariables,
        ),
        {
          node: {
            __typename: 'User',
            id: '4',
          },
        },
      );

      // Make sure query is in flight
      fetchQuery(environment, missingDataQuery).subscribe({});

      let renderer;
      ReactTestRenderer.act(() => {
        renderer = renderSingularFragment({owner: missingDataQuery});
      });
      invariant(renderer != null, 'Expected renderer to be initialized');
      expect(renderer?.toJSON()).toEqual('Singular Fallback');
    });

    it('should warn if fragment reference is non-null but read-out data is null', () => {
      // Clearing the data in the environment will make it so the fragment ref
      // we pass to useFragmentNode points to data that does not exist; we expect
      // an error to be thrown in this case.
      (environment.getStore().getSource() as $FlowFixMe).clear();

      expectWarningWillFire(
        "Relay: Expected to have been able to read non-null data for fragment `useFragmentNodeTestUserFragment` declared in `TestDisplayName`, since fragment reference was non-null. Make sure that that `TestDisplayName`'s parent isn't holding on to and/or passing a fragment reference for data that has been deleted.",
      );
      renderSingularFragment();
    });

    it('should NOT warn if plural fragment reference is non-null and empty', () => {
      // Commit a paylaod where the nodes are an empty list
      environment.commitPayload(pluralQuery, {
        nodes: [],
      });
      // Pass the updated fragment ref
      const usersRef = (
        environment.lookup(pluralQuery.fragment).data as $FlowFixMe
      ).nodes;
      renderPluralFragment({usersRef});
    });

    it('should warn if plural fragment reference is non-null but read-out data is null', () => {
      // Clearing the data in the environment will make it so the fragment ref
      // we pass to useFragmentNode points to data that does not exist; we expect
      // an error to be thrown in this case.
      (environment.getStore().getSource() as $FlowFixMe).clear();

      expectWarningWillFire(
        "Relay: Expected to have been able to read non-null data for fragment `useFragmentNodeTestUsersFragment` declared in `TestDisplayName`, since fragment reference was non-null. Make sure that that `TestDisplayName`'s parent isn't holding on to and/or passing a fragment reference for data that has been deleted.",
      );

      renderPluralFragment();
    });

    it('should subscribe for updates even if there is missing data', () => {
      const missingDataVariables = {...singularVariables, id: '4'};

      const singularDataQuery = createOperationDescriptor(
        gqlSingularQuery,
        missingDataVariables,
      );

      // Commit a payload where name is missing.
      environment.commitPayload(
        createOperationDescriptor(
          gqlSingularMissingDataQuery,
          missingDataVariables,
        ),
        {
          node: {
            __typename: 'User',
            id: '4',
          },
        },
      );

      renderSingularFragment({owner: singularDataQuery});

      // Assert render output with missing data
      assertFragmentResults([
        {
          data: {
            id: '4',
            name: undefined,
            profile_picture: undefined,
            ...createFragmentRef('4', singularDataQuery),
          },
        },
      ]);

      // Commit a payload with updated name.
      ReactTestRenderer.act(() => {
        environment.commitPayload(singularDataQuery, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark',
            profile_picture: null,
            username: null,
          },
        });
      });

      // Assert render output with updated data
      assertFragmentResults([
        {
          data: {
            id: '4',
            name: 'Mark',
            profile_picture: null,
            ...createFragmentRef('4', singularDataQuery),
          },
        },
      ]);
    });

    it('upon commit, it should pick up changes in data that happened before comitting', () => {
      const Scheduler = require('scheduler');
      const YieldChild = (props: any) => {
        Scheduler.log(props.children);
        return props.children;
      };
      const YieldyUserComponent = ({user}: any) => {
        return (
          <>
            <YieldChild>Hey user,</YieldChild>
            <YieldChild>{user.profile_picture?.uri ?? 'no uri'}</YieldChild>
            <YieldChild>with id {user.id}!</YieldChild>
          </>
        );
      };

      // Assert initial render
      // $FlowFixMe[incompatible-type]
      SingularRenderer = YieldyUserComponent;

      actInternal(() => {
        ReactTestRenderer.create(
          createSingularFragmentElement(),
          // $FlowFixMe[incompatible-type] - error revealed when flow-typing ReactTestRenderer
          {
            unstable_isConcurrent: true,
          },
        );

        // Flush some of the changes, but don't commit
        expectSchedulerToFlushAndYieldThrough([
          'Hey user,',
          'no uri',
          ['with id ', '1', '!'],
        ]);

        // Trigger an update while render is in progress
        environment.commitPayload(singularQuery, {
          node: {
            __typename: 'User',
            id: '1',
            name: 'Alice',
            // Update profile_picture value
            profile_picture: {
              uri: 'uri16',
            },
            username: null,
          },
        });

        // Assert the component renders the updated data
        expectSchedulerToFlushAndYield([
          'Hey user,',
          'uri16',
          ['with id ', '1', '!'],
        ]);
      });

      // We should have observed two commits: one with the original data
      // and one with the updated data:
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: null,
            ...createFragmentRef('1', singularQuery),
          },
        },
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: {
              uri: 'uri16',
            },
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      // Update data again -- we should still be subscribed to further updates
      environment.commitPayload(singularQuery, {
        node: {
          __typename: 'User',
          id: '1',
          // Update name
          name: 'Alice latest update',
          profile_picture: {
            uri: 'uri16',
          },
          username: null,
        },
      });
      expectSchedulerToFlushAndYield([
        'Hey user,',
        'uri16',
        ['with id ', '1', '!'],
      ]);
      assertFragmentResults([
        {
          data: {
            id: '1',
            // Assert name is updated
            name: 'Alice latest update',
            profile_picture: {
              uri: 'uri16',
            },
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);
    });

    it('should not suspend when data goes missing due to store changes after it has committed (starting with no data missing)', () => {
      let renderer;
      ReactTestRenderer.act(() => {
        renderer = renderSingularFragment();
      });
      invariant(renderer != null, 'Expected renderer to be initialized');
      ReactTestRenderer.act(() => {
        // Let there be an operation in flight:
        fetchQuery(environment, singularQuery).subscribe({});
        // And let there be missing data:
        environment.commitUpdate(store => {
          store.get('1')?.setValue(undefined, 'name');
        });
      });
      // Nonetheless, once the component has mounted, it only suspends if the fragment ref changes,
      // not because of data being deleted from the store:
      expect(renderer?.toJSON()).toEqual(null); // null means it rendered successfully and didn't suspend
    });

    it('should not suspend when data goes missing due to store changes after it has committed (starting with data missing already)', () => {
      const missingDataVariables = {...pluralVariables, ids: ['4']};
      const missingDataQuery = createOperationDescriptor(
        gqlPluralQuery,
        missingDataVariables,
      );
      environment.commitPayload(
        createOperationDescriptor(
          gqlPluralMissingDataQuery,
          missingDataVariables,
        ),
        {
          nodes: [
            {
              __typename: 'User',
              id: '4',
            },
          ],
        },
      );

      let renderer;
      ReactTestRenderer.act(() => {
        renderer = renderPluralFragment({owner: missingDataQuery});
      });
      invariant(renderer != null, 'Expected renderer to be initialized');

      ReactTestRenderer.act(() => {
        // Let there be an operation in flight:
        fetchQuery(environment, missingDataQuery).subscribe({});
        // And let there be missing data:
        environment.commitUpdate(store => {
          store.get('4')?.setValue(undefined, 'name');
        });
      });
      // Nonetheless, once the component has mounted, it only suspends if the fragment ref changes,
      // not because of data being deleted from the store:
      expect(renderer?.toJSON()).toEqual(null); // null means it rendered successfully and didn't suspend
    });

    it('checks for missed updates, subscribing to the latest snapshot even if fragment data is unchanged', () => {
      // Render the component, updating the store to simulate concurrent modifications during async render
      let pendingUpdate: any = null;
      const SideEffectfulComponent = ({user}: any) => {
        if (pendingUpdate) {
          environment.commitUpdate(pendingUpdate);
          pendingUpdate = null;
        }
        return user.id;
      };
      SingularRenderer = SideEffectfulComponent;

      // Render with profile_picture initially set to the default client record, with null uri
      environment.commitPayload(singularQuery, {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Alice',
          profile_picture: {
            uri: null,
          },
          username: null,
        },
      });
      // But during render, update profile_picture to point to a different image, also with a
      // null uri. The fragment result does not change, but the set of ids to subscribe to changes
      pendingUpdate = (store: RecordSourceProxy) => {
        const userRecord = store.get('1');
        const picture = store.create('profile_picture_id', 'Image');
        picture.setValue(null, 'uri');
        userRecord?.setLinkedRecord(picture, 'profile_picture', {
          scale: singularVariables.scale,
        });
      };
      ReactTestRenderer.act(() => {
        renderSingularFragment();
        jest.runAllTimers();
      });
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: {
              uri: null,
            },
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);

      // Now update the new profile picture to set its uri to confirm that the component is
      // correctly subscribed to the changed profile picture relationship in the graph.
      ReactTestRenderer.act(() => {
        environment.commitUpdate((store: RecordSourceProxy) => {
          const picture = store.get('profile_picture_id');
          picture?.setValue('uri16', 'uri');
        });
        jest.runAllTimers();
      });
      assertFragmentResults([
        {
          data: {
            id: '1',
            name: 'Alice',
            profile_picture: {
              uri: 'uri16', // updated from previous null value
            },
            ...createFragmentRef('1', singularQuery),
          },
        },
      ]);
    });

    it('should subscribe for updates to plural fragments even if there is missing data', () => {
      const missingDataVariables = {...pluralVariables, ids: ['4']};
      const missingDataQuery = createOperationDescriptor(
        gqlPluralQuery,
        missingDataVariables,
      );

      // Commit a payload where name is missing.
      environment.commitPayload(
        createOperationDescriptor(
          gqlPluralMissingDataQuery,
          missingDataVariables,
        ),
        {
          nodes: [
            {
              __typename: 'User',
              id: '4',
            },
          ],
        },
      );

      renderPluralFragment({owner: missingDataQuery});

      // Assert render output with missing data
      assertFragmentResults([
        {
          data: [
            {
              id: '4',
              name: undefined,
              profile_picture: undefined,
              ...createFragmentRef('4', missingDataQuery),
            },
          ],
        },
      ]);

      // Commit a payload with updated name.
      ReactTestRenderer.act(() => {
        environment.commitPayload(missingDataQuery, {
          nodes: [
            {
              __typename: 'User',
              id: '4',
              name: 'Mark',
              profile_picture: null,
              username: null,
            },
          ],
        });
      });

      // Assert render output with updated data
      assertFragmentResults([
        {
          data: [
            {
              id: '4',
              name: 'Mark',
              profile_picture: null,
              ...createFragmentRef('4', missingDataQuery),
            },
          ],
        },
      ]);
    });

    if (useFragmentNodeOriginal === useFragmentNode_LEGACY) {
      describe('disableStoreUpdates', () => {
        it('does not listen to store updates after disableStoreUpdates is called', () => {
          ReactTestRenderer.act(() => {
            renderSingularFragment();
          });
          assertFragmentResults([
            {
              data: {
                id: '1',
                name: 'Alice',
                profile_picture: null,
                ...createFragmentRef('1', singularQuery),
              },
            },
          ]);

          disableStoreUpdates();

          // Update data in the store
          ReactTestRenderer.act(() =>
            environment.commitPayload(singularQuery, {
              node: {
                __typename: 'User',
                id: '1',
                name: 'Alice updated',
                profile_picture: null,
                username: null,
              },
            }),
          );

          // Assert that component did not re-render
          ReactTestRenderer.act(() => {
            jest.runAllImmediates();
          });
          expect(commitSpy).toBeCalledTimes(0);
        });

        it('re-renders with latest data after re-enabling updates, if any updates were missed', () => {
          renderSingularFragment();
          assertFragmentResults([
            {
              data: {
                id: '1',
                name: 'Alice',
                profile_picture: null,
                ...createFragmentRef('1', singularQuery),
              },
            },
          ]);

          disableStoreUpdates();

          // Update data in the store
          environment.commitPayload(singularQuery, {
            node: {
              __typename: 'User',
              id: '1',
              name: 'Alice updated',
              profile_picture: null,
              username: null,
            },
          });

          // Assert that component did not re-render while updates are disabled
          ReactTestRenderer.act(() => {
            jest.runAllImmediates();
          });
          expect(commitSpy).toBeCalledTimes(0);

          ReactTestRenderer.act(() => {
            enableStoreUpdates();
          });

          // Assert that component re-renders with latest updated data
          assertFragmentResults([
            {
              data: {
                id: '1',
                name: 'Alice updated',
                profile_picture: null,
                ...createFragmentRef('1', singularQuery),
              },
            },
          ]);
        });

        it('does not re-render after re-enabling updates, if no updates were missed', () => {
          renderSingularFragment();
          assertFragmentResults([
            {
              data: {
                id: '1',
                name: 'Alice',
                profile_picture: null,
                ...createFragmentRef('1', singularQuery),
              },
            },
          ]);

          disableStoreUpdates();
          expect(commitSpy).toBeCalledTimes(0);

          enableStoreUpdates();

          // Assert that component did not re-render after enabling updates
          ReactTestRenderer.act(() => jest.runAllImmediates());

          expect(commitSpy).toBeCalledTimes(0);
        });

        it('does not re-render after re-enabling updates, if data did not change', () => {
          renderSingularFragment();
          assertFragmentResults([
            {
              data: {
                id: '1',
                name: 'Alice',
                profile_picture: null,
                ...createFragmentRef('1', singularQuery),
              },
            },
          ]);

          disableStoreUpdates();

          environment.commitPayload(singularQuery, {
            node: {
              __typename: 'User',
              id: '1',
              name: 'Alice',
              profile_picture: null,
              username: null,
            },
          });
          ReactTestRenderer.act(() => jest.runAllImmediates());
          expect(commitSpy).toBeCalledTimes(0);

          enableStoreUpdates();

          // Assert that component did not re-render after enabling updates
          ReactTestRenderer.act(() => jest.runAllImmediates());

          expect(commitSpy).toBeCalledTimes(0);
        });
      });
    }
  },
);
