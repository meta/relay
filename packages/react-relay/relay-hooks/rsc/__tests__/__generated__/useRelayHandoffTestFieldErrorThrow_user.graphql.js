/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<07bfc6d007766906b2467f3021bd9b15>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestFieldErrorThrow_user$fragmentType: FragmentType;
export type useRelayHandoffTestFieldErrorThrow_user$data = {
  readonly lastName: ?string,
  readonly $fragmentType: useRelayHandoffTestFieldErrorThrow_user$fragmentType,
};
export type useRelayHandoffTestFieldErrorThrow_user$key = {
  readonly $data?: useRelayHandoffTestFieldErrorThrow_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestFieldErrorThrow_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "throwOnFieldError": true
  },
  "name": "useRelayHandoffTestFieldErrorThrow_user",
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
  (node/*:: as any*/).hash = "4263f7e840fc8337c09b78d4ad42e20d";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestFieldErrorThrow_user$fragmentType,
  useRelayHandoffTestFieldErrorThrow_user$data,
>*/);
