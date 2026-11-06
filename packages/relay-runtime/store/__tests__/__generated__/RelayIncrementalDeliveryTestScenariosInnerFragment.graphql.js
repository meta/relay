/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d658981f3764e0104e94597aa0373258>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosInnerFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosInnerFragment$data = {
  readonly alternate_name: ?string,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosInnerFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosInnerFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosInnerFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosInnerFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosInnerFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "alternate_name",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "34b8869b5430895b6be503907e9c3944";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosInnerFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosInnerFragment$data,
>*/);
