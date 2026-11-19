/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<eab01c78d5d3b922e9d441424d60c787>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle$fragmentType } from "./RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle.graphql";
export type ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle$variables = {
  id: string,
};
export type ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle$data = {
  readonly fetch__NonNodeStory: ?{
    readonly $fragmentSpreads: RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle$fragmentType,
  },
};
export type ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle = {
  response: ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle$data,
  variables: ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle$variables,
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
    "name": "input_fetch_id",
    "variableName": "id"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "NonNodeStory",
        "kind": "LinkedField",
        "name": "fetch__NonNodeStory",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle"
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
    "name": "ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "NonNodeStory",
        "kind": "LinkedField",
        "name": "fetch__NonNodeStory",
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
            "name": "tracking",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "fetch_id",
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
      "__isMixedVehicle": [
        "Hovercraft",
        "NonNodeStory"
      ]
    }
  },
  "params": {
    "cacheID": "9f8bbf314348d8b9641ed6abb6fc4fcb",
    "id": null,
    "metadata": {},
    "name": "ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle",
    "operationKind": "query",
    "text": "query ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle(\n  $id: ID!\n) {\n  fetch__NonNodeStory(input_fetch_id: $id) {\n    ...RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle\n    id\n  }\n}\n\nfragment RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle on NonNodeStory {\n  __typename\n  tracking\n  fetch_id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "f7149d0679aa45ca3dc76831837afc89";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle$variables,
  ClientEdgeQuery_RelayResolverMixedUnionFetchableTestHovercraftQuery_mixed_vehicle$data,
>*/);
