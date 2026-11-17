/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<60ef72410b0f103ec40dbf66b73de134>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency useRelayHandoffHydrationTestTwoMatches_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffHydrationTestDefaulted_name$normalization.graphql"}},"plural":false}
// @indirectDataDrivenDependency useRelayHandoffHydrationTestTwoMatches_user.nameRendererForContext {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffHydrationTestDefaulted_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffHydrationTestTwoMatches_user$fragmentType } from "./useRelayHandoffHydrationTestTwoMatches_user.graphql";
export type useRelayHandoffHydrationTestTwoMatchesQuery$variables = {};
export type useRelayHandoffHydrationTestTwoMatchesQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffHydrationTestTwoMatches_user$fragmentType,
    },
  },
};
export type useRelayHandoffHydrationTestTwoMatchesQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffHydrationTestTwoMatchesQuery$data,
  variables: useRelayHandoffHydrationTestTwoMatchesQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffHydrationTestTwoMatchesQuery",
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
                  "name": "useRelayHandoffHydrationTestTwoMatches_user"
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
    "name": "useRelayHandoffHydrationTestTwoMatchesQuery",
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
            "fragment": require('./useRelayHandoffHydrationTestTwoMatches_user$normalization.graphql'),
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
    "cacheID": "2f133c6ad783150ace16f18914dfbf3f",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffHydrationTestTwoMatchesQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffHydrationTestTwoMatchesQuery {\n  me {\n    ...useRelayHandoffHydrationTestTwoMatches_user\n    id\n  }\n}\n\nfragment useRelayHandoffHydrationTestDefaulted_name on PlainUserNameRenderer {\n  plaintext\n}\n\nfragment useRelayHandoffHydrationTestDefaulted_name_3uRXRv on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n\nfragment useRelayHandoffHydrationTestTwoMatches_user on User {\n  name\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...useRelayHandoffHydrationTestDefaulted_name_3uRXRv\n      __module_operation_useRelayHandoffHydrationTestTwoMatches_user_with: js(module: \"useRelayHandoffHydrationTestDefaulted_name$normalization.graphql\", id: \"useRelayHandoffHydrationTestTwoMatches_user.nameRenderer\")\n      __module_component_useRelayHandoffHydrationTestTwoMatches_user_with: js(module: \"PlainUserNameRenderer.react\", id: \"useRelayHandoffHydrationTestTwoMatches_user.nameRenderer\")\n    }\n  }\n  nameRendererForContext(context: HEADER, supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...useRelayHandoffHydrationTestDefaulted_name\n      __module_operation_useRelayHandoffHydrationTestTwoMatches_user_default: js(module: \"useRelayHandoffHydrationTestDefaulted_name$normalization.graphql\", id: \"useRelayHandoffHydrationTestTwoMatches_user.nameRendererForContext\")\n      __module_component_useRelayHandoffHydrationTestTwoMatches_user_default: js(module: \"PlainUserNameRenderer.react\", id: \"useRelayHandoffHydrationTestTwoMatches_user.nameRendererForContext\")\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffHydrationTestTwoMatches_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffHydrationTestTwoMatches_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "4a9d03468818376ff379d14b4a8a66d1";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffHydrationTestTwoMatchesQuery$variables,
  useRelayHandoffHydrationTestTwoMatchesQuery$data,
>*/);
