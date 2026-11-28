/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d3e7170626b604d713e1ecf8c6c99db1>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useFragmentActivitySnapshotTestChild$fragmentType } from "./useFragmentActivitySnapshotTestChild.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useFragmentActivitySnapshotTestList$fragmentType: FragmentType;
export type useFragmentActivitySnapshotTestList$data = {
  readonly node: ?{
    readonly friends?: ?{
      readonly edges: ?ReadonlyArray<?{
        readonly node: ?{
          readonly child: {
            readonly $fragmentSpreads: useFragmentActivitySnapshotTestChild$fragmentType,
          },
          readonly id: string,
        },
      }>,
    },
  },
  readonly $fragmentType: useFragmentActivitySnapshotTestList$fragmentType,
};
export type useFragmentActivitySnapshotTestList$key = {
  readonly $data?: useFragmentActivitySnapshotTestList$data,
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestList$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useFragmentActivitySnapshotTestList",
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
              "args": [
                {
                  "kind": "Literal",
                  "name": "first",
                  "value": 1
                }
              ],
              "concreteType": "FriendsConnection",
              "kind": "LinkedField",
              "name": "friends",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "FriendsEdge",
                  "kind": "LinkedField",
                  "name": "edges",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "User",
                      "kind": "LinkedField",
                      "name": "node",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "id",
                          "storageKey": null
                        },
                        {
                          "fragment": {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "args": null,
                                "kind": "FragmentSpread",
                                "name": "useFragmentActivitySnapshotTestChild"
                              }
                            ],
                            "type": "User",
                            "abstractKey": null
                          },
                          "kind": "AliasedInlineFragmentSpread",
                          "name": "child"
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": "friends(first:1)"
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
  (node/*:: as any*/).hash = "525e29dfe9c5ad07a0608061b5f1d502";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useFragmentActivitySnapshotTestList$fragmentType,
  useFragmentActivitySnapshotTestList$data,
>*/);
