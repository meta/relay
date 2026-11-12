/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<fd0d7c9ad3b9a3deb30f3eee30ca255f>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { NormalizationSplitOperation } from 'relay-runtime';

*/

var node/*: NormalizationSplitOperation*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "kind": "SplitOperation",
  "metadata": {},
  "name": "useRelayHandoffHydrationTestNameLength_user$normalization",
  "selections": [
    (v0/*:: as any*/),
    {
      "name": "relayHandoffTestNameLength",
      "args": null,
      "fragment": {
        "kind": "InlineFragment",
        "selections": [
          (v0/*:: as any*/)
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
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "bb009423314c8f761b07e5dea4e02089";
}

module.exports = node;
