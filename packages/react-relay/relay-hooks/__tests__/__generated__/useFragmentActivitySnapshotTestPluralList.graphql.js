/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7766b17e9fca603faade8a754d37ea81>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useFragmentActivitySnapshotTestChild$fragmentType } from "./useFragmentActivitySnapshotTestChild.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useFragmentActivitySnapshotTestPluralList$fragmentType: FragmentType;
export type useFragmentActivitySnapshotTestPluralList$data = ReadonlyArray<{
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
  readonly $fragmentType: useFragmentActivitySnapshotTestPluralList$fragmentType,
}>;
export type useFragmentActivitySnapshotTestPluralList$key = ReadonlyArray<{
  readonly $data?: useFragmentActivitySnapshotTestPluralList$data,
  readonly $fragmentSpreads: useFragmentActivitySnapshotTestPluralList$fragmentType,
  ...
}>;
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "plural": true
  },
  "name": "useFragmentActivitySnapshotTestPluralList",
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
  (node/*:: as any*/).hash = "e6d9c57696ee665028bc3b2060a9c8ac";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useFragmentActivitySnapshotTestPluralList$fragmentType,
  useFragmentActivitySnapshotTestPluralList$data,
>*/);
