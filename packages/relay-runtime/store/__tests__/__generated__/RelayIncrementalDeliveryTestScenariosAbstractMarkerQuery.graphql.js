/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a990531c94e5ff08491ce505f1b813fc>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosActorDetailsFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosActorDetailsFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$data = {
  readonly node: ?{
    readonly actors?: ?ReadonlyArray<?{
      readonly name: ?string,
      readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosActorDetailsFragment$fragmentType,
    }>,
  },
};
export type RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery = {
  response: RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$variables,
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
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "kind": "TypeDiscriminator",
  "abstractKey": "__isActor"
},
v5 = {
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
    "name": "RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery",
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
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "actors",
                "plural": true,
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "kind": "Defer",
                    "selections": [
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "RelayIncrementalDeliveryTestScenariosActorDetailsFragment"
                      }
                    ]
                  }
                ],
                "storageKey": null
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
    "name": "RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "actors",
                "plural": true,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v2/*:: as any*/),
                  {
                    "if": null,
                    "kind": "Defer",
                    "label": "RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$defer$ActorDetails",
                    "selections": [
                      (v4/*:: as any*/),
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "lastName",
                        "storageKey": null
                      }
                    ]
                  },
                  (v5/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Feedback",
            "abstractKey": null
          },
          (v5/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "af06c2328f8127e7e0002b6b0856f310",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Feedback {\n      actors {\n        __typename\n        __isActor: __typename\n        name\n        ...RelayIncrementalDeliveryTestScenariosActorDetailsFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$defer$ActorDetails\")\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosActorDetailsFragment on Actor {\n  __isActor: __typename\n  name\n  lastName\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "5d46eebfcf6a4f2ca0f387be0ffcd3f4";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$variables,
  RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$data,
>*/);
