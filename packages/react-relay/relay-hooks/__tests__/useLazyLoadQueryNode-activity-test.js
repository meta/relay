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
  useLazyLoadQueryNodeActivityTestUserQuery$data,
  useLazyLoadQueryNodeActivityTestUserQuery$variables,
} from './__generated__/useLazyLoadQueryNodeActivityTestUserQuery.graphql';
import type {FetchPolicy, LogEvent} from 'relay-runtime';
import type {
  OperationDescriptor,
  SelectorData,
} from 'relay-runtime/store/RelayStoreTypes';
import type {Query} from 'relay-runtime/util/RelayRuntimeTypes';

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useLazyLoadQueryNode = require('../useLazyLoadQueryNode');
const ReactTestingLibrary = require('@testing-library/react');
const {cleanup} = require('@testing-library/react');
const invariant = require('invariant');
const React = require('react');
const {
  __internal,
  RecordSource,
  RelayFeatureFlags,
  ROOT_ID,
  ROOT_TYPE,
  Store,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');
// $FlowFixMe[missing-export] Not yet exists in the Flow types in OSS
const Activity = React.unstable_Activity;

const defaultFetchPolicy = 'network-only';

function expectToBeRendered(
  renderFn: JestMockFn<any, any>,
  readyState: ?SelectorData,
) {
  // Ensure useEffect is called before other timers
  ReactTestingLibrary.act(() => {
    jest.runAllImmediates();
  });
  expect(renderFn).toBeCalledTimes(1);
  expect(renderFn.mock.calls[0][0]).toEqual(readyState);
  renderFn.mockClear();
}

function expectToHaveFetched(
  environment: RelayMockEnvironment,
  query: OperationDescriptor,
) {
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.execute).toBeCalledTimes(1);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.execute.mock.calls[0][0].operation).toMatchObject({
    fragment: expect.anything(),
    root: expect.anything(),
    request: {
      node: query.request.node,
      variables: query.request.variables,
    },
  });
  expect(
    environment.mock.isLoading(query.request.node, query.request.variables),
  ).toEqual(true);
}

type Props = {
  variables: {...},
  fetchPolicy?: FetchPolicy,
  extraData?: number,
};

let environment;
let gqlQuery: Query<
  useLazyLoadQueryNodeActivityTestUserQuery$variables,
  useLazyLoadQueryNodeActivityTestUserQuery$data,
>;
let renderFn;
let render;
let release;
let query;
let variables;
let Container;
let logs: Array<LogEvent>;
let errorBoundaryDidCatchFn;
let setMode;
let _setProps;

beforeEach(() => {
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = true;

  errorBoundaryDidCatchFn = jest.fn<[Error], unknown>();

  class ErrorBoundary extends React.Component<any, any> {
    state: any | {error: null} = {error: null};
    componentDidCatch(error: Error) {
      errorBoundaryDidCatchFn(error);
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

  const Renderer = (props: Props) => {
    const _query = createOperationDescriptor(gqlQuery, props.variables);
    const data = useLazyLoadQueryNode<any>({
      query: _query,
      fetchObservable: __internal.fetchQuery(environment, _query),
      fetchPolicy: props.fetchPolicy || defaultFetchPolicy,
      componentDisplayName: 'TestDisplayName',
    });
    return renderFn(data);
  };

  Container = function TestContainer(props: Props) {
    const [mode, _setMode] = React.useState('visible');
    setMode = _setMode;
    const [nextProps, setNextProps] = React.useState(props);
    _setProps = setNextProps;
    return (
      //$FlowFixMe[incompatible-type]
      //$FlowFixMe[not-a-component]
      <Activity mode={mode}>
        <Renderer {...nextProps} />
      </Activity>
    );
  };

  render = async (env: RelayMockEnvironment, children: React.Node) => {
    let instance;
    await ReactTestingLibrary.act(() => {
      instance = ReactTestingLibrary.render(
        <RelayEnvironmentProvider environment={env}>
          <ErrorBoundary
            fallback={({error}) =>
              `Error: ${error.message + ': ' + error.stack}`
            }>
            <React.Suspense fallback="Fallback">{children}</React.Suspense>
          </ErrorBoundary>
        </RelayEnvironmentProvider>,
      );
    });
    invariant(instance != null, 'Expected component to render');
    return instance;
  };

  logs = [];
  environment = createMockEnvironment({
    log: event => {
      logs.push(event);
    },
    store: new Store(new RecordSource(), {gcReleaseBufferSize: 0}),
  });
  release = jest.fn<[unknown], unknown>();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  const originalRetain = environment.retain.bind(environment);
  // $FlowFixMe[cannot-write]
  environment.retain = jest.fn((...args) => {
    const originalDisposable = originalRetain(...args);
    return {
      dispose: () => {
        // $FlowFixMe[prop-missing]
        release(args[0].variables);
        originalDisposable.dispose();
      },
    };
  });

  gqlQuery = graphql`
    query useLazyLoadQueryNodeActivityTestUserQuery($id: ID) {
      node(id: $id) {
        id
        name
        ...useLazyLoadQueryNodeActivityTestUserFragment
          @dangerously_unaliased_fixme
      }
    }
  `;
  graphql`
    fragment useLazyLoadQueryNodeActivityTestUserFragment on User {
      name
    }
  `;

  variables = {id: '1'};
  query = createOperationDescriptor(gqlQuery, variables);
  renderFn = jest.fn((result: any) => result?.node?.name ?? 'Empty');
});

afterEach(() => {
  cleanup();
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = false;
});

it('fetches and renders the query data', async () => {
  const instance = await render(
    environment,
    <Container variables={variables} />,
  );

  expect(instance?.asFragment().textContent).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);

  await ReactTestingLibrary.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: variables.id,
          name: 'Alice',
        },
      },
    });
  });

  const data = environment.lookup(query.fragment).data;
  expectToBeRendered(renderFn, data);
});

it('does not dispose and GC the query when hiding within store TTL', async () => {
  const queryCacheExpirationTime = 1000;
  const source = new RecordSource();
  const store = new Store(source, {
    gcScheduler: run => run(),
    gcReleaseBufferSize: 0,
    shouldRetainWithinTTL_EXPERIMENTAL: true,
    queryCacheExpirationTime,
  });
  jest.spyOn(store, 'scheduleGC');
  const currentTime = Date.now();
  jest.spyOn(global.Date, 'now').mockImplementation(() => currentTime);
  environment = createMockEnvironment({
    store,
  });
  // Render the component
  const instance = await render(
    environment,
    <Container variables={variables} />,
  );

  expect(instance?.asFragment().textContent).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();
  renderFn.mockClear();

  await ReactTestingLibrary.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Bob',
        },
      },
    });
  });

  const data = environment.lookup(query.fragment).data;
  expectToBeRendered(renderFn, data);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  renderFn.mockClear();

  ReactTestingLibrary.act(() => {
    setMode('hidden');
  });

  // Assert that GC doesn't run since the query doesn't
  // incorrectly get fully released (which would trigger GC)
  expect(store.scheduleGC).toHaveBeenCalledTimes(1);
  expect(source.toJSON()).toEqual({
    '1': {
      __id: '1',
      __typename: 'User',
      id: '1',
      name: 'Bob',
    },
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
      'node(id:"1")': {
        __ref: '1',
      },
    },
  });

  ReactTestingLibrary.act(() => {
    setMode('visible');
  });

  expect(source.toJSON()).toEqual({
    '1': {
      __id: '1',
      __typename: 'User',
      id: '1',
      name: 'Bob',
    },
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
      'node(id:"1")': {
        __ref: '1',
      },
    },
  });
});

it('disposes and GCs the query when hiding past query TTL in the store', async () => {
  const queryCacheExpirationTime = 1000;
  const source = new RecordSource();
  const store = new Store(source, {
    gcScheduler: run => run(),
    gcReleaseBufferSize: 0,
    shouldRetainWithinTTL_EXPERIMENTAL: true,
    queryCacheExpirationTime,
  });
  jest.spyOn(store, 'scheduleGC');
  let currentTime = Date.now();
  jest.spyOn(global.Date, 'now').mockImplementation(() => currentTime);
  environment = createMockEnvironment({
    store,
  });
  // Render the component
  const instance = await render(
    environment,
    <Container variables={variables} />,
  );

  expect(instance?.asFragment().textContent).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();
  renderFn.mockClear();

  await ReactTestingLibrary.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Bob',
        },
      },
    });
  });

  const data = environment.lookup(query.fragment).data;
  expectToBeRendered(renderFn, data);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  renderFn.mockClear();

  currentTime += queryCacheExpirationTime;
  ReactTestingLibrary.act(() => {
    setMode('hidden');
  });

  expect(store.scheduleGC).toHaveBeenCalledTimes(1);
  expect(source.toJSON()).toEqual({
    [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE},
  });

  ReactTestingLibrary.act(() => {
    setMode('visible');
  });

  expect(source.toJSON()).toEqual({
    [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE},
  });
});

it('does not dispose the temporary retain when hiding before committing', async () => {
  const instance = ReactTestingLibrary.render(
    <RelayEnvironmentProvider environment={environment}>
      <React.Suspense fallback="Fallback">
        <Container variables={variables} />
      </React.Suspense>
    </RelayEnvironmentProvider>,
  );

  expect(instance.asFragment().textContent).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();
  renderFn.mockClear();

  await ReactTestingLibrary.act(() => {
    setMode('hidden');
  });

  expect(release).toHaveBeenCalledTimes(0);

  await ReactTestingLibrary.act(() => {
    ReactTestingLibrary.act(() => {
      setMode('visible');
    });
  });
  expect(renderFn).not.toBeCalled();

  await ReactTestingLibrary.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Bob',
        },
      },
    });
  });

  const data = environment.lookup(query.fragment).data;
  expectToBeRendered(renderFn, data);
});

it.each([
  ['network-only', 0],
  ['store-and-network', 0],
  ['store-and-network', 10],
])(
  'reuses the query prepared by a hidden render when revealed (%s, release buffer %s)',
  async (fetchPolicy, gcReleaseBufferSize) => {
    environment = createMockEnvironment({
      store: new Store(new RecordSource(), {gcReleaseBufferSize}),
    });
    const instance = await render(
      environment,
      <Container variables={variables} fetchPolicy={fetchPolicy} />,
    );
    await ReactTestingLibrary.act(() => {
      environment.mock.resolve(gqlQuery, {
        data: {node: {__typename: 'User', id: '1', name: 'Alice'}},
      });
    });
    expect(instance.asFragment().textContent).toEqual('Alice');
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    environment.execute.mockClear();

    await ReactTestingLibrary.act(() => setMode('hidden'));
    // A context or prop change renders the hidden tree, which prepares the
    // query again and starts a request.
    await ReactTestingLibrary.act(() =>
      _setProps({variables, fetchPolicy, extraData: 1}),
    );
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    expect(environment.execute).toHaveBeenCalledTimes(1);
    await ReactTestingLibrary.act(() => {
      environment.mock.resolve(gqlQuery, {
        data: {node: {__typename: 'User', id: '1', name: 'Bob'}},
      });
    });

    await ReactTestingLibrary.act(() => setMode('visible'));
    expect(instance.asFragment().textContent).toEqual('Bob');
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    expect(environment.execute).toHaveBeenCalledTimes(1);
  },
);
