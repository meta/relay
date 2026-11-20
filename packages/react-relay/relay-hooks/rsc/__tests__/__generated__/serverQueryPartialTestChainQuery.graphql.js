/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4ef162d251c024ebba105cc0290b7097>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { serverQueryPartialTestChainParent_query$fragmentType } from "./serverQueryPartialTestChainParent_query.graphql";
export type serverQueryPartialTestChainQuery$variables = {};
export type serverQueryPartialTestChainQuery$data = {
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestChainParent_query$fragmentType,
};
export type serverQueryPartialTestChainQuery = {
  readonly $serverOperation: true,
  response: serverQueryPartialTestChainQuery$data,
  variables: serverQueryPartialTestChainQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "serverQueryPartialTestChainQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "serverQueryPartialTestChainParent_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "serverQueryPartialTestChainQuery",
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
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lastName",
            "storageKey": null
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
    "cacheID": "a88052a1dbb3bc6d4bd8359066d2ec66",
    "id": null,
    "metadata": {},
    "name": "serverQueryPartialTestChainQuery",
    "operationKind": "query",
    "text": "query serverQueryPartialTestChainQuery {\n  ...serverQueryPartialTestChainParent_query\n}\n\nfragment serverQueryPartialTestChainMiddle_user on User {\n  ...serverQueryPartialTestServer_user\n}\n\nfragment serverQueryPartialTestChainParent_query on Query {\n  me {\n    ...serverQueryPartialTestChainMiddle_user\n    id\n  }\n}\n\nfragment serverQueryPartialTestServer_user on User {\n  lastName\n}\n"
  },
  "serverHandoff": {
    "clientFragments": []
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "0fb0a3cc33b08aa9263da6dae9ab4007";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  serverQueryPartialTestChainQuery$variables,
  serverQueryPartialTestChainQuery$data,
>*/);
