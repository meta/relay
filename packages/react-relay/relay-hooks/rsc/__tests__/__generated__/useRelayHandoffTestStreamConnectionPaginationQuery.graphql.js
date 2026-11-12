/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<216fe94858b39868cc3e63c61747fa7d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
import type { useRelayHandoffTestStreamConnection_user$fragmentType } from "./useRelayHandoffTestStreamConnection_user.graphql";
export type useRelayHandoffTestStreamConnectionPaginationQuery$variables = {
  count?: ?number,
  cursor?: ?string,
  id: string,
};
export type useRelayHandoffTestStreamConnectionPaginationQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: useRelayHandoffTestStreamConnection_user$fragmentType,
  },
};
export type useRelayHandoffTestStreamConnectionPaginationQuery = {
  response: useRelayHandoffTestStreamConnectionPaginationQuery$data,
  variables: useRelayHandoffTestStreamConnectionPaginationQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": 3,
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
    "name": "useRelayHandoffTestStreamConnectionPaginationQuery",
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
            "name": "useRelayHandoffTestStreamConnection_user"
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
    "name": "useRelayHandoffTestStreamConnectionPaginationQuery",
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
                    "name": "useRelayHandoffTestStreamConnection_user$count",
                    "variableName": "count"
                  },
                  {
                    "kind": "Variable",
                    "name": "useRelayHandoffTestStreamConnection_user$cursor",
                    "variableName": "cursor"
                  }
                ],
                "fragment": require('./useRelayHandoffTestStreamConnection_user$normalization.graphql'),
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
    "cacheID": "f58e4af65f5ff8784fffbb64a55025fe",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestStreamConnectionPaginationQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestStreamConnectionPaginationQuery(\n  $count: Int = 3\n  $cursor: ID\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...useRelayHandoffTestStreamConnection_user_1G22uz\n    id\n  }\n}\n\nfragment useRelayHandoffTestStreamConnection_user_1G22uz on User {\n  friends(first: $count, after: $cursor) {\n    edges @stream(label: \"useRelayHandoffTestStreamConnection_user$stream$people\", initial_count: 1) {\n      node {\n        name\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "a8c95ec9faab9645e737480828dee825";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  useRelayHandoffTestStreamConnectionPaginationQuery$variables,
  useRelayHandoffTestStreamConnectionPaginationQuery$data,
>*/);
