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

import type {RelayHandoffTestGreetingResolver$key} from './__generated__/RelayHandoffTestGreetingResolver.graphql';
import type {TestResolverContextType} from 'relay-runtime/mutations/__tests__/TestResolverContextType';

const {graphql} = require('relay-runtime');
const {readFragment} = require('relay-runtime/store/ResolverFragments');

/**
 * @relayField User.relayHandoffTestGreeting: String
 * @rootFragment RelayHandoffTestGreetingResolver
 */
function relayHandoffTestGreeting(
  key: RelayHandoffTestGreetingResolver$key,
  _args: void,
  context: TestResolverContextType,
): string {
  const {name} = readFragment(
    graphql`
      fragment RelayHandoffTestGreetingResolver on User {
        name
      }
    `,
    key,
  );
  return `${context.greeting.myHello}, ${name ?? ''}`;
}

module.exports = {relayHandoffTestGreeting};
