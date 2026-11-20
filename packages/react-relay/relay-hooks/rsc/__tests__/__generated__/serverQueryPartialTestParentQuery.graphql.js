/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<99e1d15b538943085a87260570220b32>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { serverQueryPartialTestParent_user$fragmentType } from "./serverQueryPartialTestParent_user.graphql";
export type serverQueryPartialTestParentQuery$variables = {};
export type serverQueryPartialTestParentQuery$data = {
  readonly me: ?{
    readonly $serverFragment: true,
    readonly $fragmentSpreads: serverQueryPartialTestParent_user$fragmentType,
  },
};
export type serverQueryPartialTestParentQuery = {
  readonly $serverOperation: true,
  response: serverQueryPartialTestParentQuery$data,
  variables: serverQueryPartialTestParentQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "serverQueryPartialTestParentQuery",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "serverQueryPartialTestParent_user"
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
    "name": "serverQueryPartialTestParentQuery",
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
            "name": "name",
            "storageKey": null
          },
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
    "cacheID": "754edab9106a1c6aeada179593986711",
    "id": null,
    "metadata": {},
    "name": "serverQueryPartialTestParentQuery",
    "operationKind": "query",
    "text": "query serverQueryPartialTestParentQuery {\n  me {\n    ...serverQueryPartialTestParent_user\n    id\n  }\n}\n\nfragment serverQueryPartialTestParent_user on User {\n  name\n  ...serverQueryPartialTestServer_user\n}\n\nfragment serverQueryPartialTestServer_user on User {\n  lastName\n}\n"
  },
  "serverHandoff": {
    "clientFragments": []
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "65389b554f5bfd68eb54f42ce521bf2a";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  serverQueryPartialTestParentQuery$variables,
  serverQueryPartialTestParentQuery$data,
>*/);
