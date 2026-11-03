/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d5364b4d911c41ba14165a52affc14f5>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayExperimentalGraphResponseTransformTest_no_inline_user_name$fragmentType } from "./RelayExperimentalGraphResponseTransformTest_no_inline_user_name.graphql";
export type RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery$variables = {};
export type RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayExperimentalGraphResponseTransformTest_no_inline_user_name$fragmentType,
  },
};
export type RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery = {
  response: RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery$data,
  variables: RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "10"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayExperimentalGraphResponseTransformTest_no_inline_user_name"
          }
        ],
        "storageKey": "node(id:\"10\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
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
                "args": null,
                "fragment": require('./RelayExperimentalGraphResponseTransformTest_no_inline_user_name$normalization.graphql'),
                "kind": "FragmentSpread"
              }
            ],
            "type": "User",
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
        "storageKey": "node(id:\"10\")"
      }
    ]
  },
  "params": {
    "cacheID": "c2be61a649c1c0c603f33ec12b31aeaf",
    "id": null,
    "metadata": {},
    "name": "RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery",
    "operationKind": "query",
    "text": "query RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery {\n  node(id: \"10\") {\n    __typename\n    ...RelayExperimentalGraphResponseTransformTest_no_inline_user_name\n    id\n  }\n}\n\nfragment RelayExperimentalGraphResponseTransformTest_no_inline_user_name on User {\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "c757231a3cc1f2f44b4d7cee9b204962";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery$variables,
  RelayExperimentalGraphResponseTransformTestFragmentSpreadNoInlineQuery$data,
>*/);
