/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<1c913fe818cccb62d8bcf5fdcd21fe83>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayHandoffUseClientProvidersTestTwoMatches_user.markdownRenderer {"branches":{"PlainUserNameRenderer":{"component":"../RelayHandoffTestMarkdownRenderer.react","fragment":"RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql"}},"plural":false}
// @dataDrivenDependency RelayHandoffUseClientProvidersTestTwoMatches_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestPlain_name$fragmentType } from "./RelayHandoffUseClientProvidersTestPlain_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestTwoMatches_user$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestTwoMatches_user$data = {
  readonly markdownRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestPlain_name$fragmentType,
  },
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestPlain_name$fragmentType,
  },
  readonly $fragmentType: RelayHandoffUseClientProvidersTestTwoMatches_user$fragmentType,
};
export type RelayHandoffUseClientProvidersTestTwoMatches_user$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestTwoMatches_user$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestTwoMatches_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "supported",
    "value": "1AwQS7"
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestTwoMatches_user",
  "selections": [
    {
      "alias": null,
      "args": (v0/*:: as any*/),
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
              "documentName": "RelayHandoffUseClientProvidersTestTwoMatches_user_plain",
              "fragmentName": "RelayHandoffUseClientProvidersTestPlain_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport"
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
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": null,
              "documentName": "RelayHandoffUseClientProvidersTestTwoMatches_user_markdown",
              "fragmentName": "RelayHandoffUseClientProvidersTestPlain_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport"
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
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "16407292012c64d65c1fc33c0eddc262";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestTwoMatches_user$fragmentType,
  RelayHandoffUseClientProvidersTestTwoMatches_user$data,
>*/);
