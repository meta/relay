/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2ec0d2f2fc7efd938c845f2ded69687e>>
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
      "defaultValue": true,
      "kind": "LocalArgument",
      "name": "useRelayHandoffTestModuleArgs_user$withData"
    }
  ],
  "kind": "SplitOperation",
  "metadata": {},
  "name": "useRelayHandoffTestModuleArgs_user$normalization",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "supported",
          "value": "1AwQS7"
        }
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "nameRenderer",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "__typename",
          "storageKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": [
                {
                  "kind": "Variable",
                  "name": "useRelayHandoffTestModuleArgsName_name$withData",
                  "variableName": "useRelayHandoffTestModuleArgs_user$withData"
                }
              ],
              "documentName": "useRelayHandoffTestModuleArgs_user",
              "fragmentName": "useRelayHandoffTestModuleArgsName_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport"
            }
          ],
          "type": "PlainUserNameRenderer",
          "abstractKey": null
        }
      ],
      "storageKey": "nameRenderer(supported:\"1AwQS7\")"
    }
  ]
};

if (__DEV__) {
  (node/*:: as any*/).hash = "585e4a61d8157948b7899b005988f1f7";
}

module.exports = node;
