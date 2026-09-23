/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<19c7218adb58aaf5a5d464a5d4323181>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useFragmentActivitySnapshotTestScalar$fragmentType: FragmentType;
export type useFragmentActivitySnapshotTestScalar$data = {
  readonly node: ?{
    readonly name: ?string,
  },
  readonly $fragmentType: useFragmentActivitySnapshotTestScalar$fragmentType,
};
export type useFragmentActivitySnapshotTestScalar$key = {
  readonly $data?: useFragmentActivitySnapshotTestScalar$data,
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestScalar$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useFragmentActivitySnapshotTestScalar",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "id",
          "value": "1"
        }
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "node",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": "node(id:\"1\")"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "c9ce34c735d2843df5f793245c838973";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useFragmentActivitySnapshotTestScalar$fragmentType,
  useFragmentActivitySnapshotTestScalar$data,
>*/);
