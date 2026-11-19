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

import type {FetchFunction} from 'relay-runtime';

const serverFetchQuery = require('../rsc/serverFetchQuery');
const serverReadFragment = require('../rsc/serverReadFragment');
const {
  Environment,
  Network,
  RecordSource,
  Store,
  createOperationDescriptor,
  getRequest,
} = require('relay-runtime');

function createTestFixtures(): {query: $FlowFixMe, fragment: $FlowFixMe} {
  const fragmentSelections = [
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'id',
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'name',
      storageKey: null,
    },
  ];

  const fragment = {
    argumentDefinitions: [],
    kind: 'Fragment',
    metadata: null,
    name: 'TestFragment',
    selections: fragmentSelections,
    type: 'User',
    abstractKey: null,
  };

  const query = {
    fragment: {
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: null,
      name: 'TestQuery',
      selections: [
        {
          alias: null,
          args: [{kind: 'Literal', name: 'id', value: 'user-1'}],
          concreteType: 'User',
          kind: 'LinkedField',
          name: 'node',
          plural: false,
          selections: fragmentSelections,
          storageKey: null,
        },
      ],
      type: 'Query',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name: 'TestQuery',
      selections: [
        {
          alias: null,
          args: [{kind: 'Literal', name: 'id', value: 'user-1'}],
          concreteType: 'User',
          kind: 'LinkedField',
          name: 'node',
          plural: false,
          selections: [
            ...fragmentSelections,
            {
              alias: null,
              args: null,
              kind: 'ScalarField',
              name: '__typename',
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ],
    },
    params: {
      cacheID: 'TestQuery-cache-id',
      id: 'TestQuery-persisted-id',
      metadata: {},
      name: 'TestQuery',
      operationKind: 'query',
      text: null,
    },
  };

  return {query, fragment};
}

let mockFetchFn: FetchFunction;
let environment: Environment;

beforeEach(() => {
  mockFetchFn = jest.fn(() =>
    Promise.resolve({
      data: {
        node: {__typename: 'User', id: 'user-1', name: 'Alice'},
      },
    }),
  );
  environment = new Environment({
    network: Network.create(mockFetchFn),
    store: new Store(new RecordSource()),
    isServer: true,
  });
});

test('reads singular fragment data from the store', async () => {
  const {query, fragment} = createTestFixtures();

  const request = getRequest(query);
  const operationDescriptor = createOperationDescriptor(request, {});
  const observable = environment.execute({
    operation: operationDescriptor,
  });
  await observable.toPromise();

  const fragmentKey = {
    __id: 'user-1',
    __fragments: {TestFragment: {}},
    __fragmentOwner: operationDescriptor.request,
    $fragmentSpreads: {TestFragment: true},
  };

  // $FlowFixMe[incompatible-type] test fixtures don't match opaque types
  const data = await serverReadFragment(environment, fragment, fragmentKey);

  expect(data).toEqual({id: 'user-1', name: 'Alice'});
});

test('reads fragment data after serverFetchQuery populates the store', async () => {
  const {query, fragment} = createTestFixtures();

  await serverFetchQuery(environment, query, {});

  const request = getRequest(query);
  const operationDescriptor = createOperationDescriptor(request, {});

  const fragmentKey = {
    __id: 'user-1',
    __fragments: {TestFragment: {}},
    __fragmentOwner: operationDescriptor.request,
    $fragmentSpreads: {TestFragment: true},
  };

  // $FlowFixMe[incompatible-type] test fixtures don't match opaque types
  const fragmentData = await serverReadFragment(
    environment,
    fragment,
    fragmentKey,
  );

  expect(fragmentData).toEqual({id: 'user-1', name: 'Alice'});
});
