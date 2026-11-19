/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2933b82d912b98fc31cd3a331b4bc2d8>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle$fragmentType } from "./RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle.graphql";
export type ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle$variables = {
  id: string,
};
export type ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle$fragmentType,
  },
};
export type ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle = {
  response: ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle$data,
  variables: ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle$variables,
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
    "name": "ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle",
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
            "name": "RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle"
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
    "name": "ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle",
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
    "cacheID": "6c5d525492b48aaed8262ed42c447b08",
    "id": null,
    "metadata": {},
    "name": "ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle",
    "operationKind": "query",
    "text": "query ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle\n    id\n  }\n}\n\nfragment RefetchableClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle on Bicycle {\n  wheels\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "b398e4b078628d62e66bd9d22f5886e2";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle$variables,
  ClientEdgeQuery_RelayResolverMixedInterfaceTestVehicleBicycleQuery_vehicle$data,
>*/);
