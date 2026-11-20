/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<ad49cd6f9b65f9c3684a80f92dc2b698>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { serverQueryPartialTestChainMiddle_user$fragmentType } from "./serverQueryPartialTestChainMiddle_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestChainParent_query$fragmentType: FragmentType;
export type serverQueryPartialTestChainParent_query$data = {
  readonly me: ?{
    readonly $serverFragment: true,
    readonly $fragmentSpreads: serverQueryPartialTestChainMiddle_user$fragmentType,
  },
  readonly $fragmentType: serverQueryPartialTestChainParent_query$fragmentType,
};
export type serverQueryPartialTestChainParent_query$key = {
  readonly $data?: serverQueryPartialTestChainParent_query$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestChainParent_query$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryPartialTestChainParent_query",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "me",
      "plural": false,
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "serverQueryPartialTestChainMiddle_user"
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "9161c62d976c26f53c1e9aabf6ac2574";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestChainParent_query$fragmentType,
  serverQueryPartialTestChainParent_query$data,
>*/);
