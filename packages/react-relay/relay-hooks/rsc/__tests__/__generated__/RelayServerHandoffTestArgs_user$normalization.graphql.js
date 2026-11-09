/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<cbca4c892c252d842a91483b31a5be30>>
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
      "defaultValue": [
        1
      ],
      "kind": "LocalArgument",
      "name": "RelayServerHandoffTestArgs_user$scale"
    }
  ],
  "kind": "SplitOperation",
  "metadata": {},
  "name": "RelayServerHandoffTestArgs_user$normalization",
  "selections": [
    {
      "alias": "scaled",
      "args": [
        {
          "kind": "Variable",
          "name": "size",
          "variableName": "RelayServerHandoffTestArgs_user$scale"
        }
      ],
      "concreteType": "Image",
      "kind": "LinkedField",
      "name": "profilePicture",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "uri",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ]
};

if (__DEV__) {
  (node/*:: as any*/).hash = "97aa61050e33748f59df71e92ba6f526";
}

module.exports = node;
