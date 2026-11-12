/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<16a8fd82d337273625d62caf087288b8>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffTestLiveNameResolver$key } from "./RelayHandoffTestLiveNameResolver.graphql";
import type { LiveState, FragmentType } from "relay-runtime";
import {relayHandoffTestLiveName as userRelayHandoffTestLiveNameResolverType} from "../RelayHandoffTestLiveNameResolver.js";
import type { TestResolverContextType } from "../../../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `userRelayHandoffTestLiveNameResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userRelayHandoffTestLiveNameResolverType as (
  rootKey: RelayHandoffTestLiveNameResolver$key,
  args: void,
  context: TestResolverContextType,
) => LiveState<?string>);
declare export opaque type useRelayHandoffHydrationTestLiveName_user$fragmentType: FragmentType;
export type useRelayHandoffHydrationTestLiveName_user$data = {
  readonly relayHandoffTestLiveName: ?string,
  readonly $fragmentType: useRelayHandoffHydrationTestLiveName_user$fragmentType,
};
export type useRelayHandoffHydrationTestLiveName_user$key = {
  readonly $data?: useRelayHandoffHydrationTestLiveName_user$data,
  readonly $fragmentSpreads: useRelayHandoffHydrationTestLiveName_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffHydrationTestLiveName_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "fragment": {
        "args": null,
        "kind": "FragmentSpread",
        "name": "RelayHandoffTestLiveNameResolver"
      },
      "kind": "RelayLiveResolver",
      "name": "relayHandoffTestLiveName",
      "resolverModule": require('../RelayHandoffTestLiveNameResolver').relayHandoffTestLiveName,
      "path": "relayHandoffTestLiveName"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "870901a613f7a4655b97d043ef291082";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffHydrationTestLiveName_user$fragmentType,
  useRelayHandoffHydrationTestLiveName_user$data,
>*/);
