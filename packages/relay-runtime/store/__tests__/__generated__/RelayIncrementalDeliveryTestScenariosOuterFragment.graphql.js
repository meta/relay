/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<ad0b54cd563c63d870dea2ef0543a436>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosInnerFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosInnerFragment.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosOuterFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosOuterFragment$data = {
  readonly name: ?string,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosInnerFragment$fragmentType,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosOuterFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosOuterFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosOuterFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosOuterFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosOuterFragment",
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
          "name": "RelayIncrementalDeliveryTestScenariosInnerFragment"
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "4800f05f111f9ef8849a818127372aef";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosOuterFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosOuterFragment$data,
>*/);
