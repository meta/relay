/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<faf4dd482ca648d97a75a9654642b229>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency useRelayHandoffHydrationTestNamedModule_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffHydrationTestNamedModule_user$fragmentType } from "./useRelayHandoffHydrationTestNamedModule_user.graphql";
export type useRelayHandoffHydrationTestNamedModuleQuery$variables = {};
export type useRelayHandoffHydrationTestNamedModuleQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffHydrationTestNamedModule_user$fragmentType,
    },
  },
};
export type useRelayHandoffHydrationTestNamedModuleQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffHydrationTestNamedModuleQuery$data,
  variables: useRelayHandoffHydrationTestNamedModuleQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffHydrationTestNamedModuleQuery",
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
                  "name": "useRelayHandoffHydrationTestNamedModule_user"
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
    "name": "useRelayHandoffHydrationTestNamedModuleQuery",
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
            "fragment": require('./useRelayHandoffHydrationTestNamedModule_user$normalization.graphql'),
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
    "cacheID": "5a8186fbd2aa1a09a419b54c813547a4",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffHydrationTestNamedModuleQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffHydrationTestNamedModuleQuery {\n  me {\n    ...useRelayHandoffHydrationTestNamedModule_user\n    id\n  }\n}\n\nfragment RelayServerHandoffTestPlainUserNameRenderer_name on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n\nfragment useRelayHandoffHydrationTestNamedModule_user on User {\n  name\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayServerHandoffTestPlainUserNameRenderer_name\n      __module_operation_useRelayHandoffHydrationTestNamedModule_user: js(module: \"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql\", id: \"useRelayHandoffHydrationTestNamedModule_user.nameRenderer\")\n      __module_component_useRelayHandoffHydrationTestNamedModule_user: js(module: \"PlainUserNameRenderer.react\", id: \"useRelayHandoffHydrationTestNamedModule_user.nameRenderer\")\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffHydrationTestNamedModule_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffHydrationTestNamedModule_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "3b041e305ce8efd19548e4e6c0d5fe04";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffHydrationTestNamedModuleQuery$variables,
  useRelayHandoffHydrationTestNamedModuleQuery$data,
>*/);
