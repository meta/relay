/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<cd0ebf9e85e65eac3a44dbde12fad5b9>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { NormalizationSplitOperation } from 'relay-runtime';

*/

var node/*: NormalizationSplitOperation*/ = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "supported",
    "value": "1AwQS7"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "kind": "SplitOperation",
  "metadata": {},
  "name": "useRelayHandoffTestModuleTwoArgs_user$normalization",
  "selections": [
    {
      "alias": "without",
      "args": (v0/*:: as any*/),
      "concreteType": null,
      "kind": "LinkedField",
      "name": "nameRenderer",
      "plural": false,
      "selections": [
        (v1/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": [
                {
                  "kind": "Literal",
                  "name": "useRelayHandoffTestModuleArgsName_name$withData",
                  "value": false
                }
              ],
              "documentName": "useRelayHandoffTestModuleTwoArgs_user_without",
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
    },
    {
      "alias": "with",
      "args": (v0/*:: as any*/),
      "concreteType": null,
      "kind": "LinkedField",
      "name": "nameRenderer",
      "plural": false,
      "selections": [
        (v1/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": [
                {
                  "kind": "Literal",
                  "name": "useRelayHandoffTestModuleArgsName_name$withData",
                  "value": true
                }
              ],
              "documentName": "useRelayHandoffTestModuleTwoArgs_user_with",
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
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "90d53ccd18ea8745231d837ab798cfb6";
}

module.exports = node;
