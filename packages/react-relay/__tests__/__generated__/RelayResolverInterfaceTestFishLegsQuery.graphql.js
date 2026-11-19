/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<332d0005bdcf0a6b323ab45901d90ebf>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ClientRequest, ClientQuery } from 'relay-runtime';
import type { DataID } from "relay-runtime";
import type { RelayResolverInterfaceTestAnimalLegsFragment$fragmentType } from "./RelayResolverInterfaceTestAnimalLegsFragment.graphql";
import {fish as queryFishResolverType} from "../../../relay-runtime/store/__tests__/resolvers/FishResolvers.js";
import type { TestResolverContextType } from "../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryFishResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryFishResolverType as (
  args: void,
  context: TestResolverContextType,
) => ?{
  readonly id: DataID,
});
export type RelayResolverInterfaceTestFishLegsQuery$variables = {};
export type RelayResolverInterfaceTestFishLegsQuery$data = {
  readonly fish: ?{
    readonly $fragmentSpreads: RelayResolverInterfaceTestAnimalLegsFragment$fragmentType,
  },
};
export type RelayResolverInterfaceTestFishLegsQuery = {
  response: RelayResolverInterfaceTestFishLegsQuery$data,
  variables: RelayResolverInterfaceTestFishLegsQuery$variables,
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
    "name": "RelayResolverInterfaceTestFishLegsQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "concreteType": "Fish",
        "modelResolvers": {
          "Fish": {
            "alias": null,
            "args": null,
            "fragment": {
              "args": null,
              "kind": "FragmentSpread",
              "name": "Fish__id"
            },
            "kind": "RelayResolver",
            "name": "__relay_model_instance",
            "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./../../../relay-runtime/store/__tests__/resolvers/__generated__/Fish__id.graphql'), require('../../../relay-runtime/store/__tests__/resolvers/FishResolvers').Fish, 'id', true),
            "path": "fish.__relay_model_instance"
          }
        },
        "serverObjectOperations": null,
        "backingField": {
          "alias": null,
          "args": null,
          "fragment": null,
          "kind": "RelayResolver",
          "name": "fish",
          "resolverModule": require('../../../relay-runtime/store/__tests__/resolvers/FishResolvers').fish,
          "path": "fish"
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": "Fish",
          "kind": "LinkedField",
          "name": "fish",
          "plural": false,
          "selections": [
            {
              "args": null,
              "kind": "FragmentSpread",
              "name": "RelayResolverInterfaceTestAnimalLegsFragment"
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
    "name": "RelayResolverInterfaceTestFishLegsQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "backingField": {
          "name": "fish",
          "args": null,
          "fragment": null,
          "kind": "RelayResolver",
          "storageKey": null,
          "isOutputType": false
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": "Fish",
          "kind": "LinkedField",
          "name": "fish",
          "plural": false,
          "selections": [
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "name": "legs",
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
                              "type": "Fish",
                              "abstractKey": null
                            },
                            "kind": "RelayResolver",
                            "storageKey": null,
                            "isOutputType": false
                          }
                        ],
                        "type": "Fish",
                        "abstractKey": null
                      },
                      "kind": "RelayResolver",
                      "storageKey": null,
                      "isOutputType": true
                    }
                  ],
                  "type": "Fish",
                  "abstractKey": null
                }
              ],
              "type": "IAnimal",
              "abstractKey": "__isIAnimal"
            },
            (v0/*:: as any*/)
          ],
          "storageKey": null
        }
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
    "cacheID": "4eb710efdd47984f9682d5255b5560b2",
    "id": null,
    "metadata": {},
    "name": "RelayResolverInterfaceTestFishLegsQuery",
    "operationKind": "query",
    "text": null
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "91fa8cc8364ed0222107f376f8a072f9";
}

module.exports = ((node/*:: as any*/)/*:: as ClientQuery<
  RelayResolverInterfaceTestFishLegsQuery$variables,
  RelayResolverInterfaceTestFishLegsQuery$data,
>*/);
