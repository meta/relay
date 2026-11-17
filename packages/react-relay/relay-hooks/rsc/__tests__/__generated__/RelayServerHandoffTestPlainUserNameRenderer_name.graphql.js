/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<085c7ff355dd24475d9e2eba89130b59>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType: FragmentType;
export type RelayServerHandoffTestPlainUserNameRenderer_name$data = {
  readonly data: ?{
    readonly text: ?string,
  },
  readonly plaintext: ?string,
  readonly $fragmentType: RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType,
};
export type RelayServerHandoffTestPlainUserNameRenderer_name$key = {
  readonly $data?: RelayServerHandoffTestPlainUserNameRenderer_name$data,
  readonly $fragmentSpreads: RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestPlainUserNameRenderer_name",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "plaintext",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "PlainUserNameData",
      "kind": "LinkedField",
      "name": "data",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "text",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "PlainUserNameRenderer",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "8731caf825b1b0e1db53cb5bc59b8e73";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestPlainUserNameRenderer_name$fragmentType,
  RelayServerHandoffTestPlainUserNameRenderer_name$data,
>*/);
