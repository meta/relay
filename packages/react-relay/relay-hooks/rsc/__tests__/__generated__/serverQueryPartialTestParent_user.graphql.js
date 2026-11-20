/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<83acb8d5b96172274755101ab4def42e>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { serverQueryPartialTestServer_user$fragmentType } from "./serverQueryPartialTestServer_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestParent_user$fragmentType: FragmentType;
export type serverQueryPartialTestParent_user$data = {
  readonly $serverFragment: true,
  readonly name: ?string,
  readonly $fragmentSpreads: serverQueryPartialTestServer_user$fragmentType,
  readonly $fragmentType: serverQueryPartialTestParent_user$fragmentType,
};
export type serverQueryPartialTestParent_user$key = {
  readonly $data?: serverQueryPartialTestParent_user$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestParent_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryPartialTestParent_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
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
  (node/*:: as any*/).hash = "e1946f53c0421d8ff458511980efc2f3";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestParent_user$fragmentType,
  serverQueryPartialTestParent_user$data,
>*/);
