/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4a581d0cb5644b146b722ea432946d73>>
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
    "kind": "Variable",
    "name": "after",
    "variableName": "useRelayHandoffTestStreamConnection_user$cursor"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "useRelayHandoffTestStreamConnection_user$count"
  }
],
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
      "defaultValue": 3,
      "kind": "LocalArgument",
      "name": "useRelayHandoffTestStreamConnection_user$count"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "useRelayHandoffTestStreamConnection_user$cursor"
    }
  ],
  "kind": "SplitOperation",
  "metadata": {},
  "name": "useRelayHandoffTestStreamConnection_user$normalization",
  "selections": [
    {
      "alias": null,
      "args": (v0/*:: as any*/),
      "concreteType": "FriendsConnection",
      "kind": "LinkedField",
      "name": "friends",
      "plural": false,
      "selections": [
        {
          "if": null,
          "kind": "Stream",
          "label": "useRelayHandoffTestStreamConnection_user$stream$people",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "FriendsEdge",
              "kind": "LinkedField",
              "name": "edges",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "User",
                  "kind": "LinkedField",
                  "name": "node",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "name",
                      "storageKey": null
                    },
                    (v1/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "__typename",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "cursor",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ]
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v0/*:: as any*/),
      "filters": null,
      "handle": "connection",
      "key": "useRelayHandoffTestStreamConnection_friends",
      "kind": "LinkedHandle",
      "name": "friends"
    },
    (v1/*:: as any*/)
  ]
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "a8c95ec9faab9645e737480828dee825";
}

module.exports = node;
