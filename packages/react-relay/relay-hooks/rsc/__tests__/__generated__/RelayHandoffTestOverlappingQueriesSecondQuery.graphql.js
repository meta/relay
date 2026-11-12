/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f96c7c4cdf30a6a65b20611a7c3cda21>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestActors_user$fragmentType } from "./useRelayHandoffTestActors_user.graphql";
export type RelayHandoffTestOverlappingQueriesSecondQuery$variables = {};
export type RelayHandoffTestOverlappingQueriesSecondQuery$data = {
  readonly me: ?{
    readonly actors: {
      readonly $fragmentSpreads: useRelayHandoffTestActors_user$fragmentType,
    },
    readonly name: ?string,
  },
};
export type RelayHandoffTestOverlappingQueriesSecondQuery = {
  readonly $serverOperation: true,
  response: RelayHandoffTestOverlappingQueriesSecondQuery$data,
  variables: RelayHandoffTestOverlappingQueriesSecondQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayHandoffTestOverlappingQueriesSecondQuery",
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
    "name": "RelayHandoffTestOverlappingQueriesSecondQuery",
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
    "cacheID": "bfd5eb0a11e511fcc126c9c9552990a0",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffTestOverlappingQueriesSecondQuery",
    "operationKind": "query",
    "text": "query RelayHandoffTestOverlappingQueriesSecondQuery {\n  me {\n    name\n    ...useRelayHandoffTestActors_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestActors_user on User {\n  actors @stream(label: \"useRelayHandoffTestActors_user$stream$actors\", initial_count: 1) {\n    __typename\n    name\n    id\n  }\n}\n"
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
  (node/*:: as any*/).hash = "8915adfc66652d4ef038a717a7fa3034";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayHandoffTestOverlappingQueriesSecondQuery$variables,
  RelayHandoffTestOverlappingQueriesSecondQuery$data,
>*/);
