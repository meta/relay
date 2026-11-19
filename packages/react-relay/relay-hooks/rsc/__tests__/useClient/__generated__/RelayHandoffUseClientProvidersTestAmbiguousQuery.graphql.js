/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<9ce6f4faca1512604ffbf05bd4964505>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency RelayHandoffUseClientProvidersTestAmbiguous_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"../RelayHandoffTestMarkdownRenderer.react","fragment":"RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$normalization.graphql"},"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestAmbiguousPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestAmbiguous_user$fragmentType } from "./RelayHandoffUseClientProvidersTestAmbiguous_user.graphql";
export type RelayHandoffUseClientProvidersTestAmbiguousQuery$variables = {};
export type RelayHandoffUseClientProvidersTestAmbiguousQuery$data = {
  readonly me: ?{
    readonly card: {
      readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestAmbiguous_user$fragmentType,
    },
  },
};
export type RelayHandoffUseClientProvidersTestAmbiguousQuery = {
  readonly $serverOperation: true,
  response: RelayHandoffUseClientProvidersTestAmbiguousQuery$data,
  variables: RelayHandoffUseClientProvidersTestAmbiguousQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayHandoffUseClientProvidersTestAmbiguousQuery",
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
                  "name": "RelayHandoffUseClientProvidersTestAmbiguous_user"
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
    "name": "RelayHandoffUseClientProvidersTestAmbiguousQuery",
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
            "args": [
              {
                "kind": "Literal",
                "name": "supported",
                "value": "34hjiS"
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
                    "documentName": "RelayHandoffUseClientProvidersTestAmbiguous_user",
                    "fragmentName": "RelayHandoffUseClientProvidersTestAmbiguousPlain_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport",
                    "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
                    "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestAmbiguousPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestAmbiguousPlain_name$normalization.graphql'))
                  }
                ],
                "type": "PlainUserNameRenderer",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "args": null,
                    "documentName": "RelayHandoffUseClientProvidersTestAmbiguous_user",
                    "fragmentName": "RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport",
                    "componentModuleProvider": () => require('../../RelayHandoffTestMarkdownRenderer.react'),
                    "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$normalization.graphql'))
                  }
                ],
                "type": "MarkdownUserNameRenderer",
                "abstractKey": null
              }
            ],
            "storageKey": "nameRenderer(supported:\"34hjiS\")"
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
    "cacheID": "1db795ce8623fc16213b0c9e057b058f",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffUseClientProvidersTestAmbiguousQuery",
    "operationKind": "query",
    "text": "query RelayHandoffUseClientProvidersTestAmbiguousQuery {\n  me {\n    ...RelayHandoffUseClientProvidersTestAmbiguous_user\n    id\n  }\n}\n\nfragment RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name on MarkdownUserNameRenderer {\n  markdown\n}\n\nfragment RelayHandoffUseClientProvidersTestAmbiguousPlain_name on PlainUserNameRenderer {\n  plaintext\n}\n\nfragment RelayHandoffUseClientProvidersTestAmbiguous_user on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\", \"MarkdownUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestAmbiguousPlain_name\n    }\n    ... on MarkdownUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayHandoffUseClientProvidersTestAmbiguous_user$normalization.graphql'),
        "fragment": require('./RelayHandoffUseClientProvidersTestAmbiguous_user.graphql'),
        "moduleProviders": {
          "component$RelayHandoffUseClientProvidersTestAmbiguous_user$RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name": require('./RelayHandoffUseClientProvidersTestAmbiguous_user$moduleProviders.client').component$RelayHandoffUseClientProvidersTestAmbiguous_user$RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name,
          "operation$RelayHandoffUseClientProvidersTestAmbiguous_user$RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name": require('./RelayHandoffUseClientProvidersTestAmbiguous_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersTestAmbiguous_user$RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name,
          "component$RelayHandoffUseClientProvidersTestAmbiguous_user$RelayHandoffUseClientProvidersTestAmbiguousPlain_name": require('./RelayHandoffUseClientProvidersTestAmbiguous_user$moduleProviders.client').component$RelayHandoffUseClientProvidersTestAmbiguous_user$RelayHandoffUseClientProvidersTestAmbiguousPlain_name,
          "operation$RelayHandoffUseClientProvidersTestAmbiguous_user$RelayHandoffUseClientProvidersTestAmbiguousPlain_name": require('./RelayHandoffUseClientProvidersTestAmbiguous_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersTestAmbiguous_user$RelayHandoffUseClientProvidersTestAmbiguousPlain_name
        }
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "86e5224e443fa2f2951776d8e92b7a11";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayHandoffUseClientProvidersTestAmbiguousQuery$variables,
  RelayHandoffUseClientProvidersTestAmbiguousQuery$data,
>*/);
