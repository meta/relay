/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c194e69285485e6a17026658dc6ae331>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayServerHandoffTestModuleA_user$fragmentType } from "./RelayServerHandoffTestModuleA_user.graphql";
import type { RelayServerHandoffTestModuleB_user$fragmentType } from "./RelayServerHandoffTestModuleB_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestTwoModules_user$fragmentType: FragmentType;
export type RelayServerHandoffTestTwoModules_user$data = {
  readonly $fragmentSpreads: RelayServerHandoffTestModuleA_user$fragmentType & RelayServerHandoffTestModuleB_user$fragmentType,
  readonly $fragmentType: RelayServerHandoffTestTwoModules_user$fragmentType,
};
export type RelayServerHandoffTestTwoModules_user$key = {
  readonly $data?: RelayServerHandoffTestTwoModules_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestTwoModules_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestTwoModules_user",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "RelayServerHandoffTestModuleA_user"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "RelayServerHandoffTestModuleB_user"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "411b1487d114556cb5f215f8fda40b89";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestTwoModules_user$fragmentType,
  RelayServerHandoffTestTwoModules_user$data,
>*/);
