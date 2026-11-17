/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<aae4493d3a5ee8d1a744e0c0aa97e433>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayServerHandoffTestModule_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType } from "./RelayServerHandoffTestPlainUserNameRenderer_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestModule_user$fragmentType: FragmentType;
export type RelayServerHandoffTestModule_user$data = {
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType,
  },
  readonly $fragmentType: RelayServerHandoffTestModule_user$fragmentType,
};
export type RelayServerHandoffTestModule_user$key = {
  readonly $data?: RelayServerHandoffTestModule_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestModule_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestModule_user",
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
              "documentName": "RelayServerHandoffTestModule_user",
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
  (node/*:: as any*/).hash = "c23915f66e3c68ae2be8e0e78bfe59a4";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestModule_user$fragmentType,
  RelayServerHandoffTestModule_user$data,
>*/);
