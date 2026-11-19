/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<20e48aaf053971d3d36e2fa23bdd66d4>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestPlain_name$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestPlain_name$data = {
  readonly data: ?{
    readonly text: ?string,
  },
  readonly plaintext: ?string,
  readonly $fragmentType: RelayHandoffUseClientProvidersTestPlain_name$fragmentType,
};
export type RelayHandoffUseClientProvidersTestPlain_name$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestPlain_name$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestPlain_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestPlain_name",
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
  (node/*:: as any*/).hash = "e1b0414714da8724132c2a91d9a0fc31";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestPlain_name$fragmentType,
  RelayHandoffUseClientProvidersTestPlain_name$data,
>*/);
