/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<cdec977a6cdfd9b03202963d6aa07e31>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayIncrementalDeliveryTestScenariosInnerFragment$fragmentType } from "./RelayIncrementalDeliveryTestScenariosInnerFragment.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosSubPathFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosSubPathFragment$data = {
  readonly address: ?{
    readonly city: ?string,
  },
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosInnerFragment$fragmentType,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosSubPathFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosSubPathFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosSubPathFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosSubPathFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosSubPathFragment",
  "selections": [
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
  (node/*:: as any*/).hash = "124df8bd3836770d082ca6298af9b26d";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosSubPathFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosSubPathFragment$data,
>*/);
