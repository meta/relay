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
const {RelayFeatureFlags} = require('relay-runtime');
const {
  disallowWarnings,
  expectWarningWillFire,
} = require('relay-test-utils-internal');

disallowWarnings();

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'executeMutation()',
  environmentType => {
    let callbacks;
    let commentID;
    let CommentFragment;
    let CommentQuery;
    let complete;
    let CreateCommentMutation;
    let CreateCommentWithSpreadMutation;
    let environment;
    let error;
    let fetch;
    let next;
    let operation;
    let queryOperation;
    let source;
    let store;
    let subject;
    let networkSource;
    let variables;
    let queryVariables;

    describe(environmentType, () => {
      beforeEach(() => {
        commentID = 'comment-id';

        CreateCommentMutation = graphql`
          mutation RelayModernEnvironmentExecuteMutationTestCreateCommentMutation(
            $input: CommentCreateInput!
          ) {
            commentCreate(input: $input) {
              comment {
                id
                body {
                  text
                }
              }
            }
          }
        `;

        CommentFragment = graphql`
          fragment RelayModernEnvironmentExecuteMutationTestCommentFragment on Comment {
            id
            body {
              text
            }
          }
        `;

        CreateCommentWithSpreadMutation = graphql`
          mutation RelayModernEnvironmentExecuteMutationTestCreateCommentWithSpreadMutation(
            $input: CommentCreateInput!
          ) {
            commentCreate(input: $input) {
              comment {
                ...RelayModernEnvironmentExecuteMutationTestCommentFragment
              }
            }
          }
        `;

        CommentQuery = graphql`
          query RelayModernEnvironmentExecuteMutationTestCommentQuery(
            $id: ID!
          ) {
            node(id: $id) {
              id
              ...RelayModernEnvironmentExecuteMutationTestCommentFragment
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
        operation = createOperationDescriptor(CreateCommentMutation, variables);
        queryOperation = createOperationDescriptor(
          CommentQuery,
          queryVariables,
        );

        // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
        networkSource = RelayObservable.create(sink => {
          subject = sink;
        });
        fetch = jest.fn((_query, _variables, _cacheConfig) => networkSource);
        source = RelayRecordSource.create();
        store = new RelayModernStore(source);
        const multiActorEnvironment = new MultiActorEnvironment({
          // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
          createNetworkForActor: _actorID => RelayNetwork.create(fetch),
          createStoreForActor: _actorID => store,
        });
        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
                network: RelayNetwork.create(fetch),
                store,
              });
        complete = jest.fn<[], unknown>();
        error = jest.fn<[Error], unknown>();
        next = jest.fn<[GraphQLResponse], unknown>();
        callbacks = {complete, error, next};
      });

      it('fetches the mutation with the provided fetch function', () => {
        environment.executeMutation({operation}).subscribe({});
        expect(fetch.mock.calls.length).toBe(1);
        expect(fetch.mock.calls[0][0]).toEqual(CreateCommentMutation.params);
        expect(fetch.mock.calls[0][1]).toEqual(variables);
        expect(fetch.mock.calls[0][2]).toEqual({force: true});
      });

      it('executes the optimistic updater immediately', () => {
        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        environment
          .executeMutation({
            operation,
            optimisticUpdater: _store => {
              const comment = _store.create(commentID, 'Comment');
              comment.setValue(commentID, 'id');
              const body = _store.create(commentID + '.text', 'Text');
              comment.setLinkedRecord(body, 'body');
              body.setValue('Give Relay', 'text');
            },
          })
          .subscribe(callbacks);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual({
          body: {
            text: 'Give Relay',
          },
          id: commentID,
        });
      });

      it('executes the optimistic updater immediately, does not mark mutation as being in flight in operation tracker', () => {
        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        environment
          .executeMutation({
            operation,
            optimisticUpdater: _store => {
              const comment = _store.create(commentID, 'Comment');
              comment.setValue(commentID, 'id');
              const body = _store.create(commentID + '.text', 'Text');
              comment.setLinkedRecord(body, 'body');
              body.setValue('Give Relay', 'text');
            },
          })
          .subscribe(callbacks);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback).toBeCalledTimes(1);
        // result tested in previous test

        // The mutation affecting the query should not be marked as in flight yet
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      it('reverts the optimistic update if disposed', () => {
        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        const subscription = environment
          .executeMutation({
            operation,
            optimisticUpdater: _store => {
              const comment = _store.create(commentID, 'Comment');
              comment.setValue(commentID, 'id');
              const body = _store.create(commentID + '.text', 'Text');
              comment.setLinkedRecord(body, 'body');
              body.setValue('Give Relay', 'text');
            },
          })
          .subscribe(callbacks);
        callback.mockClear();
        subscription.unsubscribe();
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual(undefined);
      });

      it('reverts the optimistic update and commits the server payload', () => {
        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        environment
          .executeMutation({
            operation,
            optimisticUpdater: _store => {
              const comment = _store.create(commentID, 'Comment');
              comment.setValue(commentID, 'id');
              const body = _store.create(commentID + '.text', 'Text');
              comment.setLinkedRecord(body, 'body');
              body.setValue('Give Relay', 'text');
            },
          })
          .subscribe(callbacks);

        callback.mockClear();
        subject.next({
          data: {
            commentCreate: {
              comment: {
                body: {
                  text: 'Gave Relay',
                },
                id: commentID,
              },
            },
          },
        });
        subject.complete();

        expect(complete).toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual({
          body: {
            text: 'Gave Relay',
          },
          id: commentID,
        });
      });

      it('commits the server payload and runs the updater', () => {
        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        environment
          .executeMutation({
            operation,
            updater: _store => {
              const comment = _store.get(commentID);
              if (!comment) {
                throw new Error('Expected comment to be in the store');
              }
              const body = comment.getLinkedRecord('body');
              if (!body) {
                throw new Error('Expected comment to have a body');
              }
              const bodyValue: string = body.getValue('text') as $FlowFixMe;
              if (bodyValue == null) {
                throw new Error('Expected comment body to have text');
              }
              body.setValue(bodyValue.toUpperCase(), 'text');
            },
          })
          .subscribe(callbacks);

        callback.mockClear();
        subject.next({
          data: {
            commentCreate: {
              comment: {
                body: {
                  text: 'Gave Relay', // server data is lowercase
                },
                id: commentID,
              },
            },
          },
        });
        subject.complete();

        expect(complete).toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual({
          body: {
            text: 'GAVE RELAY', // converted to uppercase by updater
          },
          id: commentID,
        });
      });

      it('reverts the optimistic update if the fetch is rejected', () => {
        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        environment
          .executeMutation({
            operation,
            optimisticUpdater: _store => {
              const comment = _store.create(commentID, 'Comment');
              comment.setValue(commentID, 'id');
              const body = _store.create(commentID + '.text', 'Text');
              comment.setLinkedRecord(body, 'body');
              body.setValue('Give Relay', 'text');
            },
          })
          .subscribe(callbacks);

        callback.mockClear();
        subject.error(new Error('wtf'));

        expect(complete).not.toBeCalled();
        expect(error).toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual(undefined);
      });

      it('commits optimistic response with fragment spread', () => {
        operation = createOperationDescriptor(
          CreateCommentWithSpreadMutation,
          variables,
        );

        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        environment
          .executeMutation({
            operation,
            optimisticResponse: {
              commentCreate: {
                comment: {
                  body: {
                    text: 'Give Relay',
                  },
                  id: commentID,
                },
              },
            },
          })
          .subscribe(callbacks);

        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual({
          body: {
            text: 'Give Relay',
          },
          id: commentID,
        });
      });

      it('does not commit the server payload if disposed', () => {
        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        const subscription = environment
          .executeMutation({
            operation,
            optimisticUpdater: _store => {
              const comment = _store.create(commentID, 'Comment');
              comment.setValue(commentID, 'id');
              const body = _store.create(commentID + '.text', 'Text');
              comment.setLinkedRecord(body, 'body');
              body.setValue('Give Relay', 'text');
            },
          })
          .subscribe(callbacks);

        subscription.unsubscribe();
        callback.mockClear();
        subject.next({
          data: {
            commentCreate: {
              comment: {
                body: {
                  text: 'Gave Relay',
                },
                id: commentID,
              },
            },
          },
        });
        subject.complete();
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        // The optimistic update has already been reverted
        expect(callback.mock.calls.length).toBe(0);

        // The mutation affecting the query should not be marked as in flight
        // since it was disposed
        expect(
          environment
            .getOperationTracker()
            .getPendingOperationsAffectingOwner(queryOperation.request),
        ).toBe(null);
      });

      it('does not fill missing fields from optimistic response with nulls, even when treatMissingFieldsAsNull is enabled', () => {
        operation = createOperationDescriptor(
          CreateCommentWithSpreadMutation,
          variables,
        );

        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        environment = new RelayModernEnvironment({
          // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
          network: RelayNetwork.create(fetch),
          store,
          treatMissingFieldsAsNull: true,
        });

        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        expectWarningWillFire(
          'RelayResponseNormalizer: Payload did not contain a value for field `body: body`. Check that you are parsing with the same query that was used to fetch the payload.',
        );
        environment
          .executeMutation({
            operation,
            optimisticResponse: {
              commentCreate: {
                comment: {
                  id: commentID,
                  // body is missing in this response
                },
              },
            },
          })
          .subscribe(callbacks);

        expect(complete).not.toBeCalled();
        expect(next).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual({
          body: undefined, // even if treatMissingFieldsAsNull is enabled, this is not filled with null since this is an optimistic update
          id: commentID,
        });
        // and thus the snapshot has missing data
        expect(callback.mock.calls[0][0].isMissingData).toEqual(true);
      });

      it('reverts the optimistic update and commits the prefetched server payload', () => {
        RelayFeatureFlags.PROCESS_OPTIMISTIC_UPDATE_BEFORE_SUBSCRIPTION = true;
        const selector = createReaderSelector(
          CommentFragment,
          commentID,
          {},
          queryOperation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        // This is to mock the prefetched payload that exists before the network source is being subscribed to
        networkSource = RelayObservable.create(sink => {
          sink.next({
            data: {
              commentCreate: {
                comment: {
                  body: {
                    text: 'Gave Relay',
                  },
                  id: commentID,
                },
              },
            },
          });
          sink.complete();
        });

        callback.mockClear();
        environment
          .executeMutation({
            operation,
            optimisticUpdater: _store => {
              const body = _store.get(commentID)?.getLinkedRecord('body');
              // When optimistic updater happens after the payload is commited, these records already exist
              if (body != null) {
                body.setValue('Give Relay', 'text');
              } else {
                const comment = _store.create(commentID, 'Comment');
                comment.setValue(commentID, 'id');
                const body = _store.create(commentID + '.text', 'Text');
                comment.setLinkedRecord(body, 'body');
                body.setValue('Give Relay', 'text');
              }
            },
          })
          .subscribe(callbacks);

        expect(complete).toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(2);
        expect(callback.mock.calls[1][0].data).toEqual({
          body: {
            text: 'Gave Relay',
          },
          id: commentID,
        });
      });
    });
  },
);
