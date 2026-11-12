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

const {getRequest, graphql} = require('../../query/GraphQLTag');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const {read} = require('../RelayReader');
const RelayRecordSource = require('../RelayRecordSource');
const {ROOT_ID} = require('../RelayStoreUtils');
const {TYPE_SCHEMA_TYPE, generateTypeID} = require('../TypeID');

describe('RelayReader', () => {
  let source;

  beforeEach(() => {
    const data = {
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        firstName: 'Alice',
        'friends(first:3)': {__ref: 'client:1'},
        'profilePicture(size:32)': {__ref: 'client:4'},
        'profilePicture(size:80)': {__ref: 'client:5'},
      },
      2: {
        __id: '2',
        __typename: 'User',
        id: '2',
        firstName: 'Bob',
      },
      3: {
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
        uri: 'https://example.com/32.png',
      },
      'client:5': {
        __id: 'client:5',
        __typename: 'Photo',
        uri: 'https://example.com/80.png',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"1")': {__ref: '1'},
      },
    };

    source = RelayRecordSource.create(data);
  });

  it('reads query data', () => {
    const FooQuery = graphql`
      query RelayReaderTestReadsQueryDataFooQuery($id: ID, $size: [Int]) {
        node(id: $id) {
          id
          __typename
          ... on Page {
            actors {
              name
            }
          }
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
    const operation = createOperationDescriptor(FooQuery, {id: '1', size: 32});
    const {data, seenRecords} = read(source, operation.fragment, null);
    expect(data).toEqual({
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
          uri: 'https://example.com/32.png',
        },
      },
    });
    expect(Array.from(seenRecords.values()).sort()).toEqual([
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

  it('reads fragment data', () => {
    const UserQuery = graphql`
      query RelayReaderTestReadsFragmentDataUserQuery($size: [Int]) {
        me {
          ...RelayReaderTestReadsFragmentData @arguments(size: $size)
        }
      }
    `;

    const BarFragment = graphql`
      fragment RelayReaderTestReadsFragmentData on User
      @argumentDefinitions(size: {type: "[Int]"}) {
        id
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
    `;
    const owner = createOperationDescriptor(UserQuery, {size: 32});
    const {data, seenRecords} = read(
      source,
      createReaderSelector(BarFragment, '1', {size: 32}, owner.request),
    );
    expect(data).toEqual({
      id: '1',
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
        uri: 'https://example.com/32.png',
      },
    });
    expect(Array.from(seenRecords.values()).sort()).toEqual([
      '1',
      '2',
      '3',
      'client:1',
      'client:2',
      'client:3',
      'client:4',
    ]);
  });

  it('creates fragment pointers with fragment owner when owner is provided', () => {
    const ParentQuery = graphql`
      query RelayReaderTestCreatesFragmentPointersWithFragmentOwnerWhenOwnerIsProvidedParentQuery(
        $size: [Int]
      ) {
        me {
          ...RelayReaderTestCreatesFragmentPointersWithFragmentOwnerWhenOwnerIsProvidedUserProfile
        }
      }
    `;

    const UserProfile = graphql`
      fragment RelayReaderTestCreatesFragmentPointersWithFragmentOwnerWhenOwnerIsProvidedUserProfile on User {
        id
        name
        ...RelayReaderTestCreatesFragmentPointersWithFragmentOwnerWhenOwnerIsProvidedUserProfilePicture
      }
    `;

    graphql`
      fragment RelayReaderTestCreatesFragmentPointersWithFragmentOwnerWhenOwnerIsProvidedUserProfilePicture on User {
        profilePicture(size: $size) {
          uri
        }
      }
    `;

    const queryNode = getRequest(ParentQuery);
    const owner = createOperationDescriptor(queryNode, {size: 42});
    const {data, seenRecords} = read(
      source,
      createReaderSelector(UserProfile, '1', {size: 42}, owner.request),
    );
    expect(data).toEqual({
      id: '1',
      __id: '1',
      __fragments: {
        RelayReaderTestCreatesFragmentPointersWithFragmentOwnerWhenOwnerIsProvidedUserProfilePicture:
          {},
      },
      __fragmentOwner: owner.request,
    });
    expect(data.__fragmentOwner).toBe(owner.request);
    expect(Array.from(seenRecords.values()).sort()).toEqual(['1']);
  });

  it('creates fragment pointers with variable @arguments', () => {
    const UserQuery = graphql`
      query RelayReaderTestCreatesFragmentPointersWithVariableArgumentsUserQuery {
        me {
          ...RelayReaderTestCreatesFragmentPointersWithVariableArgumentsUserProfile
        }
      }
    `;
    const UserProfile = graphql`
      fragment RelayReaderTestCreatesFragmentPointersWithVariableArgumentsUserProfile on User
      @argumentDefinitions(size: {type: "[Int]"}) {
        id
        ...RelayReaderTestCreatesFragmentPointersWithVariableArgumentsUserProfilePicture
          @arguments(size: $size)
      }
    `;

    graphql`
      fragment RelayReaderTestCreatesFragmentPointersWithVariableArgumentsUserProfilePicture on User
      @argumentDefinitions(size: {type: "[Int]"}) {
        profilePicture(size: $size) {
          uri
        }
      }
    `;

    const owner = createOperationDescriptor(UserQuery, {});
    const {data, seenRecords} = read(
      source,
      createReaderSelector(UserProfile, '1', {size: 42}, owner.request),
    );
    expect(data).toEqual({
      id: '1',
      __id: '1',
      __fragments: {
        RelayReaderTestCreatesFragmentPointersWithVariableArgumentsUserProfilePicture:
          {
            size: 42,
          },
      },
      __fragmentOwner: owner.request,
    });
    expect(Array.from(seenRecords.values()).sort()).toEqual(['1']);
  });

  it('creates fragment pointers with literal @arguments', () => {
    const UserQuery = graphql`
      query RelayReaderTestCreatesFragmentPointersWithLiteralArgumentsUserQuery {
        me {
          ...RelayReaderTestCreatesFragmentPointersWithLiteralArgumentsUserProfile
        }
      }
    `;
    const UserProfile = graphql`
      fragment RelayReaderTestCreatesFragmentPointersWithLiteralArgumentsUserProfile on User {
        id
        ...RelayReaderTestCreatesFragmentPointersWithLiteralArgumentsUserProfilePicture
          @arguments(size: 42)
      }
    `;
    graphql`
      fragment RelayReaderTestCreatesFragmentPointersWithLiteralArgumentsUserProfilePicture on User
      @argumentDefinitions(size: {type: "[Int]"}) {
        profilePicture(size: $size) {
          uri
        }
      }
    `;

    const owner = createOperationDescriptor(UserQuery, {});
    const {data, seenRecords} = read(
      source,
      createReaderSelector(UserProfile, '1', {}, owner.request),
    );
    expect(data).toEqual({
      id: '1',
      __id: '1',
      __fragments: {
        RelayReaderTestCreatesFragmentPointersWithLiteralArgumentsUserProfilePicture:
          {
            size: 42,
          },
      },
      __fragmentOwner: owner.request,
    });
    expect(Array.from(seenRecords.values()).sort()).toEqual(['1']);
  });

  describe('@inline', () => {
    it('reads a basic fragment', () => {
      const UserQuery = graphql`
        query RelayReaderTestReadsBasicFragmentUserQuery {
          me {
            ...RelayReaderTestReadsBasicFragmentUserProfile
          }
        }
      `;
      const UserProfile = graphql`
        fragment RelayReaderTestReadsBasicFragmentUserProfile on User {
          id
          ...RelayReaderTestReadsBasicFragmentUserProfilePicture
        }
      `;
      graphql`
        fragment RelayReaderTestReadsBasicFragmentUserProfilePicture on User
        @inline {
          profilePicture(size: 32) {
            uri
          }
        }
      `;
      const owner = createOperationDescriptor(UserQuery, {});
      const {data, seenRecords} = read(
        source,
        createReaderSelector(UserProfile, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        __id: '1',
        __fragments: {
          RelayReaderTestReadsBasicFragmentUserProfilePicture: {
            profilePicture: {uri: 'https://example.com/32.png'},
          },
        },
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual([
        '1',
        'client:4',
      ]);
    });
  });

  it('reads data when the root is deleted', () => {
    const UserQuery = graphql`
      query RelayReaderTestReadsDataWhenTheRootIsDeletedQuery {
        me {
          ...RelayReaderTestReadsDataWhenTheRootIsDeletedUserProfile
        }
      }
    `;
    const UserProfile = graphql`
      fragment RelayReaderTestReadsDataWhenTheRootIsDeletedUserProfile on User {
        name
      }
    `;
    source = RelayRecordSource.create();
    source.delete('4');
    const owner = createOperationDescriptor(UserQuery, {});
    const {data, seenRecords} = read(
      source,
      createReaderSelector(UserProfile, '4', {}, owner.request),
    );
    expect(data).toBe(null);
    expect(Array.from(seenRecords.values()).sort()).toEqual(['4']);
  });

  it('reads data when the root is unfetched', () => {
    const UserQuery = graphql`
      query RelayReaderTestReadsDataWhenTheRootIsUnfetchedQuery {
        me {
          ...RelayReaderTestReadsDataWhenTheRootIsDeletedUserProfile
        }
      }
    `;
    const UserProfile = graphql`
      fragment RelayReaderTestReadsDataWhenTheRootIsUnfetchedUserProfile on User {
        name
      }
    `;
    source = RelayRecordSource.create();
    const owner = createOperationDescriptor(UserQuery, {});
    const {data, seenRecords} = read(
      source,
      createReaderSelector(UserProfile, '4', {}, owner.request),
    );
    expect(data).toBe(undefined);
    expect(Array.from(seenRecords.values()).sort()).toEqual(['4']);
  });

  it('reads "handle" fields for query root fragments', () => {
    const records = {
      1: {
        __id: '1',
        __typename: 'User',
        __friends_bestFriends: {__ref: 'client:bestFriends'},
      },
      2: {
        __id: '2',
        __typename: 'User',
        id: '2',
        __name_friendsName: 'handleName',
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
        node: {__ref: '2'},
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"1")': {__ref: '1'},
      },
    };
    source = RelayRecordSource.create(records);
    const UserFriends = graphql`
      query RelayReaderTestReadsHandleFieldsForQueryRootFragmentsUserFriendsQuery(
        $id: ID!
      ) {
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
    const owner = createOperationDescriptor(UserFriends, {id: '1'});
    const {data, seenRecords} = read(
      source,
      createReaderSelector(
        UserFriends.fragment,
        ROOT_ID,
        {id: '1'},
        owner.request,
      ),
    );
    expect(data).toEqual({
      node: {
        friends: {
          edges: [
            {
              cursor: 'cursor:bestFriendsEdge',
              node: {
                id: '2',
                name: 'handleName',
              },
            },
          ],
        },
      },
    });
    expect(Array.from(seenRecords.values()).sort()).toEqual([
      '1',
      '2',
      'client:bestFriends',
      'client:bestFriendsEdge',
      'client:root',
    ]);
  });

  it('reads "handle" fields for fragments', () => {
    const records = {
      1: {
        __id: '1',
        __typename: 'User',
        __friends_bestFriends: {__ref: 'client:bestFriends'},
      },
      2: {
        __id: '2',
        __typename: 'User',
        id: '2',
        __name_friendsName: 'handleName',
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
        node: {__ref: '2'},
      },
    };
    source = RelayRecordSource.create(records);
    const UserQuery = graphql`
      query RelayReaderTestReadsHandleFieldsForFragmentsUserFriendsQuery {
        me {
          ...RelayReaderTestReadsHandleFieldsForFragmentsUserFriends
        }
      }
    `;
    const UserFriends = graphql`
      fragment RelayReaderTestReadsHandleFieldsForFragmentsUserFriends on User {
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
    `;
    const owner = createOperationDescriptor(UserQuery, {});
    const {data, seenRecords} = read(
      source,
      createReaderSelector(UserFriends, '1', {}, owner.request),
    );
    expect(data).toEqual({
      friends: {
        edges: [
          {
            cursor: 'cursor:bestFriendsEdge',
            node: {
              id: '2',
              name: 'handleName',
            },
          },
        ],
      },
    });
    expect(Array.from(seenRecords.values()).sort()).toEqual([
      '1',
      '2',
      'client:bestFriends',
      'client:bestFriendsEdge',
    ]);
  });

  describe('when @match directive is present', () => {
    let BarFragment;
    let BarQuery;

    beforeEach(() => {
      graphql`
        fragment RelayReaderTestWhenMatchDirectiveIsPresentPlainUserNameRenderer_name on PlainUserNameRenderer {
          plaintext
        }
      `;

      graphql`
        fragment RelayReaderTestWhenMatchDirectiveIsPresentMarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
          markdown
        }
      `;

      BarFragment = graphql`
        fragment RelayReaderTestWhenMatchDirectiveIsPresentBarFragment on User {
          id
          nameRenderer @match {
            ...RelayReaderTestWhenMatchDirectiveIsPresentPlainUserNameRenderer_name
              @module(name: "PlainUserNameRenderer.react")
            ...RelayReaderTestWhenMatchDirectiveIsPresentMarkdownUserNameRenderer_name
              @module(name: "MarkdownUserNameRenderer.react")
          }
        }
      `;

      BarQuery = graphql`
        query RelayReaderTestWhenMatchDirectiveIsPresentBarQuery {
          me {
            ...RelayReaderTestWhenMatchDirectiveIsPresentBarFragment
          }
        }
      `;
    });

    it('creates fragment and module pointers for fragment that matches resolved type (1)', () => {
      // When the type matches PlainUserNameRenderer
      const storeData = {
        1: {
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
          __module_component_RelayReaderTestWhenMatchDirectiveIsPresentBarFragment:
            'PlainUserNameRenderer.react',
          __module_operation_RelayReaderTestWhenMatchDirectiveIsPresentBarFragment:
            'RelayReaderTestWhenMatchDirectiveIsPresentPlainUserNameRenderer_name$normalization.graphql',
          plaintext: 'plain name',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const owner = createOperationDescriptor(BarQuery, {});
      const {data, seenRecords, isMissingData} = read(
        source,
        createReaderSelector(BarFragment, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        nameRenderer: {
          __id: 'client:1:nameRenderer(supported:"34hjiS")',
          __fragments: {
            RelayReaderTestWhenMatchDirectiveIsPresentPlainUserNameRenderer_name:
              {},
          },
          __fragmentOwner: owner.request,
          __fragmentPropName: 'name',
          __module_component: 'PlainUserNameRenderer.react',
        },
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
      ]);
      expect(isMissingData).toBe(false);
    });

    it('creates fragment and module pointers for fragment that matches resolved type (2)', () => {
      // When the type matches MarkdownUserNameRenderer
      const storeData = {
        1: {
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
          __module_component_RelayReaderTestWhenMatchDirectiveIsPresentBarFragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayReaderTestWhenMatchDirectiveIsPresentBarFragment:
            'RelayReaderTestWhenMatchDirectiveIsPresentMarkdownUserNameRenderer_name$normalization.graphql',
          markdown: 'markdown payload',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const owner = createOperationDescriptor(BarQuery, {});
      const {data, seenRecords, isMissingData} = read(
        source,
        createReaderSelector(BarFragment, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        nameRenderer: {
          __id: 'client:1:nameRenderer(supported:"34hjiS")',
          __fragments: {
            RelayReaderTestWhenMatchDirectiveIsPresentMarkdownUserNameRenderer_name:
              {},
          },
          __fragmentOwner: owner.request,
          __fragmentPropName: 'name',
          __module_component: 'MarkdownUserNameRenderer.react',
        },
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
      ]);
      expect(isMissingData).toBe(false);
    });

    it('reads data correctly when the resolved type does not match any of the specified cases', () => {
      const storeData = {
        1: {
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
      const owner = createOperationDescriptor(BarQuery, {});
      const {data, seenRecords, isMissingData} = read(
        source,
        createReaderSelector(BarFragment, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        nameRenderer: {}, // type doesn't match selections, no data provided
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual([
        '1',
        'client:1:nameRenderer(supported:"34hjiS")',
      ]);
      expect(isMissingData).toBe(false);
    });

    it('reads data correctly when the match field record is null', () => {
      const storeData = {
        1: {
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
      const owner = createOperationDescriptor(BarQuery, {});
      const {data, seenRecords, isMissingData} = read(
        source,
        createReaderSelector(BarFragment, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        nameRenderer: null,
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual(['1']);
      expect(isMissingData).toBe(false);
    });

    it('reads data correctly when the match field record is missing', () => {
      const storeData = {
        1: {
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
      const owner = createOperationDescriptor(BarQuery, {});
      const {data, seenRecords, isMissingData} = read(
        source,
        createReaderSelector(BarFragment, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        nameRenderer: undefined,
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual(['1']);
      expect(isMissingData).toBe(true);
    });
  });

  describe('@module', () => {
    let BarQuery;
    let BarFragment;

    beforeEach(() => {
      graphql`
        fragment RelayReaderTestWhenMatchDirectiveIsPresentNoModulePlainUserNameRenderer_name on PlainUserNameRenderer {
          plaintext
        }
      `;

      graphql`
        fragment RelayReaderTestWhenMatchDirectiveIsPresentNoModuleMarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
          markdown
        }
      `;

      BarFragment = graphql`
        fragment RelayReaderTestWhenMatchDirectiveIsPresentNoModuleBarFragment on User {
          id
          nameRenderer {
            # intentionally no @match here
            ...RelayReaderTestWhenMatchDirectiveIsPresentNoModulePlainUserNameRenderer_name
              @module(name: "PlainUserNameRenderer.react")
            ...RelayReaderTestWhenMatchDirectiveIsPresentNoModuleMarkdownUserNameRenderer_name
              @module(name: "MarkdownUserNameRenderer.react")
          }
        }
      `;

      BarQuery = graphql`
        query RelayReaderTestWhenMatchDirectiveIsPresentNoModuleBarQuery {
          me {
            ...RelayReaderTestWhenMatchDirectiveIsPresentNoModuleBarFragment
          }
        }
      `;
    });

    it('creates fragment and module pointers when the type matches a @module selection (1)', () => {
      // When the type matches PlainUserNameRenderer
      const storeData = {
        1: {
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
          __module_component_RelayReaderTestWhenMatchDirectiveIsPresentNoModuleBarFragment:
            'PlainUserNameRenderer.react',
          __module_operation_RelayReaderTestWhenMatchDirectiveIsPresentNoModuleBarFragment:
            'RelayReaderTestWhenMatchDirectiveIsPresentNoModulePlainUserNameRenderer_name$normalization.graphql',
          plaintext: 'plain name',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const owner = createOperationDescriptor(BarQuery, {});
      const {data, seenRecords, isMissingData} = read(
        source,
        createReaderSelector(BarFragment, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        nameRenderer: {
          __id: 'client:1:nameRenderer',
          __fragments: {
            RelayReaderTestWhenMatchDirectiveIsPresentNoModulePlainUserNameRenderer_name:
              {},
          },
          __fragmentOwner: owner.request,
          __fragmentPropName: 'name',
          __module_component: 'PlainUserNameRenderer.react',
        },
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
      ]);
      expect(isMissingData).toBe(false);
    });

    it('creates fragment and module pointers when the type matches a @module selection (2)', () => {
      // When the type matches MarkdownUserNameRenderer
      const storeData = {
        1: {
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
          __module_component_RelayReaderTestWhenMatchDirectiveIsPresentNoModuleBarFragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_RelayReaderTestWhenMatchDirectiveIsPresentNoModuleBarFragment:
            'RelayReaderTestWhenMatchDirectiveIsPresentNoModuleMarkdownUserNameRenderer_name$normalization.graphql',
          markdown: 'markdown payload',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      source = RelayRecordSource.create(storeData);
      const owner = createOperationDescriptor(BarQuery, {});
      const {data, seenRecords, isMissingData} = read(
        source,
        createReaderSelector(BarFragment, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        nameRenderer: {
          __id: 'client:1:nameRenderer',
          __fragments: {
            RelayReaderTestWhenMatchDirectiveIsPresentNoModuleMarkdownUserNameRenderer_name:
              {},
          },
          __fragmentOwner: owner.request,
          __fragmentPropName: 'name',
          __module_component: 'MarkdownUserNameRenderer.react',
        },
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
      ]);
      expect(isMissingData).toBe(false);
    });

    it('reads data correctly when the resolved type does not match any of the @module selections', () => {
      const storeData = {
        1: {
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
      const owner = createOperationDescriptor(BarQuery, {});
      const {data, seenRecords, isMissingData} = read(
        source,
        createReaderSelector(BarFragment, '1', {}, owner.request),
      );
      expect(data).toEqual({
        id: '1',
        nameRenderer: {}, // type doesn't match selections, no data provided
      });
      expect(Array.from(seenRecords.values()).sort()).toEqual([
        '1',
        'client:1:nameRenderer',
      ]);
      expect(isMissingData).toBe(false);
    });
  });

  describe('`isMissingData` field', () => {
    describe('readScalar', () => {
      it('should have `isMissingData = false` if data is available', () => {
        const UserProfile = graphql`
          fragment RelayReaderTestReadScalarProfile on User {
            id
          }
        `;
        const UserQuery = graphql`
          query RelayReaderTestReadScalarUserQuery {
            me {
              ...RelayReaderTestReadScalarProfile
            }
          }
        `;

        const owner = createOperationDescriptor(UserQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserProfile, '1', {}, owner.request),
        );
        expect(data.id).toBe('1');
        expect(isMissingData).toBe(false);
      });

      it('should have `isMissingData = true` if data is missing', () => {
        const UserProfile = graphql`
          fragment RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingUserProfile on User {
            id
            username
          }
        `;
        const UserQuery = graphql`
          query RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingUserQuery {
            me {
              ...RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingUserProfile
            }
          }
        `;
        const owner = createOperationDescriptor(UserQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserProfile, '1', {}, owner.request),
        );
        expect(data.id).toBe('1');
        expect(data.username).not.toBeDefined();
        expect(isMissingData).toBe(true);
      });
    });

    describe('readLink', () => {
      it('should have `isMissingData = false` if data is available', () => {
        const ProfilePicture = graphql`
          fragment RelayReaderTestShouldHaveIsmissingdataFalseIfDataIsAvailableProfilePicture on User {
            id
            profilePicture(size: $size) {
              uri
            }
          }
        `;
        const UserQuery = graphql`
          query RelayReaderTestShouldHaveIsmissingdataFalseIfDataIsAvailableUserQuery(
            $size: [Int]
          ) {
            me {
              ...RelayReaderTestShouldHaveIsmissingdataFalseIfDataIsAvailableProfilePicture
            }
          }
        `;
        const owner = createOperationDescriptor(UserQuery, {size: 32});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(
            ProfilePicture,
            '1',
            {
              size: 32,
            },
            owner.request,
          ),
        );
        expect(data.profilePicture.uri).toEqual('https://example.com/32.png');
        expect(isMissingData).toBe(false);
      });

      it('should have `isMissingData = true` if data is missing', () => {
        const Address = graphql`
          fragment RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingAddress on User {
            id
            address {
              city
            }
          }
        `;
        const UserQuery = graphql`
          query RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingAddressQuery {
            me {
              ...RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingAddress
            }
          }
        `;
        const owner = createOperationDescriptor(UserQuery);
        const {data, isMissingData} = read(
          source,
          createReaderSelector(Address, '1', {}, owner.request),
        );
        expect(data.id).toBe('1');
        expect(data.address).not.toBeDefined();
        expect(isMissingData).toBe(true);
      });

      it('should have `isMissingData = true` if data is missing (variables)', () => {
        const ProfilePicture = graphql`
          fragment RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingVariablesProfilePicture on User {
            id
            profilePicture(size: $size) {
              uri
            }
          }
        `;
        const UserQuery = graphql`
          query RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingVariablesProfilePictureQuery {
            me {
              id # Note that this does not include the fragment so the variable data should be missing
            }
          }
        `;
        const owner = createOperationDescriptor(UserQuery);
        const {data, isMissingData} = read(
          source,
          createReaderSelector(
            ProfilePicture,
            '1',
            {
              size: 48,
            },
            owner.request,
          ),
        );
        expect(data.id).toBe('1');
        expect(data.profilePicture).not.toBeDefined();
        expect(isMissingData).toBe(true);
      });
    });

    describe('readPluralLink', () => {
      beforeEach(() => {
        const typeID = generateTypeID('User');
        const data = {
          [typeID]: {
            __id: typeID,
            __typename: TYPE_SCHEMA_TYPE,
            __isActor: true,
          },
          1: {
            __id: '1',
            id: '1',
            __typename: 'User',
            firstName: 'Alice',
            'friends(first:3)': {__ref: 'client:1'},
          },
          2: {
            __id: '2',
            __typename: 'User',
            id: '2',
            firstName: 'Bob',
            'friends(first:2)': {__ref: 'client:4'},
          },
          3: {
            __id: '3',
            __typename: 'User',
            id: '3',
            firstName: 'Claire',
            'friends(first:1)': {__ref: 'client:5'},
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
            __id: 'client:2',
            __typename: 'FriendsConnection',
          },
          'client:5': {
            __id: 'client:3',
            __typename: 'FriendsConnection',
            edges: {
              __refs: [undefined],
            },
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        };

        source = RelayRecordSource.create(data);
      });

      it('should have `isMissingData = false` if data is available', () => {
        const UserQuery = graphql`
          query RelayReaderTestShouldHaveIsmissingdataFalseIfDataIsAvailableUserFriendsQuery {
            me {
              ...RelayReaderTestShouldHaveIsmissingdataFalseIfDataIsAvailableUserFriends
            }
          }
        `;

        const UserFriends = graphql`
          fragment RelayReaderTestShouldHaveIsmissingdataFalseIfDataIsAvailableUserFriends on User {
            id
            friends(first: 3) {
              edges {
                cursor
                node {
                  id
                }
              }
            }
          }
        `;

        const owner = createOperationDescriptor(UserQuery, {});

        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserFriends, '1', {}, owner.request),
        );
        expect(data.friends.edges).toEqual([
          {
            cursor: 'cursor:2',
            node: {
              id: '2',
            },
          },
          null,
          {
            cursor: 'cursor:3',
            node: {
              id: '3',
            },
          },
        ]);
        expect(isMissingData).toBe(false);
      });

      it('should have `isMissingData = true` if data is missing in the node', () => {
        const UserQuery = graphql`
          query RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingInTheNodeUserFriendsQuery {
            me {
              ...RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingInTheNodeUserFriends
            }
          }
        `;

        const UserFriends = graphql`
          fragment RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingInTheNodeUserFriends on User {
            id
            friends(first: 3) {
              edges {
                cursor
                node {
                  id
                  username
                }
              }
            }
          }
        `;

        const owner = createOperationDescriptor(UserQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserFriends, '1', {}, owner.request),
        );
        expect(data.friends.edges).toEqual([
          {
            cursor: 'cursor:2',
            node: {
              id: '2',
            },
          },
          null,
          {
            cursor: 'cursor:3',
            node: {
              id: '3',
            },
          },
        ]);
        expect(isMissingData).toBe(true);
      });

      it('should have `isMissingData = true` if data is missing for connection', () => {
        const UserQuery = graphql`
          query RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingForConnectionUserFriendsQuery {
            me {
              ...RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingForConnectionUserFriends
            }
          }
        `;

        const UserFriends = graphql`
          fragment RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingForConnectionUserFriends on User {
            id
            friends(first: 2) {
              edges {
                cursor
                node {
                  id
                }
              }
            }
          }
        `;

        const owner = createOperationDescriptor(UserQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserFriends, '2', {}, owner.request),
        );
        expect(data.id).toBe('2');
        expect(data.friends.edges).not.toBeDefined();
        expect(isMissingData).toBe(true);
      });

      it('should have `isMissingData = true` if data is missing for edge in the connection', () => {
        const UserQuery = graphql`
          query RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingForEdgeInTheConnectionUserQuery {
            me {
              ...RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingForEdgeInTheConnectionUserFriends
            }
          }
        `;

        const UserFriends = graphql`
          fragment RelayReaderTestShouldHaveIsmissingdataTrueIfDataIsMissingForEdgeInTheConnectionUserFriends on User {
            id
            friends(first: 1) {
              edges {
                cursor
                node {
                  id
                }
              }
            }
          }
        `;
        const owner = createOperationDescriptor(UserQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserFriends, '3', {}, owner.request),
        );
        expect(data.id).toBe('3');
        expect(data.friends.edges).toEqual([undefined]);
        expect(isMissingData).toBe(true);
      });

      it('should not have missing data if missing fields are client fields', () => {
        const UserQuery = graphql`
          query RelayReaderTestShouldNotHaveMissingDataIfMissingFieldsAreClientFieldsUserQuery(
            $size: [Int]
          ) {
            me {
              ...RelayReaderTestShouldNotHaveMissingDataIfMissingFieldsAreClientFieldsUserProfile
            }
          }
        `;

        const UserProfile = graphql`
          fragment RelayReaderTestShouldNotHaveMissingDataIfMissingFieldsAreClientFieldsUserProfile on User {
            id
            friends(first: 3) {
              client_friends_connection_field
              edges {
                cursor
                node {
                  id
                  firstName
                  client_foo {
                    client_name
                  }
                }
              }
            }
            nickname
            client_actor_field
            client_foo {
              client_name
              profile_picture(scale: 2) {
                uri
              }
            }
            # Top-level linked client field
            best_friends {
              edges {
                # Nested client field
                client_friend_edge_field
                cursor
                node {
                  id
                  # Nested inline fragment
                  ... on Actor {
                    client_actor_field
                    profilePicture(size: $size) {
                      uri
                      height
                      width
                    }
                  }
                }
              }
            }
            ... on Actor {
              client_actor_field
            }
          }
        `;
        // Extensions are defined in `relay-test-utils-internal/testschema-extensions.graphql`

        const owner = createOperationDescriptor(UserQuery, {size: 32});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserProfile, '1', {}, owner.request),
        );
        expect(data.id).toBe('1');
        expect(isMissingData).toBe(false);
      });

      it('should not consider data missing if the fragment type does not match the data', () => {
        const ActorQuery = graphql`
          query RelayReaderTestShouldNotConsiderDataMissingIfTheFragmentTypeDoesNotMatchTheDataActorQuery {
            viewer {
              actor {
                ...RelayReaderTestShouldNotConsiderDataMissingIfTheFragmentTypeDoesNotMatchTheDataUserProfile
                  @dangerously_unaliased_fixme
              }
            }
          }
        `;

        const UserProfile = graphql`
          fragment RelayReaderTestShouldNotConsiderDataMissingIfTheFragmentTypeDoesNotMatchTheDataUserProfile on User {
            name
          }
        `;

        source = new RelayRecordSource({
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            viewer: {__ref: 'client:root:viewer'},
          },
          'client:root:viewer': {
            __id: 'client:root:viewer',
            __typename: 'Viewer',
            actor: {__ref: '1'},
          },
          1: {
            __id: '1',
            __typename: 'Page',
            // NOTE: no 'name' value, server would not return one since
            // name is only selected if viewer.actor is a User, and it's
            // a Page
          },
        });
        const owner = createOperationDescriptor(ActorQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserProfile, '1', {}, owner.request),
        );
        expect(data).toEqual({
          name: undefined,
        });
        expect(isMissingData).toBe(false);
      });

      it('should consider data missing if the fragment type is abstract', () => {
        const ActorQuery = graphql`
          query RelayReaderTestShouldConsiderDataMissingIfTheFragmentTypeIsAbstractActorQuery {
            viewer {
              actor {
                ...RelayReaderTestShouldConsiderDataMissingIfTheFragmentTypeIsAbstractActorProfile
              }
            }
          }
        `;
        const ActorProfile = graphql`
          fragment RelayReaderTestShouldConsiderDataMissingIfTheFragmentTypeIsAbstractActorProfile on Actor {
            name
          }
        `;
        source = new RelayRecordSource({
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            viewer: {__ref: 'client:root:viewer'},
          },
          'client:root:viewer': {
            __id: 'client:root:viewer',
            __typename: 'Viewer',
            actor: {__ref: '1'},
          },
          1: {
            __id: '1',
            __typename: 'Page',
            __isActor: true,
            // NOTE: no 'name' value
          },
        });
        const owner = createOperationDescriptor(ActorQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(ActorProfile, '1', {}, owner.request),
        );
        expect(data).toEqual({
          name: undefined,
        });
        expect(isMissingData).toBe(true);
      });

      it('should consider data missing if the fragment is concrete but on the root', () => {
        const Query = graphql`
          query RelayReaderTestShouldConsiderDataMissingIfTheFragmentIsConcreteButOnTheRootQuery {
            ...RelayReaderTestShouldConsiderDataMissingIfTheFragmentIsConcreteButOnTheRootRootFragment
          }
        `;

        const RootFragment = graphql`
          fragment RelayReaderTestShouldConsiderDataMissingIfTheFragmentIsConcreteButOnTheRootRootFragment on Query {
            me {
              name
            }
          }
        `;

        source = new RelayRecordSource({
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            // No 'me' value
          },
        });
        const owner = createOperationDescriptor(Query, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(RootFragment, 'client:root', {}, owner.request),
        );
        expect(data).toEqual({
          me: undefined,
        });
        expect(isMissingData).toBe(true);
      });
    });

    describe('@stream_connection', () => {
      let UserQuery;
      let UserProfile;
      beforeEach(() => {
        UserProfile = graphql`
          fragment RelayReaderTestStreamConnectionUserProfile on User {
            friends(first: 3)
              @stream_connection(key: "UserProfile_friends", initial_count: 0) {
              edges {
                node {
                  name
                }
              }
            }
          }
        `;
        UserQuery = graphql`
          query RelayReaderTestStreamConnectionUserQuery($id: ID!) {
            node(id: $id) {
              ...RelayReaderTestStreamConnectionUserProfile
                @dangerously_unaliased_fixme
            }
          }
        `;
      });

      it('should not have missing data if all data is fetched', () => {
        const storeData = {
          1: {
            __id: '1',
            __typename: 'User',
            id: '1',
            __UserProfile_friends_connection: {__ref: 'client:1'},
          },
          2: {
            endCursor: '',
            hasNextPage: false,
          },
          'client:1': {
            __id: 'client:1',
            __typename: 'FriendsConnection',
            edges: {
              __refs: [],
            },
            pageInfo: {__ref: '2'},
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        };
        source = RelayRecordSource.create(storeData);
        const owner = createOperationDescriptor(UserQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserProfile, '1', {}, owner.request),
        );
        expect(isMissingData).toBe(false);
        expect(data).toEqual({
          friends: {
            edges: [],
            pageInfo: {
              endCursor: '',
              hasNextPage: false,
            },
          },
        });
      });

      it('should not have missing data when all edge data is fetched by pageInfo is missing', () => {
        const storeData = {
          1: {
            __id: '1',
            __typename: 'User',
            id: '1',
            __UserProfile_friends_connection: {__ref: 'client:1'},
          },
          2: {
            __id: '2',
            __typename: 'User',
            id: '2',
            name: 'Bob',
          },
          'client:2': {
            __id: 'client:2',
            __typename: 'FriendsConnectionEdge',
            cursor: 'cursor:2',
            node: {__ref: '2'},
          },
          'client:1': {
            __id: 'client:1',
            __typename: 'FriendsConnection',
            edges: {
              __refs: ['client:2'],
            },
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        };
        source = RelayRecordSource.create(storeData);
        const owner = createOperationDescriptor(UserQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserProfile, '1', {}, owner.request),
        );
        expect(isMissingData).toBe(false);
        expect(data).toEqual({
          friends: {
            edges: [
              {
                cursor: 'cursor:2',
                node: {
                  __typename: 'User',
                  name: 'Bob',
                },
              },
            ],
            pageInfo: undefined,
          },
        });
      });

      it('should have missing data if an edge is missing data', () => {
        const storeData = {
          1: {
            __id: '1',
            __typename: 'User',
            id: '1',
            __UserProfile_friends_connection: {__ref: 'client:1'},
          },
          'client:1': {
            __id: 'client:1',
            __typename: 'FriendsConnection',
            edges: {
              __refs: [undefined],
            },
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        };
        source = RelayRecordSource.create(storeData);
        const owner = createOperationDescriptor(UserQuery, {});
        const {data, isMissingData} = read(
          source,
          createReaderSelector(UserProfile, '1', {}, owner.request),
        );
        expect(isMissingData).toBe(true);
        expect(data).toEqual({
          friends: {
            edges: [undefined],
            pageInfo: undefined,
          },
        });
      });
    });
  });

  it('does not record a dependency on type records for abstract type discriminators', () => {
    const Query = graphql`
      query RelayReaderTestDoesNotRecordADependencyOnTypeRecordsForAbstractTypeDiscriminatorsQuery {
        me {
          ...RelayReaderTestDoesNotRecordADependencyOnTypeRecordsForAbstractTypeDiscriminatorsFragment
        }
      }
    `;
    const Fragment = graphql`
      fragment RelayReaderTestDoesNotRecordADependencyOnTypeRecordsForAbstractTypeDiscriminatorsFragment on Node {
        actor {
          ... on Entity {
            url
          }
        }
      }
    `;
    const userTypeID = generateTypeID('User');
    const pageTypeID = generateTypeID('Page');
    const data = {
      1: {
        __id: '1',
        __typename: 'User',
        actor: {__ref: '2'},
      },
      2: {
        __id: '2',
        __typename: 'Page',
        url: 'https://...',
      },
      [userTypeID]: {
        __id: userTypeID,
        __typename: TYPE_SCHEMA_TYPE,
        __isNode: true,
      },
      [pageTypeID]: {
        __id: pageTypeID,
        __typename: TYPE_SCHEMA_TYPE,
        // __isEntity: true, // intentionally missing to verify that type refinement feature is on
      },
    };
    source = RelayRecordSource.create(data);
    const owner = createOperationDescriptor(Query, {});
    const snapshot = read(
      source,
      createReaderSelector(Fragment, '1', {}, owner.request),
    );
    expect(snapshot.data).toEqual({
      actor: {
        url: 'https://...',
      },
    });
    expect(snapshot.isMissingData).toBe(true); // missing discriminator
    // does *not* include userTypeID/pageTypeID
    expect(Array.from(snapshot.seenRecords.values()).sort()).toEqual([
      '1',
      '2',
    ]);
  });
});
