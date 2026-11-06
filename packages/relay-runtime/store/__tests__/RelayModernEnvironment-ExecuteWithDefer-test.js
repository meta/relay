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
import type {
  GraphQLResponse,
  PayloadExtensions,
} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {
  HandleFieldPayload,
  RecordSourceProxy,
  Snapshot,
  TaskPriority,
} from 'relay-runtime/store/RelayStoreTypes';
import type {RequestParameters} from 'relay-runtime/util/RelayConcreteNode';
import type {
  CacheConfig,
  Variables,
} from 'relay-runtime/util/RelayRuntimeTypes';

const {
  MultiActorEnvironment,
  getActorIdentifier,
} = require('relay-runtime/multi-actor-environment');
const RelayNetwork = require('relay-runtime/network/RelayNetwork');
const RelayObservable = require('relay-runtime/network/RelayObservable');
const {graphql} = require('relay-runtime/query/GraphQLTag');
const RelayModernEnvironment = require('relay-runtime/store/RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('relay-runtime/store/RelayModernOperationDescriptor');
const {
  createReaderSelector,
} = require('relay-runtime/store/RelayModernSelector');
const RelayModernStore = require('relay-runtime/store/RelayModernStore');
const RelayRecordSource = require('relay-runtime/store/RelayRecordSource');
const {
  disallowWarnings,
  expectToWarn,
  expectToWarnMany,
} = require('relay-test-utils-internal');

disallowWarnings();

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'execute() a query with @defer',
  environmentType => {
    let callbacks;
    let complete;
    let dataSource;
    let environment;
    let error;
    let fetch;
    let fragment;
    let NameHandler;
    let next;
    let operation;
    let query;
    let selector;
    let source;
    let store;
    let variables;
    let handlerProvider;

    describe(environmentType, () => {
      beforeEach(() => {
        query = graphql`
          query RelayModernEnvironmentExecuteWithDeferTestUserQuery($id: ID!) {
            node(id: $id) {
              ...RelayModernEnvironmentExecuteWithDeferTestUserFragment
                @dangerously_unaliased_fixme
                @defer(label: "UserFragment")
            }
          }
        `;
        fragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferTestUserFragment on User {
            id
            name @__clientField(handle: "name_handler")
          }
        `;
        variables = {id: '1'};
        operation = createOperationDescriptor(query, variables);
        selector = createReaderSelector(fragment, '1', {}, operation.request);

        NameHandler = {
          update(storeProxy: RecordSourceProxy, payload: HandleFieldPayload) {
            const record = storeProxy.get(payload.dataID);
            if (record != null) {
              const markup = record.getValue(payload.fieldKey);
              record.setValue(
                typeof markup === 'string' ? markup.toUpperCase() : null,
                payload.handleKey,
              );
            }
          },
        };

        complete = jest.fn<[], unknown>();
        error = jest.fn<[Error], unknown>();
        next = jest.fn<[GraphQLResponse], unknown>();
        callbacks = {complete, error, next};
        fetch = (
          _query: RequestParameters,
          _variables: Variables,
          _cacheConfig: CacheConfig,
        ): RelayObservable<GraphQLResponse> => {
          return RelayObservable.create<GraphQLResponse>(
            (sink: Sink<GraphQLResponse>) => {
              dataSource = sink;
            },
          );
        };
        source = RelayRecordSource.create();
        store = new RelayModernStore(source);
        handlerProvider = (name: string) => {
          switch (name) {
            case 'name_handler':
              return NameHandler;
          }
        };

        const multiActorEnvironment = new MultiActorEnvironment({
          createNetworkForActor: _actorID => RelayNetwork.create(fetch),
          createStoreForActor: _actorID => store,
          handlerProvider,
        });
        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                network: RelayNetwork.create(fetch),
                store,
                handlerProvider,
              });
      });

      it('calls next() and publishes the initial payload to the store', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        };
        dataSource.next(payload);
        jest.runAllTimers();

        expect(next.mock.calls.length).toBe(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        const snapshot = callback.mock.calls[0][0];
        expect(snapshot.isMissingData).toBe(true);
        expect(snapshot.data).toEqual({
          id: '1',
          name: undefined,
        });
      });

      it('processes deferred payloads', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();
        callback.mockClear();

        dataSource.next({
          data: {
            id: '1',
            __typename: 'User',
            name: 'joe',
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);
        const snapshot = callback.mock.calls[0][0];
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          id: '1',
          name: 'JOE',
        });
      });

      it('processes deferred payloads mixed with extensions-only payloads', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();
        callback.mockClear();

        const extensionsPayload: GraphQLResponse = {
          data: null,
          extensions: {foo: 'foo'} as PayloadExtensions,
        };
        dataSource.next(extensionsPayload);
        expect(callback).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(next.mock.calls[0][0]).toBe(extensionsPayload);
        next.mockClear();

        dataSource.next({
          data: {
            id: '1',
            __typename: 'User',
            name: 'joe',
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);
        const snapshot = callback.mock.calls[0][0];
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          id: '1',
          name: 'JOE',
        });
      });

      it('processes deferred payloads mixed with normalized response payloads', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();
        callback.mockClear();

        const extensionsPayload: GraphQLResponse = {
          data: {
            '1': {
              __id: '1',
              __typename: 'User',
              extra_data: 'Zuck',
            },
          },
          extensions: {is_normalized: true} as PayloadExtensions,
        };
        dataSource.next(extensionsPayload);
        expect(callback).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(next.mock.calls[0][0]).toBe(extensionsPayload);
        next.mockClear();

        dataSource.next({
          data: {
            id: '1',
            __typename: 'User',
            name: 'joe',
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);
        const snapshot = callback.mock.calls[0][0];
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          id: '1',
          name: 'JOE',
        });
      });

      it('processes deferred payloads with deduplicated fields', () => {
        // This option stops Relay from warning about fields missing from a
        // deferred response. Relay reads the latest `@defer` spec proposal's
        // format, which does not send duplicate fields in deferred responses
        // (https://github.com/graphql/defer-stream-wg/discussions/69), without
        // it; the option is for networks that transform such responses into
        // label/path payloads themselves.
        environment = new RelayModernEnvironment({
          network: RelayNetwork.create(fetch),
          store,
          handlerProvider,
          deferDeduplicatedFields: true,
        });

        const overlappingFieldsQuery = graphql`
          query RelayModernEnvironmentExecuteWithDeferTestUserOverlappingFieldsQuery(
            $id: ID!
          ) {
            node(id: $id) {
              ... on User {
                id
                name
                ...RelayModernEnvironmentExecuteWithDeferTestUserOverlappingFieldsFragment
                  @dangerously_unaliased_fixme
                  @defer(label: "UserFragment")
              }
            }
          }
        `;
        const overlappingFieldsFragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferTestUserOverlappingFieldsFragment on User {
            name
            alternate_name
          }
        `;

        const overlappingFieldsVariables = {id: '1'};
        const overlappingFieldsOperation = createOperationDescriptor(
          overlappingFieldsQuery,
          overlappingFieldsVariables,
        );
        const overlappingFieldsSelector = createReaderSelector(
          overlappingFieldsFragment,
          '1',
          {},
          overlappingFieldsOperation.request,
        );

        const initialSnapshot = environment.lookup(overlappingFieldsSelector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment
          .execute({operation: overlappingFieldsOperation})
          .subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              __typename: 'User',
              id: '1',
              name: 'joe',
            },
          },
        });

        jest.runAllTimers();
        next.mockClear();
        callback.mockClear();

        dataSource.next({
          data: {
            alternate_name: 'joe2',
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferTestUserOverlappingFieldsQuery$defer$UserFragment',
          path: ['node'],
          extensions: {
            is_final: true,
          },
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);
        const snapshot = callback.mock.calls[0][0];
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          name: 'joe',
          alternate_name: 'joe2',
        });
      });

      describe('Query with exec time resolvers', () => {
        let resolverOperation;
        beforeEach(() => {
          const resolverQuery = graphql`
            query RelayModernEnvironmentExecuteWithDeferTestResolverQuery(
              $id: ID!
            ) @exec_time_resolvers {
              node(id: $id) {
                ...RelayModernEnvironmentExecuteWithDeferTestUserFragment
                  @dangerously_unaliased_fixme
                  @defer(label: "UserFragment")
              }
            }
          `;
          variables = {id: '1'};
          resolverOperation = createOperationDescriptor(
            resolverQuery,
            variables,
          );
          selector = createReaderSelector(
            fragment,
            '1',
            {},
            resolverOperation.request,
          );
        });

        it('goes out of loading state if all initial payloads are received in an exec time query, but stay active when server or client is loading', () => {
          const initialSnapshot = environment.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(initialSnapshot, callback);

          environment
            .execute({operation: resolverOperation})
            .subscribe(callbacks);
          dataSource.next({
            data: {
              node: {
                id: '1',
                __typename: 'User',
              },
            },
          });
          jest.runAllTimers();
          next.mockClear();
          callback.mockClear();

          dataSource.next({
            data: {
              id: '1',
              __typename: 'User',
              name: 'joe',
            },
            label:
              'RelayModernEnvironmentExecuteWithDeferTestResolverQuery$defer$UserFragment',
            path: ['node'],
            extensions: {
              // The server response needs to contain a marker for the final incremental payload
              is_final: true,
            },
          });

          expect(complete).toBeCalledTimes(0);
          expect(error).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(1);
          expect(callback).toBeCalledTimes(1);
          const snapshot = callback.mock.calls[0][0];
          expect(snapshot.isMissingData).toBe(false);
          expect(snapshot.data).toEqual({
            id: '1',
            name: 'JOE',
          });

          // Server payloads have finished, but we are still waiting on the resolver payloads
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(true);

          // Finishes the exec time query
          callback.mockClear();
          next.mockClear();
          const extensionsPayload: GraphQLResponse = {
            data: {
              '1': {
                __id: '1',
                __typename: 'User',
                // __name_name_handler is where the name gets stored in the current test
                // due to the usage of the field handler
                __name_name_handler: 'Zuck',
              },
            },
            extensions: {
              is_normalized: true,
              is_final: true,
            } as PayloadExtensions,
          };
          dataSource.next(extensionsPayload);
          expect(callback).toBeCalledTimes(1);
          expect(callback.mock.calls[0][0].data).toEqual({
            id: '1',
            name: 'Zuck',
          });

          // At this point, the deferred payload and the exec time query payload
          // have all been resolved, the query should no longer be treated as pending
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(resolverOperation.request),
          ).toBe(null);
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(false);
        });

        it('Stay active when server or client is loading, when client finishes first', () => {
          const initialSnapshot = environment.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(initialSnapshot, callback);

          environment
            .execute({operation: resolverOperation})
            .subscribe(callbacks);

          const extensionsPayload: GraphQLResponse = {
            data: {
              '1': {
                id: '1',
                __id: '1',
                __typename: 'User',
                // __name_name_handler is where the name gets stored in the current test
                // due to the usage of the field handler
                __name_name_handler: 'Zuck',
              },
            },
            extensions: {
              is_normalized: true,
              is_final: true,
            } as PayloadExtensions,
          };

          dataSource.next(extensionsPayload);
          expect(callback).toBeCalledTimes(1);
          expect(callback.mock.calls[0][0].data).toEqual({
            id: '1',
            name: 'Zuck',
          });
          next.mockClear();
          callback.mockClear();

          // Client payloads have finished, but we are still waiting on the server payloads
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(true);
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(resolverOperation.request),
          ).not.toBe(null);
          dataSource.next({
            data: {
              node: {
                id: '1',
                __typename: 'User',
              },
            },
          });
          jest.runAllTimers();
          next.mockClear();
          callback.mockClear();
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(resolverOperation.request),
          ).not.toBe(null);

          dataSource.next({
            data: {
              id: '1',
              __typename: 'User',
              name: 'joe',
            },
            label:
              'RelayModernEnvironmentExecuteWithDeferTestResolverQuery$defer$UserFragment',
            path: ['node'],
            extensions: {
              // The server response needs to contain a marker for the final incremental payload
              is_final: true,
            },
          });

          expect(complete).toBeCalledTimes(0);
          expect(error).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(1);
          expect(callback).toBeCalledTimes(1);
          const snapshot = callback.mock.calls[0][0];
          expect(snapshot.isMissingData).toBe(false);
          expect(snapshot.data).toEqual({
            id: '1',
            name: 'JOE',
          });

          // At this point, the deferred payload and the exec time query payload
          // have all been resolved, the query should no longer be treated as pending
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(resolverOperation.request),
          ).toBe(null);
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(false);
        });

        it('marks the query as complete after the server completes first then the client finishes with `null` payload', () => {
          const initialSnapshot = environment.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(initialSnapshot, callback);

          environment
            .execute({operation: resolverOperation})
            .subscribe(callbacks);

          // Initial server payload but not complete
          dataSource.next({
            data: {
              node: {
                id: '1',
                __typename: 'User',
              },
            },
          });
          jest.runAllTimers();
          next.mockClear();
          callback.mockClear();

          // Empty exec time response but complete the exec time query
          const extensionsPayload: GraphQLResponse = {
            data: null,
            extensions: {
              is_normalized: true,
              is_final: true,
            } as PayloadExtensions,
          };

          dataSource.next(extensionsPayload);
          expect(callback).not.toBeCalled();
          next.mockClear();
          callback.mockClear();

          // Mark the server response as finished
          dataSource.next({
            data: {
              id: '1',
              __typename: 'User',
              name: 'joe',
            },
            label:
              'RelayModernEnvironmentExecuteWithDeferTestResolverQuery$defer$UserFragment',
            path: ['node'],
            extensions: {
              // The server response needs to contain a marker for the final incremental payload
              is_final: true,
            },
          });

          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(resolverOperation.request),
          ).toBe(null);
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(false);
        });

        it('marks the query as complete if there is no server request and the client payload is final', () => {
          const initialSnapshot = environment.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(initialSnapshot, callback);

          environment
            .execute({operation: resolverOperation})
            .subscribe(callbacks);

          const extensionsPayload: GraphQLResponse = {
            data: {
              '1': {
                id: '1',
                __id: '1',
                __typename: 'User',
                // __name_name_handler is where the name gets stored in the current test
                // due to the usage of the field handler
                __name_name_handler: 'Zuck',
              },
            },
            extensions: {
              is_normalized: true,
              is_final: true,
              is_client_only: true,
            } as PayloadExtensions,
          };

          dataSource.next(extensionsPayload);
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(resolverOperation.request),
          ).toBe(null);
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(false);
        });

        it('marks the query as complete if there is no server request and the client payload is final with `null` payload', () => {
          const initialSnapshot = environment.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(initialSnapshot, callback);

          environment
            .execute({operation: resolverOperation})
            .subscribe(callbacks);

          const extensionsPayload: GraphQLResponse = {
            data: null,
            extensions: {
              is_normalized: true,
              is_final: true,
              is_client_only: true,
            } as PayloadExtensions,
          };

          dataSource.next(extensionsPayload);
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(resolverOperation.request),
          ).toBe(null);
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(false);
        });
      });

      describe('when using a scheduler', () => {
        let taskID;
        let tasks;
        let scheduler;
        let runTask;
        const priorityFn = jest.fn();

        beforeEach(() => {
          taskID = 0;
          tasks = new Map<string, () => void>();
          scheduler = {
            cancel: (id: string) => {
              tasks.delete(id);
            },
            schedule: (task: () => void, priority?: TaskPriority) => {
              priorityFn(priority);
              const id = String(taskID++);
              tasks.set(id, task);
              return id;
            },
          };
          runTask = () => {
            for (const [id, task] of tasks) {
              tasks.delete(id);
              task();
              break;
            }
          };
          const multiActorEnvironment = new MultiActorEnvironment({
            createNetworkForActor: _actorID => RelayNetwork.create(fetch),
            createStoreForActor: _actorID => store,
            handlerProvider,
            scheduler,
          });
          environment =
            environmentType === 'MultiActorEnvironment'
              ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
              : new RelayModernEnvironment({
                  network: RelayNetwork.create(fetch),
                  store,
                  handlerProvider,
                  scheduler,
                });
        });

        it('processes deferred payloads with scheduling', () => {
          const initialSnapshot = environment.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(initialSnapshot, callback);

          environment.execute({operation}).subscribe(callbacks);
          dataSource.next({
            data: {
              node: {
                id: '1',
                __typename: 'User',
              },
            },
          });
          expect(next).toBeCalledTimes(0);
          expect(callback).toBeCalledTimes(0);
          expect(tasks.size).toBe(1);

          expect(priorityFn).toBeCalledTimes(1);
          expect(priorityFn.mock.calls[0][0]).toBe('default');
          runTask();
          expect(tasks.size).toBe(0);
          expect(next).toBeCalledTimes(1);
          expect(callback).toBeCalledTimes(1);
          jest.runAllTimers();
          next.mockClear();
          callback.mockClear();
          priorityFn.mockClear();

          dataSource.next({
            data: {
              id: '1',
              __typename: 'User',
              name: 'joe',
            },
            label:
              'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
            path: ['node'],
          });
          expect(next).toBeCalledTimes(0);
          expect(callback).toBeCalledTimes(0);
          expect(tasks.size).toBe(1);
          expect(priorityFn).toBeCalledTimes(1);
          expect(priorityFn.mock.calls[0][0]).toBe('low');
          runTask();
          expect(tasks.size).toBe(0);

          expect(complete).toBeCalledTimes(0);
          expect(error).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(1);
          expect(callback).toBeCalledTimes(1);

          const snapshot = callback.mock.calls[0][0];
          expect(snapshot.isMissingData).toBe(false);
          expect(snapshot.data).toEqual({
            id: '1',
            name: 'JOE',
          });
        });

        it('processes deferred payloads that are available synchronously within the same scheduler step', () => {
          const initialSnapshot = environment.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(initialSnapshot, callback);

          environment.execute({operation}).subscribe(callbacks);
          dataSource.next([
            {
              data: {
                node: {
                  __typename: 'User',
                  id: '1',
                  name: 'joe',
                },
              },
            },
            {
              data: {
                id: '1',
                __typename: 'User',
                name: 'joe',
              },
              label:
                'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
              path: ['node'],
              extensions: {
                is_final: true,
              },
            },
          ]);
          expect(complete).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(0);
          expect(callback).toBeCalledTimes(0);
          expect(tasks.size).toBe(1);

          runTask();
          expect(tasks.size).toBe(0);
          expect(complete).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(1);
          expect(callback).toBeCalledTimes(1);
          jest.runAllTimers();

          const snapshot = callback.mock.calls[0][0];
          expect(snapshot.isMissingData).toBe(false);
          expect(snapshot.data).toEqual({
            id: '1',
            name: 'JOE',
          });
        });

        it('cancels processing of deferred payloads with scheduling', () => {
          const initialSnapshot = environment.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(initialSnapshot, callback);

          const subscription = environment
            .execute({operation})
            .subscribe(callbacks);
          dataSource.next({
            data: {
              node: {
                id: '1',
                __typename: 'User',
              },
            },
          });
          expect(next).toBeCalledTimes(0);
          expect(callback).toBeCalledTimes(0);
          expect(tasks.size).toBe(1);
          runTask();
          expect(next).toBeCalledTimes(1);
          expect(callback).toBeCalledTimes(1);
          jest.runAllTimers();
          next.mockClear();
          callback.mockClear();

          dataSource.next({
            data: {
              id: '1',
              __typename: 'User',
              name: 'joe',
            },
            label:
              'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
            path: ['node'],
          });
          expect(next).toBeCalledTimes(0);
          expect(callback).toBeCalledTimes(0);
          expect(tasks.size).toBe(1);

          subscription.unsubscribe();
          expect(tasks.size).toBe(0);
          expect(complete).toBeCalledTimes(0);
          expect(error).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(0);
          expect(callback).toBeCalledTimes(0);
        });
      });

      it('calls complete() when server completes after deferred payload resolves', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        });
        jest.runAllTimers();

        dataSource.next({
          data: {
            id: '1',
            __typename: 'User',
            name: 'joe',
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(2);
        expect(callback).toBeCalledTimes(2);

        dataSource.complete();

        expect(complete).toBeCalledTimes(1);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(2);
        expect(callback).toBeCalledTimes(2);
      });

      it('calls complete() when server completes before deferred payload resolves', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        });
        jest.runAllTimers();

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);

        dataSource.complete();

        expect(complete).toBeCalledTimes(1);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);
      });

      it('calls error() when server errors after deferred payload resolves', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        });
        jest.runAllTimers();

        dataSource.next({
          data: {
            id: '1',
            __typename: 'User',
            name: 'joe',
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(2);
        expect(callback).toBeCalledTimes(2);

        const err = new Error('wtf');
        dataSource.error(err);

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(1);
        expect(error.mock.calls[0][0]).toBe(err);
        expect(next).toBeCalledTimes(2);
        expect(callback).toBeCalledTimes(2);
      });

      it('calls error() when server errors before deferred payload resolves', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        });
        jest.runAllTimers();

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);

        const err = new Error('wtf');
        dataSource.error(err);

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(1);
        expect(error.mock.calls[0][0]).toBe(err);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);
      });

      it('calls error() when deferred payload is missing data', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
            },
          },
        });
        jest.runAllTimers();

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);

        dataSource.next({
          errors: [
            {
              message: 'wtf',
              locations: [],
              severity: 'ERROR',
            },
          ],
          label:
            'RelayModernEnvironmentExecuteWithDeferTestUserQuery$defer$UserFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(1);
        expect(error.mock.calls[0][0].message).toContain(
          'No data returned for operation `RelayModernEnvironmentExecuteWithDeferTestUserQuery`',
        );
        expect(next).toBeCalledTimes(1);
        expect(callback).toBeCalledTimes(1);
      });

      it('warns if executed in non-streaming mode and processes deferred selections', () => {
        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        const payload: GraphQLResponse = {
          data: {
            node: {
              id: '1',
              __typename: 'User',
              name: 'Alice',
            },
          },
          extensions: {
            is_final: true,
          } as PayloadExtensions,
        };
        expectToWarn(
          'RelayModernEnvironment: Operation `RelayModernEnvironmentExecuteWithDeferTestUserQuery` contains @defer/@stream ' +
            'directives but was executed in non-streaming mode. See ' +
            'https://fburl.com/relay-incremental-delivery-non-streaming-warning.',
          () => {
            dataSource.next(payload);
          },
        );
        jest.runAllTimers();

        expect(next.mock.calls.length).toBe(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();

        expect(callback.mock.calls.length).toBe(1);
        const snapshot = callback.mock.calls[0][0];
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          id: '1',
          name: 'ALICE',
        });
      });

      it('warns if nested defer is executed in non-streaming mode and processes deferred selections', () => {
        const query = graphql`
          query RelayModernEnvironmentExecuteWithDeferTestNestedUserQuery(
            $id: ID!
          ) {
            node(id: $id) {
              ...RelayModernEnvironmentExecuteWithDeferTestNestedUserFragment
                @dangerously_unaliased_fixme
                @defer(label: "UserFragment")
            }
          }
        `;
        const fragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferTestNestedUserFragment on User {
            id
            ...RelayModernEnvironmentExecuteWithDeferTestNestedInnerUserFragment
              @defer
          }
        `;
        const fragmentInner = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferTestNestedInnerUserFragment on User {
            name
            ...RelayModernEnvironmentExecuteWithDeferTestNestedInnerInner2UserFragment
              @defer
          }
        `;
        const fragmentInnerInner2 = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferTestNestedInnerInner2UserFragment on User {
            lastName
          }
        `;
        variables = {id: '1'};
        operation = createOperationDescriptor(query, variables);
        selector = createReaderSelector(fragment, '1', {}, operation.request);

        const initialSnapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialSnapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        const payload: GraphQLResponse = {
          data: {
            node: {
              id: '1',
              __typename: 'User',
              name: 'Alice',
              lastName: 'Bob',
            },
          },
          extensions: {
            is_final: true,
          } as PayloadExtensions,
        };

        expectToWarnMany(
          [
            'RelayModernEnvironment: Operation `RelayModernEnvironmentExecuteWithDeferTestNestedUserQuery` contains @defer/@stream ' +
              'directives but was executed in non-streaming mode. See ' +
              'https://fburl.com/relay-incremental-delivery-non-streaming-warning.',
            'RelayModernEnvironment: Operation `RelayModernEnvironmentExecuteWithDeferTestNestedUserQuery` contains @defer/@stream ' +
              'directives but was executed in non-streaming mode. See ' +
              'https://fburl.com/relay-incremental-delivery-non-streaming-warning.',
            'RelayModernEnvironment: Operation `RelayModernEnvironmentExecuteWithDeferTestNestedUserQuery` contains @defer/@stream ' +
              'directives but was executed in non-streaming mode. See ' +
              'https://fburl.com/relay-incremental-delivery-non-streaming-warning.',
          ],
          () => {
            dataSource.next(payload);
          },
        );

        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(next.mock.calls.length).toBe(1);

        expect(callback.mock.calls.length).toBe(1);
        const snapshot = callback.mock.calls[0][0];
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data?.id).toBe('1');

        const innerSelector = createReaderSelector(
          fragmentInner,
          '1',
          {},
          operation.request,
        );
        const innerSnapshot = environment.lookup(innerSelector);
        expect(innerSnapshot.isMissingData).toBe(false);
        expect(innerSnapshot.data?.name).toEqual('Alice');

        const innerInner2Selector = createReaderSelector(
          fragmentInnerInner2,
          '1',
          {},
          operation.request,
        );
        const innerInner2Snapshot = environment.lookup(innerInner2Selector);
        expect(innerInner2Snapshot.isMissingData).toBe(false);
        expect(innerInner2Snapshot.data).toEqual({
          lastName: 'Bob',
        });
      });
    });
  },
);
