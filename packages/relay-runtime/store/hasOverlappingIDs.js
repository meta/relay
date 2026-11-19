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

const ITERATOR_KEY = Symbol.iterator;

function hasOverlappingIDs(
  seenRecords: DataIDSet,
  updatedRecordIDs: DataIDSet,
): boolean {
  const iterator = seenRecords[ITERATOR_KEY]();
  let next = iterator.next();
  while (next.done !== true) {
    const key = next.value;
    if (updatedRecordIDs.has(key)) {
      return true;
    }
    next = iterator.next();
  }
  return false;
}

module.exports = hasOverlappingIDs;
