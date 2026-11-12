/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d291ce56f20d9c32456acfef158afe70>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestCard_user$fragmentType: FragmentType;
export type useRelayHandoffTestCard_user$data = {
  readonly lastName: ?string,
  readonly profilePicture: ?{
    readonly uri: ?string,
  },
  readonly $fragmentType: useRelayHandoffTestCard_user$fragmentType,
};
export type useRelayHandoffTestCard_user$key = {
  readonly $data?: useRelayHandoffTestCard_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestCard_user$fragmentType,
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
  "name": "useRelayHandoffTestCard_user",
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
  (node/*:: as any*/).hash = "85c7c8791e75b88565c733430de5408d";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestCard_user$fragmentType,
  useRelayHandoffTestCard_user$data,
>*/);
