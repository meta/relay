/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<ea1f0464f8a44114c7abba45f82f5e15>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersTestMarkdown_name$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestMarkdown_name$data = {
  readonly markdown: ?string,
  readonly $fragmentType: RelayHandoffUseClientProvidersTestMarkdown_name$fragmentType,
};
export type RelayHandoffUseClientProvidersTestMarkdown_name$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestMarkdown_name$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestMarkdown_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestMarkdown_name",
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
  (node/*:: as any*/).hash = "005214d953478f3315f23a64de31ea3d";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestMarkdown_name$fragmentType,
  RelayHandoffUseClientProvidersTestMarkdown_name$data,
>*/);
