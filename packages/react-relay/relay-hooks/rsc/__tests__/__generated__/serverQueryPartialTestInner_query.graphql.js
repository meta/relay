/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<fabf1ac18646ff8686ea99a4af45c810>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestInner_query$fragmentType: FragmentType;
export type serverQueryPartialTestInner_query$data = {
  readonly me: ?{
    readonly lastName: ?string,
  },
  readonly $fragmentType: serverQueryPartialTestInner_query$fragmentType,
};
export type serverQueryPartialTestInner_query$key = {
  readonly $data?: serverQueryPartialTestInner_query$data,
  readonly $serverFragment: true,
  readonly $fragmentSpreads: serverQueryPartialTestInner_query$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "serverFragment": true
  },
  "name": "serverQueryPartialTestInner_query",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "me",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "lastName",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "9c3149374e694160df8f6e3b831b6377";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestInner_query$fragmentType,
  serverQueryPartialTestInner_query$data,
>*/);
