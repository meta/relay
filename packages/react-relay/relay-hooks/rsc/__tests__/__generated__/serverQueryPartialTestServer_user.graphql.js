/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<470aa7f3ec59b1ed039582ee84b2750a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestServer_user$fragmentType: FragmentType;
export type serverQueryPartialTestServer_user$data = {
  readonly lastName: ?string,
  readonly $fragmentType: serverQueryPartialTestServer_user$fragmentType,
};
export type serverQueryPartialTestServer_user$key = {
  readonly $data?: serverQueryPartialTestServer_user$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestServer_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryPartialTestServer_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastName",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "2fd376350ab37fcd1eddc7e5bf13cf98";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestServer_user$fragmentType,
  serverQueryPartialTestServer_user$data,
>*/);
