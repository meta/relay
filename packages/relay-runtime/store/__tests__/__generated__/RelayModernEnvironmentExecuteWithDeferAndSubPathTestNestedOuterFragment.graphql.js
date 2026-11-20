/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<e5a593dacbc40ab9e827b59e5a65bd0e>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$data = {
  readonly allPhones: ?ReadonlyArray<?{
    readonly isVerified: ?boolean,
  }>,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment$fragmentType,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Phone",
      "kind": "LinkedField",
      "name": "allPhones",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isVerified",
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
          "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment"
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "5f2372e3381446e313db1309beaf91a7";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$data,
>*/);
