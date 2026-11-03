/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c80e38e257f0ffce13bce7110aa53a0e>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayMockPayloadGeneratorTest_fragment59$fragmentType } from "./RelayMockPayloadGeneratorTest_fragment59.graphql";
export type RelayMockPayloadGeneratorTest58Query$variables = {};
export type RelayMockPayloadGeneratorTest58Query$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayMockPayloadGeneratorTest_fragment59$fragmentType,
  },
};
export type RelayMockPayloadGeneratorTest58Query = {
  response: RelayMockPayloadGeneratorTest58Query$data,
  variables: RelayMockPayloadGeneratorTest58Query$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "4"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayMockPayloadGeneratorTest58Query",
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
            "args": [
              {
                "kind": "Literal",
                "name": "cond",
                "value": true
              }
            ],
            "kind": "FragmentSpread",
            "name": "RelayMockPayloadGeneratorTest_fragment59"
          }
        ],
        "storageKey": "node(id:\"4\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayMockPayloadGeneratorTest58Query",
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
                "args": [
                  {
                    "kind": "Literal",
                    "name": "RelayMockPayloadGeneratorTest_fragment59$cond",
                    "value": true
                  }
                ],
                "fragment": require('./RelayMockPayloadGeneratorTest_fragment59$normalization.graphql'),
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
        "storageKey": "node(id:\"4\")"
      }
    ]
  },
  "params": {
    "cacheID": "5a6272973d0967c473047a457505a252",
    "id": null,
    "metadata": {},
    "name": "RelayMockPayloadGeneratorTest58Query",
    "operationKind": "query",
    "text": "query RelayMockPayloadGeneratorTest58Query {\n  node(id: \"4\") {\n    __typename\n    ...RelayMockPayloadGeneratorTest_fragment59_22eGLd\n    id\n  }\n}\n\nfragment RelayMockPayloadGeneratorTest_fragment59_22eGLd on User {\n  id\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "c0467d664d629e5180ecfc619505654e";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayMockPayloadGeneratorTest58Query$variables,
  RelayMockPayloadGeneratorTest58Query$data,
>*/);
