/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<5d0bd75e23370a1f8e48ad5800c8c541>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosActorFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosActorFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosStreamDeferQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosStreamDeferQuery$data = {
  readonly node: ?{
    readonly actors?: ?ReadonlyArray<?{
      readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosActorFragment$fragmentType,
    }>,
  },
};
export type RelayIncrementalDeliveryTestScenariosStreamDeferQuery = {
  response: RelayIncrementalDeliveryTestScenariosStreamDeferQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosStreamDeferQuery$variables,
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
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayIncrementalDeliveryTestScenariosStreamDeferQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "kind": "Stream",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "actors",
                    "plural": true,
                    "selections": [
                      {
                        "kind": "Defer",
                        "selections": [
                          {
                            "args": null,
                            "kind": "FragmentSpread",
                            "name": "RelayIncrementalDeliveryTestScenariosActorFragment"
                          }
                        ]
                      }
                    ],
                    "storageKey": null
                  }
                ]
              }
            ],
            "type": "Feedback",
            "abstractKey": null
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
    "name": "RelayIncrementalDeliveryTestScenariosStreamDeferQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "if": null,
                "kind": "Stream",
                "label": "RelayIncrementalDeliveryTestScenariosStreamDeferQuery$stream$actors",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "actors",
                    "plural": true,
                    "selections": [
                      (v2/*:: as any*/),
                      {
                        "if": null,
                        "kind": "Defer",
                        "label": "RelayIncrementalDeliveryTestScenariosStreamDeferQuery$defer$ActorFragment",
                        "selections": [
                          {
                            "kind": "TypeDiscriminator",
                            "abstractKey": "__isActor"
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "name",
                            "storageKey": null
                          }
                        ]
                      },
                      (v3/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ]
              }
            ],
            "type": "Feedback",
            "abstractKey": null
          },
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "dc67cbfd3786007cede25a97d2255d80",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosStreamDeferQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosStreamDeferQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Feedback {\n      actors @stream(label: \"RelayIncrementalDeliveryTestScenariosStreamDeferQuery$stream$actors\", initial_count: 1) {\n        __typename\n        ...RelayIncrementalDeliveryTestScenariosActorFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosStreamDeferQuery$defer$ActorFragment\")\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosActorFragment on Actor {\n  __isActor: __typename\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "353674350a854a6ecb7c476bd943df3a";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosStreamDeferQuery$variables,
  RelayIncrementalDeliveryTestScenariosStreamDeferQuery$data,
>*/);
