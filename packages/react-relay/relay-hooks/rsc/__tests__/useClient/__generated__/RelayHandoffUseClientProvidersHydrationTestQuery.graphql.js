/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<77ffcea4fffee30889808b4e4b8e5c9c>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency RelayHandoffUseClientProvidersHydrationTest_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersHydrationTest_user$fragmentType } from "./RelayHandoffUseClientProvidersHydrationTest_user.graphql";
export type RelayHandoffUseClientProvidersHydrationTestQuery$variables = {};
export type RelayHandoffUseClientProvidersHydrationTestQuery$data = {
  readonly me: ?{
    readonly card: {
      readonly $fragmentSpreads: RelayHandoffUseClientProvidersHydrationTest_user$fragmentType,
    },
  },
};
export type RelayHandoffUseClientProvidersHydrationTestQuery = {
  readonly $serverOperation: true,
  response: RelayHandoffUseClientProvidersHydrationTestQuery$data,
  variables: RelayHandoffUseClientProvidersHydrationTestQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayHandoffUseClientProvidersHydrationTestQuery",
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
                  "name": "RelayHandoffUseClientProvidersHydrationTest_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "card"
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
    "name": "RelayHandoffUseClientProvidersHydrationTestQuery",
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
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          },
          {
            "alias": null,
            "args": [
              {
                "kind": "Literal",
                "name": "supported",
                "value": "1AwQS7"
              }
            ],
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "args": null,
                    "documentName": "RelayHandoffUseClientProvidersHydrationTest_user",
                    "fragmentName": "RelayHandoffUseClientProvidersTestPlain_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport",
                    "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
                    "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql'))
                  }
                ],
                "type": "PlainUserNameRenderer",
                "abstractKey": null
              }
            ],
            "storageKey": "nameRenderer(supported:\"1AwQS7\")"
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
    "cacheID": "c706f577213ece5190cfccdba0c68ee5",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffUseClientProvidersHydrationTestQuery",
    "operationKind": "query",
    "text": "query RelayHandoffUseClientProvidersHydrationTestQuery {\n  me {\n    ...RelayHandoffUseClientProvidersHydrationTest_user\n    id\n  }\n}\n\nfragment RelayHandoffUseClientProvidersHydrationTest_user on User {\n  name\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestPlain_name\n    }\n  }\n}\n\nfragment RelayHandoffUseClientProvidersTestPlain_name on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayHandoffUseClientProvidersHydrationTest_user$normalization.graphql'),
        "fragment": require('./RelayHandoffUseClientProvidersHydrationTest_user.graphql'),
        "moduleProviders": {
          "component$RelayHandoffUseClientProvidersHydrationTest_user$RelayHandoffUseClientProvidersTestPlain_name": require('./RelayHandoffUseClientProvidersHydrationTest_user$moduleProviders.client').component$RelayHandoffUseClientProvidersHydrationTest_user$RelayHandoffUseClientProvidersTestPlain_name,
          "operation$RelayHandoffUseClientProvidersHydrationTest_user$RelayHandoffUseClientProvidersTestPlain_name": require('./RelayHandoffUseClientProvidersHydrationTest_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersHydrationTest_user$RelayHandoffUseClientProvidersTestPlain_name
        }
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "f2883888b36b181ffd8194f92a914697";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayHandoffUseClientProvidersHydrationTestQuery$variables,
  RelayHandoffUseClientProvidersHydrationTestQuery$data,
>*/);
