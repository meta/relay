/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7227487e7d338b555131e414cb315819>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestStreamTarget_user$fragmentType } from "./RelayServerHandoffTestStreamTarget_user.graphql";
export type RelayServerHandoffTestStreamTargetQuery$variables = {};
export type RelayServerHandoffTestStreamTargetQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: RelayServerHandoffTestStreamTarget_user$fragmentType,
    },
  },
};
export type RelayServerHandoffTestStreamTargetQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestStreamTargetQuery$data,
  variables: RelayServerHandoffTestStreamTargetQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestStreamTargetQuery",
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
                  "name": "RelayServerHandoffTestStreamTarget_user"
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
    "name": "RelayServerHandoffTestStreamTargetQuery",
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
            "fragment": require('./RelayServerHandoffTestStreamTarget_user$normalization.graphql'),
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
    "cacheID": "1ad29b920131ca6608ac584f40741421",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestStreamTargetQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestStreamTargetQuery {\n  me {\n    ...RelayServerHandoffTestStreamTarget_user\n    id\n  }\n}\n\nfragment RelayServerHandoffTestStreamTarget_user on User {\n  friends(first: 10) {\n    edges @stream(label: \"RelayServerHandoffTestStreamTarget_user$stream$edges\", initial_count: 1) {\n      node {\n        name\n        friends(first: 3) {\n          edges {\n            node {\n              name\n              id\n            }\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestStreamTarget_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestStreamTarget_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "f8622c624e6837f61feaf0ae61fb00fe";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestStreamTargetQuery$variables,
  RelayServerHandoffTestStreamTargetQuery$data,
>*/);
