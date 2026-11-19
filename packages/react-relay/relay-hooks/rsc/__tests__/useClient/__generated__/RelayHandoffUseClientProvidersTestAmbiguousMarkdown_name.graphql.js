/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<ca0de32ef3c6b6aa05ebd57cf20f97a6>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$data = {
  readonly markdown: ?string,
  readonly $fragmentType: RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$fragmentType,
};
export type RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name",
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
  (node/*:: as any*/).hash = "9e5e25db772fa9e2ed35336578572d99";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$fragmentType,
  RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$data,
>*/);
