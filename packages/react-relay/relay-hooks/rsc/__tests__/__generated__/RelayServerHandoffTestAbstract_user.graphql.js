/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4a933cd4ba01c2db614e46ef31b09491>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayServerHandoffTestAbstractDeferred_user$fragmentType } from "./RelayServerHandoffTestAbstractDeferred_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestAbstract_user$fragmentType: FragmentType;
export type RelayServerHandoffTestAbstract_user$data = {
  readonly name: ?string,
  readonly $fragmentSpreads: RelayServerHandoffTestAbstractDeferred_user$fragmentType,
  readonly $fragmentType: RelayServerHandoffTestAbstract_user$fragmentType,
};
export type RelayServerHandoffTestAbstract_user$key = {
  readonly $data?: RelayServerHandoffTestAbstract_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestAbstract_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestAbstract_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "kind": "Defer",
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "RelayServerHandoffTestAbstractDeferred_user"
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "e15434cd880311d91336c9478e8eb837";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestAbstract_user$fragmentType,
  RelayServerHandoffTestAbstract_user$data,
>*/);
