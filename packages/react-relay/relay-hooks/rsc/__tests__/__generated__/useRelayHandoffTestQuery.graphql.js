/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7c4e0357a3728e3e0b7458aeef03ca49>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestCard_user$fragmentType } from "./useRelayHandoffTestCard_user.graphql";
import type { useRelayHandoffTestDeferred_user$fragmentType } from "./useRelayHandoffTestDeferred_user.graphql";
import type { useRelayHandoffTestFriends_user$fragmentType } from "./useRelayHandoffTestFriends_user.graphql";
export type useRelayHandoffTestQuery$variables = {
  size?: ?ReadonlyArray<?number>,
};
export type useRelayHandoffTestQuery$data = {
  readonly me: ?{
    readonly card: {
      readonly $fragmentSpreads: useRelayHandoffTestCard_user$fragmentType,
    },
    readonly deferred: {
      readonly $fragmentSpreads: useRelayHandoffTestDeferred_user$fragmentType,
    },
    readonly friends: {
      readonly $fragmentSpreads: useRelayHandoffTestFriends_user$fragmentType,
    },
    readonly name: ?string,
  },
};
export type useRelayHandoffTestQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestQuery$data,
  variables: useRelayHandoffTestQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "size"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "useRelayHandoffTestCard_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "card"
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
                      "name": "useRelayHandoffTestDeferred_user"
                    }
                  ]
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "deferred"
          },
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "useRelayHandoffTestFriends_user"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useRelayHandoffTestQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "fragment": require('./useRelayHandoffTestCard_user$normalization.graphql'),
            "kind": "FragmentSpread"
          },
          {
            "if": null,
            "kind": "Defer",
            "label": "useRelayHandoffTestQuery$defer$deferred",
            "selections": [
              {
                "fragment": require('./useRelayHandoffTestDeferred_user$normalization.graphql'),
                "kind": "FragmentSpread"
              }
            ]
          },
          {
            "fragment": require('./useRelayHandoffTestFriends_user$normalization.graphql'),
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
    "cacheID": "083ac34c3053184fd35f60d56906f5b2",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestQuery(\n  $size: [Int]\n) {\n  me {\n    name\n    ...useRelayHandoffTestCard_user\n    ...useRelayHandoffTestDeferred_user @defer(label: \"useRelayHandoffTestQuery$defer$deferred\")\n    ...useRelayHandoffTestFriends_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestCard_user on User {\n  lastName\n  profilePicture(size: $size) {\n    uri\n  }\n}\n\nfragment useRelayHandoffTestDeferred_user on User {\n  emailAddresses\n}\n\nfragment useRelayHandoffTestFriends_user on User {\n  friends(first: 1) {\n    edges {\n      node {\n        name\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestCard_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestCard_user.graphql'),
        "rootVariables": [
          "size"
        ]
      },
      {
        "normalization": require('./useRelayHandoffTestDeferred_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestDeferred_user.graphql')
      },
      {
        "normalization": require('./useRelayHandoffTestFriends_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestFriends_user.graphql')
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "02dd51b74bbc4540b7bb00798b53e4a6";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestQuery$variables,
  useRelayHandoffTestQuery$data,
>*/);
