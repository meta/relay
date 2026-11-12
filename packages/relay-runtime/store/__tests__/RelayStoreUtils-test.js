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

const {graphql} = require('../../query/GraphQLTag');
const RelayStoreUtils = require('../RelayStoreUtils');

describe('RelayStoreUtils', () => {
  describe('getArgumentValues()', () => {
    it('returns argument values', () => {
      const UserFragment = graphql`
        fragment RelayStoreUtilsTest1Fragment on User {
          friends(orderby: $order, first: 10) {
            count
          }
        }
      `;
      const field = UserFragment.selections[0];
      const variables = {order: 'name'};
      expect(RelayStoreUtils.getArgumentValues(field.args, variables)).toEqual({
        first: 10,
        orderby: 'name',
      });
    });

    it('supports a variable named hasOwnProperty', () => {
      expect(
        RelayStoreUtils.getArgumentValues(
          [
            {
              kind: 'Variable',
              name: 'size',
              variableName: 'hasOwnProperty',
            },
          ],
          {hasOwnProperty: 256},
        ),
      ).toEqual({size: 256});
    });
  });

  describe('getStorageKey()', () => {
    it('uses the field name when there are no arguments', () => {
      const UserFragment = graphql`
        fragment RelayStoreUtilsTest2Fragment on User {
          name
        }
      `;
      const field = UserFragment.selections[0];
      expect(RelayStoreUtils.getStorageKey(field, {})).toBe('name');
    });

    it('embeds literal argument values', () => {
      const UserFragment = graphql`
        fragment RelayStoreUtilsTest3Fragment on User {
          profilePicture(size: 128) {
            uri
          }
        }
      `;
      const field = UserFragment.selections[0];
      expect(RelayStoreUtils.getStorageKey(field, {})).toBe(
        'profilePicture(size:128)',
      );
    });

    it('embeds variable values', () => {
      const UserFragment = graphql`
        fragment RelayStoreUtilsTest4Fragment on User
        @argumentDefinitions(size: {type: "[Int]"}) {
          profilePicture(size: $size) {
            uri
          }
        }
      `;
      const field = UserFragment.selections[0];
      expect(RelayStoreUtils.getStorageKey(field, {size: 256})).toBe(
        'profilePicture(size:256)',
      );
    });

    it('filters out arguments that are unset', () => {
      const UserFragment = graphql`
        fragment RelayStoreUtilsTest5Fragment on User
        @argumentDefinitions(
          preset: {type: "PhotoSize"}
          size: {type: "[Int]"}
        ) {
          profilePicture(preset: $preset, size: $size) {
            uri
          }
        }
      `;
      const field = UserFragment.selections[0];
      expect(
        RelayStoreUtils.getStorageKey(field, {preset: null, size: 128}),
      ).toBe('profilePicture(size:128)');
    });

    it('suppresses the argument list if all values are unset', () => {
      const UserFragment = graphql`
        fragment RelayStoreUtilsTest6Fragment on User
        @argumentDefinitions(
          preset: {type: "PhotoSize"}
          size: {type: "[Int]"}
        ) {
          profilePicture(preset: $preset, size: $size) {
            uri
          }
        }
      `;
      const field = UserFragment.selections[0];
      expect(
        RelayStoreUtils.getStorageKey(field, {preset: null, size: null}),
      ).toBe('profilePicture');
    });

    it('imposes a stable ordering within object arguments', () => {
      const UserFragment = graphql`
        fragment RelayStoreUtilsTest7Fragment on User {
          # Pass in arguments reverse-lexicographical order.
          storySearch(query: {text: "foo", offset: 100, limit: 10}) {
            id
          }
        }
      `;
      const field = UserFragment.selections[0];

      // Note that storage key employs stable lexicographical ordering anyway.
      expect(RelayStoreUtils.getStorageKey(field, {})).toBe(
        'storySearch(query:{"limit":10,"offset":100,"text":"foo"})',
      );
    });

    it('supports complex objects', () => {
      const UserFragment = graphql`
        fragment RelayStoreUtilsTest8Fragment on User {
          # Pass in arguments reverse-lexicographical order.
          storySearch(query: {text: $foo, offset: 100, limit: 10}) {
            id
          }
        }
      `;
      const field = UserFragment.selections[0];

      // Note that storage key employs stable lexicographical ordering anyway.
      expect(
        RelayStoreUtils.getStorageKey(field, {
          foo: 'Foo Text',
        }),
      ).toBe('storySearch(query:{"limit":10,"offset":100,"text":"Foo Text"})');
    });
  });

  describe('getReadTimeResolverStorageKey()', () => {
    const resolverField = (args, fragmentArgs) => ({
      kind: 'RelayResolver',
      name: 'greeting',
      args,
      fragment:
        fragmentArgs === undefined
          ? null
          : {kind: 'FragmentSpread', name: 'Fragment', args: fragmentArgs},
      storageKey: null,
      isOutputType: false,
      resolverModule: () => null,
      path: 'greeting',
    });

    it('prefixes keys and reuses the key of fields without variables', () => {
      const field = resolverField([
        {kind: 'Literal', name: 'salutation', value: 'Hello'},
      ]);
      const first = RelayStoreUtils.getReadTimeResolverStorageKey(field, {});
      expect(first).toBe('$r:greeting(salutation:"Hello")');
      expect(RelayStoreUtils.getReadTimeResolverStorageKey(field, {a: 1})).toBe(
        first,
      );
    });

    it('recomputes keys that depend on variables', () => {
      const field = resolverField(
        [{kind: 'Literal', name: 'salutation', value: 'Hello'}],
        [
          {
            kind: 'ObjectValue',
            name: 'filter',
            fields: [{kind: 'Variable', name: 'id', variableName: 'id'}],
          },
        ],
      );
      expect(
        RelayStoreUtils.getReadTimeResolverStorageKey(field, {id: '1'}),
      ).toBe('$r:greeting(salutation:"Hello",filter:{"id":"1"})');
      expect(
        RelayStoreUtils.getReadTimeResolverStorageKey(field, {id: '2'}),
      ).toBe('$r:greeting(salutation:"Hello",filter:{"id":"2"})');
    });

    it('recomputes keys of list arguments that contain variables', () => {
      const field = resolverField([
        {
          kind: 'ListValue',
          name: 'ids',
          items: [{kind: 'Variable', name: 'ids.0', variableName: 'id'}],
        },
      ]);
      expect(
        RelayStoreUtils.getReadTimeResolverStorageKey(field, {id: '1'}),
      ).toBe('$r:greeting(ids:["1"])');
      expect(
        RelayStoreUtils.getReadTimeResolverStorageKey(field, {id: '2'}),
      ).toBe('$r:greeting(ids:["2"])');
    });
  });

  describe('getStableStorageKey()', () => {
    it('imposes a stable ordering', () => {
      const fieldName = 'foo';
      const argValues = {
        first: 10,
        orderBy: ['name', 'age', 'date'],
        filter: {
          minSize: 200,
          color: 'red',
          maxCost: 20,
        },
      };
      expect(RelayStoreUtils.getStableStorageKey(fieldName, argValues)).toBe(
        'foo(filter:{"color":"red","maxCost":20,"minSize":200},' +
          'first:10,orderBy:["name","age","date"])',
      );
    });

    it('filters arguments without values', () => {
      const fieldName = 'foo';
      const argValues = {
        first: 10,
        orderBy: null,
      };
      expect(RelayStoreUtils.getStableStorageKey(fieldName, argValues)).toBe(
        'foo(first:10)',
      );
    });

    it('suppresses the argument list if all values are unset', () => {
      const fieldName = 'foo';
      const argValues = {
        first: undefined,
        orderBy: null,
      };
      expect(RelayStoreUtils.getStableStorageKey(fieldName, argValues)).toBe(
        'foo',
      );
    });

    it('disregards a null or undefined arguments object', () => {
      expect(RelayStoreUtils.getStableStorageKey('foo')).toBe('foo');
      expect(RelayStoreUtils.getStableStorageKey('bar', null)).toBe('bar');
    });

    it('supports an argument named hasOwnProperty', () => {
      expect(
        RelayStoreUtils.getStableStorageKey('foo', {hasOwnProperty: 1}),
      ).toBe('foo(hasOwnProperty:1)');
    });
  });

  describe('getHandleStorageKey', () => {
    it('creates a key with no arguments', () => {
      const UserQuery = graphql`
        query RelayStoreUtilsTest1Query {
          me {
            address
              @__clientField(
                key: "UserQuery_address"
                handle: "addressHandler"
              ) {
              city
            }
          }
        }
      `;
      const handle = UserQuery.operation.selections[0].selections.find(
        selection => selection.kind === 'LinkedHandle',
      );
      const key = RelayStoreUtils.getHandleStorageKey(handle, {});
      expect(key).toBe('__UserQuery_address_addressHandler');
    });

    it('creates a key with arguments', () => {
      const UserQuery = graphql`
        query RelayStoreUtilsTest2Query {
          me {
            profile_picture(scale: 42)
              @__clientField(
                key: "UserQuery_profile_picture"
                handle: "photoHandler"
              ) {
              uri
            }
          }
        }
      `;
      const handle = UserQuery.operation.selections[0].selections.find(
        selection => selection.kind === 'LinkedHandle',
      );
      const key = RelayStoreUtils.getHandleStorageKey(handle, {});
      expect(key).toBe('__UserQuery_profile_picture_photoHandler');
    });

    it('creates a key with arguments and filters', () => {
      const UserQuery = graphql`
        query RelayStoreUtilsTest3Query {
          me {
            profile_picture(scale: 42)
              @__clientField(
                key: "UserQuery_profile_picture"
                handle: "photoHandler"
                filters: ["scale"]
              ) {
              uri
            }
          }
        }
      `;
      const handle = UserQuery.operation.selections[0].selections.find(
        selection => selection.kind === 'LinkedHandle',
      );
      const key = RelayStoreUtils.getHandleStorageKey(handle, {});
      expect(key).toBe('__UserQuery_profile_picture_photoHandler(scale:42)');
    });

    it('creates a dynamic connection key', () => {
      const UserQuery = graphql`
        query RelayStoreUtilsTest4Query(
          $count: Int!
          $cursor: ID
          $dynamicKey: String!
        ) {
          me {
            friends(after: $cursor, first: $count)
              @connection(
                key: "UserQuery_friends"
                dynamicKey_UNSTABLE: $dynamicKey
              ) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `;
      const handle = UserQuery.operation.selections[0].selections.find(
        selection => selection.kind === 'LinkedHandle',
      );
      const key = RelayStoreUtils.getHandleStorageKey(handle, {
        count: 5,
        cursor: null,
        dynamicKey: 'xyz',
      });
      expect(key).toBe('__UserQuery_friends_connection(__dynamicKey:"xyz")');
    });

    it('creates a dynamic connection key with filters', () => {
      const UserQuery = graphql`
        query RelayStoreUtilsTest5Query(
          $count: Int!
          $cursor: ID
          $dynamicKey: String!
        ) {
          me {
            friends(after: $cursor, first: $count, orderby: ["name"])
              @connection(
                key: "UserQuery_friends"
                dynamicKey_UNSTABLE: $dynamicKey
                filters: ["orderby"]
              ) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `;
      const variables = {
        count: 5,
        cursor: null,
        dynamicKey: 'xyz',
      };
      const handle = UserQuery.operation.selections[0].selections.find(
        selection => selection.kind === 'LinkedHandle',
      );
      const normalizationKey = RelayStoreUtils.getHandleStorageKey(
        handle,
        variables,
      );
      expect(normalizationKey).toBe(
        '__UserQuery_friends_connection(__dynamicKey:"xyz",orderby:["name"])',
      );
      const field = UserQuery.fragment.selections
        .find(
          selection =>
            selection.kind === 'LinkedField' && selection.name === 'me',
        )
        .selections.find(
          selection =>
            selection.kind === 'LinkedField' && selection.alias === 'friends',
        );
      expect(field).not.toBe(null);
      const readerKey = RelayStoreUtils.getStorageKey(field, variables);
      expect(readerKey).toBe(normalizationKey);
    });
  });
});
