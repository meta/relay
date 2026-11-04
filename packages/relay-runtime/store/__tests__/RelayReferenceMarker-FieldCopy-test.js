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

import type {DataID} from '../../util/RelayRuntimeTypes';
import type {ReferenceMarkerOptions} from '../RelayReferenceMarker';
import type {MutableRecordSource, RecordSourceJSON} from '../RelayStoreTypes';

import RelayNetwork from '../../network/RelayNetwork';
import {graphql} from '../../query/GraphQLTag';
import RelayModernEnvironment from '../RelayModernEnvironment';
import {createOperationDescriptor} from '../RelayModernOperationDescriptor';
import RelayModernRecord from '../RelayModernRecord';
import RelayModernStore from '../RelayModernStore';
import RelayRecordSource from '../RelayRecordSource';
import {mark} from '../RelayReferenceMarker';
import {ROOT_ID} from '../RelayStoreUtils';

function copy(
  source: MutableRecordSource,
  operation: ReturnType<typeof createOperationDescriptor>,
  options?: ReferenceMarkerOptions,
): RecordSourceJSON {
  const target = RelayRecordSource.create();
  mark(source, operation.root, new Set(), null, false, {...options, target});
  return target.toJSON();
}

function createEnvironment(
  source: MutableRecordSource,
): RelayModernEnvironment {
  return new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store: new RelayModernStore(source),
  });
}

describe('RelayReferenceMarker field copy (`target`)', () => {
  it('copies only the selected fields and their errors', () => {
    const Query = graphql`
      query RelayReferenceMarkerFieldCopyTestFieldsQuery {
        me {
          name
          lastName
        }
      }
    `;
    const operation = createOperationDescriptor(Query, {});
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '4'},
      },
      '4': {
        __errors: {lastName: [{message: 'failed'}]},
        __id: '4',
        __typename: 'User',
        lastName: null,
        name: 'Zuck',
        username: 'SECRET_SERVER_ONLY',
      },
    });
    expect(copy(source, operation)).toEqual({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '4'},
      },
      '4': {
        __errors: {lastName: [{message: 'failed'}]},
        __id: '4',
        __typename: 'User',
        lastName: null,
        name: 'Zuck',
      },
    });
  });

  it('replaces an earlier error when copying into an existing record', () => {
    const Query = graphql`
      query RelayReferenceMarkerFieldCopyTestErrorsQuery {
        me {
          lastName
        }
      }
    `;
    const operation = createOperationDescriptor(Query, {});
    const target = RelayRecordSource.create({
      '4': {
        __errors: {lastName: [{message: 'failed'}]},
        __id: '4',
        __typename: 'User',
        lastName: null,
      },
    });
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '4'},
      },
      '4': {__id: '4', __typename: 'User', lastName: 'Last'},
    });
    mark(source, operation.root, new Set(), null, false, {target});
    expect(target.get('4')).toEqual({
      __id: '4',
      __typename: 'User',
      lastName: 'Last',
    });
  });

  describe('abstract type refinements', () => {
    const Query = graphql`
      query RelayReferenceMarkerFieldCopyTestAbstractQuery {
        node(id: "4") {
          ... on Actor {
            name
          }
        }
      }
    `;
    const operation = createOperationDescriptor(Query, {});

    function sourceWithRefinement(isActor: ?boolean): MutableRecordSource {
      return RelayRecordSource.create({
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"4")': {__ref: '4'},
        },
        // `name` is in the Store because another (server) selection read it.
        '4': {__id: '4', __typename: 'User', name: 'NAME_UNDER_REFINEMENT'},
        'client:__type:User': {
          __id: 'client:__type:User',
          __typename: '__TypeSchema',
          ...(isActor == null ? null : {__isActor: isActor}),
        },
      });
    }

    it('copies fields under a matching refinement', () => {
      expect(copy(sourceWithRefinement(true), operation)['4']).toEqual({
        __id: '4',
        __typename: 'User',
        name: 'NAME_UNDER_REFINEMENT',
      });
    });

    it('skips fields under a refinement the type does not match', () => {
      const copied = copy(sourceWithRefinement(false), operation);
      expect(copied['4']).toEqual({__id: '4', __typename: 'User'});
      expect(JSON.stringify(copied)).not.toContain('NAME_UNDER_REFINEMENT');
    });

    it('fails closed when the type information is unknown', () => {
      const copied = copy(sourceWithRefinement(null), operation);
      expect(JSON.stringify(copied)).not.toContain('NAME_UNDER_REFINEMENT');
    });

    it('still marks the fields for GC when the refinement is unknown', () => {
      const references = new Set<DataID>();
      mark(sourceWithRefinement(null), operation.root, references);
      expect(references.has('4')).toBe(true);
    });
  });

  it('copies a connection through its handle: only selected fields and the handler bookkeeping', () => {
    const Query = graphql`
      query RelayReferenceMarkerFieldCopyTestConnectionQuery {
        me {
          friends(first: 1)
            @connection(key: "RelayReferenceMarkerFieldCopyTest_friends") {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `;
    const operation = createOperationDescriptor(Query, {});
    const source = RelayRecordSource.create();
    const environment = createEnvironment(source);
    environment.commitPayload(operation, {
      me: {
        __typename: 'User',
        friends: {
          edges: [
            {
              __typename: 'FriendsEdge',
              cursor: 'cursor:1',
              node: {__typename: 'User', id: '5', name: 'Ada'},
            },
          ],
          pageInfo: {endCursor: 'cursor:1', hasNextPage: true},
        },
        id: '4',
      },
    });
    const handleKey = '__RelayReferenceMarkerFieldCopyTest_friends_connection';
    const me = source.get('4');
    const connectionID =
      me == null ? null : RelayModernRecord.getLinkedRecordID(me, handleKey);
    const connection = connectionID == null ? null : source.get(connectionID);
    if (connectionID == null || connection == null) {
      throw new Error('Expected a connection record.');
    }
    // A field on the handler's record that the client selections never read.
    const withSecret = RelayModernRecord.clone(connection);
    RelayModernRecord.setValue(
      withSecret,
      'secret',
      'SECRET_ON_HANDLED_RECORD',
    );
    source.set(connectionID, withSecret);

    const copied = copy(source, operation);
    expect(JSON.stringify(copied)).not.toContain('SECRET');
    // The server's field, which no Reader reads, links to the handler's
    // record instead of copying the server's records.
    expect(copied['4']).toEqual({
      [handleKey]: {__ref: connectionID},
      __id: '4',
      __typename: 'User',
      'friends(first:1)': {__ref: connectionID},
      id: '4',
    });
    expect(
      Object.keys(copied).filter(id => id.includes('friends(first:1)')),
    ).toEqual([]);
    // The copy is complete for the original selections.
    expect(
      new RelayModernStore(RelayRecordSource.create(copied)).check(operation)
        .status,
    ).toBe('available');
    expect(copied[connectionID]).toEqual({
      __connection_next_edge_index: 1,
      __id: connectionID,
      __typename: 'FriendsConnection',
      edges: {__refs: [expect.any(String)]},
      pageInfo: {__ref: expect.any(String)},
    });
    expect(copied['5']).toEqual({
      __id: '5',
      __typename: 'User',
      id: '5',
      name: 'Ada',
    });
  });

  it('copies a null connection as null', () => {
    const Query = graphql`
      query RelayReferenceMarkerFieldCopyTestNullConnectionQuery {
        me {
          friends(first: 1)
            @connection(key: "RelayReferenceMarkerFieldCopyTest_friends") {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `;
    const operation = createOperationDescriptor(Query, {});
    const source = RelayRecordSource.create();
    createEnvironment(source).commitPayload(operation, {
      me: {__typename: 'User', friends: null, id: '4'},
    });

    const copied = copy(source, operation);
    expect(copied['4']).toEqual({
      __RelayReferenceMarkerFieldCopyTest_friends_connection: null,
      __id: '4',
      __typename: 'User',
      'friends(first:1)': null,
      id: '4',
    });
    expect(
      new RelayModernStore(RelayRecordSource.create(copied)).check(operation)
        .status,
    ).toBe('available');
  });

  describe('a connection handle', () => {
    const Query = graphql`
      query RelayReferenceMarkerFieldCopyTestHandleQuery {
        me {
          friends(first: 1)
            @connection(
              key: "RelayReferenceMarkerFieldCopyTestHandle_friends"
            ) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `;
    const operation = createOperationDescriptor(Query, {});
    const handleKey =
      '__RelayReferenceMarkerFieldCopyTestHandle_friends_connection';

    function sourceWithConnection(): {
      connectionID: DataID,
      source: MutableRecordSource,
    } {
      const source = RelayRecordSource.create();
      createEnvironment(source).commitPayload(operation, {
        me: {
          __typename: 'User',
          friends: {
            edges: [
              {
                __typename: 'FriendsEdge',
                cursor: 'cursor:1',
                node: {__typename: 'User', id: '5', name: 'Ada'},
              },
            ],
            pageInfo: {endCursor: 'cursor:1', hasNextPage: true},
          },
          id: '4',
        },
      });
      const me = source.get('4');
      const connectionID =
        me == null ? null : RelayModernRecord.getLinkedRecordID(me, handleKey);
      if (connectionID == null) {
        throw new Error('Expected a connection record.');
      }
      return {connectionID, source};
    }

    // E.g. a payload with other arguments cleared the shared handle, while
    // the server's records for `first: 1` are still in the Store.
    function withHandle(
      source: MutableRecordSource,
      value: null | void,
    ): MutableRecordSource {
      const me = source.get('4');
      if (me == null) {
        throw new Error('Expected a record.');
      }
      const next = RelayModernRecord.clone(me);
      RelayModernRecord.setValue(next, handleKey, value);
      source.set('4', next);
      return source;
    }

    it('copies a null handle as null, not the server records under the field', () => {
      const {source} = sourceWithConnection();
      const copied = copy(withHandle(source, null), operation);
      expect(copied['4']).toEqual({
        [handleKey]: null,
        __id: '4',
        __typename: 'User',
        'friends(first:1)': null,
        id: '4',
      });
      expect(copied['5']).toBe(undefined);
      expect(
        Object.keys(copied).filter(id => id.includes('friends(first:1)')),
      ).toEqual([]);
    });

    it('leaves the field missing when its handle is missing', () => {
      const {source} = sourceWithConnection();
      const copied = copy(withHandle(source, undefined), operation);
      expect(copied['4']).toEqual({__id: '4', __typename: 'User', id: '4'});
      expect(copied['5']).toBe(undefined);
      expect(
        new RelayModernStore(RelayRecordSource.create(copied)).check(operation)
          .status,
      ).toBe('missing');
    });

    it("applies `shouldTraverse` to the handler's record before copying its bookkeeping", () => {
      const {connectionID, source} = sourceWithConnection();
      const references = new Set<DataID>();
      const target = RelayRecordSource.create();
      mark(source, operation.root, references, null, false, {
        shouldTraverse: (node, dataID) => dataID !== connectionID,
        target,
      });
      expect(target.get(connectionID)).toBe(undefined);
      expect(references.has(connectionID)).toBe(false);
      expect(references.has('4')).toBe(true);
    });
  });

  it('rejects copying with exec-time resolvers, and marks with them as before', () => {
    const Query = graphql`
      query RelayReferenceMarkerFieldCopyTestExecTimeQuery {
        me {
          name
        }
      }
    `;
    const operation = createOperationDescriptor(Query, {});
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '4'},
      },
      '4': {__id: '4', __typename: 'User', name: 'Zuck'},
    });
    expect(() =>
      mark(source, operation.root, new Set(), null, true, {
        target: RelayRecordSource.create(),
      }),
    ).toThrow('does not support exec-time resolvers');
    const references = new Set<DataID>();
    mark(source, operation.root, references, null, true);
    expect(Array.from(references).sort()).toEqual(['4', ROOT_ID]);
  });

  it('lets the caller skip a record', () => {
    const Query = graphql`
      query RelayReferenceMarkerFieldCopyTestSpreadQuery {
        me {
          name
          ...RelayReferenceMarkerFieldCopyTestSpread_user
            @dangerously_unaliased_fixme
        }
      }
    `;
    graphql`
      fragment RelayReferenceMarkerFieldCopyTestSpread_user on User @no_inline {
        lastName
      }
    `;
    const operation = createOperationDescriptor(Query, {});
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '4'},
      },
      '4': {__id: '4', __typename: 'User', lastName: 'Last', name: 'Zuck'},
    });
    const visited = [];
    const copied = copy(source, operation, {
      shouldTraverse: (node, dataID) => {
        visited.push(dataID);
        return dataID !== '4';
      },
    });
    expect(visited).toEqual([ROOT_ID, '4']);
    expect(copied['4']).toBe(undefined);
  });
});
