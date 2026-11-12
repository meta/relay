/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<e81c9d432d390c53b6b80aebbf045f95>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestDeferParent_user$fragmentType } from "./useRelayHandoffTestDeferParent_user.graphql";
export type useRelayHandoffHydrationTestDeferTwinQuery$variables = {};
export type useRelayHandoffHydrationTestDeferTwinQuery$data = {
  readonly me: ?{
    readonly parent: {
      readonly $fragmentSpreads: useRelayHandoffTestDeferParent_user$fragmentType,
    },
  },
};
export type useRelayHandoffHydrationTestDeferTwinQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffHydrationTestDeferTwinQuery$data,
  variables: useRelayHandoffHydrationTestDeferTwinQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffHydrationTestDeferTwinQuery",
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
                  "name": "useRelayHandoffTestDeferParent_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "parent"
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
    "name": "useRelayHandoffHydrationTestDeferTwinQuery",
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
            "fragment": require('./useRelayHandoffTestDeferParent_user$normalization.graphql'),
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
    "cacheID": "f5878d69a9a685ba0c132a810fbf66b3",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffHydrationTestDeferTwinQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffHydrationTestDeferTwinQuery {\n  me {\n    ...useRelayHandoffTestDeferParent_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestDeferChild_user on User {\n  lastName\n}\n\nfragment useRelayHandoffTestDeferParent_user on User {\n  name\n  ...useRelayHandoffTestDeferChild_user @defer(label: \"useRelayHandoffTestDeferParent_user$defer$child\")\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestDeferParent_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestDeferParent_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "694750363157294c4a924aab85ee5582";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffHydrationTestDeferTwinQuery$variables,
  useRelayHandoffHydrationTestDeferTwinQuery$data,
>*/);
