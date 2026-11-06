/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<828ae397ccd09127bbd69fc135648a39>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosOverlapFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosOverlapFragment$data = {
  readonly address: ?{
    readonly city: ?string,
  },
  readonly alternate_name: ?string,
  readonly name: ?string,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosOverlapFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosOverlapFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosOverlapFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosOverlapFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosOverlapFragment",
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
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "StreetAddress",
      "kind": "LinkedField",
      "name": "address",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "city",
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
  (node/*:: as any*/).hash = "222bb4de70fe3330aa45950a431805a1";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosOverlapFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosOverlapFragment$data,
>*/);
