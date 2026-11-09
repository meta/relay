/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<420c9bebb5e41a208834bfaf677c9f83>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestStream_user$fragmentType } from "./RelayServerHandoffTestStream_user.graphql";
export type RelayServerHandoffTestStreamQuery$variables = {};
export type RelayServerHandoffTestStreamQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: RelayServerHandoffTestStream_user$fragmentType,
    },
  },
};
export type RelayServerHandoffTestStreamQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestStreamQuery$data,
  variables: RelayServerHandoffTestStreamQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestStreamQuery",
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
                  "name": "RelayServerHandoffTestStream_user"
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
    "name": "RelayServerHandoffTestStreamQuery",
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
            "fragment": require('./RelayServerHandoffTestStream_user$normalization.graphql'),
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
    "cacheID": "1431f192d641ee6ff89107025fe0938b",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestStreamQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestStreamQuery {\n  me {\n    ...RelayServerHandoffTestStream_user\n    id\n  }\n}\n\nfragment RelayServerHandoffTestStream_user on User {\n  friends(first: 100) {\n    edges @stream(label: \"RelayServerHandoffTestStream_user$stream$edges\", initial_count: 1) {\n      node {\n        name\n        id\n      }\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestStream_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestStream_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "e0d91b6e5e208a1fd907c19d56d6e59b";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestStreamQuery$variables,
  RelayServerHandoffTestStreamQuery$data,
>*/);
