/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<0c01d27d2a56a22ba9e941b8744a17cd>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$data = {
  readonly markdown: ?string,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$fragmentType,
};
export type RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "markdown",
      "storageKey": null
    }
  ],
  "type": "MarkdownUserNameRenderer",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "447764c98e3679e5562f6c1e40ca8854";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$fragmentType,
  RelayModernEnvironmentExecuteWithMatchTestTwoDocuments_name$data,
>*/);
