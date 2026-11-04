/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c1aed3754ff53edc3809664811804b35>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayReferenceMarkerFieldCopyTestExecTimeQuery$variables = {};
export type RelayReferenceMarkerFieldCopyTestExecTimeQuery$data = {
  readonly me: ?{
    readonly name: ?string,
  },
};
export type RelayReferenceMarkerFieldCopyTestExecTimeQuery = {
  response: RelayReferenceMarkerFieldCopyTestExecTimeQuery$data,
  variables: RelayReferenceMarkerFieldCopyTestExecTimeQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayReferenceMarkerFieldCopyTestExecTimeQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v0/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayReferenceMarkerFieldCopyTestExecTimeQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v0/*:: as any*/),
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
  },
  "params": {
    "cacheID": "38add045c7c7150fb2535680b4bba254",
    "id": null,
    "metadata": {},
    "name": "RelayReferenceMarkerFieldCopyTestExecTimeQuery",
    "operationKind": "query",
    "text": "query RelayReferenceMarkerFieldCopyTestExecTimeQuery {\n  me {\n    name\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "55a6fdca32402768ae33e9b992d7b91b";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReferenceMarkerFieldCopyTestExecTimeQuery$variables,
  RelayReferenceMarkerFieldCopyTestExecTimeQuery$data,
>*/);
