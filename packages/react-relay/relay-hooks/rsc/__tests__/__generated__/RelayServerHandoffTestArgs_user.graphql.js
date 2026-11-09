/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<29e683344263be16ff93f44bd4e78d7a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestArgs_user$fragmentType: FragmentType;
export type RelayServerHandoffTestArgs_user$data = {
  readonly scaled: ?{
    readonly uri: ?string,
  },
  readonly $fragmentType: RelayServerHandoffTestArgs_user$fragmentType,
};
export type RelayServerHandoffTestArgs_user$key = {
  readonly $data?: RelayServerHandoffTestArgs_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestArgs_user$fragmentType,
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
      "name": "scale"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestArgs_user",
  "selections": [
    {
      "alias": "scaled",
      "args": [
        {
          "kind": "Variable",
          "name": "size",
          "variableName": "scale"
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
  (node/*:: as any*/).hash = "97aa61050e33748f59df71e92ba6f526";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestArgs_user$fragmentType,
  RelayServerHandoffTestArgs_user$data,
>*/);
