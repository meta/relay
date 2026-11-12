/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4926a0604ac1cf07d9af06e2d25d85b5>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffTestGreetingResolver$key } from "./RelayHandoffTestGreetingResolver.graphql";
import type { FragmentType } from "relay-runtime";
import {relayHandoffTestGreeting as userRelayHandoffTestGreetingResolverType} from "../RelayHandoffTestGreetingResolver.js";
import type { TestResolverContextType } from "../../../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `userRelayHandoffTestGreetingResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userRelayHandoffTestGreetingResolverType as (
  rootKey: RelayHandoffTestGreetingResolver$key,
  args: void,
  context: TestResolverContextType,
) => ?string);
declare export opaque type useRelayHandoffHydrationTestGreeting_user$fragmentType: FragmentType;
export type useRelayHandoffHydrationTestGreeting_user$data = {
  readonly relayHandoffTestGreeting: ?string,
  readonly $fragmentType: useRelayHandoffHydrationTestGreeting_user$fragmentType,
};
export type useRelayHandoffHydrationTestGreeting_user$key = {
  readonly $data?: useRelayHandoffHydrationTestGreeting_user$data,
  readonly $fragmentSpreads: useRelayHandoffHydrationTestGreeting_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffHydrationTestGreeting_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "fragment": {
        "args": null,
        "kind": "FragmentSpread",
        "name": "RelayHandoffTestGreetingResolver"
      },
      "kind": "RelayResolver",
      "name": "relayHandoffTestGreeting",
      "resolverModule": require('../RelayHandoffTestGreetingResolver').relayHandoffTestGreeting,
      "path": "relayHandoffTestGreeting"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "8b90758f0b014575fc0781f674e8b642";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffHydrationTestGreeting_user$fragmentType,
  useRelayHandoffHydrationTestGreeting_user$data,
>*/);
