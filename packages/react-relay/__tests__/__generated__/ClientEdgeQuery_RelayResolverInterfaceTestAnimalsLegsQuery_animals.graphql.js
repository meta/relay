/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<866b39f75aa29bd17ce26b63ef8b9b8f>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals$fragmentType } from "./RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals.graphql";
export type ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals$variables = {
  id: string,
};
export type ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals$data = {
  readonly fetch__Chicken: ?{
    readonly $fragmentSpreads: RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals$fragmentType,
  },
};
export type ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals = {
  response: ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals$data,
  variables: ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals$variables,
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
    "name": "ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals",
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
            "name": "RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals"
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
    "name": "ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals",
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
    "cacheID": "63d6c91dbe2ee6cb862b9ab11bad7304",
    "id": null,
    "metadata": {},
    "name": "ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals",
    "operationKind": "query",
    "text": "query ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals(\n  $id: ID!\n) {\n  fetch__Chicken(input_id: $id) {\n    ...RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals\n    id\n  }\n}\n\nfragment RefetchableClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals on Chicken {\n  legs\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "d7dcef9c5d9f2b15d2123e917f1b6c6a";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals$variables,
  ClientEdgeQuery_RelayResolverInterfaceTestAnimalsLegsQuery_animals$data,
>*/);
