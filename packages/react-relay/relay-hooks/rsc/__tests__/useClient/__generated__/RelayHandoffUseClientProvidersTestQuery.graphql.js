/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4c89148dfdc3e3bae624a852ed0a2c41>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency RelayHandoffUseClientProvidersTestCard_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"../RelayHandoffTestMarkdownRenderer.react","fragment":"RelayHandoffUseClientProvidersTestMarkdown_name$normalization.graphql"},"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql"}},"plural":false}
// @indirectDataDrivenDependency RelayHandoffUseClientProvidersTestShared_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestSharedMarkdown_name$normalization.graphql"},"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestSharedPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestCard_user$fragmentType } from "./RelayHandoffUseClientProvidersTestCard_user.graphql";
import type { RelayHandoffUseClientProvidersTestShared_user$fragmentType } from "./RelayHandoffUseClientProvidersTestShared_user.graphql";
export type RelayHandoffUseClientProvidersTestQuery$variables = {};
export type RelayHandoffUseClientProvidersTestQuery$data = {
  readonly friend: ?{
    readonly card?: ?{
      readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestCard_user$fragmentType,
    },
  },
  readonly me: ?{
    readonly card: {
      readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestCard_user$fragmentType,
    },
    readonly shared: {
      readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestShared_user$fragmentType,
    },
  },
};
export type RelayHandoffUseClientProvidersTestQuery = {
  readonly $serverOperation: true,
  response: RelayHandoffUseClientProvidersTestQuery$data,
  variables: RelayHandoffUseClientProvidersTestQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = [
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "RelayHandoffUseClientProvidersTestCard_user"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "5"
  }
],
v2 = [
  {
    "kind": "Literal",
    "name": "supported",
    "value": "34hjiS"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "args": null,
  "documentName": "RelayHandoffUseClientProvidersTestCard_user",
  "fragmentName": "RelayHandoffUseClientProvidersTestPlain_name",
  "fragmentPropName": "name",
  "kind": "ModuleImport",
  "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
  "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql'))
},
v5 = {
  "args": null,
  "documentName": "RelayHandoffUseClientProvidersTestCard_user",
  "fragmentName": "RelayHandoffUseClientProvidersTestMarkdown_name",
  "fragmentPropName": "name",
  "kind": "ModuleImport",
  "componentModuleProvider": () => require('../../RelayHandoffTestMarkdownRenderer.react'),
  "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestMarkdown_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestMarkdown_name$normalization.graphql'))
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayHandoffUseClientProvidersTestQuery",
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
              "selections": (v0/*:: as any*/),
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "card"
          },
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "RelayHandoffUseClientProvidersTestShared_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "shared"
          }
        ],
        "storageKey": null
      },
      {
        "alias": "friend",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "fragment": {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "kind": "Defer",
                      "selections": (v0/*:: as any*/)
                    }
                  ],
                  "type": "User",
                  "abstractKey": null
                },
                "kind": "AliasedInlineFragmentSpread",
                "name": "card"
              }
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": "node(id:\"5\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayHandoffUseClientProvidersTestQuery",
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
            "args": (v2/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v4/*:: as any*/),
                  {
                    "args": null,
                    "documentName": "RelayHandoffUseClientProvidersTestShared_user",
                    "fragmentName": "RelayHandoffUseClientProvidersTestSharedPlain_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport",
                    "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
                    "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestSharedPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestSharedPlain_name$normalization.graphql'))
                  }
                ],
                "type": "PlainUserNameRenderer",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  (v5/*:: as any*/),
                  {
                    "args": null,
                    "documentName": "RelayHandoffUseClientProvidersTestShared_user",
                    "fragmentName": "RelayHandoffUseClientProvidersTestSharedMarkdown_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport",
                    "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
                    "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestSharedMarkdown_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestSharedMarkdown_name$normalization.graphql'))
                  }
                ],
                "type": "MarkdownUserNameRenderer",
                "abstractKey": null
              }
            ],
            "storageKey": "nameRenderer(supported:\"34hjiS\")"
          },
          (v6/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "friend",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "if": null,
                "kind": "Defer",
                "label": "RelayHandoffUseClientProvidersTestQuery$defer$friend",
                "selections": [
                  {
                    "alias": null,
                    "args": (v2/*:: as any*/),
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "nameRenderer",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v4/*:: as any*/)
                        ],
                        "type": "PlainUserNameRenderer",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v5/*:: as any*/)
                        ],
                        "type": "MarkdownUserNameRenderer",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": "nameRenderer(supported:\"34hjiS\")"
                  }
                ]
              }
            ],
            "type": "User",
            "abstractKey": null
          },
          (v6/*:: as any*/)
        ],
        "storageKey": "node(id:\"5\")"
      }
    ]
  },
  "params": {
    "cacheID": "738c878616b53f5d84309722c0fdb007",
    "id": null,
    "metadata": {},
    "name": "RelayHandoffUseClientProvidersTestQuery",
    "operationKind": "query",
    "text": "query RelayHandoffUseClientProvidersTestQuery {\n  me {\n    ...RelayHandoffUseClientProvidersTestCard_user\n    ...RelayHandoffUseClientProvidersTestShared_user\n    id\n  }\n  friend: node(id: \"5\") {\n    __typename\n    ... on User {\n      ...RelayHandoffUseClientProvidersTestCard_user @defer(label: \"RelayHandoffUseClientProvidersTestQuery$defer$friend\")\n    }\n    id\n  }\n}\n\nfragment RelayHandoffUseClientProvidersTestCard_user on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\", \"MarkdownUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestPlain_name\n    }\n    ... on MarkdownUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestMarkdown_name\n    }\n  }\n}\n\nfragment RelayHandoffUseClientProvidersTestMarkdown_name on MarkdownUserNameRenderer {\n  markdown\n}\n\nfragment RelayHandoffUseClientProvidersTestPlain_name on PlainUserNameRenderer {\n  plaintext\n  data {\n    text\n    id\n  }\n}\n\nfragment RelayHandoffUseClientProvidersTestSharedMarkdown_name on MarkdownUserNameRenderer {\n  markdown\n}\n\nfragment RelayHandoffUseClientProvidersTestSharedPlain_name on PlainUserNameRenderer {\n  plaintext\n}\n\nfragment RelayHandoffUseClientProvidersTestShared_user on User {\n  nameRenderer(supported: [\"PlainUserNameRenderer\", \"MarkdownUserNameRenderer\"]) {\n    __typename\n    ... on PlainUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestSharedPlain_name\n    }\n    ... on MarkdownUserNameRenderer {\n      ...RelayHandoffUseClientProvidersTestSharedMarkdown_name\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayHandoffUseClientProvidersTestCard_user$normalization.graphql'),
        "fragment": require('./RelayHandoffUseClientProvidersTestCard_user.graphql'),
        "moduleProviders": {
          "component$RelayHandoffUseClientProvidersTestCard_user$RelayHandoffUseClientProvidersTestMarkdown_name": require('./RelayHandoffUseClientProvidersTestCard_user$moduleProviders.client').component$RelayHandoffUseClientProvidersTestCard_user$RelayHandoffUseClientProvidersTestMarkdown_name,
          "operation$RelayHandoffUseClientProvidersTestCard_user$RelayHandoffUseClientProvidersTestMarkdown_name": require('./RelayHandoffUseClientProvidersTestCard_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersTestCard_user$RelayHandoffUseClientProvidersTestMarkdown_name,
          "component$RelayHandoffUseClientProvidersTestCard_user$RelayHandoffUseClientProvidersTestPlain_name": require('./RelayHandoffUseClientProvidersTestCard_user$moduleProviders.client').component$RelayHandoffUseClientProvidersTestCard_user$RelayHandoffUseClientProvidersTestPlain_name,
          "operation$RelayHandoffUseClientProvidersTestCard_user$RelayHandoffUseClientProvidersTestPlain_name": require('./RelayHandoffUseClientProvidersTestCard_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersTestCard_user$RelayHandoffUseClientProvidersTestPlain_name
        }
      },
      {
        "normalization": require('./RelayHandoffUseClientProvidersTestShared_user$normalization.graphql'),
        "fragment": require('./RelayHandoffUseClientProvidersTestShared_user.graphql'),
        "moduleProviders": {
          "component$RelayHandoffUseClientProvidersTestShared_user$RelayHandoffUseClientProvidersTestSharedMarkdown_name": require('./RelayHandoffUseClientProvidersTestShared_user$moduleProviders.client').component$RelayHandoffUseClientProvidersTestShared_user$RelayHandoffUseClientProvidersTestSharedMarkdown_name,
          "operation$RelayHandoffUseClientProvidersTestShared_user$RelayHandoffUseClientProvidersTestSharedMarkdown_name": require('./RelayHandoffUseClientProvidersTestShared_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersTestShared_user$RelayHandoffUseClientProvidersTestSharedMarkdown_name,
          "component$RelayHandoffUseClientProvidersTestShared_user$RelayHandoffUseClientProvidersTestSharedPlain_name": require('./RelayHandoffUseClientProvidersTestShared_user$moduleProviders.client').component$RelayHandoffUseClientProvidersTestShared_user$RelayHandoffUseClientProvidersTestSharedPlain_name,
          "operation$RelayHandoffUseClientProvidersTestShared_user$RelayHandoffUseClientProvidersTestSharedPlain_name": require('./RelayHandoffUseClientProvidersTestShared_user$moduleProviders.client').operation$RelayHandoffUseClientProvidersTestShared_user$RelayHandoffUseClientProvidersTestSharedPlain_name
        }
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "eaa0300bb6031d0c716e619fe79175d1";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayHandoffUseClientProvidersTestQuery$variables,
  RelayHandoffUseClientProvidersTestQuery$data,
>*/);
