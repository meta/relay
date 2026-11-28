/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<52f2153beb50f288777b4a6893475663>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment.graphql";
export type RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery$variables = {};
export type RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery$data = {
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery = {
  response: RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery$data,
  variables: RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery",
    "selections": [
      {
        "kind": "Defer",
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment"
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery",
    "selections": [
      {
        "if": null,
        "kind": "Defer",
        "label": "RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery$defer$Deferred",
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "me",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
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
        ]
      }
    ]
  },
  "params": {
    "cacheID": "94416f8e2c121b225e5c8e3bba49b4d8",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery {\n  ...RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery$defer$Deferred\")\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment on Query {\n  me {\n    name\n    id\n  }\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "88b93d139d0fe97724d9cf006ba809d9";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery$variables,
  RelayModernEnvironmentExecuteWithDeferTestFullyDeferredQuery$data,
>*/);
