/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<83cb78a3fe35ac950ff4da98b759652a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { serverQueryPartialTestInner_query$fragmentType } from "./serverQueryPartialTestInner_query.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestOuter_query$fragmentType: FragmentType;
export type serverQueryPartialTestOuter_query$data = {
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestInner_query$fragmentType,
  readonly $fragmentType: serverQueryPartialTestOuter_query$fragmentType,
};
export type serverQueryPartialTestOuter_query$key = {
  readonly $data?: serverQueryPartialTestOuter_query$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestOuter_query$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryPartialTestOuter_query",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "serverQueryPartialTestInner_query"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "c3a83fa110ac5684a68ca6907e8596a2";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestOuter_query$fragmentType,
  serverQueryPartialTestOuter_query$data,
>*/);
