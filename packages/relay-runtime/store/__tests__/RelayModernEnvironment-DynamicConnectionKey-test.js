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
const {getSingularSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const nullthrows = require('nullthrows');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  '@with dynamic key',
  environmentType => {
    let callbacks;
    let complete;
    let dataSource;
    let environment;
    let error;
    let fetch;
    let fragment;
    let next;
    let operation;
    let paginationQuery;
    let query;
    let source;
    let store;

    describe(environmentType, () => {
      beforeEach(() => {
        query = graphql`
          query RelayModernEnvironmentDynamicConnectionKeyTestFeedbackQuery(
            $id: ID!
            $commentsKey: String
          ) {
            node(id: $id) {
              ...RelayModernEnvironmentDynamicConnectionKeyTestFeedbackFragment
                @dangerously_unaliased_fixme
            }
          }
        `;
        paginationQuery = graphql`
          query RelayModernEnvironmentDynamicConnectionKeyTestPaginationQuery(
            $id: ID!
            $commentsKey: String
            $count: Int!
            $cursor: ID!
          ) {
            node(id: $id) {
              ...RelayModernEnvironmentDynamicConnectionKeyTestFeedbackFragment
                @dangerously_unaliased_fixme
                @arguments(count: $count, cursor: $cursor)
            }
          }
        `;
        fragment = graphql`
          fragment RelayModernEnvironmentDynamicConnectionKeyTestFeedbackFragment on Feedback
          @argumentDefinitions(
            count: {type: "Int", defaultValue: 2}
            cursor: {type: "ID"}
          ) {
            id
            comments(after: $cursor, first: $count, orderby: "date")
              @connection(
                key: "RelayModernEnvironmentDynamicConnectionKeyTestFeedbackFragment_comments"
                dynamicKey_UNSTABLE: $commentsKey
                filters: ["orderby"]
              ) {
              edges {
                node {
                  id
                }
              }
            }
          }
        `;
        const variables = {
          id: '<feedbackid>',
          commentsKey: '<comments>',
        };
        operation = createOperationDescriptor(query, variables);

        complete = jest.fn<[], unknown>();
        error = jest.fn<[Error], unknown>();
        next = jest.fn<[GraphQLResponse], unknown>();
        callbacks = {complete, error, next};
        fetch = jest.fn((_query, _variables, _cacheConfig) => {
          return RelayObservable.create(sink => {
            dataSource = sink;
          });
        });
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
      });

      it('publishes initial results to the store', () => {
        const operationSnapshot = environment.lookup(operation.fragment);
        const operationCallback = jest.fn<[Snapshot], void>();
        environment.subscribe(operationSnapshot, operationCallback);

        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            node: {
              __typename: 'Feedback',
              id: '<feedbackid>',
              comments: {
                edges: [
                  {
                    cursor: 'cursor-1',
                    node: {
                      __typename: 'Comment',
                      id: 'node-1',
                    },
                  },
                  {
                    cursor: 'cursor-2',
                    node: {
                      __typename: 'Comment',
                      id: 'node-2',
                    },
                  },
                ],
                pageInfo: {
                  hasNextPage: true,
                  endCursor: 'cursor-2',
                },
              },
            },
          },
        };
        dataSource.next(payload);
        jest.runAllTimers();

        expect(operationCallback).toBeCalledTimes(1);
        const nextOperationSnapshot = operationCallback.mock.calls[0][0];
        expect(nextOperationSnapshot.isMissingData).toBe(false);
        expect(nextOperationSnapshot.data).toEqual({
          node: {
            __id: '<feedbackid>',

            __fragments: {
              RelayModernEnvironmentDynamicConnectionKeyTestFeedbackFragment:
                {},
            },

            __fragmentOwner: operation.request,
          },
        });

        const selector = nullthrows(
          getSingularSelector(fragment, nextOperationSnapshot.data?.node),
        );
        const snapshot = environment.lookup(selector);
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          id: '<feedbackid>',
          comments: {
            edges: [
              {cursor: 'cursor-1', node: {id: 'node-1', __typename: 'Comment'}},
              {cursor: 'cursor-2', node: {id: 'node-2', __typename: 'Comment'}},
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor-2',
            },
          },
        });
      });

      describe('after initial data has been fetched and subscribed', () => {
        let callback;

        beforeEach(() => {
          environment.execute({operation}).subscribe(callbacks);
          const payload = {
            data: {
              node: {
                __typename: 'Feedback',
                id: '<feedbackid>',
                comments: {
                  edges: [
                    {
                      cursor: 'cursor-1',
                      node: {
                        __typename: 'Comment',
                        id: 'node-1',
                      },
                    },
                    {
                      cursor: 'cursor-2',
                      node: {
                        __typename: 'Comment',
                        id: 'node-2',
                      },
                    },
                  ],
                  pageInfo: {
                    hasNextPage: true,
                    endCursor: 'cursor-2',
                  },
                },
              },
            },
          };
          dataSource.next(payload);
          dataSource.complete();
          fetch.mockClear();
          jest.runAllTimers();

          const operationSnapshot = environment.lookup(operation.fragment);

          const selector = nullthrows(
            getSingularSelector(fragment, operationSnapshot.data?.node),
          );
          const snapshot = environment.lookup(selector);
          callback = jest.fn<[Snapshot], void>();
          environment.subscribe(snapshot, callback);
        });

        it('updates when paginated with the same dynamic key value', () => {
          const paginationOperation = createOperationDescriptor(
            paginationQuery,
            {
              id: '<feedbackid>',
              commentsKey: '<comments>',
              count: 2,
              cursor: 'cursor-2',
            },
          );
          environment.execute({operation: paginationOperation}).subscribe({});
          const paginationPayload = {
            data: {
              node: {
                __typename: 'Feedback',
                id: '<feedbackid>',
                comments: {
                  edges: [
                    {
                      cursor: 'cursor-3',
                      node: {
                        __typename: 'Comment',
                        id: 'node-3',
                      },
                    },
                    {
                      cursor: 'cursor-4',
                      node: {
                        __typename: 'Comment',
                        id: 'node-4',
                      },
                    },
                  ],
                  pageInfo: {
                    hasNextPage: true,
                    endCursor: 'cursor-4',
                  },
                },
              },
            },
          };
          dataSource.next(paginationPayload);
          jest.runAllTimers();

          expect(callback).toBeCalledTimes(1);
          const nextSnapshot = callback.mock.calls[0][0];
          expect(nextSnapshot.isMissingData).toBe(false);
          expect(nextSnapshot.data).toEqual({
            id: '<feedbackid>',
            comments: {
              edges: [
                {
                  cursor: 'cursor-1',
                  node: {id: 'node-1', __typename: 'Comment'},
                },
                {
                  cursor: 'cursor-2',
                  node: {id: 'node-2', __typename: 'Comment'},
                },
                {
                  cursor: 'cursor-3',
                  node: {id: 'node-3', __typename: 'Comment'},
                },
                {
                  cursor: 'cursor-4',
                  node: {id: 'node-4', __typename: 'Comment'},
                },
              ],
              pageInfo: {
                hasNextPage: true,
                endCursor: 'cursor-4',
              },
            },
          });
        });

        it('does not update when paginated with a different dynamic key', () => {
          const paginationOperation = createOperationDescriptor(
            paginationQuery,
            {
              id: '<feedbackid>',
              commentsKey: '<other-comments>', // different key
              count: 2,
              cursor: 'cursor-2',
            },
          );
          environment.execute({operation: paginationOperation}).subscribe({});
          const paginationPayload = {
            data: {
              node: {
                __typename: 'Feedback',
                id: '<feedbackid>',
                comments: {
                  edges: [
                    {
                      cursor: 'cursor-3',
                      node: {
                        __typename: 'Comment',
                        id: 'node-3',
                      },
                    },
                    {
                      cursor: 'cursor-4',
                      node: {
                        __typename: 'Comment',
                        id: 'node-4',
                      },
                    },
                  ],
                  pageInfo: {
                    hasNextPage: true,
                    endCursor: 'cursor-4',
                  },
                },
              },
            },
          };
          dataSource.next(paginationPayload);
          jest.runAllTimers();

          expect(callback).toBeCalledTimes(0);
        });
      });
    });
  },
);
