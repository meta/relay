/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<e17961f4e2399736d0a710371f497c5f>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayServerHandoffTestModuleB_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"BPlainUserNameRenderer.react","fragment":"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType } from "./RelayServerHandoffTestPlainUserNameRenderer_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestModuleB_user$fragmentType: FragmentType;
export type RelayServerHandoffTestModuleB_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType,
  },
  readonly $fragmentType: RelayServerHandoffTestModuleB_user$fragmentType,
};
export type RelayServerHandoffTestModuleB_user$key = {
  readonly $data?: RelayServerHandoffTestModuleB_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestModuleB_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestModuleB_user",
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
              "documentName": "RelayServerHandoffTestModuleB_user",
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
  (node/*:: as any*/).hash = "a3ac449e27851445af52aa8652054328";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestModuleB_user$fragmentType,
  RelayServerHandoffTestModuleB_user$data,
>*/);
