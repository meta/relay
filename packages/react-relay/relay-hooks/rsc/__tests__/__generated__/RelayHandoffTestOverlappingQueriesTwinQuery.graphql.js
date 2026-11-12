/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7a2cae740261575dca0e8206638dd0eb>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestActors_user$fragmentType } from "./useRelayHandoffTestActors_user.graphql";
export type RelayHandoffTestOverlappingQueriesTwinQuery$variables = {};
export type RelayHandoffTestOverlappingQueriesTwinQuery$data = {
  readonly me: ?{
    readonly actors: {
      readonly $fragmentSpreads: useRelayHandoffTestActors_user$fragmentType,
    },
    readonly lastName: ?string,
  },
};
export type RelayHandoffTestOverlappingQueriesTwinQuery = {
  readonly $serverOperation: true,
  response: RelayHandoffTestOverlappingQueriesTwinQuery$data,
  variables: RelayHandoffTestOverlappingQueriesTwinQuery$variables,
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
    "name": "RelayHandoffTestOverlappingQueriesTwinQuery",
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
    "name": "RelayHandoffTestOverlappingQueriesTwinQuery",
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
    "cacheID": "f6ae311f2def305554ed31f30569e4d4",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffTestOverlappingQueriesTwinQuery",
    "operationKind": "query",
    "text": "query RelayHandoffTestOverlappingQueriesTwinQuery {\n  me {\n    lastName\n    ...useRelayHandoffTestActors_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestActors_user on User {\n  actors @stream(label: \"useRelayHandoffTestActors_user$stream$actors\", initial_count: 1) {\n    __typename\n    name\n    id\n  }\n}\n"
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
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "4adf7bf8846b42b8d947e892192d9ef9";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayHandoffTestOverlappingQueriesTwinQuery$variables,
  RelayHandoffTestOverlappingQueriesTwinQuery$data,
>*/);
