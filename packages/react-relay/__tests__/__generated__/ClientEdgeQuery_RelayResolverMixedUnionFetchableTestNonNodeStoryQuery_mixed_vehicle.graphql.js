/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<0e4f4fd4d94920af607b22804ec76cda>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle$fragmentType } from "./RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle.graphql";
export type ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle$variables = {
  id: string,
};
export type ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle$data = {
  readonly fetch__NonNodeStory: ?{
    readonly $fragmentSpreads: RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle$fragmentType,
  },
};
export type ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle = {
  response: ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle$data,
  variables: ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle$variables,
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
    "name": "ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle",
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
            "name": "RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle"
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
    "name": "ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle",
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
    "cacheID": "ad88a7927e7e3c15a3b6471523cd548b",
    "id": null,
    "metadata": {},
    "name": "ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle",
    "operationKind": "query",
    "text": "query ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle(\n  $id: ID!\n) {\n  fetch__NonNodeStory(input_fetch_id: $id) {\n    ...RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle\n    id\n  }\n}\n\nfragment RefetchableClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle on NonNodeStory {\n  __typename\n  tracking\n  fetch_id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "570527472dcc16ea924b133ebd10a35d";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle$variables,
  ClientEdgeQuery_RelayResolverMixedUnionFetchableTestNonNodeStoryQuery_mixed_vehicle$data,
>*/);
