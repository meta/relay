/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<3d1306c81c99778dcc39d3801871c1cf>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
import type { useRelayHandoffTestFriends_user$fragmentType } from "./useRelayHandoffTestFriends_user.graphql";
export type useRelayHandoffTestFriendsPaginationQuery$variables = {
  count?: ?number,
  cursor?: ?string,
  id: string,
};
export type useRelayHandoffTestFriendsPaginationQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: useRelayHandoffTestFriends_user$fragmentType,
  },
};
export type useRelayHandoffTestFriendsPaginationQuery = {
  response: useRelayHandoffTestFriendsPaginationQuery$data,
  variables: useRelayHandoffTestFriendsPaginationQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": 1,
    "kind": "LocalArgument",
    "name": "count"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "cursor"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestFriendsPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": [
              {
                "kind": "Variable",
                "name": "count",
                "variableName": "count"
              },
              {
                "kind": "Variable",
                "name": "cursor",
                "variableName": "cursor"
              }
            ],
            "kind": "FragmentSpread",
            "name": "useRelayHandoffTestFriends_user"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useRelayHandoffTestFriendsPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": [
                  {
                    "kind": "Variable",
                    "name": "useRelayHandoffTestFriends_user$count",
                    "variableName": "count"
                  },
                  {
                    "kind": "Variable",
                    "name": "useRelayHandoffTestFriends_user$cursor",
                    "variableName": "cursor"
                  }
                ],
                "fragment": require('./useRelayHandoffTestFriends_user$normalization.graphql'),
                "kind": "FragmentSpread"
              }
            ],
            "type": "User",
            "abstractKey": null
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
    "cacheID": "d0c912fb4d146265aecf33ae7ce30f0e",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestFriendsPaginationQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestFriendsPaginationQuery(\n  $count: Int = 1\n  $cursor: ID\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...useRelayHandoffTestFriends_user_1G22uz\n    id\n  }\n}\n\nfragment useRelayHandoffTestFriends_user_1G22uz on User {\n  friends(first: $count, after: $cursor) {\n    edges {\n      node {\n        name\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "bd05b32f7d78e98867a8ff43e91aef46";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  useRelayHandoffTestFriendsPaginationQuery$variables,
  useRelayHandoffTestFriendsPaginationQuery$data,
>*/);
