/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<699bfcd68998d7a9f4f2925413941e96>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestDeferChild_user$fragmentType: FragmentType;
export type useRelayHandoffTestDeferChild_user$data = {
  readonly lastName: ?string,
  readonly $fragmentType: useRelayHandoffTestDeferChild_user$fragmentType,
};
export type useRelayHandoffTestDeferChild_user$key = {
  readonly $data?: useRelayHandoffTestDeferChild_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestDeferChild_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestDeferChild_user",
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
  (node/*:: as any*/).hash = "f271c573e4b32f8e797038f542d4fc25";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestDeferChild_user$fragmentType,
  useRelayHandoffTestDeferChild_user$data,
>*/);
