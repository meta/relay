/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<82f70bf6b5e1c2b0bad86b52f068d921>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayReferenceMarkerFieldCopyTestAbstractQuery$variables = {};
export type RelayReferenceMarkerFieldCopyTestAbstractQuery$data = {
  readonly node: ?{
    readonly name?: ?string,
  },
};
export type RelayReferenceMarkerFieldCopyTestAbstractQuery = {
  response: RelayReferenceMarkerFieldCopyTestAbstractQuery$data,
  variables: RelayReferenceMarkerFieldCopyTestAbstractQuery$variables,
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
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "Actor",
  "abstractKey": "__isActor"
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayReferenceMarkerFieldCopyTestAbstractQuery",
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
    "name": "RelayReferenceMarkerFieldCopyTestAbstractQuery",
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
    "cacheID": "0a1cd056acddfade884a561d0abf68ec",
    "id": null,
    "metadata": {},
    "name": "RelayReferenceMarkerFieldCopyTestAbstractQuery",
    "operationKind": "query",
    "text": "query RelayReferenceMarkerFieldCopyTestAbstractQuery {\n  node(id: \"4\") {\n    __typename\n    ... on Actor {\n      __isActor: __typename\n      name\n    }\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "3b925c76ef6d54cf7085c4253f1c532b";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReferenceMarkerFieldCopyTestAbstractQuery$variables,
  RelayReferenceMarkerFieldCopyTestAbstractQuery$data,
>*/);
