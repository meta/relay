/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<89711e5082a73541511519433850914e>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { Result } from "relay-runtime";
export type useRelayHandoffTestFieldErrorClientQuery$variables = {};
export type useRelayHandoffTestFieldErrorClientQuery$data = {
  readonly me: ?{
    readonly lastName: Result<?string, unknown>,
  },
};
export type useRelayHandoffTestFieldErrorClientQuery = {
  response: useRelayHandoffTestFieldErrorClientQuery$data,
  variables: useRelayHandoffTestFieldErrorClientQuery$variables,
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
    "name": "useRelayHandoffTestFieldErrorClientQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          {
            "kind": "CatchField",
            "field": (v0/*:: as any*/),
            "to": "RESULT"
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useRelayHandoffTestFieldErrorClientQuery",
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
    "cacheID": "4e23f6e374762d665e200cf88310f6a9",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestFieldErrorClientQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestFieldErrorClientQuery {\n  me {\n    lastName\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "93a19f83ddae4e88b23d2df5e33a3a90";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  useRelayHandoffTestFieldErrorClientQuery$variables,
  useRelayHandoffTestFieldErrorClientQuery$data,
>*/);
