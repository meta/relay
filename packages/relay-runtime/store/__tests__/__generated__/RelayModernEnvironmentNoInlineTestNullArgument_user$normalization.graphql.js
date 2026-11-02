/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<78654052e2215bc444716ba70cad80de>>
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
      "defaultValue": "SMALL",
      "kind": "LocalArgument",
      "name": "RelayModernEnvironmentNoInlineTestNullArgument_user$preset"
    }
  ],
  "kind": "SplitOperation",
  "metadata": {},
  "name": "RelayModernEnvironmentNoInlineTestNullArgument_user$normalization",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "preset",
          "variableName": "RelayModernEnvironmentNoInlineTestNullArgument_user$preset"
        }
      ],
      "concreteType": "Image",
      "kind": "LinkedField",
      "name": "profilePicture2",
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
  (node/*:: as any*/).hash = "5aa32d5af2b4efa15ab795728b73113b";
}

module.exports = node;
