/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<6ae8d9eff5cc3b8ef6471111fd9920fc>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosActorDetailsFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosActorDetailsFragment$data = {
  readonly lastName: ?string,
  readonly name: ?string,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosActorDetailsFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosActorDetailsFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosActorDetailsFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosActorDetailsFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosActorDetailsFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastName",
      "storageKey": null
    }
  ],
  "type": "Actor",
  "abstractKey": "__isActor"
};

if (__DEV__) {
  (node/*:: as any*/).hash = "7e048c4941a9f4ae8f8a476f21c961be";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosActorDetailsFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosActorDetailsFragment$data,
>*/);
