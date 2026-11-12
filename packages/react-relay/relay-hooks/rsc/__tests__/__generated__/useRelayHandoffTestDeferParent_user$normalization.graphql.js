/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<434de328fb1c7ad0cbd842a0718b9e72>>
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
  "name": "useRelayHandoffTestDeferParent_user$normalization",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "if": null,
      "kind": "Defer",
      "label": "useRelayHandoffTestDeferParent_user$defer$child",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "lastName",
          "storageKey": null
        }
      ]
    }
  ]
};

if (__DEV__) {
  (node/*:: as any*/).hash = "81625c0f63806753778db78109ee315d";
}

module.exports = node;
