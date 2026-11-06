/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

'use strict';

/**
 * Creates a copy of the provided value, ensuring any nested objects have their
 * keys sorted such that equivalent values would have identical JSON.stringify
 * results.
 */
function stableCopy<T extends unknown>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stableCopy);
  }
  const keys = Object.keys(value).sort();
  const stable: {[key: string]: unknown} = {};
  for (let i = 0; i < keys.length; i++) {
    stable[keys[i]] = stableCopy(value[keys[i]]);
  }
  return stable as any;
}

// Detect if a data structure contains cycles. The logic here mirrors
// `stableCopy` above and is intended to detect cycles early before they get
// passed to `stableCopy` which would result in a stack overflow.
function hasCycle(value: unknown, parents: Set<unknown> = new Set()): boolean {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  if (parents.has(value)) {
    return true;
  }

  const newParents = new Set(parents);
  newParents.add(value);

  const children = Array.isArray(value) ? value : Object.values(value);

  return children.some(v => hasCycle(v, newParents));
}

module.exports = {
  hasCycle,
  stableCopy,
};
