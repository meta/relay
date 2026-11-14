/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<aac5dbd14e3946ec173f901dc209100a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper.graphql";
export type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery$variables = {
  id: string,
};
export type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery$data = {
  readonly node: ?({
    readonly __typename: "User",
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$fragmentType,
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other",
  }),
};
export type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery = {
  response: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery$data,
  variables: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
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
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 2
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery",
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
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper"
              }
            ],
            "type": "User",
            "abstractKey": null
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
    "name": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "if": null,
                "kind": "Defer",
                "label": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$defer$ConnectionFragment",
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
                              (v3/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "name",
                                "storageKey": null
                              },
                              (v2/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cursor",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
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
                      }
                    ],
                    "storageKey": "friends(first:2)"
                  },
                  {
                    "alias": null,
                    "args": (v4/*:: as any*/),
                    "filters": null,
                    "handle": "connection",
                    "key": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTest_friends",
                    "kind": "LinkedHandle",
                    "name": "friends"
                  }
                ]
              }
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ad2ef0b08d86553295e138dccf1d9a7a",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      ...RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper\n    }\n    id\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection on User {\n  friends(first: 2) {\n    edges {\n      node {\n        id\n        name\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper on User {\n  id\n  ...RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection @defer(label: \"RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$defer$ConnectionFragment\")\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "628a7940fe391ca22acbf0aab3a8258a";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery$variables,
  RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery$data,
>*/);
