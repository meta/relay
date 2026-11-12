/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<550a22a34d68f885b4ad5870b500a7be>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestActors_user$fragmentType } from "./useRelayHandoffTestActors_user.graphql";
export type useRelayHandoffTestActorsQuery$variables = {};
export type useRelayHandoffTestActorsQuery$data = {
  readonly me: ?{
    readonly actors: {
      readonly $fragmentSpreads: useRelayHandoffTestActors_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestActorsQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestActorsQuery$data,
  variables: useRelayHandoffTestActorsQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestActorsQuery",
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
                  "name": "useRelayHandoffTestActors_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "actors"
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
    "name": "useRelayHandoffTestActorsQuery",
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
            "fragment": require('./useRelayHandoffTestActors_user$normalization.graphql'),
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
    "cacheID": "da4e64b1b8649b08bfd1042658fba290",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestActorsQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestActorsQuery {\n  me {\n    ...useRelayHandoffTestActors_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestActors_user on User {\n  actors @stream(label: \"useRelayHandoffTestActors_user$stream$actors\", initial_count: 1) {\n    __typename\n    name\n    id\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestActors_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestActors_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "1c8a4ff5a98a1a35796ee1a6e5ddfa1d";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestActorsQuery$variables,
  useRelayHandoffTestActorsQuery$data,
>*/);
