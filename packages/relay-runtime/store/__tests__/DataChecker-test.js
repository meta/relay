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
import type {NormalizationLinkedField} from '../../util/NormalizationNode';
import type {ReaderLinkedField} from '../../util/ReaderNode';
import type {DataID, Variables} from '../../util/RelayRuntimeTypes';
import type {
  ReadOnlyRecordProxy,
  ReadOnlyRecordSourceProxy,
  RecordSourceJSON,
} from '../RelayStoreTypes';
import type {
  DataCheckerTest6Query$data,
  DataCheckerTest6Query$variables,
} from './__generated__/DataCheckerTest6Query.graphql';
import type {
  DataCheckerTest9Query$data,
  DataCheckerTest9Query$variables,
} from './__generated__/DataCheckerTest9Query.graphql';
import type {
  DataCheckerTestQuery$data,
  DataCheckerTestQuery$variables,
} from './__generated__/DataCheckerTestQuery.graphql';
import type {Query as $IMPORTED_TYPE$_Query} from 'relay-runtime/util/RelayRuntimeTypes';

const {
  INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
} = require('../../multi-actor-environment/ActorIdentifier');
const RelayRecordSourceProxy = require('../../mutations/RelayRecordSourceProxy');
const {
  RelayRecordSourceProxyOptimized,
} = require('../../mutations/RelayRecordSourceProxyOptimized');
const {getRequest, graphql} = require('../../query/GraphQLTag');
const getRelayHandleKey = require('../../util/getRelayHandleKey');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const {check} = require('../DataChecker');
const defaultGetDataID = require('../defaultGetDataID');
const {createNormalizationSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {ROOT_ID} = require('../RelayStoreUtils');
const {TYPE_SCHEMA_TYPE, generateTypeID} = require('../TypeID');
const {createMockEnvironment} = require('relay-test-utils-internal');

// A `fetch__Type(id:)`-style missing field handler: it resolves a root field
// to the stored record of its `id` argument, which it gets from the store.
function handleNodeFromStore(
  field: NormalizationLinkedField | ReaderLinkedField,
  record: ?ReadOnlyRecordProxy,
  argValues: Variables,
  store: ReadOnlyRecordSourceProxy,
): ?DataID {
  const id = argValues.id;
  if (field.name !== 'node' || typeof id !== 'string') {
    return undefined;
  }
  return store.get(id)?.getDataID();
}

// TODO:
// You may see some of the "__FlowFixMe__" in the calls to `createNormalizationSelector`.
// This is because in this test we're relying on similarities between Reader and Normalization nodes during runtime.
// This is not correct, and Flow is reporting these errors correctly. We need to prioritize fixing this.

describe('check()', () => {
  let Query:
    | $IMPORTED_TYPE$_Query<
        DataCheckerTest6Query$variables,
        DataCheckerTest6Query$data,
      >
    | $IMPORTED_TYPE$_Query<
        DataCheckerTest9Query$variables,
        DataCheckerTest9Query$data,
      >
    | $IMPORTED_TYPE$_Query<
        DataCheckerTestQuery$variables,
        DataCheckerTestQuery$data,
      >;
  let sampleData: RecordSourceJSON;
  beforeEach(() => {
    sampleData = {
      '1': {
        __id: '1',
        __typename: 'User',
        firstName: 'Alice',
        'friends(first:3)': {__ref: 'client:1'},
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:4'},
      },
      '2': {
        __id: '2',
        __typename: 'User',
        firstName: 'Bob',
        id: '2',
      },
      '3': {
        __id: '3',
        __typename: 'User',
        firstName: 'Claire',
        id: '3',
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
    Query = graphql`
      query DataCheckerTestQuery($id: ID, $size: [Int]) {
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
  });

  it('reads query data', () => {
    const source = RelayRecordSource.create(sampleData);
    const target = RelayRecordSource.create();
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
        id: '1',
        size: 32,
      }),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'available',
    });
    expect(target.size()).toBe(0);
  });

  it('reads fragment data', () => {
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        firstName: 'Alice',
        'friends(first:1)': {__ref: 'client:1'},
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:3'},
      },
      '2': {
        __id: '2',
        __typename: 'User',
        firstName: 'Bob',
        id: '2',
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
      'client:3': {
        __id: 'client:3',
        __typename: 'Photo',
        uri: 'https://...',
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    const BarFragment = graphql`
      fragment DataCheckerTestFragment on User
      @argumentDefinitions(size: {type: "[Int]"}) {
        id
        firstName
        friends(first: 1) {
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
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(BarFragment as $FlowFixMe, '1', {
        size: 32,
      }),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'available',
    });
    expect(target.size()).toBe(0);
  });

  it('reads handle fields in fragment', () => {
    const handleKey = getRelayHandleKey('test', null, 'profilePicture');
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        // $FlowFixMe[invalid-computed-prop]
        [handleKey]: {__ref: 'client:3'},
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:1'},
      },
      'client:1': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:3': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    const Fragment = graphql`
      fragment DataCheckerTest1Fragment on User {
        profilePicture(size: 32) @__clientField(handle: "test") {
          uri
        }
      }
    `;
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(Fragment as $FlowFixMe, '1', {}),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'available',
    });
    expect(target.size()).toBe(0);
  });

  it('reads handle fields in fragment and checks missing', () => {
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:1'},
        // missing [handleKey] field
      },
      'client:1': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:3': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    const Fragment = graphql`
      fragment DataCheckerTest2Fragment on User {
        profilePicture(size: 32) @__clientField(handle: "test") {
          uri
        }
      }
    `;
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(Fragment as $FlowFixMe, '1', {}),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'missing',
    });
    expect(target.size()).toBe(0);
  });

  it('reads handle fields in fragment and checks missing sub field', () => {
    const handleKey = getRelayHandleKey('test', null, 'profilePicture');
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        // $FlowFixMe[invalid-computed-prop]
        [handleKey]: {__ref: 'client:3'},
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:1'},
      },
      'client:1': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:3': {
        __id: 'client:2',
        __typename: 'Photo',
        // uri field is missing
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    const Fragment = graphql`
      fragment DataCheckerTest3Fragment on User {
        profilePicture(size: 32) @__clientField(handle: "test") {
          uri
        }
      }
    `;
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(Fragment as $FlowFixMe, '1', {}),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'missing',
    });
    expect(target.size()).toBe(0);
  });

  it('reads handle fields in operation', () => {
    const handleKey = getRelayHandleKey('test', null, 'profilePicture');
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        // $FlowFixMe[invalid-computed-prop]
        [handleKey]: {__ref: 'client:3'},
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:1'},
      },
      'client:1': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:3': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    // LinkedHandle selectors are only generated for a the normalization
    // code for a query
    const ProfilePictureQuery = graphql`
      query DataCheckerTest1Query {
        me {
          profilePicture(size: 32) @__clientField(handle: "test") {
            uri
          }
        }
      }
    `;

    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(
        getRequest(ProfilePictureQuery).operation,
        'client:root',
        {},
      ),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'available',
    });
    expect(target.size()).toBe(0);
  });

  it('reads handle fields in operation and checks missing', () => {
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:1'},
        // missing [handleKey] field
      },
      'client:1': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:3': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    // LinkedHandle selectors are only generated for a the normalization
    // code for a query
    const ProfilePictureQuery = graphql`
      query DataCheckerTest7Query {
        me {
          profilePicture(size: 32) @__clientField(handle: "test") {
            uri
          }
        }
      }
    `;
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(
        getRequest(ProfilePictureQuery).operation,
        'client:root',
        {},
      ),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'missing',
    });
    expect(target.size()).toBe(0);
  });

  it('reads handle fields in operation and checks missing sub field', () => {
    const handleKey = getRelayHandleKey('test', null, 'profilePicture');
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        // $FlowFixMe[invalid-computed-prop]
        [handleKey]: {__ref: 'client:3'},
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:1'},
      },
      'client:1': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
      },
      'client:3': {
        __id: 'client:2',
        __typename: 'Photo',
        // uri field is missing
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    // LinkedHandle selectors are only generated for a the normalization
    // code for a query
    const ProfilePictureQuery = graphql`
      query DataCheckerTest8Query {
        me {
          profilePicture(size: 32) @__clientField(handle: "test") {
            uri
          }
        }
      }
    `;
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(
        getRequest(ProfilePictureQuery).operation,
        'client:root',
        {},
      ),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'missing',
    });
    expect(target.size()).toBe(0);
  });

  it('reads scalar handle fields in operation and checks presence', () => {
    const handleKey = getRelayHandleKey('test', null, 'uri');
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:1'},
      },
      'client:1': {
        __id: 'client:2',
        __typename: 'Photo',
        // $FlowFixMe[invalid-computed-prop]
        [handleKey]: 'https://...',
        uri: 'https://...',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    // ScalarHandle selectors are only generated for a the normalization
    // code for a query
    const ProfilePictureQuery = graphql`
      query DataCheckerTest2Query {
        me {
          profilePicture(size: 32) {
            uri @__clientField(handle: "test")
          }
        }
      }
    `;
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(
        getRequest(ProfilePictureQuery).operation,
        'client:root',
        {},
      ),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'available',
    });
    expect(target.size()).toBe(0);
  });

  it('reads scalar handle fields in operation and checks missing', () => {
    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        'profilePicture(size:32)': {__ref: 'client:1'},
      },
      'client:1': {
        __id: 'client:2',
        __typename: 'Photo',
        uri: 'https://...',
        // [handleKey] field is missing
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    // ScalarHandle selectors are only generated for a the normalization
    // code for a query
    const ProfilePictureQuery = graphql`
      query DataCheckerTest3Query {
        me {
          profilePicture(size: 32) {
            uri @__clientField(handle: "test")
          }
        }
      }
    `;

    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(
        getRequest(ProfilePictureQuery).operation,
        'client:root',
        {},
      ),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'missing',
    });
    expect(target.size()).toBe(0);
  });

  describe('when @match directive is present', () => {
    let BarQuery;
    let loader;

    beforeEach(() => {
      const DataCheckerTestPlainUserNameRenderer_nameFragment = graphql`
        fragment DataCheckerTestPlainUserNameRenderer_nameFragment on PlainUserNameRenderer {
          plaintext
          data {
            text
          }
        }
      `;
      const DataCheckerTestMarkdownUserNameRenderer_nameFragment = graphql`
        fragment DataCheckerTestMarkdownUserNameRenderer_nameFragment on MarkdownUserNameRenderer {
          markdown
          data {
            markup
          }
        }
      `;

      graphql`
        fragment DataCheckerTest4Fragment on User {
          id
          nameRenderer @match {
            ...DataCheckerTestPlainUserNameRenderer_nameFragment
              @module(name: "PlainUserNameRenderer.react")
            ...DataCheckerTestMarkdownUserNameRenderer_nameFragment
              @module(name: "MarkdownUserNameRenderer.react")
          }
        }
      `;

      BarQuery = graphql`
        query DataCheckerTest4Query($id: ID!) {
          node(id: $id) {
            ...DataCheckerTest4Fragment @dangerously_unaliased_fixme
          }
        }
      `;
      const nodes = {
        DataCheckerTestMarkdownUserNameRenderer_nameFragment,
        DataCheckerTestPlainUserNameRenderer_nameFragment,
      };

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

    it('returns true when the match field/record exist and match a supported type (plaintext)', () => {
      // When the type matches PlainUserNameRenderer
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          'nameRenderer(supported:"34hjiS")': {
            __ref: 'client:1:nameRenderer(supported:"34hjiS")',
          },
        },
        'client:1:nameRenderer(supported:"34hjiS")': {
          __id: 'client:1:nameRenderer(supported:"34hjiS")',
          __module_component_DataCheckerTest4Fragment:
            'PlainUserNameRenderer.react',
          __module_operation_DataCheckerTest4Fragment:
            'DataCheckerTestPlainUserNameRenderer_nameFragment$normalization.graphql',
          __typename: 'PlainUserNameRenderer',
          data: {__ref: 'data'},
          plaintext: 'plain name',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'PlainUserNameData',
          id: 'data',
          text: 'text',
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      expect(loader.get).toBeCalledTimes(1);
      expect(loader.get.mock.calls[0][0]).toBe(
        'DataCheckerTestPlainUserNameRenderer_nameFragment$normalization.graphql',
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });

    it('returns true when the match field/record exist and match a supported type (markdown)', () => {
      // When the type matches MarkdownUserNameRenderer
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          'nameRenderer(supported:"34hjiS")': {
            __ref: 'client:1:nameRenderer(supported:"34hjiS")',
          },
        },
        'client:1:nameRenderer(supported:"34hjiS")': {
          __id: 'client:1:nameRenderer(supported:"34hjiS")',
          __module_component_DataCheckerTest4Fragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_DataCheckerTest4Fragment:
            'DataCheckerTestMarkdownUserNameRenderer_nameFragment$normalization.graphql',
          __typename: 'MarkdownUserNameRenderer',
          data: {__ref: 'data'},
          markdown: 'markdown payload',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'MarkdownUserNameData',
          id: 'data',
          markup: '<markup/>',
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when the match field/record exist but the matched fragment has not been processed', () => {
      // The field returned the MarkdownUserNameRenderer type, but the module for that branch
      // has not been loaded. The assumption is that the data cannot have been processed in that
      // case and therefore the markdown field is missing in the store.
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
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
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        // Return null to indicate the fragment is not loaded yet
        {
          get: _ => null,
          load: _ => Promise.resolve(null),
        },
        defaultGetDataID,
      );
      // The data for the field isn't in the store yet, so we have to return false
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when the match field/record exist but a scalar field is missing', () => {
      // the `data` field for the MarkdownUserNameRenderer is missing
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          'nameRenderer(supported:"34hjiS")': {
            __ref: 'client:1:nameRenderer(supported:"34hjiS")',
          },
        },
        'client:1:nameRenderer(supported:"34hjiS")': {
          __id: 'client:1:nameRenderer(supported:"34hjiS")',
          __typename: 'MarkdownUserNameRenderer',
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
          id: 'data',
          markup: '<markup/>',
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      // The data for the field 'data' isn't in the store yet, so we have to return false
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when the match field/record exist but a linked field is missing', () => {
      // the `data` field for the MarkdownUserNameRenderer is missing
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
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
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      // The data for the field 'data' isn't in the store yet, so we have to return false
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('returns true when the match field/record exist but do not match a supported type', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
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
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });

    it('returns true when the match field is non-existent (null)', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          'nameRenderer(supported:"34hjiS")': null,
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when the match field is not fetched (undefined)', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });
  });

  describe('when @module directive is present', () => {
    let BarQuery;
    let loader;

    beforeEach(() => {
      const DataCheckerTest5PlainUserNameRenderer_name = graphql`
        fragment DataCheckerTest5PlainUserNameRenderer_name on PlainUserNameRenderer {
          plaintext
          data {
            text
          }
        }
      `;

      const DataCheckerTest5MarkdownUserNameRenderer_name = graphql`
        fragment DataCheckerTest5MarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
          markdown
          data {
            markup
          }
        }
      `;
      graphql`
        fragment DataCheckerTest5Fragment on User {
          id
          nameRenderer {
            # no @match
            ...DataCheckerTest5PlainUserNameRenderer_name
              @module(name: "PlainUserNameRenderer.react")
            ...DataCheckerTest5MarkdownUserNameRenderer_name
              @module(name: "MarkdownUserNameRenderer.react")
          }
        }
      `;
      BarQuery = graphql`
        query DataCheckerTest5Query($id: ID!) {
          node(id: $id) {
            ...DataCheckerTest5Fragment @dangerously_unaliased_fixme
          }
        }
      `;
      const nodes = {
        DataCheckerTest5MarkdownUserNameRenderer_name,
        DataCheckerTest5PlainUserNameRenderer_name,
      };

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

    it('returns true when the field/record exists and matches the @module type (plaintext)', () => {
      // When the type matches PlainUserNameRenderer
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          nameRenderer: {
            __ref: 'client:1:nameRenderer',
          },
        },
        'client:1:nameRenderer': {
          __id: 'client:1:nameRenderer',
          __module_component_DataCheckerTest5Fragment:
            'PlainUserNameRenderer.react',
          __module_operation_DataCheckerTest5Fragment:
            'DataCheckerTest5PlainUserNameRenderer_name$normalization.graphql',
          __typename: 'PlainUserNameRenderer',
          data: {__ref: 'data'},
          plaintext: 'plain name',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'PlainUserNameData',
          id: 'data',
          text: 'text',
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      expect(loader.get).toBeCalledTimes(1);
      expect(loader.get.mock.calls[0][0]).toBe(
        'DataCheckerTest5PlainUserNameRenderer_name$normalization.graphql',
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });

    it('returns true when the field/record exist and matches the @module type (markdown)', () => {
      // When the type matches MarkdownUserNameRenderer
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          nameRenderer: {
            __ref: 'client:1:nameRenderer',
          },
        },
        'client:1:nameRenderer': {
          __id: 'client:1:nameRenderer',
          __module_component_DataCheckerTest5Fragment:
            'MarkdownUserNameRenderer.react',
          __module_operation_DataCheckerTest5Fragment:
            'DataCheckerTest5MarkdownUserNameRenderer_name$normalization.graphql',
          __typename: 'MarkdownUserNameRenderer',
          data: {__ref: 'data'},
          markdown: 'markdown payload',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
        data: {
          __id: 'data',
          __typename: 'MarkdownUserNameData',
          id: 'data',
          markup: '<markup/>',
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when the field/record exist but the @module fragment has not been processed', () => {
      // The field returned the MarkdownUserNameRenderer type, but the module for that branch
      // has not been loaded. The assumption is that the data cannot have been processed in that
      // case and therefore the markdown field is missing in the store.
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
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
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        // Return null to indicate the fragment is not loaded yet
        {
          get: _ => null,
          load: _ => Promise.resolve(null),
        },
        defaultGetDataID,
      );
      // The data for the field isn't in the store yet, so we have to return false
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when the field/record exists but a scalar field is missing', () => {
      // the `data` field for the MarkdownUserNameRenderer is missing
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          nameRenderer: {
            __ref: 'client:1:nameRenderer',
          },
        },
        'client:1:nameRenderer': {
          __id: 'client:1:nameRenderer',
          __typename: 'MarkdownUserNameRenderer',
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
          id: 'data',
          markup: '<markup/>',
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      // The data for the field 'data' isn't in the store yet, so we have to return false
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when the field/record exists but a linked field is missing', () => {
      // the `data` field for the MarkdownUserNameRenderer is missing
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
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
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      // The data for the field 'data' isn't in the store yet, so we have to return false
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('returns true when the field/record exists but does not match any @module selection', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
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
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(BarQuery).operation,
          'client:root',
          {
            id: '1',
          },
        ),
        [],
        loader,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });
  });

  describe('when @defer directive is present', () => {
    beforeEach(() => {
      graphql`
        fragment DataCheckerTest6Fragment on User {
          id
          name
        }
      `;

      Query = graphql`
        query DataCheckerTest9Query($id: ID!) {
          node(id: $id) {
            ...DataCheckerTest6Fragment
              @dangerously_unaliased_fixme
              @defer(label: "TestFragment")
          }
        }
      `;
    });

    it('returns true when deferred selections are fetched', () => {
      const storeData: RecordSourceJSON = {
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
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(Query).operation,
          'client:root',
          {id: '1'},
        ),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when deferred selections are not fetched', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          // 'name' not fetched
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(Query).operation,
          'client:root',
          {id: '1'},
        ),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });
  });

  describe('when @stream directive is present', () => {
    beforeEach(() => {
      graphql`
        fragment DataCheckerTest7Fragment on Feedback {
          id
          actors @stream(label: "TestFragmentActors", initial_count: 0) {
            name
          }
        }
      `;
      Query = graphql`
        query DataCheckerTest6Query($id: ID!) {
          node(id: $id) {
            ...DataCheckerTest7Fragment @dangerously_unaliased_fixme
          }
        }
      `;
    });

    it('returns true when streamed selections are fetched', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'Feedback',
          actors: {__refs: ['2']},
          id: '1',
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
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(Query).operation,
          'client:root',
          {id: '1'},
        ),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });

    it('returns false when streamed selections are not fetched', () => {
      const storeData: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'Feedback',
          actors: {__refs: ['2']},
          id: '1',
        },
        '2': {
          __id: '2',
          __typename: 'User',
          id: '2',
          // name not fetched
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          'node(id:"1")': {__ref: '1'},
        },
      };
      const source = RelayRecordSource.create(storeData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          getRequest(Query).operation,
          'client:root',
          {id: '1'},
        ),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });
  });

  describe('when the data is complete', () => {
    it('returns available', () => {
      const source = RelayRecordSource.create(sampleData);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
          id: '1',
          size: 32,
        }),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });
  });

  describe('when some data is missing', () => {
    it('returns missing on missing records', () => {
      const data: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          firstName: 'Alice',
          id: '1',
          'profilePicture(size:32)': {__ref: 'client:3'},
        },
        // missing profilePicture record
      };
      const source = RelayRecordSource.create(data);
      const target = RelayRecordSource.create();
      const BarFragment = graphql`
        fragment DataCheckerTest8Fragment on User
        @argumentDefinitions(size: {type: "[Int]"}) {
          id
          firstName
          profilePicture(size: $size) {
            uri
          }
        }
      `;
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(BarFragment as $FlowFixMe, '1', {size: 32}),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('returns missing on missing fields', () => {
      const data: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          firstName: 'Alice',
          id: '1',
          'profilePicture(size:32)': {__ref: 'client:3'},
        },
        'client:3': {
          __id: 'client:3',
          // missing 'uri'
        },
      };
      const source = RelayRecordSource.create(data);
      const target = RelayRecordSource.create();
      const BarFragment = graphql`
        fragment DataCheckerTest9Fragment on User
        @argumentDefinitions(size: {type: "[Int]"}) {
          id
          firstName
          profilePicture(size: $size) {
            uri
          }
        }
      `;
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(BarFragment as $FlowFixMe, '1', {size: 32}),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('allows handlers to supplement missing scalar fields', () => {
      const data: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          firstName: 'Alice',
          id: '1',
          'profilePicture(size:32)': {__ref: 'client:3'},
        },
        'client:3': {
          __id: 'client:3',
          __typename: 'Image',
          // missing 'uri'
        },
      };
      const source = RelayRecordSource.create(data);
      const target = RelayRecordSource.create();
      const BarFragment = graphql`
        fragment DataCheckerTest10Fragment on User
        @argumentDefinitions(size: {type: "[Int]"}) {
          id
          firstName
          profilePicture(size: $size) {
            uri
          }
        }
      `;
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(BarFragment as $FlowFixMe, '1', {size: 32}),
        [
          {
            handle: (field, record, argValues) => {
              return 'thebestimage.uri';
            },
            kind: 'scalar',
          },
        ],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.toJSON()).toEqual({
        'client:3': {
          __id: 'client:3',
          __typename: 'Image',
          uri: 'thebestimage.uri',
        },
      });
    });

    test.each([
      [
        'undefined',
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: undefined,
          updatedHometown: undefined,
        },
      ],
      [
        'null',
        {
          expectedStatus: {
            mostRecentlyInvalidatedAt: null,
            status: 'available',
          },
          handleReturnValue: null,
          updatedHometown: null,
        },
      ],
      [
        "'hometown-exists'",
        {
          expectedStatus: {
            mostRecentlyInvalidatedAt: null,
            status: 'available',
          },
          handleReturnValue: 'hometown-exists',
          updatedHometown: 'hometown-exists',
        },
      ],
      [
        "'hometown-deleted'",
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: 'hometown-deleted',
          updatedHometown: undefined,
        },
      ],
      [
        "'hometown-unknown'",
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: 'hometown-unknown',
          updatedHometown: undefined,
        },
      ],
    ])(
      'linked field handler handler that returns %s',
      (_name, {handleReturnValue, expectedStatus, updatedHometown}) => {
        const data: RecordSourceJSON = {
          'hometown-deleted': null,
          'hometown-exists': {
            __id: 'hometown',
            __typename: 'Page',
            name: 'New York City',
          },
          user1: {
            __id: 'user1',
            __typename: 'User',
            firstName: 'Alice',
            id: 'user1',
            // hometown: missing
          },
        };
        const source = RelayRecordSource.create(data);
        const target = RelayRecordSource.create();
        const UserFragment = graphql`
          fragment DataCheckerTest11Fragment on User {
            hometown {
              name
            }
          }
        `;
        const handle = jest.fn(
          (
            field: NormalizationLinkedField | ReaderLinkedField,
            record: ?ReadOnlyRecordProxy,
            argValues: Variables,
          ) => {
            return handleReturnValue;
          },
        );
        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(UserFragment as $FlowFixMe, 'user1', {}),
          [
            // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
            {
              handle,
              kind: 'linked',
            },
          ],
          null,
          defaultGetDataID,
        );
        expect(handle).toBeCalledTimes(1);
        expect(status).toEqual(expectedStatus);
        expect(target.toJSON()).toEqual(
          updatedHometown === undefined
            ? {}
            : updatedHometown === null
              ? {
                  user1: {
                    __id: 'user1',
                    __typename: 'User',
                    hometown: null,
                  },
                }
              : {
                  user1: {
                    __id: 'user1',
                    __typename: 'User',
                    hometown: {
                      __ref: updatedHometown,
                    },
                  },
                },
        );
      },
    );

    test.each([
      [
        'undefined',
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: undefined,
          updatedScreennames: undefined,
        },
      ],
      [
        'null',
        {
          expectedStatus: {
            mostRecentlyInvalidatedAt: null,
            status: 'available',
          },
          handleReturnValue: null,
          updatedScreennames: null,
        },
      ],
      [
        '[]',
        {
          expectedStatus: {
            mostRecentlyInvalidatedAt: null,
            status: 'available',
          },
          handleReturnValue: [],
          updatedScreennames: [],
        },
      ],
      [
        '[undefined]',
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: [undefined],
          updatedScreennames: undefined,
        },
      ],
      [
        '[null]',
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: [null],
          updatedScreennames: undefined,
        },
      ],
      [
        "['screenname-exists']",
        {
          expectedStatus: {
            mostRecentlyInvalidatedAt: null,
            status: 'available',
          },
          handleReturnValue: ['screenname-exists'],
          updatedScreennames: ['screenname-exists'],
        },
      ],
      [
        "['screenname-deleted']",
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: ['screenname-deleted'],
          updatedScreennames: undefined,
        },
      ],
      [
        "['screenname-unknown']",
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: ['screenname-unknown'],
          updatedScreennames: undefined,
        },
      ],
      [
        "['screenname-exists', 'screenname-unknown']",
        {
          expectedStatus: {mostRecentlyInvalidatedAt: null, status: 'missing'},
          handleReturnValue: ['screenname-exists', 'screenname-unknown'],
          updatedScreennames: undefined,
        },
      ],
    ])(
      'plural linked field handler handler that returns %s',
      (_name, {handleReturnValue, expectedStatus, updatedScreennames}) => {
        const data: RecordSourceJSON = {
          'screenname-deleted': null,
          'screenname-exists': {
            __id: 'screenname-exists',
            __typename: 'Screenname',
            name: 'Bert',
          },
          user1: {
            __id: 'user1',
            __typename: 'User',
            firstName: 'Alice',
            id: 'user1',
            // screennames: missing
          },
        };
        const source = RelayRecordSource.create(data);
        const target = RelayRecordSource.create();
        const UserFragment = graphql`
          fragment DataCheckerTest12Fragment on User {
            screennames {
              name
            }
          }
        `;
        const handle = jest.fn(
          (
            field: NormalizationLinkedField | ReaderLinkedField,
            record: ?ReadOnlyRecordProxy,
            argValues: Variables,
          ) => {
            return handleReturnValue;
          },
        );
        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(UserFragment as $FlowFixMe, 'user1', {}),
          [
            // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
            // $FlowFixMe[incompatible-type]
            {
              handle,
              kind: 'pluralLinked',
            },
          ],
          null,
          defaultGetDataID,
        );
        expect(handle).toBeCalledTimes(1);
        expect(status).toEqual(expectedStatus);
        expect(target.toJSON()).toEqual(
          updatedScreennames === undefined
            ? {}
            : updatedScreennames === null
              ? {
                  user1: {
                    __id: 'user1',
                    __typename: 'User',
                    screennames: null,
                  },
                }
              : {
                  user1: {
                    __id: 'user1',
                    __typename: 'User',
                    screennames: {
                      __refs: updatedScreennames,
                    },
                  },
                },
        );
      },
    );

    it('returns modified records with the target', () => {
      const data: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
        },
        profile_1_32: {
          __id: 'profile_1_32',
          __typename: 'Profile',
          id: 'profile_1_32',
          uri: 'thebestimage.uri',
        },
      };
      const source = RelayRecordSource.create(data);
      const target = RelayRecordSource.create();
      const BarFragment = graphql`
        fragment DataCheckerTest13Fragment on User
        @argumentDefinitions(size: {type: "[Int]"}) {
          id
          firstName
          profilePicture(size: $size) {
            uri
          }
        }
      `;
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(BarFragment as $FlowFixMe, '1', {size: 32}),
        [
          {
            handle: (field, record, argValues) => {
              if (
                record &&
                record?.getDataID() === '1' &&
                field.name === 'firstName'
              ) {
                return 'Alice';
              }
            },
            kind: 'scalar',
          },
          {
            handle: (field, record, argValues) => {
              const id = record?.getDataID();
              if (
                field.name === 'profilePicture' &&
                record &&
                typeof id === 'string'
              ) {
                return `profile_${id}_${argValues.size}`;
              }
            },
            kind: 'linked',
          },
        ],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.toJSON()).toEqual({
        '1': {
          __id: '1',
          __typename: 'User',
          firstName: 'Alice',
          'profilePicture(size:32)': {__ref: 'profile_1_32'},
        },
      });
    });

    it('returns available even when client field is missing', () => {
      const data: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          firstName: 'Alice',
          id: '1',
          'profilePicture(size:32)': {__ref: 'client:3'},
        },
      };
      const source = RelayRecordSource.create(data);
      const target = RelayRecordSource.create();
      const BarFragment = graphql`
        fragment DataCheckerTest14Fragment on User
        @argumentDefinitions(size: {type: "[Int]"}) {
          id
          firstName
          client_actor_field
          client_foo {
            client_name
            profile_picture(scale: 2) {
              uri
            }
          }
          best_friends {
            edges {
              client_friend_edge_field
              cursor
              node {
                id
                client_foo {
                  client_name
                  profile_picture(scale: 2) {
                    uri
                  }
                }
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
        }
      `;
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(BarFragment as $FlowFixMe, '1', {size: 32}),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });
  });

  describe('record source proxy', () => {
    let previousPublishFlag;
    beforeEach(() => {
      previousPublishFlag = RelayFeatureFlags.ENABLE_PERF_PUBLISH;
    });
    afterEach(() => {
      RelayFeatureFlags.ENABLE_PERF_PUBLISH = previousPublishFlag;
    });

    it.each([
      [false, 'RelayRecordSourceProxy', RelayRecordSourceProxy],
      [
        true,
        'RelayRecordSourceProxyOptimized',
        RelayRecordSourceProxyOptimized,
      ],
    ])(
      'with ENABLE_PERF_PUBLISH %s, gives missing field handlers a %s',
      (publishFlag, _className, ExpectedProxyClass) => {
        RelayFeatureFlags.ENABLE_PERF_PUBLISH = publishFlag;
        // The root record without its `node(id: "1")` link: the handler
        // supplies it from the store.
        const source = RelayRecordSource.create({
          ...sampleData,
          'client:root': {__id: 'client:root', __typename: '__Root'},
        });
        const target = RelayRecordSource.create();
        const handle = jest.fn(handleNodeFromStore);
        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          [{handle, kind: 'linked'}],
          null,
          defaultGetDataID,
        );
        expect(status).toEqual({
          mostRecentlyInvalidatedAt: null,
          status: 'available',
        });
        expect(target.toJSON()).toEqual({
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        });
        expect(handle).toHaveBeenCalledTimes(1);
        expect(Object.getPrototypeOf(handle.mock.calls[0][3])).toBe(
          ExpectedProxyClass.prototype,
        );
      },
    );
  });

  describe('when individual records have been invalidated', () => {
    describe('when data is complete', () => {
      it('returns correct invalidation epoch in result when record was invalidated', () => {
        const source = RelayRecordSource.create(sampleData);
        const target = RelayRecordSource.create();
        const environment = createMockEnvironment({
          store: new RelayModernStore(source),
        });

        // Invalidate record
        environment.commitUpdate(storeProxy => {
          const user = storeProxy.get('1');
          if (!user) {
            throw new Error('Expected to find record with id "1"');
          }
          user.invalidateRecord();
        });

        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          [],
          null,
          defaultGetDataID,
        );

        // Assert mostRecentlyInvalidatedAt matches most recent invalidation epoch
        expect(status).toEqual({
          mostRecentlyInvalidatedAt: 1,
          status: 'available',
        });
        expect(target.size()).toBe(0);
      });

      it('returns correct invalidation epoch in result when multiple records invalidated at different times', () => {
        const source = RelayRecordSource.create(sampleData);
        const target = RelayRecordSource.create();
        const environment = createMockEnvironment({
          store: new RelayModernStore(source),
        });

        // Invalidate record
        environment.commitUpdate(storeProxy => {
          const user = storeProxy.get('1');
          if (!user) {
            throw new Error('Expected to find record with id "1"');
          }
          user.invalidateRecord();
        });

        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          [],
          null,
          defaultGetDataID,
        );

        // Assert mostRecentlyInvalidatedAt matches most recent invalidation epoch
        expect(status).toEqual({
          mostRecentlyInvalidatedAt: 1,
          status: 'available',
        });
        expect(target.size()).toBe(0);

        // Invalidate other record in operation
        environment.commitUpdate(storeProxy => {
          const photo = storeProxy.get('client:4');
          if (!photo) {
            throw new Error('Expected to find record with id "client:4"');
          }
          photo.invalidateRecord();
        });

        const nextStatus = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          [],
          null,
          defaultGetDataID,
        );

        // Assert mostRecentlyInvalidatedAt matches most recent invalidation epoch
        expect(nextStatus).toEqual({
          mostRecentlyInvalidatedAt: 2,
          status: 'available',
        });
        expect(target.size()).toBe(0);
      });
    });

    describe('when data is missing', () => {
      beforeEach(() => {
        sampleData = {
          ...sampleData,
          // $FlowFixMe[prop-missing]
          'client:4': {
            __id: 'client:4',
            __typename: 'Photo',
            // missing 'uri'
          },
        };
      });

      it('returns correct invalidation epoch in result when record was invalidated', () => {
        const source = RelayRecordSource.create(sampleData);
        const target = RelayRecordSource.create();
        const environment = createMockEnvironment({
          store: new RelayModernStore(source),
        });

        // Invalidate record
        environment.commitUpdate(storeProxy => {
          const user = storeProxy.get('1');
          if (!user) {
            throw new Error('Expected to find record with id "1"');
          }
          user.invalidateRecord();
        });

        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          [],
          null,
          defaultGetDataID,
        );

        // Assert result is missing
        expect(status).toEqual({
          mostRecentlyInvalidatedAt: 1,
          status: 'missing',
        });
        expect(target.size()).toBe(0);
      });

      it('returns correct invalidation epoch in result when multiple records invalidated at different times', () => {
        const source = RelayRecordSource.create(sampleData);
        const target = RelayRecordSource.create();
        const environment = createMockEnvironment({
          store: new RelayModernStore(source),
        });

        // Invalidate record
        environment.commitUpdate(storeProxy => {
          const user = storeProxy.get('1');
          if (!user) {
            throw new Error('Expected to find record with id "1"');
          }
          user.invalidateRecord();
        });

        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          [],
          null,
          defaultGetDataID,
        );

        // Assert that result is missing
        expect(status).toEqual({
          mostRecentlyInvalidatedAt: 1,
          status: 'missing',
        });
        expect(target.size()).toBe(0);

        // Invalidate other record in operation
        environment.commitUpdate(storeProxy => {
          const photo = storeProxy.get('client:4');
          if (!photo) {
            throw new Error('Expected to find record with id "client:4"');
          }
          photo.invalidateRecord();
        });

        const nextStatus = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          [],
          null,
          defaultGetDataID,
        );

        // Assert that result is still missing
        expect(nextStatus).toEqual({
          mostRecentlyInvalidatedAt: 2,
          status: 'missing',
        });
        expect(target.size()).toBe(0);
      });

      it('returns null invalidation epoch when stale record is unreachable', () => {
        // $FlowFixMe[prop-missing]
        sampleData = {
          // Root record is missing, so none of the descendants are reachable
          '1': {
            __id: '1',
            __typename: 'User',
            firstName: 'Alice',
            'friends(first:3)': {__ref: 'client:1'},
            id: '1',
            'profilePicture(size:32)': {__ref: 'client:4'},
          },
          'client:1': {
            __id: 'client:1',
            __typename: 'FriendsConnection',
            edges: {
              __refs: [],
            },
          },
          // $FlowFixMe[prop-missing]
          'client:4': {
            __id: 'client:4',
            __typename: 'Photo',
            // uri is missing
          },
        };
        const source = RelayRecordSource.create(sampleData);
        const target = RelayRecordSource.create();
        const environment = createMockEnvironment({
          store: new RelayModernStore(source),
        });

        // Invalidate record
        environment.commitUpdate(storeProxy => {
          const user = storeProxy.get('1');
          if (!user) {
            throw new Error('Expected to find record with id "1"');
          }
          user.invalidateRecord();
        });

        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {
            id: '1',
            size: 32,
          }),
          [],
          null,
          defaultGetDataID,
        );

        // Assert that result is missing
        expect(status).toEqual({
          mostRecentlyInvalidatedAt: null,
          status: 'missing',
        });
        expect(target.size()).toBe(0);
      });
    });
  });

  it('returns false when a Node record is missing an id', () => {
    const TestFragment = graphql`
      fragment DataCheckerTest16Fragment on Query {
        maybeNodeInterface {
          # This "... on Node { id }" selection would be generated if not
          # present, and is flattened since Node is abstract
          ... on Node {
            id
          }
          ... on NonNodeNoID {
            name
          }
        }
      }
    `;

    const data: RecordSourceJSON = {
      '1': {
        __id: '1',
        __typename: 'User',
        name: 'Alice',
        // no `id` value
      },
      'client:root': {
        __id: 'client:root',
        __typename: 'Query',
        maybeNodeInterface: {__ref: '1'},
      },
    };
    const source = RelayRecordSource.create(data);
    const target = RelayRecordSource.create();
    const status = check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(
        TestFragment as $FlowFixMe,
        'client:root',
        {},
      ),
      [],
      null,
      defaultGetDataID,
    );
    expect(status).toEqual({
      mostRecentlyInvalidatedAt: null,
      status: 'missing',
    });
    expect(target.size()).toBe(0);
  });

  describe('precise type refinement', () => {
    it('returns `missing` when a Node record is missing an id', () => {
      const TestFragment = graphql`
        fragment DataCheckerTest17Fragment on Query {
          maybeNodeInterface {
            # This "... on Node { id }" selection would be generated if not present
            ... on Node {
              id
            }
            ... on NonNodeNoID {
              name
            }
          }
        }
      `;

      const typeID = generateTypeID('User');
      const data: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          name: 'Alice',
          // no `id` value
        },
        'client:root': {
          __id: 'client:root',
          __typename: 'Query',
          maybeNodeInterface: {__ref: '1'},
        },
        // $FlowFixMe[invalid-computed-prop]
        [typeID]: {
          __id: typeID,
          __isNode: true,
          __typename: TYPE_SCHEMA_TYPE,
        },
      };
      const source = RelayRecordSource.create(data);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          TestFragment as $FlowFixMe,
          'client:root',
          {},
        ),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });
    it('returns `missing` when an abstract refinement is only missing the discriminator field', () => {
      const TestFragment = graphql`
        fragment DataCheckerTest18Fragment on Query {
          maybeNodeInterface {
            # This "... on Node { id }" selection would be generated if not present
            ... on Node {
              id
            }
            ... on NonNodeNoID {
              name
            }
          }
        }
      `;

      const typeID = generateTypeID('User');
      const data: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'User',
          id: '1',
          name: 'Alice',
        },
        'client:root': {
          __id: 'client:root',
          __typename: 'Query',
          maybeNodeInterface: {__ref: '1'},
        },
        // $FlowFixMe[invalid-computed-prop]
        [typeID]: {
          __id: typeID,
          __typename: TYPE_SCHEMA_TYPE,
          // __isNode: true, // dont know if it implements Node or not
        },
      };
      const source = RelayRecordSource.create(data);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          TestFragment as $FlowFixMe,
          'client:root',
          {},
        ),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'missing',
      });
      expect(target.size()).toBe(0);
    });

    it('returns `available` when a record is only missing fields in non-implemented interfaces', () => {
      const TestFragment = graphql`
        fragment DataCheckerTest19Fragment on Query {
          maybeNodeInterface {
            # This "... on Node { id }" selection would be generated if not present
            ... on Node {
              id
            }
            ... on NonNodeNoID {
              name
            }
          }
        }
      `;

      const typeID = generateTypeID('NonNodeNoID');
      const data: RecordSourceJSON = {
        '1': {
          __id: '1',
          __typename: 'NonNodeNoID',
          // no 'id' bc not a Node
          name: 'Not a Node!',
        },
        'client:root': {
          __id: 'client:root',
          __typename: 'Query',
          maybeNodeInterface: {__ref: '1'},
        },
        // $FlowFixMe[invalid-computed-prop]
        [typeID]: {
          __id: typeID,
          __isNode: false,
          __typename: TYPE_SCHEMA_TYPE,
        },
      };
      const source = RelayRecordSource.create(data);
      const target = RelayRecordSource.create();
      const status = check(
        () => source,
        () => target,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        createNormalizationSelector(
          TestFragment as $FlowFixMe,
          'client:root',
          {},
        ),
        [],
        null,
        defaultGetDataID,
      );
      expect(status).toEqual({
        mostRecentlyInvalidatedAt: null,
        status: 'available',
      });
      expect(target.size()).toBe(0);
    });
  });

  it('should assign client-only abstract type information to the target source', () => {
    graphql`
      fragment DataCheckerTestClient2Interface on ClientInterface {
        description
      }
    `;
    const clientQuery = graphql`
      query DataCheckerTestClient2AbstractQuery {
        client_interface {
          ...DataCheckerTestClient2Interface
        }
      }
    `;
    const source = RelayRecordSource.create();
    const target = RelayRecordSource.create();
    check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(
        getRequest(clientQuery).operation,
        'client:root',
        {},
      ),
      [],
      null,
      defaultGetDataID,
    );
    expect(target.toJSON()).toEqual({
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
    });
  });

  it('should assign client-only abstract type information to the target source if it is not available in the source', () => {
    graphql`
      fragment DataCheckerTestClientInterface on ClientInterface {
        description
      }
    `;
    const clientQuery = graphql`
      query DataCheckerTestClientAbstractQuery {
        client_interface {
          ...DataCheckerTestClientInterface
        }
      }
    `;
    const source = RelayRecordSource.create({
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
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        client_interface: {__ref: 'object-1'},
      },
      'object-1': {
        __id: 'object-1',
        __typename: 'ClientTypeImplementingClientInterface',
        id: 'object-1',
      },
    });
    const target = RelayRecordSource.create();
    check(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      createNormalizationSelector(
        getRequest(clientQuery).operation,
        'client:root',
        {},
      ),
      [],
      null,
      defaultGetDataID,
    );
    expect(target.toJSON()).toEqual({});
  });

  describe('exec time resolvers', () => {
    describe('client query', () => {
      const Query = graphql`
        query DataCheckerTestExecQuery @exec_time_resolvers {
          RelayReaderExecResolversTest_user_one {
            name
            best_friend {
              name
              best_friend {
                name
              }
            }
          }
        }
      `;

      it('should return available when all data is available', () => {
        const source = RelayRecordSource.create({
          '1': {
            __id: '1',
            best_friend: {__ref: '2'},
            name: 'Alice',
          },
          '2': {
            __id: '2',
            best_fried: {__ref: '3'},
            name: 'Bob',
          },
          '3': {
            __id: '3',
            name: 'Zuck',
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            RelayReaderExecResolversTest_user_one: {__ref: '1'},
          },
        });
        const target = RelayRecordSource.create();
        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {}),
          [],
          null,
          defaultGetDataID,
        );
        expect(status.status).toBe('available');
      });

      it('should return available when only client data is missing', () => {
        const source = RelayRecordSource.create({
          '1': {
            __id: '1',
            best_friend: {__ref: '2'},
            name: 'Alice',
          },
          '2': {
            __id: '2',
            best_fried: undefined,
            name: 'Bob',
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            RelayReaderExecResolversTest_user_one: {__ref: '1'},
          },
        });
        const target = RelayRecordSource.create();
        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {}),
          [],
          null,
          defaultGetDataID,
        );
        expect(status.status).toBe('available');
      });
    });

    describe('server and client query', () => {
      const Query = graphql`
        query DataCheckerTestExecWithServerDataQuery @exec_time_resolvers {
          RelayReaderExecResolversTest_user_one {
            name
            best_friend {
              name
              best_friend {
                name
              }
            }
          }
          me {
            name
          }
        }
      `;
      it('should return available when server data is available', () => {
        const source = RelayRecordSource.create({
          '0': {
            __id: '0',
            id: '0',
            name: 'Zuck',
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            RelayReaderExecResolversTest_user_one: undefined,
            me: {__ref: '0'},
          },
        });
        const target = RelayRecordSource.create();
        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {}),
          [],
          null,
          defaultGetDataID,
        );
        expect(status.status).toBe('available');
      });

      it('should return missing when server data is missing', () => {
        const source = RelayRecordSource.create({
          '0': {
            __id: '0',
            id: '0',
            name: undefined,
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            RelayReaderExecResolversTest_user_one: undefined,
            me: {__ref: '0'},
          },
        });
        const target = RelayRecordSource.create();
        const status = check(
          () => source,
          () => target,
          INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
          createNormalizationSelector(getRequest(Query).operation, ROOT_ID, {}),
          [],
          null,
          defaultGetDataID,
        );
        expect(status.status).toBe('missing');
      });
    });
  });
});
