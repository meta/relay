/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<9f5bbe870ee17ca285fcd29d9d332816>>
 * @flow
 * @lightSyntaxTransform
 * @nogrep
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { useLazyLoadQueryErrorBoundaryTestFragment$fragmentType } from "./useLazyLoadQueryErrorBoundaryTestFragment.graphql";
export type useLazyLoadQueryErrorBoundaryTestQuery$variables = {||};
export type useLazyLoadQueryErrorBoundaryTestQuery$data = {|
  +$fragmentSpreads: useLazyLoadQueryErrorBoundaryTestFragment$fragmentType,
|};
export type useLazyLoadQueryErrorBoundaryTestQuery = {|
  response: useLazyLoadQueryErrorBoundaryTestQuery$data,
  variables: useLazyLoadQueryErrorBoundaryTestQuery$variables,
|};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useLazyLoadQueryErrorBoundaryTestQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "useLazyLoadQueryErrorBoundaryTestFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useLazyLoadQueryErrorBoundaryTestQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "actor",
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
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "fe82570fe2ce79e2793f96968c2fa379",
    "id": null,
    "metadata": {},
    "name": "useLazyLoadQueryErrorBoundaryTestQuery",
    "operationKind": "query",
    "text": "query useLazyLoadQueryErrorBoundaryTestQuery {\n  ...useLazyLoadQueryErrorBoundaryTestFragment\n}\n\nfragment useLazyLoadQueryErrorBoundaryTestFragment on Query {\n  viewer {\n    actor {\n      __typename\n      name\n      id\n    }\n  }\n}\n"
  }
};

if (__DEV__) {
  (node/*: any*/).hash = "7bb3fb493bf06350c3e6e9545b85b47b";
}

module.exports = ((node/*: any*/)/*: Query<
  useLazyLoadQueryErrorBoundaryTestQuery$variables,
  useLazyLoadQueryErrorBoundaryTestQuery$data,
>*/);
