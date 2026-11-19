/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2eac4df8dd3038466feb2c2426b10026>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayHandoffUseClientProvidersTestShared_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestSharedMarkdown_name$normalization.graphql"},"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestSharedPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestSharedMarkdown_name$fragmentType } from "./RelayHandoffUseClientProvidersTestSharedMarkdown_name.graphql";
import type { RelayHandoffUseClientProvidersTestSharedPlain_name$fragmentType } from "./RelayHandoffUseClientProvidersTestSharedPlain_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestShared_user$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestShared_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestSharedMarkdown_name$fragmentType & RelayHandoffUseClientProvidersTestSharedPlain_name$fragmentType,
  },
  readonly $fragmentType: RelayHandoffUseClientProvidersTestShared_user$fragmentType,
};
export type RelayHandoffUseClientProvidersTestShared_user$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestShared_user$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestShared_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestShared_user",
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
              "documentName": "RelayHandoffUseClientProvidersTestShared_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestSharedPlain_name",
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
              "documentName": "RelayHandoffUseClientProvidersTestShared_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestSharedMarkdown_name",
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
  (node/*:: as any*/).hash = "05f6dbc8df7a6d0ca9a0341d8502cead";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestShared_user$fragmentType,
  RelayHandoffUseClientProvidersTestShared_user$data,
>*/);
