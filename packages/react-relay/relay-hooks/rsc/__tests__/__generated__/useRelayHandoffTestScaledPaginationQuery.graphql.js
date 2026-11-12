/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a2d604d35d16ae5d1a09c3ab11b49393>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
import type { useRelayHandoffTestScaled_user$fragmentType } from "./useRelayHandoffTestScaled_user.graphql";
export type useRelayHandoffTestScaledPaginationQuery$variables = {
  count?: ?number,
  cursor?: ?string,
  id: string,
  scale?: ?ReadonlyArray<?number>,
};
export type useRelayHandoffTestScaledPaginationQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: useRelayHandoffTestScaled_user$fragmentType,
  },
};
export type useRelayHandoffTestScaledPaginationQuery = {
  response: useRelayHandoffTestScaledPaginationQuery$data,
  variables: useRelayHandoffTestScaledPaginationQuery$variables,
};
({
  "scale": require('../useRelayHandoffTestScale.relayprovider'),
  "__relay_internal__pv__useRelayHandoffTestScalerelayprovider": require('../useRelayHandoffTestScale.relayprovider')
} as {
  readonly __relay_internal__pv__useRelayHandoffTestScalerelayprovider: {
    readonly get: () => ?ReadonlyArray<?number>,
  },
  readonly scale: {
    readonly get: () => ?ReadonlyArray<?number>,
  },
});
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "defaultValue": 1,
  "kind": "LocalArgument",
  "name": "count"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "cursor"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scale"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestScaledPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": [
              {
                "kind": "Variable",
                "name": "count",
                "variableName": "count"
              },
              {
                "kind": "Variable",
                "name": "cursor",
                "variableName": "cursor"
              }
            ],
            "kind": "FragmentSpread",
            "name": "useRelayHandoffTestScaled_user"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v3/*:: as any*/),
      (v2/*:: as any*/),
      {
        "defaultValue": null,
        "kind": "LocalArgument",
        "name": "__relay_internal__pv__useRelayHandoffTestScalerelayprovider"
      }
    ],
    "kind": "Operation",
    "name": "useRelayHandoffTestScaledPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
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
                    "name": "useRelayHandoffTestScaled_user$count",
                    "variableName": "count"
                  },
                  {
                    "kind": "Variable",
                    "name": "useRelayHandoffTestScaled_user$cursor",
                    "variableName": "cursor"
                  }
                ],
                "fragment": require('./useRelayHandoffTestScaled_user$normalization.graphql'),
                "kind": "FragmentSpread"
              }
            ],
            "type": "User",
            "abstractKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "0813e4777f40645f9e7728fb31a423a4",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestScaledPaginationQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestScaledPaginationQuery(\n  $count: Int = 1\n  $cursor: ID\n  $id: ID!\n  $__relay_internal__pv__useRelayHandoffTestScalerelayprovider: [Int]\n) {\n  node(id: $id) {\n    __typename\n    ...useRelayHandoffTestScaled_user_1G22uz\n    id\n  }\n}\n\nfragment useRelayHandoffTestScaled_user_1G22uz on User {\n  friends(first: $count, after: $cursor) {\n    edges {\n      node {\n        name\n        profilePicture(size: $__relay_internal__pv__useRelayHandoffTestScalerelayprovider) {\n          uri\n        }\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n",
    "providedVariables": {
      "scale": require('../useRelayHandoffTestScale.relayprovider'),
      "__relay_internal__pv__useRelayHandoffTestScalerelayprovider": require('../useRelayHandoffTestScale.relayprovider')
    }
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "58e63f0b047640876299171a168cfe3a";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  useRelayHandoffTestScaledPaginationQuery$variables,
  useRelayHandoffTestScaledPaginationQuery$data,
>*/);
