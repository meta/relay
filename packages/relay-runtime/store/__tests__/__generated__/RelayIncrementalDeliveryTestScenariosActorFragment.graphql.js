/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b94b3cd7fef7036eb53a3869b78227a1>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosActorFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosActorFragment$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosActorFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosActorFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosActorFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosActorFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosActorFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "Actor",
  "abstractKey": "__isActor"
};

if (__DEV__) {
  (node/*:: as any*/).hash = "0d40daf68a613f78a0a524d59e964b44";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosActorFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosActorFragment$data,
>*/);
