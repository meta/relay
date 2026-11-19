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
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'executeSubscription() with @defer',
  environmentType => {
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
    let subscription;
    let next;
    let operation;
    let commentQuery;
    let queryOperation;
    let source;
    let store;
    let variables;
    let queryVariables;

    describe(environmentType, () => {
      beforeEach(() => {
        subscription = graphql`
          subscription RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentCreateSubscription(
            $input: CommentCreateSubscriptionInput!
          ) {
            commentCreateSubscribe(input: $input) {
              comment {
                id
                ...RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentFragment
                  @defer
              }
            }
          }
        `;
        commentFragment = graphql`
          fragment RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentFragment on Comment {
            id
            actor {
              name @__clientField(handle: "name_handler")
            }
          }
        `;
        commentQuery = graphql`
          query RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentQuery(
            $id: ID!
          ) {
            node(id: $id) {
              id
              ...RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentFragment
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

        const NameHandler = {
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
        subscribeFn = jest.fn((_query, _variables, _cacheConfig) =>
          RelayObservable.create(sink => {
            dataSource = sink;
          }),
        );
        source = RelayRecordSource.create();
        store = new RelayModernStore(source);
        const handlerProvider = (name: string) => {
          switch (name) {
            case 'name_handler':
              return NameHandler;
          }
        };
        const multiActorEnvironment = new MultiActorEnvironment({
          createNetworkForActor: _actorID =>
            // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
            RelayNetwork.create(fetchFn, subscribeFn),
          createStoreForActor: _actorID => store,
          handlerProvider,
        });
        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
                network: RelayNetwork.create(fetchFn, subscribeFn),
                store,
                handlerProvider,
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
      });

      it('calls next() and publishes the initial payload to the store', () => {
        environment.executeSubscription({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            commentCreateSubscribe: {
              comment: {
                id: commentID,
                __typename: 'Comment',
              },
            },
          },
        });
        jest.runAllTimers();

        expect(next).toBeCalledTimes(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();

        expect(fragmentCallback).toBeCalledTimes(1);
        const fragmentSnapshot = fragmentCallback.mock.calls[0][0];
        // data is missing since data for @defer'd fragment hasn't been received
        expect(fragmentSnapshot.isMissingData).toBe(true);
        expect(fragmentSnapshot.data).toEqual({
          id: commentID,
          actor: undefined,
        });

        // The subscription should be marked as in flight and affecting the
        // query owner now
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).not.toBe(null);
      });

      it('processes deferred payloads', () => {
        environment.executeSubscription({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            commentCreateSubscribe: {
              comment: {
                id: commentID,
                __typename: 'Comment',
              },
            },
          },
        });
        jest.runAllTimers();

        expect(next).toBeCalledTimes(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(fragmentCallback).toBeCalledTimes(1);
        next.mockClear();
        fragmentCallback.mockClear();

        dataSource.next({
          data: {
            id: commentID,
            __typename: 'Comment',
            actor: {
              id: 'actor-id',
              __typename: 'User',
              name: 'actor-name',
            },
          },
          label:
            'RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentCreateSubscription$defer$RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentFragment',
          path: ['commentCreateSubscribe', 'comment'],
          extensions: {
            is_final: true,
          },
        });
        jest.runAllTimers();

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(fragmentCallback).toBeCalledTimes(1);
        const fragmentSnapshot = fragmentCallback.mock.calls[0][0];
        expect(fragmentSnapshot.isMissingData).toBe(false);
        expect(fragmentSnapshot.data).toEqual({
          id: commentID,
          actor: {
            name: 'ACTOR-NAME',
          },
        });

        // The subscription affecting the query should no longer be in flight
        // since all incremental payloads have been resolved
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      it('calls complete() if root network request completes after deferred payload resolves', () => {
        environment.executeSubscription({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            commentCreateSubscribe: {
              comment: {
                id: commentID,
                __typename: 'Comment',
              },
            },
          },
        });
        jest.runAllTimers();

        expect(next).toBeCalledTimes(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(fragmentCallback).toBeCalledTimes(1);
        next.mockClear();
        fragmentCallback.mockClear();

        dataSource.next({
          data: {
            id: commentID,
            __typename: 'Comment',
            actor: {
              id: 'actor-id',
              __typename: 'User',
              name: 'actor-name',
            },
          },
          label:
            'RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentCreateSubscription$defer$RelayModernEnvironmentExecuteSubscriptionWithDeferTestCommentFragment',
          path: ['commentCreateSubscribe', 'comment'],
          extensions: {
            is_final: true,
          },
        });
        jest.runAllTimers();

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(fragmentCallback).toBeCalledTimes(1);

        // The subscription affecting the query should no longer be in flight
        // since all incremental payloads have been resolved
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);

        dataSource.complete();

        expect(complete).toBeCalledTimes(1);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(1);
        expect(fragmentCallback).toBeCalledTimes(1);

        // The subscription affecting the query should no longer be in flight
        // since all incremental payloads have been resolved
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      it('calls complete() if root network request completes before deferred payload resolves', () => {
        environment.executeSubscription({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            commentCreateSubscribe: {
              comment: {
                id: commentID,
                __typename: 'Comment',
              },
            },
          },
        });
        jest.runAllTimers();

        expect(next).toBeCalledTimes(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(fragmentCallback).toBeCalledTimes(1);
        next.mockClear();
        fragmentCallback.mockClear();

        dataSource.complete();

        expect(complete).toBeCalledTimes(1);
        expect(error).toBeCalledTimes(0);
        expect(next).toBeCalledTimes(0);
        expect(fragmentCallback).toBeCalledTimes(0);

        // The subscription affecting the query should no longer be in flight
        // since the network completed without incremental payloads
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      it('calls error() if root network request errors before deferred payload resolves', () => {
        environment.executeSubscription({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            commentCreateSubscribe: {
              comment: {
                id: commentID,
                __typename: 'Comment',
              },
            },
          },
        });
        jest.runAllTimers();

        expect(next).toBeCalledTimes(1);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(fragmentCallback).toBeCalledTimes(1);
        next.mockClear();
        fragmentCallback.mockClear();

        const err = new Error('Oops');
        dataSource.error(err);

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(1);
        expect(error.mock.calls[0][0]).toBe(err);
        expect(next).toBeCalledTimes(0);
        expect(fragmentCallback).toBeCalledTimes(0);

        // The subscription affecting the query should no longer be in flight
        // since network errored without incremental payloads
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });
    });
  },
);
