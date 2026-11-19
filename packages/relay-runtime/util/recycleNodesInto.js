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

const RelayFeatureFlags = require('./RelayFeatureFlags');

/**
 * Recycles subtrees from `prevData` by replacing equal subtrees in `nextData`.
 * Does not mutate a frozen subtree.
 */
function recycleNodesInto<T>(prevData: T, nextData: T): T {
  if (RelayFeatureFlags.ENABLE_PERF_NOTIFY) {
    return recycleNodesIntoImplOptimized(prevData, nextData, true);
  }
  return recycleNodesIntoImpl(prevData, nextData, true);
}

function recycleNodesIntoImpl<T>(
  prevData: T,
  nextData: T,
  canMutate: boolean,
): T {
  if (
    prevData === nextData ||
    typeof prevData !== 'object' ||
    !prevData ||
    (prevData.constructor !== Object && !Array.isArray(prevData)) ||
    typeof nextData !== 'object' ||
    !nextData ||
    (nextData.constructor !== Object && !Array.isArray(nextData))
  ) {
    return nextData;
  }
  let canRecycle = false;

  // Assign local variables to preserve Flow type refinement.
  const prevArray: ?Array<unknown> = Array.isArray(prevData) ? prevData : null;
  const nextArray: ?Array<unknown> = Array.isArray(nextData) ? nextData : null;
  if (prevArray && nextArray) {
    const canMutateNext = canMutate && !Object.isFrozen(nextArray);
    canRecycle =
      nextArray.reduce<boolean>((wasEqual, nextItem, ii) => {
        const prevValue = prevArray[ii];
        const nextValue = recycleNodesIntoImpl(
          prevValue,
          nextItem,
          canMutateNext,
        );
        if (nextValue !== nextArray[ii] && canMutateNext) {
          nextArray[ii] = nextValue;
        }
        return wasEqual && nextValue === prevArray[ii];
      }, true) && prevArray.length === nextArray.length;
  } else if (!prevArray && !nextArray) {
    // Assign local variables to preserve Flow type refinement.
    const prevObject = prevData;
    const nextObject = nextData;
    const prevKeys = Object.keys(prevObject);
    const nextKeys = Object.keys(nextObject);
    const canMutateNext = canMutate && !Object.isFrozen(nextObject);
    canRecycle =
      nextKeys.reduce((wasEqual, key) => {
        const prevValue = prevObject[key];
        const nextValue = recycleNodesIntoImpl(
          prevValue,
          nextObject[key],
          canMutateNext,
        );
        if (nextValue !== nextObject[key] && canMutateNext) {
          // $FlowFixMe[cannot-write]
          nextObject[key] = nextValue;
        }
        return wasEqual && nextValue === prevObject[key];
      }, true) && prevKeys.length === nextKeys.length;
  }
  return canRecycle ? prevData : nextData;
}

function recycleNodesIntoImplOptimized<T>(
  prevData: T,
  nextData: T,
  canMutate: boolean,
): T {
  if (
    prevData === nextData ||
    typeof prevData !== 'object' ||
    !prevData ||
    (prevData.constructor !== Object && !Array.isArray(prevData)) ||
    typeof nextData !== 'object' ||
    !nextData ||
    (nextData.constructor !== Object && !Array.isArray(nextData))
  ) {
    return nextData;
  }
  let canRecycle = false;

  // Assign local variables to preserve Flow type refinement.
  const prevArray: ?Array<unknown> = Array.isArray(prevData) ? prevData : null;
  const nextArray: ?Array<unknown> = Array.isArray(nextData) ? nextData : null;
  if (prevArray && nextArray) {
    // Whether the items may be replaced, checked at the first item that is
    // recycled into.
    let canMutateNext: ?boolean = null;
    let wasEqual = true;
    // Items past the end of prevArray have nothing to recycle: they stay as
    // they are, and the array isn't recycled because the lengths differ.
    // Unlike Array.prototype.reduce, this doesn't read prevArray there, where
    // only its prototype or a Proxy can supply items.
    const length =
      prevArray.length < nextArray.length ? prevArray.length : nextArray.length;
    for (let ii = 0; ii < length; ii++) {
      // Skip holes, as Array.prototype.reduce does.
      if (!(ii in nextArray)) {
        continue;
      }
      const prevValue = prevArray[ii];
      const nextItem = nextArray[ii];
      if (nextItem === prevValue) {
        continue;
      }
      // A changed scalar stays as it is.
      if (typeof nextItem !== 'object' || nextItem === null) {
        wasEqual = false;
        continue;
      }
      if (canMutateNext == null) {
        canMutateNext = canMutate && !Object.isFrozen(nextArray);
      }
      const nextValue = recycleNodesIntoImplOptimized(
        prevValue,
        nextItem,
        canMutateNext,
      );
      if (nextValue !== nextItem && canMutateNext) {
        nextArray[ii] = nextValue;
      }
      wasEqual = wasEqual && nextValue === prevValue;
    }
    canRecycle = wasEqual && prevArray.length === nextArray.length;
  } else if (!prevArray && !nextArray) {
    // Assign local variables to preserve Flow type refinement.
    const prevObject = prevData;
    const nextObject = nextData;
    // As for arrays.
    let canMutateNext: ?boolean = null;
    let wasEqual = true;
    let nextKeyCount = 0;
    // Unlike Object.keys(), for-in also visits inherited enumerable keys, which
    // objects that pass the `constructor === Object` check above only have
    // when created with Object.create() from such an object.
    for (const key in nextObject) {
      nextKeyCount++;
      const prevValue = prevObject[key];
      const nextItem = nextObject[key];
      if (nextItem === prevValue) {
        continue;
      }
      if (typeof nextItem !== 'object' || nextItem === null) {
        wasEqual = false;
        continue;
      }
      if (canMutateNext == null) {
        canMutateNext = canMutate && !Object.isFrozen(nextObject);
      }
      const nextValue = recycleNodesIntoImplOptimized(
        prevValue,
        nextItem,
        canMutateNext,
      );
      if (nextValue !== nextItem && canMutateNext) {
        setRecycledValue(nextObject, key, nextValue);
      }
      wasEqual = wasEqual && nextValue === prevValue;
    }
    canRecycle = wasEqual && countKeys(prevObject) === nextKeyCount;
  }
  return canRecycle ? prevData : nextData;
}

// Writes a recycled value into the next data, which recycleNodesInto() owns
// while `canMutate` holds: callers pass their read-only view of it.
declare function setRecycledValue(
  object: {readonly [key: string]: unknown},
  key: string,
  value: unknown,
): void;
function setRecycledValue(
  object: {[key: string]: unknown},
  key: string,
  value: unknown,
): void {
  object[key] = value;
}

function countKeys(object: {...}): number {
  let count = 0;
  for (const _key in object) {
    count++;
  }
  return count;
}

module.exports = recycleNodesInto;
