/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<10722dfd7e4202fd09d3307b5031a667>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$data = {
  readonly id: string,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$fragmentType,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment",
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
          "name": "RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment"
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "33da2bcdc8057c0a921a774e9b299067";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$data,
>*/);
