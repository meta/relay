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
import type {ReaderFragment} from '../../../relay-runtime/util/ReaderNode';
import type {RequestDescriptor} from 'relay-runtime/store/RelayStoreTypes';

const useFragmentNodeOriginal = require('../legacy/useFragmentNode');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const ReactRelayContext = require('react-relay/ReactRelayContext');
const {
  FRAGMENT_OWNER_KEY,
  FRAGMENTS_KEY,
  ID_KEY,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');
const warning = require('warning');

let environment;
let singularQuery;
let renderSingularFragment;
let renderSpy;

hook useFragmentNode(
  fragmentNode: ReaderFragment,
  fragmentRef: Readonly<{
    __fragmentOwner: RequestDescriptor,
    __fragments: Readonly<{
      useFragmentNodeRequiredTestUserFragment: Readonly<{...}>,
    }>,
    __id: any,
  }>,
) {
  const result = useFragmentNodeOriginal<any>(
    fragmentNode,
    fragmentRef,
    'TestDisplayName',
  );
  renderSpy(result);
  return result;
}

beforeEach(() => {
  // Set up mocks
  jest.resetModules();
  jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
  jest.mock('warning');
  renderSpy = jest.fn<_, unknown>();

  // Set up environment and base data
  environment = createMockEnvironment();

  const singularVariables = {id: '1'};
  const gqlSingularQuery = graphql`
    query useFragmentNodeRequiredTestUserQuery($id: ID!) {
      node(id: $id) {
        ...useFragmentNodeRequiredTestUserFragment @dangerously_unaliased_fixme
      }
    }
  `;
  const gqlSingularFragment = graphql`
    fragment useFragmentNodeRequiredTestUserFragment on User {
      id
      name @required(action: NONE)
    }
  `;
  singularQuery = createOperationDescriptor(
    gqlSingularQuery,
    singularVariables,
  );
  environment.commitPayload(singularQuery, {
    node: {
      __typename: 'User',
      id: '1',
      name: 'Alice',
    },
  });

  const ContextProvider = ({
    children,
  }: any | Readonly<{children: React.Node}>) => {
    return (
      <ReactRelayContext.Provider value={{environment}}>
        {children}
      </ReactRelayContext.Provider>
    );
  };

  const SingularContainer = () => {
    // We need a render a component to run a Hook
    const userRef = {
      [ID_KEY]: singularQuery.request.variables.id,
      [FRAGMENTS_KEY]: {
        useFragmentNodeRequiredTestUserFragment: {},
      },
      [FRAGMENT_OWNER_KEY]: singularQuery.request,
    };

    useFragmentNode(gqlSingularFragment, userRef);
    return null;
  };

  renderSingularFragment = () => {
    return ReactTestingLibrary.render(
      <ContextProvider>
        <SingularContainer />
      </ContextProvider>,
    );
  };
});

afterEach(() => {
  environment.mockClear();
  renderSpy.mockClear();
  // $FlowFixMe[prop-missing]
  warning.mockClear();
});

it('should render singular fragment without error when data is available', async () => {
  // $FlowFixMe[prop-missing]
  warning.mockClear();
  await act(() => {
    renderSingularFragment();
  });
  expect(renderSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      data: {
        id: '1',
        name: 'Alice',
      },
    }),
  );
  expect(warning).not.toHaveBeenCalled();
});

it('should not warn on missing record when null bubbles to fragment root', async () => {
  environment.commitPayload(singularQuery, {
    node: {
      __typename: 'User',
      id: '1',
      name: null,
    },
  });

  // commitPayload triggers some warnings, ignore those for the purposes of this test.
  // $FlowFixMe[prop-missing]
  warning.mockClear();

  await act(() => {
    renderSingularFragment();
  });
  expect(renderSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      data: null,
    }),
  );
  expect(warning).not.toHaveBeenCalled();
});
