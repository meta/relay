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

import type {RecordSourceJSON} from '../RelayStoreTypes';
import type {DataID} from 'relay-runtime/util/RelayRuntimeTypes';

import RelayNetwork from '../../network/RelayNetwork';
import {graphql} from '../../query/GraphQLTag';
import RelayModernEnvironment from '../RelayModernEnvironment';
import {createOperationDescriptor} from '../RelayModernOperationDescriptor';
import {createNormalizationSelector} from '../RelayModernSelector';
import RelayModernStore from '../RelayModernStore';
import RelayRecordSource from '../RelayRecordSource';
import {mark} from '../RelayReferenceMarker';
import {RELAY_READ_TIME_RESOLVER_KEY_PREFIX, ROOT_ID} from '../RelayStoreUtils';

describe('RelayReferenceMarker', () => {
  let source;

  beforeEach(() => {
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        firstName: 'Alice',
        'friends(first:3)': {__ref: 'client:1'},
        'profilePicture(size:32)': {__ref: 'client:4'},
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
      'client:1': {
        __id: 'client:1',
        __typename: 'FriendsConnection',
        edges: {
          __refs: ['client:2', null, 'client:3'],
        },
      },
      'client:2': {
        __id: 'client:2',
        __typename: 'FriendsConnectionEdge',
        cursor: 'cursor:2',
        node: {__ref: '2'},
      },
      'client:3': {
        __id: 'client:3',
        __typename: 'FriendsConnectionEdge',
        cursor: 'cursor:3',
        node: {__ref: '3'},
      },
      'client:4': {
        __id: 'client:4',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"1")': {__ref: '1'},
      },
    };

    source = RelayRecordSource.create(data);
  });

  it('marks referenced records', () => {
    const FooQuery = graphql`
      query RelayReferenceMarkerTest1Query($id: ID, $size: [Int]) {
        node(id: $id) {
          id
          __typename
          ... on Page {
            actors {
              name
            }
          }
          ...RelayReferenceMarkerTest1Fragment
            @dangerously_unaliased_fixme
            @arguments(size: $size)
        }
      }
    `;
    graphql`
      fragment RelayReferenceMarkerTest1Fragment on User
      @argumentDefinitions(size: {type: "[Int]"}) {
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
    `;
    const references = new Set<DataID>();
    mark(
      source,
      createNormalizationSelector(FooQuery.operation, ROOT_ID, {
        id: '1',
        size: 32,
      }),
      references,
    );
    expect(Array.from(references).sort()).toEqual([
      '1',
      '2',
      '3',
      'client:1',
      'client:2',
      'client:3',
      'client:4',
      'client:root',
    ]);
  });

  it('marks "handle" nodes for queries', () => {
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        'friends(first:1)': {__ref: 'client:1'},
        __friends_bestFriends: {__ref: 'client:bestFriends'},
      },
      '2': {
        __id: '2',
        __typename: 'User',
        id: '2',
      },
      '3': {
        __id: '3',
        __typename: 'User',
        id: '3',
      },
      'client:1': {
        __id: 'client:1',
        __typename: 'FriendsConnection',
        edges: {
          __refs: ['client:2'],
        },
      },
      'client:2': {
        __id: 'client:2',
        __typename: 'FriendsConnectionEdge',
        cursor: 'cursor:2',
        node: {__ref: '2'},
      },
      'client:bestFriends': {
        __id: 'client:bestFriends',
        __typename: 'FriendsConnection',
        edges: {
          __refs: ['client:bestFriendsEdge'],
        },
      },
      'client:bestFriendsEdge': {
        __id: 'client:bestFriendsEdge',
        __typename: 'FriendsConnectionEdge',
        cursor: 'cursor:bestFriendsEdge',
        node: {__ref: '3'},
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"1")': {__ref: '1'},
      },
    };
    source = RelayRecordSource.create(data);
    const UserProfile = graphql`
      query RelayReferenceMarkerTest2Query($id: ID!) {
        node(id: $id) {
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
    const references = new Set<DataID>();
    mark(
      source,
      createNormalizationSelector(UserProfile.operation, ROOT_ID, {
        id: '1',
      }),
      references,
    );
    expect(Array.from(references).sort()).toEqual([
      '1',
      '2',
      '3', // bestFriends.edges[0].node
      'client:1',
      'client:2',
      'client:bestFriends', // bestFriends
      'client:bestFriendsEdge', // bestFriends.edges[0]
      'client:root',
    ]);
  });

  it('marks "handle" nodes with key and filters for queries', () => {
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        'friends(first:1,orderby:["first name"])': {__ref: 'client:1'},
        '__UserProfile_friends_bestFriends(orderby:["first name"])': {
          __ref: 'client:bestFriends',
        },
        '__UserProfile_friends_bestFriends(orderby:["last name"])': {
          __ref: 'client:bestFriendsByLastName',
        },
      },
      '2': {
        __id: '2',
        __typename: 'User',
        id: '2',
      },
      '3': {
        __id: '3',
        __typename: 'User',
        id: '3',
      },
      'client:1': {
        __id: 'client:1',
        __typename: 'FriendsConnection',
        edges: {
          __refs: ['client:2'],
        },
      },
      'client:2': {
        __id: 'client:2',
        __typename: 'FriendsConnectionEdge',
        cursor: 'cursor:2',
        node: {__ref: '2'},
      },
      'client:bestFriends': {
        __id: 'client:bestFriends',
        __typename: 'FriendsConnection',
        edges: {
          __refs: ['client:bestFriendsEdge'],
        },
      },
      'client:bestFriendsByLastName': {
        __id: 'client:bestFriendsByLastName',
        __typename: 'FriendsConnection',
        edges: {
          __refs: [],
        },
      },
      'client:bestFriendsEdge': {
        __id: 'client:bestFriendsEdge',
        __typename: 'FriendsConnectionEdge',
        cursor: 'cursor:bestFriendsEdge',
        node: {__ref: '3'},
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"1")': {__ref: '1'},
      },
    };
    source = RelayRecordSource.create(data);
    const UserProfile = graphql`
      query RelayReferenceMarkerTest3Query($id: ID!, $orderby: [String]) {
        node(id: $id) {
          ... on User {
            friends(first: 1, orderby: $orderby)
              @__clientField(
                handle: "bestFriends"
                key: "UserProfile_friends"
                filters: ["orderby"]
              ) {
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
    let references = new Set<DataID>();
    mark(
      source,
      createNormalizationSelector(UserProfile.operation, ROOT_ID, {
        id: '1',
        orderby: ['first name'],
      }),
      references,
    );
    expect(Array.from(references).sort()).toEqual([
      '1',
      '2',
      '3', // bestFriends.edges[0].node
      'client:1',
      'client:2',
      'client:bestFriends', // bestFriends
      'client:bestFriendsEdge', // bestFriends.edges[0]
      'client:root',
    ]);

    references = new Set();
    mark(
      source,
      createNormalizationSelector(UserProfile.operation, ROOT_ID, {
        id: '1',
        orderby: ['last name'],
      }),
      references,
    );
    expect(Array.from(references).sort()).toEqual([
      '1',
      'client:bestFriendsByLastName',
      'client:root',
    ]);
  });

  it('marks referenced records for client field', () => {
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        firstName: 'Alice',
        best_friends: {__ref: 'client:1'},
        client_foo: {__ref: 'client:foo'},
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
      'client:1': {
        __id: 'client:1',
        __typename: 'FriendsConnection',
        edges: {
          __refs: ['client:2', null, 'client:3'],
        },
      },
      'client:2': {
        __id: 'client:2',
        __typename: 'FriendsConnectionEdge',
        cursor: 'cursor:2',
        node: {__ref: '2'},
      },
      'client:3': {
        __id: 'client:3',
        __typename: 'FriendsConnectionEdge',
        cursor: 'cursor:3',
        node: {__ref: '3'},
      },
      'client:foo': {
        __id: 'client:foo',
        __typename: 'Foo',
        client_name: 'client',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"1")': {__ref: '1'},
      },
    };
    source = RelayRecordSource.create(data);
    const FooQuery = graphql`
      query RelayReferenceMarkerTest4Query($id: ID) {
        node(id: $id) {
          id
          __typename
          ...RelayReferenceMarkerTest2Fragment @dangerously_unaliased_fixme
        }
      }
    `;
    graphql`
      fragment RelayReferenceMarkerTest2Fragment on User {
        client_foo {
          client_name
          profile_picture(scale: 2) {
            uri
          }
        }
        ... on User {
          nickname
          best_friends {
            client_friends_connection_field
            edges {
              client_friend_edge_field
              cursor
              node {
                id
                firstName
              }
            }
          }
          firstName
        }
      }
    `;
    const references = new Set<DataID>();
    mark(
      source,
      createNormalizationSelector(FooQuery.operation, ROOT_ID, {
        id: '1',
        size: 32,
      }),
      references,
    );
    expect(Array.from(references).sort()).toEqual([
      '1',
      '2',
      '3',
      'client:1',
      'client:2',
      'client:3',
      'client:foo',
      'client:root',
    ]);
  });

  describe('when using a @match field', () => {
    let BarQuery;
    let loader;

    beforeEach(() => {
      const nodes = {
        RelayReferenceMarkerTestPlainUserNameRenderer_name: graphql`
          fragment RelayReferenceMarkerTestPlainUserNameRenderer_name on PlainUserNameRenderer {
            plaintext
            data {
              text
            }
          }
        `,

        RelayReferenceMarkerTestMarkdownUserNameRenderer_name: graphql`
          fragment RelayReferenceMarkerTestMarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
            markdown
            data {
              markup
            }
          }
        `,
      };
      graphql`
        fragment RelayReferenceMarkerTest3Fragment on User {
          id
          nameRenderer @match {
            ...RelayReferenceMarkerTestPlainUserNameRenderer_name
              @module(name: "PlainUserNameRenderer.react")
            ...RelayReferenceMarkerTestMarkdownUserNameRenderer_name
              @module(name: "MarkdownUserNameRenderer.react")
          }
        }
      `;
      BarQuery = graphql`
        query RelayReferenceMarkerTest5Query($id: ID!) {
          node(id: $id) {
            ...RelayReferenceMarkerTest3Fragment @dangerously_unaliased_fixme
          }
        }
      `;
      loader = {
        get: jest.fn(
          (moduleName: unknown) =>
            // $FlowFixMe[invalid-computed-prop]
            nodes[String(moduleName).replace(/\$.*/, '')],
        ),
        load: jest.fn((moduleName: unknown) =>
          // $FlowFixMe[invalid-computed-prop]
          Promise.resolve(nodes[String(moduleName).replace(/\$.*/, '')]),
        ),
      };
    });

    it('marks references when the match field/record exist and match a supported type (plaintext)', () => {
      // When the type matches PlainUserNameRenderer
      const storeData: RecordSourceJSON = {
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
          __typename: 'PlainUserNameRenderer',
          __module_component_RelayReferenceMarkerTest3Fragment:
            'PlainUserNameRenderer.react',
          __module_operation_RelayReferenceMarkerTest3Fragment:
            'RelayReferenceMarkerTestPlainUserNameRenderer_name$normalization.graphql',
          plaintext: 'plain name',
          data: {__ref: 'data'},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'PlainUserNameData',
          text: 'text',
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
        'client:root',
        'data',
      ]);
    });

    it('marks references when the match field/record exist and match a supported type (2)', () => {
      // When the type matches MarkdownUserNameRenderer
      const storeData: RecordSourceJSON = {
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
          __module_component_RelayReferenceMarkerTest3Fragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayReferenceMarkerTest3Fragment:
            'RelayReferenceMarkerTestMarkdownUserNameRenderer_name$normalization.graphql',
          markdown: 'markdown payload',
          data: {__ref: 'data'},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'MarkdownUserNameData',
          markup: '<markup/>',
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
        'client:root',
        'data',
      ]);
    });

    it('marks references when the match field/record exist but the matched fragment has not been processed', () => {
      // The field returned the MarkdownUserNameRenderer type, but the module for that branch
      // has not been loaded. The assumption is that the data cannot have been processed in that
      // case and therefore the markdown field is missing in the store.
      const storeData: RecordSourceJSON = {
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
          // NOTE: markdown/data fields are missing, data not processed.
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        // Return null to indicate the fragment is not loaded yet
        {
          get: _ => null,
          load: _ => Promise.resolve(null),
        },
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
        'client:root',
      ]);
    });

    it('marks references when the match field/record exist but a scalar field is missing', () => {
      // the `data` field for the MarkdownUserNameRenderer is missing
      const storeData: RecordSourceJSON = {
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
          __module_component_RelayReferenceMarkerTest3Fragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayReferenceMarkerTest3Fragment:
            'RelayReferenceMarkerTestMarkdownUserNameRenderer_name$normalization.graphql',
          // NOTE: 'markdown' field missing
          data: {__ref: 'data'},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'MarkdownUserNameData',
          markup: '<markup/>',
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
        'client:root',
        'data',
      ]);
    });

    it('marks references when the match field/record exist but a linked field is missing', () => {
      // the `data` field for the MarkdownUserNameRenderer is missing
      const storeData: RecordSourceJSON = {
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
          markdown: 'markdown text',
          // NOTE: 'data' field missing
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
        'client:root',
      ]);
    });

    it('marks references when the match field/record exist but do not match a supported type', () => {
      const storeData: RecordSourceJSON = {
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
          customField: 'custom value',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
        'client:root',
      ]);
    });

    it('marks references when the match field is non-existent (null)', () => {
      const storeData: RecordSourceJSON = {
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
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual(['1', 'client:root']);
    });

    it('marks references when the match field is not fetched (undefined)', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          id: '1',
          __typename: 'User',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual(['1', 'client:root']);
    });
  });
  describe('Relay Resolver', () => {
    it('with no fragments is retained', () => {
      const storeData: RecordSourceJSON = {
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          [`${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}counter_no_fragment`]: {
            __ref: `client:root:${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}counter_no_fragment`,
          },
        },
        [`client:root:${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}counter_no_fragment`]:
          {},
      };
      const nodes = {
        FooQuery: graphql`
          query RelayReferenceMarkerTestResolverWithNoFragmentQuery {
            counter_no_fragment
          }
        `,
      };

      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      const loader = {
        get: jest.fn(
          (moduleName: unknown) =>
            // $FlowFixMe[invalid-computed-prop]
            nodes[String(moduleName).replace(/\$.*/, '')],
        ),
        load: jest.fn((moduleName: unknown) =>
          // $FlowFixMe[invalid-computed-prop]
          Promise.resolve(nodes[String(moduleName).replace(/\$.*/, '')]),
        ),
      };
      mark(
        source,
        createNormalizationSelector(
          nodes.FooQuery.operation,
          'client:root',
          {},
        ),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        'client:root',
        `client:root:${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}counter_no_fragment`,
      ]);
    });
    it('with fragment dependency is retained', () => {
      const storeData: RecordSourceJSON = {
        'client:root': {
          __id: 'client:root',
          __typename: 'Query',
          me: {__ref: '1'},
          [`${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}counter`]: {
            __ref: `client:root:${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}counter`,
          },
        },
        '1': {
          __id: '1',
          __typename: 'User',
        },
        [`client:root:${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}counter`]: {},
      };
      const nodes = {
        FooQuery: graphql`
          query RelayReferenceMarkerTestResolverWithFragmentDependencyQuery {
            counter
          }
        `,
      };

      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      const loader = {
        get: jest.fn(
          (moduleName: unknown) =>
            // $FlowFixMe[invalid-computed-prop]
            nodes[String(moduleName).replace(/\$.*/, '')],
        ),
        load: jest.fn((moduleName: unknown) =>
          // $FlowFixMe[invalid-computed-prop]
          Promise.resolve(nodes[String(moduleName).replace(/\$.*/, '')]),
        ),
      };
      mark(
        source,
        createNormalizationSelector(
          nodes.FooQuery.operation,
          'client:root',
          {},
        ),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:root',
        `client:root:${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}counter`,
      ]);
    });
    it('with plural @edgeTo client object is retained for read-time and exec-time resolvers', () => {
      const storeData: RecordSourceJSON = {
        'client:root': {
          __id: 'client:root',
          __typename: 'Query',
          me: {__ref: '1'},
        },
        '1': {
          __id: '1',
          __typename: 'User',
        },
      };
      const nodes = {
        FooQuery: graphql`
          query RelayReferenceMarkerTestResolverWithEdgeToClientQuery {
            all_astrological_signs {
              id
            }
          }
        `,
      };

      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      const loader = {
        get: jest.fn(
          (moduleName: unknown) =>
            // $FlowFixMe[invalid-computed-prop]
            nodes[String(moduleName).replace(/\$.*/, '')],
        ),
        load: jest.fn((moduleName: unknown) =>
          // $FlowFixMe[invalid-computed-prop]
          Promise.resolve(nodes[String(moduleName).replace(/\$.*/, '')]),
        ),
      };

      const store = new RelayModernStore(source, {
        gcReleaseBufferSize: 0,
      });
      const environment = new RelayModernEnvironment({
        network: RelayNetwork.create(jest.fn()),
        store,
      });
      const operation = createOperationDescriptor(nodes.FooQuery, {});
      environment.lookup(operation.fragment);

      // read
      mark(
        source,
        createNormalizationSelector(
          nodes.FooQuery.operation,
          'client:root',
          {},
        ),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:AstrologicalSign:Aquarius',
        'client:AstrologicalSign:Aries',
        'client:AstrologicalSign:Cancer',
        'client:AstrologicalSign:Capricorn',
        'client:AstrologicalSign:Gemini',
        'client:AstrologicalSign:Leo',
        'client:AstrologicalSign:Libra',
        'client:AstrologicalSign:Pisces',
        'client:AstrologicalSign:Sagittarius',
        'client:AstrologicalSign:Scorpio',
        'client:AstrologicalSign:Taurus',
        'client:AstrologicalSign:Virgo',
        'client:root',
        `client:root:${RELAY_READ_TIME_RESOLVER_KEY_PREFIX}all_astrological_signs`,
      ]);

      const execTimeSource = RelayRecordSource.create({
        'client:root': {
          __id: 'client:root',
          __typename: 'Query',
          all_astrological_signs: {
            __refs: ['client:AstrologicalSign:Aquarius'],
          },
        },
        'client:AstrologicalSign:Aquarius': {
          __id: 'client:AstrologicalSign:Aquarius',
          __typename: 'AstrologicalSign',
          id: 'Aquarius',
        },
      });
      const execTimeReferences = new Set<DataID>();
      mark(
        execTimeSource,
        createNormalizationSelector(
          nodes.FooQuery.operation,
          'client:root',
          {},
        ),
        execTimeReferences,
        loader,
        true,
      );
      expect(Array.from(execTimeReferences).sort()).toEqual([
        'client:AstrologicalSign:Aquarius',
        'client:root',
      ]);
    });
  });
  describe('@module', () => {
    let BarQuery;
    let loader;

    beforeEach(() => {
      const nodes = {
        RelayReferenceMarkerTest2PlainUserNameRenderer_name: graphql`
          fragment RelayReferenceMarkerTest2PlainUserNameRenderer_name on PlainUserNameRenderer {
            plaintext
            data {
              text
            }
          }
        `,

        RelayReferenceMarkerTest2MarkdownUserNameRenderer_name: graphql`
          fragment RelayReferenceMarkerTest2MarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
            markdown
            data {
              markup
            }
          }
        `,
      };
      graphql`
        fragment RelayReferenceMarkerTest4Fragment on User {
          id
          nameRenderer {
            # intentionally no @match
            ...RelayReferenceMarkerTest2PlainUserNameRenderer_name
              @module(name: "PlainUserNameRenderer.react")
            ...RelayReferenceMarkerTest2MarkdownUserNameRenderer_name
              @module(name: "MarkdownUserNameRenderer.react")
          }
        }
      `;
      BarQuery = graphql`
        query RelayReferenceMarkerTest6Query($id: ID!) {
          node(id: $id) {
            ...RelayReferenceMarkerTest4Fragment @dangerously_unaliased_fixme
          }
        }
      `;
      loader = {
        get: jest.fn(
          (moduleName: unknown) =>
            // $FlowFixMe[invalid-computed-prop]
            nodes[String(moduleName).replace(/\$.*/, '')],
        ),
        load: jest.fn((moduleName: unknown) =>
          // $FlowFixMe[invalid-computed-prop]
          Promise.resolve(nodes[String(moduleName).replace(/\$.*/, '')]),
        ),
      };
    });

    it('marks references when the field/record exists and matches a @module selection (plaintext)', () => {
      // When the type matches PlainUserNameRenderer
      const storeData: RecordSourceJSON = {
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
          __typename: 'PlainUserNameRenderer',
          __module_component_RelayReferenceMarkerTest4Fragment:
            'PlainUserNameRenderer.react',
          __module_operation_RelayReferenceMarkerTest4Fragment:
            'RelayReferenceMarkerTest2PlainUserNameRenderer_name$normalization.graphql',
          plaintext: 'plain name',
          data: {__ref: 'data'},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'PlainUserNameData',
          text: 'text',
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
        'client:root',
        'data',
      ]);
    });

    it('marks references when the field/record exists and matches a @module selection (markdown)', () => {
      // When the type matches MarkdownUserNameRenderer
      const storeData: RecordSourceJSON = {
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
          __module_component_RelayReferenceMarkerTest4Fragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayReferenceMarkerTest4Fragment:
            'RelayReferenceMarkerTest2MarkdownUserNameRenderer_name$normalization.graphql',
          markdown: 'markdown payload',
          data: {__ref: 'data'},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'MarkdownUserNameData',
          markup: '<markup/>',
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
        'client:root',
        'data',
      ]);
    });

    it('marks references when the field/record exists but the @module fragment has not been processed', () => {
      // The field returned the MarkdownUserNameRenderer type, but the module for that branch
      // has not been loaded. The assumption is that the data cannot have been processed in that
      // case and therefore the markdown field is missing in the store.
      const storeData: RecordSourceJSON = {
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
          // NOTE: markdown/data fields are missing, data not processed.
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        // Return null to indicate the fragment is not loaded yet
        {
          get: _ => null,
          load: _ => Promise.resolve(null),
        },
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
        'client:root',
      ]);
    });

    it('marks references when the field/record exists but a scalar field is missing', () => {
      // the `data` field for the MarkdownUserNameRenderer is missing
      const storeData: RecordSourceJSON = {
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
          __module_component_RelayReferenceMarkerTest4Fragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayReferenceMarkerTest4Fragment:
            'RelayReferenceMarkerTest2MarkdownUserNameRenderer_name$normalization.graphql',
          // NOTE: 'markdown' field missing
          data: {__ref: 'data'},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'MarkdownUserNameData',
          markup: '<markup/>',
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
        'client:root',
        'data',
      ]);
    });

    it('marks references when the field/record exists but a linked field is missing', () => {
      // the `data` field for the MarkdownUserNameRenderer is missing
      const storeData: RecordSourceJSON = {
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
          markdown: 'markdown text',
          // NOTE: 'data' field missing
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
        'client:root',
      ]);
    });

    it('marks references when the field/record exists but do not match any @module selection', () => {
      const storeData: RecordSourceJSON = {
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
          customField: 'custom value',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        source,
        createNormalizationSelector(BarQuery.operation, 'client:root', {
          id: '1',
        }),
        references,
        loader,
      );
      expect(Array.from(references).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
        'client:root',
      ]);
    });

    it('throws if no operation loader is provided', () => {
      const storeData: RecordSourceJSON = {
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
          __typename: 'PlainUserNameRenderer',
          __module_component_RelayReferenceMarkerTest4Fragment:
            'PlainUserNameRenderer.react',
          __module_operation_RelayReferenceMarkerTest4Fragment:
            'RelayReferenceMarkerTest2PlainUserNameRenderer_name$normalization.graphql',
          plaintext: 'plain name',
          data: {__ref: 'data'},
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'PlainUserNameData',
          text: 'text',
        },
      };
      source = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      expect(() =>
        mark(
          source,
          createNormalizationSelector(BarQuery.operation, 'client:root', {
            id: '1',
          }),
          references,
          null, // operationLoader
        ),
      ).toThrow(
        'RelayReferenceMarker: Expected an operationLoader to be configured when ' +
          'using `@module`. Could not load fragment `RelayReferenceMarkerTest2PlainUserNameRenderer_name` ' +
          'in operation `RelayReferenceMarkerTest6Query`.',
      );
    });
  });

  describe('when @defer directive is present', () => {
    let Query;

    beforeEach(() => {
      graphql`
        fragment RelayReferenceMarkerTest5Fragment on Feedback {
          id
          actors {
            name
          }
        }
      `;
      Query = graphql`
        query RelayReferenceMarkerTest7Query($id: ID!) {
          node(id: $id) {
            ...RelayReferenceMarkerTest5Fragment
              @dangerously_unaliased_fixme
              @defer(label: "TestFragment")
          }
        }
      `;
    });

    it('marks references when deferred selections are fetched', () => {
      const storeData: RecordSourceJSON = {
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
      };
      const recordSource = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        recordSource,
        createNormalizationSelector(Query.operation, 'client:root', {id: '1'}),
        references,
      );
      expect(Array.from(references).sort()).toEqual(['1', '2', 'client:root']);
    });

    it('marks references when deferred selections are not fetched', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'Feedback',
          id: '1',
          // actors not fetched
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      const recordSource = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        recordSource,
        createNormalizationSelector(Query.operation, 'client:root', {id: '1'}),
        references,
      );
      expect(Array.from(references).sort()).toEqual(['1', 'client:root']);
    });
  });

  describe('when @stream directive is present', () => {
    let Query;

    beforeEach(() => {
      graphql`
        fragment RelayReferenceMarkerTest6Fragment on Feedback {
          id
          actors @stream(label: "TestFragmentActors", initial_count: 0) {
            name
          }
        }
      `;
      Query = graphql`
        query RelayReferenceMarkerTest8Query($id: ID!) {
          node(id: $id) {
            ...RelayReferenceMarkerTest6Fragment @dangerously_unaliased_fixme
          }
        }
      `;
    });

    it('marks references when streamed selections are fetched', () => {
      const storeData: RecordSourceJSON = {
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
      };
      const recordSource = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        recordSource,
        createNormalizationSelector(Query.operation, 'client:root', {id: '1'}),
        references,
      );
      expect(Array.from(references).sort()).toEqual(['1', '2', 'client:root']);
    });

    it('marks references when streamed selections are not fetched', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'Feedback',
          id: '1',
          // actors not fetched
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      const recordSource = RelayRecordSource.create(storeData);
      const references = new Set<DataID>();
      mark(
        recordSource,
        createNormalizationSelector(Query.operation, 'client:root', {id: '1'}),
        references,
      );
      expect(Array.from(references).sort()).toEqual(['1', 'client:root']);
    });
  });
});
