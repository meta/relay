/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<747b3986b68403e73f542402ba418221>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType, Result } from "relay-runtime";
declare export opaque type useRelayHandoffTestFieldErrorCatch_user$fragmentType: FragmentType;
export type useRelayHandoffTestFieldErrorCatch_user$data = {
  readonly lastName: Result<?string, unknown>,
  readonly $fragmentType: useRelayHandoffTestFieldErrorCatch_user$fragmentType,
};
export type useRelayHandoffTestFieldErrorCatch_user$key = {
  readonly $data?: useRelayHandoffTestFieldErrorCatch_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestFieldErrorCatch_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestFieldErrorCatch_user",
  "selections": [
    {
      "kind": "CatchField",
      "field": {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "lastName",
        "storageKey": null
      },
      "to": "RESULT"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "70e68caaeab7712daa873632590f113d";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestFieldErrorCatch_user$fragmentType,
  useRelayHandoffTestFieldErrorCatch_user$data,
>*/);
