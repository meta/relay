/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<69fb52a8906fa959802847343c33c22d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosCoveredFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosCoveredFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosCoveredQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosCoveredQuery$data = {
  readonly node: ?{
    readonly name?: ?string,
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosCoveredFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosCoveredQuery = {
  response: RelayIncrementalDeliveryTestScenariosCoveredQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosCoveredQuery$variables,
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
  "kind": "InlineFragment",
  "selections": [
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayIncrementalDeliveryTestScenariosCoveredQuery",
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
          {
            "kind": "Defer",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "RelayIncrementalDeliveryTestScenariosCoveredFragment"
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
    "name": "RelayIncrementalDeliveryTestScenariosCoveredQuery",
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
          (v2/*:: as any*/),
          {
            "if": null,
            "kind": "Defer",
            "label": "RelayIncrementalDeliveryTestScenariosCoveredQuery$defer$CoveredFragment",
            "selections": [
              (v2/*:: as any*/)
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
    "cacheID": "dd53a4075842b457e74fe6e830770512",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosCoveredQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosCoveredQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      name\n    }\n    ...RelayIncrementalDeliveryTestScenariosCoveredFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosCoveredQuery$defer$CoveredFragment\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosCoveredFragment on User {\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "48e7dfe3805b5a69910b7591dd6776a3";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosCoveredQuery$variables,
  RelayIncrementalDeliveryTestScenariosCoveredQuery$data,
>*/);
