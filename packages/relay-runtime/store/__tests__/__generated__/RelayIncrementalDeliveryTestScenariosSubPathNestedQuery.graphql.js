/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<3b211a185670d9799fdc468a473fee9c>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosSubPathFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosSubPathFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$data = {
  readonly node: ?{
    readonly address?: ?{
      readonly street: ?string,
    },
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosSubPathFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosSubPathNestedQuery = {
  response: RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$variables,
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
      "concreteType": "StreetAddress",
      "kind": "LinkedField",
      "name": "address",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "street",
          "storageKey": null
        }
      ],
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
    "name": "RelayIncrementalDeliveryTestScenariosSubPathNestedQuery",
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
                "name": "RelayIncrementalDeliveryTestScenariosSubPathFragment"
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
    "name": "RelayIncrementalDeliveryTestScenariosSubPathNestedQuery",
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
            "label": "RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$defer$SubPathFragment",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "StreetAddress",
                    "kind": "LinkedField",
                    "name": "address",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "city",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "if": null,
                    "kind": "Defer",
                    "label": "RelayIncrementalDeliveryTestScenariosSubPathFragment$defer$Inner",
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
    "cacheID": "177f3a251cecea054d3603c23e24b360",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosSubPathNestedQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosSubPathNestedQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      address {\n        street\n      }\n    }\n    ...RelayIncrementalDeliveryTestScenariosSubPathFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$defer$SubPathFragment\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosInnerFragment on User {\n  alternate_name\n}\n\nfragment RelayIncrementalDeliveryTestScenariosSubPathFragment on User {\n  address {\n    city\n  }\n  ...RelayIncrementalDeliveryTestScenariosInnerFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosSubPathFragment$defer$Inner\")\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "eeda1b85eedb4cc73fa037a6e8fe036b";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$variables,
  RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$data,
>*/);
