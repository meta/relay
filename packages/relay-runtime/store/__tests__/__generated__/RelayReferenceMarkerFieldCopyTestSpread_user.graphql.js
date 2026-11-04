/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f2b46c55c9fd6dd29fbb9ba766c7f528>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayReferenceMarkerFieldCopyTestSpread_user$fragmentType: FragmentType;
export type RelayReferenceMarkerFieldCopyTestSpread_user$data = {
  readonly lastName: ?string,
  readonly $fragmentType: RelayReferenceMarkerFieldCopyTestSpread_user$fragmentType,
};
export type RelayReferenceMarkerFieldCopyTestSpread_user$key = {
  readonly $data?: RelayReferenceMarkerFieldCopyTestSpread_user$data,
  readonly $fragmentSpreads: RelayReferenceMarkerFieldCopyTestSpread_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayReferenceMarkerFieldCopyTestSpread_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastName",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "0371e61c3d723c55f2b2f356ec1cf853";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayReferenceMarkerFieldCopyTestSpread_user$fragmentType,
  RelayReferenceMarkerFieldCopyTestSpread_user$data,
>*/);
