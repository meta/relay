/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 */

/**
 * @relayField User.age: Int
 */
function age(_: unknown, context: {readonly age?: number, ...}): ?number {
  return context.age;
}

module.exports = {
  age,
};
