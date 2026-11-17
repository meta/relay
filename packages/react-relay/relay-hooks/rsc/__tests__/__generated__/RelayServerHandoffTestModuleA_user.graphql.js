/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<de913ec99d0416011679851560ccb901>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayServerHandoffTestModuleA_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"APlainUserNameRenderer.react","fragment":"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType } from "./RelayServerHandoffTestPlainUserNameRenderer_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestModuleA_user$fragmentType: FragmentType;
export type RelayServerHandoffTestModuleA_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType,
  },
  readonly $fragmentType: RelayServerHandoffTestModuleA_user$fragmentType,
};
export type RelayServerHandoffTestModuleA_user$key = {
  readonly $data?: RelayServerHandoffTestModuleA_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestModuleA_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestModuleA_user",
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
              "args": null,
              "documentName": "RelayServerHandoffTestModuleA_user",
              "fragmentName": "RelayServerHandoffTestPlainUserNameRenderer_name",
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
  (node/*:: as any*/).hash = "303d4e724b5583461687a9b5736b934b";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestModuleA_user$fragmentType,
  RelayServerHandoffTestModuleA_user$data,
>*/);
