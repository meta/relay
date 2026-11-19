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
import type {ClientOnlyQueriesTest1Query} from '../../__tests__/__generated__/ClientOnlyQueriesTest1Query.graphql';
import type {RelayModernEnvironmentExecuteWithSourceTestResolverQuery} from '../../../relay-runtime/store/__tests__/__generated__/RelayModernEnvironmentExecuteWithSourceTestResolverQuery.graphql';
import type {PreloadableConcreteRequest} from '../EntryPointTypes.flow';
import type {
  loadQueryTestQuery,
  loadQueryTestQuery$data,
  loadQueryTestQuery$variables,
} from './__generated__/loadQueryTestQuery.graphql';
import type {
  CacheConfig,
  INetwork,
  LogEvent,
  LogRequestInfoFunction,
  Observer,
  Query,
  RequestParameters,
  Sink,
  Subscription,
  UploadableMap,
  Variables,
} from 'relay-runtime';
import type {
  ExecuteWithPreloadedSourceFunction,
  OperationAvailabilityConfig,
} from 'relay-runtime/network/RelayNetworkTypes';

const pureClientReadTimeQuery = require('../../__tests__/__generated__/ClientOnlyQueriesTest1Query.graphql');
const {loadQuery} = require('../loadQuery');
const nullthrows = require('nullthrows');
// Need React require for OSS build
// eslint-disable-next-line no-unused-vars
const React = require('react');
const {
  Environment,
  Network,
  Observable,
  PreloadableQueryRegistry,
  RecordSource,
  Store,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const execTimeQuery = require('relay-runtime/store/__tests__/__generated__/RelayModernEnvironmentExecuteWithDeferTestResolverQuery.graphql');
const pureClientExecTimeQuery = require('relay-runtime/store/__tests__/__generated__/RelayModernEnvironmentExecuteWithSourceTestResolverQuery.graphql');
const {
  createMockEnvironment,
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

const query = graphql`
  query loadQueryTestQuery($id: ID!) {
    node(id: $id) {
      id
    }
  }
`;

describe('loadQuery', () => {
  // Only queries with an ID are preloadable
  const ID = '12345';
  (query.params as $FlowFixMe).id = ID;
  (query.params as $FlowFixMe).cacheID = ID;

  const preloadableConcreteRequest: PreloadableConcreteRequest<loadQueryTestQuery> =
    {
      kind: 'PreloadableConcreteRequest',
      params: query.params,
    };

  const pureClientExecTimePreloadableRequest: PreloadableConcreteRequest<RelayModernEnvironmentExecuteWithSourceTestResolverQuery> =
    {
      kind: 'PreloadableConcreteRequest',
      params: {
        ...pureClientExecTimeQuery.params,
        metadata: {},
      },
    };

  const pureClientReadTimePreloadableRequest: PreloadableConcreteRequest<ClientOnlyQueriesTest1Query> =
    {
      kind: 'PreloadableConcreteRequest',
      params: pureClientReadTimeQuery.params,
    };

  const response = {
    data: {
      node: {
        __typename: 'User',
        id: '4',
      },
    },
    extensions: {
      is_final: true,
    },
  };

  const variables = {id: '4'};

  let sink;
  let fetch;
  let environment;
  let executeWithPreloadedSource: ExecuteWithPreloadedSourceFunction;
  let logEvents: Array<LogEvent>;

  let executeUnsubscribe: ?JestMockFn<ReadonlyArray<unknown>, unknown>;
  let executeObservable;

  let networkUnsubscribe;

  let disposeEnvironmentRetain: ?JestMockFn<ReadonlyArray<unknown>, unknown>;

  let resolvedModule:
    | Query<loadQueryTestQuery$variables, loadQueryTestQuery$data>
    | typeof execTimeQuery
    | typeof pureClientExecTimeQuery
    | typeof pureClientReadTimeQuery
    | null;
  let mockAvailability: {fetchTime?: number, status: string};
  let operationAvailabilityConfig: ?OperationAvailabilityConfig;
  let disposeOnloadCallback;
  let executeOnloadCallback;

  beforeEach(() => {
    fetch = jest.fn(
      (
        _query: RequestParameters,
        _variables: Variables,
        _cacheConfig: CacheConfig,
        _uploadables: ?UploadableMap,
        _logRequestInfo: ?LogRequestInfoFunction,
      ) => {
        const observable = Observable.create<$FlowFixMe>(_sink => {
          sink = _sink;
        });
        const originalSubscribe: (
          observer: Observer<unknown> | Sink<unknown>,
        ) => Subscription = observable.subscribe.bind(observable);
        networkUnsubscribe = jest.fn<[], $FlowFixMe>();
        jest.spyOn(observable, 'subscribe').mockImplementation((...args) => {
          const subscription = originalSubscribe(...args);
          jest
            .spyOn(subscription, 'unsubscribe')
            .mockImplementation(() => networkUnsubscribe());
          return subscription;
        });
        return observable;
      },
    );
    executeWithPreloadedSource = jest.fn(
      (...args: Parameters<ExecuteWithPreloadedSourceFunction>) => args[3],
    );
    function wrapNetworkExecute(network: INetwork): INetwork {
      return {
        execute: (_1, _2, _3, _4, _5, _6, _7, _availabilityConfig) => {
          operationAvailabilityConfig = _availabilityConfig;
          return network.execute(
            _1,
            _2,
            _3,
            _4,
            _5,
            _6,
            _7,
            _availabilityConfig,
          );
        },
        executeWithPreloadedSource,
      };
    }
    logEvents = [];
    environment = createMockEnvironment({
      log: event => {
        logEvents.push(event);
      },
      network: wrapNetworkExecute(Network.create(fetch)),
    });

    jest.clearAllTimers();
    jest.useFakeTimers();
    resolvedModule = query;
    mockAvailability = {
      fetchTime: Date.now(),
      status: 'available',
    };

    jest
      .spyOn(PreloadableQueryRegistry, 'get')
      .mockImplementation(() => resolvedModule);

    jest
      .spyOn(PreloadableQueryRegistry, 'onLoad')
      .mockImplementation((key, cb) => {
        executeOnloadCallback = cb;
        disposeOnloadCallback = jest.fn<ReadonlyArray<unknown>, unknown>();
        return {dispose: disposeOnloadCallback};
      });

    const originalExecuteWithSource =
      environment.executeWithSource.getMockImplementation();
    executeObservable = undefined;
    executeUnsubscribe = undefined;

    jest
      .spyOn(environment, 'executeWithSource')
      .mockImplementation((...params) => {
        executeObservable = originalExecuteWithSource(...params);
        const originalSubscribe =
          executeObservable.subscribe.bind(executeObservable);
        jest
          .spyOn(executeObservable, 'subscribe')
          .mockImplementation(subscriptionCallbacks => {
            const executeSubscription = originalSubscribe(
              subscriptionCallbacks,
            );
            const originalUnsubscribe =
              executeSubscription.unsubscribe.bind(executeSubscription);
            executeUnsubscribe = jest.fn(originalUnsubscribe);
            return {unsubscribe: executeUnsubscribe};
          });
        return executeObservable;
      });

    disposeEnvironmentRetain = undefined;
    jest.spyOn(environment, 'retain').mockImplementation(() => {
      disposeEnvironmentRetain = jest.fn();
      return {
        dispose: disposeEnvironmentRetain,
      };
    });

    jest.spyOn(environment, 'check').mockImplementation(() => mockAvailability);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('when passed a PreloadableConcreteRequest', () => {
    it('checks whether the query ast is available synchronously', () => {
      loadQuery(environment, preloadableConcreteRequest, variables);
      expect(PreloadableQueryRegistry.get).toHaveBeenCalled();
    });

    describe('when the query AST is available synchronously', () => {
      it('synchronously checks whether the query can be fulfilled by the store', () => {
        loadQuery(environment, preloadableConcreteRequest, variables);
        expect(environment.check).toHaveBeenCalled();
      });

      it('uses the exec-time default when the available AST enables exec-time resolvers', () => {
        resolvedModule = execTimeQuery;

        const preloadedQuery = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
        );

        expect(preloadedQuery.fetchPolicy).toBe('store-and-network');
        expect(fetch).toHaveBeenCalled();
        expect(executeObservable).toBeDefined();
        expect(executeWithPreloadedSource).not.toHaveBeenCalled();
      });

      describe("with fetchPolicy === 'store-or-network'", () => {
        it('should not call fetch if the query can be fulfilled by the store', () => {
          const {source} = loadQuery(
            environment,
            preloadableConcreteRequest,
            variables,
            {
              fetchPolicy: 'store-or-network',
            },
          );
          expect(fetch).not.toHaveBeenCalled();
          expect(environment.executeWithSource).not.toHaveBeenCalled();
          expect(source).toEqual(undefined);
          // Query should still be retained even if we don't fetch
          expect(environment.retain).toHaveBeenCalled();
        });

        describe('when the query cannot be fulfilled by the store', () => {
          beforeEach(() => {
            mockAvailability = {status: 'missing'};
          });
          it('makes a network request', done => {
            const {source} = loadQuery(
              environment,
              preloadableConcreteRequest,
              variables,
              {
                fetchPolicy: 'store-or-network',
              },
            );
            const nextCallback = jest.fn(() => done());
            if (source) {
              // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
              source.subscribe({
                next: nextCallback,
              });
            }
            expect(fetch).toHaveBeenCalled();
            expect(source).toBeDefined();
            expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
            expect(environment.executeWithSource).toHaveBeenCalledWith(
              expect.objectContaining({
                operation: expect.objectContaining({
                  request: expect.objectContaining({
                    cacheConfig: {force: true},
                    identifier: expect.stringContaining(ID),
                    variables,
                  }),
                }),
              }),
            );
            expect(environment.retain).toHaveBeenCalled();

            PreloadableQueryRegistry.set(ID, query);
            expect(nextCallback).not.toHaveBeenCalled();

            sink.next(response);
            expect(nextCallback).toHaveBeenCalledWith(response);
          });

          it('should mark failed network requests', () => {
            const preloadedQuery = loadQuery(
              environment,
              preloadableConcreteRequest,
              variables,
              {
                fetchPolicy: 'store-or-network',
              },
            );

            expect(preloadedQuery.networkError).toBeNull();

            const networkError = new Error('network request failed');
            sink.error(networkError);

            expect(preloadedQuery.networkError).toBe(networkError);
          });

          it('calling dispose unsubscribes from executeWithSource', () => {
            // This ensures that no data is written to the store
            const preloadedQuery = loadQuery(
              environment,
              preloadableConcreteRequest,
              variables,
              {
                fetchPolicy: 'store-or-network',
              },
            );
            expect(fetch).toHaveBeenCalled();
            expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
            expect(environment.executeWithSource).toHaveBeenCalledWith(
              expect.objectContaining({
                operation: expect.objectContaining({
                  request: expect.objectContaining({
                    cacheConfig: {force: true},
                    identifier: expect.stringContaining(ID),
                    variables,
                  }),
                }),
              }),
            );
            expect(environment.retain).toHaveBeenCalled();
            expect(executeObservable).toBeDefined();
            if (executeObservable != null) {
              expect(executeObservable.subscribe).toHaveBeenCalledTimes(1);
              expect(executeUnsubscribe).toBeDefined();
            }

            expect(preloadedQuery.isDisposed).toBe(false);
            preloadedQuery.dispose();
            expect(preloadedQuery.isDisposed).toBe(true);
            expect(executeUnsubscribe).not.toBe(null);
            if (executeUnsubscribe != null) {
              expect(executeUnsubscribe).toHaveBeenCalledTimes(1);
              expect(disposeEnvironmentRetain).toHaveBeenCalled();
            }
          });

          it('calling dispose unsubscribes from the network request', () => {
            // This ensures that live queries stop issuing network requests
            const preloadedQuery = loadQuery(
              environment,
              preloadableConcreteRequest,
              variables,
              {
                fetchPolicy: 'store-or-network',
              },
            );
            preloadedQuery.dispose();

            expect(networkUnsubscribe).not.toBe(null);
            if (networkUnsubscribe != null) {
              expect(networkUnsubscribe).toHaveBeenCalledTimes(1);
            }
          });
        });
      });

      describe("with fetchPolicy === 'store-only'", () => {
        it('should not call fetch if the query can be fulfilled by the store', () => {
          const {source} = loadQuery(
            environment,
            preloadableConcreteRequest,
            variables,
            {
              fetchPolicy: 'store-only',
            },
          );
          expect(fetch).not.toHaveBeenCalled();
          expect(environment.executeWithSource).not.toHaveBeenCalled();
          expect(source).toEqual(undefined);
          // Query should still be retained even if we don't fetch
          expect(environment.retain).toHaveBeenCalled();
        });

        it('should not call fetch if the query cannot be fulfilled by the store', () => {
          mockAvailability = {status: 'missing'};
          const {source} = loadQuery(
            environment,
            preloadableConcreteRequest,
            variables,
            {
              fetchPolicy: 'store-only',
            },
          );
          expect(fetch).not.toHaveBeenCalled();
          expect(environment.executeWithSource).not.toHaveBeenCalled();
          expect(source).toEqual(undefined);
          // Query should still be retained even if we don't fetch
          expect(environment.retain).toHaveBeenCalled();
        });

        it('calling dispose releases the query', () => {
          const preloadedQuery = loadQuery(
            environment,
            preloadableConcreteRequest,
            variables,
            {
              fetchPolicy: 'store-or-network',
            },
          );
          preloadedQuery.dispose();
          expect(disposeEnvironmentRetain).toHaveBeenCalledTimes(1);
        });
      });

      describe("with fetchPolicy === 'store-and-network'", () => {
        it('should call fetch if the query can be fulfilled by the store', () => {
          const {source} = loadQuery(
            environment,
            preloadableConcreteRequest,
            variables,
            {
              fetchPolicy: 'store-and-network',
            },
          );
          expect(fetch).toHaveBeenCalled();
          expect(environment.executeWithSource).toHaveBeenCalled();
          expect(source).toBeDefined();
          // Query should still be retained even if we don't fetch
          expect(environment.retain).toHaveBeenCalled();
        });

        it('returns the correct operation availability (available)', () => {
          loadQuery(environment, preloadableConcreteRequest, variables, {
            fetchPolicy: 'store-and-network',
          });
          expect(fetch).toHaveBeenCalled();
          const config = nullthrows(operationAvailabilityConfig);
          const parentOperation = nullthrows(config.parentOperation);
          expect(config.checkOperation(parentOperation).status).toEqual(
            'available',
          );
        });

        it('returns the correct operation availability (missing)', () => {
          mockAvailability = {status: 'missing'};

          loadQuery(environment, preloadableConcreteRequest, variables, {
            fetchPolicy: 'store-and-network',
          });
          expect(fetch).toHaveBeenCalled();
          const config = nullthrows(operationAvailabilityConfig);
          const parentOperation = nullthrows(config.parentOperation);
          expect(config.checkOperation(parentOperation).status).toEqual(
            'missing',
          );
        });
      });
    });

    describe('when the query AST is unavailable synchronously', () => {
      beforeEach(() => {
        resolvedModule = null;
      });

      it('provides a stateless checker without a parent operation before the AST loads', () => {
        loadQuery(environment, preloadableConcreteRequest, variables, {
          fetchPolicy: 'store-and-network',
        });
        const relatedOperation = createOperationDescriptor(query, variables);
        const config = nullthrows(operationAvailabilityConfig);

        expect(config.parentOperation).toBe(null);
        expect(config.checkOperation(relatedOperation)).toBe(mockAvailability);
        expect(environment.check).toHaveBeenLastCalledWith(relatedOperation);

        executeOnloadCallback(query);
        expect(operationAvailabilityConfig).toBe(config);
        expect(config.parentOperation).toBe(null);
      });

      it('adopts the prestarted source after an exec-time AST loads', () => {
        const preloadedQuery = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
        );
        Object.freeze(preloadedQuery);

        expect(preloadedQuery.fetchPolicy).toBe('store-or-network');
        expect(executeWithPreloadedSource).not.toHaveBeenCalled();

        executeOnloadCallback(execTimeQuery);

        expect(preloadedQuery.fetchPolicy).toBe('store-and-network');
        expect(executeWithPreloadedSource).toHaveBeenCalledTimes(1);
        expect(executeWithPreloadedSource).toHaveBeenCalledWith(
          execTimeQuery.params,
          variables,
          {force: true},
          expect.anything(),
          expect.objectContaining({
            checkOperation: expect.any(Function),
            parentOperation: expect.objectContaining({
              request: expect.objectContaining({node: execTimeQuery}),
            }),
          }),
        );
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(
          logEvents.filter(event => event.name === 'network.start'),
        ).toHaveLength(1);
      });

      it('does not offer an ordinary query for source adoption', () => {
        loadQuery(environment, preloadableConcreteRequest, variables);

        executeOnloadCallback(query);

        expect(executeWithPreloadedSource).not.toHaveBeenCalled();
        expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      it('falls back to ordinary execution without source adoption support', () => {
        environment = createMockEnvironment({network: Network.create(fetch)});

        loadQuery(environment, preloadableConcreteRequest, variables);
        executeOnloadCallback(execTimeQuery);

        expect(executeWithPreloadedSource).not.toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      it('should make a network request', done => {
        const {source} = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-or-network',
          },
        );
        const nextCallback = jest.fn(() => done());
        if (source) {
          // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
          source.subscribe({
            next: nextCallback,
          });
        }
        expect(fetch).toHaveBeenCalled();
        expect(source).toBeDefined();
        expect(environment.executeWithSource).not.toHaveBeenCalled();

        executeOnloadCallback(query);
        expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
        expect(environment.executeWithSource).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: expect.objectContaining({
              request: expect.objectContaining({
                cacheConfig: {force: true},
                identifier: expect.stringContaining(ID),
                variables,
              }),
            }),
          }),
        );
        expect(environment.retain).toHaveBeenCalled();
        expect(nextCallback).not.toHaveBeenCalled();

        sink.next(response);
        expect(nextCallback).toHaveBeenCalledWith(response);
      });
      it('should mark failed network requests', () => {
        const preloadedQuery = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-or-network',
          },
        );

        expect(preloadedQuery.networkError).toBeNull();

        const networkError = new Error('network request failed');
        sink.error(networkError);

        expect(preloadedQuery.networkError).toBe(networkError);
      });

      it('calling dispose after the AST loads unsubscribes from executeWithSource', () => {
        // This ensures that no data is written to the store
        const preloadedQuery = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-or-network',
          },
        );
        expect(fetch).toHaveBeenCalled();

        expect(executeOnloadCallback).toBeDefined();
        executeOnloadCallback(query);

        expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
        expect(environment.executeWithSource).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: expect.objectContaining({
              request: expect.objectContaining({
                cacheConfig: {force: true},
                identifier: expect.stringContaining(ID),
                variables,
              }),
            }),
          }),
        );
        expect(environment.retain).toHaveBeenCalled();
        expect(executeObservable).toBeDefined();
        if (executeObservable != null) {
          expect(executeObservable.subscribe).toHaveBeenCalledTimes(1);
          expect(executeUnsubscribe).toBeDefined();
        }

        expect(preloadedQuery.isDisposed).toBe(false);
        preloadedQuery.dispose();
        expect(preloadedQuery.isDisposed).toBe(true);

        expect(executeUnsubscribe).not.toBe(null);
        if (executeUnsubscribe != null) {
          expect(executeUnsubscribe).toHaveBeenCalledTimes(1);
          expect(disposeEnvironmentRetain).toHaveBeenCalled();
        }
      });

      it('calling dispose after the AST loads unsubscribes from the network request', () => {
        // This ensures that live queries stop issuing network requests
        const preloadedQuery = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-or-network',
          },
        );
        executeOnloadCallback(query);
        preloadedQuery.dispose();

        expect(networkUnsubscribe).not.toBe(null);
        if (networkUnsubscribe != null) {
          expect(networkUnsubscribe).toHaveBeenCalledTimes(1);
        }
      });

      it('calling dispose before the AST loads clears the onLoad callback', () => {
        const preloadedQuery = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-or-network',
          },
        );
        expect(fetch).toHaveBeenCalled();
        expect(PreloadableQueryRegistry.onLoad).toHaveBeenCalledTimes(1);
        expect(disposeOnloadCallback).toBeDefined();
        expect(disposeOnloadCallback).not.toHaveBeenCalled();

        expect(preloadedQuery.isDisposed).toBe(false);
        preloadedQuery.dispose();
        expect(preloadedQuery.isDisposed).toBe(true);
        if (disposeOnloadCallback != null) {
          expect(disposeOnloadCallback).toHaveBeenCalledTimes(1);
        }
      });

      it('passes a callback to onLoad that calls executeWithSource', () => {
        loadQuery(environment, preloadableConcreteRequest, variables);
        expect(environment.executeWithSource).not.toHaveBeenCalled();
        executeOnloadCallback(query);
        expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
        expect(environment.executeWithSource).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: expect.objectContaining({
              request: expect.objectContaining({
                cacheConfig: {force: true},
                identifier: expect.stringContaining(ID),
                variables,
              }),
            }),
          }),
        );
        expect(environment.retain).toHaveBeenCalled();
      });
    });

    describe("with fetchPolicy === 'store-only'", () => {
      it('should not call fetch if the query can be fulfilled by the store', () => {
        const {source} = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-only',
          },
        );
        expect(fetch).not.toHaveBeenCalled();
        expect(environment.executeWithSource).not.toHaveBeenCalled();
        expect(source).toEqual(undefined);
        // Query should still be retained even if we don't fetch
        expect(environment.retain).toHaveBeenCalled();
      });

      it('should not call fetch if the query cannot be fulfilled by the store', () => {
        mockAvailability = {status: 'missing'};
        const {source} = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-only',
          },
        );
        expect(fetch).not.toHaveBeenCalled();
        expect(environment.executeWithSource).not.toHaveBeenCalled();
        expect(source).toEqual(undefined);
        // Query should still be retained even if we don't fetch
        expect(environment.retain).toHaveBeenCalled();
      });

      it('calling dispose releases the query', () => {
        const preloadedQuery = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-or-network',
          },
        );
        preloadedQuery.dispose();
        expect(disposeEnvironmentRetain).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when passed an id-less pure-client PreloadableConcreteRequest', () => {
    beforeEach(() => {
      resolvedModule = null;
    });

    it('uses the cache ID for the registry rendezvous without starting network work', () => {
      const preloadedQuery = loadQuery(
        environment,
        pureClientExecTimePreloadableRequest,
        {},
      );
      const cacheID = pureClientExecTimeQuery.params.cacheID;

      expect(PreloadableQueryRegistry.get).toHaveBeenCalledWith(cacheID);
      expect(PreloadableQueryRegistry.onLoad).toHaveBeenCalledWith(
        cacheID,
        expect.any(Function),
      );
      expect(preloadedQuery.id).toBe(cacheID);
      expect(preloadedQuery.source).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
      expect(environment.executeWithSource).not.toHaveBeenCalled();
    });

    it('starts exec-time execution after the full artifact loads', () => {
      const preloadedQuery = loadQuery(
        environment,
        pureClientExecTimePreloadableRequest,
        {},
      );
      Object.freeze(preloadedQuery);

      expect(preloadedQuery.fetchPolicy).toBe('store-or-network');
      expect(preloadedQuery.source).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();

      executeOnloadCallback(pureClientExecTimeQuery);

      expect(preloadedQuery.fetchPolicy).toBe('store-and-network');
      expect(preloadedQuery.source).toBeDefined();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe(pureClientExecTimeQuery.params);
      expect(
        nullthrows(operationAvailabilityConfig).parentOperation,
      ).not.toBeNull();
      expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
      expect(executeWithPreloadedSource).not.toHaveBeenCalled();
      expect(environment.retain).toHaveBeenCalledTimes(1);
    });

    it('uses store-only after a read-time client artifact loads', () => {
      const preloadedQuery = loadQuery(
        environment,
        pureClientReadTimePreloadableRequest,
        {},
      );

      executeOnloadCallback(pureClientReadTimeQuery);

      expect(preloadedQuery.fetchPolicy).toBe('store-only');
      expect(preloadedQuery.source).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
      expect(environment.executeWithSource).not.toHaveBeenCalled();
      expect(environment.retain).toHaveBeenCalledTimes(1);
    });

    it('preserves an explicit store-only policy after an exec-time client artifact loads', () => {
      const preloadedQuery = loadQuery(
        environment,
        pureClientExecTimePreloadableRequest,
        {},
        {fetchPolicy: 'store-only'},
      );

      executeOnloadCallback(pureClientExecTimeQuery);

      expect(preloadedQuery.fetchPolicy).toBe('store-only');
      expect(preloadedQuery.source).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
      expect(executeObservable).toBeUndefined();
      expect(disposeEnvironmentRetain).toBeDefined();
    });

    it('executes an already-registered exec-time client artifact', () => {
      resolvedModule = pureClientExecTimeQuery;

      const preloadedQuery = loadQuery(
        environment,
        pureClientExecTimePreloadableRequest,
        {},
      );

      expect(preloadedQuery.fetchPolicy).toBe('store-and-network');
      expect(preloadedQuery.source).toBeDefined();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(PreloadableQueryRegistry.onLoad).not.toHaveBeenCalled();
      expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
    });

    it('can be disposed before the full artifact loads', () => {
      const preloadedQuery = loadQuery(
        environment,
        pureClientExecTimePreloadableRequest,
        {},
      );

      preloadedQuery.dispose();

      expect(preloadedQuery.isDisposed).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
      expect(disposeOnloadCallback).toHaveBeenCalledTimes(1);
      expect(environment.retain).not.toHaveBeenCalled();
    });

    it('can be disposed after late exec-time execution starts', () => {
      const preloadedQuery = loadQuery(
        environment,
        pureClientExecTimePreloadableRequest,
        {},
      );
      executeOnloadCallback(pureClientExecTimeQuery);

      preloadedQuery.dispose();

      expect(preloadedQuery.isDisposed).toBe(true);
      expect(executeUnsubscribe).toHaveBeenCalledTimes(1);
      expect(networkUnsubscribe).toHaveBeenCalledTimes(1);
      expect(disposeEnvironmentRetain).toHaveBeenCalledTimes(1);
    });
  });

  describe('when passed a query AST', () => {
    it('checks whether the query can be fulfilled by the store synchronously', () => {
      loadQuery(environment, query, variables);
      expect(environment.check).toHaveBeenCalled();
    });

    describe('default fetch policy for exec-time resolver queries', () => {
      it('uses store-and-network when exec-time resolvers are enabled', () => {
        const preloadedQuery = loadQuery(environment, execTimeQuery, variables);

        expect(preloadedQuery.fetchPolicy).toBe('store-and-network');
        expect(fetch).toHaveBeenCalled();
        expect(executeObservable).toBeDefined();
      });
    });

    describe('when the query can be fulfilled by the store', () => {
      it("when fetchPolicy === 'store-or-network', it avoids a network request", () => {
        loadQuery(environment, query, variables, {
          fetchPolicy: 'store-or-network',
        });
        expect(fetch).not.toHaveBeenCalled();
        expect(environment.executeWithSource).not.toHaveBeenCalled();
        // Query should still be retained even if we don't fetch
        expect(environment.retain).toHaveBeenCalled();
      });

      describe("when fetchPolicy === 'network-only'", () => {
        it('should make a network request', done => {
          const {source} = loadQuery(environment, query, variables, {
            fetchPolicy: 'network-only',
          });
          const nextCallback = jest.fn(() => done());
          if (source) {
            // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
            source.subscribe({
              next: nextCallback,
            });
          }
          expect(fetch).toHaveBeenCalled();
          expect(source).toBeDefined();
          expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
          expect(environment.executeWithSource).toHaveBeenCalledWith(
            expect.objectContaining({
              operation: expect.objectContaining({
                request: expect.objectContaining({
                  cacheConfig: {force: true},
                  identifier: expect.stringContaining(ID),
                  variables,
                }),
              }),
            }),
          );
          expect(environment.retain).toHaveBeenCalled();
          expect(nextCallback).not.toHaveBeenCalled();

          sink.next(response);
          expect(nextCallback).toHaveBeenCalledWith(response);
        });

        it('should mark failed network requests', () => {
          const preloadedQuery = loadQuery(environment, query, variables, {
            fetchPolicy: 'network-only',
          });

          expect(preloadedQuery.networkError).toBeNull();

          const networkError = new Error('network request failed');
          sink.error(networkError);

          expect(preloadedQuery.networkError).toBe(networkError);
        });

        it('calling dispose unsubscribes from environment.executeWithSource', () => {
          // This ensures that no data is written to the store
          const preloadedQuery = loadQuery(environment, query, variables, {
            fetchPolicy: 'network-only',
          });
          expect(fetch).toHaveBeenCalled();
          expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
          expect(environment.executeWithSource).toHaveBeenCalledWith(
            expect.objectContaining({
              operation: expect.objectContaining({
                request: expect.objectContaining({
                  cacheConfig: {force: true},
                  identifier: expect.stringContaining(ID),
                  variables,
                }),
              }),
            }),
          );
          expect(environment.retain).toHaveBeenCalled();
          expect(executeObservable).toBeDefined();
          if (executeObservable != null) {
            expect(executeObservable.subscribe).toHaveBeenCalledTimes(1);
            expect(executeUnsubscribe).toBeDefined();
          }

          expect(preloadedQuery.isDisposed).toBe(false);
          preloadedQuery.dispose();
          expect(preloadedQuery.isDisposed).toBe(true);

          expect(executeUnsubscribe).not.toBe(null);
          if (executeUnsubscribe != null) {
            expect(executeUnsubscribe).toHaveBeenCalledTimes(1);
            expect(disposeEnvironmentRetain).toHaveBeenCalled();
          }
        });

        it('calling dispose unsubscribes from the network request', () => {
          // This ensures that live queries stop issuing network requests
          const preloadedQuery = loadQuery(environment, query, variables, {
            fetchPolicy: 'network-only',
          });
          preloadedQuery.dispose();

          expect(networkUnsubscribe).not.toBe(null);
          if (networkUnsubscribe != null) {
            expect(networkUnsubscribe).toHaveBeenCalledTimes(1);
          }
        });
      });
    });

    describe('when the query cannot be fulfilled from the store', () => {
      beforeEach(() => {
        mockAvailability = {status: 'missing'};
      });

      it('should make a network request', done => {
        const {source} = loadQuery(environment, query, variables);
        const nextCallback = jest.fn(() => done());
        if (source) {
          // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
          source.subscribe({
            next: nextCallback,
          });
        }
        expect(fetch).toHaveBeenCalled();
        expect(source).toBeDefined();
        expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
        expect(environment.executeWithSource).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: expect.objectContaining({
              request: expect.objectContaining({
                cacheConfig: {force: true},
                identifier: expect.stringContaining(ID),
                variables,
              }),
            }),
          }),
        );
        expect(environment.retain).toHaveBeenCalled();
        expect(nextCallback).not.toHaveBeenCalled();

        sink.next(response);
        expect(nextCallback).toHaveBeenCalledWith(response);
      });

      it('should mark failed network requests', () => {
        const preloadedQuery = loadQuery(environment, query, variables);

        expect(preloadedQuery.networkError).toBeNull();

        const networkError = new Error('network request failed');
        sink.error(networkError);

        expect(preloadedQuery.networkError).toBe(networkError);
      });

      it('calling dispose unsubscribes from environment.executeWithSource', () => {
        // This ensures that no data is written to the store
        const preloadedQuery = loadQuery(environment, query, variables);
        expect(fetch).toHaveBeenCalled();
        expect(environment.executeWithSource).toHaveBeenCalledTimes(1);
        expect(environment.retain).toHaveBeenCalled();
        expect(executeObservable).toBeDefined();
        if (executeObservable != null) {
          expect(executeObservable.subscribe).toHaveBeenCalledTimes(1);
          expect(executeUnsubscribe).toBeDefined();
        }

        expect(preloadedQuery.isDisposed).toBe(false);
        preloadedQuery.dispose();
        expect(preloadedQuery.isDisposed).toBe(true);

        expect(executeUnsubscribe).not.toBe(null);
        if (executeUnsubscribe != null) {
          expect(executeUnsubscribe).toHaveBeenCalledTimes(1);
          expect(disposeEnvironmentRetain).toHaveBeenCalled();
        }
      });

      it('calling dispose unsubscribes from the network request', () => {
        // This ensures that live queries stop issuing network requests
        const preloadedQuery = loadQuery(environment, query, variables);
        preloadedQuery.dispose();

        expect(networkUnsubscribe).not.toBe(null);
        if (networkUnsubscribe != null) {
          expect(networkUnsubscribe).toHaveBeenCalledTimes(1);
        }
      });
    });

    describe("with fetchPolicy === 'store-only'", () => {
      it('should not call fetch if the query can be fulfilled by the store', () => {
        const {source} = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-only',
          },
        );
        expect(fetch).not.toHaveBeenCalled();
        expect(environment.executeWithSource).not.toHaveBeenCalled();
        expect(source).toEqual(undefined);
        // Query should still be retained even if we don't fetch
        expect(environment.retain).toHaveBeenCalled();
      });

      it('should not call fetch if the query cannot be fulfilled by the store', () => {
        mockAvailability = {status: 'missing'};
        const {source} = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-only',
          },
        );
        expect(fetch).not.toHaveBeenCalled();
        expect(environment.executeWithSource).not.toHaveBeenCalled();
        expect(source).toEqual(undefined);
        // Query should still be retained even if we don't fetch
        expect(environment.retain).toHaveBeenCalled();
      });

      it('calling dispose releases the query', () => {
        const preloadedQuery = loadQuery(
          environment,
          preloadableConcreteRequest,
          variables,
          {
            fetchPolicy: 'store-or-network',
          },
        );
        preloadedQuery.dispose();
        expect(disposeEnvironmentRetain).toHaveBeenCalledTimes(1);
      });
    });
  });
});

// A page with two `useQueryFromServer` components publishes both payloads
// during one render pass and flushes both continuations after it commits. A
// shared `notify()` can only record one source operation, so each publish
// records its own.
describe('loadQuery after two deferred publishes share one notify', () => {
  function responseFor(id: string) {
    return {data: {node: {__typename: 'User', id}}};
  }

  it('serves both queries from the store', () => {
    const networkFetch = jest.fn(
      (
        _query: RequestParameters,
        _variables: Variables,
        _cacheConfig: CacheConfig,
        _uploadables: ?UploadableMap,
        _logRequestInfo: ?LogRequestInfoFunction,
      ) => Observable.create<$FlowFixMe>(() => {}),
    );
    const env = new Environment({
      network: Network.create(networkFetch),
      store: new Store(RecordSource.create()),
    });

    const first = createOperationDescriptor(query, {id: '4'});
    const second = createOperationDescriptor(query, {id: '5'});
    env.retain(first);
    env.retain(second);

    // Something invalidated the store earlier in the session. Data written
    // afterwards is still fresh -- but only if the store was told which
    // operation wrote it.
    env.commitUpdate(storeProxy => {
      storeProxy.invalidateStore();
    });

    const flushFirst = env.publishWithDeferredNotify(first, responseFor('4'));
    const flushSecond = env.publishWithDeferredNotify(second, responseFor('5'));
    flushFirst();
    flushSecond();

    // Both payloads landed. Whatever `loadQuery` decides below, it is not
    // deciding it because data is missing.
    expect(env.lookup(first.fragment).data).toEqual({node: {id: '4'}});
    expect(env.lookup(second.fragment).data).toEqual({node: {id: '5'}});

    loadQuery(env, query, {id: '4'}, {fetchPolicy: 'store-or-network'});
    expect(networkFetch).toHaveBeenCalledTimes(0);

    // Same data, same retention, same store -- and now the same write epoch,
    // so `second` is served from the store too. Which continuation ran first
    // no longer decides whether a query hits the network.
    loadQuery(env, query, {id: '5'}, {fetchPolicy: 'store-or-network'});
    expect(networkFetch).toHaveBeenCalledTimes(0);
  });
});
