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

import type {IEnvironment} from 'relay-runtime';

const invariant = require('invariant');
const {RelayFeatureFlags} = require('relay-runtime');

/**
 * Makes `useFragment` (and the hooks built on it) read, from `environment`,
 * the fragment references that server components hand client components (see
 * `serverQuery`). Other Environments are unaffected: their readers call no
 * extra hooks. Importing this module alone changes nothing.
 *
 * Call it once per Environment, before a fragment is first read from it: for
 * example where the Environment is created. It throws if a fragment has
 * already been read from that Environment, because components that already
 * rendered would then call a different number of hooks. For the same reason,
 * a mounted reader must not move between an Environment with it installed
 * and one without.
 */
function installRelayHandoff(environment: IEnvironment): void {
  invariant(
    RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS,
    'installRelayHandoff: Relay RSC requires ' +
      '`RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS` (on by ' +
      'default). Set `RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS ' +
      '= true`, with `RelayFeatureFlags` from `relay-runtime`.',
  );
  const {installHandoffHook} = require('./RelayHandoffSeam');
  installHandoffHook(environment, require('./useRelayHandoff'));
}

module.exports = installRelayHandoff;
