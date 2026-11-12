/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f02fd69a780e5bb07e3bd1ec18ac7277>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestStream_user$fragmentType: FragmentType;
export type useRelayHandoffTestStream_user$data = {
  readonly friends: ?{
    readonly edges: ?ReadonlyArray<?{
      readonly node: ?{
        readonly name: ?string,
      },
    }>,
  },
  readonly $fragmentType: useRelayHandoffTestStream_user$fragmentType,
};
export type useRelayHandoffTestStream_user$key = {
  readonly $data?: useRelayHandoffTestStream_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestStream_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestStream_user",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 10
        }
      ],
      "concreteType": "FriendsConnection",
      "kind": "LinkedField",
      "name": "friends",
      "plural": false,
      "selections": [
        {
          "kind": "Stream",
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
                      "name": "name",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ]
        }
      ],
      "storageKey": "friends(first:10)"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "d5173db4842088392cbf9ae854a017b8";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestStream_user$fragmentType,
  useRelayHandoffTestStream_user$data,
>*/);
