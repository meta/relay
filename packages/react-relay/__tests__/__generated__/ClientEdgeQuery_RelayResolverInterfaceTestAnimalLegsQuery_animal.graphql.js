/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<47b5c19ebb26003d713e4f346bcf69ed>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal$fragmentType } from "./RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal.graphql";
export type ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal$variables = {
  id: string,
};
export type ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal$data = {
  readonly fetch__Chicken: ?{
    readonly $fragmentSpreads: RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal$fragmentType,
  },
};
export type ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal = {
  response: ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal$data,
  variables: ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal$variables,
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
    "name": "input_id",
    "variableName": "id"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Chicken",
        "kind": "LinkedField",
        "name": "fetch__Chicken",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal"
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
    "name": "ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Chicken",
        "kind": "LinkedField",
        "name": "fetch__Chicken",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "legs",
            "storageKey": null
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
    ],
    "clientAbstractTypes": {
      "__isIAnimal": [
        "Cat",
        "Chicken",
        "Fish"
      ]
    }
  },
  "params": {
    "cacheID": "f8de38e3efcb73a0832a36b75126eac0",
    "id": null,
    "metadata": {},
    "name": "ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal",
    "operationKind": "query",
    "text": "query ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal(\n  $id: ID!\n) {\n  fetch__Chicken(input_id: $id) {\n    ...RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal\n    id\n  }\n}\n\nfragment RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal on Chicken {\n  legs\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "f98a683fd9222f08fa9698ca1f4b553d";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal$variables,
  ClientEdgeQuery_RelayResolverInterfaceTestAnimalLegsQuery_animal$data,
>*/);
