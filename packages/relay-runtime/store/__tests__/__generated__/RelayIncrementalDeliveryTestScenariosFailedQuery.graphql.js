/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a5cc43a1f6e0e67c453f6310e249e6fc>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosFailedFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosFailedFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosFailedQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosFailedQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosFailedFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosFailedQuery = {
  response: RelayIncrementalDeliveryTestScenariosFailedQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosFailedQuery$variables,
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
    "name": "RelayIncrementalDeliveryTestScenariosFailedQuery",
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
                "name": "RelayIncrementalDeliveryTestScenariosFailedFragment"
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
    "name": "RelayIncrementalDeliveryTestScenariosFailedQuery",
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
            "label": "RelayIncrementalDeliveryTestScenariosFailedQuery$defer$FailedFragment",
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
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "nearest_neighbor",
                    "plural": false,
                    "selections": [
                      (v2/*:: as any*/)
                    ],
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
    "cacheID": "a65544cc37d8a43d2c2773d1c70ac4c9",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosFailedQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosFailedQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RelayIncrementalDeliveryTestScenariosFailedFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosFailedQuery$defer$FailedFragment\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosFailedFragment on User {\n  name\n  nearest_neighbor {\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "69a0db434717e5d25f779c83e9acb185";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosFailedQuery$variables,
  RelayIncrementalDeliveryTestScenariosFailedQuery$data,
>*/);
