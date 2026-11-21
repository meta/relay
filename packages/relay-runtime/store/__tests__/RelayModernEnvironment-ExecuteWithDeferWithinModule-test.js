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
  GraphQLResponseWithData,
} from '../../network/RelayNetworkTypes';
import type {Sink} from '../../network/RelayObservable';
import type {
  NormalizationRootNode,
  NormalizationSplitOperation,
} from '../../util/NormalizationNode';
import type {NormalizationResult} from '../NormalizationEngine';
import type {OperationLoader, RecordSource, Snapshot} from '../RelayStoreTypes';
import type {
  ConcreteRequest,
  RequestParameters,
} from 'relay-runtime/util/RelayConcreteNode';
import type {
  CacheConfig,
  Variables,
} from 'relay-runtime/util/RelayRuntimeTypes';

const {
  MultiActorEnvironment,
  getActorIdentifier,
} = require('../../multi-actor-environment');
const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const {graphql} = require('../../query/GraphQLTag');
const NormalizationEngine = require('../NormalizationEngine');
const normalizeResponse = require('../normalizeResponse');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {
  disallowWarnings,
  expectToWarn,
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();
disallowWarnings();

// Inline parity-test helpers: drive a (query, variables, loadFragment,
// response) tuple through both code paths (OperationExecutor and
// NormalizationEngine) and return uniform `ParityResult`s. Used by the
// `parity (%s)` describe.each block below.
type ParityArgs = Readonly<{
  query: ConcreteRequest,
  variables: Variables,
  loadFragment: (operationReference: unknown) => ?NormalizationRootNode,
  response: GraphQLResponseWithData,
}>;

type ParityResult = Readonly<{
  // Record-source view of normalized records.
  //   - executor: env's store source post-commit (all payloads merged in).
  //   - engine:   the LAST payload's source (typically the followup that
  //               populates the parent record's fields). Tests needing other
  //               payloads should reach into `engineResult.payloads[N].source`
  //               directly.
  source: RecordSource,
  // Wraps `normalizeResponse` so tests can introspect per-call args (e.g.,
  // find @module followup invocations by `selector.node.kind`).
  normalizeResponseSpy: JestMockFn<
    Parameters<typeof normalizeResponse>,
    ReturnType<typeof normalizeResponse>,
  >,
  // Engine-only: the raw NormalizationResult. Null for the executor path.
  engineResult: NormalizationResult | null,
}>;

function runViaOperationExecutor(args: ParityArgs): ParityResult {
  const normalizeResponseSpy = jest.fn(normalizeResponse);
  let dataSource: ?Sink<GraphQLResponse>;
  const localFetch = (
    _query: RequestParameters,
    _variables: Variables,
    _cacheConfig: CacheConfig,
  ) =>
    RelayObservable.create((sink: Sink<GraphQLResponse>) => {
      dataSource = sink;
    });
  const localStore = new RelayModernStore(RelayRecordSource.create(), {
    gcReleaseBufferSize: 0,
  });
  const localEnv = new RelayModernEnvironment({
    network: RelayNetwork.create(localFetch),
    normalizeResponse: normalizeResponseSpy,
    operationLoader: buildOperationLoader(args.loadFragment),
    store: localStore,
  });
  const op = createOperationDescriptor(args.query, args.variables);
  localEnv.execute({operation: op}).subscribe({
    complete: jest.fn<[], unknown>(),
    error: jest.fn<[Error], unknown>(),
    next: jest.fn<[unknown], unknown>(),
  });
  // dataSource is assigned synchronously inside RelayObservable.create above.
  // $FlowFixMe[incompatible-use]
  dataSource.next(args.response);
  jest.runAllTimers();
  return {
    engineResult: null,
    normalizeResponseSpy,
    source: localStore.getSource(),
  };
}

function runViaNormalizationEngine(args: ParityArgs): ParityResult {
  const normalizeResponseSpy = jest.fn(normalizeResponse);
  const op = createOperationDescriptor(args.query, args.variables);
  const engine = new NormalizationEngine({
    normalizeResponse: normalizeResponseSpy,
    operation: op.request.node.operation,
    operationLoader: buildOperationLoader(args.loadFragment),
    variables: op.request.variables,
  });
  const engineResult = engine.processResponse(args.response);
  return {
    engineResult,
    normalizeResponseSpy,
    source: engineResult.payloads[engineResult.payloads.length - 1].source,
  };
}

function buildOperationLoader(
  loadFragment: (ref: unknown) => ?NormalizationRootNode,
): OperationLoader {
  return {
    get: jest.fn(loadFragment),
    load: jest.fn((ref: unknown) => Promise.resolve(loadFragment(ref))),
  };
}

function createOperationLoader() {
  const cache = new Map<
    unknown,
    | {kind: 'value', operation: NormalizationSplitOperation}
    | {
        kind: 'promise',
        promise: Promise<empty>,
        resolve: (_x: NormalizationSplitOperation) => void,
      },
  >();
  const resolve = (operation: NormalizationSplitOperation) => {
    const moduleName = `${operation.name}.graphql`;
    const entry = cache.get(moduleName);
    if (entry && entry.kind === 'promise') {
      entry.resolve(operation);
    }
    cache.set(moduleName, {kind: 'value', operation: operation});
  };
  const loader = {
    get: jest.fn(moduleName => {
      const entry = cache.get(moduleName);
      if (entry && entry.kind === 'value') {
        return entry.operation;
      }
    }),
    load: jest.fn(moduleName => {
      let entry = cache.get(moduleName);
      if (entry == null) {
        let resolveFn = (_x: NormalizationSplitOperation): void => undefined;
        const promise = new Promise(resolve_ => {
          resolveFn = resolve_;
        });
        // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
        entry = {kind: 'promise', promise, resolve: resolveFn};
        // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
        cache.set(moduleName, entry);
        return promise;
      } else if (entry.kind === 'value') {
        return Promise.resolve(entry.operation);
      } else {
        return entry.promise;
      }
    }),
  };
  return [resolve, loader];
}

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'execute() a query with @defer',
  environmentType => {
    let actorCallback;
    let actorNormalizationFragment;
    let callbacks;
    let complete;
    let dataSource;
    let environment;
    let error;
    let fetch;
    let fragment;
    let next;
    let operation;
    let operationLoader: {
      get: JestMockFn<ReadonlyArray<unknown>, ?NormalizationRootNode>,
      load: JestMockFn<ReadonlyArray<unknown>, Promise<?NormalizationRootNode>>,
    };
    let query;
    let resolveFragment;
    let source;
    let store;
    let userCallback;
    let userNormalizationFragment;
    let variables;

    describe(environmentType, () => {
      beforeEach(() => {
        query = graphql`
          query RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery(
            $id: ID!
          ) {
            # NOTE: the query is structured to have the same exact deferred fragment
            # used at two different paths (node / viewer.actor), each within a distinct
            # @module selection so that the data and @module for each can resolve
            # independently.
            node(id: $id) {
              ...RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user
                @module(name: "User.react")
            }
            viewer {
              actor
                @match(
                  key: "RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor"
                ) {
                ...RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor
                  @module(name: "Actor.react")
              }
            }
          }
        `;

        actorNormalizationFragment = require('./__generated__/RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor$normalization.graphql');
        graphql`
          fragment RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor on User {
            # NOTE: deferring UserFragment directly here would create
            # a different label
            ...RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user
          }
        `;

        userNormalizationFragment = require('./__generated__/RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$normalization.graphql');
        graphql`
          fragment RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user on User
          @no_inline {
            ...RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserFragment
              @defer(label: "UserFragment")
          }
        `;

        fragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserFragment on User {
            id
            name
          }
        `;
        variables = {id: '1'};
        operation = createOperationDescriptor(query, variables);
        complete = jest.fn<[], unknown>();
        error = jest.fn<[Error], unknown>();
        next = jest.fn<[GraphQLResponse], unknown>();
        callbacks = {complete, error, next};
        fetch = (
          _query: RequestParameters,
          _variables: Variables,
          _cacheConfig: CacheConfig,
        ) => {
          // $FlowFixMe[missing-local-annot] Error found while enabling LTI on this file
          return RelayObservable.create(sink => {
            dataSource = sink;
          });
        };
        source = RelayRecordSource.create();
        store = new RelayModernStore(source);

        // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
        [resolveFragment, operationLoader] = createOperationLoader();
        const multiActorEnvironment = new MultiActorEnvironment({
          createNetworkForActor: _actorID => RelayNetwork.create(fetch),
          createStoreForActor: _actorID => store,
          // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
          operationLoader,
        });
        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                network: RelayNetwork.create(fetch),
                store,
                operationLoader,
              });

        const userSelector = createReaderSelector(
          fragment,
          '1',
          {},
          operation.request,
        );
        const userSnapshot = environment.lookup(userSelector);
        userCallback = jest.fn<[Snapshot], void>();
        environment.subscribe(userSnapshot, userCallback);

        const actorSelector = createReaderSelector(
          fragment,
          '2',
          {},
          operation.request,
        );
        const actorSnapshot = environment.lookup(actorSelector);
        actorCallback = jest.fn<[Snapshot], void>();
        environment.subscribe(actorSnapshot, actorCallback);
      });

      it('calls next() and publishes the initial payload to the store', () => {
        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            node: {
              id: '1',
              __typename: 'User',
              __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
                'User.react',
              __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
                'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$normalization.graphql',
            },
            viewer: {
              actor: {
                id: '2',
                __typename: 'User',
                __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                  'Actor.react',
                __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                  'RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor$normalization.graphql',
              },
            },
          },
        };
        dataSource.next(payload);
        jest.runAllTimers();

        expect(operationLoader.load).toBeCalledTimes(2);
        expect(operationLoader.load.mock.calls[0][0]).toBe(
          'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$normalization.graphql',
        );
        expect(operationLoader.load.mock.calls[1][0]).toBe(
          'RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor$normalization.graphql',
        );

        expect(next.mock.calls.length).toBe(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(userCallback).toBeCalledTimes(1);
        const userSnapshot = userCallback.mock.calls[0][0];
        expect(userSnapshot.isMissingData).toBe(true);
        expect(userSnapshot.data).toEqual({
          id: '1',
          name: undefined,
        });
        expect(actorCallback).toBeCalledTimes(1);
        const actorSnapshot = actorCallback.mock.calls[0][0];
        expect(actorSnapshot.isMissingData).toBe(true);
        expect(actorSnapshot.data).toEqual({
          id: '2',
          name: undefined,
        });
      });

      it('does not process deferred payloads that arrive before their parent @module is processed', () => {
        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
              __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
                'User.react',
              __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
                'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$normalization.graphql',
            },
            viewer: {
              actor: {
                id: '2',
                __typename: 'User',
                __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                  'Actor.react',
                __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                  'RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor$normalization.graphql',
              },
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();
        userCallback.mockClear();
        actorCallback.mockClear();

        expectToWarn(
          'RelayPublishQueue.run was called, but the call would have been a noop.',
          () => {
            dataSource.next({
              data: {
                id: '1',
                __typename: 'User',
                name: 'Alice',
              },
              label:
                'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$defer$UserFragment',
              path: ['node'],
            });
          },
        );

        expectToWarn(
          'RelayPublishQueue.run was called, but the call would have been a noop.',
          () => {
            dataSource.next({
              data: {
                id: '2',
                __typename: 'User',
                name: 'Bob',
              },
              label:
                'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$defer$UserFragment',
              path: ['viewer', 'actor'],
            });
          },
        );

        expect(userCallback).toBeCalledTimes(0);
        expect(actorCallback).toBeCalledTimes(0);
        expect(complete).toBeCalledTimes(0);
        expect(error.mock.calls.map(call => call[0])).toEqual([]);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(2);

        resolveFragment(userNormalizationFragment);
        jest.runAllTimers();

        expect(error.mock.calls.map(call => call[0])).toEqual([]);
        expect(userCallback).toBeCalledTimes(1);
        const userSnapshot = userCallback.mock.calls[0][0];
        expect(userSnapshot.isMissingData).toBe(false);
        expect(userSnapshot.data).toEqual({
          id: '1',
          name: 'Alice',
        });
        expect(actorCallback).toBeCalledTimes(0);
        userCallback.mockClear();

        resolveFragment(actorNormalizationFragment);
        jest.runAllTimers();
        expect(error.mock.calls.map(call => call[0])).toEqual([]);
        expect(userCallback).toBeCalledTimes(0);
        expect(actorCallback).toBeCalledTimes(1);
        const actorSnapshot = actorCallback.mock.calls[0][0];
        expect(actorSnapshot.isMissingData).toBe(false);
        expect(actorSnapshot.data).toEqual({
          id: '2',
          name: 'Bob',
        });
      });

      it('processes deferred payloads that arrive after the parent module has resolved', () => {
        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
              __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
                'User.react',
              __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
                'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$normalization.graphql',
            },
            viewer: {
              actor: {
                id: '2',
                __typename: 'User',
                __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                  'Actor.react',
                __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                  'RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor$normalization.graphql',
              },
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();
        userCallback.mockClear();
        actorCallback.mockClear();
        expect(operationLoader.load).toBeCalledTimes(2);
        expect(operationLoader.load.mock.calls[0][0]).toBe(
          'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$normalization.graphql',
        );
        expect(operationLoader.load.mock.calls[1][0]).toBe(
          'RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor$normalization.graphql',
        );

        resolveFragment(userNormalizationFragment);
        jest.runAllTimers();
        expect(userCallback).toBeCalledTimes(0);
        expect(actorCallback).toBeCalledTimes(0);

        dataSource.next({
          data: {
            id: '1',
            __typename: 'User',
            name: 'Alice',
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$defer$UserFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error.mock.calls.map(call => call[0])).toEqual([]);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(userCallback).toBeCalledTimes(1);
        const userSnapshot = userCallback.mock.calls[0][0];
        expect(userSnapshot.isMissingData).toBe(false);
        expect(userSnapshot.data).toEqual({
          id: '1',
          name: 'Alice',
        });
        expect(actorCallback).toBeCalledTimes(0);
        userCallback.mockClear();

        resolveFragment(actorNormalizationFragment);
        jest.runAllTimers();
        expect(userCallback).toBeCalledTimes(0);
        expect(actorCallback).toBeCalledTimes(0);

        dataSource.next({
          data: {
            id: '2',
            __typename: 'User',
            name: 'Bob',
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$defer$UserFragment',
          path: ['viewer', 'actor'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error.mock.calls.map(call => call[0])).toEqual([]);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(2);
        expect(userCallback).toBeCalledTimes(0);
        expect(actorCallback).toBeCalledTimes(1);
        const actorSnapshot = actorCallback.mock.calls[0][0];
        expect(actorSnapshot.isMissingData).toBe(false);
        expect(actorSnapshot.data).toEqual({
          id: '2',
          name: 'Bob',
        });
      });

      describe('when using a scheduler', () => {
        let taskID;
        let tasks;
        let scheduler;
        let runTask;

        beforeEach(() => {
          taskID = 0;
          tasks = new Map<string, () => void>();
          scheduler = {
            cancel: (id: string) => {
              tasks.delete(id);
            },
            schedule: (task: () => void) => {
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
            operationLoader,
            scheduler,
          });
          environment =
            environmentType === 'MultiActorEnvironment'
              ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
              : new RelayModernEnvironment({
                  network: RelayNetwork.create(fetch),
                  store,
                  operationLoader,
                  scheduler,
                });
        });
        it('processes deferred payloads that had arrived before parent @module in a single scheduler step', () => {
          environment.execute({operation}).subscribe(callbacks);
          dataSource.next({
            data: {
              node: {
                id: '1',
                __typename: 'User',
                __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
                  'User.react',
                __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
                  'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$normalization.graphql',
              },
              viewer: {
                actor: {
                  id: '2',
                  __typename: 'User',
                  __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                    'Actor.react',
                  __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                    'RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor$normalization.graphql',
                },
              },
            },
          });
          jest.runAllTimers();

          expect(tasks.size).toBe(1);
          runTask();

          next.mockClear();
          userCallback.mockClear();
          actorCallback.mockClear();

          dataSource.next({
            data: {
              id: '1',
              __typename: 'User',
              name: 'Alice',
            },
            label:
              'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$defer$UserFragment',
            path: ['node'],
          });
          dataSource.next({
            data: {
              id: '2',
              __typename: 'User',
              name: 'Bob',
            },
            label:
              'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$defer$UserFragment',
            path: ['viewer', 'actor'],
          });
          jest.runAllTimers();

          expect(tasks.size).toBe(2);

          expectToWarn(
            'RelayPublishQueue.run was called, but the call would have been a noop.',
            () => {
              runTask();
            },
          );
          expectToWarn(
            'RelayPublishQueue.run was called, but the call would have been a noop.',
            () => {
              runTask();
            },
          );

          expect(userCallback).toBeCalledTimes(0);
          expect(actorCallback).toBeCalledTimes(0);
          expect(complete).toBeCalledTimes(0);
          expect(error).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(2);

          resolveFragment(userNormalizationFragment);
          jest.runAllTimers();

          // Run scheduler task to process @module
          expect(tasks.size).toBe(1);
          runTask();

          // A new task should not have been scheduled to process the
          // deferred payloads, it should've be processed synchronously
          // in the same tasks
          expect(tasks.size).toBe(0);

          expect(error.mock.calls.map(call => call[0])).toEqual([]);
          expect(userCallback).toBeCalledTimes(1);
          const userSnapshot = userCallback.mock.calls[0][0];
          expect(userSnapshot.isMissingData).toBe(false);
          expect(userSnapshot.data).toEqual({
            id: '1',
            name: 'Alice',
          });
          expect(actorCallback).toBeCalledTimes(0);
          userCallback.mockClear();

          resolveFragment(actorNormalizationFragment);
          jest.runAllTimers();

          // Run scheduler task to process @module
          expect(tasks.size).toBe(1);
          runTask();

          // A new task should not have been scheduled to process the
          // deferred payloads, it should've be processed synchronously
          // in the same tasks
          expect(tasks.size).toBe(0);

          expect(error.mock.calls.map(call => call[0])).toEqual([]);
          expect(userCallback).toBeCalledTimes(0);
          expect(actorCallback).toBeCalledTimes(1);
          const actorSnapshot = actorCallback.mock.calls[0][0];
          expect(actorSnapshot.isMissingData).toBe(false);
          expect(actorSnapshot.data).toEqual({
            id: '2',
            name: 'Bob',
          });
        });
      });

      // Parity tests: behaviors that must be identical between the established
      // OperationExecutor path and the exec-time NormalizationEngine path.
      // Each test passes a fresh (query, variables, loadFragment, response)
      // tuple to the runner and asserts on the uniform `ParityResult`.
      describe.each([
        ['OperationExecutor', runViaOperationExecutor],
        ['NormalizationEngine', runViaNormalizationEngine],
      ])('parity (%s)', (_runnerName, runner) => {
        const moduleResponseData = {
          node: {
            id: '1',
            __typename: 'User',
            __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
              'User.react',
            __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery:
              'RelayModernEnvironmentExecuteWithDeferWithinModuleTestUser_user$normalization.graphql',
          },
          viewer: {
            actor: {
              id: '2',
              __typename: 'User',
              __module_component_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                'Actor.react',
              __module_operation_RelayModernEnvironmentExecuteWithDeferWithinModuleTestUserQuery_actor:
                'RelayModernEnvironmentExecuteWithDeferWithinModuleTestActor_actor$normalization.graphql',
            },
          },
        };
        const loadFragment = (ref: unknown) =>
          String(ref).includes('User_user')
            ? userNormalizationFragment
            : actorNormalizationFragment;

        it('synthetic followup response inherits is_final=true from parent', () => {
          // OperationExecutor._normalizeFollowupPayload stamps is_final onto
          // the synthetic followup response. NormalizationEngine must mirror —
          // without it, nested @defer/3D inside an @module fragment never
          // finalizes on a non-streaming server.
          const {normalizeResponseSpy} = runner({
            query,
            variables,
            loadFragment,
            response: {
              data: moduleResponseData,
              extensions: {is_final: true as unknown},
            },
          });
          const followupCall = normalizeResponseSpy.mock.calls.find(
            call => call[1]?.node?.kind === 'SplitOperation',
          );
          expect(followupCall?.[0]?.extensions?.is_final).toBe(true);
        });

        it('synthetic followup response does NOT inherit is_final when parent is non-final', () => {
          // Regression guard: ensure the engine does not unconditionally stamp
          // is_final on followups. With no `extensions.is_final` on the parent
          // response, the followup's synthetic response must also lack it —
          // otherwise nested @defer/3D placeholders would prematurely
          // finalize.
          const {normalizeResponseSpy} = runner({
            query,
            variables,
            loadFragment,
            response: {
              data: moduleResponseData,
              // No `extensions.is_final` — parent is non-final.
            },
          });
          const followupCall = normalizeResponseSpy.mock.calls.find(
            call => call[1]?.node?.kind === 'SplitOperation',
          );
          expect(followupCall?.[0]?.extensions?.is_final).not.toBe(true);
        });
      });
    });
  },
);
