/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<346926450ed1d531948b64dc648b57db>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayHandoffSeamTestHanded_user$fragmentType } from "./RelayHandoffSeamTestHanded_user.graphql";
export type RelayHandoffSeamTestServerQuery$variables = {};
export type RelayHandoffSeamTestServerQuery$data = {
  readonly me: ?{
    readonly user: {
      readonly $fragmentSpreads: RelayHandoffSeamTestHanded_user$fragmentType,
    },
  },
};
export type RelayHandoffSeamTestServerQuery = {
  readonly $serverOperation: true,
  response: RelayHandoffSeamTestServerQuery$data,
  variables: RelayHandoffSeamTestServerQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayHandoffSeamTestServerQuery",
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
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "RelayHandoffSeamTestHanded_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "user"
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
    "name": "RelayHandoffSeamTestServerQuery",
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
            "fragment": require('./RelayHandoffSeamTestHanded_user$normalization.graphql'),
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
    "cacheID": "5c438b3dbc1a6043fab4db8f720fc636",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffSeamTestServerQuery",
    "operationKind": "query",
    "text": "query RelayHandoffSeamTestServerQuery {\n  me {\n    ...RelayHandoffSeamTestHanded_user\n    id\n  }\n}\n\nfragment RelayHandoffSeamTestHanded_user on User {\n  name\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayHandoffSeamTestHanded_user$normalization.graphql'),
        "fragment": require('./RelayHandoffSeamTestHanded_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "62482cfbf39fce0468ce915e99f8e441";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayHandoffSeamTestServerQuery$variables,
  RelayHandoffSeamTestServerQuery$data,
>*/);
