/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d0c906a8196ece312f0b2965fcbbe59d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "5e4703ae5ca012ff00f7ed582bc2491b";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment$data,
>*/);
