/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d351faf36d90cdb8fef4ac6a35adfab6>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosFirstFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosFirstFragment$data = {
  readonly alternate_name: ?string,
  readonly name: ?string,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosFirstFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosFirstFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosFirstFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosFirstFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosFirstFragment",
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
      "name": "alternate_name",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "96b363f2ab41c9065a4ebdc581813d74";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosFirstFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosFirstFragment$data,
>*/);
