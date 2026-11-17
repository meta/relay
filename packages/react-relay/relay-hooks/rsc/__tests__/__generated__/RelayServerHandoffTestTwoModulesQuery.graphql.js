/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<bcc570acca5a5fcfe99cb5fe684bc27b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestTwoModules_user$fragmentType } from "./RelayServerHandoffTestTwoModules_user.graphql";
export type RelayServerHandoffTestTwoModulesQuery$variables = {};
export type RelayServerHandoffTestTwoModulesQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: RelayServerHandoffTestTwoModules_user$fragmentType,
    },
  },
};
export type RelayServerHandoffTestTwoModulesQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestTwoModulesQuery$data,
  variables: RelayServerHandoffTestTwoModulesQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestTwoModulesQuery",
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
                  "name": "RelayServerHandoffTestTwoModules_user"
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
    "name": "RelayServerHandoffTestTwoModulesQuery",
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
            "fragment": require('./RelayServerHandoffTestTwoModules_user$normalization.graphql'),
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
    "cacheID": "51ca94e9a1e07c6a5402f8bf4005e15b",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestTwoModulesQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestTwoModulesQuery {\n  me {\n    ...RelayServerHandoffTestTwoModules_user\n    id\n  }\n}\n\nfragment RelayServerHandoffTestModuleA_user on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayServerHandoffTestPlainUserNameRenderer_name\n      __module_operation_RelayServerHandoffTestModuleA_user: js(module: \"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql\", id: \"RelayServerHandoffTestModuleA_user.nameRenderer\")\n      __module_component_RelayServerHandoffTestModuleA_user: js(module: \"APlainUserNameRenderer.react\", id: \"RelayServerHandoffTestModuleA_user.nameRenderer\")\n    }\n  }\n}\n\nfragment RelayServerHandoffTestModuleB_user on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayServerHandoffTestPlainUserNameRenderer_name\n      __module_operation_RelayServerHandoffTestModuleB_user: js(module: \"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql\", id: \"RelayServerHandoffTestModuleB_user.nameRenderer\")\n      __module_component_RelayServerHandoffTestModuleB_user: js(module: \"BPlainUserNameRenderer.react\", id: \"RelayServerHandoffTestModuleB_user.nameRenderer\")\n    }\n  }\n}\n\nfragment RelayServerHandoffTestPlainUserNameRenderer_name on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n\nfragment RelayServerHandoffTestTwoModules_user on User {\n  ...RelayServerHandoffTestModuleA_user\n  ...RelayServerHandoffTestModuleB_user\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestTwoModules_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestTwoModules_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "2cd6f13b30ea43a3102d00dfd8b53dad";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestTwoModulesQuery$variables,
  RelayServerHandoffTestTwoModulesQuery$data,
>*/);
