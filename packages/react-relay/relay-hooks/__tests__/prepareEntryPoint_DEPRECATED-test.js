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

const prepareEntryPoint_DEPRECATED = require('../prepareEntryPoint_DEPRECATED');
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
  getModuleIfRequired: () => T | null;
  load: () => Promise<T>;
  resolve: (v: T) => void;

  constructor(resource: T | null) {
    this._resolve = null;
    this._resource = resource;

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
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  prepareEntryPoint_DEPRECATED(
    {
      getEnvironment: () => env,
    },
    // $FlowFixMe[incompatible-type]
    entryPoint,
    {id: 'my-id'},
  );
  expect(entryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(entryPoint.root.load).toBeCalledTimes(1);
  expect(networkSpy).toBeCalledTimes(1);
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
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  prepareEntryPoint_DEPRECATED(
    {
      getEnvironment: () => env,
    },
    // $FlowFixMe[incompatible-type] Added after improved typing of PreloadProps
    entryPoint,
    {id: 'my-id'},
  );
  expect(entryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(entryPoint.root.load).toBeCalledTimes(1);
  expect(nestedEntryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(nestedEntryPoint.root.load).toBeCalledTimes(1);
  expect(networkSpy).toBeCalledTimes(1);
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
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  prepareEntryPoint_DEPRECATED(
    {
      getEnvironment: () => env,
    },
    // $FlowFixMe[incompatible-type] Added after improved typing of PreloadProps
    entryPoint,
    {id: 'my-id'},
  );
  expect(networkSpy).toBeCalledTimes(2);
  expect(nestedEntryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(nestedEntryPoint.root.load).toBeCalledTimes(1);
  expect(entryPoint.root.getModuleIfRequired).toBeCalledTimes(1);
  expect(entryPoint.root.load).toBeCalledTimes(1);
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
  // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
  prepareEntryPoint_DEPRECATED(
    // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
    {
      getEnvironment,
    },
    // $FlowFixMe[incompatible-type]
    entryPoint,
    {id: 'my-id'},
  );
  expect(getEnvironment).toBeCalledWith({
    actorID: '4',
  });
  expect(networkSpy).toBeCalledTimes(1);
});
