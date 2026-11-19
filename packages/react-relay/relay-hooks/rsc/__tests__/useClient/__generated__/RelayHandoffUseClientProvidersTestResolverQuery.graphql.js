/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<38af0d0041b6ad41c982d256a7ede77a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestResolver_user$fragmentType } from "./RelayHandoffUseClientProvidersTestResolver_user.graphql";
export type RelayHandoffUseClientProvidersTestResolverQuery$variables = {};
export type RelayHandoffUseClientProvidersTestResolverQuery$data = {
  readonly me: ?{
    readonly resolverCard: {
      readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestResolver_user$fragmentType,
    },
  },
};
export type RelayHandoffUseClientProvidersTestResolverQuery = {
  readonly $serverOperation: true,
  response: RelayHandoffUseClientProvidersTestResolverQuery$data,
  variables: RelayHandoffUseClientProvidersTestResolverQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayHandoffUseClientProvidersTestResolverQuery",
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
                  "name": "RelayHandoffUseClientProvidersTestResolver_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "resolverCard"
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
    "name": "RelayHandoffUseClientProvidersTestResolverQuery",
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
            "name": "handoffRendererProp",
            "args": null,
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "alias": "resolverRenderer",
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
                          "documentName": "RelayHandoffUseClientProvidersResolverInline_user",
                          "fragmentName": "RelayHandoffUseClientProvidersResolverPlain_name",
                          "fragmentPropName": "name",
                          "kind": "ModuleImport",
                          "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
                          "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersResolverPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersResolverPlain_name$normalization.graphql'))
                        }
                      ],
                      "type": "PlainUserNameRenderer",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": "nameRenderer(supported:\"1AwQS7\")"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "RelayResolver",
            "storageKey": null,
            "isOutputType": true
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
    "cacheID": "93e8d3875e12ba05581431ae03887ee3",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffUseClientProvidersTestResolverQuery",
    "operationKind": "query",
    "text": "query RelayHandoffUseClientProvidersTestResolverQuery {\n  me {\n    ...RelayHandoffUseClientProvidersTestResolver_user\n    id\n  }\n}\n\nfragment RelayHandoffUseClientProvidersResolver on User {\n  ...RelayHandoffUseClientProvidersResolverInline_user\n}\n\nfragment RelayHandoffUseClientProvidersResolverInline_user on User {\n  resolverRenderer: nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayHandoffUseClientProvidersResolverPlain_name\n    }\n  }\n}\n\nfragment RelayHandoffUseClientProvidersResolverPlain_name on PlainUserNameRenderer {\n  plaintext\n}\n\nfragment RelayHandoffUseClientProvidersTestResolver_user on User {\n  ...RelayHandoffUseClientProvidersResolver\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayHandoffUseClientProvidersTestResolver_user$normalization.graphql'),
        "fragment": require('./RelayHandoffUseClientProvidersTestResolver_user.graphql'),
        "moduleProviders": {
          "component$RelayHandoffUseClientProvidersResolverInline_user$RelayHandoffUseClientProvidersResolverPlain_name": require('./RelayHandoffUseClientProvidersTestResolver_user$moduleProviders.client').component$RelayHandoffUseClientProvidersResolverInline_user$RelayHandoffUseClientProvidersResolverPlain_name,
          "operation$RelayHandoffUseClientProvidersResolverInline_user$RelayHandoffUseClientProvidersResolverPlain_name": require('./RelayHandoffUseClientProvidersTestResolver_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersResolverInline_user$RelayHandoffUseClientProvidersResolverPlain_name
        }
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "192b06f0e8d130f3ceb335122404e69e";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayHandoffUseClientProvidersTestResolverQuery$variables,
  RelayHandoffUseClientProvidersTestResolverQuery$data,
>*/);
