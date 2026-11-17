/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<6ea7f416d5e1d3eb45b12c43d501927c>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency useRelayHandoffTestNestedCard_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"Outer.react","fragment":"useRelayHandoffTestNestedOuter_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useRelayHandoffTestNestedOuter_name$fragmentType } from "./useRelayHandoffTestNestedOuter_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestNestedCard_user$fragmentType: FragmentType;
export type useRelayHandoffTestNestedCard_user$data = {
  readonly name: ?string,
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: useRelayHandoffTestNestedOuter_name$fragmentType,
  },
  readonly $fragmentType: useRelayHandoffTestNestedCard_user$fragmentType,
};
export type useRelayHandoffTestNestedCard_user$key = {
  readonly $data?: useRelayHandoffTestNestedCard_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestNestedCard_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestNestedCard_user",
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
              "documentName": "useRelayHandoffTestNestedCard_user",
              "fragmentName": "useRelayHandoffTestNestedOuter_name",
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
  (node/*:: as any*/).hash = "f06c1007c7763d68c949c57b3c5d1f2a";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestNestedCard_user$fragmentType,
  useRelayHandoffTestNestedCard_user$data,
>*/);
