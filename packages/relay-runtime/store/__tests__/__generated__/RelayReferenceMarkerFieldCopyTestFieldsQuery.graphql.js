/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<343c4fc442ce29d143f21a7b687e1155>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayReferenceMarkerFieldCopyTestFieldsQuery$variables = {};
export type RelayReferenceMarkerFieldCopyTestFieldsQuery$data = {
  readonly me: ?{
    readonly lastName: ?string,
    readonly name: ?string,
  },
};
export type RelayReferenceMarkerFieldCopyTestFieldsQuery = {
  response: RelayReferenceMarkerFieldCopyTestFieldsQuery$data,
  variables: RelayReferenceMarkerFieldCopyTestFieldsQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lastName",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayReferenceMarkerFieldCopyTestFieldsQuery",
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
          (v1/*:: as any*/)
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
    "name": "RelayReferenceMarkerFieldCopyTestFieldsQuery",
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
          (v1/*:: as any*/),
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
    "cacheID": "c517aeee9a5cadda586a869424a30067",
    "id": null,
    "metadata": {},
    "name": "RelayReferenceMarkerFieldCopyTestFieldsQuery",
    "operationKind": "query",
    "text": "query RelayReferenceMarkerFieldCopyTestFieldsQuery {\n  me {\n    name\n    lastName\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "7039a19ecaa4fbda2b63d294b772ab4a";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReferenceMarkerFieldCopyTestFieldsQuery$variables,
  RelayReferenceMarkerFieldCopyTestFieldsQuery$data,
>*/);
