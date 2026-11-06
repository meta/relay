/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<cd80d4579b505b7629205fd9f1cdd006>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosSecondFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosSecondFragment$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosSecondFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosSecondFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosSecondFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosSecondFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosSecondFragment",
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
  (node/*:: as any*/).hash = "d56e929929dab5ae5ff9a11c39a4902b";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosSecondFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosSecondFragment$data,
>*/);
