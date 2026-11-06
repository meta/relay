/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<eaa771bb4c0bfc29eb8317f203faf2a2>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosOuterFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosOuterFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosNestedQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosNestedQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosOuterFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosNestedQuery = {
  response: RelayIncrementalDeliveryTestScenariosNestedQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosNestedQuery$variables,
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayIncrementalDeliveryTestScenariosNestedQuery",
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
            "kind": "Defer",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "RelayIncrementalDeliveryTestScenariosOuterFragment"
              }
            ]
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
    "name": "RelayIncrementalDeliveryTestScenariosNestedQuery",
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
            "if": null,
            "kind": "Defer",
            "label": "RelayIncrementalDeliveryTestScenariosNestedQuery$defer$Outer",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "name",
                    "storageKey": null
                  },
                  {
                    "if": null,
                    "kind": "Defer",
                    "label": "RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "alternate_name",
                        "storageKey": null
                      }
                    ]
                  }
                ],
                "type": "User",
                "abstractKey": null
              }
            ]
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
    "cacheID": "c0f3bc376cfbdd86b52595905de17a1f",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosNestedQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosNestedQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RelayIncrementalDeliveryTestScenariosOuterFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosNestedQuery$defer$Outer\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosInnerFragment on User {\n  alternate_name\n}\n\nfragment RelayIncrementalDeliveryTestScenariosOuterFragment on User {\n  name\n  ...RelayIncrementalDeliveryTestScenariosInnerFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner\")\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "220b64a620c10e9b4acd7ddb772b0b31";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosNestedQuery$variables,
  RelayIncrementalDeliveryTestScenariosNestedQuery$data,
>*/);
