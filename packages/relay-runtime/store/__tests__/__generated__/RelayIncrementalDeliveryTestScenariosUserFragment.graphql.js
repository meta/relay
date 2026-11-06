/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f915db0ea0ec04b39a80e7ac0c077f6d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosUserFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosUserFragment$data = {
  readonly id: string,
  readonly name: ?string,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosUserFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosUserFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosUserFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosUserFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosUserFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
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
  (node/*:: as any*/).hash = "5a977e5a49091f8916d53d32e8575d38";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosUserFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosUserFragment$data,
>*/);
