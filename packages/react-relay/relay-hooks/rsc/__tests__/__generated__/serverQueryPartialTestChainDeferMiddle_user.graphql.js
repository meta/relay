/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c66919e6a44b56d2a57ae1ccfd7d44ae>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { serverQueryPartialTestServer_user$fragmentType } from "./serverQueryPartialTestServer_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestChainDeferMiddle_user$fragmentType: FragmentType;
export type serverQueryPartialTestChainDeferMiddle_user$data = {
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestServer_user$fragmentType,
  readonly $fragmentType: serverQueryPartialTestChainDeferMiddle_user$fragmentType,
};
export type serverQueryPartialTestChainDeferMiddle_user$key = {
  readonly $data?: serverQueryPartialTestChainDeferMiddle_user$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestChainDeferMiddle_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryPartialTestChainDeferMiddle_user",
  "selections": [
    {
      "kind": "Defer",
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "serverQueryPartialTestServer_user"
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "ce85f48aee1a7d533b96013398c17d3e";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestChainDeferMiddle_user$fragmentType,
  serverQueryPartialTestChainDeferMiddle_user$data,
>*/);
