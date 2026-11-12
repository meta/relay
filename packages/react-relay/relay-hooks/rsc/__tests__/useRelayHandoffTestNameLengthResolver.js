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

import type {useRelayHandoffTestNameLengthResolver$key} from './__generated__/useRelayHandoffTestNameLengthResolver.graphql';

const {graphql} = require('relay-runtime');
const {readFragment} = require('relay-runtime/store/ResolverFragments');

/**
 * @relayField User.relayHandoffTestNameLength: Int
 * @rootFragment useRelayHandoffTestNameLengthResolver
 */
function relayHandoffTestNameLength(
  key: useRelayHandoffTestNameLengthResolver$key,
): number {
  const {name} = readFragment(
    graphql`
      fragment useRelayHandoffTestNameLengthResolver on User {
        name
      }
    `,
    key,
  );
  return name?.length ?? 0;
}

module.exports = {relayHandoffTestNameLength};
