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
import type {GraphQLResponseWithoutData} from '../../network/RelayNetworkTypes';
import type {Snapshot} from '../../store/RelayStoreTypes';
import type {RecordSourceSelectorProxy} from '../../store/RelayStoreTypes';
import type {DeclarativeMutationConfig} from '../RelayDeclarativeMutationConfig';
import type {commitMutationTest1Mutation$variables} from './__generated__/commitMutationTest1Mutation.graphql';
import type {commitMutationTest2Mutation$variables} from './__generated__/commitMutationTest2Mutation.graphql';
import type {commitMutationTest3Mutation$variables} from './__generated__/commitMutationTest3Mutation.graphql';
import type {
  commitMutationTest4Query$data,
  commitMutationTest4Query$variables,
} from './__generated__/commitMutationTest4Query.graphql';
import type {
  commitMutationTest5Query$data,
  commitMutationTest5Query$variables,
} from './__generated__/commitMutationTest5Query.graphql';
import type {commitMutationTest6Mutation$variables} from './__generated__/commitMutationTest6Mutation.graphql';
import type {CacheConfig, Query} from 'relay-runtime/util/RelayRuntimeTypes';

const ConnectionHandler = require('../../handlers/connection/ConnectionHandler');
const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const {graphql} = require('../../query/GraphQLTag');
const RelayModernEnvironment = require('../../store/RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../../store/RelayModernOperationDescriptor');
const {createReaderSelector} = require('../../store/RelayModernSelector');
const RelayModernStore = require('../../store/RelayModernStore');
const RelayRecordSource = require('../../store/RelayRecordSource');
const {ROOT_ID} = require('../../store/RelayStoreUtils');
const commitMutation = require('../commitMutation');
const nullthrows = require('nullthrows');
const {createMockEnvironment} = require('relay-test-utils-internal');

describe('Configs: NODE_DELETE', () => {
  jest.resetModules();

  it('deletes a node', () => {
    const environment = createMockEnvironment();
    const store = environment.getStore();
    const mutation = graphql`
      mutation commitMutationTest1Mutation($input: CommentDeleteInput) {
        commentDelete(input: $input) {
          deletedCommentId
          feedback {
            id
            topLevelComments {
              count
            }
          }
        }
      }
    `;
    const feedbackID = 'feedback123';
    const firstCommentID = 'comment456';
    const secondCommentID = 'comment789';
    const variables: commitMutationTest1Mutation$variables = {
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing of
       * commitMutation */
      input: {
        deletedCommentId: firstCommentID,
      },
    };
    const FeedbackCommentQuery = graphql`
      query commitMutationTest1Query {
        node(id: "feedback123") {
          ... on Feedback {
            topLevelComments(first: 2) {
              count
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    `;
    const payload = {
      node: {
        __typename: 'Feedback',
        id: feedbackID,
        topLevelComments: {
          count: 2,
          edges: [
            {
              cursor: firstCommentID + ':cursor',
              node: {
                id: firstCommentID,
              },
            },
            {
              cursor: secondCommentID + ':cursor',
              node: {
                id: secondCommentID,
              },
            },
          ],
        },
      },
    };
    const optimisticResponse = () => ({
      commentDelete: {
        deletedCommentId: firstCommentID,
        feedback: {
          id: feedbackID,
          topLevelComments: {
            count: 1,
          },
        },
      },
    });
    const configs: Array<DeclarativeMutationConfig> = [
      {
        deletedIDFieldName: 'deletedCommentId',
        type: 'NODE_DELETE',
      },
    ];
    const optimisticUpdater = jest.fn<
      [RecordSourceSelectorProxy, ?{...}],
      void,
    >();
    const updater = jest.fn<[RecordSourceSelectorProxy, ?{...}], void>();
    const operationDescriptor = createOperationDescriptor(
      FeedbackCommentQuery,
      {},
    );
    environment.commitPayload(operationDescriptor, payload);
    const snapshot = store.lookup(
      createReaderSelector(
        FeedbackCommentQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );
    const callback = jest.fn<[Snapshot], void>();
    store.subscribe(snapshot, callback);
    commitMutation(environment, {
      configs,
      mutation,
      optimisticResponse,
      optimisticUpdater,
      updater,
      variables,
    });
    expect(callback.mock.calls.length).toBe(1);
    expect(optimisticUpdater).toBeCalled();
    callback.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, {
      data: {
        commentDelete: {
          deletedCommentId: firstCommentID,
          feedback: {
            id: feedbackID,
            topLevelComments: {
              count: 1,
            },
          },
        },
      },
    });
    jest.runAllTimers();
    expect(updater).toBeCalled();
    expect(callback.mock.calls.length).toBe(0);
  });
});

describe('Configs: RANGE_DELETE', () => {
  let environment, FeedbackCommentQuery, store;

  beforeEach(() => {
    jest.resetModules();

    environment = createMockEnvironment();
    store = environment.getStore();
  });

  it('handles configs', () => {
    const mutation = graphql`
      mutation commitMutationTest2Mutation($input: CommentDeleteInput) {
        commentDelete(input: $input) {
          deletedCommentId
          feedback {
            comments {
              count
            }
          }
        }
      }
    `;
    const commentID = 'comment123';
    const variables: commitMutationTest2Mutation$variables = {
      input: {
        commentId: commentID,
      },
    };
    const optimisticResponse = {
      commentDelete: {
        deletedCommentId: commentID,
        feedback: {
          comments: {
            count: 0,
          },
          id: '123',
        },
      },
    };
    const configs: Array<DeclarativeMutationConfig> = [
      {
        connectionKeys: [{key: 'Feedback_comments'}],
        deletedIDFieldName: 'deletedCommentId',
        parentID: '123',
        parentName: 'feedback',
        pathToConnection: ['feedback', 'comments'],
        type: 'RANGE_DELETE',
      },
    ];
    FeedbackCommentQuery = graphql`
      query commitMutationTest2Query {
        node(id: "123") {
          ... on Feedback {
            comments(first: 10) @connection(key: "Feedback_comments") {
              edges {
                node {
                  body {
                    text
                  }
                }
              }
            }
          }
        }
      }
    `;
    const payload = {
      node: {
        __typename: 'Feedback',
        comments: {
          count: 1,
          edges: [
            {
              cursor: '<cursor>',
              node: {
                __typename: 'Comment',
                body: {
                  text: '...',
                },
                id: commentID,
              },
            },
          ],
          page_info: {
            end_cursor: '<cursor>',
            has_next_page: true,
            has_previous_page: false,
            start_cursor: '<cursor>',
          },
        },
        id: '123',
      },
    };
    const operationDescriptor = createOperationDescriptor(
      FeedbackCommentQuery,
      {},
    );
    environment.commitPayload(operationDescriptor, payload);
    const optimisticUpdater = jest.fn<
      [RecordSourceSelectorProxy, ?{...}],
      void,
    >();
    const updater = jest.fn<[RecordSourceSelectorProxy, ?{...}], void>();
    const snapshot = store.lookup(
      createReaderSelector(
        FeedbackCommentQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );
    const callback = jest.fn<[Snapshot], void>();
    store.subscribe(snapshot, callback);
    commitMutation(environment, {
      configs,
      mutation,
      optimisticResponse,
      optimisticUpdater,
      updater,
      variables,
    });
    // Optimistically deletes
    expect(callback.mock.calls.length).toBe(1);
    expect(optimisticUpdater).toBeCalled();
    callback.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, {
      data: {
        commentDelete: {
          deletedCommentId: commentID,
          feedback: {
            comments: {
              count: 1,
            },
            id: '123',
          },
        },
      },
    });
    jest.runAllTimers();
    // Does not need to fire again since server data should be the same
    expect(updater).toBeCalled();
    expect(callback.mock.calls.length).toBe(0);
  });

  it('handles config with deletedIDFieldName as path', () => {
    const optimisticUpdater = jest.fn<
      [RecordSourceSelectorProxy, ?{...}],
      void,
    >();
    const updater = jest.fn<[RecordSourceSelectorProxy, ?{...}], void>();
    const mutation = graphql`
      mutation commitMutationTest3Mutation($input: UnfriendInput) {
        unfriend(input: $input) {
          actor {
            id
          }
          formerFriend {
            id
          }
        }
      }
    `;
    const configs: Array<DeclarativeMutationConfig> = [
      {
        connectionKeys: [{key: 'Friends_friends'}],
        deletedIDFieldName: ['formerFriend'],
        parentID: '123',
        parentName: 'actor',
        pathToConnection: ['actor', 'friends'],
        type: 'RANGE_DELETE',
      },
    ];
    const variables: commitMutationTest3Mutation$variables = {
      input: {
        friendId: '456',
      },
    };
    environment = createMockEnvironment();
    store = environment.getStore();

    const FriendQuery = graphql`
      query commitMutationTest3Query {
        viewer {
          actor {
            ... on User {
              friends(first: 1) @connection(key: "Friends_friends") {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;
    const payload = {
      viewer: {
        actor: {
          __typename: 'User',
          friends: {
            edges: [
              {
                __typename: 'User',
                cursor: '<cursor>',
                node: {
                  id: '456',
                },
              },
            ],
          },
          id: '123',
        },
      },
    };
    const operationDescriptor = createOperationDescriptor(FriendQuery, {});
    environment.commitPayload(operationDescriptor, payload);
    const optimisticResponse = {
      unfriend: {
        actor: {
          __typename: 'User',
          id: '123',
        },
        formerFriend: {
          id: '456',
        },
      },
    };
    const snapshot = store.lookup(
      createReaderSelector(
        FriendQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );
    const callback = jest.fn<[Snapshot], void>();
    store.subscribe(snapshot, callback);
    commitMutation(environment, {
      configs,
      mutation,
      optimisticResponse,
      optimisticUpdater,
      updater,
      variables,
    });
    expect(callback.mock.calls.length).toBe(1);
    expect(optimisticUpdater).toBeCalled();
    callback.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, {
      data: {
        unfriend: {
          actor: {
            __typename: 'User',
            id: '123',
          },
          formerFriend: {
            id: '456',
          },
        },
      },
    });
    jest.runAllTimers();
    expect(updater).toBeCalled();
    expect(callback.mock.calls.length).toBe(0);
  });
});

describe('Configs: RANGE_ADD', () => {
  let callback,
    CommentQuery:
      | Query<commitMutationTest4Query$variables, commitMutationTest4Query$data>
      | Query<
          commitMutationTest5Query$variables,
          commitMutationTest5Query$data,
        >,
    data,
    environment,
    mutation,
    optimisticUpdater,
    payload: {...},
    store,
    updater: (updaterStore: RecordSourceSelectorProxy) => void;
  const commentID = 'comment123';

  const feedbackID = 'feedback123';
  const variables = {
    input: {
      feedback: feedbackID,
      message: {
        ranges: [] as Array<unknown>,
        text: 'Hello!',
      },
    },
  };
  const nextCursor = 'comment789:cursor';
  const nextNodeID = 'comment789';
  const optimisticResponse = {
    commentCreate: {
      feedbackCommentEdge: {
        __typename: 'CommentsEdge',
        cursor: nextCursor,
        node: {
          body: {
            text: variables.input.message.text,
          },
          id: nextNodeID,
        },
      },
    },
  };

  beforeEach(() => {
    jest.resetModules();

    environment = createMockEnvironment();
    store = environment.getStore();

    mutation = graphql`
      mutation commitMutationTest4Mutation($input: CommentCreateInput) {
        commentCreate(input: $input) {
          feedbackCommentEdge {
            cursor
            node {
              id
              body {
                text
              }
            }
          }
        }
      }
    `;

    CommentQuery = graphql`
      query commitMutationTest4Query {
        node(id: "feedback123") {
          ... on Feedback {
            topLevelComments(first: 1)
              @connection(key: "Feedback_topLevelComments") {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    `;
    payload = {
      node: {
        __typename: 'Feedback',
        id: feedbackID,
        topLevelComments: {
          edges: [
            {
              cursor: commentID + ':cursor',
              node: {
                id: commentID,
              },
            },
          ],
        },
      },
    };
    callback = jest.fn<[Snapshot], void>();
    optimisticUpdater = jest.fn<[RecordSourceSelectorProxy, ?{...}], void>();
    updater = jest.fn();
    data = {
      data: {
        commentCreate: {
          feedbackCommentEdge: {
            __typename: 'CommentsEdge',
            cursor: nextCursor,
            node: {
              body: {
                text: variables.input.message.text,
              },
              id: nextNodeID,
            },
          },
        },
      },
    };
  });

  it('appends new edge', () => {
    const configs: Array<DeclarativeMutationConfig> = [
      {
        connectionInfo: [
          {
            key: 'Feedback_topLevelComments',
            rangeBehavior: 'append',
          },
        ],
        connectionName: 'topLevelComments',
        edgeName: 'feedbackCommentEdge',
        parentID: 'feedback123',
        type: 'RANGE_ADD',
      },
    ];
    const operationDescriptor = createOperationDescriptor(CommentQuery, {});
    environment.commitPayload(operationDescriptor, nullthrows(payload));
    const snapshot = store.lookup(
      createReaderSelector(
        CommentQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );
    store.subscribe(snapshot, callback);
    commitMutation(environment, {
      configs,
      mutation,
      optimisticResponse,
      optimisticUpdater,
      updater,
      /* $FlowFixMe[prop-missing] error exposed when improving flow typing of
       * commitMutation */
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      variables,
    });
    // Optimistically appends
    expect(callback.mock.calls.length).toBe(1);
    expect(optimisticUpdater).toBeCalled();
    callback.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, data);
    jest.runAllTimers();
    // Does not need to fire again since server data should be the same
    expect(updater).toBeCalled();
    expect(callback.mock.calls.length).toBe(0);
  });

  it('does not overwrite previous edge when appended multiple times', () => {
    const configs: Array<DeclarativeMutationConfig> = [
      {
        connectionInfo: [
          {
            key: 'Feedback_topLevelComments',
            rangeBehavior: 'append',
          },
        ],
        connectionName: 'topLevelComments',
        edgeName: 'feedbackCommentEdge',
        parentID: 'feedback123',
        type: 'RANGE_ADD',
      },
    ];
    // prepare existing data
    const operationDescriptor = createOperationDescriptor(CommentQuery, {});
    environment.commitPayload(operationDescriptor, {
      node: {
        __typename: 'Feedback',
        id: feedbackID,
        topLevelComments: {
          count: 1,
          edges: [
            {
              cursor: 'comment1:cursor',
              node: {
                id: 'comment1',
              },
            },
          ],
        },
      },
    });
    // send mutation
    commitMutation(environment, {
      configs,
      mutation,
      /* $FlowFixMe[prop-missing] error exposed when improving flow typing of
       * commitMutation */
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      variables,
    });

    let serverResponse = {
      data: {
        commentCreate: {
          feedbackCommentEdge: {
            __typename: 'CommentsEdge',
            cursor: 'comment2:cursor',
            node: {
              // these are extra fields which should be stripped off before appending
              // to the connection.
              body: {
                text: variables.input.message.text,
              },
              id: 'comment2',
            },
          },
        },
      },
    };
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, serverResponse);
    jest.runAllTimers();

    let snapshot = store.lookup(
      createReaderSelector(
        CommentQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );
    expect(snapshot.data).toEqual({
      node: {
        topLevelComments: {
          edges: [
            {
              cursor: 'comment1:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment1',
              },
            },
            {
              cursor: 'comment2:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment2',
              },
            },
          ],
          // The following fields are not quite related. Though not explicted requested in the query,
          // Relay now automatically adds the page info.
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      },
    });

    serverResponse = {
      data: {
        commentCreate: {
          feedbackCommentEdge: {
            __typename: 'CommentsEdge',
            cursor: 'comment3:cursor',
            node: {
              // these are extra fields which should be stripped off before appending
              // to the connection.
              body: {
                text: variables.input.message.text,
              },
              id: 'comment3',
            },
          },
        },
      },
    };
    // send the same mutation again
    commitMutation(environment, {
      configs,
      mutation,
      /* $FlowFixMe[prop-missing] error exposed when improving flow typing of
       * commitMutation */
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      variables,
    });
    environment.mock.resolve(operation, serverResponse);
    jest.runAllTimers();

    snapshot = store.lookup(
      createReaderSelector(
        CommentQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );

    expect(snapshot.data).toEqual({
      node: {
        topLevelComments: {
          edges: [
            {
              cursor: 'comment1:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment1',
              },
            },
            {
              cursor: 'comment2:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment2',
              },
            },
            {
              cursor: 'comment3:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment3',
              },
            },
          ],
          // The following fields are not quite related. Though not explicted requested in the query,
          // Relay now automatically adds the page info.
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      },
    });
  });

  it('prepends new edge', () => {
    const configs: Array<DeclarativeMutationConfig> = [
      {
        connectionInfo: [
          {
            key: 'Feedback_topLevelComments',
            rangeBehavior: 'prepend',
          },
        ],
        connectionName: 'topLevelComments',
        edgeName: 'feedbackCommentEdge',
        parentID: 'feedback123',
        type: 'RANGE_ADD',
      },
    ];
    const operationDescriptor = createOperationDescriptor(CommentQuery, {});
    environment.commitPayload(operationDescriptor, nullthrows(payload));
    const snapshot = store.lookup(
      createReaderSelector(
        CommentQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );
    store.subscribe(snapshot, callback);
    commitMutation(environment, {
      configs,
      mutation,
      optimisticResponse,
      optimisticUpdater,
      updater,
      /* $FlowFixMe[prop-missing] error exposed when improving flow typing of
       * commitMutation */
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      variables,
    });
    // Optimistically prepends
    expect(callback.mock.calls.length).toBe(1);
    expect(optimisticUpdater).toBeCalled();
    callback.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, data);
    jest.runAllTimers();
    // Does not need to fire again since server data should be the same
    expect(updater).toBeCalled();
    expect(callback.mock.calls.length).toBe(0);
  });

  it('filters connections then applies the rangeBehavior', () => {
    const configs: Array<DeclarativeMutationConfig> = [
      {
        connectionInfo: [
          {
            filters: {orderBy: 'chronological'},
            key: 'Feedback_topLevelComments',
            rangeBehavior: 'append',
          },
        ],
        connectionName: 'topLevelComments',
        edgeName: 'feedbackCommentEdge',
        parentID: 'feedback123',
        type: 'RANGE_ADD',
      },
    ];
    CommentQuery = graphql`
      query commitMutationTest5Query {
        node(id: "feedback123") {
          ... on Feedback {
            topLevelComments(orderBy: chronological, first: 1)
              @connection(key: "Feedback_topLevelComments") {
              count
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    `;
    const operationDescriptor = createOperationDescriptor(CommentQuery, {});
    environment.commitPayload(operationDescriptor, nullthrows(payload));
    const snapshot = store.lookup(
      createReaderSelector(
        CommentQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );
    store.subscribe(snapshot, callback);
    commitMutation(environment, {
      configs,
      mutation,
      optimisticResponse,
      optimisticUpdater,
      updater,
      /* $FlowFixMe[prop-missing] error exposed when improving flow typing of
       * commitMutation */
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      variables,
    });
    // Optimistically appends orderBy(chronological)
    expect(callback.mock.calls.length).toBe(1);
    expect(optimisticUpdater).toBeCalled();
    callback.mockClear();
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, data);
    jest.runAllTimers();
    // Does not need to fire again since server data should be the same
    expect(updater).toBeCalled();
    expect(callback.mock.calls.length).toBe(0);
  });

  it('does not overwrite previous edge when appended multiple times in updater function', () => {
    updater = (updaterStore: RecordSourceSelectorProxy) => {
      const rootField = updaterStore.getRootField('commentCreate');
      const newEdge = nullthrows(rootField).getLinkedRecord(
        'feedbackCommentEdge',
      );
      const feedbackProxy = nullthrows(updaterStore).get(feedbackID);
      const conn = ConnectionHandler.getConnection(
        nullthrows(feedbackProxy),
        'Feedback_topLevelComments',
      );
      ConnectionHandler.insertEdgeAfter(nullthrows(conn), nullthrows(newEdge));
    };
    // prepare existing data
    const operationDescriptor = createOperationDescriptor(CommentQuery, {});
    environment.commitPayload(operationDescriptor, {
      node: {
        __typename: 'Feedback',
        id: feedbackID,
        topLevelComments: {
          count: 1,
          edges: [
            {
              cursor: 'comment1:cursor',
              node: {
                id: 'comment1',
              },
            },
          ],
        },
      },
    });

    // send mutation
    commitMutation(environment, {
      mutation,
      updater,
      /* $FlowFixMe[prop-missing] error exposed when improving flow typing of
       * commitMutation */
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      variables,
    });

    let serverResponse = {
      data: {
        commentCreate: {
          feedbackCommentEdge: {
            __typename: 'CommentsEdge',
            cursor: 'comment2:cursor',
            node: {
              // these are extra fields which should be stripped off before appending
              // to the connection.
              body: {
                text: variables.input.message.text,
              },
              id: 'comment2',
            },
          },
        },
      },
    };

    const snapshot = store.lookup(
      createReaderSelector(
        CommentQuery.fragment,
        ROOT_ID,
        {},
        operationDescriptor.request,
      ),
    );

    environment.subscribe(snapshot, callback);

    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, serverResponse);
    jest.runAllTimers();

    expect(callback).toBeCalledTimes(1);
    expect(callback.mock.calls[0][0].data).toEqual({
      node: {
        topLevelComments: {
          edges: [
            {
              cursor: 'comment1:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment1',
              },
            },
            {
              cursor: 'comment2:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment2',
              },
            },
          ],
          // The following fields are not quite related. Though not explicted requested in the query,
          // Relay now automatically adds the page info.
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      },
    });
    callback.mockClear();

    serverResponse = {
      data: {
        commentCreate: {
          feedbackCommentEdge: {
            __typename: 'CommentsEdge',
            cursor: 'comment3:cursor',
            node: {
              // these are extra fields which should be stripped off before appending
              // to the connection.
              body: {
                text: variables.input.message.text,
              },
              id: 'comment3',
            },
          },
        },
      },
    };
    // send the same mutation again
    commitMutation(environment, {
      mutation,
      updater,
      /* $FlowFixMe[prop-missing] error exposed when improving flow typing of
       * commitMutation */
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      variables,
    });
    environment.mock.resolve(operation, serverResponse);
    jest.runAllTimers();

    expect(callback).toBeCalledTimes(1);
    expect(callback.mock.calls[0][0].data).toEqual({
      node: {
        topLevelComments: {
          edges: [
            {
              cursor: 'comment1:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment1',
              },
            },
            {
              cursor: 'comment2:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment2',
              },
            },
            {
              cursor: 'comment3:cursor',
              node: {
                __typename: 'Comment',
                id: 'comment3',
              },
            },
          ],
          // The following fields are not quite related. Though not explicted requested in the query,
          // Relay now automatically adds the page info.
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      },
    });
  });
});

describe('Aliased mutation roots', () => {
  beforeEach(() => {
    jest.mock('warning');
  });

  it('does not present a warning when mutation uses an aliased in combination with a optimistcResponse', () => {
    const environment = createMockEnvironment();
    const mutation = graphql`
      mutation commitMutationTest5Mutation($input: CommentDeleteInput) {
        alias: commentDelete(input: $input) {
          deletedCommentId
          feedback {
            id
            topLevelComments {
              count
            }
          }
        }
      }
    `;
    commitMutation(environment, {
      mutation,
      optimisticResponse: {
        alias: {
          deletedCommentId: 'oo ahh zippy do wah',
          feedback: {
            id: 'the feedback id',
            topLevelComments: {
              count: '>9000',
            },
          },
        },
      },
      variables: {},
    });
    expect(require('warning')).not.toHaveBeenCalledWith(
      undefined,
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('Required mutation roots', () => {
  let dataSource;
  let environment;
  beforeEach(() => {
    // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
    const fetch = jest.fn((_query, _variables, _cacheConfig) => {
      // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
      return RelayObservable.create(sink => {
        dataSource = sink;
      });
    });
    const source = RelayRecordSource.create({});
    const store = new RelayModernStore(source);
    environment = new RelayModernEnvironment({
      // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
      network: RelayNetwork.create(fetch),
      store,
    });
  });
  it('does not throw when accessing the root field', () => {
    const mutation = graphql`
      mutation commitMutationTestRequiredRootFieldMutation(
        $input: CommentDeleteInput
      ) {
        commentDelete(input: $input) {
          deletedCommentId
        }
      }
    `;

    let idInUpdater;
    commitMutation(environment, {
      mutation,
      updater: updaterStore => {
        const payload = updaterStore.getRootField('commentDelete');
        idInUpdater = payload?.getValue('deletedCommentId');
      },
      variables: {},
    });
    dataSource.next({
      data: {
        commentDelete: {
          deletedCommentId: '1',
        },
      },
    });

    expect(idInUpdater).toBe('1');
  });
});

describe('commitMutation()', () => {
  let dataSource;
  let environment;
  let fragment;
  let mutation;
  let onCompleted;
  let onError;
  let onNext;
  let variables: commitMutationTest6Mutation$variables;

  beforeEach(() => {
    fragment = graphql`
      fragment commitMutationTest2Fragment on Comment {
        id
        body {
          text
        }
      }
    `;
    mutation = graphql`
      mutation commitMutationTest6Mutation($input: CommentCreateInput!) {
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
    variables = {
      input: {
        feedbackId: '1',
      },
    };

    /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
     * enabling Flow LTI mode */
    onCompleted = jest.fn<_, void>();
    onError = jest.fn<[Error], void>();
    /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
     * enabling Flow LTI mode */
    onNext = jest.fn();
    // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
    const fetch = jest.fn((_query, _variables, _cacheConfig) => {
      // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
      return RelayObservable.create(sink => {
        dataSource = sink;
      });
    });
    const source = RelayRecordSource.create({});
    const store = new RelayModernStore(source);
    environment = new RelayModernEnvironment({
      // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
      network: RelayNetwork.create(fetch),
      store,
    });
  });

  it('publishes each payload to the store as it arrives', () => {
    const operation = createOperationDescriptor(mutation, variables);
    const initialSnapshot = environment.lookup(
      createReaderSelector(fragment, '1', {}, operation.request),
    );
    const callback = jest.fn<[Snapshot], void>();
    environment.subscribe(initialSnapshot, callback);

    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      variables,
    });
    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'Gave Relay',
            },
            id: '1',
          },
        },
      },
    });
    expect(callback).toBeCalledTimes(1);
    const snapshot = callback.mock.calls[0][0];
    expect(snapshot.isMissingData).toBe(false);
    expect(snapshot.data).toEqual({
      body: {text: 'Gave Relay'},
      id: '1',
    });

    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'GAVE RELAY!!!!', // updated
            },
            id: '1',
          },
        },
      },
    });
    expect(callback).toBeCalledTimes(2);
    const nextSnapshot = callback.mock.calls[1][0];
    expect(nextSnapshot.isMissingData).toBe(false);
    expect(nextSnapshot.data).toEqual({
      body: {text: 'GAVE RELAY!!!!'}, // updated text
      id: '1',
    });

    expect(onCompleted).toBeCalledTimes(0);
    expect(onError).toBeCalledTimes(0);
  });

  it('calls onCompleted when the mutation completes after one payload', () => {
    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      variables,
    });
    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'Gave Relay',
            },
            id: '1',
          },
        },
      },
    });
    expect(onCompleted).toBeCalledTimes(0);
    dataSource.complete();

    expect(onCompleted).toBeCalledTimes(1);
    expect(onCompleted.mock.calls[0][0]).toEqual({
      commentCreate: {
        comment: {
          body: {
            text: 'Gave Relay',
          },
          id: '1',
        },
      },
    });
    expect(onCompleted.mock.calls[0][1]).toBe(null);
    expect(onError).toBeCalledTimes(0);
  });

  it('calls onCompleted when the mutation completes after one payload with errors', () => {
    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      variables,
    });
    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'Gave Relay',
            },
            id: '1',
          },
        },
      },
      errors: [
        {
          locations: [],
          message: 'wtf',
          severity: 'ERROR',
        },
      ],
    } as GraphQLResponseWithoutData);
    expect(onCompleted).toBeCalledTimes(0);
    dataSource.complete();

    expect(onCompleted).toBeCalledTimes(1);
    expect(onCompleted.mock.calls[0][0]).toEqual({
      commentCreate: {
        comment: {
          body: {
            text: 'Gave Relay',
          },
          id: '1',
        },
      },
    });
    expect(onCompleted.mock.calls[0][1]).toEqual([
      {
        locations: [],
        message: 'wtf',
        severity: 'ERROR',
      },
    ]);
    expect(onError).toBeCalledTimes(0);
  });

  it('calls onCompleted with the latest data when the mutation completes after multiple payloads', () => {
    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      onNext,
      variables,
    });
    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'Gave Relay', // overridden by later payload
            },
            id: '1',
          },
        },
      },
      errors: [
        {
          locations: [],
          message: 'wtf',
          severity: 'ERROR',
        },
      ],
    } as GraphQLResponseWithoutData);
    expect(onNext).toBeCalledTimes(1);
    expect(onNext.mock.calls[0][0]).toBe(undefined);
    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'GAVE RELAY',
            },
            id: '1',
          },
        },
      },
      errors: [
        {
          locations: [],
          message: 'wtf again!',
          severity: 'ERROR',
        },
      ],
    } as GraphQLResponseWithoutData);
    expect(onCompleted).toBeCalledTimes(0);
    expect(onNext).toBeCalledTimes(2);
    expect(onNext.mock.calls[1][0]).toBe(undefined);
    dataSource.complete();

    expect(onCompleted).toBeCalledTimes(1);
    expect(onCompleted.mock.calls[0][0]).toEqual({
      commentCreate: {
        comment: {
          body: {
            text: 'GAVE RELAY', // matches value in latest payload
          },
          id: '1',
        },
      },
    });
    expect(onCompleted.mock.calls[0][1]).toEqual([
      {
        locations: [],
        message: 'wtf',
        severity: 'ERROR',
      },
      {
        locations: [],
        message: 'wtf again!',
        severity: 'ERROR',
      },
    ]);
    expect(onNext).toBeCalledTimes(2); // from before
    expect(onError).toBeCalledTimes(0);
  });

  it('calls onError when the payload is mising data', () => {
    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      variables,
    });
    dataSource.next({
      data: null, // error: missing data
      errors: [
        {
          locations: [],
          message: 'wtf',
          severity: 'ERROR',
        },
      ],
    });
    expect(onCompleted).toBeCalledTimes(0);
    expect(onError).toBeCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toContain(
      'No data returned for operation `commitMutationTest6Mutation`',
    );
  });

  it('calls onError when the network errors', () => {
    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      variables,
    });
    const error = new Error('wtf');
    dataSource.error(error);
    expect(onCompleted).toBeCalledTimes(0);
    expect(onError).toBeCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe(error);
  });

  it('calls onSettled after onCompleted on success', () => {
    /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
     * enabling Flow LTI mode */
    const onSettled = jest.fn<_, void>();
    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      onSettled,
      variables,
    });
    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'Gave Relay',
            },
            id: '1',
          },
        },
      },
    });
    dataSource.complete();

    expect(onCompleted).toBeCalledTimes(1);
    expect(onSettled).toBeCalledTimes(1);
    expect(onSettled.mock.calls[0][0]).toEqual(onCompleted.mock.calls[0][0]);
    expect(onSettled.mock.calls[0][1]).toBe(null);
    expect(onSettled.mock.calls[0][2]).toBe(null);
    expect(onError).toBeCalledTimes(0);
  });

  it('calls onSettled with payload errors on success with errors', () => {
    /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
     * enabling Flow LTI mode */
    const onSettled = jest.fn<_, void>();
    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      onSettled,
      variables,
    });
    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'Gave Relay',
            },
            id: '1',
          },
        },
      },
      errors: [
        {
          locations: [],
          message: 'wtf',
          severity: 'ERROR',
        },
      ],
    } as GraphQLResponseWithoutData);
    dataSource.complete();

    expect(onCompleted).toBeCalledTimes(1);
    expect(onSettled).toBeCalledTimes(1);
    expect(onSettled.mock.calls[0][0]).toEqual(onCompleted.mock.calls[0][0]);
    expect(onSettled.mock.calls[0][1]).toEqual(onCompleted.mock.calls[0][1]);
    expect(onSettled.mock.calls[0][2]).toBe(null);
    expect(onError).toBeCalledTimes(0);
  });

  it('calls onSettled after onError on network error', () => {
    /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
     * enabling Flow LTI mode */
    const onSettled = jest.fn<_, void>();
    const error = new Error('network failure');
    commitMutation(environment, {
      mutation,
      onCompleted,
      onError,
      onSettled,
      variables,
    });
    dataSource.error(error);

    expect(onError).toBeCalledTimes(1);
    expect(onSettled).toBeCalledTimes(1);
    expect(onSettled.mock.calls[0][0]).toBe(null);
    expect(onSettled.mock.calls[0][1]).toBe(null);
    expect(onSettled.mock.calls[0][2]).toBe(error);
    expect(onCompleted).toBeCalledTimes(0);
  });

  it('calls onSettled even without onCompleted or onError', () => {
    /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
     * enabling Flow LTI mode */
    const onSettled = jest.fn<_, void>();
    commitMutation(environment, {
      mutation,
      onSettled,
      variables,
    });
    dataSource.next({
      data: {
        commentCreate: {
          comment: {
            body: {
              text: 'Gave Relay',
            },
            id: '1',
          },
        },
      },
    });
    dataSource.complete();

    expect(onSettled).toBeCalledTimes(1);
    expect(onSettled.mock.calls[0][2]).toBe(null);
  });
});

describe('commitMutation() cacheConfig', () => {
  let cacheConfig: ?CacheConfig;
  let environment;
  let fragment;
  let mutation;
  let variables: commitMutationTest6Mutation$variables;

  beforeEach(() => {
    fragment = graphql`
      fragment commitMutationTest1Fragment on Comment {
        id
        body {
          text
        }
      }
    `;

    mutation = graphql`
      mutation commitMutationTest7Mutation($input: CommentCreateInput!) {
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
    variables = {
      input: {
        feedbackId: '1',
      },
    };

    cacheConfig = undefined;
    // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
    const fetch = jest.fn((_query, _variables, _cacheConfig) => {
      cacheConfig = _cacheConfig;
      /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
       * enabling Flow LTI mode */
      return RelayObservable.create(() => {});
    });
    const source = RelayRecordSource.create({});
    const store = new RelayModernStore(source);
    environment = new RelayModernEnvironment({
      // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
      network: RelayNetwork.create(fetch),
      store,
    });
  });

  it('with cacheConfig', () => {
    const operation = createOperationDescriptor(mutation, variables);
    const initialSnapshot = environment.lookup(
      createReaderSelector(fragment, '1', {}, operation.request),
    );
    const callback = jest.fn<[Snapshot], void>();
    environment.subscribe(initialSnapshot, callback);

    const metadata = {
      text: 'Gave Relay',
    };

    commitMutation(environment, {
      cacheConfig: {
        force: false, // should be overriden with false
        metadata,
      },
      mutation,
      variables,
    });

    expect(cacheConfig).toEqual({
      force: true,
      metadata,
    });
  });

  it('without cacheConfig', () => {
    const operation = createOperationDescriptor(mutation, variables);
    const initialSnapshot = environment.lookup(
      createReaderSelector(fragment, '1', {}, operation.request),
    );
    const callback = jest.fn<[Snapshot], void>();
    environment.subscribe(initialSnapshot, callback);

    commitMutation(environment, {
      mutation,
      variables,
    });

    expect(cacheConfig).toEqual({force: true});
  });
});
