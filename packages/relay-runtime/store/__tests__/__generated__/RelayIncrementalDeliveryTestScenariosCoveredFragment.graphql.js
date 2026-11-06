/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2566372cd67c4ad6aa778f87c7af9b5c>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosCoveredFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosCoveredFragment$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosCoveredFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosCoveredFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosCoveredFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosCoveredFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosCoveredFragment",
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
  (node/*:: as any*/).hash = "85bb5954b6108d8795f429f492a70aed";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosCoveredFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosCoveredFragment$data,
>*/);
