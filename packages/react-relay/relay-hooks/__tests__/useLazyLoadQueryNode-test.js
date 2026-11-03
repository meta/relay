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

import type {LogEvent} from '../../../relay-runtime/store/RelayStoreTypes';
import type {RelayMockEnvironment} from '../../../relay-test-utils/RelayModernMockEnvironment';
import type {
  useLazyLoadQueryNodeTest1Query$data,
  useLazyLoadQueryNodeTest1Query$variables,
} from './__generated__/useLazyLoadQueryNodeTest1Query.graphql';
import type {
  useLazyLoadQueryNodeTestUserQuery$data,
  useLazyLoadQueryNodeTestUserQuery$variables,
} from './__generated__/useLazyLoadQueryNodeTestUserQuery.graphql';
import type {FetchPolicy} from 'relay-runtime';
import type {
  OperationDescriptor,
  SelectorData,
} from 'relay-runtime/store/RelayStoreTypes';
import type {Query} from 'relay-runtime/util/RelayRuntimeTypes';

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useFragment = require('../useFragment');
const useLazyLoadQueryNode = require('../useLazyLoadQueryNode');
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const {
  __internal,
  RecordSource,
  ROOT_ID,
  ROOT_TYPE,
  Store,
  createOperationDescriptor,
  getFragment,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');

const {
  disallowConsoleErrors,
  disallowWarnings,
  expectToWarn,
  expectWarningWillFire,
  injectPromisePolyfill__DEPRECATED,
} = jest.requireActual('relay-test-utils-internal') as $FlowFixMe;

injectPromisePolyfill__DEPRECATED();

const defaultFetchPolicy = 'network-only';

function expectToBeRendered(
  renderFn: JestMockFn<ReadonlyArray<any>, any>,
  readyState: ?SelectorData,
) {
  // Ensure useEffect is called before other timers
  ReactTestRenderer.act(() => {
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
    request: {
      node: query.request.node,
      variables: query.request.variables,
    },
    root: expect.anything(),
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
let gqlQuery:
  | Query<
      useLazyLoadQueryNodeTest1Query$variables,
      useLazyLoadQueryNodeTest1Query$data,
    >
  | Query<
      useLazyLoadQueryNodeTestUserQuery$variables,
      useLazyLoadQueryNodeTestUserQuery$data,
    >;
let renderFn;
let render;
let release;
let query;
let variables;
let Container;
let setProps;
let setKey;
let logs: Array<LogEvent>;
let errorBoundaryDidCatchFn;
let useFragmentImpl: typeof useFragment;

disallowWarnings();
disallowConsoleErrors();

beforeEach(() => {
  jest.resetModules();

  useFragmentImpl = useFragment;

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
      componentDisplayName: 'TestDisplayName',
      fetchObservable: __internal.fetchQuery(environment, _query),
      fetchPolicy: props.fetchPolicy || defaultFetchPolicy,
      query: _query,
    });
    return renderFn(data);
  };

  Container = function TestContainer(props: Props, key?: number) {
    const [nextProps, setNextProps] = React.useState(props);
    const [nextKey, setNextKey] = React.useState(key);
    setProps = setNextProps;
    setKey = setNextKey;
    return <Renderer {...nextProps} key={nextKey} />;
  };

  render = (env: RelayMockEnvironment, children: React.Node) => {
    let instance;
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
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
  // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
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
    query useLazyLoadQueryNodeTestUserQuery($id: ID) {
      node(id: $id) {
        id
        name
        ...useLazyLoadQueryNodeTestUserFragment @dangerously_unaliased_fixme
      }
    }
  `;
  graphql`
    fragment useLazyLoadQueryNodeTestUserFragment on User {
      name
    }
  `;

  variables = {id: '1'};
  query = createOperationDescriptor(gqlQuery, variables);
  renderFn = jest.fn((result: any) => result?.node?.name ?? 'Empty');
});

it('fetches and renders the query data', () => {
  const instance = render(environment, <Container variables={variables} />);

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: variables.id,
          name: 'Alice',
        },
      },
    });
    jest.runAllImmediates();
  });

  const data = environment.lookup(query.fragment).data;
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  expectToBeRendered(renderFn, data);
});

it('subscribes to query fragment results and preserves object identity', () => {
  const instance = render(environment, <Container variables={variables} />);

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);

  environment.mock.resolve(gqlQuery, {
    data: {
      node: {
        __typename: 'User',
        id: variables.id,
        name: 'Alice',
      },
    },
  });

  ReactTestRenderer.act(() => {
    jest.runAllImmediates();
  });
  expect(renderFn).toBeCalledTimes(1);
  const prevData = renderFn.mock.calls[0][0];
  expect(prevData.node.name).toBe('Alice');
  renderFn.mockClear();
  ReactTestRenderer.act(() => {
    jest.runAllImmediates();
  });

  ReactTestRenderer.act(() => {
    environment.commitUpdate(store => {
      const alice = store.get('1');
      if (alice != null) {
        alice.setValue('ALICE', 'name');
      }
    });
  });
  expect(renderFn).toBeCalledTimes(1);
  const nextData = renderFn.mock.calls[0][0];
  expect(nextData.node.name).toBe('ALICE');
  renderFn.mockClear();

  // object identity is preserved for unchanged data such as fragment references
  expect(nextData.node.__fragments).toBe(prevData.node.__fragments);
});

it('fetches and renders correctly even if fetched query data still has missing data', () => {
  // This scenario might happen if for example we are making selections on
  // abstract types which the concrete type doesn't implement

  const instance = render(environment, <Container variables={variables} />);

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);

  expectWarningWillFire(
    'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
  );

  ReactTestRenderer.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: variables.id,
          // name is missing in response
        },
      },
    });
  });

  const data = environment.lookup(query.fragment).data;
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  expectToBeRendered(renderFn, data);
});

it('fetches and renders correctly if component unmounts before it can commit', () => {
  const payload = {
    data: {
      node: {
        __typename: 'User',
        id: variables.id,
        name: 'Alice',
      },
    },
  };

  let instance = render(environment, <Container variables={variables} />);

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => {
    environment.mock.resolve(gqlQuery, payload);
  });

  // Unmount the component before it gets to permanently retain the data
  ReactTestRenderer.act(() => {
    instance?.unmount();
  });
  expect(renderFn).not.toBeCalled();

  // Running all immediates makes sure all useEffects run and GC isn't
  // Triggered by mistake
  ReactTestRenderer.act(() => jest.runAllImmediates());
  // Trigger timeout and GC to clear all references
  ReactTestRenderer.act(() => jest.runAllTimers());
  // Verify GC has run
  expect(environment.getStore().getSource().toJSON()).toEqual({
    [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE},
  });

  renderFn.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.retain.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();

  instance = render(environment, <Container variables={variables} />);

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => {
    environment.mock.resolve(gqlQuery, payload);
  });

  const data = environment.lookup(query.fragment).data;
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  expectToBeRendered(renderFn, data);
});

it('fetches and renders correctly when switching between queries', () => {
  // Render the component
  const initialQuery = createOperationDescriptor(gqlQuery, {
    id: 'first-render',
  });
  environment.commitPayload(initialQuery, {
    node: {
      __typename: 'User',
      id: 'first-render',
      name: 'Bob',
    },
  });

  const instance = render(
    environment,
    <Container variables={{id: 'first-render'}} fetchPolicy="store-only" />,
  );
  expect(instance?.toJSON()).toEqual('Bob');
  renderFn.mockClear();

  // Suspend on the first query
  ReactTestRenderer.act(() => {
    setProps({variables});
  });

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  renderFn.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.retain.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();

  // Switch to the second query
  const nextVariables = {id: '2'};
  const nextQuery = createOperationDescriptor(gqlQuery, nextVariables);
  ReactTestRenderer.act(() => {
    setProps({variables: nextVariables});
  });

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, nextQuery);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  renderFn.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.retain.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();

  // Switch back to the first query, it shouldn't request again
  ReactTestRenderer.act(() => {
    setProps({variables});
  });

  expect(instance?.toJSON()).toEqual('Fallback');
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.execute).toBeCalledTimes(0);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(0);

  const payload = {
    data: {
      node: {
        __typename: 'User',
        id: variables.id,
        name: 'Alice',
      },
    },
  };
  ReactTestRenderer.act(() => {
    environment.mock.resolve(gqlQuery, payload);
    jest.runAllImmediates();
  });
  const data = environment.lookup(query.fragment).data;
  expect(renderFn.mock.calls[0][0]).toEqual(data);
  expect(instance?.toJSON()).toEqual('Alice');
});

it('fetches and renders correctly when re-mounting the same query (even if GC runs synchronously)', () => {
  const store = new Store(new RecordSource(), {
    gcReleaseBufferSize: 0,
    gcScheduler: run => run(),
  });
  jest.spyOn(store, 'scheduleGC');
  environment = createMockEnvironment({
    store,
  });
  // Render the component
  const instance = render(
    environment,
    <Container variables={variables} key={0} />,
  );

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();
  renderFn.mockClear();

  ReactTestRenderer.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Bob',
        },
      },
    });
    jest.runAllImmediates();
  });

  const data = environment.lookup(query.fragment).data;
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  expectToBeRendered(renderFn, data);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  renderFn.mockClear();

  ReactTestRenderer.act(() => {
    // Pass a new key to force a re-mount
    setProps({variables});
    setKey(1);
    jest.runAllImmediates();
  });

  // Assert that GC doesn't run since the query doesn't
  // incorrectly get fully released (which would trigger GC)
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(store.scheduleGC).toHaveBeenCalledTimes(0);

  // Assert that a new request was not started
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.execute).toHaveBeenCalledTimes(0);

  // Expect to still be able to render the same data
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  expectToBeRendered(renderFn, data);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
});

it('disposes the temporary retain when the component is re-rendered and switches to another query', () => {
  // Render the component
  const instance = render(
    environment,
    <Container extraData={0} variables={variables} />,
  );

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();
  renderFn.mockClear();

  ReactTestRenderer.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Bob',
        },
      },
    });
    jest.runAllImmediates();
  });

  const data = environment.lookup(query.fragment).data;
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  expectToBeRendered(renderFn, data);
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  renderFn.mockClear();

  ReactTestRenderer.act(() => {
    // Update `extraData` to trigger a re-render
    setProps({extraData: 1, variables});
  });

  // Nothing to release here since variables didn't change
  expect(release).toHaveBeenCalledTimes(0);

  ReactTestRenderer.act(() => {
    // Update `variables` to fetch new data
    setProps({extraData: 1, variables: {id: '2'}});
  });

  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.execute).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => {
    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: '2',
          name: 'Bob',
        },
      },
    });
    jest.runAllImmediates();
  });

  // Variables were changed and the retain for the previous query
  // should be released
  expect(release).toHaveBeenCalledTimes(1);
});

it('does not cancel ongoing network request when component unmounts while suspended', () => {
  const initialVariables = {id: 'first-render'};
  const initialQuery = createOperationDescriptor(gqlQuery, initialVariables);
  environment.commitPayload(initialQuery, {
    node: {
      __typename: 'User',
      id: 'first-render',
      name: 'Bob',
    },
  });

  const instance = render(
    environment,
    <Container variables={{id: 'first-render'}} fetchPolicy="store-only" />,
  );

  expect(instance?.toJSON()).toEqual('Bob');
  renderFn.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();

  // Suspend on the first query
  ReactTestRenderer.act(() => {
    setProps({fetchPolicy: 'store-or-network', variables});
  });

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(2);
  renderFn.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.retain.mockClear();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  environment.execute.mockClear();
  expect(environment.mock.isLoading(query.request.node, variables, {})).toEqual(
    true,
  );

  ReactTestRenderer.act(() => {
    instance?.unmount();
  });

  // Assert data is released
  expect(release).toBeCalledTimes(1);

  // Assert request in flight is not cancelled
  expect(environment.mock.isLoading(query.request.node, variables, {})).toEqual(
    true,
  );
});

it('does not cancel ongoing network request when component unmounts after committing', () => {
  const instance = render(environment, <Container variables={variables} />);

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);

  // Resolve a payload but don't complete the network request
  environment.mock.nextValue(gqlQuery, {
    data: {
      node: {
        __typename: 'User',
        id: variables.id,
        name: 'Alice',
      },
    },
  });

  // Assert that the component unsuspended and mounted
  const data = environment.lookup(query.fragment).data;
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  expectToBeRendered(renderFn, data);

  // Assert request was created
  expect(environment.mock.isLoading(query.request.node, variables, {})).toEqual(
    true,
  );

  ReactTestRenderer.act(() => {
    instance?.unmount();
  });

  // Assert data is released
  expect(release).toBeCalledTimes(1);
  // Assert request in flight is not cancelled
  expect(environment.mock.isLoading(query.request.node, variables, {})).toEqual(
    true,
  );
});

it('does not cancel network request when temporarily retained component that never commits is disposed of after timeout', () => {
  const instance = render(environment, <Container variables={variables} />);

  expect(instance?.toJSON()).toEqual('Fallback');
  expectToHaveFetched(environment, query);
  expect(renderFn).not.toBeCalled();
  // $FlowFixMe[method-unbinding] added when improving typing for this parameters
  expect(environment.retain).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => {
    instance?.unmount();
  });
  // Resolve a payload but don't complete the network request
  environment.mock.nextValue(gqlQuery, {
    data: {
      node: {
        __typename: 'User',
        id: variables.id,
        name: 'Alice',
      },
    },
  });
  // Assert request in created
  expect(environment.mock.isLoading(query.request.node, variables, {})).toEqual(
    true,
  );

  // Trigger releasing of the temporary retain
  ReactTestRenderer.act(() => {
    jest.runAllTimers();
  });
  // Assert data is released
  expect(release).toBeCalledTimes(1);
  // Assert request in flight is not cancelled
  expect(environment.mock.isLoading(query.request.node, variables, {})).toEqual(
    true,
  );
});

describe('with @defer and re-rendering', () => {
  beforeEach(() => {
    graphql`
      fragment useLazyLoadQueryNodeTestDeferFragment on User {
        id
        name
      }
    `;
    gqlQuery = graphql`
      query useLazyLoadQueryNodeTest1Query($id: ID) {
        node(id: $id) {
          ...useLazyLoadQueryNodeTestDeferFragment
            @dangerously_unaliased_fixme
            @defer
        }
      }
    `;
    variables = {id: 'user:1234'};
    query = createOperationDescriptor(gqlQuery, variables);
  });

  it.skip('should handle errors ', () => {
    const instance = render(
      environment,
      <Container key={0} variables={variables} />,
    );

    expect(instance?.toJSON()).toEqual('Fallback');
    expect(renderFn).not.toBeCalled();

    const payloadError = new Error('Invalid Payload');
    // $FlowFixMe[prop-missing] This will make react suppress error logging for this error
    payloadError._suppressLogging = true;

    expect(errorBoundaryDidCatchFn).not.toBeCalled();

    environment.mock.reject(query, payloadError);

    // force re-rendering of the component, to read from the QueryResource
    // by default, error responses do not trigger react updates
    ReactTestRenderer.act(() => {
      setProps({variables});
      setKey(1);
      jest.runAllImmediates();
    });

    // This time, error boundary will render the error
    expect(errorBoundaryDidCatchFn).toBeCalledWith(payloadError);
    expect(renderFn).not.toBeCalled();
  });

  it('should render the query with defer payloads without errors for defer payloads', () => {
    const instance = render(
      environment,
      <Container key={0} variables={variables} />,
    );

    expect(instance?.toJSON()).toEqual('Fallback');
    expect(renderFn).not.toBeCalled();

    ReactTestRenderer.act(() => {
      environment.mock.nextValue(query, {
        data: {
          node: {
            __typename: 'User',
            id: variables.id,
          },
        },
      });
    });

    const data = environment.lookup(query.fragment).data;

    // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
    expectToBeRendered(renderFn, data);

    expect(errorBoundaryDidCatchFn).not.toBeCalled();

    const payloadError = new Error('Invalid Payload');
    expectToWarn(
      'QueryResource: An incremental payload for query `useLazyLoadQueryNodeTest1Query` returned an error: `Invalid Payload`.',
      () => {
        environment.mock.reject(query, payloadError);
      },
    );

    // force re-rendering of the component, to read from the QueryResource
    // by default, error responses do not trigger react updates
    ReactTestRenderer.act(() => {
      setProps({variables});
      setKey(1);
    });

    // error boundary should not display that error
    expect(errorBoundaryDidCatchFn).not.toBeCalled();

    // and we also should re-render the same view as for the initial response
    // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
    expectToBeRendered(renderFn, data);
  });
});

describe('partial rendering', () => {
  it('does not suspend at the root if query does not have direct data dependencies', () => {
    const gqlFragment = graphql`
      fragment useLazyLoadQueryNodeTestRootFragment on Query {
        node(id: $id) {
          id
          name
        }
      }
    `;
    const gqlOnlyFragmentsQuery = graphql`
      query useLazyLoadQueryNodeTestOnlyFragmentsQuery($id: ID) {
        ...useLazyLoadQueryNodeTestRootFragment
      }
    `;
    const onlyFragsQuery = createOperationDescriptor(
      gqlOnlyFragmentsQuery,
      variables,
    );

    function FragmentComponent(props: {query: unknown}) {
      const fragment = getFragment(gqlFragment);
      // $FlowFixMe[incompatible-type]
      const data = useFragmentImpl(fragment, props.query);
      renderFn(data);
      return null;
    }

    const Renderer = (props: {variables: {id: string}}) => {
      const _query = createOperationDescriptor(
        gqlOnlyFragmentsQuery,
        props.variables,
      );
      const data = useLazyLoadQueryNode<any>({
        componentDisplayName: 'TestDisplayName',
        fetchObservable: __internal.fetchQuery(environment, _query),
        fetchPolicy: 'store-or-network',
        query: _query,
        renderPolicy: 'partial',
      });
      return (
        <React.Suspense fallback="Fallback around fragment">
          <FragmentComponent query={data} />
        </React.Suspense>
      );
    };

    const instance = render(environment, <Renderer variables={variables} />);

    // Assert that we suspended at the fragment level and not at the root
    expect(instance?.toJSON()).toEqual('Fallback around fragment');
    expectToHaveFetched(environment, onlyFragsQuery);
    expect(renderFn).not.toBeCalled();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    expect(environment.retain).toHaveBeenCalledTimes(1);

    environment.mock.resolve(gqlOnlyFragmentsQuery, {
      data: {
        node: {
          __typename: 'User',
          id: variables.id,
          name: 'Alice',
        },
      },
    });

    // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
    expectToBeRendered(renderFn, {
      node: {
        id: variables.id,
        name: 'Alice',
      },
    });
  });
});

describe('logging', () => {
  test.skip('simple fetch', () => {
    render(environment, <Container variables={variables} />);

    environment.mock.resolve(gqlQuery, {
      data: {
        node: {
          __typename: 'User',
          id: variables.id,
          name: 'Alice',
        },
      },
    });

    ReactTestRenderer.act(() => {
      jest.runAllImmediates();
    });

    expect(logs).toMatchObject([
      {
        executeId: 100001,
        name: 'execute.start',
      },
      {
        name: 'network.start',
        networkRequestId: 100000,
      },
      {
        name: 'queryresource.fetch',
        profilerContext: {},
        resourceID: 200000,
      },
      {
        fetchPolicy: 'network-only',
        isPromiseCached: false,
        name: 'suspense.query',
        operation: {
          request: {
            variables,
          },
        },
        queryAvailability: {status: 'missing'},
        renderPolicy: 'partial',
      },
      {
        name: 'network.next',
        networkRequestId: 100000,
      },
      {
        executeId: 100001,
        name: 'execute.next.start',
      },
      {
        name: 'execute.normalize.start',
      },
      {
        name: 'execute.normalize.end',
      },
      {
        executeId: 100001,
        name: 'execute.next.end',
      },
      {
        name: 'network.complete',
        networkRequestId: 100000,
      },
      {
        executeId: 100001,
        name: 'execute.complete',
      },
      {
        name: 'queryresource.retain',
        profilerContext: {},
        resourceID: 200000,
      },
    ]);
  });

  test.skip('log when switching queries', () => {
    const initialVariables = {id: 'first-render'};
    const variablesOne = {id: '1'};
    const variablesTwo = {id: '2'};

    // Render the component
    const initialQuery = createOperationDescriptor(gqlQuery, initialVariables);
    environment.commitPayload(initialQuery, {
      node: {
        __typename: 'User',
        id: 'first-render',
        name: 'Bob',
      },
    });

    logs = [];
    render(
      environment,
      <Container variables={initialVariables} fetchPolicy="store-only" />,
    );

    // Suspend on the first query
    ReactTestRenderer.act(() => {
      setProps({variables: variablesOne});
    });

    // Switch to the second query
    ReactTestRenderer.act(() => {
      setProps({variables: variablesTwo});
    });

    // Switch back to the first query and it should not request again
    ReactTestRenderer.act(() => {
      setProps({variables: variablesOne});
    });

    ReactTestRenderer.act(() => {
      const queryOne = createOperationDescriptor(gqlQuery, variablesOne);
      const payload = {
        data: {
          node: {
            __typename: 'User',
            id: variablesOne.id,
            name: 'Alice',
          },
        },
      };
      environment.mock.resolve(queryOne, payload);
      jest.runAllImmediates();
    });

    expect(logs).toMatchObject([
      {
        // initial fetch
        name: 'queryresource.fetch',
        operation: {
          request: {
            variables: initialVariables,
          },
        },
        profilerContext: expect.objectContaining({}),
        resourceID: 200000,
        shouldFetch: false,
      },
      {
        // initial fetch completes, since it was fulfilled from cache
        name: 'queryresource.retain',
        profilerContext: expect.objectContaining({}),
        resourceID: 200000,
      },
      {
        executeId: 100002,
        // execution for variables one starts
        name: 'execute.start',
        variables: variablesOne,
      },
      {
        // request for variables one starts
        name: 'network.start',
        networkRequestId: 100001,
        variables: variablesOne,
      },
      {
        // fetch event for variables one
        name: 'queryresource.fetch',
        operation: {
          request: {
            variables: variablesOne,
          },
        },
        profilerContext: expect.objectContaining({}),
        resourceID: 200001,
        shouldFetch: true,
      },
      {
        fetchPolicy: 'network-only',
        isPromiseCached: false,
        name: 'suspense.query',
        operation: {
          request: {
            variables: variablesOne,
          },
        },
        queryAvailability: {status: 'missing'},
        renderPolicy: 'partial',
      },
      {
        executeId: 100004,
        // execution for variables two starts
        name: 'execute.start',
        variables: variablesTwo,
      },
      {
        // request for variables two starts
        name: 'network.start',
        networkRequestId: 100003,
        variables: variablesTwo,
      },
      {
        // fetch event for variables two
        name: 'queryresource.fetch',
        operation: {
          request: {
            variables: variablesTwo,
          },
        },
        profilerContext: expect.objectContaining({}),
        resourceID: 200002,
        shouldFetch: true,
      },
      {
        fetchPolicy: 'network-only',
        isPromiseCached: false,
        name: 'suspense.query',
        operation: {
          request: {
            variables: variablesTwo,
          },
        },
        queryAvailability: {status: 'missing'},
        renderPolicy: 'partial',
      },
      {
        fetchPolicy: 'network-only',
        isPromiseCached: true,
        name: 'suspense.query',
        operation: {
          request: {
            variables: variablesOne,
          },
        },
        queryAvailability: {status: 'missing'},
        renderPolicy: 'partial',
      },
      // fetch event for variables one is skipped
      // since it's already cached and reused
      {
        name: 'network.next',
        networkRequestId: 100001,
      },
      {
        executeId: 100002,
        name: 'execute.next.start',
      },
      {
        name: 'execute.normalize.start',
      },
      {
        name: 'execute.normalize.end',
      },
      {
        executeId: 100002,
        name: 'execute.next.end',
      },
      {
        name: 'network.complete',
        networkRequestId: 100001,
      },
      {
        executeId: 100002,
        name: 'execute.complete',
      },
      // retain event for variables one
      {
        name: 'queryresource.retain',
        profilerContext: expect.objectContaining({}),
        resourceID: 200001,
      },
    ]);
  });
});
