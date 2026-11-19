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
import type {GraphQLResponse} from '../../network/RelayNetworkTypes';
import type {Sink} from '../../network/RelayObservable';
import type {NormalizationRootNode} from '../../util/NormalizationNode';
import type {RequestParameters} from '../../util/RelayConcreteNode';
import type {CacheConfig, Variables} from '../../util/RelayRuntimeTypes';
import type {Snapshot} from '../RelayStoreTypes';
import type {
  HandleFieldPayload,
  RecordSourceProxy,
} from 'relay-runtime/store/RelayStoreTypes';

const {
  MultiActorEnvironment,
  getActorIdentifier,
} = require('../../multi-actor-environment');
const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {
  createReaderSelector,
  getSingularSelector,
} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const nullthrows = require('nullthrows');
const {
  disallowWarnings,
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();
disallowWarnings();

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'executeSubscription() with @match',
  environmentType => {
    describe(environmentType, () => {
      let callbacks;
      let commentFragment;
      const commentID = '1';
      let complete;
      let dataSource;
      let environment;
      let error;
      let fetchFn;
      let subscribeFn;
      let fragmentCallback;
      let markdownRendererFragment;
      let markdownRendererNormalizationFragment;
      let subscription;
      let next;
      let operation;
      let commentQuery;
      let queryOperation;
      let operationCallback;
      let operationLoader: {
        get: JestMockFn<ReadonlyArray<unknown>, ?NormalizationRootNode>,
        load: JestMockFn<
          ReadonlyArray<unknown>,
          Promise<?NormalizationRootNode>,
        >,
      };
      let resolveFragment;
      let source;
      let store;
      let variables;
      let queryVariables;

      beforeEach(() => {
        markdownRendererNormalizationFragment = require('./__generated__/RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql');

        subscription = graphql`
          subscription RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription(
            $input: CommentCreateSubscriptionInput!
          ) {
            commentCreateSubscribe(input: $input) {
              comment {
                actor {
                  name
                  nameRenderer @match {
                    ...RelayModernEnvironmentExecuteSubscriptionWithMatchTestPlainUserNameRenderer_name
                      @module(name: "PlainUserNameRenderer.react")
                    ...RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name
                      @module(name: "MarkdownUserNameRenderer.react")
                  }
                }
              }
            }
          }
        `;

        graphql`
          fragment RelayModernEnvironmentExecuteSubscriptionWithMatchTestPlainUserNameRenderer_name on PlainUserNameRenderer {
            plaintext
            data {
              text
            }
          }
        `;

        markdownRendererFragment = graphql`
          fragment RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
            __typename
            markdown
            data {
              markup @__clientField(handle: "markup_handler")
            }
          }
        `;

        commentFragment = graphql`
          fragment RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentFragment on Comment {
            id
            actor {
              name
              nameRenderer @match {
                ...RelayModernEnvironmentExecuteSubscriptionWithMatchTestPlainUserNameRenderer_name
                  @module(name: "PlainUserNameRenderer.react")
                ...RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name
                  @module(name: "MarkdownUserNameRenderer.react")
              }
            }
          }
        `;

        commentQuery = graphql`
          query RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentQuery(
            $id: ID!
          ) {
            node(id: $id) {
              id
              ...RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentFragment
                @dangerously_unaliased_fixme
            }
          }
        `;
        variables = {
          input: {
            feedbackId: '1',
          },
        };
        queryVariables = {
          id: commentID,
        };
        operation = createOperationDescriptor(subscription, variables);
        queryOperation = createOperationDescriptor(
          commentQuery,
          queryVariables,
        );

        const MarkupHandler = {
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
        fetchFn = jest.fn((_query, _variables, _cacheConfig) =>
          RelayObservable.create(sink => {}),
        );
        subscribeFn = jest.fn(
          (
            _query: RequestParameters,
            _variables: Variables,
            _cacheConfig: CacheConfig,
          ) =>
            RelayObservable.create<GraphQLResponse>(
              (sink: Sink<GraphQLResponse>) => {
                dataSource = sink;
              },
            ),
        );
        operationLoader = {
          get: jest.fn(),
          load: jest.fn(moduleName => {
            return new Promise(resolve => {
              resolveFragment = resolve;
            });
          }),
        };
        source = RelayRecordSource.create();
        store = new RelayModernStore(source);
        const multiActorEnvironment = new MultiActorEnvironment({
          createNetworkForActor: _actorID =>
            // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
            RelayNetwork.create(fetchFn, subscribeFn),
          createStoreForActor: _actorID => store,
          handlerProvider: name => {
            switch (name) {
              case 'markup_handler':
                return MarkupHandler;
            }
          },
          operationLoader,
        });

        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                handlerProvider: name => {
                  switch (name) {
                    case 'markup_handler':
                      return MarkupHandler;
                  }
                },
                // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
                network: RelayNetwork.create(fetchFn, subscribeFn),
                operationLoader,
                store,
              });

        const selector = createReaderSelector(
          commentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const fragmentSnapshot = environment.lookup(selector);
        fragmentCallback = jest.fn<[Snapshot], void>();
        environment.subscribe(fragmentSnapshot, fragmentCallback);
        const operationSnapshot = environment.lookup(operation.fragment);
        operationCallback = jest.fn<[Snapshot], void>();
        environment.subscribe(operationSnapshot, operationCallback);
      });

      it('calls next() and publishes the initial payload to the store', () => {
        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            commentCreateSubscribe: {
              comment: {
                actor: {
                  __isActor: true,
                  __typename: 'User',
                  id: '4',
                  name: 'actor-name',
                  nameRenderer: {
                    __module_component_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'MarkdownUserNameRenderer.react',
                    __module_operation_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
                    __typename: 'MarkdownUserNameRenderer',
                    data: {
                      id: 'data-1',
                      markup: '<markup/>', // server data is lowercase
                    },
                    markdown: 'markdown payload',
                  },
                },
                id: commentID,
              },
            },
          },
        };
        dataSource.next(payload);
        jest.runAllTimers();

        expect(next.mock.calls.length).toBe(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        // $FlowFixMe[prop-missing]
        const nextID = payload.extensions?.__relay_subscription_root_id;
        const nextOperation = createReaderSelector(
          operation.fragment.node,
          nullthrows(nextID),
          operation.fragment.variables,
          operation.fragment.owner,
        );
        const operationSnapshot = environment.lookup(nextOperation);
        expect(operationSnapshot.isMissingData).toBe(false);
        expect(operationSnapshot.data).toEqual({
          commentCreateSubscribe: {
            comment: {
              actor: {
                name: 'actor-name',
                nameRenderer: {
                  __fragmentOwner: operation.request,
                  __fragmentPropName: 'name',
                  __fragments: {
                    RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name:
                      {
                        // TODO T96653810: Correctly detect reading from root of mutation/subscription
                        $isWithinUnmatchedTypeRefinement: true, // should be false
                      },
                  },
                  __id: 'client:4:nameRenderer(supported:"34hjiS")',
                  __module_component: 'MarkdownUserNameRenderer.react',
                },
              },
            },
          },
        });

        expect(fragmentCallback).toBeCalledTimes(1);
        const fragmentSnapshot = fragmentCallback.mock.calls[0][0];
        // data is missing since match field data hasn't been processed yet
        expect(fragmentSnapshot.isMissingData).toBe(true);
        expect(fragmentSnapshot.data).toEqual({
          actor: {
            name: 'actor-name',
            nameRenderer: {},
          },
          id: commentID,
        });

        const matchSelector = nullthrows(
          getSingularSelector(
            markdownRendererFragment,
            (operationSnapshot.data as any)?.commentCreateSubscribe?.comment
              ?.actor?.nameRenderer,
          ),
        );
        const matchSnapshot = environment.lookup(matchSelector);
        // ref exists but match field data hasn't been processed yet
        // TODO T96653810: Correctly detect reading from root of mutation/subscription
        expect(matchSnapshot.isMissingData).toBe(false); // should be true
        expect(matchSnapshot.data).toEqual({
          __typename: 'MarkdownUserNameRenderer',
          data: undefined,
          markdown: undefined,
        });

        // The subscription affecting the owner should be marked as in flight now
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).not.toBe(null);
      });

      it('loads the @match fragment and normalizes/publishes the field payload', () => {
        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            commentCreateSubscribe: {
              comment: {
                actor: {
                  __isActor: true,
                  __typename: 'User',
                  id: '4',
                  name: 'actor-name',
                  nameRenderer: {
                    __module_component_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'MarkdownUserNameRenderer.react',
                    __module_operation_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
                    __typename: 'MarkdownUserNameRenderer',
                    data: {
                      id: 'data-1',
                      markup: '<markup/>', // server data is lowercase
                    },
                    markdown: 'markdown payload',
                  },
                },
                id: commentID,
              },
            },
          },
        };
        dataSource.next(payload);
        jest.runAllTimers();
        next.mockClear();

        expect(operationLoader.load).toBeCalledTimes(1);
        expect(operationLoader.load.mock.calls[0][0]).toEqual(
          'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
        );

        // $FlowFixMe[prop-missing]
        const nextID = payload.extensions?.__relay_subscription_root_id;
        const nextOperation = createReaderSelector(
          operation.fragment.node,
          nullthrows(nextID),
          operation.fragment.variables,
          operation.fragment.owner,
        );
        const operationSnapshot = environment.lookup(nextOperation);

        const matchSelector = nullthrows(
          getSingularSelector(
            markdownRendererFragment,
            (operationSnapshot.data as any)?.commentCreateSubscribe?.comment
              ?.actor?.nameRenderer,
          ),
        );
        const initialMatchSnapshot = environment.lookup(matchSelector);
        // TODO T96653810: Correctly detect reading from root of mutation/subscription
        expect(initialMatchSnapshot.isMissingData).toBe(false); // should be true
        const matchCallback = jest.fn<[Snapshot], void>();
        environment.subscribe(initialMatchSnapshot, matchCallback);

        resolveFragment(markdownRendererNormalizationFragment);
        jest.runAllTimers();
        // next() should not be called when @match resolves, no new GraphQLResponse
        // was received for this case
        expect(next).toBeCalledTimes(0);
        expect(operationCallback).toBeCalledTimes(0);
        expect(matchCallback).toBeCalledTimes(1);

        const matchSnapshot = matchCallback.mock.calls[0][0];
        expect(matchSnapshot.isMissingData).toBe(false);
        expect(matchSnapshot.data).toEqual({
          __typename: 'MarkdownUserNameRenderer',
          data: {
            // NOTE: should be uppercased by the MarkupHandler
            markup: '<MARKUP/>',
          },
          markdown: 'markdown payload',
        });

        // The subscription should no longer be marked as in flight since incremental
        // payloads for the initial server payload have been resolved
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      it('calls complete() only after match payloads are processed (root network completes first)', () => {
        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            commentCreateSubscribe: {
              comment: {
                actor: {
                  __isActor: true,
                  __typename: 'User',
                  id: '4',
                  name: 'actor-name',
                  nameRenderer: {
                    __module_component_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'MarkdownUserNameRenderer.react',
                    __module_operation_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
                    __typename: 'MarkdownUserNameRenderer',
                    data: {
                      id: 'data-1',
                      markup: '<markup/>', // server data is lowercase
                    },
                    markdown: 'markdown payload',
                  },
                },
                id: commentID,
              },
            },
          },
        };
        dataSource.next(payload);
        dataSource.complete();
        jest.runAllTimers();
        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);

        // The subscription affecting the query should still appear in flight;
        // even though the root request has completed, we're still waiting on the
        // module resource
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).not.toBe(null);

        expect(operationLoader.load).toBeCalledTimes(1);
        expect(operationLoader.load.mock.calls[0][0]).toEqual(
          'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
        );
        resolveFragment(markdownRendererNormalizationFragment);
        jest.runAllTimers();

        expect(complete).toBeCalledTimes(1);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);

        // The subscription affecting the query should no longer be in flight
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      it('calls complete() only after match payloads are processed (root network completes first, with batching on)', () => {
        const prevFlagAsync = RelayFeatureFlags.BATCH_ASYNC_MODULE_UPDATES_FN;
        RelayFeatureFlags.BATCH_ASYNC_MODULE_UPDATES_FN = task => {
          const handle = setTimeout(task, 0);
          return {
            dispose: () => clearTimeout(handle),
          };
        };
        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            commentCreateSubscribe: {
              comment: {
                actor: {
                  __isActor: true,
                  __typename: 'User',
                  id: '4',
                  name: 'actor-name',
                  nameRenderer: {
                    __module_component_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'MarkdownUserNameRenderer.react',
                    __module_operation_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
                    __typename: 'MarkdownUserNameRenderer',
                    data: {
                      id: 'data-1',
                      markup: '<markup/>', // server data is lowercase
                    },
                    markdown: 'markdown payload',
                  },
                },
                id: commentID,
              },
            },
          },
        };
        dataSource.next(payload);
        dataSource.complete();
        jest.runAllTimers();
        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);

        // The subscription affecting the query should still appear in flight;
        // even though the root request has completed, we're still waiting on the
        // module resource
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).not.toBe(null);

        expect(operationLoader.load).toBeCalledTimes(1);
        expect(operationLoader.load.mock.calls[0][0]).toEqual(
          'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
        );
        resolveFragment(markdownRendererNormalizationFragment);
        jest.runAllImmediates();

        expect(complete).toBeCalledTimes(1);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        // The subscription affecting the query should no longer be in flight
        // because async batching isn't on with one active query
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);

        RelayFeatureFlags.BATCH_ASYNC_MODULE_UPDATES_FN = prevFlagAsync;
      });

      it('calls complete() only after match payloads are processed (root network completes last)', () => {
        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            commentCreateSubscribe: {
              comment: {
                actor: {
                  __isActor: true,
                  __typename: 'User',
                  id: '4',
                  name: 'actor-name',
                  nameRenderer: {
                    __module_component_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'MarkdownUserNameRenderer.react',
                    __module_operation_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
                    __typename: 'MarkdownUserNameRenderer',
                    data: {
                      id: 'data-1',
                      markup: '<markup/>', // server data is lowercase
                    },
                    markdown: 'markdown payload',
                  },
                },
                id: commentID,
              },
            },
          },
        };
        dataSource.next(payload);
        jest.runAllTimers();

        // The subscription affecting the query should appear in flight
        // since module hasn't been resolved
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).not.toBe(null);

        expect(operationLoader.load).toBeCalledTimes(1);
        expect(operationLoader.load.mock.calls[0][0]).toEqual(
          'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
        );
        resolveFragment(markdownRendererNormalizationFragment);
        jest.runAllTimers();

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);

        // The subscription affecting the query should no longer be in flight
        // since module was resolved
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);

        dataSource.complete();
        expect(complete).toBeCalledTimes(1);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);

        // The subscription affecting the query should no longer be in flight
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      it('calls error() even if match payloads have not been resolved', () => {
        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            commentCreateSubscribe: {
              comment: {
                actor: {
                  __isActor: true,
                  __typename: 'User',
                  id: '4',
                  name: 'actor-name',
                  nameRenderer: {
                    __module_component_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'MarkdownUserNameRenderer.react',
                    __module_operation_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                      'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
                    __typename: 'MarkdownUserNameRenderer',
                    data: {
                      id: 'data-1',
                      markup: '<markup/>', // server data is lowercase
                    },
                    markdown: 'markdown payload',
                  },
                },
                id: commentID,
              },
            },
          },
        };
        dataSource.next(payload);
        jest.runAllTimers();

        // The subscription affecting the query should appear in flight
        // since module hasn't been resolved
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).not.toBe(null);

        const err = new Error('Oops');
        dataSource.error(err);

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(1);
        expect(error.mock.calls[0][0]).toBe(err);
        expect(next).toBeCalledTimes(1);
        expect(fragmentCallback).toBeCalledTimes(1);

        // The subscription affecting the query should no longer be in flight
        // since request errored
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      describe('with schedulers', () => {
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

          environment = new RelayModernEnvironment({
            handlerProvider: name => {
              switch (name) {
                case 'markup_handler':
                  return {update: () => {}};
              }
            },
            // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
            network: RelayNetwork.create(fetchFn, subscribeFn),
            operationLoader,
            scheduler,
            store,
          });
          const selector = createReaderSelector(
            commentFragment,
            commentID,
            {},
            queryOperation.request,
          );
          const fragmentSnapshot = environment.lookup(selector);
          fragmentCallback = jest.fn();
          environment.subscribe(fragmentSnapshot, fragmentCallback);
          const operationSnapshot = environment.lookup(operation.fragment);
          operationCallback = jest.fn();
          environment.subscribe(operationSnapshot, operationCallback);
        });

        it('calls complete() only after match payloads are processed (root network completes first)', () => {
          environment.execute({operation}).subscribe(callbacks);
          const payload = {
            data: {
              commentCreateSubscribe: {
                comment: {
                  actor: {
                    __isActor: true,
                    __typename: 'User',
                    id: '4',
                    name: 'actor-name',
                    nameRenderer: {
                      __module_component_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                        'MarkdownUserNameRenderer.react',
                      __module_operation_RelayModernEnvironmentExecuteSubscriptionWithMatchTestCommentCreateSubscription:
                        'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
                      __typename: 'MarkdownUserNameRenderer',
                      data: {
                        id: 'data-1',
                        markup: '<markup/>', // server data is lowercase
                      },
                      markdown: 'markdown payload',
                    },
                  },
                  id: commentID,
                },
              },
            },
          };
          dataSource.next(payload);
          dataSource.complete();
          jest.runAllTimers();
          runTask();
          expect(complete).toBeCalledTimes(0);
          expect(error).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(1);

          // The subscription affecting the query should still appear in flight;
          // even though the root request has completed, we're still waiting on the
          // module resource
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(queryOperation.request),
          ).not.toBe(null);

          expect(operationLoader.load).toBeCalledTimes(1);
          expect(operationLoader.load.mock.calls[0][0]).toEqual(
            'RelayModernEnvironmentExecuteSubscriptionWithMatchTestMarkdownUserNameRenderer_name$normalization.graphql',
          );
          resolveFragment(markdownRendererNormalizationFragment);
          jest.runAllTimers();
          // The normalization file is loaded, but the data hasn't been published to the store
          expect(tasks.size).toBe(1);
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(queryOperation.request),
          ).not.toBe(null);
          expect(complete).toBeCalledTimes(0);
          expect(error).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(1);

          runTask();
          expect(complete).toBeCalledTimes(1);
          expect(error).toBeCalledTimes(0);
          expect(next).toBeCalledTimes(1);
          // The subscription affecting the query should no longer be in flight
          expect(
            environment
              .getOperationTracker()
              .getPendingOperationsAffectingOwner(queryOperation.request),
          ).toBe(null);
        });
      });
    });
  },
);
