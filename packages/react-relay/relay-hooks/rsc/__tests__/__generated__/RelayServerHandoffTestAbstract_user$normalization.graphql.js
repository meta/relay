/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<0185e77a2edecf1ee93d486703eb322e>>
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
  "name": "RelayServerHandoffTestAbstract_user$normalization",
  "selections": [
    (v0/*:: as any*/),
    {
      "if": null,
      "kind": "Defer",
      "label": "RelayServerHandoffTestAbstract_user$defer$abstract",
      "selections": [
        {
          "kind": "InlineFragment",
          "selections": [
            (v0/*:: as any*/)
          ],
          "type": "Named",
          "abstractKey": "__isNamed"
        }
      ]
    }
  ]
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "e15434cd880311d91336c9478e8eb837";
}

module.exports = node;
