/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c5dc13a13db680591f6f1ee7565509ef>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type serverQueryPartialTestClient_query$fragmentType: FragmentType;
export type serverQueryPartialTestClient_query$data = {
  readonly me: ?{
    readonly username: ?string,
  },
  readonly $fragmentType: serverQueryPartialTestClient_query$fragmentType,
};
export type serverQueryPartialTestClient_query$key = {
  readonly $data?: serverQueryPartialTestClient_query$data,
  readonly $fragmentSpreads: serverQueryPartialTestClient_query$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "serverQueryPartialTestClient_query",
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
          "name": "username",
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
  (node/*:: as any*/).hash = "db92ecb229c9faef7ec8ce14f3da5ace";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  serverQueryPartialTestClient_query$fragmentType,
  serverQueryPartialTestClient_query$data,
>*/);
