/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<cf57dc05666c4f2353d37be8c15da730>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffHydrationTestNameLength_user$fragmentType } from "./useRelayHandoffHydrationTestNameLength_user.graphql";
export type useRelayHandoffHydrationTestNameLengthBQuery$variables = {};
export type useRelayHandoffHydrationTestNameLengthBQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffHydrationTestNameLength_user$fragmentType,
    },
    readonly lastName: ?string,
  },
};
export type useRelayHandoffHydrationTestNameLengthBQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffHydrationTestNameLengthBQuery$data,
  variables: useRelayHandoffHydrationTestNameLengthBQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lastName",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffHydrationTestNameLengthBQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v0/*:: as any*/),
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "useRelayHandoffHydrationTestNameLength_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "client"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useRelayHandoffHydrationTestNameLengthBQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v0/*:: as any*/),
          {
            "fragment": require('./useRelayHandoffHydrationTestNameLength_user$normalization.graphql'),
            "kind": "FragmentSpread"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a7e1659a33685086d50cdc8937c17382",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffHydrationTestNameLengthBQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffHydrationTestNameLengthBQuery {\n  me {\n    lastName\n    ...useRelayHandoffHydrationTestNameLength_user\n    id\n  }\n}\n\nfragment useRelayHandoffHydrationTestNameLength_user on User {\n  name\n  ...useRelayHandoffTestNameLengthResolver\n}\n\nfragment useRelayHandoffTestNameLengthResolver on User {\n  name\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffHydrationTestNameLength_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffHydrationTestNameLength_user.graphql')
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "6ff79cb266b2bc4b518dda4b66d79b5d";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffHydrationTestNameLengthBQuery$variables,
  useRelayHandoffHydrationTestNameLengthBQuery$data,
>*/);
