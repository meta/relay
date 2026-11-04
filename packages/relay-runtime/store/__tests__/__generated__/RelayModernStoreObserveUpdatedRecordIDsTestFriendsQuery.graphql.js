/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<5ed6d8adb6b5392aaeff632513bda13b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery$variables = {};
export type RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery$data = {
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
export type RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery = {
  response: RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery$data,
  variables: RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery$variables,
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
    "name": "RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery",
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
            "name": "__RelayModernStoreObserveUpdatedRecordIDsTest_friends_connection",
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
    "name": "RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery",
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
            "key": "RelayModernStoreObserveUpdatedRecordIDsTest_friends",
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
    "cacheID": "906f89b07dd27cf95cd1ac5c229e9129",
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
    "name": "RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery",
    "operationKind": "query",
    "text": "query RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery {\n  me {\n    friends(first: 1) {\n      edges {\n        node {\n          name\n          id\n          __typename\n        }\n        cursor\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "b764eca5a073f762cfabbe3e12cf7e7a";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery$variables,
  RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery$data,
>*/);
