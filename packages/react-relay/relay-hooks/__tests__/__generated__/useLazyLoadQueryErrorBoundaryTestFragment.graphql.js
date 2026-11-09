/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<bc8c36d5995b9461b33918c91c72ebb6>>
 * @flow
 * @lightSyntaxTransform
 * @nogrep
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useLazyLoadQueryErrorBoundaryTestFragment$fragmentType: FragmentType;
export type useLazyLoadQueryErrorBoundaryTestFragment$data = {|
  +viewer: ?{|
    +actor: ?{|
      +name: ?string,
    |},
  |},
  +$fragmentType: useLazyLoadQueryErrorBoundaryTestFragment$fragmentType,
|};
export type useLazyLoadQueryErrorBoundaryTestFragment$key = {
  +$data?: useLazyLoadQueryErrorBoundaryTestFragment$data,
  +$fragmentSpreads: useLazyLoadQueryErrorBoundaryTestFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useLazyLoadQueryErrorBoundaryTestFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Viewer",
      "kind": "LinkedField",
      "name": "viewer",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "actor",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "name",
              "storageKey": null
            }
          ],
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
  (node/*: any*/).hash = "5248cece86fce831ffb9dcacf18793aa";
}

module.exports = ((node/*: any*/)/*: Fragment<
  useLazyLoadQueryErrorBoundaryTestFragment$fragmentType,
  useLazyLoadQueryErrorBoundaryTestFragment$data,
>*/);
