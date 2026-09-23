/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7299226d5bab7342feb9a315682153e4>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useFragmentActivitySnapshotTestList$fragmentType } from "./useFragmentActivitySnapshotTestList.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useFragmentActivitySnapshotTestRoot$fragmentType: FragmentType;
export type useFragmentActivitySnapshotTestRoot$data = {
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestList$fragmentType,
  readonly $fragmentType: useFragmentActivitySnapshotTestRoot$fragmentType,
};
export type useFragmentActivitySnapshotTestRoot$key = {
  readonly $data?: useFragmentActivitySnapshotTestRoot$data,
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestRoot$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useFragmentActivitySnapshotTestRoot",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "useFragmentActivitySnapshotTestList"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "85992e5a86d7831cf292b90eaacc210b";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useFragmentActivitySnapshotTestRoot$fragmentType,
  useFragmentActivitySnapshotTestRoot$data,
>*/);
