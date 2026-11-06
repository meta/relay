/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<3bbc4a31a3cd7b7369f5400d755252b7>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosUserFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosUserFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosDeferQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosDeferQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosUserFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosDeferQuery = {
  response: RelayIncrementalDeliveryTestScenariosDeferQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosDeferQuery$variables,
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
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayIncrementalDeliveryTestScenariosDeferQuery",
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
                "name": "RelayIncrementalDeliveryTestScenariosUserFragment"
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
    "name": "RelayIncrementalDeliveryTestScenariosDeferQuery",
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
            "label": "RelayIncrementalDeliveryTestScenariosDeferQuery$defer$UserFragment",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "name",
                    "storageKey": null
                  }
                ],
                "type": "User",
                "abstractKey": null
              }
            ]
          },
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7630ab012bb5d0505904ded1366d8f7e",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosDeferQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosDeferQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RelayIncrementalDeliveryTestScenariosUserFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosDeferQuery$defer$UserFragment\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosUserFragment on User {\n  id\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "c28103252f1d70113d3cc198143a28e1";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosDeferQuery$variables,
  RelayIncrementalDeliveryTestScenariosDeferQuery$data,
>*/);
