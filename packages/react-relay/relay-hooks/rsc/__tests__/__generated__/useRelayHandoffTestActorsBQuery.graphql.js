/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c5748046275f537240406b48c316f904>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestActors_user$fragmentType } from "./useRelayHandoffTestActors_user.graphql";
export type useRelayHandoffTestActorsBQuery$variables = {};
export type useRelayHandoffTestActorsBQuery$data = {
  readonly me: ?{
    readonly actors: {
      readonly $fragmentSpreads: useRelayHandoffTestActors_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestActorsBQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestActorsBQuery$data,
  variables: useRelayHandoffTestActorsBQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestActorsBQuery",
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
    "name": "useRelayHandoffTestActorsBQuery",
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
    "cacheID": "30565d234906ef625cc1f46cc118360d",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestActorsBQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestActorsBQuery {\n  me {\n    ...useRelayHandoffTestActors_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestActors_user on User {\n  actors @stream(label: \"useRelayHandoffTestActors_user$stream$actors\", initial_count: 1) {\n    __typename\n    name\n    id\n  }\n}\n"
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
  (node/*:: as any*/).hash = "ac0a73c3db0919707d7e2e81f82b6e3a";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestActorsBQuery$variables,
  useRelayHandoffTestActorsBQuery$data,
>*/);
