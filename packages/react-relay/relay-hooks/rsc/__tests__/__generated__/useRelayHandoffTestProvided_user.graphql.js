/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<51a94c14e488a0ac9641819cdc24d08a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestProvided_user$fragmentType: FragmentType;
export type useRelayHandoffTestProvided_user$data = {
  readonly name?: ?string,
  readonly $fragmentType: useRelayHandoffTestProvided_user$fragmentType,
};
export type useRelayHandoffTestProvided_user$key = {
  readonly $data?: useRelayHandoffTestProvided_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestProvided_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "__relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestProvided_user",
  "selections": [
    {
      "condition": "__relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "43779bb54e3a71488f99babc83475133";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestProvided_user$fragmentType,
  useRelayHandoffTestProvided_user$data,
>*/);
