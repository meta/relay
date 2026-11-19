/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<00def73979f3de2c20e52f13f69d6196>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayHandoffUseClientProvidersTestCard_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"../RelayHandoffTestMarkdownRenderer.react","fragment":"RelayHandoffUseClientProvidersTestMarkdown_name$normalization.graphql"},"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestMarkdown_name$fragmentType } from "./RelayHandoffUseClientProvidersTestMarkdown_name.graphql";
import type { RelayHandoffUseClientProvidersTestPlain_name$fragmentType } from "./RelayHandoffUseClientProvidersTestPlain_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestCard_user$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestCard_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestMarkdown_name$fragmentType & RelayHandoffUseClientProvidersTestPlain_name$fragmentType,
  },
  readonly $fragmentType: RelayHandoffUseClientProvidersTestCard_user$fragmentType,
};
export type RelayHandoffUseClientProvidersTestCard_user$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestCard_user$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestCard_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestCard_user",
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
          "kind": "InlineFragment",
          "selections": [
            {
              "args": null,
              "documentName": "RelayHandoffUseClientProvidersTestCard_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestPlain_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport"
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
              "documentName": "RelayHandoffUseClientProvidersTestCard_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestMarkdown_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport"
            }
          ],
          "type": "MarkdownUserNameRenderer",
          "abstractKey": null
        }
      ],
      "storageKey": "nameRenderer(supported:\"34hjiS\")"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "2062262980b4a26ab977c903304182a4";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestCard_user$fragmentType,
  RelayHandoffUseClientProvidersTestCard_user$data,
>*/);
