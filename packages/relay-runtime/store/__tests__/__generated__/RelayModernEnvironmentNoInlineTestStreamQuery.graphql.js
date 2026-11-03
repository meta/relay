/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f4017abce7793863616e7cb86a427c45>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentNoInlineTestStream_feedback$fragmentType } from "./RelayModernEnvironmentNoInlineTestStream_feedback.graphql";
export type RelayModernEnvironmentNoInlineTestStreamQuery$variables = {
  cond: boolean,
};
export type RelayModernEnvironmentNoInlineTestStreamQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayModernEnvironmentNoInlineTestStream_feedback$fragmentType,
  },
};
export type RelayModernEnvironmentNoInlineTestStreamQuery = {
  response: RelayModernEnvironmentNoInlineTestStreamQuery$data,
  variables: RelayModernEnvironmentNoInlineTestStreamQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "cond"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "1"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernEnvironmentNoInlineTestStreamQuery",
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
            "args": [
              {
                "kind": "Variable",
                "name": "cond",
                "variableName": "cond"
              }
            ],
            "kind": "FragmentSpread",
            "name": "RelayModernEnvironmentNoInlineTestStream_feedback"
          }
        ],
        "storageKey": "node(id:\"1\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "RelayModernEnvironmentNoInlineTestStreamQuery",
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
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": [
                  {
                    "kind": "Variable",
                    "name": "RelayModernEnvironmentNoInlineTestStream_feedback$cond",
                    "variableName": "cond"
                  }
                ],
                "fragment": require('./RelayModernEnvironmentNoInlineTestStream_feedback$normalization.graphql'),
                "kind": "FragmentSpread"
              }
            ],
            "type": "Feedback",
            "abstractKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": "node(id:\"1\")"
      }
    ]
  },
  "params": {
    "cacheID": "8fc97cd294d6932de54434bbab273bbf",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentNoInlineTestStreamQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentNoInlineTestStreamQuery(\n  $cond: Boolean!\n) {\n  node(id: \"1\") {\n    __typename\n    ...RelayModernEnvironmentNoInlineTestStream_feedback_yuQoQ\n    id\n  }\n}\n\nfragment RelayModernEnvironmentNoInlineTestStream_feedback_yuQoQ on Feedback {\n  actors @stream(label: \"RelayModernEnvironmentNoInlineTestStream_feedback$stream$actors\", initial_count: 0) {\n    __typename\n    __isActor: __typename @include(if: $cond)\n    name @include(if: $cond)\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "ef3b0ee1286de679a140741dc9baed1d";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentNoInlineTestStreamQuery$variables,
  RelayModernEnvironmentNoInlineTestStreamQuery$data,
>*/);
