/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a031bac711733302ec7c7d2eef91bb5f>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestAbstract_user$fragmentType } from "./RelayServerHandoffTestAbstract_user.graphql";
export type RelayServerHandoffTestAbstractQuery$variables = {};
export type RelayServerHandoffTestAbstractQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: RelayServerHandoffTestAbstract_user$fragmentType,
    },
  },
};
export type RelayServerHandoffTestAbstractQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestAbstractQuery$data,
  variables: RelayServerHandoffTestAbstractQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestAbstractQuery",
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
                  "name": "RelayServerHandoffTestAbstract_user"
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
    "name": "RelayServerHandoffTestAbstractQuery",
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
            "fragment": require('./RelayServerHandoffTestAbstract_user$normalization.graphql'),
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
    "cacheID": "b7aa306672fc6f5fee2eb3d75db89b44",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestAbstractQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestAbstractQuery {\n  me {\n    ...RelayServerHandoffTestAbstract_user\n    id\n  }\n}\n\nfragment RelayServerHandoffTestAbstractDeferred_user on User {\n  ... on Named {\n    __isNamed: __typename\n    name\n  }\n}\n\nfragment RelayServerHandoffTestAbstract_user on User {\n  name\n  ...RelayServerHandoffTestAbstractDeferred_user @defer(label: \"RelayServerHandoffTestAbstract_user$defer$abstract\")\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestAbstract_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestAbstract_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "a3be4bf788b91bb6e0163e5123feb366";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestAbstractQuery$variables,
  RelayServerHandoffTestAbstractQuery$data,
>*/);
