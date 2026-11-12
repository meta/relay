/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<798343032c3d9959a0ef71c614f4b455>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayModernEnvironmentExecuteWithMatchTestB_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"BMarkdownUserNameRenderer.react","fragment":"RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$fragmentType } from "./RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithMatchTestB_user$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithMatchTestB_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$fragmentType,
  },
  readonly $fragmentType: RelayModernEnvironmentExecuteWithMatchTestB_user$fragmentType,
};
export type RelayModernEnvironmentExecuteWithMatchTestB_user$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithMatchTestB_user$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithMatchTestB_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithMatchTestB_user",
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
          "kind": "InlineFragment",
          "selections": [
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
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "d601fb65641c27b84dd5f313792112d5";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithMatchTestB_user$fragmentType,
  RelayModernEnvironmentExecuteWithMatchTestB_user$data,
>*/);
