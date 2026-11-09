/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<eeb31edd06bb3340c0841bb1f264667d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestClient_user$fragmentType: FragmentType;
export type RelayServerHandoffTestClient_user$data = {
  readonly lastName: ?string,
  readonly profilePicture: ?{
    readonly uri: ?string,
  },
  readonly $fragmentType: RelayServerHandoffTestClient_user$fragmentType,
};
export type RelayServerHandoffTestClient_user$key = {
  readonly $data?: RelayServerHandoffTestClient_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestClient_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "size"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestClient_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "size",
          "variableName": "size"
        }
      ],
      "concreteType": "Image",
      "kind": "LinkedField",
      "name": "profilePicture",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "uri",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "bbc2da783fd12b1dbe473f7bc8f69964";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestClient_user$fragmentType,
  RelayServerHandoffTestClient_user$data,
>*/);
