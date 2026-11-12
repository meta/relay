/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<57eb23aefffe5b937bd8b8f6e32e36d1>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestScaled_user$fragmentType: FragmentType;
type useRelayHandoffTestScaledPaginationQuery$variables = any;
export type useRelayHandoffTestScaled_user$data = {
  readonly friends: ?{
    readonly edges: ?ReadonlyArray<?{
      readonly node: ?{
        readonly name: ?string,
        readonly profilePicture: ?{
          readonly uri: ?string,
        },
      },
    }>,
  },
  readonly id: string,
  readonly $fragmentType: useRelayHandoffTestScaled_user$fragmentType,
};
export type useRelayHandoffTestScaled_user$key = {
  readonly $data?: useRelayHandoffTestScaled_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestScaled_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = (function(){
var v0 = [
  "friends"
];
return {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "__relay_internal__pv__useRelayHandoffTestScalerelayprovider"
    },
    {
      "defaultValue": 1,
      "kind": "LocalArgument",
      "name": "count"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "cursor"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "count",
        "cursor": "cursor",
        "direction": "forward",
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "count",
          "cursor": "cursor"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": require('./useRelayHandoffTestScaledPaginationQuery.graphql'),
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "useRelayHandoffTestScaled_user",
  "selections": [
    {
      "alias": "friends",
      "args": null,
      "concreteType": "FriendsConnection",
      "kind": "LinkedField",
      "name": "__useRelayHandoffTestScaled_friends_connection",
      "plural": false,
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
                {
                  "alias": null,
                  "args": [
                    {
                      "kind": "Variable",
                      "name": "size",
                      "variableName": "__relay_internal__pv__useRelayHandoffTestScalerelayprovider"
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
                },
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
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "58e63f0b047640876299171a168cfe3a";
}

module.exports = ((node/*:: as any*/)/*:: as RefetchableFragment<
  useRelayHandoffTestScaled_user$fragmentType,
  useRelayHandoffTestScaled_user$data,
  useRelayHandoffTestScaledPaginationQuery$variables,
>*/);
