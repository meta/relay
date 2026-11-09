/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7ce3624edaf629410871aa2b7f226eee>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { serverQueryTestDeferred_user$fragmentType } from "./serverQueryTestDeferred_user.graphql";
export type serverQueryTestQuery$variables = {};
export type serverQueryTestQuery$data = {
  readonly me: ?{
    readonly $serverFragment: true,
    readonly name: ?string,
    readonly $fragmentSpreads: serverQueryTestDeferred_user$fragmentType,
  },
};
export type serverQueryTestQuery = {
  readonly $serverOperation: true,
  response: serverQueryTestQuery$data,
  variables: serverQueryTestQuery$variables,
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
    "name": "serverQueryTestQuery",
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
            "kind": "Defer",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "serverQueryTestDeferred_user"
              }
            ]
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
    "name": "serverQueryTestQuery",
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
            "if": null,
            "kind": "Defer",
            "label": "serverQueryTestQuery$defer$deferred",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "lastName",
                "storageKey": null
              }
            ]
          },
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
    "cacheID": "3438542a105823910b54b86038ce2cd4",
    "id": null,
    "metadata": {},
    "name": "serverQueryTestQuery",
    "operationKind": "query",
    "text": "query serverQueryTestQuery {\n  me {\n    name\n    ...serverQueryTestDeferred_user @defer(label: \"serverQueryTestQuery$defer$deferred\")\n    id\n  }\n}\n\nfragment serverQueryTestDeferred_user on User {\n  lastName\n}\n"
  },
  "serverHandoff": {
    "clientFragments": []
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "dc6fd5b222bee81b24a64fc3764068ab";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  serverQueryTestQuery$variables,
  serverQueryTestQuery$data,
>*/);
