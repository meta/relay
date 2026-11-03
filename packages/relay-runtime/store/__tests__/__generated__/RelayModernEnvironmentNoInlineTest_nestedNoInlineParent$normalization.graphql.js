/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<3fd99f0541fd737b74ff1511eef5f161>>
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
  "name": "__typename",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "RelayModernEnvironmentNoInlineTest_nestedNoInlineParent$cond"
    }
  ],
  "kind": "SplitOperation",
  "metadata": {},
  "name": "RelayModernEnvironmentNoInlineTest_nestedNoInlineParent$normalization",
  "selections": [
    {
      "alias": "mark",
      "args": [
        {
          "kind": "Literal",
          "name": "name",
          "value": "Mark"
        }
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "username",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": [
                {
                  "kind": "Variable",
                  "name": "RelayModernEnvironmentNoInlineTest_nestedNoInline$cond",
                  "variableName": "global_cond"
                }
              ],
              "fragment": require('./RelayModernEnvironmentNoInlineTest_nestedNoInline$normalization.graphql'),
              "kind": "FragmentSpread"
            }
          ],
          "type": "User",
          "abstractKey": null
        },
        (v1/*:: as any*/)
      ],
      "storageKey": "username(name:\"Mark\")"
    },
    {
      "alias": "zuck",
      "args": [
        {
          "kind": "Literal",
          "name": "name",
          "value": "Zuck"
        }
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "username",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": [
                {
                  "kind": "Literal",
                  "name": "RelayModernEnvironmentNoInlineTest_nestedNoInline$cond",
                  "value": false
                }
              ],
              "fragment": require('./RelayModernEnvironmentNoInlineTest_nestedNoInline$normalization.graphql'),
              "kind": "FragmentSpread"
            }
          ],
          "type": "User",
          "abstractKey": null
        },
        (v1/*:: as any*/)
      ],
      "storageKey": "username(name:\"Zuck\")"
    },
    {
      "alias": "joe",
      "args": [
        {
          "kind": "Literal",
          "name": "name",
          "value": "Joe"
        }
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "username",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": [
                {
                  "kind": "Variable",
                  "name": "RelayModernEnvironmentNoInlineTest_nestedNoInline$cond",
                  "variableName": "RelayModernEnvironmentNoInlineTest_nestedNoInlineParent$cond"
                }
              ],
              "fragment": require('./RelayModernEnvironmentNoInlineTest_nestedNoInline$normalization.graphql'),
              "kind": "FragmentSpread"
            }
          ],
          "type": "User",
          "abstractKey": null
        },
        (v1/*:: as any*/)
      ],
      "storageKey": "username(name:\"Joe\")"
    }
  ]
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "80e0fda8b8d8bb4e7200ea5387229c4c";
}

module.exports = node;
