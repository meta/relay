/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<99d9175345a9c855c9f32a11ca77c096>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestAbstractDeferred_user$fragmentType: FragmentType;
export type RelayServerHandoffTestAbstractDeferred_user$data = {
  readonly name?: ?string,
  readonly $fragmentType: RelayServerHandoffTestAbstractDeferred_user$fragmentType,
};
export type RelayServerHandoffTestAbstractDeferred_user$key = {
  readonly $data?: RelayServerHandoffTestAbstractDeferred_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestAbstractDeferred_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestAbstractDeferred_user",
  "selections": [
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "type": "Named",
      "abstractKey": "__isNamed"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "70dd60766d6d5845c46af83e89d2a1c2";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestAbstractDeferred_user$fragmentType,
  RelayServerHandoffTestAbstractDeferred_user$data,
>*/);
