/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<71a8797de714d300c5e46920b034126b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosActorNamesFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosActorNamesFragment$data = {
  readonly actors: ?ReadonlyArray<?{
    readonly name: ?string,
  }>,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosActorNamesFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosActorNamesFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosActorNamesFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosActorNamesFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosActorNamesFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "actors",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Feedback",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "514f331b862bb5975b5dd215010f5d90";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosActorNamesFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosActorNamesFragment$data,
>*/);
