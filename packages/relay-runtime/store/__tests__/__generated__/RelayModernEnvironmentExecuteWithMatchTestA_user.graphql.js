/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c45f857b1e8c45cc6bfb9effd55427dc>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayModernEnvironmentExecuteWithMatchTestA_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"AMarkdownUserNameRenderer.react","fragment":"RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$fragmentType } from "./RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithMatchTestA_user$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithMatchTestA_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$fragmentType,
  },
  readonly $fragmentType: RelayModernEnvironmentExecuteWithMatchTestA_user$fragmentType,
};
export type RelayModernEnvironmentExecuteWithMatchTestA_user$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithMatchTestA_user$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithMatchTestA_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithMatchTestA_user",
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
              "documentName": "RelayModernEnvironmentExecuteWithMatchTestA_user",
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
  (node/*:: as any*/).hash = "4f1c91008e7ddd7bf098f6b392782683";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithMatchTestA_user$fragmentType,
  RelayModernEnvironmentExecuteWithMatchTestA_user$data,
>*/);
