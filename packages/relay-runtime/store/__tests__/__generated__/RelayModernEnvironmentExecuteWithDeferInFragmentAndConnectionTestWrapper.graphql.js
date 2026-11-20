/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d8724a881fb52d989c6c6dec4f05ab17>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$data = {
  readonly id: string,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$fragmentType,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "kind": "Defer",
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection"
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "5ace9d3bbeea4c876fb8ba62f8ea1933";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$fragmentType,
  RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$data,
>*/);
