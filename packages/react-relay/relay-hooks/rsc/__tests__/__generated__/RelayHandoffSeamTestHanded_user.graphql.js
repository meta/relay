/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f9760051c5b516c84b91cdb11ce19f74>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffSeamTestHanded_user$fragmentType: FragmentType;
export type RelayHandoffSeamTestHanded_user$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayHandoffSeamTestHanded_user$fragmentType,
};
export type RelayHandoffSeamTestHanded_user$key = {
  readonly $data?: RelayHandoffSeamTestHanded_user$data,
  readonly $fragmentSpreads: RelayHandoffSeamTestHanded_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffSeamTestHanded_user",
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
  (node/*:: as any*/).hash = "ab2c4993ed238a057b23a318acfff950";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffSeamTestHanded_user$fragmentType,
  RelayHandoffSeamTestHanded_user$data,
>*/);
