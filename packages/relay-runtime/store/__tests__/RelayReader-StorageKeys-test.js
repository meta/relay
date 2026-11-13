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

import type {ConcreteRequest} from '../../util/RelayConcreteNode';
import type {Variables} from '../../util/RelayRuntimeTypes';
import type {RecordSource, Snapshot} from '../RelayStoreTypes';
import typeof RelayStoreUtilsModule from '../RelayStoreUtils';

const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {read} = require('../RelayReader');
const RelayRecordSource = require('../RelayRecordSource');

// The names of the fields the reader passes to getStorageKey, in order.
const mockStorageKeyFieldNames: Array<string> = [];

jest.mock('../RelayStoreUtils', () => ({
  ...jest.requireActual<RelayStoreUtilsModule>('../RelayStoreUtils'),
  getStorageKey: mockGetStorageKey,
}));

function mockGetStorageKey(
  ...args: Parameters<RelayStoreUtilsModule['getStorageKey']>
): string {
  mockStorageKeyFieldNames.push(args[0].name);
  return jest
    .requireActual<RelayStoreUtilsModule>('../RelayStoreUtils')
    .getStorageKey(...args);
}

type Read = {
  snapshot: Snapshot,
  storageKeyFieldNames: ReadonlyArray<string>,
};

function readQuery(
  query: ConcreteRequest,
  variables: Variables,
  source: RecordSource,
  perfReader: boolean,
): Read {
  const previous = RelayFeatureFlags.ENABLE_PERF_READER;
  RelayFeatureFlags.ENABLE_PERF_READER = perfReader;
  try {
    const operation = createOperationDescriptor(query, variables);
    mockStorageKeyFieldNames.length = 0;
    const snapshot = read(source, operation.fragment);
    return {snapshot, storageKeyFieldNames: mockStorageKeyFieldNames.slice()};
  } finally {
    RelayFeatureFlags.ENABLE_PERF_READER = previous;
  }
}

function resultOf(snapshot: Snapshot): unknown {
  return {
    data: snapshot.data,
    fieldErrors: snapshot.fieldErrors,
    isMissingData: snapshot.isMissingData,
    seenRecords: Array.from(snapshot.seenRecords).sort(),
  };
}

// With ENABLE_PERF_READER on, RelayReaderOptimized#_readScalar takes the
// storage key of a scalar field without arguments from its name, and calls
// getStorageKey for every other field it reads, also when all its arguments
// are literals: if only rarer fields made the call, V8 could optimize the
// reader before the call had run, and the first such field would then
// deoptimize it. Each case reads the same records with RelayReader (the flag
// off) and RelayReaderOptimized, and every storage key holds a value of its
// own, so a key that differs from RelayReader's reads another value or none.
describe('RelayReaderOptimized storage keys', () => {
  it('reads fields without arguments, with literal and with variable arguments under the keys RelayReader uses', () => {
    const query = graphql`
      query RelayReaderStorageKeysTestQuery(
        $site: String
        $size: [Int]
        $ids: [ID!]
      ) {
        me {
          id
          firstName
          shortName: firstName(if: true)
          url(relative: true)
          siteUrl: url(site: $site)
          smallPicture: profilePicture(size: 32) {
            uri
          }
          picture: profilePicture(size: $size) {
            uri
          }
        }
        nodes(ids: ["2"]) {
          id
        }
        variableNodes: nodes(ids: $ids) {
          id
        }
      }
    `;
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
        'nodes(ids:["2"])': {__refs: ['2']},
        'nodes(ids:["3"])': {__refs: ['3']},
      },
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        firstName: 'Alice',
        'firstName(if:true)': 'Al',
        url: 'https://example.com/no-arguments',
        'url(relative:true)': '/alice',
        'url(site:"www")': 'https://www.example.com/alice',
        profilePicture: {__ref: 'client:1:profilePicture'},
        'profilePicture(size:32)': {__ref: 'client:1:profilePicture(size:32)'},
        'profilePicture(size:[64])': {
          __ref: 'client:1:profilePicture(size:[64])',
        },
      },
      'client:1:profilePicture': {
        __id: 'client:1:profilePicture',
        __typename: 'Image',
        uri: 'https://example.com/no-arguments.png',
      },
      'client:1:profilePicture(size:32)': {
        __id: 'client:1:profilePicture(size:32)',
        __typename: 'Image',
        uri: 'https://example.com/32.png',
      },
      'client:1:profilePicture(size:[64])': {
        __id: 'client:1:profilePicture(size:[64])',
        __typename: 'Image',
        uri: 'https://example.com/64.png',
      },
      '2': {__id: '2', __typename: 'User', id: '2'},
      '3': {__id: '3', __typename: 'User', id: '3'},
    });
    const variables = {site: 'www', size: [64], ids: ['3']};

    const master = readQuery(query, variables, source, false);
    const optimized = readQuery(query, variables, source, true);

    expect(optimized.snapshot.data).toEqual({
      me: {
        id: '1',
        firstName: 'Alice',
        shortName: 'Al',
        url: '/alice',
        siteUrl: 'https://www.example.com/alice',
        smallPicture: {uri: 'https://example.com/32.png'},
        picture: {uri: 'https://example.com/64.png'},
      },
      nodes: [{id: '2'}],
      variableNodes: [{id: '3'}],
    });
    expect(optimized.snapshot.isMissingData).toBe(false);
    expect(resultOf(optimized.snapshot)).toEqual(resultOf(master.snapshot));
    // Every field with arguments goes through getStorageKey, the literal ones
    // too; the fields without arguments (`me`, `id`, `firstName`, `uri`)
    // don't.
    expect(optimized.storageKeyFieldNames).toEqual([
      'firstName',
      'url',
      'url',
      'profilePicture',
      'profilePicture',
      'nodes',
      'nodes',
    ]);
  });

  it('reads exec time resolver fields under the keys RelayReader uses', () => {
    const query = graphql`
      query RelayReaderStorageKeysTestExecTimeQuery(
        $world: String
        $prefix: String!
      )
      @exec_time_resolvers(
        enabledProvider: "relayReaderTestExecTimeResolversTrueProvider"
      ) {
        me {
          exec_time_s2c_identity
        }
        hello(world: "Alice")
        hello_optional_world(world: $world)
        counter_no_fragment_with_arg(prefix: $prefix)
      }
    `;
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
        hello: 'stored: no arguments',
        'hello(world:"Alice")': 'stored: Alice',
        hello_optional_world: 'stored: no arguments',
        'hello_optional_world(world:"Bob")': 'stored: Bob',
        counter_no_fragment_with_arg: 'stored: no arguments',
        'counter_no_fragment_with_arg(prefix:"Count")': 'stored: Count',
      },
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        exec_time_s2c_identity: 'user:1',
      },
    });
    const variables = {world: 'Bob', prefix: 'Count'};

    const master = readQuery(query, variables, source, false);
    const optimized = readQuery(query, variables, source, true);

    expect(optimized.snapshot.data).toEqual({
      me: {exec_time_s2c_identity: 'user:1'},
      hello: 'stored: Alice',
      hello_optional_world: 'stored: Bob',
      counter_no_fragment_with_arg: 'stored: Count',
    });
    expect(optimized.snapshot.isMissingData).toBe(false);
    expect(resultOf(optimized.snapshot)).toEqual(resultOf(master.snapshot));
    // Resolver fields go through getStorageKey with or without arguments (it
    // adds a root fragment's arguments).
    expect(optimized.storageKeyFieldNames).toEqual([
      'exec_time_s2c_identity',
      'hello',
      'hello_optional_world',
      'counter_no_fragment_with_arg',
    ]);
  });
});
