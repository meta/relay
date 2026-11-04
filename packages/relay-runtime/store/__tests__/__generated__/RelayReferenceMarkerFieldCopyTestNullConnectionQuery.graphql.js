/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<923ef4bdd50d21b74f845a137eb229ca>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayReferenceMarkerFieldCopyTestNullConnectionQuery$variables = {};
export type RelayReferenceMarkerFieldCopyTestNullConnectionQuery$data = {
  readonly me: ?{
    readonly friends: ?{
      readonly edges: ?ReadonlyArray<?{
        readonly node: ?{
          readonly name: ?string,
        },
      }>,
    },
  },
};
export type RelayReferenceMarkerFieldCopyTestNullConnectionQuery = {
  response: RelayReferenceMarkerFieldCopyTestNullConnectionQuery$data,
  variables: RelayReferenceMarkerFieldCopyTestNullConnectionQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "PageInfo",
  "kind": "LinkedField",
  "name": "pageInfo",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endCursor",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasNextPage",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v4 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 1
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayReferenceMarkerFieldCopyTestNullConnectionQuery",
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
            "alias": "friends",
            "args": null,
            "concreteType": "FriendsConnection",
            "kind": "LinkedField",
            "name": "__RelayReferenceMarkerFieldCopyTest_friends_connection",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "FriendsEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v0/*:: as any*/),
                      (v1/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v2/*:: as any*/)
                ],
                "storageKey": null
              },
              (v3/*:: as any*/)
            ],
            "storageKey": null
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
    "name": "RelayReferenceMarkerFieldCopyTestNullConnectionQuery",
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
            "alias": null,
            "args": (v4/*:: as any*/),
            "concreteType": "FriendsConnection",
            "kind": "LinkedField",
            "name": "friends",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "FriendsEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v0/*:: as any*/),
                      (v5/*:: as any*/),
                      (v1/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v2/*:: as any*/)
                ],
                "storageKey": null
              },
              (v3/*:: as any*/)
            ],
            "storageKey": "friends(first:1)"
          },
          {
            "alias": null,
            "args": (v4/*:: as any*/),
            "filters": null,
            "handle": "connection",
            "key": "RelayReferenceMarkerFieldCopyTest_friends",
            "kind": "LinkedHandle",
            "name": "friends"
          },
          (v5/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "90167a011dcb630fc01e7f3998344c3b",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "me",
            "friends"
          ]
        }
      ]
    },
    "name": "RelayReferenceMarkerFieldCopyTestNullConnectionQuery",
    "operationKind": "query",
    "text": "query RelayReferenceMarkerFieldCopyTestNullConnectionQuery {\n  me {\n    friends(first: 1) {\n      edges {\n        node {\n          name\n          id\n          __typename\n        }\n        cursor\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "4dfffacb42d97e029cd52bbe30b512b1";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReferenceMarkerFieldCopyTestNullConnectionQuery$variables,
  RelayReferenceMarkerFieldCopyTestNullConnectionQuery$data,
>*/);
