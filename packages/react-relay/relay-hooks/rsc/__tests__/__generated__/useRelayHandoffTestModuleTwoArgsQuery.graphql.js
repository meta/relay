/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<ec5012619eb9b977f0198033dccc64ae>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency useRelayHandoffTestModuleTwoArgs_user.with {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffTestModuleArgsName_name$normalization.graphql"}},"plural":false}
// @indirectDataDrivenDependency useRelayHandoffTestModuleTwoArgs_user.without {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffTestModuleArgsName_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestModuleTwoArgs_user$fragmentType } from "./useRelayHandoffTestModuleTwoArgs_user.graphql";
export type useRelayHandoffTestModuleTwoArgsQuery$variables = {};
export type useRelayHandoffTestModuleTwoArgsQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffTestModuleTwoArgs_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestModuleTwoArgsQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestModuleTwoArgsQuery$data,
  variables: useRelayHandoffTestModuleTwoArgsQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestModuleTwoArgsQuery",
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
                  "name": "useRelayHandoffTestModuleTwoArgs_user"
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
    "name": "useRelayHandoffTestModuleTwoArgsQuery",
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
            "fragment": require('./useRelayHandoffTestModuleTwoArgs_user$normalization.graphql'),
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
    "cacheID": "4a2907532b5291323f0bde8ed8cac4c7",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestModuleTwoArgsQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestModuleTwoArgsQuery {\n  me {\n    ...useRelayHandoffTestModuleTwoArgs_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestModuleArgsName_name_1tPtA on PlainUserNameRenderer {\n  plaintext\n}\n\nfragment useRelayHandoffTestModuleArgsName_name_3uRXRv on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n\nfragment useRelayHandoffTestModuleTwoArgs_user on User {\n  without: nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...useRelayHandoffTestModuleArgsName_name_1tPtA\n      __module_operation_useRelayHandoffTestModuleTwoArgs_user_without: js(module: \"useRelayHandoffTestModuleArgsName_name$normalization.graphql\", id: \"useRelayHandoffTestModuleTwoArgs_user.without\")\n      __module_component_useRelayHandoffTestModuleTwoArgs_user_without: js(module: \"PlainUserNameRenderer.react\", id: \"useRelayHandoffTestModuleTwoArgs_user.without\")\n    }\n  }\n  with: nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...useRelayHandoffTestModuleArgsName_name_3uRXRv\n      __module_operation_useRelayHandoffTestModuleTwoArgs_user_with: js(module: \"useRelayHandoffTestModuleArgsName_name$normalization.graphql\", id: \"useRelayHandoffTestModuleTwoArgs_user.with\")\n      __module_component_useRelayHandoffTestModuleTwoArgs_user_with: js(module: \"PlainUserNameRenderer.react\", id: \"useRelayHandoffTestModuleTwoArgs_user.with\")\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestModuleTwoArgs_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestModuleTwoArgs_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "1c7e1ed81adc9438579f42b36fac5f48";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestModuleTwoArgsQuery$variables,
  useRelayHandoffTestModuleTwoArgsQuery$data,
>*/);
