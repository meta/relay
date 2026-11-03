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

import type {DataID} from '../util/RelayRuntimeTypes';

const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const {intern} = require('../util/StringInterner');

const PREFIX = 'client:';

function generateClientID(
  id: DataID,
  storageKey: string,
  index?: number,
): DataID {
  if (RelayFeatureFlags.ENABLE_PERF_PUBLISH) {
    return generateClientIDPerf(id, storageKey, index);
  }
  const internedId =
    RelayFeatureFlags.STRING_INTERN_LEVEL <= 0
      ? id
      : intern(id, RelayFeatureFlags.MAX_DATA_ID_LENGTH);
  let key = internedId + ':' + storageKey;
  if (index != null) {
    key += ':' + index;
  }
  if (key.indexOf(PREFIX) !== 0) {
    key = PREFIX + key;
  }
  return key;
}

function isClientID(id: DataID): boolean {
  return id.indexOf(PREFIX) === 0;
}

let localID: number = 0;
function generateUniqueClientID(): DataID {
  return `${PREFIX}local:${localID++}`;
}

// Client objects backed by Relay Resolvers may not be able to provide a
// globally unique ID, so we provide a namespace.
function generateClientObjectClientID(
  typename: string,
  localId: string,
  index?: number,
): DataID {
  let key = `${PREFIX}${typename}:${localId}`;
  if (index != null) {
    key += ':' + index;
  }
  return key;
}

// ----------------------------------------------------------------------
// Optimized variants (`*Perf`) of the functions above.
// Used only when ENABLE_PERF_PUBLISH is on; with it off the code above runs
// unchanged.

function generateClientIDPerf(
  id: DataID,
  storageKey: string,
  index?: number,
): DataID {
  const internedId =
    RelayFeatureFlags.STRING_INTERN_LEVEL <= 0
      ? id
      : intern(id, RelayFeatureFlags.MAX_DATA_ID_LENGTH);
  let key = internedId + ':' + storageKey;
  if (index != null) {
    key += ':' + index;
  }
  // Decide from the (already flat) parent ID when it is at least as long as
  // the prefix: checking the concatenated key flattens it, and prepending the
  // prefix afterwards makes the key get flattened again when it is hashed.
  // Untyped callers can pass a parent ID that is not a string.
  if (
    typeof internedId === 'string' && internedId.length >= PREFIX.length
      ? internedId.lastIndexOf(PREFIX, 0) !== 0
      : key.indexOf(PREFIX) !== 0
  ) {
    key = PREFIX + key;
  }
  return key;
}

module.exports = {
  generateClientID,
  generateClientObjectClientID,
  generateUniqueClientID,
  isClientID,
};
