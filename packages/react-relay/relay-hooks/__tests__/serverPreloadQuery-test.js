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

import type {FetchFunction} from 'relay-runtime';

const serverPreloadQuery = require('../rsc/serverPreloadQuery');
const {Environment, Network, RecordSource, Store} = require('relay-runtime');

function createTestConcreteRequest(name: string, fields: Array<string>): any {
  const selections = fields.map(f => ({
    alias: null,
    args: null,
    kind: 'ScalarField',
    name: f,
    storageKey: null,
  }));

  return {
    fragment: {
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: null,
      name,
      selections,
      type: 'Query',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name,
      selections,
    },
    params: {
      cacheID: `${name}-cache-id`,
      id: `${name}-persisted-id`,
      metadata: {},
      name,
      operationKind: 'query',
      text: null,
    },
  };
}

let environment;

beforeEach(() => {
  const fetchFn: FetchFunction = jest.fn(() =>
    Promise.resolve({
      data: {id: 'user-1', name: 'Alice'},
    }),
  );
  environment = new Environment({
    network: Network.create(fetchFn),
    store: new Store(new RecordSource()),
    isServer: true,
  });
});

test('returns synchronously (not a promise)', () => {
  const query = createTestConcreteRequest('SyncQuery', ['id', 'name']);
  const result = serverPreloadQuery(environment, query, {});

  expect(result.kind).toBe('PreloadedQueryRef');
  expect(result._response).toBeInstanceOf(Promise);
});

test('captures response data', async () => {
  const query = createTestConcreteRequest('ViewerQuery', ['id', 'name']);
  const result = serverPreloadQuery(environment, query, {});
  const response = await result._response;

  expect(response.data).toEqual({
    id: 'user-1',
    name: 'Alice',
  });
});

test('uses persisted query ID', async () => {
  const query = createTestConcreteRequest('PersistedQuery', ['id']);
  const result = serverPreloadQuery(environment, query, {});

  expect(result.queryId).toBe('PersistedQuery-persisted-id');
});

test('falls back to cacheID when id is null', async () => {
  const query = createTestConcreteRequest('CacheQuery', ['id']);
  query.params.id = null;
  const result = serverPreloadQuery(environment, query, {});

  expect(result.queryId).toBe('CacheQuery-cache-id');
});

test('returns a complete PreloadedQueryRef shape', async () => {
  const before = Date.now();
  const query = createTestConcreteRequest('ShapeQuery', ['id', 'name']);
  const result = serverPreloadQuery(environment, query, {});
  const response = await result._response;
  const after = Date.now();

  expect(result.kind).toBe('PreloadedQueryRef');
  expect(result.queryId).toBe('ShapeQuery-persisted-id');
  expect(result.variables).toEqual({});
  expect(response.data).toEqual({id: 'user-1', name: 'Alice'});
  expect(result.fetchedAt).toBeGreaterThanOrEqual(before);
  expect(result.fetchedAt).toBeLessThanOrEqual(after);
});

test('captures error responses', async () => {
  const fetchWithErrors: FetchFunction = jest.fn(() =>
    Promise.resolve({
      data: {id: 'user-1', name: 'Alice'},
      errors: [{message: 'Partial failure'}],
    }),
  );
  const env = new Environment({
    network: Network.create(fetchWithErrors),
    store: new Store(new RecordSource()),
    isServer: true,
  });

  const query = createTestConcreteRequest('ErrorsQuery', ['id', 'name']);
  const result = serverPreloadQuery(env, query, {});
  const response = await result._response;

  expect(response.data).toEqual({id: 'user-1', name: 'Alice'});
  expect(response.errors).toEqual([{message: 'Partial failure'}]);
});
