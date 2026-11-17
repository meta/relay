/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f801ee90695e0f8f5a71177b33e846f4>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffHydrationTestDefaulted_name$fragmentType: FragmentType;
export type useRelayHandoffHydrationTestDefaulted_name$data = {
  readonly data?: ?{
    readonly text: ?string,
  },
  readonly plaintext: ?string,
  readonly $fragmentType: useRelayHandoffHydrationTestDefaulted_name$fragmentType,
};
export type useRelayHandoffHydrationTestDefaulted_name$key = {
  readonly $data?: useRelayHandoffHydrationTestDefaulted_name$data,
  readonly $fragmentSpreads: useRelayHandoffHydrationTestDefaulted_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [
    {
      "defaultValue": false,
      "kind": "LocalArgument",
      "name": "withData"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffHydrationTestDefaulted_name",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "plaintext",
      "storageKey": null
    },
    {
      "condition": "withData",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PlainUserNameData",
          "kind": "LinkedField",
          "name": "data",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "text",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ]
    }
  ],
  "type": "PlainUserNameRenderer",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "4448e3dab2f215e1c1caeb676fb7ab6a";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffHydrationTestDefaulted_name$fragmentType,
  useRelayHandoffHydrationTestDefaulted_name$data,
>*/);
