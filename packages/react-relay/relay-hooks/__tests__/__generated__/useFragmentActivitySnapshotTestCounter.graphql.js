/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b4343f3e9f3c576f088e89bc3fd605b9>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useFragmentActivitySnapshotTestCounter$fragmentType: FragmentType;
export type useFragmentActivitySnapshotTestCounter$data = {
  readonly node: ?{
    readonly username?: ?string,
  },
  readonly $fragmentType: useFragmentActivitySnapshotTestCounter$fragmentType,
};
export type useFragmentActivitySnapshotTestCounter$key = {
  readonly $data?: useFragmentActivitySnapshotTestCounter$data,
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestCounter$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useFragmentActivitySnapshotTestCounter",
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
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "username",
              "storageKey": null
            }
          ],
          "type": "User",
          "abstractKey": null
        }
      ],
      "storageKey": "node(id:\"1\")"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "0160b539d601f59fc82b9180058c3164";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useFragmentActivitySnapshotTestCounter$fragmentType,
  useFragmentActivitySnapshotTestCounter$data,
>*/);
