/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<bcdc2ad0b6804280bacb49f3e27cd4cc>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestSharedMarkdown_name$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestSharedMarkdown_name$data = {
  readonly markdown: ?string,
  readonly $fragmentType: RelayHandoffUseClientProvidersTestSharedMarkdown_name$fragmentType,
};
export type RelayHandoffUseClientProvidersTestSharedMarkdown_name$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestSharedMarkdown_name$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestSharedMarkdown_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestSharedMarkdown_name",
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
  (node/*:: as any*/).hash = "282c05f68f8b1026a167ec30fe833a50";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestSharedMarkdown_name$fragmentType,
  RelayHandoffUseClientProvidersTestSharedMarkdown_name$data,
>*/);
