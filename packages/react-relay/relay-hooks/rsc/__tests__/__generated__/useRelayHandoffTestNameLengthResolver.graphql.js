/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d5db77116b241ae4546c4b28d72fb57b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestNameLengthResolver$fragmentType: FragmentType;
export type useRelayHandoffTestNameLengthResolver$data = {
  readonly name: ?string,
  readonly $fragmentType: useRelayHandoffTestNameLengthResolver$fragmentType,
};
export type useRelayHandoffTestNameLengthResolver$key = {
  readonly $data?: useRelayHandoffTestNameLengthResolver$data,
  readonly $fragmentSpreads: useRelayHandoffTestNameLengthResolver$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestNameLengthResolver",
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
  (node/*:: as any*/).hash = "03d1a7ebc98a7b8f641248c8140736b7";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestNameLengthResolver$fragmentType,
  useRelayHandoffTestNameLengthResolver$data,
>*/);
