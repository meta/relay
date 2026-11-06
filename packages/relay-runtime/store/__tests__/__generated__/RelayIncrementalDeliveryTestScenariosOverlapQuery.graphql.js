/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f01e21e9255e42bee74d2df06b828872>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosOverlapFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosOverlapFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosOverlapQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosOverlapQuery$data = {
  readonly node: ?{
    readonly address?: ?{
      readonly street: ?string,
    },
    readonly name?: ?string,
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosOverlapFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosOverlapQuery = {
  response: RelayIncrementalDeliveryTestScenariosOverlapQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosOverlapQuery$variables,
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
    (v2/*:: as any*/),
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
    "name": "RelayIncrementalDeliveryTestScenariosOverlapQuery",
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
                "name": "RelayIncrementalDeliveryTestScenariosOverlapFragment"
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
    "name": "RelayIncrementalDeliveryTestScenariosOverlapQuery",
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
            "label": "RelayIncrementalDeliveryTestScenariosOverlapQuery$defer$OverlapFragment",
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
                  },
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
    "cacheID": "d185e3a1c5131cf04009c43ced2b178e",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosOverlapQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosOverlapQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      name\n      address {\n        street\n      }\n    }\n    ...RelayIncrementalDeliveryTestScenariosOverlapFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosOverlapQuery$defer$OverlapFragment\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosOverlapFragment on User {\n  name\n  alternate_name\n  address {\n    city\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "f3b099ae2705e26f993e61b95f0c317c";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosOverlapQuery$variables,
  RelayIncrementalDeliveryTestScenariosOverlapQuery$data,
>*/);
