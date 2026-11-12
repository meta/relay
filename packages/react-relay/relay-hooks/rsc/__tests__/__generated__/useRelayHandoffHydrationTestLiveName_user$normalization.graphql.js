/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7b553c06650ab767f2c9fd67c5aabd2b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { NormalizationSplitOperation } from 'relay-runtime';

*/

var node/*: NormalizationSplitOperation*/ = {
  "kind": "SplitOperation",
  "metadata": {},
  "name": "useRelayHandoffHydrationTestLiveName_user$normalization",
  "selections": [
    {
      "name": "relayHandoffTestLiveName",
      "args": null,
      "fragment": {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          }
        ],
        "type": "User",
        "abstractKey": null
      },
      "kind": "RelayResolver",
      "storageKey": null,
      "isOutputType": true
    }
  ]
};

if (__DEV__) {
  (node/*:: as any*/).hash = "870901a613f7a4655b97d043ef291082";
}

module.exports = node;
