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

// The answer doesn't depend on which set is walked: this walks the smaller one.
function hasOverlappingIDsPerf(
  seenRecords: DataIDSet,
  updatedRecordIDs: DataIDSet,
): boolean {
  let iterated = seenRecords;
  let probed = updatedRecordIDs;
  if (updatedRecordIDs.size < seenRecords.size) {
    iterated = updatedRecordIDs;
    probed = seenRecords;
  }
  const iterator = iterated.values();
  // A block-scoped result lets optimizing compilers drop its allocation.
  while (true) {
    const next = iterator.next();
    if (next.done === true) {
      break;
    }
    if (probed.has(next.value)) {
      return true;
    }
  }
  return false;
}

module.exports = hasOverlappingIDsPerf;
