/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<bcbe50a7638c83ab12af3988cf7fa59b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestStreamConnection_user$fragmentType } from "./useRelayHandoffTestStreamConnection_user.graphql";
export type useRelayHandoffTestStreamConnectionQuery$variables = {};
export type useRelayHandoffTestStreamConnectionQuery$data = {
  readonly me: ?{
    readonly people: {
      readonly $fragmentSpreads: useRelayHandoffTestStreamConnection_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestStreamConnectionQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestStreamConnectionQuery$data,
  variables: useRelayHandoffTestStreamConnectionQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestStreamConnectionQuery",
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
                  "name": "useRelayHandoffTestStreamConnection_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "people"
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
    "name": "useRelayHandoffTestStreamConnectionQuery",
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
            "fragment": require('./useRelayHandoffTestStreamConnection_user$normalization.graphql'),
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
    "cacheID": "a0f8b7b285fb5e3a1161bc8b7bc73716",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestStreamConnectionQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestStreamConnectionQuery {\n  me {\n    ...useRelayHandoffTestStreamConnection_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestStreamConnection_user on User {\n  friends(first: 3) {\n    edges @stream(label: \"useRelayHandoffTestStreamConnection_user$stream$people\", initial_count: 1) {\n      node {\n        name\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestStreamConnection_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestStreamConnection_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "7522115c37c1c7572139859580480278";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestStreamConnectionQuery$variables,
  useRelayHandoffTestStreamConnectionQuery$data,
>*/);
