/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<94cb98032b4a5be1cc6cec1e36f44439>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffSeamTest_user$fragmentType: FragmentType;
export type RelayHandoffSeamTest_user$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayHandoffSeamTest_user$fragmentType,
};
export type RelayHandoffSeamTest_user$key = {
  readonly $data?: RelayHandoffSeamTest_user$data,
  readonly $fragmentSpreads: RelayHandoffSeamTest_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffSeamTest_user",
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
  (node/*:: as any*/).hash = "d85cec57b1c30cf84160b2bf0d65592a";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffSeamTest_user$fragmentType,
  RelayHandoffSeamTest_user$data,
>*/);
