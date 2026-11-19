/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b7812a4f55640c45f3694292ad5368ca>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ClientRequest, ClientQuery } from 'relay-runtime';
import type { RelayResolverInterfaceTestAnimalLegsFragment$fragmentType } from "./RelayResolverInterfaceTestAnimalLegsFragment.graphql";
export type RelayResolverInterfaceTestChickenLegsQuery$variables = {};
export type RelayResolverInterfaceTestChickenLegsQuery$data = {
  readonly chicken: ?{
    readonly $fragmentSpreads: RelayResolverInterfaceTestAnimalLegsFragment$fragmentType,
  },
};
export type RelayResolverInterfaceTestChickenLegsQuery = {
  response: RelayResolverInterfaceTestChickenLegsQuery$data,
  variables: RelayResolverInterfaceTestChickenLegsQuery$variables,
};
*/

var node/*: ClientRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayResolverInterfaceTestChickenLegsQuery",
    "selections": [
      {
        "kind": "ClientExtension",
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Chicken",
            "kind": "LinkedField",
            "name": "chicken",
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
    "name": "RelayResolverInterfaceTestChickenLegsQuery",
    "selections": [
      {
        "kind": "ClientExtension",
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Chicken",
            "kind": "LinkedField",
            "name": "chicken",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "legs",
                        "storageKey": null
                      }
                    ],
                    "type": "Chicken",
                    "abstractKey": null
                  }
                ],
                "type": "IAnimal",
                "abstractKey": "__isIAnimal"
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
    "cacheID": "86041f6438414769ce790da9623ff157",
    "id": null,
    "metadata": {},
    "name": "RelayResolverInterfaceTestChickenLegsQuery",
    "operationKind": "query",
    "text": null
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "faf70b0c71846f082798a4d7ad8b760b";
}

module.exports = ((node/*:: as any*/)/*:: as ClientQuery<
  RelayResolverInterfaceTestChickenLegsQuery$variables,
  RelayResolverInterfaceTestChickenLegsQuery$data,
>*/);
