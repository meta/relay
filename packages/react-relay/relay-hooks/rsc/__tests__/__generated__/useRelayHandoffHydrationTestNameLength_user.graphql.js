/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a71f023d76866e0605b564e2d1aa4d4a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useRelayHandoffTestNameLengthResolver$key } from "./useRelayHandoffTestNameLengthResolver.graphql";
import type { FragmentType } from "relay-runtime";
import {relayHandoffTestNameLength as userRelayHandoffTestNameLengthResolverType} from "../useRelayHandoffTestNameLengthResolver.js";
import type { TestResolverContextType } from "../../../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `userRelayHandoffTestNameLengthResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userRelayHandoffTestNameLengthResolverType as (
  rootKey: useRelayHandoffTestNameLengthResolver$key,
  args: void,
  context: TestResolverContextType,
) => ?number);
declare export opaque type useRelayHandoffHydrationTestNameLength_user$fragmentType: FragmentType;
export type useRelayHandoffHydrationTestNameLength_user$data = {
  readonly name: ?string,
  readonly relayHandoffTestNameLength: ?number,
  readonly $fragmentType: useRelayHandoffHydrationTestNameLength_user$fragmentType,
};
export type useRelayHandoffHydrationTestNameLength_user$key = {
  readonly $data?: useRelayHandoffHydrationTestNameLength_user$data,
  readonly $fragmentSpreads: useRelayHandoffHydrationTestNameLength_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffHydrationTestNameLength_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "fragment": {
        "args": null,
        "kind": "FragmentSpread",
        "name": "useRelayHandoffTestNameLengthResolver"
      },
      "kind": "RelayResolver",
      "name": "relayHandoffTestNameLength",
      "resolverModule": require('../useRelayHandoffTestNameLengthResolver').relayHandoffTestNameLength,
      "path": "relayHandoffTestNameLength"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "bb009423314c8f761b07e5dea4e02089";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffHydrationTestNameLength_user$fragmentType,
  useRelayHandoffHydrationTestNameLength_user$data,
>*/);
