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

import type {RelayHandoffTestLiveNameResolver$key} from './__generated__/RelayHandoffTestLiveNameResolver.graphql';
import type {LiveState} from 'relay-runtime';

const {graphql} = require('relay-runtime');
const {readFragment} = require('relay-runtime/store/ResolverFragments');

const state: {
  suffix: string,
  subscribers: Set<() => void>,
  unsubscribed: number,
} = {
  subscribers: new Set(),
  suffix: 'online',
  unsubscribed: 0,
};

/**
 * @relayField User.relayHandoffTestLiveName: String
 * @rootFragment RelayHandoffTestLiveNameResolver
 * @live
 */
function relayHandoffTestLiveName(
  key: RelayHandoffTestLiveNameResolver$key,
): LiveState<string> {
  const {name} = readFragment(
    graphql`
      fragment RelayHandoffTestLiveNameResolver on User {
        name
      }
    `,
    key,
  );
  return {
    read: () => `${name ?? ''} (${state.suffix})`,
    subscribe(callback: () => void): () => void {
      state.subscribers.add(callback);
      return () => {
        state.unsubscribed++;
        state.subscribers.delete(callback);
      };
    },
  };
}

// Changes the external state every `relayHandoffTestLiveName` reads.
function setRelayHandoffTestLiveSuffix(suffix: string): void {
  state.suffix = suffix;
  state.subscribers.forEach(callback => callback());
}

// How many subscriptions to that state are open, and how many times one was
// ended.
function relayHandoffTestLiveSubscriptions(): {open: number, ended: number} {
  return {ended: state.unsubscribed, open: state.subscribers.size};
}

module.exports = {
  relayHandoffTestLiveName,
  relayHandoffTestLiveSubscriptions,
  setRelayHandoffTestLiveSuffix,
};
