/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d4cb5fc6739f5d0d2ab0de3384a16206>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { useFragmentActivitySnapshotTestCounter$fragmentType } from "./useFragmentActivitySnapshotTestCounter.graphql";
import type { useFragmentActivitySnapshotTestList$fragmentType } from "./useFragmentActivitySnapshotTestList.graphql";
import type { useFragmentActivitySnapshotTestPluralList$fragmentType } from "./useFragmentActivitySnapshotTestPluralList.graphql";
import type { useFragmentActivitySnapshotTestPluralScalar$fragmentType } from "./useFragmentActivitySnapshotTestPluralScalar.graphql";
import type { useFragmentActivitySnapshotTestRoot$fragmentType } from "./useFragmentActivitySnapshotTestRoot.graphql";
import type { useFragmentActivitySnapshotTestScalar$fragmentType } from "./useFragmentActivitySnapshotTestScalar.graphql";
export type useFragmentActivitySnapshotTestQuery$variables = {};
export type useFragmentActivitySnapshotTestQuery$data = {
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestCounter$fragmentType & useFragmentActivitySnapshotTestList$fragmentType & useFragmentActivitySnapshotTestPluralList$fragmentType & useFragmentActivitySnapshotTestPluralScalar$fragmentType & useFragmentActivitySnapshotTestRoot$fragmentType & useFragmentActivitySnapshotTestScalar$fragmentType,
};
export type useFragmentActivitySnapshotTestQuery = {
  response: useFragmentActivitySnapshotTestQuery$data,
  variables: useFragmentActivitySnapshotTestQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
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
    "name": "useFragmentActivitySnapshotTestQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "useFragmentActivitySnapshotTestRoot"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "useFragmentActivitySnapshotTestList"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "useFragmentActivitySnapshotTestPluralList"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "useFragmentActivitySnapshotTestScalar"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "useFragmentActivitySnapshotTestPluralScalar"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "useFragmentActivitySnapshotTestCounter"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useFragmentActivitySnapshotTestQuery",
    "selections": [
      {
        "alias": null,
        "args": [
          {
            "kind": "Literal",
            "name": "id",
            "value": "1"
          }
        ],
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
                "alias": null,
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 1
                  }
                ],
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
                          (v1/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "friends(first:1)"
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "username",
                "storageKey": null
              }
            ],
            "type": "User",
            "abstractKey": null
          },
          (v0/*:: as any*/),
          (v1/*:: as any*/)
        ],
        "storageKey": "node(id:\"1\")"
      }
    ]
  },
  "params": {
    "cacheID": "b1456f5a67c1c6e4ed950001c3b6b2b9",
    "id": null,
    "metadata": {},
    "name": "useFragmentActivitySnapshotTestQuery",
    "operationKind": "query",
    "text": "query useFragmentActivitySnapshotTestQuery {\n  ...useFragmentActivitySnapshotTestRoot\n  ...useFragmentActivitySnapshotTestList\n  ...useFragmentActivitySnapshotTestPluralList\n  ...useFragmentActivitySnapshotTestScalar\n  ...useFragmentActivitySnapshotTestPluralScalar\n  ...useFragmentActivitySnapshotTestCounter\n}\n\nfragment useFragmentActivitySnapshotTestChild on User {\n  name\n}\n\nfragment useFragmentActivitySnapshotTestCounter on Query {\n  node(id: \"1\") {\n    __typename\n    ... on User {\n      username\n    }\n    id\n  }\n}\n\nfragment useFragmentActivitySnapshotTestList on Query {\n  node(id: \"1\") {\n    __typename\n    ... on User {\n      friends(first: 1) {\n        edges {\n          node {\n            id\n            ...useFragmentActivitySnapshotTestChild\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment useFragmentActivitySnapshotTestPluralList on Query {\n  node(id: \"1\") {\n    __typename\n    ... on User {\n      friends(first: 1) {\n        edges {\n          node {\n            id\n            ...useFragmentActivitySnapshotTestChild\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment useFragmentActivitySnapshotTestPluralScalar on Query {\n  node(id: \"1\") {\n    __typename\n    name\n    id\n  }\n}\n\nfragment useFragmentActivitySnapshotTestRoot on Query {\n  ...useFragmentActivitySnapshotTestList\n}\n\nfragment useFragmentActivitySnapshotTestScalar on Query {\n  node(id: \"1\") {\n    __typename\n    name\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "e0a2530fac8550bb552bbef3ca2fdcec";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  useFragmentActivitySnapshotTestQuery$variables,
  useFragmentActivitySnapshotTestQuery$data,
>*/);
