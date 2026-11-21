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

import type {OuterResolver$key} from './__generated__/OuterResolver.graphql';

const {graphql} = require('relay-runtime');
const {readFragment} = require('relay-runtime/store/ResolverFragments');

/**
 * @relayField Query.outer: Int
 * @rootFragment OuterResolver
 */
function outer(rootKey: OuterResolver$key): number | null | undefined {
  const data = readFragment(
    graphql`
      fragment OuterResolver on Query {
        inner
      }
    `,
    rootKey,
  );
  return data.inner;
}

module.exports = {
  outer,
};
