/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<1a3d53fc8a31372486530136ec1637ad>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosFirstFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosFirstFragment.graphql";
import type { RelayIncrementalDeliveryTestScenariosSecondFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosSecondFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosSiblingsQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosSiblingsQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosFirstFragment$fragmentType & RelayIncrementalDeliveryTestScenariosSecondFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosSiblingsQuery = {
  response: RelayIncrementalDeliveryTestScenariosSiblingsQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosSiblingsQuery$variables,
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
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayIncrementalDeliveryTestScenariosSiblingsQuery",
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
                "name": "RelayIncrementalDeliveryTestScenariosFirstFragment"
              }
            ]
          },
          {
            "kind": "Defer",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "RelayIncrementalDeliveryTestScenariosSecondFragment"
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
    "name": "RelayIncrementalDeliveryTestScenariosSiblingsQuery",
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
            "label": "RelayIncrementalDeliveryTestScenariosSiblingsQuery$defer$First",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "alternate_name",
                    "storageKey": null
                  }
                ],
                "type": "User",
                "abstractKey": null
              }
            ]
          },
          {
            "if": null,
            "kind": "Defer",
            "label": "RelayIncrementalDeliveryTestScenariosSiblingsQuery$defer$Second",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v2/*:: as any*/)
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
    "cacheID": "2d5a7d1fde0d89fe68fb46ec704f1c12",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosSiblingsQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosSiblingsQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RelayIncrementalDeliveryTestScenariosFirstFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosSiblingsQuery$defer$First\")\n    ...RelayIncrementalDeliveryTestScenariosSecondFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosSiblingsQuery$defer$Second\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosFirstFragment on User {\n  name\n  alternate_name\n}\n\nfragment RelayIncrementalDeliveryTestScenariosSecondFragment on User {\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "312e4d1f8194e402cac4dbe539f3ed9c";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosSiblingsQuery$variables,
  RelayIncrementalDeliveryTestScenariosSiblingsQuery$data,
>*/);
