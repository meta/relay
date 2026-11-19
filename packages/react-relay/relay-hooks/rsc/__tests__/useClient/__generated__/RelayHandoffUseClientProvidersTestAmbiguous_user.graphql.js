/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<6babf5ae52769ca8c6c7e3237216cfd8>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayHandoffUseClientProvidersTestAmbiguous_user.nameRenderer {"branches":{"MarkdownUserNameRenderer":{"component":"../RelayHandoffTestMarkdownRenderer.react","fragment":"RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$normalization.graphql"},"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestAmbiguousPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$fragmentType } from "./RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name.graphql";
import type { RelayHandoffUseClientProvidersTestAmbiguousPlain_name$fragmentType } from "./RelayHandoffUseClientProvidersTestAmbiguousPlain_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestAmbiguous_user$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestAmbiguous_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$fragmentType & RelayHandoffUseClientProvidersTestAmbiguousPlain_name$fragmentType,
  },
  readonly $fragmentType: RelayHandoffUseClientProvidersTestAmbiguous_user$fragmentType,
};
export type RelayHandoffUseClientProvidersTestAmbiguous_user$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestAmbiguous_user$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestAmbiguous_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestAmbiguous_user",
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
              "documentName": "RelayHandoffUseClientProvidersTestAmbiguous_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestAmbiguousPlain_name",
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
              "documentName": "RelayHandoffUseClientProvidersTestAmbiguous_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name",
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
  (node/*:: as any*/).hash = "857b2e17cb0d550c928d1e00e8693b97";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestAmbiguous_user$fragmentType,
  RelayHandoffUseClientProvidersTestAmbiguous_user$data,
>*/);
