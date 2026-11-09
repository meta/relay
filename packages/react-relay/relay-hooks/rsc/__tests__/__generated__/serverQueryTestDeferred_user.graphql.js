/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<792cba19b0d52cdd43dc6efdb708ae47>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryTestDeferred_user$fragmentType: FragmentType;
export type serverQueryTestDeferred_user$data = {
  readonly lastName: ?string,
  readonly $fragmentType: serverQueryTestDeferred_user$fragmentType,
};
export type serverQueryTestDeferred_user$key = {
  readonly $data?: serverQueryTestDeferred_user$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryTestDeferred_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryTestDeferred_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastName",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "fbfaf861d6f688ce9ddd6f4c43bc23a8";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryTestDeferred_user$fragmentType,
  serverQueryTestDeferred_user$data,
>*/);
