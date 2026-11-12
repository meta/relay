/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<40852042d97972684251af634c3bbfae>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestScaled_user$fragmentType } from "./useRelayHandoffTestScaled_user.graphql";
export type useRelayHandoffTestScaledQuery$variables = {};
export type useRelayHandoffTestScaledQuery$data = {
  readonly me: ?{
    readonly friends: {
      readonly $fragmentSpreads: useRelayHandoffTestScaled_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestScaledQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestScaledQuery$data,
  variables: useRelayHandoffTestScaledQuery$variables,
};
({
  "__relay_internal__pv__useRelayHandoffTestScalerelayprovider": require('../useRelayHandoffTestScale.relayprovider')
} as {
  readonly __relay_internal__pv__useRelayHandoffTestScalerelayprovider: {
    readonly get: () => ?ReadonlyArray<?number>,
  },
});
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestScaledQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "useRelayHandoffTestScaled_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "friends"
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
      {
        "defaultValue": null,
        "kind": "LocalArgument",
        "name": "__relay_internal__pv__useRelayHandoffTestScalerelayprovider"
      }
    ],
    "kind": "Operation",
    "name": "useRelayHandoffTestScaledQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          {
            "fragment": require('./useRelayHandoffTestScaled_user$normalization.graphql'),
            "kind": "FragmentSpread"
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
    "cacheID": "f9f582473d27610d63b260a7e7fb9910",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestScaledQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestScaledQuery(\n  $__relay_internal__pv__useRelayHandoffTestScalerelayprovider: [Int]\n) {\n  me {\n    ...useRelayHandoffTestScaled_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestScaled_user on User {\n  friends(first: 1) {\n    edges {\n      node {\n        name\n        profilePicture(size: $__relay_internal__pv__useRelayHandoffTestScalerelayprovider) {\n          uri\n        }\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n",
    "providedVariables": {
      "__relay_internal__pv__useRelayHandoffTestScalerelayprovider": require('../useRelayHandoffTestScale.relayprovider')
    }
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestScaled_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestScaled_user.graphql'),
        "rootVariables": [
          "__relay_internal__pv__useRelayHandoffTestScalerelayprovider"
        ]
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "fa8f329d438915df699f078303a26456";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestScaledQuery$variables,
  useRelayHandoffTestScaledQuery$data,
>*/);
