/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<862adda7bf4c47936aeee70824aedaf4>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { useRelayHandoffTestScaled_user$fragmentType } from "./useRelayHandoffTestScaled_user.graphql";
export type useRelayHandoffTestScaledClientQuery$variables = {};
export type useRelayHandoffTestScaledClientQuery$data = {
  readonly me: ?{
    readonly $fragmentSpreads: useRelayHandoffTestScaled_user$fragmentType,
  },
};
export type useRelayHandoffTestScaledClientQuery = {
  response: useRelayHandoffTestScaledClientQuery$data,
  variables: useRelayHandoffTestScaledClientQuery$variables,
};
({
  "__relay_internal__pv__useRelayHandoffTestScalerelayprovider": require('../useRelayHandoffTestScale.relayprovider')
} as {
  readonly __relay_internal__pv__useRelayHandoffTestScalerelayprovider: {
    readonly get: () => ?ReadonlyArray<?number>,
  },
});
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestScaledClientQuery",
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
            "args": null,
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
      {
        "defaultValue": null,
        "kind": "LocalArgument",
        "name": "__relay_internal__pv__useRelayHandoffTestScalerelayprovider"
      }
    ],
    "kind": "Operation",
    "name": "useRelayHandoffTestScaledClientQuery",
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
            "args": null,
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
    "cacheID": "d4f48c05e656276c85bc3cf51c6bda37",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestScaledClientQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestScaledClientQuery(\n  $__relay_internal__pv__useRelayHandoffTestScalerelayprovider: [Int]\n) {\n  me {\n    ...useRelayHandoffTestScaled_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestScaled_user on User {\n  friends(first: 1) {\n    edges {\n      node {\n        name\n        profilePicture(size: $__relay_internal__pv__useRelayHandoffTestScalerelayprovider) {\n          uri\n        }\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n",
    "providedVariables": {
      "__relay_internal__pv__useRelayHandoffTestScalerelayprovider": require('../useRelayHandoffTestScale.relayprovider')
    }
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "ff2287cc67181ac95c0f68c232269f92";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  useRelayHandoffTestScaledClientQuery$variables,
  useRelayHandoffTestScaledClientQuery$data,
>*/);
