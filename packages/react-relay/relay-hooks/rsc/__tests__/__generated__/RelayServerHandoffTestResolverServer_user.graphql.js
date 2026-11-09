/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<df66474dcefe1790d9b6a03a3d94f6d1>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayServerHandoffTestDeferred_user$fragmentType } from "./RelayServerHandoffTestDeferred_user.graphql";
import type { FragmentType } from "relay-runtime";
import {relayServerHandoffTestJoined as userRelayServerHandoffTestJoinedResolverType} from "../RelayServerHandoffTestJoinedResolver.js";
import type { TestResolverContextType } from "../../../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `userRelayServerHandoffTestJoinedResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userRelayServerHandoffTestJoinedResolverType as (
  args: void,
  context: TestResolverContextType,
) => ?unknown);
declare export opaque type RelayServerHandoffTestResolverServer_user$fragmentType: FragmentType;
export type RelayServerHandoffTestResolverServer_user$data = {
  readonly client: {
    readonly $fragmentSpreads: RelayServerHandoffTestDeferred_user$fragmentType,
  },
  readonly relayServerHandoffTestJoined: ?ReturnType<typeof userRelayServerHandoffTestJoinedResolverType>,
  readonly $fragmentType: RelayServerHandoffTestResolverServer_user$fragmentType,
};
export type RelayServerHandoffTestResolverServer_user$key = {
  readonly $data?: RelayServerHandoffTestResolverServer_user$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: RelayServerHandoffTestResolverServer_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "RelayServerHandoffTestResolverServer_user",
  "selections": [
    {
      "fragment": {
        "kind": "InlineFragment",
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayServerHandoffTestDeferred_user"
          }
        ],
        "type": "User",
        "abstractKey": null
      },
      "kind": "AliasedInlineFragmentSpread",
      "name": "client"
    },
    {
      "kind": "ClientExtension",
      "selections": [
        {
          "alias": null,
          "args": null,
          "fragment": null,
          "kind": "RelayResolver",
          "name": "relayServerHandoffTestJoined",
          "resolverModule": require('../RelayServerHandoffTestJoinedResolver').relayServerHandoffTestJoined,
          "path": "relayServerHandoffTestJoined"
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "1c15712a6b4e754c78c72c8df56758ad";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestResolverServer_user$fragmentType,
  RelayServerHandoffTestResolverServer_user$data,
>*/);
