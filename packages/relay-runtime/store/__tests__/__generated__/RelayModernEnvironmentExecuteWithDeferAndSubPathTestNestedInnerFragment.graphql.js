/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<e69dd99403dfdcb1e20db15816ff14b5>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "59c0141e275b2d5eec1b385755517121";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$data,
>*/);
