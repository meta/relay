/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<20232f171752bd6fb8b45fefd7b5ff8e>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment$data = {
  readonly name: ?string,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment",
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
  (node/*:: as any*/).hash = "126f4c071e4b260e1dda045cd5953606";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferTestQueuedReadFragment$data,
>*/);
