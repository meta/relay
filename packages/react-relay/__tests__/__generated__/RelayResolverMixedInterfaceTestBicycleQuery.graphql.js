/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c4991a919ebfe835cee5109d41b5497a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayResolverMixedInterfaceTestWheelsFragment$fragmentType } from "./RelayResolverMixedInterfaceTestWheelsFragment.graphql";
export type RelayResolverMixedInterfaceTestBicycleQuery$variables = {};
export type RelayResolverMixedInterfaceTestBicycleQuery$data = {
  readonly bicycle: ?{
    readonly $fragmentSpreads: RelayResolverMixedInterfaceTestWheelsFragment$fragmentType,
  },
};
export type RelayResolverMixedInterfaceTestBicycleQuery = {
  response: RelayResolverMixedInterfaceTestBicycleQuery$data,
  variables: RelayResolverMixedInterfaceTestBicycleQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayResolverMixedInterfaceTestBicycleQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Bicycle",
        "kind": "LinkedField",
        "name": "bicycle",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayResolverMixedInterfaceTestWheelsFragment"
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayResolverMixedInterfaceTestBicycleQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Bicycle",
        "kind": "LinkedField",
        "name": "bicycle",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "wheels",
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
      "__isIVehicle": [
        "Bicycle",
        "Car"
      ]
    }
  },
  "params": {
    "cacheID": "b371a13a956fb8f394530907d4de0335",
    "id": null,
    "metadata": {},
    "name": "RelayResolverMixedInterfaceTestBicycleQuery",
    "operationKind": "query",
    "text": "query RelayResolverMixedInterfaceTestBicycleQuery {\n  bicycle {\n    wheels\n    id\n  }\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "e387a24d67b303316be65c07b0b93017";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayResolverMixedInterfaceTestBicycleQuery$variables,
  RelayResolverMixedInterfaceTestBicycleQuery$data,
>*/);
