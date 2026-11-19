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

import type {FetchPolicy, RenderPolicy, Subscription} from 'relay-runtime';

const {getQueryResourceForEnvironment} = require('../QueryResource');
const {
  __internal: {fetchQuery},
  Observable,
  RecordSource,
  ROOT_ID,
  Store,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {
  createMockEnvironment,
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

describe('QueryResource', () => {
  let environment;
  let QueryResource;
  let fetchPolicy: FetchPolicy;
  let fetchObservable;
  let fetchObservableMissingData;
  let fetchObserverableLiveMissingData;
  let gqlQuery;
  let query;
  let queryMissingData;
  let gqlQueryMissingData;
  let liveQueryMissingData;
  let gqlLiveQueryMissingData;
  let release;
  let renderPolicy: RenderPolicy;
  let store;
  const variables = {
    id: '4',
  };

  beforeEach(() => {
    store = new Store(new RecordSource(), {gcReleaseBufferSize: 0});
    environment = createMockEnvironment({store});
    QueryResource = getQueryResourceForEnvironment(environment);
    gqlQuery = graphql`
      query QueryResourceTest1Query($id: ID!) {
        node(id: $id) {
          ... on User {
            id
          }
        }
      }
    `;
    gqlQueryMissingData = graphql`
      query QueryResourceTest2Query($id: ID!) {
        node(id: $id) {
          ... on User {
            id
            name
          }
        }
      }
    `;

    query = createOperationDescriptor(gqlQuery, variables, {force: true});
    queryMissingData = createOperationDescriptor(
      gqlQueryMissingData,
      variables,
      {force: true},
    );

    gqlLiveQueryMissingData = graphql`
      query QueryResourceTest10Query($id: ID!)
      @client_polling(interval: 10000) {
        node(id: $id) {
          ... on User {
            id
            name
          }
        }
      }
    `;
    liveQueryMissingData = createOperationDescriptor(
      gqlLiveQueryMissingData,
      variables,
      {force: true},
    );

    environment.commitPayload(query, {
      node: {
        __typename: 'User',
        id: '4',
      },
    });

    fetchObservable = fetchQuery(environment, query);
    fetchObservableMissingData = fetchQuery(environment, queryMissingData);
    fetchObserverableLiveMissingData = fetchQuery(
      environment,
      liveQueryMissingData,
    );

    release = jest.fn<ReadonlyArray<unknown>, unknown>();
    environment.retain.mockImplementation((...args) => {
      return {
        dispose: release,
      };
    });

    renderPolicy = 'partial';
  });

  describe('prepare', () => {
    describe('default fetch policy for exec-time resolver queries', () => {
      it('uses store-and-network when exec-time resolvers are enabled', () => {
        const execTimeRequest = {
          ...gqlQuery,
          operation: {
            ...gqlQuery.operation,
            use_exec_time_resolvers: true,
          },
        };
        const execTimeQuery = createOperationDescriptor(
          execTimeRequest,
          variables,
          {force: true},
        );

        QueryResource.prepare(
          execTimeQuery,
          fetchQuery(environment, execTimeQuery),
          null,
          renderPolicy,
        );

        expect(
          environment.mock.isLoading(
            execTimeQuery.request.node,
            execTimeQuery.request.variables,
            {force: true},
          ),
        ).toBe(true);
      });

      it('uses store-only for a client-only query with a disabled provider', () => {
        const clientRequest = {
          ...gqlQueryMissingData,
          operation: {
            ...gqlQueryMissingData.operation,
            exec_time_resolvers_enabled_provider: {get: () => false},
          },
          params: {
            ...gqlQueryMissingData.params,
            cacheID: 'client-query',
            id: null,
            text: null,
          },
        };
        const clientQuery = createOperationDescriptor(
          clientRequest,
          variables,
          {force: true},
        );

        QueryResource.prepare(
          clientQuery,
          fetchQuery(environment, clientQuery),
          null,
          renderPolicy,
        );

        expect(
          environment.mock.isLoading(
            clientQuery.request.node,
            clientQuery.request.variables,
            {force: true},
          ),
        ).toBe(false);
      });
    });

    describe('fetchPolicy: store-or-network', () => {
      beforeEach(() => {
        fetchPolicy = 'store-or-network';
      });

      describe('renderPolicy: partial', () => {
        beforeEach(() => {
          renderPolicy = 'partial';
        });
        it('should return result and not send a network request if all data is locally available', () => {
          expect(environment.check(query)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          const result = QueryResource.prepare(
            query,
            fetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(environment.execute).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should return result and send a network request if data is missing for the query', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          const result = QueryResource.prepare(
            queryMissingData,
            fetchObservableMissingData,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          });
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should suspend and send a network request if data for query is cached but stale', () => {
          environment.commitUpdate(storeProxy => {
            storeProxy.invalidateStore();
          });
          expect(environment.check(query)).toEqual({status: 'stale'});

          let thrown = false;
          try {
            QueryResource.prepare(
              query,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toBe(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should send a single network request when same query is read multiple times', () => {
          const result1 = QueryResource.prepare(
            queryMissingData,
            fetchObservableMissingData,
            fetchPolicy,
            renderPolicy,
          );

          // Assert query is temporarily retained during call to prepare
          expect(release).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          const result2 = QueryResource.prepare(
            queryMissingData,
            fetchObservableMissingData,
            fetchPolicy,
            renderPolicy,
          );

          // Assert query is still temporarily retained during second call to prepare
          expect(release).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          const expected = {
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          };
          expect(result1).toEqual(expected);
          expect(result2).toEqual(expected);
          expect(environment.execute).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors', () => {
          let thrown = false;
          let sink;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(s => {
            networkExecute();
            sink = s;
          });
          QueryResource.prepare(
            queryMissingData,
            errorFetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          if (!sink) {
            throw new Error('Expect sink to be defined');
          }
          try {
            sink.error(new Error('Oops'));
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);

          // Assert query is temporarily retained during call to prepare
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should return result and send a network request if data is missing for the query and observable returns synchronously', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          const networkExecute = jest.fn<[], unknown>();
          const syncFetchObservable = Observable.create<$FlowFixMe>(sink => {
            environment.commitPayload(queryMissingData, {
              node: {
                __typename: 'User',
                id: '4',
                name: 'User 4',
              },
            });
            const snapshot = environment.lookup(queryMissingData.fragment);
            networkExecute();
            sink.next(snapshot as $FlowFixMe);
            sink.complete();
          });
          const result = QueryResource.prepare(
            queryMissingData,
            syncFetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          });
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors synchronously', () => {
          let thrown = false;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(sink => {
            networkExecute();
            sink.error(new Error('Oops'));
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        describe('when using fragments', () => {
          it('should return result and not send a network request if all data is locally available', () => {
            graphql`
              fragment QueryResourceTest1Fragment on User {
                id
              }
            `;

            const UserQuery = graphql`
              query QueryResourceTest3Query($id: ID!) {
                node(id: $id) {
                  __typename
                  ...QueryResourceTest1Fragment @dangerously_unaliased_fixme
                }
              }
            `;
            const queryWithFragments = createOperationDescriptor(
              UserQuery,
              variables,
              {force: true},
            );
            const fetchObservableWithFragments = fetchQuery(
              environment,
              queryWithFragments,
            );
            expect(environment.check(queryWithFragments)).toEqual({
              fetchTime: null,
              status: 'available',
            });

            const result = QueryResource.prepare(
              queryWithFragments,
              fetchObservableWithFragments,
              fetchPolicy,
              renderPolicy,
            );
            expect(result).toEqual({
              cacheIdentifier: expect.any(String),
              fragmentNode: queryWithFragments.fragment.node,
              fragmentRef: {
                __fragmentOwner: queryWithFragments.request,
                __fragments: {
                  QueryResourceTest3Query: variables,
                },
                __id: ROOT_ID,
              },
              operation: queryWithFragments,
            });
            expect(environment.execute).toBeCalledTimes(0);
            expect(environment.retain).toBeCalledTimes(1);

            // Assert that query is released after enough time has passed without
            // calling QueryResource.retain
            jest.runAllTimers();
            expect(release).toBeCalledTimes(1);
          });

          it('should return result and send a network request when some data is missing in fragment', () => {
            graphql`
              fragment QueryResourceTest2Fragment on User {
                id
                username
              }
            `;
            const UserQuery = graphql`
              query QueryResourceTest4Query($id: ID!) {
                node(id: $id) {
                  __typename
                  ...QueryResourceTest2Fragment @dangerously_unaliased_fixme
                }
              }
            `;
            const queryWithFragments = createOperationDescriptor(
              UserQuery,
              variables,
              {force: true},
            );
            const fetchObservableWithFragments = fetchQuery(
              environment,
              queryWithFragments,
            );
            expect(environment.check(queryWithFragments)).toEqual({
              status: 'missing',
            });

            const result = QueryResource.prepare(
              queryWithFragments,
              fetchObservableWithFragments,
              fetchPolicy,
              renderPolicy,
            );
            expect(result).toEqual({
              cacheIdentifier: expect.any(String),
              fragmentNode: queryWithFragments.fragment.node,
              fragmentRef: {
                __fragmentOwner: queryWithFragments.request,
                __fragments: {
                  QueryResourceTest4Query: variables,
                },
                __id: ROOT_ID,
              },
              operation: queryWithFragments,
            });
            expect(environment.execute).toBeCalledTimes(1);
            expect(environment.retain).toBeCalledTimes(1);

            // Assert that query is released after enough time has passed without
            // calling QueryResource.retain
            jest.runAllTimers();
            expect(release).toBeCalledTimes(1);
          });

          it('should suspend and send a network request if data for query is cached but stale', () => {
            graphql`
              fragment QueryResourceTest3Fragment on User {
                id
              }
            `;
            const UserQuery = graphql`
              query QueryResourceTest5Query($id: ID!) {
                node(id: $id) {
                  __typename
                  ...QueryResourceTest3Fragment @dangerously_unaliased_fixme
                }
              }
            `;
            const queryWithFragments = createOperationDescriptor(
              UserQuery,
              variables,
              {force: true},
            );
            environment.commitPayload(queryWithFragments, {
              node: {
                __typename: 'User',
                id: '4',
              },
            });
            const fetchObservableWithFragments = fetchQuery(
              environment,
              queryWithFragments,
            );

            environment.commitUpdate(storeProxy => {
              storeProxy.invalidateStore();
            });
            expect(environment.check(queryWithFragments)).toEqual({
              status: 'stale',
            });

            let thrown = false;
            try {
              QueryResource.prepare(
                queryWithFragments,
                fetchObservableWithFragments,
                fetchPolicy,
                renderPolicy,
              );
            } catch (promise) {
              expect(typeof promise.then).toBe('function');
              thrown = true;
            }
            expect(environment.execute).toBeCalledTimes(1);
            expect(environment.retain).toBeCalledTimes(1);
            expect(thrown).toBe(true);

            // Assert that query is released after enough time has passed without
            // calling QueryResource.retain
            jest.runAllTimers();
            expect(release).toBeCalledTimes(1);
          });
        });
      });

      describe('renderPolicy: full', () => {
        beforeEach(() => {
          renderPolicy = 'full';
        });
        it('should return result and not send a network request if all data is locally available', () => {
          expect(environment.check(query)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          const result = QueryResource.prepare(
            query,
            fetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(environment.execute).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should suspend and send a network request if data is missing for the query', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          let thrown = false;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toBe(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should cache a single promise and send a single network request when same query is read multiple times', () => {
          let promise1;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (p) {
            expect(typeof p.then).toBe('function');
            promise1 = p;
          }

          // Assert query is temporarily retained during call to prepare
          expect(release).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          let promise2;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (p) {
            expect(typeof p.then).toBe('function');
            promise2 = p;
          }

          // Assert query is still temporarily retained during second call to prepare
          expect(release).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that same promise was thrown
          expect(promise1).toBe(promise2);
          // Assert that network was only called once
          expect(environment.execute).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors', () => {
          let thrown = false;
          let sink;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(s => {
            networkExecute();
            sink = s;
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (p) {
            expect(typeof p.then).toBe('function');
          }

          if (!sink) {
            throw new Error('Expect sink to be defined');
          }

          try {
            sink.error(new Error('Oops'));
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);

          // Assert query is temporarily retained during call to prepare
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should return result and send a network request if data is missing for the query and observable returns synchronously', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          const networkExecute = jest.fn<[], unknown>();
          const syncFetchObservable = Observable.create<$FlowFixMe>(sink => {
            environment.commitPayload(queryMissingData, {
              node: {
                __typename: 'User',
                id: '4',
                name: 'User 4',
              },
            });
            const snapshot = environment.lookup(queryMissingData.fragment);
            networkExecute();
            sink.next(snapshot as $FlowFixMe);
            sink.complete();
          });
          const result = QueryResource.prepare(
            queryMissingData,
            syncFetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          });
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors synchronously', () => {
          let thrown = false;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(sink => {
            networkExecute();
            sink.error(new Error('Oops'));
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should keep old promise cache when query observable is unsubscribed, since the request is not canceled', () => {
          let promise1;
          let subscription;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
              {
                start: sub => {
                  subscription = sub;
                },
              },
            );
          } catch (p) {
            expect(typeof p.then).toBe('function');
            promise1 = p;
          }
          subscription && subscription.unsubscribe();

          // Assert cache is not cleared
          expect(
            QueryResource.TESTS_ONLY__getCacheEntry(
              queryMissingData,
              fetchPolicy,
              renderPolicy,
            ),
          ).not.toBeUndefined();

          let promise2;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (p) {
            expect(typeof p.then).toBe('function');
            promise2 = p;
          }

          // Assert that it didn't make a second request
          expect(promise1).toBe(promise2);
          expect(environment.execute).toBeCalledTimes(1);
        });

        describe('when using fragments', () => {
          it('should return result and not send a network request if all data is locally available', () => {
            graphql`
              fragment QueryResourceTest4Fragment on User {
                id
              }
            `;
            const UserQuery = graphql`
              query QueryResourceTest6Query($id: ID!) {
                node(id: $id) {
                  __typename
                  ...QueryResourceTest4Fragment @dangerously_unaliased_fixme
                }
              }
            `;
            const queryWithFragments = createOperationDescriptor(
              UserQuery,
              variables,
              {force: true},
            );
            const fetchObservableWithFragments = fetchQuery(
              environment,
              queryWithFragments,
            );
            expect(environment.check(queryWithFragments)).toEqual({
              fetchTime: null,
              status: 'available',
            });

            const result = QueryResource.prepare(
              queryWithFragments,
              fetchObservableWithFragments,
              fetchPolicy,
              renderPolicy,
            );
            expect(result).toEqual({
              cacheIdentifier: expect.any(String),
              fragmentNode: queryWithFragments.fragment.node,
              fragmentRef: {
                __fragmentOwner: queryWithFragments.request,
                __fragments: {
                  QueryResourceTest6Query: variables,
                },
                __id: ROOT_ID,
              },
              operation: queryWithFragments,
            });
            expect(environment.execute).toBeCalledTimes(0);
            expect(environment.retain).toBeCalledTimes(1);

            // Assert that query is released after enough time has passed without
            // calling QueryResource.retain
            jest.runAllTimers();
            expect(release).toBeCalledTimes(1);
          });

          it('should suspend and send a network request when some data is missing in fragment', () => {
            graphql`
              fragment QueryResourceTest5Fragment on User {
                id
                username
              }
            `;
            const UserQuery = graphql`
              query QueryResourceTest7Query($id: ID!) {
                node(id: $id) {
                  __typename
                  ...QueryResourceTest5Fragment @dangerously_unaliased_fixme
                }
              }
            `;
            const queryWithFragments = createOperationDescriptor(
              UserQuery,
              variables,
              {force: true},
            );
            const fetchObservableWithFragments = fetchQuery(
              environment,
              queryWithFragments,
            );
            expect(environment.check(queryWithFragments)).toEqual({
              status: 'missing',
            });

            let thrown = false;
            try {
              QueryResource.prepare(
                queryWithFragments,
                fetchObservableWithFragments,
                fetchPolicy,
                renderPolicy,
              );
            } catch (p) {
              expect(typeof p.then).toBe('function');
              thrown = true;
            }

            expect(environment.execute).toBeCalledTimes(1);
            expect(environment.retain).toBeCalledTimes(1);
            expect(thrown).toEqual(true);

            // Assert that query is released after enough time has passed without
            // calling QueryResource.retain
            jest.runAllTimers();
            expect(release).toBeCalledTimes(1);
          });
        });

        describe('when using incremental data', () => {
          it('should suspend and send a network request when some data is missing in fragment', () => {
            graphql`
              fragment QueryResourceTest6Fragment on User {
                id
                username
              }
            `;
            const UserQuery = graphql`
              query QueryResourceTest8Query($id: ID!) {
                node(id: $id) {
                  __typename
                  id
                  ...QueryResourceTest6Fragment
                    @dangerously_unaliased_fixme
                    @defer
                }
              }
            `;
            const queryWithFragments = createOperationDescriptor(
              UserQuery,
              variables,
              {force: true},
            );
            const fetchObservableWithFragments = fetchQuery(
              environment,
              queryWithFragments,
            );
            expect(environment.check(queryWithFragments)).toEqual({
              status: 'missing',
            });

            // Should suspend until first payload is received
            let thrown = false;
            try {
              QueryResource.prepare(
                queryWithFragments,
                fetchObservableWithFragments,
                fetchPolicy,
                renderPolicy,
              );
            } catch (p) {
              expect(typeof p.then).toBe('function');
              thrown = true;
            }

            expect(environment.execute).toBeCalledTimes(1);
            expect(environment.retain).toBeCalledTimes(1);
            expect(thrown).toEqual(true);

            // Resolve first payload
            environment.mock.nextValue(queryWithFragments, {
              data: {
                node: {
                  __typename: 'User',
                  id: '4',
                },
              },
            });
            // Data should still be missing after first payload
            expect(environment.check(queryWithFragments)).toEqual({
              status: 'missing',
            });

            // Calling prepare again shouldn't suspend; the fragment with
            // the deferred data would suspend further down the tree
            const result = QueryResource.prepare(
              queryWithFragments,
              fetchObservableWithFragments,
              fetchPolicy,
              renderPolicy,
            );
            const expectedResult = {
              cacheIdentifier: expect.any(String),
              fragmentNode: queryWithFragments.fragment.node,
              fragmentRef: {
                __fragmentOwner: queryWithFragments.request,
                __fragments: {
                  QueryResourceTest8Query: variables,
                },
                __id: ROOT_ID,
              },
              operation: queryWithFragments,
            };
            expect(result).toEqual(expectedResult);

            expect(environment.execute).toBeCalledTimes(1);
            expect(environment.retain).toBeCalledTimes(1);
            expect(thrown).toEqual(true);

            // Resolve deferred payload
            environment.mock.nextValue(queryWithFragments, {
              data: {
                __typename: 'User',
                id: '1',
                username: 'zuck',
              },
              label: 'QueryResourceTest8Query$defer$QueryResourceTest6Fragment',
              path: ['node'],
            });
            // Data should not be missing anymore
            expect(environment.check(queryWithFragments)).toEqual({
              fetchTime: null,
              status: 'available',
            });

            // Calling prepare again should return same result
            const result2 = QueryResource.prepare(
              queryWithFragments,
              fetchObservableWithFragments,
              fetchPolicy,
              renderPolicy,
            );
            expect(result2).toEqual(expectedResult);

            // Assert that query is released after enough time has passed without
            // calling QueryResource.retain
            jest.runAllTimers();
            expect(release).toBeCalledTimes(1);
          });
        });
      });
    });

    describe('fetchPolicy: store-and-network', () => {
      beforeEach(() => {
        fetchPolicy = 'store-and-network';
      });

      describe('renderPolicy: partial', () => {
        beforeEach(() => {
          renderPolicy = 'partial';
        });

        it('should return result and send a network request even when data is locally available', () => {
          expect(environment.check(query)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          const result = QueryResource.prepare(
            query,
            fetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should return result and send a network request if data is missing for the query', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          const result = QueryResource.prepare(
            queryMissingData,
            fetchObservableMissingData,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          });
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should suspend and send a network request if data for query is cached but stale', () => {
          environment.commitUpdate(storeProxy => {
            storeProxy.invalidateStore();
          });
          expect(environment.check(query)).toEqual({status: 'stale'});

          let thrown = false;
          try {
            QueryResource.prepare(
              query,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toBe(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should send a single network request when same query is read multiple times', () => {
          const result1 = QueryResource.prepare(
            queryMissingData,
            fetchObservableMissingData,
            fetchPolicy,
            renderPolicy,
          );
          const result2 = QueryResource.prepare(
            queryMissingData,
            fetchObservableMissingData,
            fetchPolicy,
            renderPolicy,
          );
          const expected = {
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          };
          expect(result1).toEqual(expected);
          expect(result2).toEqual(expected);
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors', () => {
          let thrown = false;
          let sink;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(s => {
            networkExecute();
            sink = s;
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
            if (!sink) {
              throw new Error('Expect sink to be defined');
            }
            sink.error(new Error('Oops'));
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          // Assert query is temporarily retained during call to prepare
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should return result and send a network request if data is missing for the query and observable returns synchronously', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          const networkExecute = jest.fn<[], unknown>();
          const syncFetchObservable = Observable.create<$FlowFixMe>(sink => {
            environment.commitPayload(queryMissingData, {
              node: {
                __typename: 'User',
                id: '4',
                name: 'User 4',
              },
            });
            const snapshot = environment.lookup(queryMissingData.fragment);
            networkExecute();
            sink.next(snapshot as $FlowFixMe);
            sink.complete();
          });
          const result = QueryResource.prepare(
            queryMissingData,
            syncFetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          });
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors synchronously', () => {
          let thrown = false;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(sink => {
            networkExecute();
            sink.error(new Error('Oops'));
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });
      });

      describe('renderPolicy: full', () => {
        beforeEach(() => {
          renderPolicy = 'full';
        });

        it('should return result and send a network request even when data is locally available', () => {
          expect(environment.check(query)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          const result = QueryResource.prepare(
            query,
            fetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should suspend and send a network request if data is missing for the query', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          let thrown;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (p) {
            expect(typeof p.then).toEqual('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toEqual(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should cache a single promise and send a single network request when same query is read multiple times', () => {
          let promise1;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (p) {
            expect(typeof p.then).toBe('function');
            promise1 = p;
          }

          // Assert query is temporarily retained during call to prepare
          expect(release).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          let promise2;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (p) {
            expect(typeof p.then).toBe('function');
            promise2 = p;
          }

          // Assert query is still temporarily retained during second call to prepare
          expect(release).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that same promise was thrown
          expect(promise1).toBe(promise2);
          // Assert that network was only called once
          expect(environment.execute).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors', () => {
          let thrown = false;
          let sink;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(s => {
            networkExecute();
            sink = s;
          });
          551;
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (p) {
            expect(typeof p.then).toBe('function');
          }
          if (!sink) {
            throw new Error('Expect sink to be defined');
          }
          try {
            sink.error(new Error('Oops'));
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          // Assert query is temporarily retained during call to prepare
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should return result and send a network request if data is missing for the query and observable returns synchronously', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          const networkExecute = jest.fn<[], unknown>();
          const syncFetchObservable = Observable.create<$FlowFixMe>(sink => {
            environment.commitPayload(queryMissingData, {
              node: {
                __typename: 'User',
                id: '4',
                name: 'User 4',
              },
            });
            const snapshot = environment.lookup(queryMissingData.fragment);
            networkExecute();
            sink.next(snapshot as $FlowFixMe);
            sink.complete();
          });
          const result = QueryResource.prepare(
            queryMissingData,
            syncFetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          });
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors synchronously', () => {
          let thrown = false;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(sink => {
            networkExecute();
            sink.error(new Error('Oops'));
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });
      });
    });

    describe('fetchPolicy: network-only', () => {
      beforeEach(() => {
        fetchPolicy = 'network-only';
      });

      describe('renderPolicy: partial', () => {
        beforeEach(() => {
          renderPolicy = 'partial';
        });
        it('should suspend and send a network request even if data is available locally', () => {
          expect(environment.check(query)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          let thrown = false;
          try {
            QueryResource.prepare(
              query,
              fetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toBe(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should suspend and send a network request when query has missing data', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          let thrown = false;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toBe(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should suspend and send a network request if data for query is cached but stale', () => {
          environment.commitUpdate(storeProxy => {
            storeProxy.invalidateStore();
          });
          expect(environment.check(query)).toEqual({status: 'stale'});

          let thrown = false;
          try {
            QueryResource.prepare(
              query,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toBe(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors', () => {
          let thrownPromise = false;
          let thrownError = false;
          let sink;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(s => {
            networkExecute();
            sink = s;
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrownPromise = true;
          }
          expect(thrownPromise).toEqual(true);
          if (!sink) {
            throw new Error('Expect sink to be defined');
          }
          sink.error(new Error('Oops'));

          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrownError = true;
          }
          expect(thrownError).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          // Assert query is temporarily retained during call to prepare
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should return result if network observable returns synchronously', () => {
          const networkExecute = jest.fn<[], unknown>();
          const syncFetchObservable = Observable.create<$FlowFixMe>(sink => {
            const snapshot = environment.lookup(query.fragment);
            networkExecute();
            sink.next(snapshot as $FlowFixMe);
            sink.complete();
          });
          const result = QueryResource.prepare(
            query,
            syncFetchObservable,
            fetchPolicy,
            renderPolicy,
          );

          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors synchronously', () => {
          let thrown = false;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(sink => {
            networkExecute();
            const error = new Error('Oops');
            sink.error(error);
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });
      });

      describe('renderPolicy: full', () => {
        beforeEach(() => {
          renderPolicy = 'full';
        });
        it('should suspend and send a network request even if data is available locally', () => {
          expect(environment.check(query)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          let thrown = false;
          try {
            QueryResource.prepare(
              query,
              fetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toBe(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should suspend and send a network request when query has missing data', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          let thrown = false;
          try {
            QueryResource.prepare(
              queryMissingData,
              fetchObservableMissingData,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrown = true;
          }
          expect(environment.execute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);
          expect(thrown).toBe(true);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors', () => {
          let thrownPromise = false;
          let thrownError = false;
          let sink;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(s => {
            networkExecute();
            sink = s;
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (promise) {
            expect(typeof promise.then).toBe('function');
            thrownPromise = true;
          }
          expect(thrownPromise).toEqual(true);
          if (!sink) {
            throw new Error('Expect sink to be defined');
          }
          sink.error(new Error('Oops'));

          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrownError = true;
          }
          expect(thrownError).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          // Assert query is temporarily retained during call to prepare
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should return result if network observable returns synchronously', () => {
          const networkExecute = jest.fn<[], unknown>();
          const syncFetchObservable = Observable.create<$FlowFixMe>(sink => {
            const snapshot = environment.lookup(query.fragment);
            networkExecute();
            sink.next(snapshot as $FlowFixMe);
            sink.complete();
          });
          const result = QueryResource.prepare(
            query,
            syncFetchObservable,
            fetchPolicy,
            renderPolicy,
          );

          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should throw error if network request errors synchronously', () => {
          let thrown = false;
          const networkExecute = jest.fn<[], unknown>();
          const errorFetchObservable = Observable.create<$FlowFixMe>(sink => {
            networkExecute();
            const error = new Error('Oops');
            sink.error(error);
          });
          try {
            QueryResource.prepare(
              queryMissingData,
              errorFetchObservable,
              fetchPolicy,
              renderPolicy,
            );
          } catch (e) {
            expect(e instanceof Error).toEqual(true);
            expect(e.message).toEqual('Oops');
            thrown = true;
          }
          expect(thrown).toEqual(true);
          expect(networkExecute).toBeCalledTimes(1);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });
      });
    });

    describe('fetchPolicy: store-only', () => {
      beforeEach(() => {
        fetchPolicy = 'store-only';
      });

      describe('renderPolicy: partial', () => {
        beforeEach(() => {
          renderPolicy = 'partial';
        });

        it('should not send network request if data is available locally', () => {
          expect(environment.check(query)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          const result = QueryResource.prepare(
            query,
            fetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(environment.execute).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should not send network request even if data is missing', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          const result = QueryResource.prepare(
            queryMissingData,
            fetchObservableMissingData,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          });
          expect(environment.execute).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should not send a network request if data for query is cached but stale', () => {
          environment.commitUpdate(storeProxy => {
            storeProxy.invalidateStore();
          });
          expect(environment.check(query)).toEqual({status: 'stale'});

          const result = QueryResource.prepare(
            query,
            fetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(environment.execute).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });
      });

      describe('renderPolicy: full', () => {
        beforeEach(() => {
          renderPolicy = 'full';
        });

        it('should not send network request if data is available locally', () => {
          expect(environment.check(query)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          const result = QueryResource.prepare(
            query,
            fetchObservable,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: query.fragment.node,
            fragmentRef: {
              __fragmentOwner: query.request,
              __fragments: {
                QueryResourceTest1Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: query,
          });
          expect(environment.execute).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });

        it('should not send network request even if data is missing', () => {
          expect(environment.check(queryMissingData)).toEqual({
            status: 'missing',
          });

          const result = QueryResource.prepare(
            queryMissingData,
            fetchObservableMissingData,
            fetchPolicy,
            renderPolicy,
          );
          expect(result).toEqual({
            cacheIdentifier: expect.any(String),
            fragmentNode: queryMissingData.fragment.node,
            fragmentRef: {
              __fragmentOwner: queryMissingData.request,
              __fragments: {
                QueryResourceTest2Query: variables,
              },
              __id: ROOT_ID,
            },
            operation: queryMissingData,
          });
          expect(environment.execute).toBeCalledTimes(0);
          expect(environment.retain).toBeCalledTimes(1);

          // Assert that query is released after enough time has passed without
          // calling QueryResource.retain
          jest.runAllTimers();
          expect(release).toBeCalledTimes(1);
        });
      });
    });
  });

  describe('retain', () => {
    beforeEach(() => {
      fetchPolicy = 'store-or-network';
    });

    it('should permanently retain the query that was retained during `prepare`', () => {
      const result = QueryResource.prepare(
        queryMissingData,
        fetchObservableMissingData,
        fetchPolicy,
        renderPolicy,
      );
      expect(environment.execute).toBeCalledTimes(1);
      expect(environment.retain).toBeCalledTimes(1);
      expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

      // Data retention ownership is established permanently:
      // - Temporary retain is released
      // - New permanent retain is established
      const disposable = QueryResource.retain(result);
      expect(release).toBeCalledTimes(0);
      expect(environment.retain).toBeCalledTimes(1);
      expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

      // Running timers won't release the query since it has been
      // permanently retained
      jest.runAllTimers();
      expect(release).toBeCalledTimes(0);
      // Should not clear the cache entry
      expect(
        QueryResource.TESTS_ONLY__getCacheEntry(
          queryMissingData,
          fetchPolicy,
          renderPolicy,
        ),
      ).toBeDefined();

      // Assert that disposing releases the query
      disposable.dispose();
      expect(release).toBeCalledTimes(1);
      expect(environment.retain).toBeCalledTimes(1);
      expect(
        QueryResource.TESTS_ONLY__getCacheEntry(
          queryMissingData,
          fetchPolicy,
          renderPolicy,
        ),
      ).not.toBeDefined();
    });

    it('should auto-release if enough time has passed before `retain` is called after `prepare`', () => {
      const result = QueryResource.prepare(
        queryMissingData,
        fetchObservableMissingData,
        fetchPolicy,
        renderPolicy,
      );
      expect(environment.execute).toBeCalledTimes(1);
      expect(release).toBeCalledTimes(0);
      expect(environment.retain).toBeCalledTimes(1);
      expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

      // Running timers before calling `retain` auto-releases the query
      // retained during `read`
      jest.runAllTimers();
      expect(release).toBeCalledTimes(1);

      // Cache entry should be removed
      expect(
        QueryResource.TESTS_ONLY__getCacheEntry(
          queryMissingData,
          fetchPolicy,
          renderPolicy,
        ),
      ).toBeUndefined();

      // Calling retain after query has been auto-released should retain
      // the query again.
      const disposable = QueryResource.retain(result);
      expect(release).toBeCalledTimes(1);
      expect(environment.retain).toBeCalledTimes(2);
      expect(environment.retain.mock.calls[1][0]).toEqual(queryMissingData);

      // Assert that disposing releases the query
      disposable.dispose();
      expect(release).toBeCalledTimes(2);
      expect(environment.retain).toBeCalledTimes(2);
      expect(
        QueryResource.TESTS_ONLY__getCacheEntry(
          queryMissingData,
          fetchPolicy,
          renderPolicy,
        ),
      ).not.toBeDefined();
    });

    it("retains the query during `prepare` even if a network request wasn't started", () => {
      const result = QueryResource.prepare(
        query,
        fetchObservable,
        fetchPolicy,
        renderPolicy,
      );
      expect(environment.execute).toBeCalledTimes(0);
      expect(release).toBeCalledTimes(0);
      expect(environment.retain).toBeCalledTimes(1);
      expect(environment.retain.mock.calls[0][0]).toEqual(query);

      // Running timers before calling `retain` auto-releases the query
      // retained during `read`
      jest.runAllTimers();
      expect(release).toBeCalledTimes(1);

      // Calling retain should retain the query.
      const disposable = QueryResource.retain(result);
      expect(release).toBeCalledTimes(1);
      expect(environment.retain).toBeCalledTimes(2);
      expect(environment.retain.mock.calls[1][0]).toEqual(query);

      // Assert that disposing releases the query
      disposable.dispose();
      expect(release).toBeCalledTimes(2);
      expect(environment.retain).toBeCalledTimes(2);
    });

    it('does not cancel a non-live query after releasing a query that was retaned if request is still in flight', () => {
      const result = QueryResource.prepare(
        queryMissingData,
        fetchObservableMissingData,
        fetchPolicy,
        renderPolicy,
      );
      // Assert query is temporarily retained
      expect(release).toBeCalledTimes(0);
      expect(environment.retain).toBeCalledTimes(1);
      expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

      // Assert rerquest was started
      expect(environment.execute).toBeCalledTimes(1);
      expect(
        environment.mock.isLoading(
          queryMissingData.request.node,
          queryMissingData.request.variables,
          {force: true},
        ),
      ).toEqual(true);

      const disposable = QueryResource.retain(result);
      disposable.dispose();

      // Assert request was not canceled
      expect(
        environment.mock.isLoading(
          queryMissingData.request.node,
          queryMissingData.request.variables,
          {force: true},
        ),
      ).toEqual(true);
    });

    it('cancels a live query after releasing a query that was retaned if request is still in flight', () => {
      const result = QueryResource.prepare(
        liveQueryMissingData,
        fetchObserverableLiveMissingData,
        fetchPolicy,
        renderPolicy,
      );
      // Assert query is temporarily retained
      expect(release).toBeCalledTimes(0);
      expect(environment.retain).toBeCalledTimes(1);
      expect(environment.retain.mock.calls[0][0]).toEqual(liveQueryMissingData);

      // Assert rerquest was started
      expect(environment.execute).toBeCalledTimes(1);
      expect(
        environment.mock.isLoading(
          liveQueryMissingData.request.node,
          liveQueryMissingData.request.variables,
          {force: true},
        ),
      ).toEqual(true);

      const disposable = QueryResource.retain(result);
      disposable.dispose();

      // Assert request was canceled
      expect(
        environment.mock.isLoading(
          liveQueryMissingData.request.node,
          liveQueryMissingData.request.variables,
          {force: true},
        ),
      ).toEqual(false);
    });

    it('cancels an exec-time resolver query after releasing it while the request is still in flight', () => {
      const execTimeRequest = {
        ...gqlQueryMissingData,
        operation: {
          ...gqlQueryMissingData.operation,
          use_exec_time_resolvers: true,
        },
      };
      const execTimeQuery = createOperationDescriptor(
        execTimeRequest,
        variables,
        {force: true},
      );
      const result = QueryResource.prepare(
        execTimeQuery,
        fetchQuery(environment, execTimeQuery),
        fetchPolicy,
        renderPolicy,
      );

      expect(
        environment.mock.isLoading(
          execTimeQuery.request.node,
          execTimeQuery.request.variables,
          {force: true},
        ),
      ).toBe(true);

      const disposable = QueryResource.retain(result);
      disposable.dispose();

      expect(
        environment.mock.isLoading(
          execTimeQuery.request.node,
          execTimeQuery.request.variables,
          {force: true},
        ),
      ).toBe(false);
    });

    describe('when retaining the same query multiple times', () => {
      it('correctly retains query after temporarily retaining multiple times during render phase', () => {
        QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is temporarily retained
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        const result = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is still temporarily retained
        expect(release).toHaveBeenCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        // Assert network is only called once
        expect(environment.execute).toBeCalledTimes(1);

        // Permanently retain the second result, which is what would happen
        // if the second render got committed
        const disposable = QueryResource.retain(result);

        // Assert permanent retain is established and nothing is released
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Assert that disposing correctly releases the query
        disposable.dispose();
        expect(release).toBeCalledTimes(1);
        expect(environment.retain).toBeCalledTimes(1);
      });

      it('correctly retains query after temporarily retaining multiple times during render phase and auto-release timers have expired', () => {
        QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is temporarily retained
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        const result = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is still temporarily retained
        expect(release).toHaveBeenCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        // Assert network is only called once
        expect(environment.execute).toBeCalledTimes(1);

        // Permanently retain the second result, which is what would happen
        // if the second render got committed
        const disposable = QueryResource.retain(result);

        // Assert permanent retain is established and nothing is released
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Running timers won't release the query since it has been
        // permanently retained
        jest.runAllTimers();
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Assert that disposing correctly releases the query
        disposable.dispose();
        expect(release).toBeCalledTimes(1);
        expect(environment.retain).toBeCalledTimes(1);
      });

      it('temporarily retains the query every time a render occurs, even if it has already been permanently retained', () => {
        const result = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is temporarily retained
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        // Assert network is called once
        expect(environment.execute).toBeCalledTimes(1);

        // Permanently retain the result, which is what would happen
        // after the render commits
        const disposable = QueryResource.retain(result);

        // Assert permanent retain is established and nothing is released
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Running timers won't release the query since it has been
        // permanently retained
        jest.runAllTimers();
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Simulate rendering a second time, but without committing
        QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );

        // Assert query is still retained
        expect(release).toHaveBeenCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        // Assert that disposing the first disposable doesn't release the
        // query since it's still temporarily retained
        disposable.dispose();
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Assert that if the render never commits, the temporary retain
        // is released.
        jest.runAllTimers();
        expect(release).toBeCalledTimes(1);
        expect(environment.retain).toBeCalledTimes(1);
      });

      it("when same query commits twice, should not release the query before all callers have released it and auto-release timers haven't expired", () => {
        // NOTE: This simulates 2 separate query components mounting
        // simultaneously

        let subscription1: Subscription = {
          closed: false,
          unsubscribe: () => {},
        };
        const result1 = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
          {
            start: sub => {
              subscription1 = sub;
              jest.spyOn(subscription1, 'unsubscribe');
            },
          },
        );
        // Assert query is temporarily retained
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        const result2 = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is still temporarily retained
        expect(release).toHaveBeenCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        // Assert network is only called once
        expect(environment.execute).toBeCalledTimes(1);

        const disposable1 = QueryResource.retain(result1);

        // Assert permanent retain is established and nothing is released
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        const disposable2 = QueryResource.retain(result2);

        // Assert permanent retain is still established
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Assert that disposing the first disposable doesn't release the query
        disposable1.dispose();
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(
          QueryResource.TESTS_ONLY__getCacheEntry(
            queryMissingData,
            fetchPolicy,
            renderPolicy,
          ),
        ).toBeDefined();
        // Assert request is still in flight
        expect(subscription1.unsubscribe).toBeCalledTimes(0);
        expect(
          environment.mock.isLoading(
            queryMissingData.request.node,
            queryMissingData.request.variables,
            {force: true},
          ),
        ).toEqual(true);

        // Assert that disposing the last disposable fully releases the query
        disposable2.dispose();
        expect(release).toBeCalledTimes(1);
        expect(environment.retain).toBeCalledTimes(1);
        expect(
          QueryResource.TESTS_ONLY__getCacheEntry(
            queryMissingData,
            fetchPolicy,
            renderPolicy,
          ),
        ).toBeUndefined();
        // Assert request is not canceled because it is not a live query
        expect(
          environment.mock.isLoading(
            queryMissingData.request.node,
            queryMissingData.request.variables,
            {force: true},
          ),
        ).toEqual(true);
        expect(subscription1.unsubscribe).toBeCalledTimes(0);
      });

      it('when same query commits twice, should not release the query before all callers have released it and auto-release timers have expired', () => {
        // NOTE: This simulates 2 separate query components mounting
        // simultaneously

        let subscription1: Subscription = {
          closed: false,
          unsubscribe: () => {},
        };
        const result1 = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
          {
            start: sub => {
              subscription1 = sub;
              jest.spyOn(subscription1, 'unsubscribe');
            },
          },
        );
        // Assert query is temporarily retained
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        const result2 = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is still temporarily retained
        expect(release).toHaveBeenCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        // Assert network is only called once
        expect(environment.execute).toBeCalledTimes(1);

        const disposable1 = QueryResource.retain(result1);

        // Assert permanent retain is established and nothing is released
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        const disposable2 = QueryResource.retain(result2);

        // Assert permanent retain is still established
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Running timers won't release the query since it has been
        // permanently retained
        jest.runAllTimers();
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Assert that disposing the first disposable doesn't release the query
        disposable1.dispose();
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(
          QueryResource.TESTS_ONLY__getCacheEntry(
            queryMissingData,
            fetchPolicy,
            renderPolicy,
          ),
        ).toBeDefined();
        // Assert request is still in flight
        expect(subscription1.unsubscribe).toBeCalledTimes(0);
        expect(
          environment.mock.isLoading(
            queryMissingData.request.node,
            queryMissingData.request.variables,
            {force: true},
          ),
        ).toEqual(true);

        // Assert that disposing the last disposable fully releases the query
        disposable2.dispose();
        expect(release).toBeCalledTimes(1);
        expect(environment.retain).toBeCalledTimes(1);
        expect(
          QueryResource.TESTS_ONLY__getCacheEntry(
            queryMissingData,
            fetchPolicy,
            renderPolicy,
          ),
        ).toBeUndefined();
        // Assert request is not canceled because it is not a live query
        expect(
          environment.mock.isLoading(
            queryMissingData.request.node,
            queryMissingData.request.variables,
            {force: true},
          ),
        ).toEqual(true);
        expect(subscription1.unsubscribe).toBeCalledTimes(0);
      });

      it('correctly retains query when releasing and re-retaining', () => {
        // NOTE: This simulates a query component unmounting and re-mounting

        const result1 = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is temporarily retained
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        // Assert network is called
        expect(environment.execute).toBeCalledTimes(1);

        // Assert permanent retain is established
        const disposable1 = QueryResource.retain(result1);
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Prepare the query again after it has been permanently retained.
        // This will happen if the query component is unmounting and re-mounting
        const result2 = QueryResource.prepare(
          queryMissingData,
          fetchObservableMissingData,
          fetchPolicy,
          renderPolicy,
        );
        // Assert query is still retained
        expect(release).toHaveBeenCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);
        expect(environment.retain.mock.calls[0][0]).toEqual(queryMissingData);

        // First disposable will be called when query component finally unmounts
        disposable1.dispose();

        // Assert that query is still temporarily retained by new render
        expect(release).toHaveBeenCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Permanently retain the query after the initial retain has been
        // disposed of. This will occur when the query component remounts.
        const disposable2 = QueryResource.retain(result2);
        expect(environment.retain).toBeCalledTimes(1);

        // Running timers won't release the query since it has been
        // permanently retained
        jest.runAllTimers();
        expect(release).toBeCalledTimes(0);
        expect(environment.retain).toBeCalledTimes(1);

        // Assert that disposing the last disposable fully releases the query
        disposable2.dispose();
        expect(release).toBeCalledTimes(1);
        expect(environment.retain).toBeCalledTimes(1);
      });
    });
  });
});

describe('QueryResource, with an environment meant for SSR', () => {
  let environment;
  let QueryResource;
  let fetchPolicy: ?FetchPolicy;
  let fetchObservable;
  let gqlQuery;
  let query;
  let release;
  let renderPolicy: RenderPolicy;
  const variables = {
    id: '4',
  };

  beforeEach(() => {
    environment = createMockEnvironment({
      isServer: true,
      store: new Store(new RecordSource(), {gcReleaseBufferSize: 0}),
    });
    QueryResource = getQueryResourceForEnvironment(environment);
    gqlQuery = graphql`
      query QueryResourceTest9Query($id: ID!) {
        node(id: $id) {
          ... on User {
            id
          }
        }
      }
    `;
    query = createOperationDescriptor(gqlQuery, variables, {force: true});
    environment.commitPayload(query, {
      node: {
        __typename: 'User',
        id: '4',
      },
    });

    fetchObservable = fetchQuery(environment, query);

    release = jest.fn<ReadonlyArray<unknown>, unknown>();
    environment.retain.mockImplementation((...args) => {
      return {
        dispose: release,
      };
    });

    renderPolicy = 'partial';
  });

  describe('prepare', () => {
    it('does not attempt to temporarily retain the query in a server environment', () => {
      expect(environment.check(query)).toEqual({
        fetchTime: null,
        status: 'available',
      });

      jest.useFakeTimers();
      const result = QueryResource.prepare(
        query,
        fetchObservable,
        fetchPolicy,
        renderPolicy,
      );
      expect(result).toEqual({
        cacheIdentifier: expect.any(String),
        fragmentNode: query.fragment.node,
        fragmentRef: {
          __fragmentOwner: query.request,
          __fragments: {
            QueryResourceTest9Query: variables,
          },
          __id: ROOT_ID,
        },
        operation: query,
      });
      expect(environment.execute).not.toHaveBeenCalled();
      expect(environment.retain).not.toHaveBeenCalled();
      jest.runAllTimers();
      expect(release).not.toHaveBeenCalled();
      expect(setTimeout).not.toHaveBeenCalled();
    });
  });
});
