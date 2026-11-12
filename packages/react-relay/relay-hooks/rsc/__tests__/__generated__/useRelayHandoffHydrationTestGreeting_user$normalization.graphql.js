/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2fc4e063f2a0573c58b816d70ec2a7e8>>
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
  "name": "useRelayHandoffHydrationTestGreeting_user$normalization",
  "selections": [
    {
      "name": "relayHandoffTestGreeting",
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
  (node/*:: as any*/).hash = "8b90758f0b014575fc0781f674e8b642";
}

module.exports = node;
