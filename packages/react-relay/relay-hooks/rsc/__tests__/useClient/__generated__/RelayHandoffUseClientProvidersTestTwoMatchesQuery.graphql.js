/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<5d4039598c2fe9f062f036450e63abc9>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency RelayHandoffUseClientProvidersTestTwoMatches_user.markdownRenderer {"branches":{"PlainUserNameRenderer":{"component":"../RelayHandoffTestMarkdownRenderer.react","fragment":"RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql"}},"plural":false}
// @indirectDataDrivenDependency RelayHandoffUseClientProvidersTestTwoMatches_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestTwoMatches_user$fragmentType } from "./RelayHandoffUseClientProvidersTestTwoMatches_user.graphql";
export type RelayHandoffUseClientProvidersTestTwoMatchesQuery$variables = {};
export type RelayHandoffUseClientProvidersTestTwoMatchesQuery$data = {
  readonly me: ?{
    readonly card: {
      readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestTwoMatches_user$fragmentType,
    },
  },
};
export type RelayHandoffUseClientProvidersTestTwoMatchesQuery = {
  readonly $serverOperation: true,
  response: RelayHandoffUseClientProvidersTestTwoMatchesQuery$data,
  variables: RelayHandoffUseClientProvidersTestTwoMatchesQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "supported",
    "value": "1AwQS7"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayHandoffUseClientProvidersTestTwoMatchesQuery",
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
                  "name": "RelayHandoffUseClientProvidersTestTwoMatches_user"
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
    "name": "RelayHandoffUseClientProvidersTestTwoMatchesQuery",
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
            "args": (v0/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
            "plural": false,
            "selections": [
              (v1/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "args": null,
                    "documentName": "RelayHandoffUseClientProvidersTestTwoMatches_user_plain",
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
            "alias": "markdownRenderer",
            "args": (v0/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
            "plural": false,
            "selections": [
              (v1/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "args": null,
                    "documentName": "RelayHandoffUseClientProvidersTestTwoMatches_user_markdown",
                    "fragmentName": "RelayHandoffUseClientProvidersTestPlain_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport",
                    "componentModuleProvider": () => require('../../RelayHandoffTestMarkdownRenderer.react'),
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
    "cacheID": "b751488f915b5d9832ec33111538d23e",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffUseClientProvidersTestTwoMatchesQuery",
    "operationKind": "query",
    "text": "query RelayHandoffUseClientProvidersTestTwoMatchesQuery {\n  me {\n    ...RelayHandoffUseClientProvidersTestTwoMatches_user\n    id\n  }\n}\n\nfragment RelayHandoffUseClientProvidersTestPlain_name on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n\nfragment RelayHandoffUseClientProvidersTestTwoMatches_user on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestPlain_name\n    }\n  }\n  markdownRenderer: nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestPlain_name\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayHandoffUseClientProvidersTestTwoMatches_user$normalization.graphql'),
        "fragment": require('./RelayHandoffUseClientProvidersTestTwoMatches_user.graphql'),
        "moduleProviders": {
          "component$RelayHandoffUseClientProvidersTestTwoMatches_user_markdown$RelayHandoffUseClientProvidersTestPlain_name": require('./RelayHandoffUseClientProvidersTestTwoMatches_user$moduleProviders.client').component$RelayHandoffUseClientProvidersTestTwoMatches_user_markdown$RelayHandoffUseClientProvidersTestPlain_name,
          "operation$RelayHandoffUseClientProvidersTestTwoMatches_user_markdown$RelayHandoffUseClientProvidersTestPlain_name": require('./RelayHandoffUseClientProvidersTestTwoMatches_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersTestTwoMatches_user_markdown$RelayHandoffUseClientProvidersTestPlain_name,
          "component$RelayHandoffUseClientProvidersTestTwoMatches_user_plain$RelayHandoffUseClientProvidersTestPlain_name": require('./RelayHandoffUseClientProvidersTestTwoMatches_user$moduleProviders.client').component$RelayHandoffUseClientProvidersTestTwoMatches_user_plain$RelayHandoffUseClientProvidersTestPlain_name,
          "operation$RelayHandoffUseClientProvidersTestTwoMatches_user_plain$RelayHandoffUseClientProvidersTestPlain_name": require('./RelayHandoffUseClientProvidersTestTwoMatches_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersTestTwoMatches_user_plain$RelayHandoffUseClientProvidersTestPlain_name
        }
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "78419f31b768cdc476462ae0c1cbd58f";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayHandoffUseClientProvidersTestTwoMatchesQuery$variables,
  RelayHandoffUseClientProvidersTestTwoMatchesQuery$data,
>*/);
