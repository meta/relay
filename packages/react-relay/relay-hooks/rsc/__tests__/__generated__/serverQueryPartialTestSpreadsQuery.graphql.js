/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2b1b2de686bc6de2b39754418c7fd044>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { serverQueryPartialTestClient_query$fragmentType } from "./serverQueryPartialTestClient_query.graphql";
import type { serverQueryPartialTestOuter_query$fragmentType } from "./serverQueryPartialTestOuter_query.graphql";
export type serverQueryPartialTestSpreadsQuery$variables = {};
export type serverQueryPartialTestSpreadsQuery$data = {
  readonly $serverFragment: true,
  readonly client: {
    readonly $fragmentSpreads: serverQueryPartialTestClient_query$fragmentType,
  },
  readonly $fragmentSpreads: serverQueryPartialTestOuter_query$fragmentType,
};
export type serverQueryPartialTestSpreadsQuery = {
  readonly $serverOperation: true,
  response: serverQueryPartialTestSpreadsQuery$data,
  variables: serverQueryPartialTestSpreadsQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "serverQueryPartialTestSpreadsQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "serverQueryPartialTestOuter_query"
      },
      {
        "fragment": {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": null,
              "kind": "FragmentSpread",
              "name": "serverQueryPartialTestClient_query"
            }
          ],
          "type": "Query",
          "abstractKey": null
        },
        "kind": "AliasedInlineFragmentSpread",
        "name": "client"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "serverQueryPartialTestSpreadsQuery",
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
      },
      {
        "fragment": require('./serverQueryPartialTestClient_query$normalization.graphql'),
        "kind": "FragmentSpread"
      }
    ]
  },
  "params": {
    "cacheID": "94b202e28188a2a500cfbc50c0e785b8",
    "id": null,
    "metadata": {},
    "name": "serverQueryPartialTestSpreadsQuery",
    "operationKind": "query",
    "text": "query serverQueryPartialTestSpreadsQuery {\n  ...serverQueryPartialTestOuter_query\n  ...serverQueryPartialTestClient_query\n}\n\nfragment serverQueryPartialTestClient_query on Query {\n  me {\n    username\n    id\n  }\n}\n\nfragment serverQueryPartialTestInner_query on Query {\n  me {\n    lastName\n    id\n  }\n}\n\nfragment serverQueryPartialTestOuter_query on Query {\n  ...serverQueryPartialTestInner_query\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./serverQueryPartialTestClient_query$normalization.graphql'),
        "fragment": require('./serverQueryPartialTestClient_query.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "fcd00c868973d92182aff7ae61a16ba6";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  serverQueryPartialTestSpreadsQuery$variables,
  serverQueryPartialTestSpreadsQuery$data,
>*/);
