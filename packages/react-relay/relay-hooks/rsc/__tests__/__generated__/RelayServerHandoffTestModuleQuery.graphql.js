/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d611af39762c4b97aa4cb8aa6dc1424d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency RelayServerHandoffTestModule_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestModule_user$fragmentType } from "./RelayServerHandoffTestModule_user.graphql";
export type RelayServerHandoffTestModuleQuery$variables = {};
export type RelayServerHandoffTestModuleQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: RelayServerHandoffTestModule_user$fragmentType,
    },
  },
};
export type RelayServerHandoffTestModuleQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestModuleQuery$data,
  variables: RelayServerHandoffTestModuleQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestModuleQuery",
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
                  "name": "RelayServerHandoffTestModule_user"
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
    "name": "RelayServerHandoffTestModuleQuery",
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
            "fragment": require('./RelayServerHandoffTestModule_user$normalization.graphql'),
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
    "cacheID": "dad5e1b950a9095b219b36e1a17ae719",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestModuleQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestModuleQuery {\n  me {\n    ...RelayServerHandoffTestModule_user\n    id\n  }\n}\n\nfragment RelayServerHandoffTestModule_user on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayServerHandoffTestPlainUserNameRenderer_name\n      __module_operation_RelayServerHandoffTestModule_user: js(module: \"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql\", id: \"RelayServerHandoffTestModule_user.nameRenderer\")\n      __module_component_RelayServerHandoffTestModule_user: js(module: \"PlainUserNameRenderer.react\", id: \"RelayServerHandoffTestModule_user.nameRenderer\")\n    }\n  }\n}\n\nfragment RelayServerHandoffTestPlainUserNameRenderer_name on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestModule_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestModule_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "7d744770cca0779af83470a0471a784a";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestModuleQuery$variables,
  RelayServerHandoffTestModuleQuery$data,
>*/);
