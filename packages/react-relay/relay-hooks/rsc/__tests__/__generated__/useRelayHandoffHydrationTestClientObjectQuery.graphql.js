/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<9d3d663365a3842767b7d9ff4d22b77b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffHydrationTestClientObject_query$fragmentType } from "./useRelayHandoffHydrationTestClientObject_query.graphql";
export type useRelayHandoffHydrationTestClientObjectQuery$variables = {};
export type useRelayHandoffHydrationTestClientObjectQuery$data = {
  readonly client: {
    readonly $fragmentSpreads: useRelayHandoffHydrationTestClientObject_query$fragmentType,
  },
};
export type useRelayHandoffHydrationTestClientObjectQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffHydrationTestClientObjectQuery$data,
  variables: useRelayHandoffHydrationTestClientObjectQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffHydrationTestClientObjectQuery",
    "selections": [
      {
        "fragment": {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": null,
              "kind": "FragmentSpread",
              "name": "useRelayHandoffHydrationTestClientObject_query"
            }
          ],
          "type": "Query",
          "abstractKey": null
        },
        "kind": "AliasedInlineFragmentSpread",
        "name": "client"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useRelayHandoffHydrationTestClientObjectQuery",
    "selections": [
      {
        "fragment": require('./useRelayHandoffHydrationTestClientObject_query$normalization.graphql'),
        "kind": "FragmentSpread"
      }
    ]
  },
  "params": {
    "cacheID": "5cc8312c9d0768c9b7f27b4076953100",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffHydrationTestClientObjectQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffHydrationTestClientObjectQuery {\n  ...useRelayHandoffHydrationTestClientObject_query\n}\n\nfragment useRelayHandoffHydrationTestClientObject_query on Query {\n  me {\n    name\n    id\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffHydrationTestClientObject_query$normalization.graphql'),
        "fragment": require('./useRelayHandoffHydrationTestClientObject_query.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "617e257b13f8476e67cbaf6d66a71b2d";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffHydrationTestClientObjectQuery$variables,
  useRelayHandoffHydrationTestClientObjectQuery$data,
>*/);
