/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<6c18e8f98519f05d49cd09caa36ecade>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffHydrationTestLiveName_user$fragmentType } from "./useRelayHandoffHydrationTestLiveName_user.graphql";
export type useRelayHandoffHydrationTestLiveNameQuery$variables = {};
export type useRelayHandoffHydrationTestLiveNameQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffHydrationTestLiveName_user$fragmentType,
    },
  },
};
export type useRelayHandoffHydrationTestLiveNameQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffHydrationTestLiveNameQuery$data,
  variables: useRelayHandoffHydrationTestLiveNameQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffHydrationTestLiveNameQuery",
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
                  "name": "useRelayHandoffHydrationTestLiveName_user"
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
    "name": "useRelayHandoffHydrationTestLiveNameQuery",
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
            "fragment": require('./useRelayHandoffHydrationTestLiveName_user$normalization.graphql'),
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
    "cacheID": "2c300f951bc9460e72a598a10e8fb98b",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffHydrationTestLiveNameQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffHydrationTestLiveNameQuery {\n  me {\n    ...useRelayHandoffHydrationTestLiveName_user\n    id\n  }\n}\n\nfragment RelayHandoffTestLiveNameResolver on User {\n  name\n}\n\nfragment useRelayHandoffHydrationTestLiveName_user on User {\n  ...RelayHandoffTestLiveNameResolver\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffHydrationTestLiveName_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffHydrationTestLiveName_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "0da9450c446fc73e4f588001b716850e";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffHydrationTestLiveNameQuery$variables,
  useRelayHandoffHydrationTestLiveNameQuery$data,
>*/);
