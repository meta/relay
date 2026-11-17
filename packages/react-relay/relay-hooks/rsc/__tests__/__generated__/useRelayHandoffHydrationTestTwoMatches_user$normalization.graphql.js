/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b8436be1738d1577a36b117253df888d>>
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
  "kind": "Literal",
  "name": "supported",
  "value": "1AwQS7"
},
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
  "name": "useRelayHandoffHydrationTestTwoMatches_user$normalization",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": [
        (v0/*:: as any*/)
      ],
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
                  "name": "useRelayHandoffHydrationTestDefaulted_name$withData",
                  "value": true
                }
              ],
              "documentName": "useRelayHandoffHydrationTestTwoMatches_user_with",
              "fragmentName": "useRelayHandoffHydrationTestDefaulted_name",
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
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "context",
          "value": "HEADER"
        },
        (v0/*:: as any*/)
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "nameRendererForContext",
      "plural": false,
      "selections": [
        (v1/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": null,
              "documentName": "useRelayHandoffHydrationTestTwoMatches_user_default",
              "fragmentName": "useRelayHandoffHydrationTestDefaulted_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport"
            }
          ],
          "type": "PlainUserNameRenderer",
          "abstractKey": null
        }
      ],
      "storageKey": "nameRendererForContext(context:\"HEADER\",supported:\"1AwQS7\")"
    }
  ]
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "a947d1883d7a78dc55ead79f38c122ff";
}

module.exports = node;
