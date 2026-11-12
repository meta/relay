/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4cbb870200b1d4069fd3d3a300868469>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffTestLiveNameResolver$fragmentType: FragmentType;
export type RelayHandoffTestLiveNameResolver$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayHandoffTestLiveNameResolver$fragmentType,
};
export type RelayHandoffTestLiveNameResolver$key = {
  readonly $data?: RelayHandoffTestLiveNameResolver$data,
  readonly $fragmentSpreads: RelayHandoffTestLiveNameResolver$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffTestLiveNameResolver",
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
  (node/*:: as any*/).hash = "81a88ce6860c0d10f463743e7902a2b9";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffTestLiveNameResolver$fragmentType,
  RelayHandoffTestLiveNameResolver$data,
>*/);
