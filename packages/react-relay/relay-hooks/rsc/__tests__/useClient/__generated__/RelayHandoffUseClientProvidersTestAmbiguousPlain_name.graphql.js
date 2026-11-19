/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<3c168d1d6966005406296fe90f7261e1>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestAmbiguousPlain_name$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestAmbiguousPlain_name$data = {
  readonly plaintext: ?string,
  readonly $fragmentType: RelayHandoffUseClientProvidersTestAmbiguousPlain_name$fragmentType,
};
export type RelayHandoffUseClientProvidersTestAmbiguousPlain_name$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestAmbiguousPlain_name$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestAmbiguousPlain_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestAmbiguousPlain_name",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "plaintext",
      "storageKey": null
    }
  ],
  "type": "PlainUserNameRenderer",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "78cad59731e5c87393d5ecf9d7d1cfb0";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestAmbiguousPlain_name$fragmentType,
  RelayHandoffUseClientProvidersTestAmbiguousPlain_name$data,
>*/);
