/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<ef06a0697e1e4cc6d19422bd7200a7c6>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { serverQueryPartialTestChainDeferMiddle_user$fragmentType } from "./serverQueryPartialTestChainDeferMiddle_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestChainDeferParent_query$fragmentType: FragmentType;
export type serverQueryPartialTestChainDeferParent_query$data = {
  readonly me: ?{
    readonly $serverFragment: true,
    readonly $fragmentSpreads: serverQueryPartialTestChainDeferMiddle_user$fragmentType,
  },
  readonly $fragmentType: serverQueryPartialTestChainDeferParent_query$fragmentType,
};
export type serverQueryPartialTestChainDeferParent_query$key = {
  readonly $data?: serverQueryPartialTestChainDeferParent_query$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestChainDeferParent_query$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryPartialTestChainDeferParent_query",
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
          "name": "serverQueryPartialTestChainDeferMiddle_user"
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "ef8b9c1a0971eb73ed95a95c3a54cfdc";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestChainDeferParent_query$fragmentType,
  serverQueryPartialTestChainDeferParent_query$data,
>*/);
