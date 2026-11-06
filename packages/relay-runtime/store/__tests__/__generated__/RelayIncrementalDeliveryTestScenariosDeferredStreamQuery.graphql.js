/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<165fab6df3e15307abd1546bfba31d3c>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosDeferredStreamFragment.graphql";
export type RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$variables = {
  id: string,
};
export type RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$fragmentType,
  },
};
export type RelayIncrementalDeliveryTestScenariosDeferredStreamQuery = {
  response: RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$variables,
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
    "name": "RelayIncrementalDeliveryTestScenariosDeferredStreamQuery",
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
            "kind": "Defer",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "RelayIncrementalDeliveryTestScenariosDeferredStreamFragment"
              }
            ]
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
    "name": "RelayIncrementalDeliveryTestScenariosDeferredStreamQuery",
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
            "if": null,
            "kind": "Defer",
            "label": "RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$defer$DeferredStream",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "if": null,
                    "kind": "Stream",
                    "label": "RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$stream$actors",
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
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "name",
                            "storageKey": null
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
              }
            ]
          },
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "86755f254a05c3ccd73c9f7d4cc9750b",
    "id": null,
    "metadata": {},
    "name": "RelayIncrementalDeliveryTestScenariosDeferredStreamQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosDeferredStreamQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RelayIncrementalDeliveryTestScenariosDeferredStreamFragment @defer(label: \"RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$defer$DeferredStream\")\n    id\n  }\n}\n\nfragment RelayIncrementalDeliveryTestScenariosDeferredStreamFragment on Feedback {\n  actors @stream(label: \"RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$stream$actors\", initial_count: 1) {\n    __typename\n    name\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "9d06f9ff5907af989e61dfe953e9e3bb";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$variables,
  RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$data,
>*/);
