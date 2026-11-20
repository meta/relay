/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<79a7b1b91bf62514035cd6637ce61314>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
export type serverQueryPartialTestNameQuery$variables = {};
export type serverQueryPartialTestNameQuery$data = {
  readonly me: ?{
    readonly name: ?string,
  },
};
export type serverQueryPartialTestNameQuery = {
  readonly $serverOperation: true,
  response: serverQueryPartialTestNameQuery$data,
  variables: serverQueryPartialTestNameQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
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
    "name": "serverQueryPartialTestNameQuery",
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
    "name": "serverQueryPartialTestNameQuery",
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
    "cacheID": "a0bb43544499a51d2751956430be1ab9",
    "id": null,
    "metadata": {},
    "name": "serverQueryPartialTestNameQuery",
    "operationKind": "query",
    "text": "query serverQueryPartialTestNameQuery {\n  me {\n    name\n    id\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": []
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "35947aff84a83d72e3f2256d8a6d138f";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  serverQueryPartialTestNameQuery$variables,
  serverQueryPartialTestNameQuery$data,
>*/);
