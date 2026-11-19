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

import type {RelayMockEnvironment} from '../../../relay-test-utils/RelayModernMockEnvironment';
import type {
  OperationDescriptor,
  SelectorData,
} from 'relay-runtime/store/RelayStoreTypes';

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useLazyLoadQueryNode = require('../useLazyLoadQueryNode');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const {
  __internal: {fetchQuery},
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');

async function expectToBeRendered(
  renderFn: JestMockFn<Array<unknown>, any & React.Node>,
  readyState: ?SelectorData,
) {
  // Ensure useEffect is called before other timers
  await act(() => {
    jest.runAllImmediates();
  });
  expect(renderFn).toBeCalledTimes(1);
  expect(renderFn.mock.calls[0][0]).toEqual(readyState);
  renderFn.mockClear();
}

function expectToHaveFetched(
  environment: RelayMockEnvironment,
  query: OperationDescriptor,
  cacheConfig: {
    force?: ?boolean,
    liveConfigId?: ?string,
    metadata?: {[key: string]: unknown},
    onSubscribe?: () => void,
    onResume?: (pauseTimeMs: number) => void,
    onPause?: (mqttConnectionIsOk: boolean, internetIsOk: boolean) => void,
    poll?: ?number,
    transactionId?: ?string,
  },
) {
  expect(environment.execute).toBeCalledTimes(1);
  expect(environment.execute.mock.calls[0][0].operation).toMatchObject({
    fragment: expect.anything(),
    root: expect.anything(),
    request: {
      node: query.request.node,
      variables: query.request.variables,
    },
  });
  expect(
    environment.mock.isLoading(
      query.request.node,
      query.request.variables,
      cacheConfig,
    ),
  ).toEqual(true);
}

describe('useLazyLoadQueryNode-fast-refresh', () => {
  let environment;
  let gqlQuery;
  let renderFn;
  let query;
  let variables;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'warn').mockImplementationOnce(() => {});

    environment = createMockEnvironment();

    graphql`
      fragment useLazyLoadQueryNodeFastRefreshTestUserFragment on User {
        name
      }
    `;
    gqlQuery = graphql`
      query useLazyLoadQueryNodeFastRefreshTestUserQuery($id: ID) {
        node(id: $id) {
          id
          name
          ...useLazyLoadQueryNodeFastRefreshTestUserFragment
            @dangerously_unaliased_fixme
        }
      }
    `;
    variables = {id: '1'};
    query = createOperationDescriptor(gqlQuery, variables);
    // $FlowFixMe[incompatible-use]
    renderFn = jest.fn((result: unknown) => result?.node?.name ?? 'Empty');
  });

  afterEach(() => {
    environment.mockClear();
    jest.clearAllTimers();
  });

  it('force a refetch in fast refresh', async () => {
    // $FlowFixMe[cannot-resolve-module] (site=www)
    const ReactRefreshRuntime = require('react-refresh/runtime');
    ReactRefreshRuntime.injectIntoGlobalHook(global);
    const V1 = function (props: {variables: {id: string}}) {
      const _query = createOperationDescriptor(gqlQuery, props.variables);
      const result = useLazyLoadQueryNode<any>({
        query: _query,
        fetchPolicy: 'network-only',
        fetchObservable: fetchQuery(environment, _query),
        componentDisplayName: 'TestDisplayName',
      });
      return renderFn(result);
    };
    ReactRefreshRuntime.register(V1, 'Renderer');

    let instance;
    await act(() => {
      instance = ReactTestingLibrary.render(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Fallback">
            <V1 variables={variables} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });

    expect(instance?.container.textContent).toEqual('Fallback');
    expectToHaveFetched(environment, query, {});
    expect(renderFn).not.toBeCalled();
    expect(environment.retain).toHaveBeenCalledTimes(1);

    await act(() =>
      environment.mock.resolve(gqlQuery, {
        data: {
          node: {
            __typename: 'User',
            id: variables.id,
            name: 'Alice',
          },
        },
      }),
    );

    const data = environment.lookup(query.fragment).data;
    // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
    // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
    await expectToBeRendered(renderFn, data);

    environment.execute.mockClear();
    renderFn.mockClear();
    function V2(props: any) {
      const _query = createOperationDescriptor(gqlQuery, props.variables);
      const result = useLazyLoadQueryNode<any>({
        query: _query,
        fetchObservable: fetchQuery(environment, _query),
        fetchPolicy: 'network-only',
        componentDisplayName: 'TestDisplayName',
      });
      return renderFn(result);
    }
    // Trigger a fast fresh
    ReactRefreshRuntime.register(V2, 'Renderer');
    await act(() => {
      ReactRefreshRuntime.performReactRefresh();
    });
    // It should start a new fetch in fast refresh
    expectToHaveFetched(environment, query, {});
    expect(renderFn).toBeCalledTimes(1);
    expect(instance?.container.textContent).toEqual('Fallback');
    // It should render with the result of the new fetch
    await act(() =>
      environment.mock.resolve(gqlQuery, {
        data: {
          node: {
            __typename: 'User',
            id: variables.id,
            name: 'Bob',
          },
        },
      }),
    );
    expect(instance?.container.textContent).toEqual('Bob');
  });
});
