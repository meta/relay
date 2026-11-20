/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<5abc011566c874535e4d7942405adc71>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { serverQueryPartialTestChainDeferParent_query$fragmentType } from "./serverQueryPartialTestChainDeferParent_query.graphql";
export type serverQueryPartialTestChainDeferQuery$variables = {};
export type serverQueryPartialTestChainDeferQuery$data = {
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestChainDeferParent_query$fragmentType,
};
export type serverQueryPartialTestChainDeferQuery = {
  readonly $serverOperation: true,
  response: serverQueryPartialTestChainDeferQuery$data,
  variables: serverQueryPartialTestChainDeferQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "serverQueryPartialTestChainDeferQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "serverQueryPartialTestChainDeferParent_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "serverQueryPartialTestChainDeferQuery",
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
            "if": null,
            "kind": "Defer",
            "label": "serverQueryPartialTestChainDeferMiddle_user$defer$child",
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
    "cacheID": "4273ed563a056f0d332377a147f1182e",
    "id": null,
    "metadata": {},
    "name": "serverQueryPartialTestChainDeferQuery",
    "operationKind": "query",
    "text": "query serverQueryPartialTestChainDeferQuery {\n  ...serverQueryPartialTestChainDeferParent_query\n}\n\nfragment serverQueryPartialTestChainDeferMiddle_user on User {\n  ...serverQueryPartialTestServer_user @defer(label: \"serverQueryPartialTestChainDeferMiddle_user$defer$child\")\n}\n\nfragment serverQueryPartialTestChainDeferParent_query on Query {\n  me {\n    ...serverQueryPartialTestChainDeferMiddle_user\n    id\n  }\n}\n\nfragment serverQueryPartialTestServer_user on User {\n  lastName\n}\n"
  },
  "serverHandoff": {
    "clientFragments": []
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "ba47e2c157e7027671e62bd231ae2fc4";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  serverQueryPartialTestChainDeferQuery$variables,
  serverQueryPartialTestChainDeferQuery$data,
>*/);
