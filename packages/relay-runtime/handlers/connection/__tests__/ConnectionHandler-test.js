/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall relay
 */

'use strict';

const RelayRecordSourceMutator = require('../../../mutations/RelayRecordSourceMutator');
const {
  createRelayRecordSourceProxy,
} = require('../../../mutations/RelayRecordSourceProxyOptimized');
const {graphql} = require('../../../query/GraphQLTag');
const defaultGetDataID = require('../../../store/defaultGetDataID');
const {
  createNormalizationSelector,
} = require('../../../store/RelayModernSelector');
const RelayModernStore = require('../../../store/RelayModernStore');
const RelayRecordSource = require('../../../store/RelayRecordSource');
const RelayResponseNormalizer = require('../../../store/RelayResponseNormalizer');
const RelayStoreUtils = require('../../../store/RelayStoreUtils');
const getRelayHandleKey = require('../../../util/getRelayHandleKey');
const ConnectionHandler = require('../ConnectionHandler');
const ConnectionInterface = require('../ConnectionInterface');
const {simpleClone} = require('relay-test-utils-internal');

const {
  ID_KEY,
  REF_KEY,
  REFS_KEY,
  ROOT_ID,
  ROOT_TYPE,
  TYPENAME_KEY,
  getStableStorageKey,
} = RelayStoreUtils;
const {END_CURSOR, HAS_NEXT_PAGE, HAS_PREV_PAGE, PAGE_INFO, START_CURSOR} =
  ConnectionInterface.get();

describe('ConnectionHandler', () => {
  let ConnectionQuery;
  let baseSource;
  let mutator;
  let proxy;
  let sinkSource;

  function normalize(payload, variables, options, errors) {
    RelayResponseNormalizer.normalize(
      baseSource,
      createNormalizationSelector(
        ConnectionQuery.operation,
        ROOT_ID,
        variables,
      ),
      payload,
      options ?? {
        getDataID: defaultGetDataID,
      },
      errors,
    );
  }

  beforeEach(() => {
    jest.resetModules();

    baseSource = new RelayRecordSource({
      [ROOT_ID]: {
        [ID_KEY]: ROOT_ID,
        [TYPENAME_KEY]: ROOT_TYPE,
      },
    });
    sinkSource = new RelayRecordSource({});
    mutator = new RelayRecordSourceMutator(baseSource, sinkSource);
    proxy = createRelayRecordSourceProxy(mutator, defaultGetDataID, null);

    ConnectionQuery = graphql`
      query ConnectionHandlerTestConnectionQuery(
        $id: ID!
        $before: ID
        $count: Int
        $after: ID
        $orderby: [String]
      ) {
        node(id: $id) {
          ... on User {
            friends(
              before: $before
              after: $after
              first: $count
              orderby: $orderby
            )
              @__clientField(
                handle: "connection"
                filters: ["orderby"]
                key: "ConnectionQuery_friends"
              ) {
              count
              edges {
                cursor
                node {
                  id
                }
              }
              pageInfo {
                endCursor
                hasNextPage
                hasPreviousPage
                startCursor
              }
            }
          }
        }
      }
    `;
  });

  describe('getConnectionID()', () => {
    it('returns the connection ID when no filters are specified', () => {
      expect(
        ConnectionHandler.getConnectionID('4', 'ConnectionQuery_friends'),
      ).toBe('client:4:__ConnectionQuery_friends_connection');
    });

    it('returns the connection ID when filters are specified', () => {
      expect(
        ConnectionHandler.getConnectionID('4', 'ConnectionQuery_friends', {
          orderby: ['first name'],
        }),
      ).toBe(
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
      );
    });
  });

  describe('field errors', () => {
    it('propagates errors to virtual connection field from server connection field', () => {
      normalize(
        {
          node: {
            id: '4',
            __typename: 'User',
            friends: null,
          },
        },
        {
          after: null,
          before: null,
          count: 10,
          orderby: ['first name'],
          id: '4',
        },
        undefined,
        [{message: 'Oops!', path: ['node', 'friends']}],
      );
      const args = {first: 10, orderby: ['first name']};
      const handleKey =
        getRelayHandleKey('connection', 'ConnectionQuery_friends', 'friends') +
        '(orderby:["first name"])';
      const payload = {
        args,
        dataID: '4',
        fieldKey: getStableStorageKey('friends', args),
        handleKey,
      };
      ConnectionHandler.update(proxy, payload);
      expect(sinkSource.toJSON()['4'].__errors).toEqual({
        '__ConnectionQuery_friends_connection(orderby:["first name"])': [
          {message: 'Oops!'},
        ],
      });
    });

    it('leaves errors when a valid value is added', () => {
      normalize(
        {
          node: {
            id: '4',
            __typename: 'User',
            friends: null,
          },
        },
        {
          after: null,
          before: null,
          count: 10,
          orderby: ['first name'],
          id: '4',
        },
        undefined,
        [{message: 'Oops!', path: ['node', 'friends']}],
      );

      const args = {first: 10, orderby: ['first name']};
      const handleKey =
        getRelayHandleKey('connection', 'ConnectionQuery_friends', 'friends') +
        '(orderby:["first name"])';
      const payload = {
        args,
        dataID: '4',
        fieldKey: getStableStorageKey('friends', args),
        handleKey,
      };
      ConnectionHandler.update(proxy, payload);
      // Re-check that an error is set (same as basic error test)
      expect(sinkSource.toJSON()['4'].__errors).toEqual({
        '__ConnectionQuery_friends_connection(orderby:["first name"])': [
          {message: 'Oops!'},
        ],
      });

      // Check that the error is not cleared even if new data arrives
      normalize(
        {
          node: {
            id: '4',
            __typename: 'User',
            friends: [],
          },
        },
        {
          after: null,
          before: null,
          count: 10,
          orderby: ['first name'],
          id: '4',
        },
        undefined,
        undefined,
      );
      ConnectionHandler.update(proxy, payload);
      expect(sinkSource.toJSON()['4'].__errors).toEqual({
        '__ConnectionQuery_friends_connection(orderby:["first name"])': [
          {message: 'Oops!'},
        ],
      });
    });
  });

  describe('insertEdgeAfter()', () => {
    let connection;
    let connectionID;
    let newEdge;

    beforeEach(() => {
      normalize(
        {
          node: {
            id: '4',
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:1',
                  node: {
                    id: '1',
                  },
                },
                {
                  cursor: 'cursor:2',
                  node: {
                    id: '2',
                  },
                },
              ],
              [PAGE_INFO]: {
                [END_CURSOR]: 'cursor:1',
                [HAS_NEXT_PAGE]: true,
                [HAS_PREV_PAGE]: false,
                [START_CURSOR]: 'cursor:1',
              },
            },
          },
        },
        {
          after: null,
          before: null,
          count: 10,
          orderby: ['first name'],
          id: '4',
        },
      );
      const args = {first: 10, orderby: ['first name']};
      const handleKey =
        getRelayHandleKey('connection', 'ConnectionQuery_friends', 'friends') +
        '(orderby:["first name"])';
      const payload = {
        args,
        dataID: '4',
        fieldKey: getStableStorageKey('friends', args),
        handleKey,
      };
      ConnectionHandler.update(proxy, payload);
      const store = new RelayModernStore(baseSource);
      store.publish(sinkSource);
      baseSource = new RelayRecordSource(baseSource.toJSON());
      sinkSource = new RelayRecordSource({});
      mutator = new RelayRecordSourceMutator(baseSource, sinkSource);
      proxy = createRelayRecordSourceProxy(mutator, defaultGetDataID, null);

      connection = ConnectionHandler.getConnection(
        proxy.get('4'),
        'ConnectionQuery_friends',
        {orderby: ['first name']},
      );
      connectionID = connection.getDataID();
      newEdge = proxy.create('newedge', 'FriendsEdge');
      newEdge.setValue('cursor:newedge', 'edge');
    });

    it('creates the edges array if it does not exist', () => {
      connection = proxy.create('connection', 'FriendsConnection');
      ConnectionHandler.insertEdgeAfter(connection, newEdge);
      expect(sinkSource.toJSON().connection).toEqual({
        [ID_KEY]: 'connection',
        [TYPENAME_KEY]: 'FriendsConnection',
        edges: {
          [REFS_KEY]: ['newedge'],
        },
      });
    });

    it('appends the edge if no cursor is supplied', () => {
      ConnectionHandler.insertEdgeAfter(connection, newEdge);
      expect(sinkSource.toJSON()[connectionID]).toEqual({
        [ID_KEY]: connectionID,
        [TYPENAME_KEY]: 'FriendsConnection',
        edges: {
          [REFS_KEY]: [
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
            'newedge',
          ],
        },
      });
    });

    it('appends the edge if the cursor is not found', () => {
      ConnectionHandler.insertEdgeAfter(connection, newEdge, 'bad-cursor');
      expect(sinkSource.toJSON()[connectionID]).toEqual({
        [ID_KEY]: connectionID,
        [TYPENAME_KEY]: 'FriendsConnection',
        edges: {
          [REFS_KEY]: [
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
            'newedge',
          ],
        },
      });
    });

    it('inserts the edge after the edge with the given cursor', () => {
      ConnectionHandler.insertEdgeAfter(connection, newEdge, 'cursor:1');
      expect(sinkSource.toJSON()[connectionID]).toEqual({
        [ID_KEY]: connectionID,
        [TYPENAME_KEY]: 'FriendsConnection',
        edges: {
          [REFS_KEY]: [
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
            'newedge',
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
          ],
        },
      });
    });
  });

  describe('insertEdgeBefore()', () => {
    let connection;
    let connectionID;
    let newEdge;

    beforeEach(() => {
      normalize(
        {
          node: {
            id: '4',
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:1',
                  node: {
                    id: '1',
                  },
                },
                {
                  cursor: 'cursor:2',
                  node: {
                    id: '2',
                  },
                },
              ],
              [PAGE_INFO]: {
                [END_CURSOR]: 'cursor:1',
                [HAS_NEXT_PAGE]: true,
                [HAS_PREV_PAGE]: false,
                [START_CURSOR]: 'cursor:1',
              },
            },
          },
        },
        {
          after: null,
          before: null,
          count: 10,
          orderby: ['first name'],
          id: '4',
        },
      );
      const args = {first: 10, orderby: ['first name']};
      const handleKey =
        getRelayHandleKey('connection', 'ConnectionQuery_friends', 'friends') +
        '(orderby:["first name"])';
      const payload = {
        args,
        dataID: '4',
        fieldKey: getStableStorageKey('friends', args),
        handleKey,
      };
      ConnectionHandler.update(proxy, payload);
      const store = new RelayModernStore(baseSource);
      store.publish(sinkSource);
      baseSource = new RelayRecordSource(simpleClone(baseSource.toJSON()));
      sinkSource = new RelayRecordSource({});
      mutator = new RelayRecordSourceMutator(baseSource, sinkSource);
      proxy = createRelayRecordSourceProxy(mutator, defaultGetDataID, null);

      connection = ConnectionHandler.getConnection(
        proxy.get('4'),
        'ConnectionQuery_friends',
        {orderby: ['first name']},
      );
      connectionID = connection.getDataID();
      newEdge = proxy.create('newedge', 'FriendsEdge');
      newEdge.setValue('cursor:newedge', 'edge');
    });

    it('creates the edges array if it does not exist', () => {
      connection = proxy.create('connection', 'FriendsConnection');
      ConnectionHandler.insertEdgeBefore(connection, newEdge);
      expect(sinkSource.toJSON().connection).toEqual({
        [ID_KEY]: 'connection',
        [TYPENAME_KEY]: 'FriendsConnection',
        edges: {
          [REFS_KEY]: ['newedge'],
        },
      });
    });

    it('prepends the edge if no cursor is supplied', () => {
      ConnectionHandler.insertEdgeBefore(connection, newEdge);
      expect(sinkSource.toJSON()[connectionID]).toEqual({
        [ID_KEY]: connectionID,
        [TYPENAME_KEY]: 'FriendsConnection',
        edges: {
          [REFS_KEY]: [
            'newedge',
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
          ],
        },
      });
    });

    it('prepends the edge if the cursor is not found', () => {
      ConnectionHandler.insertEdgeBefore(connection, newEdge, 'bad-cursor');
      expect(sinkSource.toJSON()[connectionID]).toEqual({
        [ID_KEY]: connectionID,
        [TYPENAME_KEY]: 'FriendsConnection',
        edges: {
          [REFS_KEY]: [
            'newedge',
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
          ],
        },
      });
    });

    it('inserts the edge before the edge with the given cursor', () => {
      ConnectionHandler.insertEdgeBefore(connection, newEdge, 'cursor:2');
      expect(sinkSource.toJSON()[connectionID]).toEqual({
        [ID_KEY]: connectionID,
        [TYPENAME_KEY]: 'FriendsConnection',
        edges: {
          [REFS_KEY]: [
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
            'newedge',
            'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
          ],
        },
      });
    });
  });

  describe('deleteNode()', () => {
    let connection;
    let connectionID;

    beforeEach(() => {
      normalize(
        {
          node: {
            id: '4',
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:1',
                  node: {
                    id: '1',
                  },
                },
                {
                  cursor: 'cursor:2',
                  node: {
                    id: '2',
                  },
                },
              ],
              [PAGE_INFO]: {
                [END_CURSOR]: 'cursor:1',
                [HAS_NEXT_PAGE]: true,
                [HAS_PREV_PAGE]: false,
                [START_CURSOR]: 'cursor:1',
              },
            },
          },
        },
        {
          after: null,
          before: null,
          count: 10,
          orderby: ['first name'],
          id: '4',
        },
      );
      const args = {first: 10, orderby: ['first name']};
      const handleKey =
        getRelayHandleKey('connection', 'ConnectionQuery_friends', 'friends') +
        '(orderby:["first name"])';
      const payload = {
        args,
        dataID: '4',
        fieldKey: getStableStorageKey('friends', args),
        handleKey,
      };
      ConnectionHandler.update(proxy, payload);
      const store = new RelayModernStore(baseSource);
      store.publish(sinkSource);
      baseSource = new RelayRecordSource(simpleClone(baseSource.toJSON()));
      sinkSource = new RelayRecordSource({});
      mutator = new RelayRecordSourceMutator(baseSource, sinkSource);
      proxy = createRelayRecordSourceProxy(mutator, defaultGetDataID, null);

      connection = ConnectionHandler.getConnection(
        proxy.get('4'),
        'ConnectionQuery_friends',
        {orderby: ['first name']},
      );
      connectionID = connection.getDataID();
    });

    it('does nothing if the node is not found', () => {
      ConnectionHandler.deleteNode(connection, '<not-in-connection>');
      expect(sinkSource.toJSON()).toEqual({});
    });

    it('deletes the matching edge from the connection', () => {
      ConnectionHandler.deleteNode(connection, '1');
      expect(baseSource.toJSON()[connectionID].edges[REFS_KEY]).toEqual([
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
      ]);
      expect(sinkSource.toJSON()).toEqual({
        [connectionID]: {
          [ID_KEY]: connectionID,
          [TYPENAME_KEY]: 'FriendsConnection',
          edges: {
            [REFS_KEY]: [
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
            ],
          },
        },
      });
    });
  });

  describe('update()', () => {
    it('does nothing if the payload record does not exist', () => {
      const payload = {
        dataID: 'unfetched',
        fieldKey: 'friends',
        handleKey: getRelayHandleKey('connection', null, 'friends'),
      };
      ConnectionHandler.update(proxy, payload);
      expect(sinkSource.toJSON()).toEqual({});
    });

    it('sets the handle as deleted if the server record is null', () => {
      const baseData = baseSource.toJSON();
      // link to a deleted record
      baseData[ROOT_ID].friends = {[REF_KEY]: 'friends'};
      baseData.friends = null;

      const payload = {
        dataID: ROOT_ID,
        fieldKey: 'friends',
        handleKey: getRelayHandleKey('connection', null, 'friend'),
      };
      ConnectionHandler.update(proxy, payload);
      expect(sinkSource.toJSON()).toEqual({
        [ROOT_ID]: {
          [ID_KEY]: ROOT_ID,
          [TYPENAME_KEY]: ROOT_TYPE,
          [payload.handleKey]: null,
        },
      });
    });

    it('sets the handle as deleted if the server record is undefined', () => {
      const baseData = baseSource.toJSON();
      // link to an unfetched record
      baseData[ROOT_ID].friends = {[REF_KEY]: 'friends'};
      baseData.friends = null;

      const payload = {
        dataID: ROOT_ID,
        fieldKey: 'friends',
        handleKey: getRelayHandleKey('connection', null, 'friend'),
      };
      ConnectionHandler.update(proxy, payload);
      expect(sinkSource.toJSON()).toEqual({
        [ROOT_ID]: {
          [ID_KEY]: ROOT_ID,
          [TYPENAME_KEY]: ROOT_TYPE,
          [payload.handleKey]: null,
        },
      });
    });

    it('creates a client connection with initial server data', () => {
      normalize(
        {
          node: {
            id: '4',
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:1',
                  node: {
                    id: '1',
                  },
                },
              ],
              [PAGE_INFO]: {
                [END_CURSOR]: 'cursor:1',
                [HAS_NEXT_PAGE]: true,
                [HAS_PREV_PAGE]: false,
                [START_CURSOR]: 'cursor:1',
              },
            },
          },
        },
        {
          after: null,
          before: null,
          count: 10,
          orderby: ['first name'],
          id: '4',
        },
      );
      const args = {first: 10, orderby: ['first name']};
      const handleKey =
        getRelayHandleKey('connection', 'ConnectionQuery_friends', 'friends') +
        '(orderby:["first name"])';
      const payload = {
        args,
        dataID: '4',
        fieldKey: getStableStorageKey('friends', args),
        handleKey,
      };
      ConnectionHandler.update(proxy, payload);
      expect(sinkSource.toJSON()).toEqual({
        4: {
          __id: '4',
          [ID_KEY]: '4',
          [TYPENAME_KEY]: 'User',
          [payload.handleKey]: {
            [REF_KEY]:
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
          },
        },
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
          {
            [ID_KEY]:
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
            [TYPENAME_KEY]: 'FriendsConnection',
            edges: {
              [REFS_KEY]: [
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
              ],
            },
            [PAGE_INFO]: {
              [REF_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
            },
            __connection_next_edge_index: 1,
          },
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0':
          {
            [ID_KEY]:
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
            [TYPENAME_KEY]: 'FriendsEdge',
            cursor: 'cursor:1',
            node: {[REF_KEY]: '1'},
          },
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
          {
            [ID_KEY]:
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
            [TYPENAME_KEY]: 'PageInfo',
            [END_CURSOR]: 'cursor:1',
            [HAS_NEXT_PAGE]: true,
            [HAS_PREV_PAGE]: false,
            [START_CURSOR]: 'cursor:1',
          },
      });
    });

    it('populates default values for page info', () => {
      normalize(
        {
          node: {
            id: '4',
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:1',
                  node: {
                    id: '1',
                  },
                },
              ],
              // no pageInfo
            },
          },
        },
        {
          after: null,
          before: null,
          count: 10,
          orderby: ['first name'],
          id: '4',
        },
      );
      const args = {first: 10, orderby: ['first name']};
      const handleKey =
        getRelayHandleKey('connection', 'ConnectionQuery_friends', 'friends') +
        '(orderby:["first name"])';
      const payload = {
        args,
        dataID: '4',
        fieldKey: getStableStorageKey('friends', args),
        handleKey,
      };
      ConnectionHandler.update(proxy, payload);
      expect(sinkSource.toJSON()).toEqual({
        4: {
          __id: '4',
          [ID_KEY]: '4',
          [TYPENAME_KEY]: 'User',
          [payload.handleKey]: {
            [REF_KEY]:
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
          },
        },
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
          {
            [ID_KEY]:
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
            [TYPENAME_KEY]: 'FriendsConnection',
            edges: {
              [REFS_KEY]: [
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
              ],
            },
            [PAGE_INFO]: {
              [REF_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
            },
            __connection_next_edge_index: 1,
          },
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0':
          {
            [ID_KEY]:
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
            [TYPENAME_KEY]: 'FriendsEdge',
            cursor: 'cursor:1',
            node: {[REF_KEY]: '1'},
          },
        'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
          {
            [ID_KEY]:
              'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
            [TYPENAME_KEY]: 'PageInfo',
            [END_CURSOR]: null,
            [HAS_NEXT_PAGE]: false,
            [HAS_PREV_PAGE]: false,
            [START_CURSOR]: null,
          },
      });
    });

    describe('subsequent fetches', () => {
      beforeEach(() => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:1',
                    node: {
                      id: '1',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:1',
                  [HAS_NEXT_PAGE]: true,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:1',
                },
              },
            },
          },
          {
            after: null,
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        const store = new RelayModernStore(baseSource);
        store.publish(sinkSource);
        baseSource = new RelayRecordSource(simpleClone(baseSource.toJSON()));
        sinkSource = new RelayRecordSource({});
        mutator = new RelayRecordSourceMutator(baseSource, sinkSource);
        proxy = createRelayRecordSourceProxy(mutator, defaultGetDataID, null);
      });

      it('appends new edges', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      id: '2',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:2',
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:2',
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '2'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:2',
              [HAS_NEXT_PAGE]: false,
            },
        });
      });

      it('appends two streamed edges, which have been streamed before and know their end cursors', () => {
        // First edge
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      id: '2',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  // EACH EDGE ALREADY WILL KNOW ITS END CURSOR FOR THAT PAGE
                  [END_CURSOR]: 'cursor:3',
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:2',
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '2'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:3',
              [HAS_NEXT_PAGE]: false,
            },
        });

        // Second Edge
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:3',
                    node: {
                      id: '3',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  // EACH EDGE ALREADY WILL KNOW ITS END CURSOR FOR THAT PAGE
                  // (THIS IS FINAL EDGE, BUT STILL...)
                  [END_CURSOR]: 'cursor:3',
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:2',
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const secondArgs = {
          after: 'cursor:1',
          first: 10,
          orderby: ['first name'],
        };
        const secondHandleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const secondPayload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', secondArgs),
          handleKey: secondHandleKey,
        };
        ConnectionHandler.update(proxy, secondPayload);

        const result = {
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 3,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '2'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:3',
              node: {[REF_KEY]: '3'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:3',
              [HAS_NEXT_PAGE]: false,
            },
        };
        expect(sinkSource.toJSON()).toEqual(result);
      });

      it('prepends new edges', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:0',
                    node: {
                      id: '0',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:0',
                  [HAS_PREV_PAGE]: false,
                  [HAS_NEXT_PAGE]: false,
                  [START_CURSOR]: 'cursor:0',
                },
              },
            },
          },
          {
            after: null,
            before: 'cursor:1',
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {before: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:0',
              node: {[REF_KEY]: '0'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [HAS_PREV_PAGE]: false,
              [START_CURSOR]: 'cursor:0',
            },
        });
      });

      it('resets the connection for head loads (no after/before args)', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:0',
                    node: {
                      id: '0',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:0',
                  [HAS_PREV_PAGE]: false,
                  [HAS_NEXT_PAGE]: true,
                  [START_CURSOR]: 'cursor:0',
                },
              },
            },
          },
          {
            after: null,
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:0',
              node: {[REF_KEY]: '0'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:0',
              [HAS_PREV_PAGE]: false,
              [HAS_NEXT_PAGE]: true,
              [START_CURSOR]: 'cursor:0',
            },
        });
      });

      it('appends new edges with null cursors', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: null,
                    node: {
                      id: '2',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:2',
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:2',
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: null,
              node: {[REF_KEY]: '2'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:2',
              [HAS_NEXT_PAGE]: false,
            },
        });
      });

      it('updates the end cursor using server page info', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      id: '2',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:updated',
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: null,
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '2'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:updated',
              [HAS_NEXT_PAGE]: false,
            },
        });
      });

      it('ignores null end cursors', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [],
                [PAGE_INFO]: {
                  [END_CURSOR]: null,
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: null,
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [HAS_NEXT_PAGE]: false,
              // end_cursor is skipped
            },
        });
      });

      it('skips edges with duplicate node data id (server `id`)', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2', // new cursor
                    node: {
                      id: '1', // same as existing edge
                    },
                  },
                  {
                    cursor: 'cursor:3',
                    node: {
                      id: '3',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:3',
                  [HAS_NEXT_PAGE]: true,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:3',
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  // '...edges:0' skipped bc of duplicate node id
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 3,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '1'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:3',
              node: {[REF_KEY]: '3'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:3',
              [HAS_NEXT_PAGE]: true,
            },
        });
      });

      it('skips edges with duplicate node data id (client ids)', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2', // new cursor
                    node: {
                      // below getDataID() rewrites to same __id as the existing
                      // edge
                      id: '<duplicate-1>',
                    },
                  },
                  {
                    cursor: 'cursor:3',
                    node: {
                      id: '3',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:3',
                  [HAS_NEXT_PAGE]: true,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:3',
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
          {
            getDataID: (value, typeName) => {
              if (value.id === '<duplicate-1>') {
                return '1';
              }
              return value.id;
            },
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  // '...edges:0' skipped bc of duplicate node id
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 3,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '1'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:3',
              node: {[REF_KEY]: '3'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:3',
              [HAS_NEXT_PAGE]: true,
            },
        });
      });

      it('adds edges with duplicate cursors', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:1', // same cursor as existing edge
                    node: {
                      id: '2', // different node id
                    },
                  },
                  {
                    cursor: 'cursor:3',
                    node: {
                      id: '3',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:3',
                  [HAS_NEXT_PAGE]: true,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:3',
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 3,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:1',
              node: {[REF_KEY]: '2'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:2',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:3',
              node: {[REF_KEY]: '3'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:3',
              [HAS_NEXT_PAGE]: true,
            },
        });
      });

      it('skips backward pagination payloads with unknown cursors', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      id: '2',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:2',
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: true,
                  [START_CURSOR]: 'cursor:2',
                },
              },
            },
          },
          {
            after: null,
            before: '<unknown-cursor>',
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {
          before: '<unknown-cursor>',
          first: 10,
          orderby: ['first name'],
        };
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';

        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '2'},
            },
          // page info unchanged
        });
      });

      it('skips forward pagination payloads with unknown cursors', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      id: '2',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:2',
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: true,
                  [START_CURSOR]: 'cursor:2',
                },
              },
            },
          },
          {
            after: '<unknown-cursor>',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {
          after: '<unknown-cursor>',
          first: 10,
          orderby: ['first name'],
        };
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '2'},
            },
          // page info unchanged
        });
      });
      it('updates fields on connection', () => {
        normalize(
          {
            node: {
              id: '4',
              __typename: 'User',
              friends: {
                count: 2,
                edges: [
                  {
                    cursor: 'cursor:2',
                    node: {
                      id: '2',
                    },
                  },
                ],
                [PAGE_INFO]: {
                  [END_CURSOR]: 'cursor:2',
                  [HAS_NEXT_PAGE]: false,
                  [HAS_PREV_PAGE]: false,
                  [START_CURSOR]: 'cursor:2',
                },
              },
            },
          },
          {
            after: 'cursor:1',
            before: null,
            count: 10,
            orderby: ['first name'],
            id: '4',
          },
        );
        const args = {after: 'cursor:1', first: 10, orderby: ['first name']};
        const handleKey =
          getRelayHandleKey(
            'connection',
            'ConnectionQuery_friends',
            'friends',
          ) + '(orderby:["first name"])';
        const payload = {
          args,
          dataID: '4',
          fieldKey: getStableStorageKey('friends', args),
          handleKey,
        };
        ConnectionHandler.update(proxy, payload);
        expect(sinkSource.toJSON()).toEqual({
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"])',
              [TYPENAME_KEY]: 'FriendsConnection',
              count: 2,
              edges: {
                [REFS_KEY]: [
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:0',
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
                ],
              },
              pageInfo: {
                [REF_KEY]:
                  'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              },
              __connection_next_edge_index: 2,
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):edges:1',
              [TYPENAME_KEY]: 'FriendsEdge',
              cursor: 'cursor:2',
              node: {[REF_KEY]: '2'},
            },
          'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo':
            {
              [ID_KEY]:
                'client:4:__ConnectionQuery_friends_connection(orderby:["first name"]):pageInfo',
              [TYPENAME_KEY]: 'PageInfo',
              [END_CURSOR]: 'cursor:2',
              [HAS_NEXT_PAGE]: false,
            },
        });
      });
    });
  });
});
