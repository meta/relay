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

import type {RequestParameters} from 'relay-runtime/util/RelayConcreteNode';

const EntryPointContainer = require('../EntryPointContainer.react');
const loadEntryPoint = require('../loadEntryPoint');
const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const usePreloadedQuery = require('../usePreloadedQuery');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const {
  Environment,
  Network,
  Observable,
  PreloadableQueryRegistry,
  RecordSource,
  Store,
  graphql,
} = require('relay-runtime');
const {
  disallowWarnings,
  expectWarningWillFire,
} = require('relay-test-utils-internal');

disallowWarnings();

const query = graphql`
  query EntryPointContainerTestQuery($id: ID!) {
    node(id: $id) {
      id
      ... on User {
        name
      }
    }
  }
`;
const params = {
  kind: 'PreloadableConcreteRequest',
  params: query.params,
};

// Only queries with an ID are preloadable
const ID = 'my-id';
(query.params as any).id = ID;

const response = {
  data: {
    node: {
      __typename: 'User',
      id: 'my-id',
      name: 'Alice',
    },
  },
  extensions: {
    is_final: true,
  },
};

let dataSource;
let environment;
let fetch;
let entrypoint;
let entryPointReference;
let nestedEntryPointResource;

class FakeJSResource<T> {
  _resolve: ((v: T) => unknown) | null;
  _resource: T | null;
  getModuleId: () => string;
  getModuleIfRequired: () => T | null;
  load: () => Promise<T>;
  resolve: (v: T) => void;

  constructor(resource: T | null) {
    this._resolve = null;
    this._resource = resource;

    this.getModuleId = jest.fn(() => 'TheModuleID');
    this.getModuleIfRequired = jest.fn(() => this._resource);
    // $FlowFixMe[incompatible-type]
    this.load = jest.fn(() => {
      return new Promise(resolve => {
        this._resolve = resolve;
      });
    });
    this.resolve = nextResource => {
      this._resource = nextResource;
      const resolve = this._resolve;
      if (resolve) {
        this._resolve = null;
        resolve(nextResource);
      }
    };
  }
}

beforeEach(() => {
  // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
  fetch = jest.fn((_query, _variables, _cacheConfig) =>
    // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
    Observable.create(sink => {
      dataSource = sink;
    }),
  );
  environment = new Environment({
    // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
    network: Network.create(fetch),
    store: new Store(new RecordSource()),
  });
  nestedEntryPointResource = new FakeJSResource<
    void | ((props: any) => empty),
  >();

  entrypoint = {
    getPreloadProps(entryPointParams: any) {
      return {
        entryPoints: {
          nestedEntryPoint: {
            entryPoint: {
              getPreloadProps(nestedEntryPointParams: any) {
                return {
                  queries: {
                    preloadedQuery: {
                      parameters: params,
                      variables: {id: nestedEntryPointParams.id},
                    },
                  },
                };
              },
              root: nestedEntryPointResource as $FlowFixMe,
            },
            entryPointParams,
          },
        },
      };
    },
    root: new FakeJSResource() as $FlowFixMe,
  };
});

afterAll(() => {
  jest.clearAllMocks();
});

it('suspends while the query and component are pending', async () => {
  entryPointReference = loadEntryPoint<
    {id: string},
    {},
    {...},
    {...},
    unknown,
    any,
    {
      getPreloadProps(entryPointParams: any): {
        entryPoints: {
          nestedEntryPoint: {
            entryPoint: {
              getPreloadProps(nestedEntryPointParams: any): {
                queries: {
                  preloadedQuery: {
                    parameters: {kind: string, params: RequestParameters},
                    variables: {id: any},
                  },
                },
              },
              root: any,
            },
            entryPointParams: any,
          },
        },
      },
      root: any,
    },
  >(
    {
      getEnvironment: () => environment,
    },
    entrypoint,
    {
      id: 'my-id',
    },
  ).entryPoints.nestedEntryPoint;

  expect(fetch).toBeCalledTimes(1);
  expect(nestedEntryPointResource.load).toBeCalledTimes(1);
  let renderer;
  await act(() => {
    renderer = ReactTestingLibrary.render(
      <RelayEnvironmentProvider environment={environment}>
        <React.Suspense fallback="Fallback">
          {/* $FlowFixMe[incompatible-type] */}
          <EntryPointContainer
            entryPointReference={entryPointReference}
            props={{}}
          />
        </React.Suspense>
      </RelayEnvironmentProvider>,
    );
  });
  await act(() => jest.runAllImmediates());
  expect(renderer?.container.textContent).toEqual('Fallback');
});

it.skip('suspends then updates when the query and component load', async () => {
  entryPointReference = loadEntryPoint<
    {id: string},
    {},
    {...},
    {...},
    unknown,
    any,
    {
      getPreloadProps(entryPointParams: any): {
        entryPoints: {
          nestedEntryPoint: {
            entryPoint: {
              getPreloadProps(nestedEntryPointParams: any): {
                queries: {
                  preloadedQuery: {
                    parameters: {kind: string, params: RequestParameters},
                    variables: {id: any},
                  },
                },
              },
              root: any,
            },
            entryPointParams: any,
          },
        },
      },
      root: any,
    },
  >(
    {
      getEnvironment: () => environment,
    },
    entrypoint,
    {
      id: 'my-id',
    },
  ).entryPoints.nestedEntryPoint;

  expect(fetch).toBeCalledTimes(1);
  expect(nestedEntryPointResource.load).toBeCalledTimes(1);
  expect(nestedEntryPointResource.getModuleIfRequired).toBeCalledTimes(1);
  let renderer;
  await act(() => {
    renderer = ReactTestingLibrary.render(
      <RelayEnvironmentProvider environment={environment}>
        <React.Suspense fallback="Fallback">
          {/* $FlowFixMe[incompatible-type] */}
          <EntryPointContainer
            entryPointReference={entryPointReference}
            props={{}}
          />
        </React.Suspense>
      </RelayEnvironmentProvider>,
    );
  });
  await act(() => jest.runAllImmediates());
  expect(renderer?.container.textContent).toEqual('Fallback');
  let preloadedQuery = null;
  function Component(props: any) {
    expect(props.queries.preloadedQuery.variables.id).toBe('my-id');
    preloadedQuery = props.queries.preloadedQuery;
    const data = usePreloadedQuery(query, props.queries.preloadedQuery);
    return data.node?.name;
  }
  nestedEntryPointResource.resolve(Component as any);
  PreloadableQueryRegistry.set(ID, query);
  dataSource.next(response);
  dataSource.complete();
  await act(() => jest.runAllImmediates());
  // One for preloading, 2 more for render
  expect(nestedEntryPointResource.getModuleIfRequired).toBeCalledTimes(3);
  expect(nestedEntryPointResource.load).toBeCalledTimes(1);
  expect(preloadedQuery).not.toBe(null);
  expect(renderer?.container.textContent).toEqual('Alice');
});

it('renders synchronously when the component has already loaded and the data arrives before render', async () => {
  let preloadedQuery = null;
  function Component(props: any) {
    expect(props.queries.preloadedQuery.variables.id).toBe('my-id');
    preloadedQuery = props.queries.preloadedQuery;
    const data = usePreloadedQuery(query, props.queries.preloadedQuery);
    return data.node?.name;
  }
  PreloadableQueryRegistry.set(ID, query);
  nestedEntryPointResource.resolve(Component as any);
  entryPointReference = loadEntryPoint<
    {id: string},
    {},
    {...},
    {...},
    unknown,
    any,
    {
      getPreloadProps(entryPointParams: any): {
        entryPoints: {
          nestedEntryPoint: {
            entryPoint: {
              getPreloadProps(nestedEntryPointParams: any): {
                queries: {
                  preloadedQuery: {
                    parameters: {kind: string, params: RequestParameters},
                    variables: {id: any},
                  },
                },
              },
              root: any,
            },
            entryPointParams: any,
          },
        },
      },
      root: any,
    },
  >(
    {
      getEnvironment: () => environment,
    },
    entrypoint,
    {
      id: 'my-id',
    },
  ).entryPoints.nestedEntryPoint;
  dataSource.next(response);
  dataSource.complete();

  let renderer;
  await act(() => {
    renderer = ReactTestingLibrary.render(
      <RelayEnvironmentProvider environment={environment}>
        <React.Suspense fallback="Fallback">
          {/* $FlowFixMe[incompatible-type] */}
          <EntryPointContainer
            entryPointReference={entryPointReference}
            props={{}}
          />
        </React.Suspense>
      </RelayEnvironmentProvider>,
    );
  });
  expect(renderer?.container.textContent).toEqual('Alice');
  expect(nestedEntryPointResource.getModuleIfRequired).toBeCalledTimes(2);
  expect(nestedEntryPointResource.load).toBeCalledTimes(0);
  expect(preloadedQuery).not.toBe(null);
});

it.skip('warns if the entryPointReference has already been disposed', async () => {
  // $FlowFixMe[incompatible-type]
  entryPointReference = loadEntryPoint(
    {
      getEnvironment: () => environment,
    },
    entrypoint,
    {},
  );
  const render = async () => {
    await act(() => {
      ReactTestingLibrary.render(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Fallback">
            {/* $FlowFixMe[incompatible-type] */}
            <EntryPointContainer
              entryPointReference={entryPointReference}
              props={{}}
            />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    await act(() => jest.runAllImmediates());
  };

  await render();
  entryPointReference.dispose();

  expectWarningWillFire(
    '<EntryPointContainer>: Expected entryPointReference to not be disposed yet. This is because disposing the entrypoint marks it for future garbage collection, and as such may no longer be present in the Relay store. In the future, this will become a hard error.',
  );
  await render();
});
