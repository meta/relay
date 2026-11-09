/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<1ccdf8c42fd2ed5cf29a463d3c4558e3>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { serverQueryTestClient_user$fragmentType } from "./serverQueryTestClient_user.graphql";
import type { serverQueryTestDeferred_user$fragmentType } from "./serverQueryTestDeferred_user.graphql";
export type serverQueryTestQuery$variables = {};
export type serverQueryTestQuery$data = {
  readonly me: ?{
    readonly $serverFragment: true,
    readonly client: {
      readonly $fragmentSpreads: serverQueryTestClient_user$fragmentType,
    },
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
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "serverQueryTestClient_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "client"
          },
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
            "fragment": require('./serverQueryTestClient_user$normalization.graphql'),
            "kind": "FragmentSpread"
          },
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
    "cacheID": "b541ec9892c0c1253c085f7febb66455",
    "id": null,
    "metadata": {},
    "name": "serverQueryTestQuery",
    "operationKind": "query",
    "text": "query serverQueryTestQuery {\n  me {\n    name\n    ...serverQueryTestClient_user\n    ...serverQueryTestDeferred_user @defer(label: \"serverQueryTestQuery$defer$deferred\")\n    id\n  }\n}\n\nfragment serverQueryTestClient_user on User {\n  name\n}\n\nfragment serverQueryTestDeferred_user on User {\n  lastName\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./serverQueryTestClient_user$normalization.graphql'),
        "fragment": require('./serverQueryTestClient_user.graphql')
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "dfe1f0476b0d2872757e6b6577b91f8a";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  serverQueryTestQuery$variables,
  serverQueryTestQuery$data,
>*/);
