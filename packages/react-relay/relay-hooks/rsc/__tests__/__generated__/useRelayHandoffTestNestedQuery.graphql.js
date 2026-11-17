/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<e1c940c9c5c721afa53364913699611b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency useRelayHandoffTestNestedCard_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"Outer.react","fragment":"useRelayHandoffTestNestedOuter_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestNestedCard_user$fragmentType } from "./useRelayHandoffTestNestedCard_user.graphql";
export type useRelayHandoffTestNestedQuery$variables = {};
export type useRelayHandoffTestNestedQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: useRelayHandoffTestNestedCard_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestNestedQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestNestedQuery$data,
  variables: useRelayHandoffTestNestedQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestNestedQuery",
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
                  "name": "useRelayHandoffTestNestedCard_user"
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
    "name": "useRelayHandoffTestNestedQuery",
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
            "fragment": require('./useRelayHandoffTestNestedCard_user$normalization.graphql'),
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
    "cacheID": "7221215901d16e5d4df89d61a7e7af60",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestNestedQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestNestedQuery {\n  me {\n    ...useRelayHandoffTestNestedCard_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestNestedCard_user on User {\n  name\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...useRelayHandoffTestNestedOuter_name\n      __module_operation_useRelayHandoffTestNestedCard_user: js(module: \"useRelayHandoffTestNestedOuter_name$normalization.graphql\", id: \"useRelayHandoffTestNestedCard_user.nameRenderer\")\n      __module_component_useRelayHandoffTestNestedCard_user: js(module: \"Outer.react\", id: \"useRelayHandoffTestNestedCard_user.nameRenderer\")\n    }\n  }\n}\n\nfragment useRelayHandoffTestNestedInner_name_22eGLd on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n\nfragment useRelayHandoffTestNestedOuter_name on PlainUserNameRenderer {\n  plaintext\n  user {\n    nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n      __typename\n      ... on PlainUserNameRenderer {\n        ...useRelayHandoffTestNestedInner_name_22eGLd\n        __module_operation_useRelayHandoffTestNestedOuter_name: js(module: \"useRelayHandoffTestNestedInner_name$normalization.graphql\", id: \"useRelayHandoffTestNestedOuter_name.user.nameRenderer\")\n        __module_component_useRelayHandoffTestNestedOuter_name: js(module: \"Inner.react\", id: \"useRelayHandoffTestNestedOuter_name.user.nameRenderer\")\n      }\n    }\n    id\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestNestedCard_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestNestedCard_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "9c8b83871bf0bda406464d5e6a332f5e";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestNestedQuery$variables,
  useRelayHandoffTestNestedQuery$data,
>*/);
