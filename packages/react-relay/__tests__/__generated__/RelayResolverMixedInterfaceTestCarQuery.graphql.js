/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7ab7778126b456ee3257f669d814b340>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ClientRequest, ClientQuery } from 'relay-runtime';
import type { DataID } from "relay-runtime";
import type { RelayResolverMixedInterfaceTestWheelsFragment$fragmentType } from "./RelayResolverMixedInterfaceTestWheelsFragment.graphql";
import {car as queryCarResolverType} from "../RelayResolverMixedInterface-test.js";
import type { TestResolverContextType } from "../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryCarResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryCarResolverType as (
  args: void,
  context: TestResolverContextType,
) => ?{
  readonly id: DataID,
});
export type RelayResolverMixedInterfaceTestCarQuery$variables = {};
export type RelayResolverMixedInterfaceTestCarQuery$data = {
  readonly car: ?{
    readonly $fragmentSpreads: RelayResolverMixedInterfaceTestWheelsFragment$fragmentType,
  },
};
export type RelayResolverMixedInterfaceTestCarQuery = {
  response: RelayResolverMixedInterfaceTestCarQuery$data,
  variables: RelayResolverMixedInterfaceTestCarQuery$variables,
};
*/

var node/*: ClientRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": {
      "hasClientEdges": true
    },
    "name": "RelayResolverMixedInterfaceTestCarQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "concreteType": "Car",
        "modelResolvers": {
          "Car": {
            "alias": null,
            "args": null,
            "fragment": {
              "args": null,
              "kind": "FragmentSpread",
              "name": "Car__id"
            },
            "kind": "RelayResolver",
            "name": "__relay_model_instance",
            "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./Car__id.graphql'), require('../RelayResolverMixedInterface-test').Car, 'id', true),
            "path": "car.__relay_model_instance"
          }
        },
        "serverObjectOperations": null,
        "backingField": {
          "alias": null,
          "args": null,
          "fragment": null,
          "kind": "RelayResolver",
          "name": "car",
          "resolverModule": require('../RelayResolverMixedInterface-test').car,
          "path": "car"
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": "Car",
          "kind": "LinkedField",
          "name": "car",
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
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayResolverMixedInterfaceTestCarQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "backingField": {
          "name": "car",
          "args": null,
          "fragment": null,
          "kind": "RelayResolver",
          "storageKey": null,
          "isOutputType": false
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": "Car",
          "kind": "LinkedField",
          "name": "car",
          "plural": false,
          "selections": [
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "name": "wheels",
                      "args": null,
                      "fragment": {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "name": "__relay_model_instance",
                            "args": null,
                            "fragment": {
                              "kind": "InlineFragment",
                              "selections": [
                                (v0/*:: as any*/)
                              ],
                              "type": "Car",
                              "abstractKey": null
                            },
                            "kind": "RelayResolver",
                            "storageKey": null,
                            "isOutputType": false
                          }
                        ],
                        "type": "Car",
                        "abstractKey": null
                      },
                      "kind": "RelayResolver",
                      "storageKey": null,
                      "isOutputType": true
                    }
                  ],
                  "type": "Car",
                  "abstractKey": null
                }
              ],
              "type": "IVehicle",
              "abstractKey": "__isIVehicle"
            },
            (v0/*:: as any*/)
          ],
          "storageKey": null
        }
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
    "cacheID": "020ae69afd38e2d7d5573caa3f21c0b4",
    "id": null,
    "metadata": {},
    "name": "RelayResolverMixedInterfaceTestCarQuery",
    "operationKind": "query",
    "text": null
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "d5b9d21f18363e18eb9ca25b75969a97";
}

module.exports = ((node/*:: as any*/)/*:: as ClientQuery<
  RelayResolverMixedInterfaceTestCarQuery$variables,
  RelayResolverMixedInterfaceTestCarQuery$data,
>*/);
