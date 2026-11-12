/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<465bb23a541d51099faee7400a9c7b6d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestFieldErrorCatch_user$fragmentType } from "./useRelayHandoffTestFieldErrorCatch_user.graphql";
import type { useRelayHandoffTestFieldErrorThrow_user$fragmentType } from "./useRelayHandoffTestFieldErrorThrow_user.graphql";
export type useRelayHandoffTestFieldErrorQuery$variables = {};
export type useRelayHandoffTestFieldErrorQuery$data = {
  readonly me: ?{
    readonly caught: {
      readonly $fragmentSpreads: useRelayHandoffTestFieldErrorCatch_user$fragmentType,
    },
    readonly thrown: {
      readonly $fragmentSpreads: useRelayHandoffTestFieldErrorThrow_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestFieldErrorQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestFieldErrorQuery$data,
  variables: useRelayHandoffTestFieldErrorQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestFieldErrorQuery",
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
                  "name": "useRelayHandoffTestFieldErrorCatch_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "caught"
          },
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "useRelayHandoffTestFieldErrorThrow_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "thrown"
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useRelayHandoffTestFieldErrorQuery",
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
            "fragment": require('./useRelayHandoffTestFieldErrorCatch_user$normalization.graphql'),
            "kind": "FragmentSpread"
          },
          {
            "fragment": require('./useRelayHandoffTestFieldErrorThrow_user$normalization.graphql'),
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
    "cacheID": "ebe0e1dc0e29df644ac07a72516d294c",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestFieldErrorQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestFieldErrorQuery {\n  me {\n    ...useRelayHandoffTestFieldErrorCatch_user\n    ...useRelayHandoffTestFieldErrorThrow_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestFieldErrorCatch_user on User {\n  lastName\n}\n\nfragment useRelayHandoffTestFieldErrorThrow_user on User {\n  lastName\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestFieldErrorCatch_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestFieldErrorCatch_user.graphql')
      },
      {
        "normalization": require('./useRelayHandoffTestFieldErrorThrow_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestFieldErrorThrow_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "667390c2cbb69bc6b2904d69cec246fb";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestFieldErrorQuery$variables,
  useRelayHandoffTestFieldErrorQuery$data,
>*/);
