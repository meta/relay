/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c1da8fcf549d39d8d268d17f5fb53280>>
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
      "name": "RelayServerHandoffTestShadowingArgs_user$hasOwnProperty"
    }
  ],
  "kind": "SplitOperation",
  "metadata": {},
  "name": "RelayServerHandoffTestShadowingArgs_user$normalization",
  "selections": [
    {
      "alias": "scaled",
      "args": [
        {
          "kind": "Variable",
          "name": "size",
          "variableName": "RelayServerHandoffTestShadowingArgs_user$hasOwnProperty"
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
  (node/*:: as any*/).hash = "7319e6c3673ed6e7e4b34e44f68d344a";
}

module.exports = node;
