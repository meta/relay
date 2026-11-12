/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d365c7be4e6edab9ecaef814d9f816d2>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useRelayHandoffTestDeferChild_user$fragmentType } from "./useRelayHandoffTestDeferChild_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestDeferParent_user$fragmentType: FragmentType;
export type useRelayHandoffTestDeferParent_user$data = {
  readonly name: ?string,
  readonly $fragmentSpreads: useRelayHandoffTestDeferChild_user$fragmentType,
  readonly $fragmentType: useRelayHandoffTestDeferParent_user$fragmentType,
};
export type useRelayHandoffTestDeferParent_user$key = {
  readonly $data?: useRelayHandoffTestDeferParent_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestDeferParent_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestDeferParent_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "kind": "Defer",
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "useRelayHandoffTestDeferChild_user"
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "81625c0f63806753778db78109ee315d";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestDeferParent_user$fragmentType,
  useRelayHandoffTestDeferParent_user$data,
>*/);
