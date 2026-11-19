/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<131a7680b4e52e171f3f3962f78f4291>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersResolverPlain_name$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersResolverPlain_name$data = {
  readonly plaintext: ?string,
  readonly $fragmentType: RelayHandoffUseClientProvidersResolverPlain_name$fragmentType,
};
export type RelayHandoffUseClientProvidersResolverPlain_name$key = {
  readonly $data?: RelayHandoffUseClientProvidersResolverPlain_name$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersResolverPlain_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersResolverPlain_name",
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
  (node/*:: as any*/).hash = "541ad1e09f47036662c0497ceba99970";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersResolverPlain_name$fragmentType,
  RelayHandoffUseClientProvidersResolverPlain_name$data,
>*/);
