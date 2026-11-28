/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<71e367f5eccfe2f626ab2dae8f0d6f8f>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$data = {
  readonly me: ?{
    readonly name: ?string,
  },
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment",
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
          "name": "name",
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
  (node/*:: as any*/).hash = "e9261d826eaa2fa418929cf991638243";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferTestFullyDeferredFragment$data,
>*/);
