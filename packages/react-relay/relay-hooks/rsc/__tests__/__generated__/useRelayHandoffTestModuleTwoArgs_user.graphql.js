/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<bfe81336aa5efc4520f644a82a4f0843>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency useRelayHandoffTestModuleTwoArgs_user.with {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffTestModuleArgsName_name$normalization.graphql"}},"plural":false}
// @dataDrivenDependency useRelayHandoffTestModuleTwoArgs_user.without {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffTestModuleArgsName_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useRelayHandoffTestModuleArgsName_name$fragmentType } from "./useRelayHandoffTestModuleArgsName_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestModuleTwoArgs_user$fragmentType: FragmentType;
export type useRelayHandoffTestModuleTwoArgs_user$data = {
  readonly with: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: useRelayHandoffTestModuleArgsName_name$fragmentType,
  },
  readonly without: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: useRelayHandoffTestModuleArgsName_name$fragmentType,
  },
  readonly $fragmentType: useRelayHandoffTestModuleTwoArgs_user$fragmentType,
};
export type useRelayHandoffTestModuleTwoArgs_user$key = {
  readonly $data?: useRelayHandoffTestModuleTwoArgs_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestModuleTwoArgs_user$fragmentType,
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
  "name": "useRelayHandoffTestModuleTwoArgs_user",
  "selections": [
    {
      "alias": "without",
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
              "args": [
                {
                  "kind": "Literal",
                  "name": "withData",
                  "value": false
                }
              ],
              "documentName": "useRelayHandoffTestModuleTwoArgs_user_without",
              "fragmentName": "useRelayHandoffTestModuleArgsName_name",
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
      "alias": "with",
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
              "args": [
                {
                  "kind": "Literal",
                  "name": "withData",
                  "value": true
                }
              ],
              "documentName": "useRelayHandoffTestModuleTwoArgs_user_with",
              "fragmentName": "useRelayHandoffTestModuleArgsName_name",
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
  (node/*:: as any*/).hash = "90d53ccd18ea8745231d837ab798cfb6";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestModuleTwoArgs_user$fragmentType,
  useRelayHandoffTestModuleTwoArgs_user$data,
>*/);
