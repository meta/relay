/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a254e385b3f3e17145f0220b0bf90d27>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestDeferred_user$fragmentType } from "./RelayServerHandoffTestDeferred_user.graphql";
import type { RelayServerHandoffTestStreamConnection_user$fragmentType } from "./RelayServerHandoffTestStreamConnection_user.graphql";
export type RelayServerHandoffTestStreamConnectionQuery$variables = {};
export type RelayServerHandoffTestStreamConnectionQuery$data = {
  readonly me: ?{
    readonly client: {
      readonly $fragmentSpreads: RelayServerHandoffTestStreamConnection_user$fragmentType,
    },
    readonly deferred: {
      readonly $fragmentSpreads: RelayServerHandoffTestDeferred_user$fragmentType,
    },
  },
};
export type RelayServerHandoffTestStreamConnectionQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestStreamConnectionQuery$data,
  variables: RelayServerHandoffTestStreamConnectionQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestStreamConnectionQuery",
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
                  "name": "RelayServerHandoffTestStreamConnection_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "client"
          },
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "kind": "Defer",
                  "selections": [
                    {
                      "args": null,
                      "kind": "FragmentSpread",
                      "name": "RelayServerHandoffTestDeferred_user"
                    }
                  ]
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "deferred"
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
    "name": "RelayServerHandoffTestStreamConnectionQuery",
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
            "fragment": require('./RelayServerHandoffTestStreamConnection_user$normalization.graphql'),
            "kind": "FragmentSpread"
          },
          {
            "if": null,
            "kind": "Defer",
            "label": "RelayServerHandoffTestStreamConnectionQuery$defer$connectionDeferred",
            "selections": [
              {
                "fragment": require('./RelayServerHandoffTestDeferred_user$normalization.graphql'),
                "kind": "FragmentSpread"
              }
            ]
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
    "cacheID": "c06e88da68b5dbdae60075711db0364c",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestStreamConnectionQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestStreamConnectionQuery {\n  me {\n    ...RelayServerHandoffTestStreamConnection_user\n    ...RelayServerHandoffTestDeferred_user @defer(label: \"RelayServerHandoffTestStreamConnectionQuery$defer$connectionDeferred\")\n    id\n  }\n}\n\nfragment RelayServerHandoffTestDeferred_user on User {\n  emailAddresses\n}\n\nfragment RelayServerHandoffTestStreamConnection_user on User {\n  friends(first: 100) {\n    edges @stream(label: \"RelayServerHandoffTestStreamConnection_user$stream$edges\", initial_count: 1) {\n      node {\n        name\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestDeferred_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestDeferred_user.graphql')
      },
      {
        "normalization": require('./RelayServerHandoffTestStreamConnection_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestStreamConnection_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "9fe622bf4f29743af5b66b59b9499dec";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestStreamConnectionQuery$variables,
  RelayServerHandoffTestStreamConnectionQuery$data,
>*/);
