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
import type {Availability} from '../DataChecker';
import type {MissingFieldHandler, RecordSourceJSON} from '../RelayStoreTypes';
import typeof RelayStoreUtilsModule from '../RelayStoreUtils';

const {
  INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
} = require('../../multi-actor-environment/ActorIdentifier');
const {getRequest, graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const {DataChecker, check} = require('../DataChecker');
const defaultGetDataID = require('../defaultGetDataID');
const {createNormalizationSelector} = require('../RelayModernSelector');
const RelayRecordSource = require('../RelayRecordSource');

// The names of the fields the checker passes to getStorageKey, in order.
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

// The names of the fields the checker finds missing, in order: the handlers
// record each field they are asked about and substitute nothing.
const missingFieldNames: Array<string> = [];

function recordMissingField(field: {readonly name: string, ...}): undefined {
  missingFieldNames.push(field.name);
}

const HANDLERS: ReadonlyArray<MissingFieldHandler> = [
  {kind: 'scalar', handle: recordMissingField},
  {kind: 'linked', handle: recordMissingField},
  {kind: 'pluralLinked', handle: recordMissingField},
];

type Check = {
  availability: Availability,
  missingFieldNames: ReadonlyArray<string>,
  storageKeyFieldNames: ReadonlyArray<string>,
};

function checkQuery(
  query: ConcreteRequest,
  variables: Variables,
  records: RecordSourceJSON,
  perfStorageKeys: boolean,
  handlers: ReadonlyArray<MissingFieldHandler> = HANDLERS,
): Check {
  const previous = RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS;
  RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS = perfStorageKeys;
  try {
    mockStorageKeyFieldNames.length = 0;
    missingFieldNames.length = 0;
    const availability = runCheck(query, variables, records, handlers);
    return {
      availability,
      missingFieldNames: missingFieldNames.slice(),
      storageKeyFieldNames: mockStorageKeyFieldNames.slice(),
    };
  } finally {
    RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS = previous;
  }
}

function runCheck(
  query: ConcreteRequest,
  variables: Variables,
  records: RecordSourceJSON,
  handlers: ReadonlyArray<MissingFieldHandler>,
): Availability {
  const source = RelayRecordSource.create(records);
  const target = RelayRecordSource.create();
  return check(
    () => source,
    () => target,
    INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
    createNormalizationSelector(
      getRequest(query).operation,
      'client:root',
      variables,
    ),
    handlers,
    null,
    defaultGetDataID,
  );
}

// The names of the fields that a checker constructed directly (as
// `ExecTimeS2CDataChecker` is) rather than by `check()` passes to getStorageKey,
// after a `check()` with the flag the other way.
function checkDirectly(
  query: ConcreteRequest,
  variables: Variables,
  records: RecordSourceJSON,
  perfStorageKeys: boolean,
): ReadonlyArray<string> {
  checkQuery(query, variables, records, !perfStorageKeys);
  const previous = RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS;
  RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS = perfStorageKeys;
  try {
    const source = RelayRecordSource.create(records);
    const target = RelayRecordSource.create();
    const checker = new DataChecker(
      () => source,
      () => target,
      INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      variables,
      HANDLERS,
      null,
      defaultGetDataID,
      null,
      false,
    );
    mockStorageKeyFieldNames.length = 0;
    checker.check(getRequest(query).operation, 'client:root');
    return mockStorageKeyFieldNames.slice();
  } finally {
    RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS = previous;
  }
}

// With ENABLE_PERF_STORAGE_KEYS on, the checker takes the storage key of a
// field without arguments from its name, and calls getStorageKey for every
// field with arguments, also when all its arguments are literals. Each case
// checks the same records with the flag off and on; every storage key holds a
// value of its own, so a key that differs from getStorageKey's finds nothing.
describe('DataChecker storage keys', () => {
  const query = graphql`
    query DataCheckerStorageKeysTestQuery(
      $site: String
      $size: [Int]
      $ids: [ID!]
    ) {
      me {
        id
        name
        familyName: lastName
        shortName: firstName(if: true)
        url(relative: true)
        siteUrl: url(site: $site)
        smallPicture: profilePicture(size: 32) {
          uri
        }
        picture: profilePicture(size: $size) {
          uri
        }
        accounts: screennames {
          name
        }
        cover: backgroundImage {
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
  const variables = {site: 'www', size: [64], ids: ['3']};
  const records: RecordSourceJSON = {
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
      name: 'Alice',
      lastName: 'Smith',
      'firstName(if:true)': 'Al',
      'url(relative:true)': '/alice',
      'url(site:"www")': 'https://www.example.com/alice',
      'profilePicture(size:32)': {__ref: 'client:1:profilePicture(size:32)'},
      'profilePicture(size:[64])': {
        __ref: 'client:1:profilePicture(size:[64])',
      },
      screennames: {__refs: ['client:1:screennames:0']},
      backgroundImage: {__ref: 'client:1:backgroundImage'},
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
    'client:1:screennames:0': {
      __id: 'client:1:screennames:0',
      __typename: 'Screenname',
      name: 'alice',
    },
    'client:1:backgroundImage': {
      __id: 'client:1:backgroundImage',
      __typename: 'Image',
      uri: 'https://example.com/cover.png',
    },
    '2': {__id: '2', __typename: 'User', id: '2'},
    '3': {__id: '3', __typename: 'User', id: '3'},
  };

  it('finds every field under the key getStorageKey gives it', () => {
    const off = checkQuery(query, variables, records, false);
    const on = checkQuery(query, variables, records, true);
    expect(off.availability.status).toBe('available');
    expect(off.missingFieldNames).toEqual([]);
    expect(on.availability).toEqual(off.availability);
    expect(on.missingFieldNames).toEqual(off.missingFieldNames);
  });

  it('finds the same fields missing when the values are under their names', () => {
    // Each field with arguments has a value under its name only: a field
    // checked under its name instead of its key would be found.
    const underNames: RecordSourceJSON = {
      ...records,
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
        nodes: {__refs: ['2']},
      },
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        name: 'Alice',
        lastName: 'Smith',
        firstName: 'Al',
        url: '/alice',
        profilePicture: {__ref: 'client:1:profilePicture(size:32)'},
        screennames: {__refs: ['client:1:screennames:0']},
        backgroundImage: {__ref: 'client:1:backgroundImage'},
      },
    };
    const off = checkQuery(query, variables, underNames, false);
    const on = checkQuery(query, variables, underNames, true);
    expect(off.availability.status).toBe('missing');
    expect(off.missingFieldNames).toEqual([
      'firstName',
      'url',
      'url',
      'profilePicture',
      'profilePicture',
      'nodes',
      'nodes',
    ]);
    expect(on.availability).toEqual(off.availability);
    expect(on.missingFieldNames).toEqual(off.missingFieldNames);
  });

  it('calls getStorageKey for the fields with arguments only', () => {
    expect(
      checkQuery(query, variables, records, false).storageKeyFieldNames,
    ).toEqual([
      'me',
      'id',
      'name',
      'lastName',
      'firstName',
      'url',
      'url',
      'profilePicture',
      'uri',
      'profilePicture',
      'uri',
      'screennames',
      'name',
      'backgroundImage',
      'uri',
      'nodes',
      '__typename',
      'id',
      'nodes',
      '__typename',
      'id',
    ]);
    expect(
      checkQuery(query, variables, records, true).storageKeyFieldNames,
    ).toEqual([
      'firstName',
      'url',
      'url',
      'profilePicture',
      'profilePicture',
      'nodes',
      'nodes',
    ]);
  });

  // A checker constructed directly (as `ExecTimeS2CDataChecker` is) takes the
  // flag in effect when it is constructed, not the one of the last `check()`.
  it('sets the key functions when a checker is constructed', () => {
    const off = checkQuery(query, variables, records, false);
    const on = checkQuery(query, variables, records, true);
    expect(on.storageKeyFieldNames).not.toEqual(off.storageKeyFieldNames);
    expect(checkDirectly(query, variables, records, false)).toEqual(
      off.storageKeyFieldNames,
    );
    expect(checkDirectly(query, variables, records, true)).toEqual(
      on.storageKeyFieldNames,
    );
  });

  // Every DataChecker constructor sets the key functions, which all checkers
  // share: a check that a missing-field handler starts in the middle of another
  // one, with the flag unchanged, leaves the outer check's key functions as
  // they were.
  it('keeps the key functions of a check that runs another check', () => {
    let nested = false;
    const nestingHandlers: ReadonlyArray<MissingFieldHandler> = [
      {
        kind: 'scalar',
        handle(field) {
          recordMissingField(field);
          if (!nested) {
            nested = true;
            runCheck(query, variables, records, HANDLERS);
          }
        },
      },
      {kind: 'linked', handle: recordMissingField},
      {kind: 'pluralLinked', handle: recordMissingField},
    ];
    // `firstName(if: true)` is missing, so the scalar handler runs.
    const withMissingField: RecordSourceJSON = {
      ...records,
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
        name: 'Alice',
        lastName: 'Smith',
        'url(relative:true)': '/alice',
        'url(site:"www")': 'https://www.example.com/alice',
        'profilePicture(size:32)': {__ref: 'client:1:profilePicture(size:32)'},
        'profilePicture(size:[64])': {
          __ref: 'client:1:profilePicture(size:[64])',
        },
        screennames: {__refs: ['client:1:screennames:0']},
        backgroundImage: {__ref: 'client:1:backgroundImage'},
      },
    };
    const on = checkQuery(
      query,
      variables,
      withMissingField,
      true,
      nestingHandlers,
    );
    expect(on.missingFieldNames).toEqual(['firstName']);
    expect(on.storageKeyFieldNames).toEqual([
      'firstName',
      // The nested check.
      'firstName',
      'url',
      'url',
      'profilePicture',
      'profilePicture',
      'nodes',
      'nodes',
      // The rest of the outer check.
      'url',
      'url',
      'profilePicture',
      'profilePicture',
      'nodes',
      'nodes',
    ]);
  });
});
