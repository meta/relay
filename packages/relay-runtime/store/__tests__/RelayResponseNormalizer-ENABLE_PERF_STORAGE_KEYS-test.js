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

// Runs RelayResponseNormalizer-test with ENABLE_PERF_STORAGE_KEYS on, and
// checks that normalizing its payloads then makes no getStorageKey call.
// RelayFeatureFlags is mocked so that every copy of it has the flag on, also
// after jest.resetModules().
jest.mock('../../util/RelayFeatureFlags', () => ({
  ...jest.requireActual('../../util/RelayFeatureFlags'),
  ENABLE_PERF_STORAGE_KEYS: true,
}));

const RelayStoreUtils = require('../RelayStoreUtils');

// Records the normalizer's calls (jest.clearAllMocks() in the suite keeps these
// implementations). getHandleStorageKey, which it still calls for handles,
// shows that the spies are in place.
const getStorageKeyCalls: Array<string> = [];
const getHandleStorageKeyCalls: Array<string> = [];
const actual = {...RelayStoreUtils};
jest
  .spyOn(RelayStoreUtils, 'getStorageKey')
  .mockImplementation((field, variables) => {
    getStorageKeyCalls.push(field.name);
    return actual.getStorageKey(field, variables);
  });
jest
  .spyOn(RelayStoreUtils, 'getHandleStorageKey')
  .mockImplementation((handleField, variables) => {
    getHandleStorageKeyCalls.push(handleField.name);
    return actual.getHandleStorageKey(handleField, variables);
  });

require('./RelayResponseNormalizer-test');

afterAll(() => {
  expect(getHandleStorageKeyCalls).not.toEqual([]);
  expect(getStorageKeyCalls).toEqual([]);
});
