/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<5c7f39d32722a5aa8588149dfda8d0f3>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosActorFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosActorFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosListQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosListQuery$data = {
  readonly node: ?{
    readonly actors?: ?ReadonlyArray<?{
      readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosActorFragment$fragmentType,
    }>,
  },
};
export type RelayIncrementalDeliveryTestScenariosListQuery = {
  response: RelayIncrementalDeliveryTestScenariosListQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosListQuery$variables,
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayIncrementalDeliveryTestScenariosListQuery",
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
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "actors",
                "plural": true,
                "selections": [
                  {
                    "kind": "Defer",
                    "selections": [
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "RelayIncrementalDeliveryTestScenariosActorFragment"
                      }
                    ]
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Feedback",
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
    "name": "RelayIncrementalDeliveryTestScenariosListQuery",
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
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "actors",
                "plural": true,
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "if": null,
                    "kind": "Defer",
                    "label": "RelayIncrementalDeliveryTestScenariosListQuery$defer$ActorFragment",
                    "selections": [
                      {
                        "kind": "TypeDiscriminator",
                        "abstractKey": "__isActor"
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "name",
                        "storageKey": null
                      }
                    ]
                  },
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Feedback",
            "abstractKey": null
          },
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "887fc34a5c949bd3e851977af8c95b2c",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosListQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosListQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Feedback {\n      actors {\n        __typename\n        ...RelayIncrementalDeliveryTestScenariosActorFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosListQuery$defer$ActorFragment\")\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosActorFragment on Actor {\n  __isActor: __typename\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "fc0be07d348881efb697bb3d353be0cb";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosListQuery$variables,
  RelayIncrementalDeliveryTestScenariosListQuery$data,
>*/);
