/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<3b7025c3dc336899e47460ee187764a9>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$data = {
  readonly friends: ?{
    readonly edges: ?ReadonlyArray<?{
      readonly node: ?{
        readonly id: string,
        readonly name: ?string,
      },
    }>,
  },
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": null,
        "cursor": null,
        "direction": "forward",
        "path": [
          "friends"
        ]
      }
    ]
  },
  "name": "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection",
  "selections": [
    {
      "alias": "friends",
      "args": null,
      "concreteType": "FriendsConnection",
      "kind": "LinkedField",
      "name": "__RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTest_friends_connection",
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
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "name",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "5e1107113c0893c5714dc8e2846e6552";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$fragmentType,
  RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection$data,
>*/);
