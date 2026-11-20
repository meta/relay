/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<629f7cc6064eb99ff9f879254fe82fa7>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestClient_user$fragmentType: FragmentType;
export type serverQueryPartialTestClient_user$data = {
  readonly username: ?string,
  readonly $fragmentType: serverQueryPartialTestClient_user$fragmentType,
};
export type serverQueryPartialTestClient_user$key = {
  readonly $data?: serverQueryPartialTestClient_user$data,
  readonly $fragmentSpreads: serverQueryPartialTestClient_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "serverQueryPartialTestClient_user",
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
};

if (__DEV__) {
  (node/*:: as any*/).hash = "dbd748f48d34a2ec736de3a349a3722b";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestClient_user$fragmentType,
  serverQueryPartialTestClient_user$data,
>*/);
