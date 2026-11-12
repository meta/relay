/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<59866685f1bd11f74a6675f9a8108d42>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffHydrationTestNameLength_user$fragmentType } from "./useRelayHandoffHydrationTestNameLength_user.graphql";
export type useRelayHandoffHydrationTestNameLengthAQuery$variables = {};
export type useRelayHandoffHydrationTestNameLengthAQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffHydrationTestNameLength_user$fragmentType,
    },
  },
};
export type useRelayHandoffHydrationTestNameLengthAQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffHydrationTestNameLengthAQuery$data,
  variables: useRelayHandoffHydrationTestNameLengthAQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffHydrationTestNameLengthAQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
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
    "name": "useRelayHandoffHydrationTestNameLengthAQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
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
    "cacheID": "94b1f9c44827e8194ef51c7ce65250a1",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffHydrationTestNameLengthAQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffHydrationTestNameLengthAQuery {\n  me {\n    ...useRelayHandoffHydrationTestNameLength_user\n    id\n  }\n}\n\nfragment useRelayHandoffHydrationTestNameLength_user on User {\n  name\n  ...useRelayHandoffTestNameLengthResolver\n}\n\nfragment useRelayHandoffTestNameLengthResolver on User {\n  name\n}\n"
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

if (__DEV__) {
  (node/*:: as any*/).hash = "980cca654960e8996a8f2475de998003";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffHydrationTestNameLengthAQuery$variables,
  useRelayHandoffHydrationTestNameLengthAQuery$data,
>*/);
