/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<74f08b52e9eefe3393443043b63b8bc4>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle$fragmentType } from "./RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle.graphql";
export type ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle$variables = {
  id: string,
};
export type ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle$fragmentType,
  },
};
export type ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle = {
  response: ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle$data,
  variables: ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle$variables,
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
    "name": "ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle"
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
    "name": "ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle",
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
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "wheels",
                "storageKey": null
              }
            ],
            "type": "Bicycle",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "clientAbstractTypes": {
      "__isIVehicle": [
        "Bicycle",
        "Car"
      ]
    }
  },
  "params": {
    "cacheID": "b6e5b23a9e7ba69ce89d02214d512dab",
    "id": null,
    "metadata": {},
    "name": "ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle",
    "operationKind": "query",
    "text": "query ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle\n    id\n  }\n}\n\nfragment RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle on Bicycle {\n  wheels\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "7f1d34def3f8791d59fcb580942d28e7";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle$variables,
  ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleInStoreQuery_vehicle$data,
>*/);
