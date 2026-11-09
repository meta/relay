/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<e5ed8c4263f7efeeb954102b278f99d1>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryTestClient_user$fragmentType: FragmentType;
export type serverQueryTestClient_user$data = {
  readonly name: ?string,
  readonly $fragmentType: serverQueryTestClient_user$fragmentType,
};
export type serverQueryTestClient_user$key = {
  readonly $data?: serverQueryTestClient_user$data,
  readonly $fragmentSpreads: serverQueryTestClient_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "serverQueryTestClient_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "5381d45d1b645921c5c4df22b87d976e";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryTestClient_user$fragmentType,
  serverQueryTestClient_user$data,
>*/);
