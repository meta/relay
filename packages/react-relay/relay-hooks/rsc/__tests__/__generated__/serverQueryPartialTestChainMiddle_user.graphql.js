/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<6c491d39fa73953fed79a3e44109a3e5>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { serverQueryPartialTestServer_user$fragmentType } from "./serverQueryPartialTestServer_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestChainMiddle_user$fragmentType: FragmentType;
export type serverQueryPartialTestChainMiddle_user$data = {
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestServer_user$fragmentType,
  readonly $fragmentType: serverQueryPartialTestChainMiddle_user$fragmentType,
};
export type serverQueryPartialTestChainMiddle_user$key = {
  readonly $data?: serverQueryPartialTestChainMiddle_user$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestChainMiddle_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryPartialTestChainMiddle_user",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "serverQueryPartialTestServer_user"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "72b082c0d09d90e84a02ae06087f6d5e";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestChainMiddle_user$fragmentType,
  serverQueryPartialTestChainMiddle_user$data,
>*/);
