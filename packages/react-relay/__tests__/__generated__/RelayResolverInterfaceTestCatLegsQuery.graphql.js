/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d12b49d8df6e08d97257955f142bea68>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ClientRequest, ClientQuery } from 'relay-runtime';
import type { DataID } from "relay-runtime";
import type { RelayResolverInterfaceTestAnimalLegsFragment$fragmentType } from "./RelayResolverInterfaceTestAnimalLegsFragment.graphql";
import {cat as queryCatResolverType} from "../../../relay-runtime/store/__tests__/resolvers/CatResolvers.js";
import type { TestResolverContextType } from "../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryCatResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryCatResolverType as (
  args: void,
  context: TestResolverContextType,
) => ?{
  readonly id: DataID,
});
export type RelayResolverInterfaceTestCatLegsQuery$variables = {};
export type RelayResolverInterfaceTestCatLegsQuery$data = {
  readonly cat: ?{
    readonly $fragmentSpreads: RelayResolverInterfaceTestAnimalLegsFragment$fragmentType,
  },
};
export type RelayResolverInterfaceTestCatLegsQuery = {
  response: RelayResolverInterfaceTestCatLegsQuery$data,
  variables: RelayResolverInterfaceTestCatLegsQuery$variables,
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
    "name": "RelayResolverInterfaceTestCatLegsQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "concreteType": "Cat",
        "modelResolvers": {
          "Cat": {
            "alias": null,
            "args": null,
            "fragment": {
              "args": null,
              "kind": "FragmentSpread",
              "name": "Cat__id"
            },
            "kind": "RelayResolver",
            "name": "__relay_model_instance",
            "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./../../../relay-runtime/store/__tests__/resolvers/__generated__/Cat__id.graphql'), require('../../../relay-runtime/store/__tests__/resolvers/CatResolvers').Cat, 'id', true),
            "path": "cat.__relay_model_instance"
          }
        },
        "serverObjectOperations": null,
        "backingField": {
          "alias": null,
          "args": null,
          "fragment": null,
          "kind": "RelayResolver",
          "name": "cat",
          "resolverModule": require('../../../relay-runtime/store/__tests__/resolvers/CatResolvers').cat,
          "path": "cat"
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": "Cat",
          "kind": "LinkedField",
          "name": "cat",
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
    "name": "RelayResolverInterfaceTestCatLegsQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "backingField": {
          "name": "cat",
          "args": null,
          "fragment": null,
          "kind": "RelayResolver",
          "storageKey": null,
          "isOutputType": false
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": "Cat",
          "kind": "LinkedField",
          "name": "cat",
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
                              "type": "Cat",
                              "abstractKey": null
                            },
                            "kind": "RelayResolver",
                            "storageKey": null,
                            "isOutputType": false
                          }
                        ],
                        "type": "Cat",
                        "abstractKey": null
                      },
                      "kind": "RelayResolver",
                      "storageKey": null,
                      "isOutputType": true
                    }
                  ],
                  "type": "Cat",
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
    "cacheID": "c6aa3ef8cb6b1c33d9507d8ebdefa8bd",
    "id": null,
    "metadata": {},
    "name": "RelayResolverInterfaceTestCatLegsQuery",
    "operationKind": "query",
    "text": null
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "bfa07f8bbeb86466f11b1e960da49893";
}

module.exports = ((node/*:: as any*/)/*:: as ClientQuery<
  RelayResolverInterfaceTestCatLegsQuery$variables,
  RelayResolverInterfaceTestCatLegsQuery$data,
>*/);
