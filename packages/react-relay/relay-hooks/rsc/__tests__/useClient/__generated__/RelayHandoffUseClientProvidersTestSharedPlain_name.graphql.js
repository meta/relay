/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b61d763b74efe27bd9429715905fd3d0>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestSharedPlain_name$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestSharedPlain_name$data = {
  readonly plaintext: ?string,
  readonly $fragmentType: RelayHandoffUseClientProvidersTestSharedPlain_name$fragmentType,
};
export type RelayHandoffUseClientProvidersTestSharedPlain_name$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestSharedPlain_name$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestSharedPlain_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestSharedPlain_name",
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
  (node/*:: as any*/).hash = "a940ba37b328ccbb10c7782503e9d7bd";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestSharedPlain_name$fragmentType,
  RelayHandoffUseClientProvidersTestSharedPlain_name$data,
>*/);
