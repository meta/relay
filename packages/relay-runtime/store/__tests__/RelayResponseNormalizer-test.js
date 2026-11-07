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

import type {PayloadData, PayloadError} from '../../network/RelayNetworkTypes';
import type {RecordSourceJSON} from '../RelayStoreTypes';

const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const defaultGetDataID = require('../defaultGetDataID');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayModernRecord = require('../RelayModernRecord');
const {createNormalizationSelector} = require('../RelayModernSelector');
const RelayRecordSource = require('../RelayRecordSource');
const {normalize} = require('../RelayResponseNormalizer');
const {ROOT_ID, ROOT_TYPE} = require('../RelayStoreUtils');
const {
  disallowWarnings,
  expectToWarn,
  expectWarningWillFire,
} = require('relay-test-utils-internal');

disallowWarnings();

describe('RelayResponseNormalizer', () => {
  const defaultOptions = {
    getDataID: defaultGetDataID,
    treatMissingFieldsAsNull: false,
    deferDeduplicatedFields: false,
    log: null,
  };

  it('normalizes queries', () => {
    const FooQuery = graphql`
      query RelayResponseNormalizerTest1Query($id: ID, $size: [Int]) {
        node(id: $id) {
          id
          __typename
          ... on User {
            firstName
            friends(first: 3) {
              edges {
                cursor
                node {
                  id
                  firstName
                }
              }
            }
            profilePicture(size: $size) {
              uri
            }
          }
        }
      }
    `;
    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        firstName: 'Alice',
        friends: {
          edges: [
            {
              cursor: 'cursor:2',
              node: {
                id: '2',
                firstName: 'Bob',
              },
            },
            null,
            {
              cursor: 'cursor:3',
              node: {
                id: '3',
                firstName: 'Claire',
              },
            },
          ],
        },
        profilePicture: {
          uri: 'https://...',
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    normalize(
      recordSource,
      createNormalizationSelector(FooQuery.operation, ROOT_ID, {
        id: '1',
        size: 32,
      }),
      payload,
      defaultOptions,
    );
    const friendsID = 'client:1:friends(first:3)';
    const edgeID1 = `${friendsID}:edges:0`;
    const edgeID2 = `${friendsID}:edges:2`;
    const pictureID = 'client:1:profilePicture(size:32)';
    expect(recordSource.toJSON()).toEqual({
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        firstName: 'Alice',
        'friends(first:3)': {__ref: friendsID},
        'profilePicture(size:32)': {__ref: pictureID},
      },
      '2': {
        __id: '2',
        __typename: 'User',
        id: '2',
        firstName: 'Bob',
      },
      '3': {
        __id: '3',
        __typename: 'User',
        id: '3',
        firstName: 'Claire',
      },
      [friendsID]: {
        __id: friendsID,
        __typename: 'FriendsConnection',
        edges: {
          __refs: [edgeID1, null, edgeID2],
        },
      },
      // $FlowFixMe[invalid-computed-prop]
      [edgeID1]: {
        __id: edgeID1,
        __typename: 'FriendsEdge',
        cursor: 'cursor:2',
        node: {__ref: '2'},
      },
      // $FlowFixMe[invalid-computed-prop]
      [edgeID2]: {
        __id: edgeID2,
        __typename: 'FriendsEdge',
        cursor: 'cursor:3',
        node: {__ref: '3'},
      },
      [pictureID]: {
        __id: pictureID,
        __typename: 'Image',
        uri: 'https://...',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"1")': {__ref: '1'},
      },
    });
  });

  it('normalizes queries with "handle" fields', () => {
    const UserFriends = graphql`
      query RelayResponseNormalizerTest2Query($id: ID!) {
        node(id: $id) {
          id
          __typename
          ... on User {
            friends(first: 1) @__clientField(handle: "bestFriends") {
              edges {
                cursor
                node {
                  id
                  name @__clientField(handle: "friendsName")
                }
              }
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '4',
        __typename: 'User',
        friends: {
          edges: [
            {
              cursor: 'cursor:bestFriends',
              node: {
                id: 'pet',
                name: 'Beast',
              },
            },
          ],
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    const {fieldPayloads} = normalize(
      recordSource,
      createNormalizationSelector(UserFriends.operation, ROOT_ID, {
        id: '1',
      }),
      payload,
      defaultOptions,
    );
    if (!Array.isArray(fieldPayloads)) {
      throw new Error('Expect `fieldPayloads` to be an Array.');
    }
    expect(recordSource.toJSON()).toMatchSnapshot();
    expect(fieldPayloads.length).toBe(2);
    expect(fieldPayloads[0]).toEqual({
      args: {},
      dataID: 'pet',
      fieldKey: 'name',
      handle: 'friendsName',
      handleArgs: {},
      handleKey: '__name_friendsName',
    });
    expect(fieldPayloads[1]).toEqual({
      args: {first: 1},
      dataID: '4',
      fieldKey: 'friends(first:1)',
      handle: 'bestFriends',
      handleArgs: {},
      handleKey: '__friends_bestFriends',
    });
  });

  it('normalizes queries with "filters"', () => {
    const UserFriends = graphql`
      query RelayResponseNormalizerTest3Query(
        $id: ID!
        $orderBy: [String]
        $isViewerFriend: Boolean
      ) {
        node(id: $id) {
          id
          __typename
          ... on User {
            friends(
              first: 1
              orderby: $orderBy
              isViewerFriend: $isViewerFriend
            )
              @__clientField(
                handle: "bestFriends"
                key: "UserFriends_friends"
                filters: ["orderby", "isViewerFriend"]
              ) {
              edges {
                cursor
                node {
                  id
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }
    `;
    const payload1 = {
      node: {
        id: '4',
        __typename: 'User',
        friends: {
          edges: [
            {
              cursor: 'cursor:bestFriends',
              node: {
                id: 'pet',
                name: 'Beast',
              },
            },
          ],
          pageInfo: {
            hasNextPage: false,
            endCursor: 'cursor-1',
          },
        },
      },
    };

    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    let {fieldPayloads} = normalize(
      recordSource,
      createNormalizationSelector(UserFriends.operation, ROOT_ID, {
        id: '1',
        orderBy: ['last name'],
        isViewerFriend: true,
      }),
      payload1,
      defaultOptions,
    );
    if (!Array.isArray(fieldPayloads)) {
      throw new Error('Expect `fieldPayloads` to be an Array.');
    }
    expect(recordSource.toJSON()).toMatchSnapshot();
    expect(fieldPayloads.length).toBe(1);
    expect(fieldPayloads[0]).toEqual({
      args: {first: 1, orderby: ['last name'], isViewerFriend: true},
      dataID: '4',
      fieldKey: 'friends(first:1,isViewerFriend:true,orderby:["last name"])',
      handle: 'bestFriends',
      handleArgs: {},
      handleKey:
        '__UserFriends_friends_bestFriends(isViewerFriend:true,orderby:["last name"])',
    });

    const payload2 = {
      node: {
        id: '4',
        __typename: 'User',
        friends: {
          edges: [
            {
              cursor: 'cursor:bestFriends:2',
              node: {
                id: 'cat',
                name: 'Betty',
              },
            },
          ],
          pageInfo: {
            hasNextPage: false,
            endCursor: 'cursor-2',
          },
        },
      },
    };
    fieldPayloads = normalize(
      recordSource,
      createNormalizationSelector(UserFriends.operation, ROOT_ID, {
        id: '1',
        orderBy: ['first name'],
        isViewerFriend: true,
      }),
      payload2,
      defaultOptions,
    ).fieldPayloads;
    if (!Array.isArray(fieldPayloads)) {
      throw new Error('Expect `fieldPayloads` to be an Array.');
    }
    expect(recordSource.toJSON()).toMatchSnapshot();
    expect(fieldPayloads.length).toBe(1);
    expect(fieldPayloads[0]).toEqual({
      args: {first: 1, orderby: ['first name'], isViewerFriend: true},
      dataID: '4',
      fieldKey: 'friends(first:1,isViewerFriend:true,orderby:["first name"])',
      handle: 'bestFriends',
      handleArgs: {},
      handleKey:
        '__UserFriends_friends_bestFriends(isViewerFriend:true,orderby:["first name"])',
    });
  });

  describe('@match', () => {
    let BarQuery;

    beforeEach(() => {
      graphql`
        fragment RelayResponseNormalizerTestPlainUserNameRenderer_name on PlainUserNameRenderer {
          plaintext
          data {
            text
          }
        }
      `;
      graphql`
        fragment RelayResponseNormalizerTestMarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
          markdown
          data {
            markup
          }
        }
      `;
      graphql`
        fragment RelayResponseNormalizerTestFragment on User {
          id
          nameRenderer @match {
            ...RelayResponseNormalizerTestPlainUserNameRenderer_name
              @module(name: "PlainUserNameRenderer.react")
            ...RelayResponseNormalizerTestMarkdownUserNameRenderer_name
              @module(name: "MarkdownUserNameRenderer.react")
          }
        }
      `;
      BarQuery = graphql`
        query RelayResponseNormalizerTest4Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTestFragment @dangerously_unaliased_fixme
          }
        }
      `;
    });

    it('normalizes queries correctly', () => {
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayResponseNormalizerTestFragment:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayResponseNormalizerTestFragment:
              'RelayResponseNormalizerTestMarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {followupPayloads} = normalize(
        recordSource,
        createNormalizationSelector(BarQuery.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
          'nameRenderer(supported:"34hjiS")': {
            __ref: 'client:1:nameRenderer(supported:"34hjiS")',
          },
        },
        'client:1:nameRenderer(supported:"34hjiS")': {
          __id: 'client:1:nameRenderer(supported:"34hjiS")',
          __typename: 'MarkdownUserNameRenderer',
          __module_component_RelayResponseNormalizerTestFragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayResponseNormalizerTestFragment:
            'RelayResponseNormalizerTestMarkdownUserNameRenderer_name$normalization.graphql',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
      expect(followupPayloads).toEqual([
        {
          args: null,
          operationReference:
            'RelayResponseNormalizerTestMarkdownUserNameRenderer_name$normalization.graphql',
          dataID: 'client:1:nameRenderer(supported:"34hjiS")',
          kind: 'ModuleImportPayload',
          data: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayResponseNormalizerTestFragment:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayResponseNormalizerTestFragment:
              'RelayResponseNormalizerTestMarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
          variables: {id: '1'},
          typeName: 'MarkdownUserNameRenderer',
          path: ['node', 'nameRenderer'],
        },
      ]);
    });

    it('returns metadata with prefixed path', () => {
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayResponseNormalizerTestFragment:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayResponseNormalizerTestFragment:
              'RelayResponseNormalizerTestMarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {followupPayloads} = normalize(
        recordSource,
        createNormalizationSelector(BarQuery.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        // simulate a nested @match that appeared, validate that nested payload
        // path is prefixed with this parent path:
        {...defaultOptions, path: ['abc', '0', 'xyz']},
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
          'nameRenderer(supported:"34hjiS")': {
            __ref: 'client:1:nameRenderer(supported:"34hjiS")',
          },
        },
        'client:1:nameRenderer(supported:"34hjiS")': {
          __id: 'client:1:nameRenderer(supported:"34hjiS")',
          __typename: 'MarkdownUserNameRenderer',
          __module_component_RelayResponseNormalizerTestFragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayResponseNormalizerTestFragment:
            'RelayResponseNormalizerTestMarkdownUserNameRenderer_name$normalization.graphql',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
      expect(followupPayloads).toEqual([
        {
          args: null,
          operationReference:
            'RelayResponseNormalizerTestMarkdownUserNameRenderer_name$normalization.graphql',
          dataID: 'client:1:nameRenderer(supported:"34hjiS")',
          kind: 'ModuleImportPayload',
          data: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayResponseNormalizerTestFragment:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayResponseNormalizerTestFragment:
              'RelayResponseNormalizerTestMarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
          variables: {id: '1'},
          typeName: 'MarkdownUserNameRenderer',
          // parent path followed by local path to @match
          path: ['abc', '0', 'xyz', 'node', 'nameRenderer'],
        },
      ]);
    });

    it('normalizes queries correctly when the resolved type does not match any of the specified cases', () => {
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'CustomNameRenderer',
            customField: 'this is ignored!',
          },
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      normalize(
        recordSource,
        createNormalizationSelector(BarQuery.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
          'nameRenderer(supported:"34hjiS")': {
            __ref: 'client:1:nameRenderer(supported:"34hjiS")',
          },
        },
        'client:1:nameRenderer(supported:"34hjiS")': {
          __id: 'client:1:nameRenderer(supported:"34hjiS")',
          __typename: 'CustomNameRenderer',
          // note: 'customField' data not processed, there is no selection on this type
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('normalizes queries correctly when the @match field is null', () => {
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: null,
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      normalize(
        recordSource,
        createNormalizationSelector(BarQuery.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
          'nameRenderer(supported:"34hjiS")': null,
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });
  });

  describe('@module', () => {
    let BarQuery;

    beforeEach(() => {
      graphql`
        fragment RelayResponseNormalizerTest1PlainUserNameRenderer_name on PlainUserNameRenderer {
          plaintext
          data {
            text
          }
        }
      `;
      graphql`
        fragment RelayResponseNormalizerTest1MarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
          markdown
          data {
            markup
          }
        }
      `;
      graphql`
        fragment RelayResponseNormalizerTest1Fragment on User {
          id
          nameRenderer {
            # intentionally does not use @match
            ...RelayResponseNormalizerTest1PlainUserNameRenderer_name
              @module(name: "PlainUserNameRenderer.react")
            ...RelayResponseNormalizerTest1MarkdownUserNameRenderer_name
              @module(name: "MarkdownUserNameRenderer.react")
          }
        }
      `;
      BarQuery = graphql`
        query RelayResponseNormalizerTest5Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest1Fragment @dangerously_unaliased_fixme
          }
        }
      `;
    });

    it('normalizes queries and returns metadata when the type matches an @module selection', () => {
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayResponseNormalizerTest1Fragment:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayResponseNormalizerTest1Fragment:
              'RelayResponseNormalizerTest1MarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {followupPayloads} = normalize(
        recordSource,
        createNormalizationSelector(BarQuery.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __ref: 'client:1:nameRenderer',
          },
        },
        'client:1:nameRenderer': {
          __id: 'client:1:nameRenderer',
          __typename: 'MarkdownUserNameRenderer',
          __module_component_RelayResponseNormalizerTest1Fragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayResponseNormalizerTest1Fragment:
            'RelayResponseNormalizerTest1MarkdownUserNameRenderer_name$normalization.graphql',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
      expect(followupPayloads).toEqual([
        {
          args: null,
          operationReference:
            'RelayResponseNormalizerTest1MarkdownUserNameRenderer_name$normalization.graphql',
          dataID: 'client:1:nameRenderer',
          kind: 'ModuleImportPayload',
          data: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayResponseNormalizerTest1Fragment:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayResponseNormalizerTest1Fragment:
              'RelayResponseNormalizerTest1MarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
          variables: {id: '1'},
          typeName: 'MarkdownUserNameRenderer',
          path: ['node', 'nameRenderer'],
        },
      ]);
    });

    it('returns metadata with prefixed path', () => {
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayResponseNormalizerTest1Fragment:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayResponseNormalizerTest1Fragment:
              'RelayResponseNormalizerTest1MarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {followupPayloads} = normalize(
        recordSource,
        createNormalizationSelector(BarQuery.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        // simulate a nested @match that appeared, validate that nested payload
        // path is prefixed with this parent path:
        {...defaultOptions, path: ['abc', '0', 'xyz']},
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __ref: 'client:1:nameRenderer',
          },
        },
        'client:1:nameRenderer': {
          __id: 'client:1:nameRenderer',
          __typename: 'MarkdownUserNameRenderer',
          __module_component_RelayResponseNormalizerTest1Fragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayResponseNormalizerTest1Fragment:
            'RelayResponseNormalizerTest1MarkdownUserNameRenderer_name$normalization.graphql',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
      expect(followupPayloads).toEqual([
        {
          args: null,
          operationReference:
            'RelayResponseNormalizerTest1MarkdownUserNameRenderer_name$normalization.graphql',
          dataID: 'client:1:nameRenderer',
          kind: 'ModuleImportPayload',
          data: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayResponseNormalizerTest1Fragment:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayResponseNormalizerTest1Fragment:
              'RelayResponseNormalizerTest1MarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
          variables: {id: '1'},
          typeName: 'MarkdownUserNameRenderer',
          // parent path followed by local path to @match
          path: ['abc', '0', 'xyz', 'node', 'nameRenderer'],
        },
      ]);
    });

    it('normalizes queries correctly when the resolved type does not match any @module selections', () => {
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'CustomNameRenderer',
            customField: 'this is ignored!',
          },
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      normalize(
        recordSource,
        createNormalizationSelector(BarQuery.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __ref: 'client:1:nameRenderer',
          },
        },
        'client:1:nameRenderer': {
          __id: 'client:1:nameRenderer',
          __typename: 'CustomNameRenderer',
          // note: 'customField' data not processed, there is no selection on this type
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });
  });

  describe('@defer', () => {
    it('normalizes when if condition is false', () => {
      graphql`
        fragment RelayResponseNormalizerTest2Fragment on User {
          id
          name
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest6Query(
          $id: ID!
          $enableDefer: Boolean!
        ) {
          node(id: $id) {
            ...RelayResponseNormalizerTest2Fragment
              @dangerously_unaliased_fixme
              @defer(label: "TestFragment", if: $enableDefer)
          }
        }
      `;
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          name: 'Alice',
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
          enableDefer: false,
        }),
        payload,
        defaultOptions,
      );
      expect(incrementalPlaceholders).toEqual([]);
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          name: 'Alice',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('returns metadata when `if` is true (literal value)', () => {
      graphql`
        fragment RelayResponseNormalizerTest3Fragment on User {
          id
          name
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest7Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest3Fragment
              @dangerously_unaliased_fixme
              @defer(label: "TestFragment", if: true)
          }
        }
      `;
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          name: 'Alice',
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(incrementalPlaceholders).toEqual([
        {
          kind: 'defer',
          data: payload.node,
          label: 'RelayResponseNormalizerTest7Query$defer$TestFragment',
          path: ['node'],
          selector: createNormalizationSelector(
            expect.objectContaining({kind: 'Defer'}),
            '1',
            {id: '1'},
          ),
          typeName: 'User',
        },
      ]);
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          // 'name' not normalized even though its present in the payload
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('returns metadata when `if` is true (variable value)', () => {
      graphql`
        fragment RelayResponseNormalizerTest4Fragment on User {
          id
          name
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest8Query(
          $id: ID!
          $enableDefer: Boolean!
        ) {
          node(id: $id) {
            ...RelayResponseNormalizerTest4Fragment
              @dangerously_unaliased_fixme
              @defer(label: "TestFragment", if: $enableDefer)
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          name: 'Alice',
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
          enableDefer: true,
        }),
        payload,
        defaultOptions,
      );
      expect(incrementalPlaceholders).toEqual([
        {
          kind: 'defer',
          data: payload.node,
          label: 'RelayResponseNormalizerTest8Query$defer$TestFragment',
          path: ['node'],
          selector: createNormalizationSelector(
            expect.objectContaining({kind: 'Defer'}),
            '1',
            {id: '1', enableDefer: true},
          ),
          typeName: 'User',
        },
      ]);
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          // 'name' not normalized even though its present in the payload
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('returns metadata for @defer within a plural', () => {
      graphql`
        fragment RelayResponseNormalizerTest5Fragment on User {
          name
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest9Query($id: ID!) {
          node(id: $id) {
            ... on Feedback {
              actors {
                ...RelayResponseNormalizerTest5Fragment
                  @dangerously_unaliased_fixme
                  @defer(label: "TestFragment", if: true)
              }
            }
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'Feedback',
          actors: [
            {__typename: 'User', id: '2', name: 'Alice'},
            {__typename: 'User', id: '3', name: 'Bob'},
          ],
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(incrementalPlaceholders).toEqual([
        {
          kind: 'defer',
          data: payload.node.actors[0],
          label: 'RelayResponseNormalizerTest9Query$defer$TestFragment',
          path: ['node', 'actors', '0'],
          selector: createNormalizationSelector(
            expect.objectContaining({kind: 'Defer'}),
            '2',
            {id: '1'},
          ),
          typeName: 'User',
        },
        {
          kind: 'defer',
          data: payload.node.actors[1],
          label: 'RelayResponseNormalizerTest9Query$defer$TestFragment',
          path: ['node', 'actors', '1'],
          selector: createNormalizationSelector(
            expect.objectContaining({kind: 'Defer'}),
            '3',
            {id: '1'},
          ),
          typeName: 'User',
        },
      ]);
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'Feedback',
          id: '1',
          actors: {__refs: ['2', '3']},
        },
        '2': {
          __id: '2',
          __typename: 'User',
          id: '2',
          // name deferred
        },
        '3': {
          __id: '3',
          __typename: 'User',
          id: '3',
          // name deferred
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('returns metadata with prefixed path', () => {
      graphql`
        fragment RelayResponseNormalizerTest6Fragment on User {
          id
          name
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest10Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest6Fragment
              @dangerously_unaliased_fixme
              @defer(label: "TestFragment")
          }
        }
      `;
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        // simulate a nested defer payload, verify that the incrementalPlaceholders
        // paths are prefixed with this parent path
        {...defaultOptions, path: ['abc', '0', 'xyz']},
      );
      expect(incrementalPlaceholders).toEqual([
        {
          kind: 'defer',
          data: payload.node,
          label: 'RelayResponseNormalizerTest10Query$defer$TestFragment',
          path: ['abc', '0', 'xyz', 'node'],
          selector: createNormalizationSelector(
            expect.objectContaining({kind: 'Defer'}),
            '1',
            {id: '1'},
          ),
          typeName: 'User',
        },
      ]);
    });
  });

  describe('@stream', () => {
    it('normalizes when if condition is false', () => {
      graphql`
        fragment RelayResponseNormalizerTest7Fragment on Feedback {
          id
          actors @stream(label: "actors", if: $enableStream, initial_count: 0) {
            name
          }
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest11Query(
          $id: ID!
          $enableStream: Boolean!
        ) {
          node(id: $id) {
            ...RelayResponseNormalizerTest7Fragment @dangerously_unaliased_fixme
          }
        }
      `;
      const payload = {
        node: {
          id: '1',
          __typename: 'Feedback',
          actors: [{__typename: 'User', id: '2', name: 'Alice'}],
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
          enableStream: false,
        }),
        payload,
        defaultOptions,
      );
      expect(incrementalPlaceholders).toEqual([]);
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'Feedback',
          id: '1',
          actors: {__refs: ['2']},
        },
        '2': {
          __id: '2',
          __typename: 'User',
          id: '2',
          name: 'Alice',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('normalizes and returns metadata when `if` is true (literal value)', () => {
      graphql`
        fragment RelayResponseNormalizerTest8Fragment on Feedback {
          id
          actors @stream(label: "actors", if: true, initial_count: 0) {
            name
          }
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTestQuery($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest8Fragment @dangerously_unaliased_fixme
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'Feedback',
          actors: [{__typename: 'User', id: '2', name: 'Alice'}],
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(incrementalPlaceholders).toEqual([
        {
          kind: 'stream',
          label: 'RelayResponseNormalizerTest8Fragment$stream$actors',
          path: ['node'],
          parentID: '1',
          node: expect.objectContaining({kind: 'Stream'}),
          variables: {id: '1'},
        },
      ]);
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'Feedback',
          id: '1',
          actors: {__refs: ['2']},
        },
        '2': {
          __id: '2',
          __typename: 'User',
          id: '2',
          name: 'Alice',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('normalizes and returns metadata when `if` is true (variable value)', () => {
      graphql`
        fragment RelayResponseNormalizerTest9Fragment on Feedback {
          id
          actors @stream(label: "actors", if: $enableStream, initial_count: 0) {
            name
          }
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest12Query(
          $id: ID!
          $enableStream: Boolean!
        ) {
          node(id: $id) {
            ...RelayResponseNormalizerTest9Fragment @dangerously_unaliased_fixme
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'Feedback',
          actors: [{__typename: 'User', id: '2', name: 'Alice'}],
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
          enableStream: true,
        }),
        payload,
        defaultOptions,
      );
      expect(incrementalPlaceholders).toEqual([
        {
          kind: 'stream',
          label: 'RelayResponseNormalizerTest9Fragment$stream$actors',
          path: ['node'],
          parentID: '1',
          node: expect.objectContaining({kind: 'Stream'}),
          variables: {id: '1', enableStream: true},
        },
      ]);
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'Feedback',
          id: '1',
          actors: {__refs: ['2']},
        },
        '2': {
          __id: '2',
          __typename: 'User',
          id: '2',
          name: 'Alice',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('normalizes and returns metadata for @stream within a plural', () => {
      graphql`
        fragment RelayResponseNormalizerTest10Fragment on Feedback {
          id
          actors {
            ... on User {
              name
              actors @stream(label: "actors", if: true, initial_count: 0) {
                name
              }
            }
          }
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest13Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest10Fragment
              @dangerously_unaliased_fixme
          }
        }
      `;
      const payload: $FlowFixMe = {
        node: {
          id: '1',
          __typename: 'Feedback',
          actors: [
            {__typename: 'User', id: '2', name: 'Alice', actors: []},
            {__typename: 'User', id: '3', name: 'Bob', actors: []},
          ],
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        defaultOptions,
      );
      expect(incrementalPlaceholders).toEqual([
        {
          kind: 'stream',
          label: 'RelayResponseNormalizerTest10Fragment$stream$actors',
          path: ['node', 'actors', '0'],
          parentID: '2',
          variables: {id: '1'},
          node: expect.objectContaining({kind: 'Stream'}),
        },
        {
          kind: 'stream',
          label: 'RelayResponseNormalizerTest10Fragment$stream$actors',
          path: ['node', 'actors', '1'],
          parentID: '3',
          variables: {id: '1'},
          node: expect.objectContaining({kind: 'Stream'}),
        },
      ]);
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'Feedback',
          id: '1',
          actors: {__refs: ['2', '3']},
        },
        '2': {
          __id: '2',
          __typename: 'User',
          id: '2',
          name: 'Alice',
          actors: {__refs: []},
        },
        '3': {
          __id: '3',
          __typename: 'User',
          id: '3',
          name: 'Bob',
          actors: {__refs: []},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('returns metadata with prefixed path', () => {
      graphql`
        fragment RelayResponseNormalizerTest11Fragment on Feedback {
          id
          actors @stream(label: "actors", initial_count: 0) {
            name
          }
        }
      `;
      const Query = graphql`
        query RelayResponseNormalizerTest14Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest11Fragment
              @dangerously_unaliased_fixme
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'Feedback',
          actors: [{__typename: 'User', id: '2', name: 'Alice'}],
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const {incrementalPlaceholders} = normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        // simulate a nested @match that appeared, validate that nested payload
        // path is prefixed with this parent path:
        {...defaultOptions, path: ['abc', '0', 'xyz']},
      );
      expect(incrementalPlaceholders).toEqual([
        {
          kind: 'stream',
          label: 'RelayResponseNormalizerTest11Fragment$stream$actors',
          path: ['abc', '0', 'xyz', 'node'],
          parentID: '1',
          variables: {id: '1'},
          node: expect.objectContaining({kind: 'Stream'}),
        },
      ]);
    });
  });

  describe('Client Extensions', () => {
    const StrippedQuery = graphql`
      query RelayResponseNormalizerTestStrippedQuery($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            firstName
            nickname
            foo {
              bar {
                content
              }
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        firstName: 'Bob',
      },
    };

    it('skips client fields not present in the payload but present in the store', () => {
      const recordSource = new RelayRecordSource({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Alice',
          nickname: 'ecilA',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });

      expectToWarn(
        'RelayResponseNormalizer: Invalid record. The record contains two instances of the same id: `1` with conflicting field, firstName and its values: Alice and Bob. If two fields are different but share the same id, one field will overwrite the other.',
        () => {
          normalize(
            recordSource,
            createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
              id: '1',
              size: 32,
            }),
            payload,
            defaultOptions,
          );
        },
      );
      const result = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Bob',
          nickname: 'ecilA',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      expect(recordSource.toJSON()).toEqual(result);
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual(result);
    });

    it('skips client fields not present in the payload or store', () => {
      const recordSource = new RelayRecordSource({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Alice',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
      expectWarningWillFire(
        'RelayResponseNormalizer: Invalid record. The record contains two instances of the same id: `1` with conflicting field, firstName and its values: Alice and Bob. If two fields are different but share the same id, one field will overwrite the other.',
      );
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
      );
      const result = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Bob',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      expect(recordSource.toJSON()).toEqual(result);
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual(result);
    });

    it('ignores linked client fields not present in the payload', () => {
      const recordSource = new RelayRecordSource({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Alice',
          foo: {
            __ref: '2',
          },
        },
        '2': {
          __id: '2',
          __typename: 'Foo',
          bar: {
            __ref: '3',
          },
        },
        '3': {
          __id: '3',
          __typename: 'Bar',
          content: 'bar',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
      expectWarningWillFire(
        'RelayResponseNormalizer: Invalid record. The record contains two instances of the same id: `1` with conflicting field, firstName and its values: Alice and Bob. If two fields are different but share the same id, one field will overwrite the other.',
      );
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
      );
      const result = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Bob',
          foo: {
            __ref: '2',
          },
        },
        '2': {
          __id: '2',
          __typename: 'Foo',
          bar: {
            __ref: '3',
          },
        },
        '3': {
          __id: '3',
          __typename: 'Bar',
          content: 'bar',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      expect(recordSource.toJSON()).toEqual(result);
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual(result);
    });

    it('ignores linked client fields not present in the payload or store', () => {
      const recordSource = new RelayRecordSource({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Alice',
          foo: {
            __ref: '2',
          },
        },
        '2': {
          __id: '2',
          __typename: 'Foo',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
      expectWarningWillFire(
        'RelayResponseNormalizer: Invalid record. The record contains two instances of the same id: `1` with conflicting field, firstName and its values: Alice and Bob. If two fields are different but share the same id, one field will overwrite the other.',
      );
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
      );
      const result = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Bob',
          foo: {
            __ref: '2',
          },
        },
        '2': {
          __id: '2',
          __typename: 'Foo',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      expect(recordSource.toJSON()).toEqual(result);
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual(result);
    });
  });

  describe('User-defined getDataID', () => {
    let recordSource;

    const getDataID = jest.fn(
      (
        fieldValue: string | {readonly [key: string]: unknown},
        typename: string | {readonly [key: string]: unknown},
      ) => {
        return `${
          typeof fieldValue === 'string' ? fieldValue : String(fieldValue.id)
        }:${String(typename)}`;
      },
    );

    const getNullAsDataID = jest.fn(
      (
        fieldValue: string | {readonly [key: string]: unknown},
        typename: string | {readonly [key: string]: unknown},
      ) => {
        return null;
      },
    );

    beforeEach(() => {
      recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('single field', () => {
      const BarQuery = graphql`
        query RelayResponseNormalizerTest15Query($id: ID) {
          node(id: $id) {
            id
            __typename
            ... on User {
              actor {
                id
                __typename
              }
              author {
                id
                __typename
              }
            }
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          actor: {
            id: '1',
            __typename: 'Page',
          },
          author: {
            id: '1',
            __typename: 'User',
          },
        },
      };

      it('overwrite fields in same position but with different data', () => {
        const Foo = graphql`
          query RelayResponseNormalizerTest16Query {
            me {
              author {
                id
                name
              }
            }
            meAgain: me {
              author {
                id
                name
              }
            }
          }
        `;
        const fooPayload = {
          me: {
            __typename: 'User',
            id: 'me',
            author: {
              id: 'friend1',
              name: 'First Friend',
            },
          },
          meAgain: {
            __typename: 'User',
            id: 'me',
            author: {
              id: 'friend2',
              name: 'Second Friend',
            },
          },
        };
        expectWarningWillFire(
          'RelayResponseNormalizer: Invalid record. The record contains references to the conflicting field, author and its id values: friend1:User and friend2:User. We need to make sure that the record the field points to remains consistent or one field will overwrite the other.',
        );
        normalize(
          recordSource,
          createNormalizationSelector(Foo.operation, ROOT_ID, {
            id: '1',
          }),
          fooPayload,
          {
            getDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual({
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            me: {
              __ref: 'me:User',
            },
          },
          'friend1:User': {
            __id: 'friend1:User',
            __typename: 'User',
            id: 'friend1',
            name: 'First Friend',
          },
          'friend2:User': {
            __id: 'friend2:User',
            __typename: 'User',
            id: 'friend2',
            name: 'Second Friend',
          },
          'me:User': {
            __id: 'me:User',
            __typename: 'User',
            author: {
              __ref: 'friend2:User', // Should be the second one
            },
            id: 'me',
          },
        });
      });

      it('overwrite fields in same position but with different data in second normalization', () => {
        const Foo = graphql`
          query RelayResponseNormalizerTest17Query {
            me {
              author {
                id
                name
              }
            }
          }
        `;
        const fooPayload0 = {
          me: {
            __typename: 'User',
            id: 'me',
            author: {
              id: 'friend0',
              name: 'First Friend',
            },
          },
        };
        const fooPayload1 = {
          me: {
            __typename: 'User',
            id: 'me',
            author: {
              id: 'friend1',
              name: 'Second Friend',
            },
          },
        };
        expectWarningWillFire(
          'RelayResponseNormalizer: Invalid record. The record contains references to the conflicting field, author and its id values: friend0:User and friend1:User. We need to make sure that the record the field points to remains consistent or one field will overwrite the other.',
        );
        normalize(
          recordSource,
          createNormalizationSelector(Foo.operation, ROOT_ID, {
            id: '1',
          }),
          fooPayload0,
          {
            getDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        normalize(
          recordSource,
          createNormalizationSelector(Foo.operation, ROOT_ID, {
            id: '1',
          }),
          fooPayload1,
          {
            getDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual({
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            me: {
              __ref: 'me:User',
            },
          },
          'friend0:User': {
            __id: 'friend0:User',
            __typename: 'User',
            id: 'friend0',
            name: 'First Friend',
          },
          'friend1:User': {
            __id: 'friend1:User',
            __typename: 'User',
            id: 'friend1',
            name: 'Second Friend',
          },
          'me:User': {
            __id: 'me:User',
            __typename: 'User',
            author: {
              __ref: 'friend1:User', // Should be the second one
            },
            id: 'me',
          },
        });
      });

      it('stores user-defined id when function returns an string', () => {
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          {
            getDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual({
          '1:Page': {
            __id: '1:Page',
            __typename: 'Page',
            id: '1',
          },
          '1:User': {
            __id: '1:User',
            __typename: 'User',
            actor: {
              __ref: '1:Page',
            },
            author: {
              __ref: '1:User',
            },
            id: '1',
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {
              __ref: '1:User',
            },
          },
        });
        expect(getDataID).toBeCalledTimes(3);
      });

      it('falls through to previously generated ID if function returns null ', () => {
        const previousData: RecordSourceJSON = {
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {
              __ref: 'test:root:node(id:"1")',
            },
          },
          'test:root:node(id:"1")': {
            __id: 'test:root:node(id:"1")',
            __typename: 'User',
            actor: {
              __ref: 'test:root:node(id:"1"):actor',
            },
            author: {
              __ref: 'test:root:node(id:"1"):author',
            },
            id: '1',
          },
          'test:root:node(id:"1"):actor': {
            __id: 'test:root:node(id:"1"):actor',
            __typename: 'Page',
            id: '1',
          },
          'test:root:node(id:"1"):author': {
            __id: 'test:root:node(id:"1"):author',
            __typename: 'User',
            id: '1',
          },
        };
        const expectedData = JSON.parse(JSON.stringify(previousData));
        recordSource = new RelayRecordSource(previousData);
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          {
            getDataID: getNullAsDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual(expectedData);
        expect(getNullAsDataID).toBeCalledTimes(3);
      });

      it('falls through to generateClientID when the function returns null, and no previously generated ID', () => {
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          {
            getDataID: getNullAsDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual({
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {
              __ref: 'client:root:node(id:"1")',
            },
          },
          'client:root:node(id:"1")': {
            __id: 'client:root:node(id:"1")',
            __typename: 'User',
            actor: {
              __ref: 'client:root:node(id:"1"):actor',
            },
            author: {
              __ref: 'client:root:node(id:"1"):author',
            },
            id: '1',
          },
          'client:root:node(id:"1"):actor': {
            __id: 'client:root:node(id:"1"):actor',
            __typename: 'Page',
            id: '1',
          },
          'client:root:node(id:"1"):author': {
            __id: 'client:root:node(id:"1"):author',
            __typename: 'User',
            id: '1',
          },
        });
        expect(getNullAsDataID).toBeCalledTimes(3);
      });
    });

    describe('plural fields', () => {
      const BarQuery = graphql`
        query RelayResponseNormalizerTest18Query($id: ID) {
          node(id: $id) {
            id
            __typename
            ... on User {
              actors {
                id
                __typename
              }
            }
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          actors: [
            {
              id: '1',
              __typename: 'Page',
            },
            {
              id: '2',
              __typename: 'Page',
            },
          ],
        },
      };

      it('stores user-defined ids when function returns an string', () => {
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          {
            getDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual({
          '1:Page': {
            __id: '1:Page',
            __typename: 'Page',
            id: '1',
          },
          '2:Page': {
            __id: '2:Page',
            __typename: 'Page',
            id: '2',
          },
          '1:User': {
            __id: '1:User',
            __typename: 'User',
            actors: {
              __refs: ['1:Page', '2:Page'],
            },
            id: '1',
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {
              __ref: '1:User',
            },
          },
        });
        expect(getDataID).toBeCalledTimes(3);
      });

      it('uses cached IDs if they were generated before and the function returns null', () => {
        const previousData: RecordSourceJSON = {
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {
              __ref: 'test:root:node(id:"1")',
            },
          },
          'test:root:node(id:"1")': {
            __id: 'test:root:node(id:"1")',
            __typename: 'User',
            actors: {
              __refs: [
                'test:root:node(id:"1"):actor:0',
                'test:root:node(id:"1"):actor:1',
              ],
            },
            id: '1',
          },
          'test:root:node(id:"1"):actor:0': {
            __id: 'test:root:node(id:"1"):actor:0',
            __typename: 'Page',
            id: '1',
          },
          'test:root:node(id:"1"):actor:1': {
            __id: 'test:root:node(id:"1"):actor:1',
            __typename: 'Page',
            id: '2',
          },
        };
        recordSource = new RelayRecordSource(previousData);
        const expectedData = JSON.parse(JSON.stringify(previousData));
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          {
            getDataID: getNullAsDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual(expectedData);
        expect(getNullAsDataID).toBeCalledTimes(3);
      });

      it('falls through to generateClientID when the function returns null and there is one new field in stored plural links', () => {
        const data: RecordSourceJSON = {
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {
              __ref: 'test:root:node(id:"1")',
            },
          },
          'test:root:node(id:"1")': {
            __id: 'test:root:node(id:"1")',
            __typename: 'User',
            actors: {
              __refs: ['test:root:node(id:"1"):actor:0'],
            },
            id: '1',
          },
          'test:root:node(id:"1"):actor:0': {
            __id: 'test:root:node(id:"1"):actor:0',
            __typename: 'Page',
            id: '1',
          },
        };
        recordSource = new RelayRecordSource(data);
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          {
            getDataID: getNullAsDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        const result = recordSource.toJSON();
        expect(result['test:root:node(id:"1")']).toEqual({
          __id: 'test:root:node(id:"1")',
          __typename: 'User',
          actors: {
            __refs: [
              'test:root:node(id:"1"):actor:0',
              'client:test:root:node(id:"1"):actors:1',
            ],
          },
          id: '1',
        });
        expect(result['client:test:root:node(id:"1"):actors:1']).toEqual({
          __id: 'client:test:root:node(id:"1"):actors:1',
          __typename: 'Page',
          id: '2',
        });
        expect(getNullAsDataID).toBeCalledTimes(3);
      });

      it('falls through to generateClientID when the function returns null and no previously generated IDs', () => {
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          {
            getDataID: getNullAsDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual({
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {
              __ref: 'client:root:node(id:"1")',
            },
          },
          'client:root:node(id:"1")': {
            __id: 'client:root:node(id:"1")',
            __typename: 'User',
            actors: {
              __refs: [
                'client:root:node(id:"1"):actors:0',
                'client:root:node(id:"1"):actors:1',
              ],
            },
            id: '1',
          },
          'client:root:node(id:"1"):actors:0': {
            __id: 'client:root:node(id:"1"):actors:0',
            __typename: 'Page',
            id: '1',
          },
          'client:root:node(id:"1"):actors:1': {
            __id: 'client:root:node(id:"1"):actors:1',
            __typename: 'Page',
            id: '2',
          },
        });
        expect(getNullAsDataID).toBeCalledTimes(3);
      });

      it('overwrite fields in same position but with different data in second normalization', () => {
        const Foo = graphql`
          query RelayResponseNormalizerTest19Query($id: ID) {
            node(id: $id) {
              id
              __typename
              ... on User {
                actors {
                  id
                  name
                  __typename
                }
              }
            }
          }
        `;

        const payload0 = {
          node: {
            id: '1',
            __typename: 'User',
            actors: [
              {
                id: '1',
                __typename: 'Page',
                name: 'Page0',
              },
            ],
          },
        };
        const payload1 = {
          node: {
            id: '1',
            __typename: 'User',
            actors: [
              {
                id: '2',
                __typename: 'Page',
                name: 'Page1',
              },
            ],
          },
        };
        expectWarningWillFire(
          'RelayResponseNormalizer: Invalid record. The record contains references to the conflicting field, actors and its id values: 1:Page and 2:Page. We need to make sure that the record the field points to remains consistent or one field will overwrite the other.',
        );
        normalize(
          recordSource,
          createNormalizationSelector(Foo.operation, ROOT_ID, {
            id: '1',
          }),
          payload0,
          {
            getDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        normalize(
          recordSource,
          createNormalizationSelector(Foo.operation, ROOT_ID, {
            id: '1',
          }),
          payload1,
          {
            getDataID,
            treatMissingFieldsAsNull: false,
            deferDeduplicatedFields: false,
            log: null,
          },
        );
        expect(recordSource.toJSON()).toEqual({
          '1:Page': {
            __id: '1:Page',
            __typename: 'Page',
            id: '1',
            name: 'Page0',
          },
          '2:Page': {
            __id: '2:Page',
            __typename: 'Page',
            id: '2',
            name: 'Page1',
          },
          '1:User': {
            __id: '1:User',
            __typename: 'User',
            actors: {
              __refs: ['2:Page'], // Should be the second one
            },
            id: '1',
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {
              __ref: '1:User',
            },
          },
        });
      });
    });
  });

  it('normalize queries with provided variables', () => {
    graphql`
      fragment RelayResponseNormalizerTest_pvFragment on User
      @argumentDefinitions(
        includeName: {
          type: "Boolean!"
          provider: "./RelayProvider_returnsTrue.relayprovider"
        }
        includeFirstName: {
          type: "Boolean!"
          provider: "./RelayProvider_returnsFalse.relayprovider"
        }
        skipLastName: {
          type: "Boolean!"
          provider: "./RelayProvider_returnsFalse.relayprovider"
        }
        skipUsername: {
          type: "Boolean!"
          provider: "./RelayProvider_returnsTrue.relayprovider"
        }
      ) {
        name @include(if: $includeName)
        firstName @include(if: $includeFirstName)
        lastName @skip(if: $skipLastName)
        username @skip(if: $skipUsername)
      }
    `;

    const queryPV = graphql`
      query RelayResponseNormalizerTest_pvQuery($id: ID!) {
        node(id: $id) {
          id
          ...RelayResponseNormalizerTest_pvFragment @dangerously_unaliased_fixme
        }
      }
    `;

    const payload = {
      node: {
        __typename: 'User',
        id: '4',
        name: 'testName',
        firstName: 'testLastName',
        lastName: 'testLastName',
        username: 'testUsername',
      },
    };

    const operationDescriptor = createOperationDescriptor(queryPV, {
      id: '4',
    });
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    normalize(
      recordSource,
      createNormalizationSelector(
        operationDescriptor.root.node,
        ROOT_ID,
        operationDescriptor.root.variables,
      ),
      payload,
      defaultOptions,
    );

    expect(recordSource.toJSON()).toEqual({
      '4': {
        __id: '4',
        id: '4',
        __typename: 'User',
        name: 'testName',
        lastName: 'testLastName',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"4")': {__ref: '4'},
      },
    });
  });

  it('warns in __DEV__ if payload data is missing an expected field', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest20Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            firstName
            profilePicture(size: 100) {
              uri
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        profilePicture: {
          uri: 'https://...',
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    expectToWarn(
      'RelayResponseNormalizer: Payload did not contain a value for ' +
        'field `firstName: firstName`. Check that you are parsing with the same query that ' +
        'was used to fetch the payload.',
      () => {
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          defaultOptions,
        );
      },
    );
  });

  it('does not warn in __DEV__ if payload data is missing for an abstract field', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest21Query {
        named {
          name
          ... on Node {
            id
          }
        }
      }
    `;

    const payload = {
      named: {
        __typename: 'SimpleNamed',
        name: 'Alice',
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    normalize(
      recordSource,
      createNormalizationSelector(BarQuery.operation, ROOT_ID, {}),
      payload,
      defaultOptions,
    );
  });

  it('warns in __DEV__ if a single response contains conflicting fields with the same id', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest22Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            name
            friends(first: 2) {
              edges {
                node {
                  id
                  firstName
                }
              }
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        name: 'Alice',
        friends: {
          edges: [
            {
              node: {
                id: 'a',
                firstName: 'Bob',
              },
            },
            {
              node: {
                id: 'a',
                firstName: 'Claire',
              },
            },
          ],
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    expectToWarn(
      'RelayResponseNormalizer: Invalid record. The record contains two ' +
        'instances of the same id: `a` with conflicting field, firstName and its values: Bob and Claire. ' +
        'If two fields are different but share ' +
        'the same id, one field will overwrite the other.',
      () => {
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          defaultOptions,
        );
      },
    );
  });

  it('does not warn if a single response contains the same fields with the same id', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest32Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            name
            friends(first: 2) {
              edges {
                node {
                  id
                  firstName
                }
              }
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        name: 'Alice',
        friends: {
          edges: [
            {
              node: {
                id: 'a',
                firstName: 'Bob',
              },
            },
            {
              node: {
                id: 'a',
                firstName: 'Bob',
              },
            },
          ],
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    normalize(
      recordSource,
      createNormalizationSelector(BarQuery.operation, ROOT_ID, {
        id: '1',
      }),
      payload,
      defaultOptions,
    );
  });

  it('does not warn if a single response contains the same scalar array value', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest23Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            name
            friends(first: 2) {
              edges {
                node {
                  id
                  emailAddresses
                }
              }
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        name: 'Alice',
        friends: {
          edges: [
            {
              node: {
                id: 'a',
                emailAddresses: ['a@example.com'],
              },
            },
            {
              node: {
                id: 'a',
                emailAddresses: ['a@example.com'], // not same object but deeply equal: should not warn
              },
            },
          ],
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    normalize(
      recordSource,
      createNormalizationSelector(BarQuery.operation, ROOT_ID, {
        id: '1',
      }),
      payload,
      defaultOptions,
    );
  });

  it('warns in __DEV__ if a single response contains conflicting fields with multiple same ids', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest24Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            name
            friends(first: 4) {
              edges {
                node {
                  id
                  firstName
                }
              }
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        name: 'Alice',
        friends: {
          edges: [
            {
              node: {
                id: 'a',
                firstName: 'Bob',
              },
            },
            {
              node: {
                id: 'b',
                firstName: 'Claire',
              },
            },
            {
              node: {
                id: 'a',
                firstName: 'Carlos',
              },
            },
            {
              node: {
                id: 'a',
                firstName: 'Shirley',
              },
            },
          ],
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    // TODO: This warning was detected when we started to enforce warnings in this test (D28091790). Payload needs to be updated.
    expectWarningWillFire(
      'RelayResponseNormalizer: Invalid record. The record contains two ' +
        'instances of the same id: `a` with conflicting field, firstName and its values: Bob and Carlos. ' +
        'If two fields are different but share ' +
        'the same id, one field will overwrite the other.',
    );
    expectWarningWillFire(
      'RelayResponseNormalizer: Invalid record. The record contains two ' +
        'instances of the same id: `a` with conflicting field, firstName and its values: Carlos and Shirley. ' +
        'If two fields are different but share the same id, one field will overwrite the other.',
    );
    normalize(
      recordSource,
      createNormalizationSelector(BarQuery.operation, ROOT_ID, {
        id: '1',
      }),
      payload,
      defaultOptions,
    );
  });

  it('warns in __DEV__ if a single response contains conflicting linked fields', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest25Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            name
            friends(first: 2) {
              edges {
                node {
                  id
                  firstName
                  comments(first: 1) {
                    edges {
                      node {
                        id
                        body {
                          text
                        }
                      }
                    }
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
        id: '1',
        __typename: 'User',
        name: 'Alice',
        friends: {
          edges: [
            {
              node: {
                id: 'a',
                firstName: 'Bob',
                comments: {
                  edges: [
                    {
                      node: {
                        id: '2',
                        body: {
                          text: 'Hello World',
                        },
                      },
                    },
                  ],
                },
              },
            },
            {
              node: {
                id: 'a',
                firstName: 'Bob',
                comments: {
                  edges: [
                    {
                      node: {
                        id: '3',
                        body: {
                          text: 'Hello World',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    expectToWarn(
      'RelayResponseNormalizer: Invalid record. The record contains ' +
        'references to the conflicting field, node and its id values: 2 and 3. ' +
        'We need to make sure that the record the field points ' +
        'to remains consistent or one field will overwrite the other.',
      () => {
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          defaultOptions,
        );
      },
    );
  });

  it('warns in __DEV__ if a single response contains conflicting linked fields with null values', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest26Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            name
            friends(first: 2) {
              edges {
                node {
                  id
                  firstName
                  comments(first: 1) {
                    edges {
                      node {
                        id
                        body {
                          text
                        }
                      }
                    }
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
        id: '1',
        __typename: 'User',
        name: 'Alice',
        friends: {
          edges: [
            {
              node: {
                id: 'a',
                firstName: 'Bob',
                comments: {
                  edges: [
                    {
                      node: {
                        id: '2',
                        body: {
                          text: 'Hello World',
                        },
                      },
                    },
                  ],
                },
              },
            },
            null,
            {
              node: {
                id: 'a',
                firstName: 'Bob',
                comments: {
                  edges: [
                    {
                      node: {
                        id: '3',
                        body: {
                          text: 'Hello World',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    expectToWarn(
      'RelayResponseNormalizer: Invalid record. The record contains references to the conflicting field, node and its id values: 2 and 3. We need to make sure that the record the field points to remains consistent or one field will overwrite the other.',
      () => {
        normalize(
          recordSource,
          createNormalizationSelector(BarQuery.operation, ROOT_ID, {
            id: '1',
          }),
          payload,
          defaultOptions,
        );
      },
    );
  });

  it('warns in __DEV__ if payload contains inconsistent types for a record', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest27Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            actor {
              id
              __typename
            }
            actors {
              id
              __typename
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        actor: {
          id: '1',
          __typename: 'Actor', // <- invalid
        },
        actors: [
          {
            id: '1',
            __typename: 'Actors', // <- invalid
          },
        ],
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    // TODO: These warnings were detected when we started to enforce warnings in this test (D28091790). Payload needs to be updated.
    expectWarningWillFire(
      'RelayModernRecord: Invalid field update, expected both versions of record `1` to have the same `__typename` but got conflicting types `User` and `Actor`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    expectWarningWillFire(
      'RelayResponseNormalizer: Invalid record `1`. Expected __typename to be consistent, but the record was assigned conflicting types `User` and `Actor`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    expectWarningWillFire(
      'RelayResponseNormalizer: Invalid record `1`. Expected __typename to be consistent, but the record was assigned conflicting types `Actor` and `Actors`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    expectWarningWillFire(
      'RelayModernRecord: Invalid field update, expected both versions of record `1` to have the same `__typename` but got conflicting types `Actor` and `Actors`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    normalize(
      recordSource,
      createNormalizationSelector(BarQuery.operation, ROOT_ID, {
        id: '1',
      }),
      payload,
      defaultOptions,
    );
    expectWarningWillFire(
      'RelayResponseNormalizer: Invalid record `1`. Expected __typename to be consistent, but the record was assigned conflicting types `Actors` and `User`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    expectWarningWillFire(
      'RelayModernRecord: Invalid field update, expected both versions of record `1` to have the same `__typename` but got conflicting types `Actors` and `User`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    expectWarningWillFire(
      'RelayResponseNormalizer: Invalid record `1`. Expected __typename to be consistent, but the record was assigned conflicting types `User` and `Actor`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    expectWarningWillFire(
      'RelayModernRecord: Invalid field update, expected both versions of record `1` to have the same `__typename` but got conflicting types `User` and `Actor`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    expectWarningWillFire(
      'RelayResponseNormalizer: Invalid record `1`. Expected __typename to be consistent, but the record was assigned conflicting types `Actor` and `Actors`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    expectWarningWillFire(
      'RelayModernRecord: Invalid field update, expected both versions of record `1` to have the same `__typename` but got conflicting types `Actor` and `Actors`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.',
    );
    normalize(
      recordSource,
      createNormalizationSelector(BarQuery.operation, ROOT_ID, {
        id: '1',
      }),
      payload,
      defaultOptions,
    );
  });

  it('does not warn in __DEV__ on inconsistent types for a client record', () => {
    const BarQuery = graphql`
      query RelayResponseNormalizerTest28Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ... on User {
            actor {
              id
              __typename
            }
            actors {
              id
              __typename
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: 'client:1',
        __typename: 'User',
        actor: {
          id: 'client:1',
          __typename: 'Actor', // <- invalid
        },
        actors: [
          {
            id: 'client:1',
            __typename: 'Actors', // <- invalid
          },
        ],
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    normalize(
      recordSource,
      createNormalizationSelector(BarQuery.operation, ROOT_ID, {
        id: '1',
      }),
      payload,
      defaultOptions,
    );
    normalize(
      recordSource,
      createNormalizationSelector(BarQuery.operation, ROOT_ID, {
        id: '1',
      }),
      payload,
      defaultOptions,
    );
  });

  it('leaves undefined fields unset', () => {
    const StrippedQuery = graphql`
      query RelayResponseNormalizerTest29Query($id: ID, $size: [Int]) {
        node(id: $id) {
          id
          __typename
          ... on User {
            firstName
            profilePicture(size: $size) {
              uri
            }
          }
        }
      }
    `;

    const payload = {
      node: {
        id: '1',
        __typename: 'User',
        firstName: 'Alice',
      },
    };
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));

    // TODO: This warning was detected when we started to enforce warnings in this test (D28091790). Payload needs to be updated.
    expectWarningWillFire(
      'RelayResponseNormalizer: Payload did not contain a value for field `profilePicture: profilePicture(size:32)`. Check that you are parsing with the same query that was used to fetch the payload.',
    );

    normalize(
      recordSource,
      createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
        id: '1',
        size: 32,
      }),
      payload,
      defaultOptions,
    );
    expect(recordSource.toJSON()).toEqual({
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        firstName: 'Alice',
        // `profilePicture` is excluded
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"1")': {
          __ref: '1',
        },
      },
    });
  });

  describe('when treatMissingFieldsAsNull is true', () => {
    it('set undefined fields to null', () => {
      const StrippedQuery = graphql`
        query RelayResponseNormalizerTest33Query($id: ID, $size: [Int]) {
          node(id: $id) {
            id
            __typename
            ... on User {
              firstName
              profilePicture(size: $size) {
                uri
              }
            }
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          firstName: 'Alice',
        },
      };
      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));

      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        {...defaultOptions, treatMissingFieldsAsNull: true},
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Alice',
          'profilePicture(size:32)': null,
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {
            __ref: '1',
          },
        },
      });
    });

    it('skips client fields not present in the payload but present in the store', () => {
      const StrippedQuery = graphql`
        query RelayResponseNormalizerTest34Query($id: ID) {
          node(id: $id) {
            id
            __typename
            ... on User {
              firstName
              nickname
              foo {
                bar {
                  content
                }
              }
            }
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          firstName: 'Bob',
        },
      };
      const recordSource = new RelayRecordSource({
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Alice',
          nickname: 'ecilA',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
      // TODO: This warning was detected when we started to enforce warnings in this test (D28091790). Payload needs to be updated.
      expectWarningWillFire(
        'RelayResponseNormalizer: Invalid record. The record contains two instances of the same id: `1` with conflicting field, firstName and its values: Alice and Bob. If two fields are different but share the same id, one field will overwrite the other.',
      );
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        {...defaultOptions, treatMissingFieldsAsNull: true},
      );
      const result = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          firstName: 'Bob',
          nickname: 'ecilA',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      expect(recordSource.toJSON()).toEqual(result);
      normalize(
        recordSource,
        createNormalizationSelector(StrippedQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual(result);
    });

    it('does not warn if a single response contains the same fields with the same id', () => {
      const BarQuery = graphql`
        query RelayResponseNormalizerTest35Query($id: ID) {
          node(id: $id) {
            id
            __typename
            ... on User {
              name
              friends(first: 2) {
                edges {
                  node {
                    id
                    firstName
                  }
                }
              }
            }
          }
        }
      `;

      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          name: 'Alice',
          friends: {
            edges: [
              {
                node: {
                  id: 'a',
                },
              },
              {
                node: {
                  id: 'a',
                },
              },
            ],
          },
        },
      };
      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      normalize(
        recordSource,
        createNormalizationSelector(BarQuery.operation, ROOT_ID, {
          id: '1',
        }),
        payload,
        {...defaultOptions, treatMissingFieldsAsNull: true},
      );
    });
  });

  describe('"falsy" IDs in payload', () => {
    let recordSource;
    const Query = graphql`
      query RelayResponseNormalizerTest30Query {
        me {
          author {
            id
          }
        }
      }
    `;

    const QueryWithList = graphql`
      query RelayResponseNormalizerTest31Query {
        me {
          actors {
            id
          }
        }
      }
    `;

    beforeEach(() => {
      recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    });

    it('should create client IDs for "falsy" values in payload', () => {
      const queryPayload = {
        me: {
          __typename: 'User',
          id: '',
          author: {
            id: 'author-id',
          },
        },
      };
      normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {}),
        queryPayload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual({
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          me: {
            __ref: 'client:root:me',
          },
        },
        'client:root:me': {
          // For this record we don't use the value `""` of the ID field
          __id: 'client:root:me',
          __typename: 'User',
          author: {
            __ref: 'author-id',
          },
          id: '',
        },
        'author-id': {
          __id: 'author-id',
          __typename: 'User',
          id: 'author-id',
        },
      });
    });

    it('should create client IDs for "falsy" values in payload - same id', () => {
      const queryPayload = {
        me: {
          __typename: 'User',
          id: '',
          author: {
            id: '',
          },
        },
      };
      normalize(
        recordSource,
        createNormalizationSelector(Query.operation, ROOT_ID, {}),
        queryPayload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual({
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          me: {
            __ref: 'client:root:me',
          },
        },
        'client:root:me': {
          // For this record we don't use the value `""` of the ID field
          __id: 'client:root:me',
          __typename: 'User',
          author: {
            // interesting observation, that client ID here is not re-used...
            __ref: 'client:root:me:author',
          },
          id: '',
        },
        'client:root:me:author': {
          __id: 'client:root:me:author',
          __typename: 'User',
          id: '',
        },
      });
    });

    it('should create client IDs for "falsy" values in payload for list', () => {
      const queryPayload = {
        me: {
          __typename: 'User',
          id: 'my-id',
          actors: [
            {
              __typename: 'User',
              id: '',
            },
            {
              __typename: 'User',
              id: 0,
            },
            {
              __typename: 'User',
              id: false,
            },
            {
              __typename: 'User',
              id: null,
            },
          ],
        },
      };
      normalize(
        recordSource,
        createNormalizationSelector(QueryWithList.operation, ROOT_ID, {}),
        queryPayload,
        defaultOptions,
      );
      expect(recordSource.toJSON()).toEqual({
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          me: {
            __ref: 'my-id',
          },
        },
        'my-id': {
          __typename: 'User',
          __id: 'my-id',
          actors: {
            __refs: [
              'client:my-id:actors:0',
              'client:my-id:actors:1',
              'client:my-id:actors:2',
              'client:my-id:actors:3',
            ],
          },
          id: 'my-id',
        },
        'client:my-id:actors:0': {
          __id: 'client:my-id:actors:0',
          __typename: 'User',
          id: '',
        },
        'client:my-id:actors:1': {
          __id: 'client:my-id:actors:1',
          __typename: 'User',
          id: 0,
        },
        'client:my-id:actors:2': {
          __id: 'client:my-id:actors:2',
          __typename: 'User',
          id: false,
        },
        'client:my-id:actors:3': {
          __id: 'client:my-id:actors:3',
          __typename: 'User',
          id: null,
        },
      });
    });
  });

  it('records which concrete types implement which client schema extension interfaces', () => {
    graphql`
      fragment RelayResponseNormalizerTestClientInterfaceFragment on ClientInterface {
        description
      }
    `;
    // This query contains abstract client types referenced in both named and
    // inline fragments as well as including both interfaces and unions.
    const query = graphql`
      query RelayResponseNormalizerTestClientInterfaceQuery {
        client_interface {
          ...RelayResponseNormalizerTestClientInterfaceFragment
        }
        client_union {
          ... on ClientUnion {
            __typename
          }
        }
      }
    `;

    const payload: PayloadData = {};
    const recordSource = new RelayRecordSource();
    recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));

    const result = normalize(
      recordSource,
      createNormalizationSelector(query.operation, ROOT_ID, {}),
      payload,
      {...defaultOptions},
    );

    expect(result.source.toJSON()).toEqual({
      'client:__type:ClientTypeImplementingClientInterface': {
        __id: 'client:__type:ClientTypeImplementingClientInterface',
        __isClientInterface: true,
        __typename: '__TypeSchema',
      },
      'client:__type:OtherClientTypeImplementingClientInterface': {
        __id: 'client:__type:OtherClientTypeImplementingClientInterface',
        __isClientInterface: true,
        __typename: '__TypeSchema',
      },
      'client:__type:ClientTypeInUnion': {
        __id: 'client:__type:ClientTypeInUnion',
        __isClientUnion: true,
        __typename: '__TypeSchema',
      },
      'client:__type:OtherClientTypeInUnion': {
        __id: 'client:__type:OtherClientTypeInUnion',
        __isClientUnion: true,
        __typename: '__TypeSchema',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
      },
    });
  });

  describe('when field error handling is enabled', () => {
    it('normalizes queries with multiple field errors', () => {
      const FooQuery = graphql`
        query RelayResponseNormalizerTest37Query($id: ID!) {
          node(id: $id) {
            id
            __typename
            ... on User {
              firstName
              lastName
              friends(first: 3) {
                edges {
                  cursor
                  node {
                    firstName
                    lastName
                  }
                }
              }
            }
          }
        }
      `;
      const payload: PayloadData = {
        node: {
          id: '1',
          __typename: 'User',
          firstName: 'Jerry',
          lastName: 'Seinfeld',
          friends: {
            edges: [
              {
                cursor: 'cursor:2',
                node: {
                  id: '2',
                  firstName: 'George',
                  lastName: 'Costanza',
                },
              },
              {
                cursor: 'cursor:3',
                node: {
                  id: '3',
                  firstName: null,
                  lastName: 'Kramer',
                },
              },
              {
                cursor: 'cursor:4',
                node: {
                  id: '4',
                  firstName: null,
                  lastName: 'Newman',
                },
              },
            ],
          },
        },
      };
      const errors: Array<PayloadError> = [
        {
          message: "No one knows Kramer's first name until season six!",
          path: ['node', 'friends', 'edges', 1, 'node', 'firstName'],
        },
        {
          message: 'There was another error!',
          path: ['node', 'friends', 'edges', 1, 'node', 'firstName'],
        },
        {
          message: "No one knows Newman's first name!",
          path: ['node', 'friends', 'edges', 2, 'node', 'firstName'],
        },
      ];
      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      normalize(
        recordSource,
        createNormalizationSelector(FooQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
        errors,
      );
      const friendsID = 'client:1:friends(first:3)';
      const edge0ID = `${friendsID}:edges:0`;
      const edge1ID = `${friendsID}:edges:1`;
      const edge2ID = `${friendsID}:edges:2`;
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
          firstName: 'Jerry',
          'friends(first:3)': {__ref: friendsID},
          lastName: 'Seinfeld',
        },
        '2': {
          __id: '2',
          __typename: 'User',
          firstName: 'George',
          id: '2',
          lastName: 'Costanza',
        },
        '3': {
          __errors: {
            firstName: [
              {
                message: "No one knows Kramer's first name until season six!",
              },
              {
                message: 'There was another error!',
              },
            ],
          },
          __id: '3',
          __typename: 'User',
          firstName: null,
          id: '3',
          lastName: 'Kramer',
        },
        '4': {
          __errors: {
            firstName: [
              {
                message: "No one knows Newman's first name!",
              },
            ],
          },
          __id: '4',
          __typename: 'User',
          firstName: null,
          id: '4',
          lastName: 'Newman',
        },
        [friendsID]: {
          __id: friendsID,
          __typename: 'FriendsConnection',
          edges: {
            __refs: [edge0ID, edge1ID, edge2ID],
          },
        },
        // $FlowFixMe[invalid-computed-prop]
        [edge0ID]: {
          __id: edge0ID,
          __typename: 'FriendsEdge',
          cursor: 'cursor:2',
          node: {__ref: '2'},
        },
        // $FlowFixMe[invalid-computed-prop]
        [edge1ID]: {
          __id: edge1ID,
          __typename: 'FriendsEdge',
          cursor: 'cursor:3',
          node: {__ref: '3'},
        },
        // $FlowFixMe[invalid-computed-prop]
        [edge2ID]: {
          __id: edge2ID,
          __typename: 'FriendsEdge',
          cursor: 'cursor:4',
          node: {__ref: '4'},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    it('normalizes queries with field errors that bubbled up', () => {
      const FooQuery = graphql`
        query RelayResponseNormalizerTest38Query($id: ID!) {
          node(id: $id) {
            id
            __typename
            ... on User {
              firstName
              lastName
              friends(first: 3) {
                edges {
                  cursor
                  node {
                    firstName
                    lastName
                  }
                }
              }
            }
          }
        }
      `;
      const payload = {
        node: {
          id: '1',
          __typename: 'User',
          firstName: 'Jerry',
          lastName: 'Seinfeld',
          friends: null,
        },
      };
      const errors: Array<PayloadError> = [
        {
          message: "No one knows Kramer's first name until season six!",
          path: ['node', 'friends', 'edges', 1, 'node', 'firstName'],
        },
        {
          message: 'There was another error!',
          path: ['node', 'friends', 'edges', 1, 'node', 'firstName'],
        },
        {
          message: "No one knows Newman's first name!",
          path: ['node', 'friends', 'edges', 2, 'node', 'firstName'],
        },
      ];
      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      normalize(
        recordSource,
        createNormalizationSelector(FooQuery.operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        payload,
        defaultOptions,
        errors,
      );
      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'User',
          __errors: {
            'friends(first:3)': [
              {
                message: "No one knows Kramer's first name until season six!",
                path: ['edges', 1, 'node', 'firstName'],
              },
              {
                message: 'There was another error!',
                path: ['edges', 1, 'node', 'firstName'],
              },
              {
                message: "No one knows Newman's first name!",
                path: ['edges', 2, 'node', 'firstName'],
              },
            ],
          },
          firstName: 'Jerry',
          'friends(first:3)': null,
          id: '1',
          lastName: 'Seinfeld',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      });
    });

    let wasNoncompliantErrorHandlingOnListsEnabled;

    beforeEach(() => {
      wasNoncompliantErrorHandlingOnListsEnabled =
        RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS;
    });

    afterEach(() => {
      RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS =
        wasNoncompliantErrorHandlingOnListsEnabled;
    });

    describe('when noncompliant error handling on lists is disabled', () => {
      beforeEach(() => {
        RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS = false;
      });

      it('ignores field errors on an empty list', () => {
        const FooQuery = graphql`
          query RelayResponseNormalizerTest39Query($id: ID!) {
            node(id: $id) {
              id
              __typename
              ... on User {
                friends(first: 3) {
                  edges {
                    cursor
                  }
                }
              }
            }
          }
        `;
        const payload = {
          node: {
            id: '1',
            __typename: 'User',
            friends: {
              edges: [],
            },
          },
        };
        const errors: Array<PayloadError> = [
          {
            message: 'There was an error!',
            path: ['node', 'friends', 'edges'],
          },
        ];
        const recordSource = new RelayRecordSource();
        recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
        normalize(
          recordSource,
          createNormalizationSelector(FooQuery.operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          payload,
          defaultOptions,
          errors,
        );
        expect(recordSource.toJSON()).toEqual({
          '1': {
            __id: '1',
            __typename: 'User',
            'friends(first:3)': {
              __ref: 'client:1:friends(first:3)',
            },
            id: '1',
          },
          'client:1:friends(first:3)': {
            __id: 'client:1:friends(first:3)',
            __typename: 'FriendsConnection',
            edges: {
              __refs: [],
            },
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        });
      });
    });

    describe('when noncompliant error handling on lists is enabled', () => {
      beforeEach(() => {
        RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS = true;
      });

      it('stores field errors on an linked field that is an empty list', () => {
        const FooQuery = graphql`
          query RelayResponseNormalizerTest40Query($id: ID!) {
            node(id: $id) {
              id
              __typename
              ... on User {
                friends(first: 3) {
                  edges {
                    cursor
                  }
                }
              }
            }
          }
        `;
        const payload = {
          node: {
            id: '1',
            __typename: 'User',
            friends: {
              edges: [],
            },
          },
        };
        const errors: Array<PayloadError> = [
          {
            message: 'There was an error!',
            path: ['node', 'friends', 'edges'],
          },
        ];
        const recordSource = new RelayRecordSource();
        recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
        normalize(
          recordSource,
          createNormalizationSelector(FooQuery.operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          payload,
          defaultOptions,
          errors,
        );
        expect(recordSource.toJSON()).toEqual({
          '1': {
            __id: '1',
            __typename: 'User',
            'friends(first:3)': {
              __ref: 'client:1:friends(first:3)',
            },
            id: '1',
          },
          'client:1:friends(first:3)': {
            __id: 'client:1:friends(first:3)',
            __typename: 'FriendsConnection',
            __errors: {
              edges: [
                {
                  message: 'There was an error!',
                },
              ],
            },
            edges: {
              __refs: [],
            },
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        });
      });

      it('stores field errors on an scalar field that is an empty list', () => {
        const FooQuery = graphql`
          query RelayResponseNormalizerTest41Query($id: ID!) {
            node(id: $id) {
              id
              __typename
              ... on User {
                emailAddresses
              }
            }
          }
        `;
        const payload = {
          node: {
            id: '1',
            __typename: 'User',
            emailAddresses: [],
          },
        };
        const errors: Array<PayloadError> = [
          {
            message: 'There was an error!',
            path: ['node', 'emailAddresses'],
          },
        ];
        const recordSource = new RelayRecordSource();
        recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
        normalize(
          recordSource,
          createNormalizationSelector(FooQuery.operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          payload,
          defaultOptions,
          errors,
        );
        expect(recordSource.toJSON()).toEqual({
          '1': {
            __id: '1',
            __typename: 'User',
            __errors: {
              emailAddresses: [
                {
                  message: 'There was an error!',
                },
              ],
            },
            id: '1',
            emailAddresses: [],
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        });
      });
    });
  });

  describe('Prototype-less objects (e.g., from graphql-js executor)', () => {
    const createPrototypeLessObject = (data: {[key: string]: unknown}) => {
      const obj = Object.create(null);
      // $FlowFixMe[unsafe-object-assign] - assigning to prototype-less object
      Object.assign(obj, data);
      return obj;
    };

    it('normalizes prototype-less payloads with type discriminator', () => {
      const query = graphql`
        query RelayResponseNormalizerTest42Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest42Fragment
          }
        }
      `;

      graphql`
        fragment RelayResponseNormalizerTest42Fragment on Node {
          id
          ... on User {
            name
          }
        }
      `;

      const payload = {
        node: createPrototypeLessObject({
          __typename: 'Page',
          id: '1',
        }),
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));

      normalize(
        recordSource,
        createNormalizationSelector(query.operation, ROOT_ID, {id: '1'}),
        payload,
        defaultOptions,
      );

      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'Page',
          id: '1',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        'client:__type:Page': {
          __id: 'client:__type:Page',
          __typename: '__TypeSchema',
          __isNode: false,
        },
      });
    });

    it('normalizes prototype-less payloads for union types', () => {
      const query = graphql`
        query RelayResponseNormalizerTest43Query($id: ID!) {
          userOrPage(id: $id) {
            ... on User {
              id
            }
          }
        }
      `;

      const payload = {
        userOrPage: createPrototypeLessObject({
          __typename: 'Page',
          id: '1',
        }),
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));

      normalize(
        recordSource,
        createNormalizationSelector(query.operation, ROOT_ID, {id: '1'}),
        payload,
        defaultOptions,
      );

      expect(recordSource.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'Page',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'userOrPage(id:"1")': {__ref: '1'},
        },
        'client:__type:Page': {
          __id: 'client:__type:Page',
          __typename: '__TypeSchema',
          __isNode: false,
        },
      });
    });
  });

  describe('deferDeduplicatedFields', () => {
    it('does not write `__is<Interface>: false` when the abstract typename is missing from the payload', () => {
      const query = graphql`
        query RelayResponseNormalizerTest44Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest44Fragment
          }
        }
      `;

      graphql`
        fragment RelayResponseNormalizerTest44Fragment on Node {
          id
          ... on User {
            name
          }
        }
      `;

      // Payload omits `__isNode`: under deferDeduplicatedFields this signals
      // that the server dedup'd an already-delivered field, not that the
      // concrete type fails the type refinement.
      const payload = {
        node: {
          __typename: 'User',
          id: '1',
          name: 'Alice',
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));

      normalize(
        recordSource,
        createNormalizationSelector(query.operation, ROOT_ID, {id: '1'}),
        payload,
        {...defaultOptions, deferDeduplicatedFields: true},
      );

      // No `client:__type:User` record — the write is skipped so
      // DataChecker treats the entry as unknown and refetches on next
      // check.
      expect(recordSource.get('client:__type:User')).toBe(undefined);
    });

    it('still writes `__is<Interface>: true` when the abstract typename is present in the payload', () => {
      const query = graphql`
        query RelayResponseNormalizerTest45Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest45Fragment
          }
        }
      `;

      graphql`
        fragment RelayResponseNormalizerTest45Fragment on Node {
          id
          ... on User {
            name
          }
        }
      `;

      const payload = {
        node: {
          __typename: 'User',
          __isNode: 'User',
          id: '1',
          name: 'Alice',
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));

      normalize(
        recordSource,
        createNormalizationSelector(query.operation, ROOT_ID, {id: '1'}),
        payload,
        {...defaultOptions, deferDeduplicatedFields: true},
      );

      expect(recordSource.get('client:__type:User')).toEqual({
        __id: 'client:__type:User',
        __typename: '__TypeSchema',
        __isNode: true,
      });
    });

    it('still writes `__is<Interface>: false` when deferDeduplicatedFields is off (default behaviour preserved)', () => {
      const query = graphql`
        query RelayResponseNormalizerTest46Query($id: ID!) {
          node(id: $id) {
            ...RelayResponseNormalizerTest46Fragment
          }
        }
      `;

      graphql`
        fragment RelayResponseNormalizerTest46Fragment on Node {
          id
          ... on User {
            name
          }
        }
      `;

      const payload = {
        node: {
          __typename: 'Page',
          id: '1',
        },
      };

      const recordSource = new RelayRecordSource();
      recordSource.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));

      normalize(
        recordSource,
        createNormalizationSelector(query.operation, ROOT_ID, {id: '1'}),
        payload,
        defaultOptions,
      );

      // Without deferDeduplicatedFields the missing `__isNode` is still a
      // real "type does not implement" signal — behaviour unchanged.
      expect(recordSource.get('client:__type:Page')).toEqual({
        __id: 'client:__type:Page',
        __typename: '__TypeSchema',
        __isNode: false,
      });
    });
  });
});
