/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a8c5d317ed675d02d544372212df88e2>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @indirectDataDrivenDependency RelayModernEnvironmentExecuteWithMatchTestA_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"AMarkdownUserNameRenderer.react","fragment":"RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$normalization.graphql"}},"plural":false}
// @indirectDataDrivenDependency RelayModernEnvironmentExecuteWithMatchTestB_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"BMarkdownUserNameRenderer.react","fragment":"RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$normalization.graphql"}},"plural":false}

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithMatchTestA_user$fragmentType } from "./RelayModernEnvironmentExecuteWithMatchTestA_user.graphql";
import type { RelayModernEnvironmentExecuteWithMatchTestB_user$fragmentType } from "./RelayModernEnvironmentExecuteWithMatchTestB_user.graphql";
export type RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery$variables = {};
export type RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery$data = {
  readonly me: ?{
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithMatchTestA_user$fragmentType & RelayModernEnvironmentExecuteWithMatchTestB_user$fragmentType,
  },
};
export type RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery = {
  response: RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery$data,
  variables: RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayModernEnvironmentExecuteWithMatchTestA_user"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayModernEnvironmentExecuteWithMatchTestB_user"
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
    "name": "RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery",
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
                "value": "2aTHRe"
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
                    "documentName": "RelayModernEnvironmentExecuteWithMatchTestA_user",
                    "fragmentName": "RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport"
                  },
                  {
                    "args": null,
                    "documentName": "RelayModernEnvironmentExecuteWithMatchTestB_user",
                    "fragmentName": "RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport"
                  }
                ],
                "type": "MarkdownUserNameRenderer",
                "abstractKey": null
              }
            ],
            "storageKey": "nameRenderer(supported:\"2aTHRe\")"
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
    "cacheID": "5d614ad99104d8646614230b85eca117",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery {\n  me {\n    ...RelayModernEnvironmentExecuteWithMatchTestA_user\n    ...RelayModernEnvironmentExecuteWithMatchTestB_user\n    id\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithMatchTestA_user on User {\n  nameRenderer(supported: [\"MarkdownUserNameRenderer\"]) {\n    __typename\n    ... on MarkdownUserNameRenderer {\n      ...RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name\n      __module_operation_RelayModernEnvironmentExecuteWithMatchTestA_user: js(module: \"RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$normalization.graphql\", id: \"RelayModernEnvironmentExecuteWithMatchTestA_user.nameRenderer\")\n      __module_component_RelayModernEnvironmentExecuteWithMatchTestA_user: js(module: \"AMarkdownUserNameRenderer.react\", id: \"RelayModernEnvironmentExecuteWithMatchTestA_user.nameRenderer\")\n    }\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithMatchTestB_user on User {\n  nameRenderer(supported: [\"MarkdownUserNameRenderer\"]) {\n    __typename\n    ... on MarkdownUserNameRenderer {\n      ...RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name\n      __module_operation_RelayModernEnvironmentExecuteWithMatchTestB_user: js(module: \"RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$normalization.graphql\", id: \"RelayModernEnvironmentExecuteWithMatchTestB_user.nameRenderer\")\n      __module_component_RelayModernEnvironmentExecuteWithMatchTestB_user: js(module: \"BMarkdownUserNameRenderer.react\", id: \"RelayModernEnvironmentExecuteWithMatchTestB_user.nameRenderer\")\n    }\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name on MarkdownUserNameRenderer {\n  markdown\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "7c5156021f6944014a8b4d297b01518e";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery$variables,
  RelayModernEnvironmentExecuteWithMatchTestTwoDocumentsQuery$data,
>*/);
