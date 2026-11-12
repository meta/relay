/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<000070abc7eabf8c2d564f217246ddb1>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestStream_user$fragmentType } from "./useRelayHandoffTestStream_user.graphql";
export type useRelayHandoffTestStreamQuery$variables = {};
export type useRelayHandoffTestStreamQuery$data = {
  readonly me: ?{
    readonly list: {
      readonly $fragmentSpreads: useRelayHandoffTestStream_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestStreamQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestStreamQuery$data,
  variables: useRelayHandoffTestStreamQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestStreamQuery",
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
                  "name": "useRelayHandoffTestStream_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "list"
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
    "name": "useRelayHandoffTestStreamQuery",
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
            "fragment": require('./useRelayHandoffTestStream_user$normalization.graphql'),
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
    "cacheID": "f08642048a6b8fb1ea9743ce524eae8e",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestStreamQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestStreamQuery {\n  me {\n    ...useRelayHandoffTestStream_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestStream_user on User {\n  friends(first: 10) {\n    edges @stream(label: \"useRelayHandoffTestStream_user$stream$edges\", initial_count: 1) {\n      node {\n        name\n        id\n      }\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestStream_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestStream_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "7ddf66d8c2e75ebc76fb9d19929e6568";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestStreamQuery$variables,
  useRelayHandoffTestStreamQuery$data,
>*/);
