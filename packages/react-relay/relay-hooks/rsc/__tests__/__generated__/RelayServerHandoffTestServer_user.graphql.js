/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<162126eb0f3210a610040f70b84ca67f>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayServerHandoffTestClient_user$fragmentType } from "./RelayServerHandoffTestClient_user.graphql";
import type { RelayServerHandoffTestInline_user$fragmentType } from "./RelayServerHandoffTestInline_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestServer_user$fragmentType: FragmentType;
export type RelayServerHandoffTestServer_user$data = {
  readonly alternate_name: ?string,
  readonly nested: {
    readonly $fragmentSpreads: RelayServerHandoffTestClient_user$fragmentType,
  },
  readonly $fragmentSpreads: RelayServerHandoffTestInline_user$fragmentType,
  readonly $fragmentType: RelayServerHandoffTestServer_user$fragmentType,
};
export type RelayServerHandoffTestServer_user$key = {
  readonly $data?: RelayServerHandoffTestServer_user$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: RelayServerHandoffTestServer_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "RelayServerHandoffTestServer_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "alternate_name",
      "storageKey": null
    },
    {
      "kind": "InlineDataFragmentSpread",
      "name": "RelayServerHandoffTestInline_user",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "firstName",
          "storageKey": null
        }
      ],
      "args": null,
      "argumentDefinitions": []
    },
    {
      "fragment": {
        "kind": "InlineFragment",
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayServerHandoffTestClient_user"
          }
        ],
        "type": "User",
        "abstractKey": null
      },
      "kind": "AliasedInlineFragmentSpread",
      "name": "nested"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "3a99465654b1d36e7741d47f67aee4f0";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestServer_user$fragmentType,
  RelayServerHandoffTestServer_user$data,
>*/);
