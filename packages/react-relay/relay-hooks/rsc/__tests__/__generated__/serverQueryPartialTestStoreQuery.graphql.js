/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<8ddfd8051708048c1ac06f01d5ed8e15>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { serverQueryPartialTestClient_user$fragmentType } from "./serverQueryPartialTestClient_user.graphql";
import type { serverQueryPartialTestServer_user$fragmentType } from "./serverQueryPartialTestServer_user.graphql";
export type serverQueryPartialTestStoreQuery$variables = {};
export type serverQueryPartialTestStoreQuery$data = {
  readonly me: ?{
    readonly $serverFragment: true,
    readonly client: {
      readonly $fragmentSpreads: serverQueryPartialTestClient_user$fragmentType,
    },
    readonly name: ?string,
    readonly $fragmentSpreads: serverQueryPartialTestServer_user$fragmentType,
  },
};
export type serverQueryPartialTestStoreQuery = {
  readonly $serverOperation: true,
  response: serverQueryPartialTestStoreQuery$data,
  variables: serverQueryPartialTestStoreQuery$variables,
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
    "name": "serverQueryPartialTestStoreQuery",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "serverQueryPartialTestServer_user"
          },
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "serverQueryPartialTestClient_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "client"
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
    "name": "serverQueryPartialTestStoreQuery",
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
            "name": "lastName",
            "storageKey": null
          },
          {
            "fragment": require('./serverQueryPartialTestClient_user$normalization.graphql'),
            "kind": "FragmentSpread"
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
    "cacheID": "8f807ef9268b193b87af608551ae5295",
    "id": null,
    "metadata": {},
    "name": "serverQueryPartialTestStoreQuery",
    "operationKind": "query",
    "text": "query serverQueryPartialTestStoreQuery {\n  me {\n    name\n    ...serverQueryPartialTestServer_user\n    ...serverQueryPartialTestClient_user\n    id\n  }\n}\n\nfragment serverQueryPartialTestClient_user on User {\n  username\n}\n\nfragment serverQueryPartialTestServer_user on User {\n  lastName\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./serverQueryPartialTestClient_user$normalization.graphql'),
        "fragment": require('./serverQueryPartialTestClient_user.graphql')
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "5628d54b1bb1b3b9a9e0aaaffc480e1a";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  serverQueryPartialTestStoreQuery$variables,
  serverQueryPartialTestStoreQuery$data,
>*/);
