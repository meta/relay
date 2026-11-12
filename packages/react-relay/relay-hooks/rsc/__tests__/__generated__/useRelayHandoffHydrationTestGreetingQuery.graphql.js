/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<1c2e66b6afe104dbb92780a8b9590ad4>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffHydrationTestGreeting_user$fragmentType } from "./useRelayHandoffHydrationTestGreeting_user.graphql";
export type useRelayHandoffHydrationTestGreetingQuery$variables = {};
export type useRelayHandoffHydrationTestGreetingQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffHydrationTestGreeting_user$fragmentType,
    },
  },
};
export type useRelayHandoffHydrationTestGreetingQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffHydrationTestGreetingQuery$data,
  variables: useRelayHandoffHydrationTestGreetingQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffHydrationTestGreetingQuery",
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
                  "name": "useRelayHandoffHydrationTestGreeting_user"
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
    "name": "useRelayHandoffHydrationTestGreetingQuery",
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
            "fragment": require('./useRelayHandoffHydrationTestGreeting_user$normalization.graphql'),
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
    "cacheID": "c967cb5528e583eac027945d10735371",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffHydrationTestGreetingQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffHydrationTestGreetingQuery {\n  me {\n    ...useRelayHandoffHydrationTestGreeting_user\n    id\n  }\n}\n\nfragment RelayHandoffTestGreetingResolver on User {\n  name\n}\n\nfragment useRelayHandoffHydrationTestGreeting_user on User {\n  ...RelayHandoffTestGreetingResolver\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffHydrationTestGreeting_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffHydrationTestGreeting_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "5e17bdb682f044d7ebe5e894b3b99ba1";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffHydrationTestGreetingQuery$variables,
  useRelayHandoffHydrationTestGreetingQuery$data,
>*/);
