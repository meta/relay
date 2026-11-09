/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<586355b85a630ef11fb14800b654797a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestShadowingArgs_user$fragmentType } from "./RelayServerHandoffTestShadowingArgs_user.graphql";
export type RelayServerHandoffTestShadowingArgsQuery$variables = {};
export type RelayServerHandoffTestShadowingArgsQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: RelayServerHandoffTestShadowingArgs_user$fragmentType,
    },
  },
};
export type RelayServerHandoffTestShadowingArgsQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestShadowingArgsQuery$data,
  variables: RelayServerHandoffTestShadowingArgsQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = [
  2
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestShadowingArgsQuery",
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
                  "args": [
                    {
                      "kind": "Literal",
                      "name": "hasOwnProperty",
                      "value": (v0/*:: as any*/)
                    }
                  ],
                  "kind": "FragmentSpread",
                  "name": "RelayServerHandoffTestShadowingArgs_user"
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
    "name": "RelayServerHandoffTestShadowingArgsQuery",
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
            "args": [
              {
                "kind": "Literal",
                "name": "RelayServerHandoffTestShadowingArgs_user$hasOwnProperty",
                "value": (v0/*:: as any*/)
              }
            ],
            "fragment": require('./RelayServerHandoffTestShadowingArgs_user$normalization.graphql'),
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
    "cacheID": "2cd251d4eb685d2fa990b96b69b23f62",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestShadowingArgsQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestShadowingArgsQuery {\n  me {\n    ...RelayServerHandoffTestShadowingArgs_user_W3mOA\n    id\n  }\n}\n\nfragment RelayServerHandoffTestShadowingArgs_user_W3mOA on User {\n  scaled: profilePicture(size: [2]) {\n    uri\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestShadowingArgs_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestShadowingArgs_user.graphql')
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "b85027093025289f5a83ba86c2c37fd0";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestShadowingArgsQuery$variables,
  RelayServerHandoffTestShadowingArgsQuery$data,
>*/);
