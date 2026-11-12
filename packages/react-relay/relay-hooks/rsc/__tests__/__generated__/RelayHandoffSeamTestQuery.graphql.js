/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<9caf38abd0e8d3d607da2ff98afbd1d9>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayHandoffSeamTest_user$fragmentType } from "./RelayHandoffSeamTest_user.graphql";
export type RelayHandoffSeamTestQuery$variables = {};
export type RelayHandoffSeamTestQuery$data = {
  readonly me: ?{
    readonly $fragmentSpreads: RelayHandoffSeamTest_user$fragmentType,
  },
};
export type RelayHandoffSeamTestQuery = {
  response: RelayHandoffSeamTestQuery$data,
  variables: RelayHandoffSeamTestQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayHandoffSeamTestQuery",
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
            "name": "RelayHandoffSeamTest_user"
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
    "name": "RelayHandoffSeamTestQuery",
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
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "082d0a03d65547708cb0b4a02d6205a0",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffSeamTestQuery",
    "operationKind": "query",
    "text": "query RelayHandoffSeamTestQuery {\n  me {\n    ...RelayHandoffSeamTest_user\n    id\n  }\n}\n\nfragment RelayHandoffSeamTest_user on User {\n  name\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "db7db3f75b6302e62d8b0ca20eb10bc7";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayHandoffSeamTestQuery$variables,
  RelayHandoffSeamTestQuery$data,
>*/);
