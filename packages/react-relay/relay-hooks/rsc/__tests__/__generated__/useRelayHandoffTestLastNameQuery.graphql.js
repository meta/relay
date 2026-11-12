/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f21afae18cef6d0d0c3738b0746c0a27>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type useRelayHandoffTestLastNameQuery$variables = {};
export type useRelayHandoffTestLastNameQuery$data = {
  readonly node: ?{
    readonly lastName?: ?string,
  },
};
export type useRelayHandoffTestLastNameQuery = {
  response: useRelayHandoffTestLastNameQuery$data,
  variables: useRelayHandoffTestLastNameQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "4"
  }
],
v1 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastName",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestLastNameQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v1/*:: as any*/)
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
    "name": "useRelayHandoffTestLastNameQuery",
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
          (v1/*:: as any*/),
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
    "cacheID": "d99a5bbe29d65d03d048842b65583441",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestLastNameQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestLastNameQuery {\n  node(id: \"4\") {\n    __typename\n    ... on User {\n      lastName\n    }\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "43ef5bc3adbbdf34e1834b51a750929e";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  useRelayHandoffTestLastNameQuery$variables,
  useRelayHandoffTestLastNameQuery$data,
>*/);
