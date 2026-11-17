/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<fa7422d0a232cc680368a749a967de00>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency useRelayHandoffTestModuleArgs_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffTestModuleArgsName_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestModuleArgs_user$fragmentType } from "./useRelayHandoffTestModuleArgs_user.graphql";
export type useRelayHandoffTestModuleArgsWithoutDataQuery$variables = {};
export type useRelayHandoffTestModuleArgsWithoutDataQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffTestModuleArgs_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestModuleArgsWithoutDataQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestModuleArgsWithoutDataQuery$data,
  variables: useRelayHandoffTestModuleArgsWithoutDataQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestModuleArgsWithoutDataQuery",
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
                      "name": "withData",
                      "value": false
                    }
                  ],
                  "kind": "FragmentSpread",
                  "name": "useRelayHandoffTestModuleArgs_user"
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
    "name": "useRelayHandoffTestModuleArgsWithoutDataQuery",
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
                "name": "useRelayHandoffTestModuleArgs_user$withData",
                "value": false
              }
            ],
            "fragment": require('./useRelayHandoffTestModuleArgs_user$normalization.graphql'),
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
    "cacheID": "29ca79019681e32b021e7c1f3115dbaa",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestModuleArgsWithoutDataQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestModuleArgsWithoutDataQuery {\n  me {\n    ...useRelayHandoffTestModuleArgs_user_1tPtA\n    id\n  }\n}\n\nfragment useRelayHandoffTestModuleArgsName_name_1tPtA on PlainUserNameRenderer {\n  plaintext\n}\n\nfragment useRelayHandoffTestModuleArgs_user_1tPtA on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...useRelayHandoffTestModuleArgsName_name_1tPtA\n      __module_operation_useRelayHandoffTestModuleArgs_user: js(module: \"useRelayHandoffTestModuleArgsName_name$normalization.graphql\", id: \"useRelayHandoffTestModuleArgs_user.nameRenderer\")\n      __module_component_useRelayHandoffTestModuleArgs_user: js(module: \"PlainUserNameRenderer.react\", id: \"useRelayHandoffTestModuleArgs_user.nameRenderer\")\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestModuleArgs_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestModuleArgs_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "15680e6442df80bdfc106a4c05b036c6";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestModuleArgsWithoutDataQuery$variables,
  useRelayHandoffTestModuleArgsWithoutDataQuery$data,
>*/);
