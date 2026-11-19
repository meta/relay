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

import type {DataIDSet} from './RelayStoreTypes';

const {ROOT_ID} = require('./RelayStoreUtils');
const {VIEWER_ID} = require('./ViewerPattern');

const ITERATOR_KEY = Symbol.iterator;

function hasSignificantOverlappingIDs(
  seenRecords: DataIDSet,
  updatedRecordIDs: DataIDSet,
): boolean {
  const iterator = seenRecords[ITERATOR_KEY]();
  let next = iterator.next();
  while (next.done !== true) {
    const key = next.value;
    if (updatedRecordIDs.has(key) && key !== ROOT_ID && key !== VIEWER_ID) {
      return true;
    }
    next = iterator.next();
  }
  return false;
}

module.exports = hasSignificantOverlappingIDs;
