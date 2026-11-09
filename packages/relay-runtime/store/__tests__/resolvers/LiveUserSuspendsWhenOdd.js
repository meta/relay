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

import type {DataID} from 'relay-runtime';
import type {LiveState} from 'relay-runtime';

const {GLOBAL_STORE, Selectors} = require('./ExampleExternalStateStore');
const {suspenseSentinel} = require('relay-runtime');

/**
 * @relayField Query.live_user_suspends_when_odd: User
 * @live
 */
function live_user_suspends_when_odd(): LiveState<{readonly id: DataID}> {
  return {
    read() {
      const number = Selectors.getNumber(GLOBAL_STORE.getState());
      if (number % 2 !== 0) {
        return suspenseSentinel();
      } else {
        return {id: String(number)};
      }
    },
    subscribe(cb): () => void {
      return GLOBAL_STORE.subscribe(cb);
    },
    getSuspenseDisplayName(): ?string {
      displayNameCallCount++;
      return 'LiveUserSuspendsWhenOdd(waiting for even)';
    },
  };
}

let displayNameCallCount = 0;

const __debug = {
  getDisplayNameCallCount(): number {
    return displayNameCallCount;
  },
  resetDisplayNameCallCount() {
    displayNameCallCount = 0;
  },
};

module.exports = {
  __debug,
  live_user_suspends_when_odd,
};
