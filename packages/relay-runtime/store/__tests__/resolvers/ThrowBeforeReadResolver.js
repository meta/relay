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

import type {ThrowBeforeReadResolver$key} from './__generated__/ThrowBeforeReadResolver.graphql';

const {graphql} = require('relay-runtime');
const {readFragment} = require('relay-runtime/store/ResolverFragments');

/**
 * @relayField Query.throw_before_read: RelayResolverValue
 * @rootFragment ThrowBeforeReadResolver
 *
 * A resolver that exercises the edge case where a resolver throws before reading.
 */
function throw_before_read(rootKey: ThrowBeforeReadResolver$key): void {
  // Trick Flow's unreachable code detection.
  if (true) {
    throw new Error(
      'Purposefully throwing before reading to exercise an edge case.',
    );
  }
  readFragment(
    graphql`
      fragment ThrowBeforeReadResolver on Query {
        # We don't need to read any Relay state here, but this works for now
        me {
          __id
        }
      }
    `,
    rootKey,
  );
}

module.exports = {
  throw_before_read,
};
