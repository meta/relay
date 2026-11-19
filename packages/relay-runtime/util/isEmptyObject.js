/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 * @oncall relay
 */

'use strict';

const hasOwnProperty = Object.prototype.hasOwnProperty;

function isEmptyObject(obj: {readonly [key: string]: unknown}): boolean {
  for (const key in obj) {
    /* $FlowFixMe[invalid-this-arg] Error exposed after fixing this typing
     * unsoundness in flow */
    if (hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

module.exports = isEmptyObject;
