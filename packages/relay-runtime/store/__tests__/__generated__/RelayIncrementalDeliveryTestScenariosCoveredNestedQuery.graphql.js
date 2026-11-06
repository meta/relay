/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c3907ea3fe564a8f72ef7cbae33e94aa>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosOuterFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosOuterFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$data = {
  readonly node: ?{
    readonly name?: ?string,
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosOuterFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosCoveredNestedQuery = {
  response: RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$variables,
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
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    (v2/*:: as any*/)
  ],
  "type": "User",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayIncrementalDeliveryTestScenariosCoveredNestedQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
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
    "name": "RelayIncrementalDeliveryTestScenariosCoveredNestedQuery",
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
          (v3/*:: as any*/),
          {
            "if": null,
            "kind": "Defer",
            "label": "RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$defer$Outer",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v2/*:: as any*/),
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
    "cacheID": "e436ecc6b36542d9c18ac556a30c04d9",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosCoveredNestedQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosCoveredNestedQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      name\n    }\n    ...RelayIncrementalDeliveryTestScenariosOuterFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$defer$Outer\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosInnerFragment on User {\n  alternate_name\n}\n\nfragment RelayIncrementalDeliveryTestScenariosOuterFragment on User {\n  name\n  ...RelayIncrementalDeliveryTestScenariosInnerFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner\")\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "5cf914617b673c60ac903cf995bf6065";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$variables,
  RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$data,
>*/);
