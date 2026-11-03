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
import type {DataID} from 'relay-runtime/util/RelayRuntimeTypes';

const {
  generateClientID,
  generateUniqueClientID,
  isClientID,
} = require('../ClientID');

it('creates unique local ids', () => {
  const set = new Set<DataID>();
  for (let i = 0; i < 10; i++) {
    const id = generateUniqueClientID();
    expect(set.has(id)).toBe(false);
    set.add(id);
  }
});

it('can detect created client ids', () => {
  expect(isClientID(generateUniqueClientID())).toBe(true);
  expect(isClientID(generateClientID('0', ''))).toBe(true);
  expect(isClientID('<server-id>')).toBe(false);
});

it('does not add extra prefix to a client id', () => {
  const clientID = 'client:0';
  expect(generateClientID(clientID, 'a')).toEqual(`${clientID}:a`);
});

it('prefixes keys exactly when the full key does not start with the prefix', () => {
  const prefixed = (key: string) =>
    key.indexOf('client:') === 0 ? key : 'client:' + key;
  [
    ['Story:1', 'feedback', undefined],
    ['client:Story:1:feedback', 'comments', 2],
    ['client', 'x', undefined],
    ['clien', 't:x', undefined],
    ['', 'client:x', undefined],
    ['c', 'lient:x', 0],
    ['12345', 'name', 3],
  ].forEach(([id, storageKey, index]) => {
    const key = id + ':' + storageKey + (index != null ? ':' + index : '');
    expect(generateClientID(id, storageKey, index)).toBe(prefixed(key));
  });
});

it('builds keys for parent IDs that are not strings from their string form', () => {
  // Untyped callers can pass any value; read from JSON to get past Flow.
  const [nullID, numericID]: ReadonlyArray<DataID> =
    JSON.parse('[null, 1234567]');
  const undefinedID: DataID = JSON.parse('{}').id;
  expect(generateClientID(nullID, 'friends')).toBe('client:null:friends');
  expect(generateClientID(undefinedID, 'friends', 1)).toBe(
    'client:undefined:friends:1',
  );
  expect(generateClientID(numericID, 'friends')).toBe('client:1234567:friends');
});
