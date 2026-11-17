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

const RelayFeatureFlags = require('./RelayFeatureFlags');

const arraySome = Array.prototype.some;

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
function hasCycle(value: unknown, parents?: Set<unknown>): boolean {
  if (RelayFeatureFlags.ENABLE_PERF_QUERY) {
    return hasCycleOnPath(
      value,
      parents === undefined || parents.size === 0 ? [] : Array.from(parents),
    );
  }
  return hasCycleInSet(value, parents === undefined ? new Set() : parents);
}

// The check without ENABLE_PERF_QUERY, and for arrays whose some() isn't
// Array.prototype.some: `parents` holds the ancestors of `value`.
function hasCycleInSet(value: unknown, parents: Set<unknown>): boolean {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  if (parents.has(value)) {
    return true;
  }

  const newParents = new Set(parents);
  newParents.add(value);

  const children = Array.isArray(value) ? value : Object.values(value);

  return children.some(v => hasCycleInSet(v, newParents));
}

// `path` holds the ancestors of `value`.
function hasCycleOnPath(value: unknown, path: Array<unknown>): boolean {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  if (path.includes(value)) {
    return true;
  }
  let children: ReadonlyArray<unknown>;
  if (Array.isArray(value)) {
    // hasCycleInSet() calls the array's some(): an array whose some() is not
    // Array.prototype.some gets that check.
    const arrayLike: interface {readonly some?: unknown} = value;
    if (arrayLike.some !== arraySome) {
      return hasCycleInSet(value, new Set(path));
    }
    children = value;
  } else {
    children = Object.values(value);
  }
  path.push(value);
  let found = false;
  // Read once, as some() reads it.
  const length = children.length;
  for (let i = 0; i < length && !found; i++) {
    found = hasCycleOnPath(children[i], path);
  }
  path.pop();
  return found;
}

module.exports = {
  hasCycle,
  stableCopy,
};
