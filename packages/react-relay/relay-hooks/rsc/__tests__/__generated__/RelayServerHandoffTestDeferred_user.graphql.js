/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2422d8a24256699dc1b07f8955400b52>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestDeferred_user$fragmentType: FragmentType;
export type RelayServerHandoffTestDeferred_user$data = {
  readonly emailAddresses: ?ReadonlyArray<?string>,
  readonly $fragmentType: RelayServerHandoffTestDeferred_user$fragmentType,
};
export type RelayServerHandoffTestDeferred_user$key = {
  readonly $data?: RelayServerHandoffTestDeferred_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestDeferred_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestDeferred_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "emailAddresses",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "10333960bd765e0635c47dc8332d102f";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestDeferred_user$fragmentType,
  RelayServerHandoffTestDeferred_user$data,
>*/);
