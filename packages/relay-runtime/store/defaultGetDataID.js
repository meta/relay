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

const {VIEWER_ID, VIEWER_TYPE} = require('./ViewerPattern');

function defaultGetDataID(
  fieldValue: {readonly [key: string]: unknown},
  typeName: string,
): unknown {
  if (typeName === VIEWER_TYPE) {
    return fieldValue.id == null ? VIEWER_ID : fieldValue.id;
  }
  return fieldValue.id;
}

module.exports = defaultGetDataID;
