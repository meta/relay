/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<37086aaaf2e3ed35c0f987da5568999d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestShadowingArgs_user$fragmentType: FragmentType;
export type RelayServerHandoffTestShadowingArgs_user$data = {
  readonly scaled: ?{
    readonly uri: ?string,
  },
  readonly $fragmentType: RelayServerHandoffTestShadowingArgs_user$fragmentType,
};
export type RelayServerHandoffTestShadowingArgs_user$key = {
  readonly $data?: RelayServerHandoffTestShadowingArgs_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestShadowingArgs_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [
    {
      "defaultValue": [
        1
      ],
      "kind": "LocalArgument",
      "name": "hasOwnProperty"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestShadowingArgs_user",
  "selections": [
    {
      "alias": "scaled",
      "args": [
        {
          "kind": "Variable",
          "name": "size",
          "variableName": "hasOwnProperty"
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
  (node/*:: as any*/).hash = "7319e6c3673ed6e7e4b34e44f68d344a";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestShadowingArgs_user$fragmentType,
  RelayServerHandoffTestShadowingArgs_user$data,
>*/);
