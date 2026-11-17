/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c705f23f8e3ad145e8d1aa42afd05eef>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency useRelayHandoffTestModuleArgs_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffTestModuleArgsName_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestModuleArgs_user$fragmentType } from "./useRelayHandoffTestModuleArgs_user.graphql";
export type useRelayHandoffTestModuleArgsQuery$variables = {};
export type useRelayHandoffTestModuleArgsQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffTestModuleArgs_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestModuleArgsQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestModuleArgsQuery$data,
  variables: useRelayHandoffTestModuleArgsQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestModuleArgsQuery",
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
    "name": "useRelayHandoffTestModuleArgsQuery",
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
    "cacheID": "ad279aa47be265c515f2a40329a8dd0c",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestModuleArgsQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestModuleArgsQuery {\n  me {\n    ...useRelayHandoffTestModuleArgs_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestModuleArgsName_name_3uRXRv on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n\nfragment useRelayHandoffTestModuleArgs_user on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...useRelayHandoffTestModuleArgsName_name_3uRXRv\n      __module_operation_useRelayHandoffTestModuleArgs_user: js(module: \"useRelayHandoffTestModuleArgsName_name$normalization.graphql\", id: \"useRelayHandoffTestModuleArgs_user.nameRenderer\")\n      __module_component_useRelayHandoffTestModuleArgs_user: js(module: \"PlainUserNameRenderer.react\", id: \"useRelayHandoffTestModuleArgs_user.nameRenderer\")\n    }\n  }\n}\n"
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
  (node/*:: as any*/).hash = "7afd59dd1c5bb39d932eebad47a79aaa";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestModuleArgsQuery$variables,
  useRelayHandoffTestModuleArgsQuery$data,
>*/);
