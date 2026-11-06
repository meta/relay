/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<5b113608f2a8dbffe7f3869aab553edc>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$fragmentType: FragmentType;
export type RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$data = {
  readonly actors: ?ReadonlyArray<?{
    readonly name: ?string,
  }>,
  readonly $fragmentType: RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$fragmentType,
};
export type RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$key = {
  readonly $data?: RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$data,
  readonly $fragmentSpreads: RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayIncrementalDeliveryTestScenariosDeferredStreamFragment",
  "selections": [
    {
      "kind": "Stream",
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
      ]
    }
  ],
  "type": "Feedback",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "5c3e4b6ae87c36fa69a4dc91481b6049";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$fragmentType,
  RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$data,
>*/);
