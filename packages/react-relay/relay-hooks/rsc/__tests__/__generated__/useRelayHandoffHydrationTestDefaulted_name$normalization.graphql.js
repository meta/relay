/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<cd5a10eecbbfc2091b602081089cd81a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { NormalizationSplitOperation } from 'relay-runtime';

*/

var node/*: NormalizationSplitOperation*/ = {
  "argumentDefinitions": [
    {
      "defaultValue": false,
      "kind": "LocalArgument",
      "name": "useRelayHandoffHydrationTestDefaulted_name$withData"
    }
  ],
  "kind": "SplitOperation",
  "metadata": {},
  "name": "useRelayHandoffHydrationTestDefaulted_name$normalization",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "plaintext",
      "storageKey": null
    },
    {
      "condition": "useRelayHandoffHydrationTestDefaulted_name$withData",
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
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "id",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ]
    }
  ]
};

if (__DEV__) {
  (node/*:: as any*/).hash = "4448e3dab2f215e1c1caeb676fb7ab6a";
}

module.exports = node;
