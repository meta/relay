/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f4e5fb46783a5d61c6a0d7222a8f8bd4>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency useRelayHandoffHydrationTestNamedModule_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType } from "./RelayServerHandoffTestPlainUserNameRenderer_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffHydrationTestNamedModule_user$fragmentType: FragmentType;
export type useRelayHandoffHydrationTestNamedModule_user$data = {
  readonly name: ?string,
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType,
  },
  readonly $fragmentType: useRelayHandoffHydrationTestNamedModule_user$fragmentType,
};
export type useRelayHandoffHydrationTestNamedModule_user$key = {
  readonly $data?: useRelayHandoffHydrationTestNamedModule_user$data,
  readonly $fragmentSpreads: useRelayHandoffHydrationTestNamedModule_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffHydrationTestNamedModule_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
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
              "documentName": "useRelayHandoffHydrationTestNamedModule_user",
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
  (node/*:: as any*/).hash = "62acb71c1c6914cd358e57011bc997f8";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffHydrationTestNamedModule_user$fragmentType,
  useRelayHandoffHydrationTestNamedModule_user$data,
>*/);
