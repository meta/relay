/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<6ebf5b6f91c51752c0ff8408fdc39eb1>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosFailedFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosFailedFragment$data = {
  readonly name: ?string,
  readonly nearest_neighbor: {
    readonly id: string,
  },
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosFailedFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosFailedFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosFailedFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosFailedFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosFailedFragment",
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
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "nearest_neighbor",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "8deca7b7f0d13ef48c160ba1401e6c2a";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosFailedFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosFailedFragment$data,
>*/);
