/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<9f3a7522b10b6aa29d456ebc7ddfcea0>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayReferenceMarkerFieldCopyTestErrorsQuery$variables = {};
export type RelayReferenceMarkerFieldCopyTestErrorsQuery$data = {
  readonly me: ?{
    readonly lastName: ?string,
  },
};
export type RelayReferenceMarkerFieldCopyTestErrorsQuery = {
  response: RelayReferenceMarkerFieldCopyTestErrorsQuery$data,
  variables: RelayReferenceMarkerFieldCopyTestErrorsQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
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
    "name": "RelayReferenceMarkerFieldCopyTestErrorsQuery",
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
    "name": "RelayReferenceMarkerFieldCopyTestErrorsQuery",
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
    "cacheID": "4bbf955350ee033157ae3a98163d12e4",
    "id": null,
    "metadata": {},
    "name": "RelayReferenceMarkerFieldCopyTestErrorsQuery",
    "operationKind": "query",
    "text": "query RelayReferenceMarkerFieldCopyTestErrorsQuery {\n  me {\n    lastName\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "c31465249907e790a1bc454ced4f4242";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReferenceMarkerFieldCopyTestErrorsQuery$variables,
  RelayReferenceMarkerFieldCopyTestErrorsQuery$data,
>*/);
