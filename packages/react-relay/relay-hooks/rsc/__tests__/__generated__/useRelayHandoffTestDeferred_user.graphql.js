/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c643318122c069ec8f47c5d55adb29ed>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestDeferred_user$fragmentType: FragmentType;
export type useRelayHandoffTestDeferred_user$data = {
  readonly emailAddresses: ?ReadonlyArray<?string>,
  readonly $fragmentType: useRelayHandoffTestDeferred_user$fragmentType,
};
export type useRelayHandoffTestDeferred_user$key = {
  readonly $data?: useRelayHandoffTestDeferred_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestDeferred_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestDeferred_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "emailAddresses",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "9547610c87dc05a926dc0246a9e591d4";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestDeferred_user$fragmentType,
  useRelayHandoffTestDeferred_user$data,
>*/);
