/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall relay
 */

'use strict';

const loadEntryPoint = require('../loadEntryPoint');
const {
  createMockEnvironment,
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

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

test('it should preload entry point with queries', () => {
  const env = createMockEnvironment();
  const networkSpy = jest.spyOn(env.getNetwork(), 'execute');
  const entryPoint = {
    getPreloadProps(params: {id: string}) {
      return {
        queries: {
          myTestQuery: {
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'my-persisted-query-id',
                metadata: {},
                name: 'MyPreloadedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const preloadedEntryPoint = loadEntryPoint<
    _,
    {},
    {...},
    {...},
    unknown,
    $FlowFixMe,
    _,
  >(
    {
      getEnvironment: () => env,
    },
    entryPoint,
    {id: 'my-id'},
  );
  expect(entryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(entryPoint.root.load).toBeCalledTimes(1);
  expect(networkSpy).toBeCalledTimes(1);
  expect(preloadedEntryPoint.queries.myTestQuery.name).toBe('MyPreloadedQuery');
  expect(preloadedEntryPoint.queries.myTestQuery.variables).toEqual({
    id: 'my-id',
  });
  expect(preloadedEntryPoint.entryPoints).toEqual({});
});

test('it should ignore handle null/undefined queries', () => {
  const env = createMockEnvironment();
  const networkSpy = jest.spyOn(env.getNetwork(), 'execute');
  const entryPoint = {
    getPreloadProps(params: {id: string}) {
      return {
        queries: {
          myNullTestQuery: null,
          myUndefinedTestQuery: undefined,
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const preloadedEntryPoint = loadEntryPoint<
    _,
    {},
    {...},
    {...},
    unknown,
    $FlowFixMe,
    _,
  >(
    {
      getEnvironment: () => env,
    },
    entryPoint,
    {id: 'my-id'},
  );
  expect(entryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(entryPoint.root.load).toBeCalledTimes(1);
  expect(networkSpy).toBeCalledTimes(0);
  expect(preloadedEntryPoint.queries).toEqual({});
  expect(preloadedEntryPoint.entryPoints).toEqual({});
});

test('it should unwrap an entry point wrapping a module with default exports', () => {
  const env = createMockEnvironment();
  const fakeModule = {
    foo: 'bar',
  };
  const entryPoint = {
    getPreloadProps(params: {id: string}) {
      return {
        queries: {
          myTestQuery: {
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'my-persisted-query-id',
                metadata: {},
                name: 'MyPreloadedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource({
      default: fakeModule,
    }) as $FlowFixMe,
  };
  const preloadedEntryPoint = loadEntryPoint<
    _,
    {},
    {...},
    {...},
    unknown,
    $FlowFixMe,
    _,
  >(
    {
      getEnvironment: () => env,
    },
    entryPoint,
    {id: 'my-id'},
  );
  expect(preloadedEntryPoint.getComponent()).toEqual(fakeModule);
});

test('it should return the module from an entry point that just returns the module directly', () => {
  const env = createMockEnvironment();
  const fakeModule = {
    foo: 'bar',
  };
  const entryPoint = {
    getPreloadProps(params: {id: string}) {
      return {
        queries: {
          myTestQuery: {
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'my-persisted-query-id',
                metadata: {},
                name: 'MyPreloadedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(fakeModule) as $FlowFixMe,
  };
  const preloadedEntryPoint = loadEntryPoint<
    _,
    {},
    {...},
    {...},
    unknown,
    $FlowFixMe,
    _,
  >(
    {
      getEnvironment: () => env,
    },
    entryPoint,
    {id: 'my-id'},
  );
  expect(preloadedEntryPoint.getComponent()).toEqual(fakeModule);
});

describe('with respect to loadQuery', () => {
  let mockLoadedQuery;
  const loadQuery = jest
    /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
     * enabling Flow LTI mode */
    .fn<_, {dispose: JestMockFn<ReadonlyArray<unknown>, unknown>}>()
    .mockImplementation(() => {
      return mockLoadedQuery;
    });
  beforeEach(() => {
    jest.mock('../loadQuery', () => ({loadQuery}));
    mockLoadedQuery = {
      dispose: jest.fn<ReadonlyArray<unknown>, unknown>(),
    };
  });
  afterEach(() => {
    jest.unmock('../loadQuery');
  });
  it('it should call loadQuery for each query', () => {
    const myTestQuery = {
      parameters: {
        kind: 'PreloadableConcreteRequest',
        params: {
          id: 'my-persisted-query-id',
          metadata: {},
          name: 'MyPreloadedQuery',
          operationKind: 'query',
          text: null,
        },
      },
      variables: {},
    };
    const myTestQuery2 = {
      parameters: {
        kind: 'PreloadableConcreteRequest',
        params: {
          id: 'my-persisted-query-id',
          metadata: {},
          name: 'MyPreloadedQuery',
          operationKind: 'query',
          text: null,
        },
      },
      variables: {},
    };
    const env = createMockEnvironment();
    const entryPoint = {
      getPreloadProps(params: Readonly<{...}>) {
        return {
          queries: {
            myTestQuery,
            myTestQuery2,
          },
        };
      },
      root: new FakeJSResource(null) as $FlowFixMe,
    };

    loadEntryPoint<_, {}, {...}, {...}, unknown, $FlowFixMe, _>(
      {
        getEnvironment: () => env,
      },
      entryPoint,
      {},
    );

    expect(loadQuery).toHaveBeenCalledTimes(2);
    expect(loadQuery.mock.calls[0][0]).toEqual(env);
    expect(loadQuery.mock.calls[0][1]).toEqual(myTestQuery.parameters);
    expect(loadQuery.mock.calls[0][2]).toEqual(myTestQuery.variables);
    expect(loadQuery.mock.calls[1][0]).toEqual(env);
    expect(loadQuery.mock.calls[1][1]).toEqual(myTestQuery2.parameters);
    expect(loadQuery.mock.calls[1][2]).toEqual(myTestQuery2.variables);
  });

  it('it should return a dispose callback that calls loadQuery(...).dispose', () => {
    const env = createMockEnvironment();
    const entryPoint = {
      getPreloadProps(params: Readonly<{...}>) {
        return {
          queries: {
            myTestQuery: {
              parameters: {
                kind: 'PreloadableConcreteRequest',
                params: {
                  id: 'my-persisted-query-id',
                  metadata: {},
                  name: 'MyPreloadedQuery',
                  operationKind: 'query',
                  text: null,
                },
              },
              variables: {},
            },
          },
        };
      },
      root: new FakeJSResource(null) as $FlowFixMe,
    };

    const preloadedEntryPoint = loadEntryPoint<
      _,
      {},
      {...},
      {...},
      unknown,
      $FlowFixMe,
      _,
    >(
      {
        getEnvironment: () => env,
      },
      entryPoint,
      {},
    );

    expect(typeof preloadedEntryPoint.dispose).toBe('function');
    expect(mockLoadedQuery.dispose).not.toHaveBeenCalled();
    expect(preloadedEntryPoint.isDisposed).toBe(false);
    preloadedEntryPoint.dispose();
    expect(mockLoadedQuery.dispose).toHaveBeenCalledTimes(1);
    expect(preloadedEntryPoint.isDisposed).toBe(true);
  });
});

test('it should preload entry point with nested entry points', () => {
  const env = createMockEnvironment();
  const networkSpy = jest.spyOn(env.getNetwork(), 'execute');
  const nestedEntryPoint = {
    getPreloadProps(params: $FlowFixMe) {
      return {
        queries: {
          myNestedQuery: {
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'my-persisted-query-id',
                metadata: {},
                name: 'MyNestedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const entryPoint = {
    getPreloadProps(params: {id: string}) {
      return {
        entryPoints: {
          myNestedEntryPoint: {
            entryPoint: nestedEntryPoint,
            entryPointParams: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const preloadedEntryPoint = loadEntryPoint<
    _,
    {},
    {...},
    {...},
    unknown,
    $FlowFixMe,
    _,
  >(
    {
      getEnvironment: () => env,
    },
    entryPoint,
    {id: 'my-id'},
  );
  expect(entryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(entryPoint.root.load).toBeCalledTimes(1);
  expect(nestedEntryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(nestedEntryPoint.root.load).toBeCalledTimes(1);
  expect(networkSpy).toBeCalledTimes(1);
  expect(
    preloadedEntryPoint.entryPoints.myNestedEntryPoint.queries.myNestedQuery
      .name,
  ).toBe('MyNestedQuery');
  expect(
    preloadedEntryPoint.entryPoints.myNestedEntryPoint.queries.myNestedQuery
      .variables,
  ).toEqual({
    id: 'my-id',
  });
  expect(preloadedEntryPoint.queries).toEqual({});
});

test('it should preload entry point with both queries and nested entry points', () => {
  const env = createMockEnvironment();
  const networkSpy = jest.spyOn(env.getNetwork(), 'execute');
  const nestedEntryPoint = {
    getPreloadProps(params: $FlowFixMe) {
      return {
        queries: {
          myNestedQuery: {
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'nested-query-id',
                metadata: {},
                name: 'MyNestedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const entryPoint = {
    getPreloadProps(params: {id: string}) {
      return {
        entryPoints: {
          myNestedEntryPoint: {
            entryPoint: nestedEntryPoint,
            entryPointParams: {
              id: 'nested-' + params.id,
            },
          },
        },
        queries: {
          myTestQuery: {
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'root-query-id',
                metadata: {},
                name: 'MyPreloadedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const preloadedEntryPoint = loadEntryPoint<
    _,
    {},
    {...},
    {...},
    unknown,
    $FlowFixMe,
    _,
  >(
    {
      getEnvironment: () => env,
    },
    entryPoint,
    {id: 'my-id'},
  );
  expect(networkSpy).toBeCalledTimes(2);
  expect(nestedEntryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(nestedEntryPoint.root.load).toBeCalledTimes(1);
  expect(entryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(entryPoint.root.load).toBeCalledTimes(1);
  expect(preloadedEntryPoint.queries.myTestQuery.name).toBe('MyPreloadedQuery');
  expect(preloadedEntryPoint.queries.myTestQuery.variables).toEqual({
    id: 'my-id',
  });
  expect(
    preloadedEntryPoint.entryPoints.myNestedEntryPoint.queries.myNestedQuery
      .name,
  ).toBe('MyNestedQuery');
  expect(
    preloadedEntryPoint.entryPoints.myNestedEntryPoint.queries.myNestedQuery
      .variables,
  ).toEqual({
    id: 'nested-my-id',
  });
});

test('it should dispose nested entry points', () => {
  const env = createMockEnvironment();
  const nestedEntryPoint = {
    getPreloadProps(params: $FlowFixMe) {
      return {
        queries: {
          myNestedQuery: {
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'nested-query-id',
                metadata: {},
                name: 'MyNestedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const entryPoint = {
    getPreloadProps(params: {id: string}) {
      return {
        entryPoints: {
          myNestedEntryPoint: {
            entryPoint: nestedEntryPoint,
            entryPointParams: {
              id: 'nested-' + params.id,
            },
          },
        },
        queries: {
          myTestQuery: {
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'root-query-id',
                metadata: {},
                name: 'MyPreloadedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const preloadedEntryPoint = loadEntryPoint<
    _,
    {},
    {...},
    {...},
    unknown,
    $FlowFixMe,
    _,
  >(
    {
      getEnvironment: () => env,
    },
    // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
    entryPoint,
    {},
  );
  const nestedEntryPointDisposeSpy = jest.spyOn(
    preloadedEntryPoint.entryPoints.myNestedEntryPoint,
    'dispose',
  );
  expect(typeof preloadedEntryPoint.dispose).toBe('function');
  expect(nestedEntryPointDisposeSpy).not.toHaveBeenCalled();
  expect(preloadedEntryPoint.isDisposed).toBe(false);
  preloadedEntryPoint.dispose();
  expect(nestedEntryPointDisposeSpy).toHaveBeenCalledTimes(1);
  expect(preloadedEntryPoint.isDisposed).toBe(true);
});

test('with `getEnvironment` function', () => {
  const env = createMockEnvironment();
  const networkSpy = jest.spyOn(env.getNetwork(), 'execute');
  const entryPoint = {
    getPreloadProps(params: {id: string}) {
      return {
        queries: {
          myTestQuery: {
            environmentProviderOptions: {
              actorID: '4',
            },
            parameters: {
              kind: 'PreloadableConcreteRequest',
              params: {
                id: 'root-query-id',
                metadata: {},
                name: 'MyPreloadedQuery',
                operationKind: 'query',
                text: null,
              },
            },
            variables: {
              id: params.id,
            },
          },
        },
      };
    },
    root: new FakeJSResource(null) as $FlowFixMe,
  };
  const getEnvironment = jest.fn(() => env);
  const preloadedEntryPoint = loadEntryPoint<
    _,
    {},
    {...},
    {...},
    unknown,
    $FlowFixMe,
    _,
  >(
    // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
    {
      getEnvironment,
    },
    entryPoint,
    {id: 'my-id'},
  );
  expect(getEnvironment).toBeCalledWith({
    actorID: '4',
  });
  expect(networkSpy).toBeCalledTimes(1);
  expect(preloadedEntryPoint.queries.myTestQuery.name).toBe('MyPreloadedQuery');
  expect(preloadedEntryPoint.queries.myTestQuery.variables).toEqual({
    id: 'my-id',
  });
  expect(preloadedEntryPoint.entryPoints).toEqual({});
});
