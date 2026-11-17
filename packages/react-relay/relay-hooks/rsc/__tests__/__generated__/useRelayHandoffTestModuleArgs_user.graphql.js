/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<90e6605e5d203012fa211d93971db1d5>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency useRelayHandoffTestModuleArgs_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffTestModuleArgsName_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useRelayHandoffTestModuleArgsName_name$fragmentType } from "./useRelayHandoffTestModuleArgsName_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestModuleArgs_user$fragmentType: FragmentType;
export type useRelayHandoffTestModuleArgs_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: useRelayHandoffTestModuleArgsName_name$fragmentType,
  },
  readonly $fragmentType: useRelayHandoffTestModuleArgs_user$fragmentType,
};
export type useRelayHandoffTestModuleArgs_user$key = {
  readonly $data?: useRelayHandoffTestModuleArgs_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestModuleArgs_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [
    {
      "defaultValue": true,
      "kind": "LocalArgument",
      "name": "withData"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestModuleArgs_user",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "supported",
          "value": "1AwQS7"
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
              "args": [
                {
                  "kind": "Variable",
                  "name": "withData",
                  "variableName": "withData"
                }
              ],
              "documentName": "useRelayHandoffTestModuleArgs_user",
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

if (__DEV__) {
  (node/*:: as any*/).hash = "585e4a61d8157948b7899b005988f1f7";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestModuleArgs_user$fragmentType,
  useRelayHandoffTestModuleArgs_user$data,
>*/);
