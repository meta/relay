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
  useFragmentTestUserFragment$data,
  useFragmentTestUserFragment$fragmentType,
} from './__generated__/useFragmentTestUserFragment.graphql';
import type {
  useFragmentTestUsersFragment$data,
  useFragmentTestUsersFragment$fragmentType,
} from './__generated__/useFragmentTestUsersFragment.graphql';
import type {RelayContext} from 'relay-runtime';
import type {OperationDescriptor} from 'relay-runtime/store/RelayStoreTypes';
import type {Fragment} from 'relay-runtime/util/RelayRuntimeTypes';

const useFragmentImpl = require('../useFragment');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const ReactRelayContext = require('react-relay/ReactRelayContext');
const {
  FRAGMENT_OWNER_KEY,
  FRAGMENTS_KEY,
  ID_KEY,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const RelayFeatureFlags = require('relay-runtime/util/RelayFeatureFlags');
const {createMockEnvironment} = require('relay-test-utils');
const {
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

let environment;
let gqlSingularQuery;
let gqlSingularFragment;
let gqlPluralQuery;
let gqlPluralFragment;
let singularQuery;
let pluralQuery;
let singularVariables;
let pluralVariables;
let renderSingularFragment;
let renderPluralFragment;
let renderSpy;
let SingularRenderer;
let PluralRenderer;
let ContextProvider;
let setEnvironment;

hook useFragment(
  fragmentNode:
    | Fragment<
        useFragmentTestUserFragment$fragmentType,
        useFragmentTestUserFragment$data,
      >
    | Fragment<
        useFragmentTestUsersFragment$fragmentType,
        useFragmentTestUsersFragment$data,
      >,
  fragmentRef: any,
) {
  // $FlowFixMe[incompatible-type]
  const data = useFragmentImpl(fragmentNode, fragmentRef);
  renderSpy(data);
  return data;
}

function assertFragmentResults(expected: any) {
  // This ensures that useEffect runs
  jest.runAllImmediates();
  const actualData = renderSpy.mock.calls[0][0];
  expect(actualData).toEqual(expected);
  renderSpy.mockClear();
}

function createFragmentRef(id: string, owner: OperationDescriptor) {
  return {
    [ID_KEY]: id,
    [FRAGMENTS_KEY]: {
      useFragmentTestNestedUserFragment: {},
    },
    [FRAGMENT_OWNER_KEY]: owner.request,
  };
}

describe.each([
  ['Experimental', true],
  ['Current', false],
])('useFragment (%s)', (name, ENABLE_ACTIVITY_COMPATIBILITY) => {
  beforeEach(() => {
    RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY =
      ENABLE_ACTIVITY_COMPATIBILITY;

    renderSpy = jest.fn<
      [useFragmentTestUserFragment$data | useFragmentTestUsersFragment$data],
      unknown,
    >();

    // Set up environment and base data
    environment = createMockEnvironment();
    graphql`
      fragment useFragmentTestNestedUserFragment on User {
        username
      }
    `;
    singularVariables = {id: '1'};
    pluralVariables = {ids: ['1', '2']};
    gqlSingularQuery = graphql`
      query useFragmentTestUserQuery($id: ID!) {
        node(id: $id) {
          ...useFragmentTestUserFragment @dangerously_unaliased_fixme
        }
      }
    `;
    gqlSingularFragment = graphql`
      fragment useFragmentTestUserFragment on User {
        id
        name
        ...useFragmentTestNestedUserFragment
      }
    `;
    gqlPluralQuery = graphql`
      query useFragmentTestUsersQuery($ids: [ID!]!) {
        nodes(ids: $ids) {
          ...useFragmentTestUsersFragment
        }
      }
    `;
    gqlPluralFragment = graphql`
      fragment useFragmentTestUsersFragment on User @relay(plural: true) {
        id
        name
        ...useFragmentTestNestedUserFragment
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
        username: 'useralice',
      },
    });
    environment.commitPayload(pluralQuery, {
      nodes: [
        {
          __typename: 'User',
          id: '1',
          name: 'Alice',
          username: 'useralice',
          profile_picture: null,
        },
        {
          __typename: 'User',
          id: '2',
          name: 'Bob',
          username: 'userbob',
          profile_picture: null,
        },
      ],
    });

    // Set up renderers
    SingularRenderer = (props: {
      user: ?(
        useFragmentTestUserFragment$data | useFragmentTestUsersFragment$data
      ),
    }) => null;
    PluralRenderer = (props: {
      users: ?(
        useFragmentTestUserFragment$data | useFragmentTestUsersFragment$data
      ),
    }) => null;
    const SingularContainer = (props: {
      userRef?: {$data?: {...}, ...},
      owner: $FlowFixMe,
      ...
    }) => {
      // We need a render a component to run a Hook
      const owner = props.owner;
      const userRef = props.hasOwnProperty('userRef')
        ? props.userRef
        : {
            [ID_KEY]: owner.request.variables.id,
            [FRAGMENTS_KEY]: {
              useFragmentTestUserFragment: {},
            },
            [FRAGMENT_OWNER_KEY]: owner.request,
          };
      const userData = useFragment(gqlSingularFragment, userRef);
      return <SingularRenderer user={userData} />;
    };

    const PluralContainer = (props: {
      usersRef?: ReadonlyArray<{$data?: {...}, ...}>,
      owner: $FlowFixMe,
      ...
    }) => {
      const owner = props.owner;
      const usersRef = props.hasOwnProperty('usersRef')
        ? props.usersRef
        : owner.request.variables.ids.map(id => ({
            [ID_KEY]: id,
            [FRAGMENTS_KEY]: {
              useFragmentTestUsersFragment: {},
            },
            [FRAGMENT_OWNER_KEY]: owner.request,
          }));

      const usersData = useFragment(gqlPluralFragment, usersRef);
      return <PluralRenderer users={usersData} />;
    };

    component TestContextProvider(children: React.Node) {
      const [env, _setEnv] = React.useState(environment);
      const relayContext = React.useMemo(
        (): RelayContext => ({environment: env}),
        [env],
      );

      setEnvironment = _setEnv;
      return (
        <ReactRelayContext.Provider value={relayContext}>
          {children}
        </ReactRelayContext.Provider>
      );
    }
    ContextProvider = TestContextProvider;

    renderSingularFragment = (
      props?: {
        owner?: $FlowFixMe,
        userRef?: $FlowFixMe,
        ...
      },
      rerender: $FlowFixMe,
    ) => {
      const elements = (
        <React.Suspense fallback="Singular Fallback">
          <ContextProvider>
            <SingularContainer owner={singularQuery} {...props} />
          </ContextProvider>
        </React.Suspense>
      );
      if (rerender) {
        return rerender(elements);
      } else {
        return ReactTestingLibrary.render(elements);
      }
    };

    renderPluralFragment = (
      props?: {
        owner?: $FlowFixMe,
        userRef?: $FlowFixMe,
        ...
      },
      rerender: $FlowFixMe,
    ) => {
      const elements = (
        <React.Suspense fallback="Plural Fallback">
          <ContextProvider>
            <PluralContainer owner={pluralQuery} {...props} />
          </ContextProvider>
        </React.Suspense>
      );
      if (rerender) {
        return rerender(elements);
      } else {
        return ReactTestingLibrary.render(elements);
      }
    };
  });

  afterEach(() => {
    environment.mockClear();
    renderSpy.mockClear();
    RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = false;
  });

  it('handles environnment changes', () => {
    renderSingularFragment();
    assertFragmentResults({
      id: '1',
      name: 'Alice',
      ...createFragmentRef('1', singularQuery),
    });

    const newEnvironment = createMockEnvironment();
    newEnvironment.commitPayload(singularQuery, {
      node: {
        __typename: 'User',
        id: '1',
        name: 'Alice in a different env',
        username: null,
      },
    });

    ReactTestingLibrary.act(() => {
      setEnvironment(newEnvironment);
    });

    assertFragmentResults({
      id: '1',
      name: 'Alice in a different env',
      ...createFragmentRef('1', singularQuery),
    });

    ReactTestingLibrary.act(() => {
      newEnvironment.commitPayload(singularQuery, {
        node: {
          __typename: 'User',
          id: '1',
          // Update name
          name: 'Alice in Wonderland',
          username: null,
        },
      });
    });
    assertFragmentResults({
      id: '1',
      // Assert that name is updated
      name: 'Alice in Wonderland',
      ...createFragmentRef('1', singularQuery),
    });
  });

  it('should render singular fragment without error when data is available', () => {
    renderSingularFragment();
    assertFragmentResults({
      id: '1',
      name: 'Alice',
      ...createFragmentRef('1', singularQuery),
    });
  });

  it('should return the same data object if rendered multiple times: singular fragment', () => {
    const result = renderSingularFragment();
    expect(renderSpy).toBeCalledTimes(1);
    const actualData = renderSpy.mock.calls[0][0];
    renderSingularFragment({}, result.rerender);
    expect(renderSpy).toBeCalledTimes(2);
    const actualData2 = renderSpy.mock.calls[1][0];
    expect(actualData).toEqual(actualData2);
  });

  it('should render plural fragment without error when data is available', () => {
    renderPluralFragment();
    assertFragmentResults([
      {
        id: '1',
        name: 'Alice',
        ...createFragmentRef('1', pluralQuery),
      },
      {
        id: '2',
        name: 'Bob',
        ...createFragmentRef('2', pluralQuery),
      },
    ]);
  });

  it('should return the same data object if rendered multiple times: plural fragment', () => {
    const result = renderPluralFragment();
    expect(renderSpy).toBeCalledTimes(1);
    const actualData = renderSpy.mock.calls[0][0];
    renderPluralFragment({}, result?.rerender);
    expect(renderSpy).toBeCalledTimes(2);
    const actualData2 = renderSpy.mock.calls[1][0];
    expect(actualData).toEqual(actualData2);
  });

  it('Returns [] when the fragment ref is [] (for plural fragments)', () => {
    const container = renderPluralFragment({usersRef: []});
    assertFragmentResults([]);
    ReactTestingLibrary.act(() => {
      container?.unmount();
    });
  });

  it('Returns null when the fragment ref is null (for plural fragments)', () => {
    const container = renderPluralFragment({usersRef: null});
    assertFragmentResults(null);
    ReactTestingLibrary.act(() => {
      container?.unmount();
    });
  });
});
