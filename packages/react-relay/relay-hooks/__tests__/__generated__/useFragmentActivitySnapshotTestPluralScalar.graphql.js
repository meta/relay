/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c1f9e9c87b56714c05cc62dc0a4c8ad2>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useFragmentActivitySnapshotTestPluralScalar$fragmentType: FragmentType;
export type useFragmentActivitySnapshotTestPluralScalar$data = ReadonlyArray<{
  readonly node: ?{
    readonly name: ?string,
  },
  readonly $fragmentType: useFragmentActivitySnapshotTestPluralScalar$fragmentType,
}>;
export type useFragmentActivitySnapshotTestPluralScalar$key = ReadonlyArray<{
  readonly $data?: useFragmentActivitySnapshotTestPluralScalar$data,
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestPluralScalar$fragmentType,
  ...
}>;
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "plural": true
  },
  "name": "useFragmentActivitySnapshotTestPluralScalar",
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
  (node/*:: as any*/).hash = "c47e5b900429665f2a130b84c56d2392";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useFragmentActivitySnapshotTestPluralScalar$fragmentType,
  useFragmentActivitySnapshotTestPluralScalar$data,
>*/);
