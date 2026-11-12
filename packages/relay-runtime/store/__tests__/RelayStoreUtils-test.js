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
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
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

  describe('getStorageKey() caching', () => {
    const field = {
      kind: 'ScalarField',
      name: 'profilePicture',
      alias: null,
      args: [{kind: 'Variable', name: 'size', variableName: 'size'}],
      storageKey: null,
    };

    it('returns the key for the current variable values', () => {
      const variables = {size: [32, 64]};
      const stringify = jest.spyOn(JSON, 'stringify');
      const key = RelayStoreUtils.getStorageKey(field, variables);
      expect(key).toBe('profilePicture(size:[32,64])');
      expect(RelayStoreUtils.getStorageKey(field, variables)).toBe(key);
      // Formatting the key stringifies the argument value.
      expect(stringify).toHaveBeenCalledTimes(
        RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS ? 1 : 2,
      );
      stringify.mockRestore();
      expect(RelayStoreUtils.getStorageKey(field, {size: [128]})).toBe(
        'profilePicture(size:[128])',
      );
      expect(RelayStoreUtils.getStorageKey(field, {size: [32, 64]})).toBe(key);
      // Different variables objects with the same values.
      const sizes = [256];
      expect(RelayStoreUtils.getStorageKey(field, {size: sizes})).toBe(
        'profilePicture(size:[256])',
      );
      expect(
        RelayStoreUtils.getStorageKey(field, {size: sizes, other: 1}),
      ).toBe('profilePicture(size:[256])');
      expect(RelayStoreUtils.getStorageKey(field, {size: NaN})).toBe(
        'profilePicture(size:null)',
      );
      expect(RelayStoreUtils.getStorageKey(field, {size: NaN})).toBe(
        'profilePicture(size:null)',
      );
    });

    it('combines literal and variable arguments', () => {
      const mixedField = {
        kind: 'ScalarField',
        name: 'friends',
        alias: null,
        args: [
          {kind: 'Literal', name: 'first', value: 10},
          {kind: 'Variable', name: 'orderBy', variableName: 'order'},
        ],
        storageKey: null,
      };
      expect(RelayStoreUtils.getStorageKey(mixedField, {order: 'name'})).toBe(
        'friends(first:10,orderBy:"name")',
      );
      expect(RelayStoreUtils.getStorageKey(mixedField, {order: 'name'})).toBe(
        'friends(first:10,orderBy:"name")',
      );
      expect(RelayStoreUtils.getStorageKey(mixedField, {order: 'date'})).toBe(
        'friends(first:10,orderBy:"date")',
      );
    });

    it('returns the key for object arguments with variables', () => {
      const objectField = {
        kind: 'ScalarField',
        name: 'search',
        alias: null,
        args: [
          {
            kind: 'ObjectValue',
            name: 'filter',
            fields: [{kind: 'Variable', name: 'text', variableName: 'query'}],
          },
        ],
        storageKey: null,
      };
      const variables = {query: 'a'};
      expect(RelayStoreUtils.getStorageKey(objectField, variables)).toBe(
        'search(filter:{"text":"a"})',
      );
      expect(RelayStoreUtils.getStorageKey(objectField, variables)).toBe(
        'search(filter:{"text":"a"})',
      );
      expect(RelayStoreUtils.getStorageKey(objectField, {query: 'b'})).toBe(
        'search(filter:{"text":"b"})',
      );
    });

    it('keeps the keys of fields read with the same variables object apart', () => {
      const otherField = {
        ...field,
        name: 'coverPhoto',
        args: [{kind: 'Variable', name: 'width', variableName: 'width'}],
      };
      const variables = {size: [32], width: 100};
      expect(RelayStoreUtils.getStorageKey(field, variables)).toBe(
        'profilePicture(size:[32])',
      );
      expect(RelayStoreUtils.getStorageKey(otherField, variables)).toBe(
        'coverPhoto(width:100)',
      );
      expect(RelayStoreUtils.getStorageKey(field, variables)).toBe(
        'profilePicture(size:[32])',
      );
    });

    it('returns the key for each value of a variable in fresh variables objects', () => {
      const nicknameField = {
        kind: 'ScalarField',
        name: 'nickname',
        alias: null,
        args: [
          {kind: 'Literal', name: 'format', value: 'short'},
          {kind: 'Variable', name: 'lang', variableName: 'lang'},
        ],
        storageKey: null,
      };
      for (let round = 0; round < 2; round++) {
        for (const lang of ['1', 1, true, 'en', 'fr', 'en']) {
          expect(RelayStoreUtils.getStorageKey(nicknameField, {lang})).toBe(
            `nickname(format:"short",lang:${JSON.stringify(lang)})`,
          );
        }
      }
      // More values than are kept per field.
      for (let ii = 0; ii < 1100; ii++) {
        expect(
          RelayStoreUtils.getStorageKey(nicknameField, {lang: `lang${ii}`}),
        ).toBe(`nickname(format:"short",lang:"lang${ii}")`);
      }
      expect(
        RelayStoreUtils.getStorageKey(nicknameField, {lang: 'lang0'}),
      ).toBe('nickname(format:"short",lang:"lang0")');
      expect(RelayStoreUtils.getStorageKey(nicknameField, {lang: null})).toBe(
        'nickname(format:"short")',
      );
      expect(RelayStoreUtils.getStorageKey(nicknameField, {lang: 'en'})).toBe(
        'nickname(format:"short",lang:"en")',
      );
    });

    it('returns the key for equal arrays and objects in fresh variables objects', () => {
      const insightsField = {
        kind: 'ScalarField',
        name: 'insights',
        alias: null,
        args: [
          {kind: 'Variable', name: 'breakdowns', variableName: 'breakdowns'},
          {kind: 'Variable', name: 'range', variableName: 'range'},
        ],
        storageKey: null,
      };
      const key = (breakdowns: unknown, range: unknown) =>
        RelayStoreUtils.getStorageKey(insightsField, {breakdowns, range});
      for (let round = 0; round < 2; round++) {
        expect(key(['age', 'gender'], {since: 1, until: 2})).toBe(
          'insights(breakdowns:["age","gender"],range:{"since":1,"until":2})',
        );
        expect(key(['age', 'gender'], {until: 2, since: 1})).toBe(
          'insights(breakdowns:["age","gender"],range:{"since":1,"until":2})',
        );
        expect(key(['gender', 'age'], {since: 1, until: 2})).toBe(
          'insights(breakdowns:["gender","age"],range:{"since":1,"until":2})',
        );
        expect(key(['gender'], {since: 1, until: 2})).toBe(
          'insights(breakdowns:["gender"],range:{"since":1,"until":2})',
        );
        expect(key(['gender'], {since: 1})).toBe(
          'insights(breakdowns:["gender"],range:{"since":1})',
        );
        expect(key(['gender'], {since: 1, until: undefined})).toBe(
          'insights(breakdowns:["gender"],range:{"since":1})',
        );
        expect(key({0: 'gender'}, {since: 1})).toBe(
          'insights(breakdowns:{"0":"gender"},range:{"since":1})',
        );
        expect(key([['gender']], {since: [1]})).toBe(
          'insights(breakdowns:[["gender"]],range:{"since":[1]})',
        );
        expect(key([['age']], {since: [2]})).toBe(
          'insights(breakdowns:[["age"]],range:{"since":[2]})',
        );
      }
    });

    it('returns the key for variables within object and list arguments in fresh variables objects', () => {
      const insightsField = {
        kind: 'ScalarField',
        name: 'insights',
        alias: null,
        args: [
          {
            kind: 'ListValue',
            name: 'filtering',
            items: [
              {
                kind: 'ObjectValue',
                name: 'filtering.0',
                fields: [
                  {kind: 'Literal', name: 'field', value: 'spend'},
                  {kind: 'Variable', name: 'value', variableName: 'minSpend'},
                ],
              },
            ],
          },
          {kind: 'Literal', name: 'level', value: 'ad'},
          {
            kind: 'ObjectValue',
            name: 'time_range',
            fields: [
              {kind: 'Variable', name: 'since', variableName: 'since'},
              {kind: 'Variable', name: 'until', variableName: 'until'},
            ],
          },
        ],
        storageKey: null,
      };
      const key = (since: unknown, until: unknown, minSpend: unknown) =>
        RelayStoreUtils.getStorageKey(insightsField, {minSpend, since, until});
      for (let round = 0; round < 2; round++) {
        expect(key('2026-10-01', '2026-10-07', 10)).toBe(
          'insights(filtering:[{"field":"spend","value":10}],level:"ad",time_range:{"since":"2026-10-01","until":"2026-10-07"})',
        );
        expect(key('2026-10-01', '2026-10-07', 10)).toBe(
          'insights(filtering:[{"field":"spend","value":10}],level:"ad",time_range:{"since":"2026-10-01","until":"2026-10-07"})',
        );
        expect(key('2026-10-01', '2026-10-08', 10)).toBe(
          'insights(filtering:[{"field":"spend","value":10}],level:"ad",time_range:{"since":"2026-10-01","until":"2026-10-08"})',
        );
        expect(key('2026-10-01', '2026-10-08', 20)).toBe(
          'insights(filtering:[{"field":"spend","value":20}],level:"ad",time_range:{"since":"2026-10-01","until":"2026-10-08"})',
        );
        expect(key('2026-10-01', '2026-10-08', [20])).toBe(
          'insights(filtering:[{"field":"spend","value":[20]}],level:"ad",time_range:{"since":"2026-10-01","until":"2026-10-08"})',
        );
        expect(key('2026-10-01', '2026-10-08', [30])).toBe(
          'insights(filtering:[{"field":"spend","value":[30]}],level:"ad",time_range:{"since":"2026-10-01","until":"2026-10-08"})',
        );
      }
      expect(key('2026-10-01', undefined, 10)).toBe(
        'insights(filtering:[{"field":"spend","value":10}],level:"ad",time_range:{"since":"2026-10-01"})',
      );
      expect(key('2026-10-01', '2026-10-08', 10)).toBe(
        'insights(filtering:[{"field":"spend","value":10}],level:"ad",time_range:{"since":"2026-10-01","until":"2026-10-08"})',
      );
    });

    it('returns the key for a value read again after a null value', () => {
      const nodeField = {
        kind: 'LinkedField',
        name: 'node',
        alias: null,
        args: [{kind: 'Variable', name: 'id', variableName: 'id'}],
        concreteType: null,
        plural: false,
        selections: [],
        storageKey: null,
      };
      for (const id of ['1', null, '1', null]) {
        expect(RelayStoreUtils.getStorageKey(nodeField, {id})).toBe(
          id == null ? 'node' : `node(id:"${id}")`,
        );
      }
    });

    it('returns the key for object arguments with variables next to a variable argument', () => {
      const itemsField = {
        kind: 'ScalarField',
        name: 'items',
        alias: null,
        args: [
          {
            kind: 'ObjectValue',
            name: 'filter',
            fields: [{kind: 'Variable', name: 'name', variableName: 'name'}],
          },
          {kind: 'Variable', name: 'first', variableName: 'count'},
        ],
        storageKey: null,
      };
      for (const name of ['a', 'b', 'a']) {
        expect(
          RelayStoreUtils.getStorageKey(itemsField, {count: 5, name}),
        ).toBe(`items(filter:{"name":"${name}"},first:5)`);
      }
    });

    it('returns the key for an object variable that is null in between', () => {
      const searchField = {
        kind: 'ScalarField',
        name: 'search',
        alias: null,
        args: [{kind: 'Variable', name: 'filter', variableName: 'filter'}],
        storageKey: null,
      };
      for (const filter of [{text: 'a'}, null, {text: 'a'}, null]) {
        expect(RelayStoreUtils.getStorageKey(searchField, {filter})).toBe(
          filter == null ? 'search' : 'search(filter:{"text":"a"})',
        );
      }
    });

    it('returns the key for lists with empty slots as JSON formats them', () => {
      const itemsField = {
        kind: 'ScalarField',
        name: 'items',
        alias: null,
        args: [{kind: 'Variable', name: 'ids', variableName: 'ids'}],
        storageKey: null,
      };
      const friendsHandle = {
        kind: 'LinkedHandle',
        name: 'friends',
        alias: null,
        args: [{kind: 'Variable', name: 'ids', variableName: 'ids'}],
        handle: 'connection',
        key: 'Q_friends',
        filters: ['ids'],
        dynamicKey: null,
      };
      const withEmptySlot: Array<string> = ['a'];
      withEmptySlot.length = 2;
      const emptySlots: Array<string> = new Array(2);
      for (let round = 0; round < 2; round++) {
        for (const [ids, value] of [
          [['a'], '["a"]'],
          [withEmptySlot, '["a",null]'],
          [[], '[]'],
          [emptySlots, '[null,null]'],
        ]) {
          expect(RelayStoreUtils.getStorageKey(itemsField, {ids})).toBe(
            'items(ids:' + value + ')',
          );
          expect(
            RelayStoreUtils.getHandleStorageKey(friendsHandle, {ids}),
          ).toBe('__Q_friends_connection(ids:' + value + ')');
        }
      }
    });

    it('still throws for undefined variables', () => {
      expect(() => RelayStoreUtils.getStorageKey(field, {})).toThrow(
        'getVariableValue(): Undefined variable `size`.',
      );
      expect(RelayStoreUtils.getStorageKey(field, {size: undefined})).toBe(
        'profilePicture',
      );
      expect(() => RelayStoreUtils.getStorageKey(field, {})).toThrow(
        'getVariableValue(): Undefined variable `size`.',
      );
      expect(RelayStoreUtils.getStorageKey(field, {size: 1})).toBe(
        'profilePicture(size:1)',
      );
      expect(() => RelayStoreUtils.getStorageKey(field, {})).toThrow(
        'getVariableValue(): Undefined variable `size`.',
      );
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

  describe('getModuleComponentKey() and getModuleOperationKey()', () => {
    it('return the record keys of a @module document, also when called again', () => {
      for (let ii = 0; ii < 2; ii++) {
        expect(
          RelayStoreUtils.getModuleComponentKey(
            'Foo_user$normalization.graphql',
          ),
        ).toBe('__module_component_Foo_user$normalization.graphql');
        expect(
          RelayStoreUtils.getModuleOperationKey(
            'Foo_user$normalization.graphql',
          ),
        ).toBe('__module_operation_Foo_user$normalization.graphql');
      }
      expect(
        RelayStoreUtils.getModuleComponentKey('Bar_user$normalization.graphql'),
      ).toBe('__module_component_Bar_user$normalization.graphql');
      expect(
        RelayStoreUtils.getModuleOperationKey('Bar_user$normalization.graphql'),
      ).toBe('__module_operation_Bar_user$normalization.graphql');
    });
  });
});
