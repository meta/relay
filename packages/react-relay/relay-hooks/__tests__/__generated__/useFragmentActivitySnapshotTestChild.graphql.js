/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c00278fa48211f945a2d8f9b15c1d8aa>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useFragmentActivitySnapshotTestChild$fragmentType: FragmentType;
export type useFragmentActivitySnapshotTestChild$data = {
  readonly name: string,
  readonly $fragmentType: useFragmentActivitySnapshotTestChild$fragmentType,
};
export type useFragmentActivitySnapshotTestChild$key = {
  readonly $data?: useFragmentActivitySnapshotTestChild$data,
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestChild$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useFragmentActivitySnapshotTestChild",
  "selections": [
    {
      "kind": "RequiredField",
      "field": {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
        "storageKey": null
      },
      "action": "THROW"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "21b95d97846a02f5e3f57e19ece5b916";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useFragmentActivitySnapshotTestChild$fragmentType,
  useFragmentActivitySnapshotTestChild$data,
>*/);
