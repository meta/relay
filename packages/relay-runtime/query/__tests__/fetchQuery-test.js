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

import type {RelayFieldLoggerEvent} from '../../store/RelayStoreTypes';
import type {fetchQueryTest1Query$data} from './__generated__/fetchQueryTest1Query.graphql';
import type {RequestParameters} from 'relay-runtime';

const fetchQuery = require('../fetchQuery');
const {
  Environment,
  Network,
  RecordSource,
  Store,
  createOperationDescriptor,
  getRequest,
  graphql,
} = require('relay-runtime');
const {
  createMockEnvironment,
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

const response = {
  data: {
    node: {
      __typename: 'User',
      id: '4',
    },
  },
};

describe('fetchQuery', () => {
  let query;
  let variables;
  let environment;
  let retained = [];
  beforeEach(() => {
    retained = [];
    environment = createMockEnvironment();
    environment.retain.mockImplementation(obj => {
      const idx = retained.push(obj);
      return {
        dispose: () => {
          retained = retained.filter((o, ii) => ii === idx);
        },
      };
    });
    variables = {id: '4'};
    query = graphql`
      query fetchQueryTest1Query($id: ID!) {
        node(id: $id) {
          id
        }
      }
    `;
  });
  it('fetches request and does not retain data', () => {
    let calledObserver = false;
    const observer = {
      complete: () => {
        calledObserver = true;
        expect(retained.length).toEqual(0);
      },
    };
    const subscription = fetchQuery(environment, query, variables).subscribe(
      observer,
    );
    const queryNode = getRequest(query);
    environment.mock.nextValue(queryNode, response);
    environment.mock.complete(queryNode);
    subscription.unsubscribe();
    expect(calledObserver).toEqual(true);
    expect(retained.length).toEqual(0);
  });

  it('provides data snapshot on next', () => {
    let calledNext = false;
    const observer = {
      next: (data: fetchQueryTest1Query$data) => {
        calledNext = true;
        expect(retained.length).toEqual(0);
        expect(data).toEqual({
          node: {
            id: '4',
          },
        });
      },
    };
    fetchQuery(environment, query, variables).subscribe(observer);
    const queryNode = getRequest(query);
    environment.mock.nextValue(queryNode, response);
    expect(calledNext).toEqual(true);
    environment.mock.complete(queryNode);
    expect(retained.length).toEqual(0);
  });

  it('unsubscribes when request is disposed', () => {
    let calledNext = false;
    let calledUnsubscribe = false;
    const observer = {
      next: () => {
        calledNext = true;
        expect(retained.length).toEqual(0);
      },
      unsubscribe: () => {
        calledUnsubscribe = true;
      },
    };
    const subscription = fetchQuery(environment, query, variables).subscribe(
      observer,
    );
    const queryNode = getRequest(query);
    environment.mock.nextValue(queryNode, response);
    subscription.unsubscribe();
    expect(calledNext).toEqual(true);
    expect(calledUnsubscribe).toEqual(true);
  });

  it('handles error correctly', () => {
    let calledError = false;
    const observer = {
      error: (error: Error) => {
        calledError = true;
        expect(error.message).toEqual('Oops');
        expect(retained.length).toEqual(0);
      },
    };
    const subscription = fetchQuery(environment, query, variables).subscribe(
      observer,
    );
    const queryNode = getRequest(query);
    environment.mock.reject(queryNode, new Error('Oops'));
    expect(calledError).toEqual(true);
    expect(retained.length).toEqual(0);
    subscription.unsubscribe();
  });

  describe('.toPromise()', () => {
    it('fetches request and does not retain query data', async () => {
      const promise = fetchQuery(environment, query, variables).toPromise();
      const queryNode = getRequest(query);
      expect(
        environment.mock.isLoading(queryNode, variables, {force: true}),
      ).toEqual(true);
      environment.mock.nextValue(queryNode, response);
      const data = await promise;
      expect(data).toEqual({
        node: {
          id: '4',
        },
      });
      expect(
        environment.mock.isLoading(queryNode, variables, {force: true}),
      ).toEqual(true);
      expect(retained.length).toEqual(0);

      environment.mock.complete(queryNode);
      expect(
        environment.mock.isLoading(queryNode, variables, {force: true}),
      ).toEqual(false);
      expect(retained.length).toEqual(0);
    });

    it('rejects when error occurs', async () => {
      const promise = fetchQuery(environment, query, variables).toPromise();
      const queryNode = getRequest(query);
      expect(
        environment.mock.isLoading(queryNode, variables, {force: true}),
      ).toEqual(true);
      environment.mock.reject(queryNode, new Error('Oops'));
      try {
        await promise;
      } catch (error) {
        expect(error.message).toEqual('Oops');
      }
      expect(
        environment.mock.isLoading(queryNode, variables, {force: true}),
      ).toEqual(false);
      expect(retained.length).toEqual(0);
    });
  });

  describe('store-or-network fetchPolicy', () => {
    it('fetches data if not cached yet', async () => {
      const promise = fetchQuery(environment, query, variables, {
        fetchPolicy: 'store-or-network',
      }).toPromise();
      const queryNode = getRequest(query);
      // Needs to load data from network
      expect(
        environment.mock.isLoading(queryNode, variables, {force: true}),
      ).toEqual(true);
      environment.mock.nextValue(queryNode, response);
      const data = await promise;
      expect(data).toEqual({
        node: {
          id: '4',
        },
      });
    });
    it('reads from store if cached already', async () => {
      // Populate the store
      const queryNode = getRequest(query);
      const operation = createOperationDescriptor(queryNode, variables);
      environment.getStore().retain(operation);
      environment.commitPayload(operation, response.data);

      // Fetch after data is in store
      const promise = fetchQuery(environment, query, variables, {
        fetchPolicy: 'store-or-network',
      }).toPromise();
      // Shouldn't be loading because the data is already cached
      expect(
        environment.mock.isLoading(getRequest(query), variables, {force: true}),
      ).toEqual(false);
      const data = await promise;
      expect(data).toEqual({
        node: {
          id: '4',
        },
      });
    });
  });
});

describe('fetchQuery with missing @required value', () => {
  it('provides data snapshot on next', () => {
    const relayFieldLogger = jest.fn<[RelayFieldLoggerEvent], void>();
    const environment = createMockEnvironment({
      relayFieldLogger,
    });
    const query = graphql`
      query fetchQueryTest2Query {
        me {
          name @required(action: LOG)
        }
      }
    `;

    const observer = {next: jest.fn<[$FlowFixMe], unknown>()};
    const subscription = fetchQuery(environment, query, {}).subscribe(observer);
    expect(observer.next).not.toHaveBeenCalled();
    const queryNode = getRequest(query);

    environment.mock.nextValue(queryNode, {
      data: {
        me: {
          id: 'ID-1',
          name: null,
        },
      },
    });
    subscription.unsubscribe();
    expect(observer.next).toHaveBeenCalledWith({me: null});
    expect(relayFieldLogger).toHaveBeenCalledWith({
      fieldError: null,
      fieldPath: 'me.name',
      fieldValue: null,
      kind: 'missing_required_field.log',
      owner: 'fetchQueryTest2Query',
    });
  });

  it('throws on resolution', () => {
    const relayFieldLogger = jest.fn<[RelayFieldLoggerEvent], void>();
    const environment = createMockEnvironment({relayFieldLogger});
    const query = graphql`
      query fetchQueryTest3Query {
        me {
          name @required(action: THROW)
        }
      }
    `;

    const observer = {
      next: jest.fn<[$FlowFixMe], unknown>(),
      error: jest.fn<[Error], unknown>(),
    };
    const subscription = fetchQuery(environment, query, {}).subscribe(observer);
    const queryNode = getRequest(query);

    expect(observer.next).not.toHaveBeenCalled();
    expect(observer.error).not.toHaveBeenCalled();

    environment.mock.nextValue(queryNode, {
      data: {me: {id: 'ID-1', name: null}},
    });
    subscription.unsubscribe();
    expect(relayFieldLogger).toHaveBeenCalledWith({
      fieldError: null,
      fieldPath: 'me.name',
      fieldValue: null,
      kind: 'missing_required_field.throw',
      owner: 'fetchQueryTest3Query',
      handled: false,
    });
    expect(observer.error).toHaveBeenCalledWith(
      Error(
        "Relay: Missing @required value at path 'me.name' in 'fetchQueryTest3Query': the server returned null.",
      ),
    );
    expect(observer.next).not.toHaveBeenCalled();
  });

  it('does not report missing required values in fragments', () => {
    const environment = createMockEnvironment({});
    graphql`
      fragment fetchQueryTestFragment on User {
        name @required(action: THROW)
      }
    `;
    const query = graphql`
      query fetchQueryTest4Query {
        me {
          ...fetchQueryTestFragment
        }
      }
    `;

    const observer = {
      next: jest.fn<[$FlowFixMe], unknown>(),
      error: jest.fn<[Error], unknown>(),
    };
    const subscription = fetchQuery(environment, query, {}).subscribe(observer);
    const queryNode = getRequest(query);
    environment.mock.nextValue(queryNode, {
      data: {me: {id: 'ID-1', name: null}},
    });

    subscription.unsubscribe();

    expect(observer.error).not.toHaveBeenCalled();
  });
});

test('client-only query with error', () => {
  const fetchFn = jest.fn((params: RequestParameters) => {
    if (params.id === null && params.text == null) {
      throw new Error('Expected ID or Text');
    }
    throw new Error('Unexpected Input');
  });
  const environment = new Environment({
    store: new Store(new RecordSource()),
    // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
    network: Network.create(fetchFn),
  });
  const query = graphql`
    query fetchQueryTest5Query {
      client_root_field
    }
  `;
  const observer = {
    next: jest.fn<[empty], unknown>(),
    error: jest.fn<[Error], unknown>(),
  };

  // $FlowExpectedError[incompatible-type] - fetch query is expecting a fetchable query, `fetchQueryTest5Query` is client-only
  fetchQuery<{...}, empty, unknown>(environment, query, {}).subscribe(observer);

  expect(observer.next).not.toBeCalled();
  expect(observer.error).toBeCalledWith(new Error('Expected ID or Text'));
});
