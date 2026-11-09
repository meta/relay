/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a2c559f3b768736e9c4fac093f09ade2>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestArgs_user$fragmentType } from "./RelayServerHandoffTestArgs_user.graphql";
import type { RelayServerHandoffTestClient_user$fragmentType } from "./RelayServerHandoffTestClient_user.graphql";
import type { RelayServerHandoffTestDeferred_user$fragmentType } from "./RelayServerHandoffTestDeferred_user.graphql";
import type { RelayServerHandoffTestServer_user$fragmentType } from "./RelayServerHandoffTestServer_user.graphql";
export type RelayServerHandoffTestQuery$variables = {
  secret: boolean,
  size?: ?ReadonlyArray<?number>,
};
export type RelayServerHandoffTestQuery$data = {
  readonly me: ?{
    readonly $serverFragment: true,
    readonly args: {
      readonly $fragmentSpreads: RelayServerHandoffTestArgs_user$fragmentType,
    },
    readonly client: {
      readonly $fragmentSpreads: RelayServerHandoffTestClient_user$fragmentType,
    },
    readonly deferred: {
      readonly $fragmentSpreads: RelayServerHandoffTestDeferred_user$fragmentType,
    },
    readonly friends: ?{
      readonly edges: ?ReadonlyArray<?{
        readonly node: ?{
          readonly client: {
            readonly $fragmentSpreads: RelayServerHandoffTestClient_user$fragmentType,
          },
        },
      }>,
    },
    readonly name: ?string,
    readonly username?: ?string,
    readonly $fragmentSpreads: RelayServerHandoffTestServer_user$fragmentType,
  },
};
export type RelayServerHandoffTestQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestQuery$data,
  variables: RelayServerHandoffTestQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "secret"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "size"
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "condition": "secret",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "username",
      "storageKey": null
    }
  ]
},
v4 = {
  "fragment": {
    "kind": "InlineFragment",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "RelayServerHandoffTestClient_user"
      }
    ],
    "type": "User",
    "abstractKey": null
  },
  "kind": "AliasedInlineFragmentSpread",
  "name": "client"
},
v5 = [
  2
],
v6 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 3
  }
],
v7 = {
  "fragment": require('./RelayServerHandoffTestClient_user$normalization.graphql'),
  "kind": "FragmentSpread"
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": [
                    {
                      "kind": "Literal",
                      "name": "scale",
                      "value": (v5/*:: as any*/)
                    }
                  ],
                  "kind": "FragmentSpread",
                  "name": "RelayServerHandoffTestArgs_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "args"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayServerHandoffTestServer_user"
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
          },
          {
            "alias": null,
            "args": (v6/*:: as any*/),
            "concreteType": "FriendsConnection",
            "kind": "LinkedField",
            "name": "friends",
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
                      (v4/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "friends(first:3)"
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "RelayServerHandoffTestQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v7/*:: as any*/),
          {
            "args": [
              {
                "kind": "Literal",
                "name": "RelayServerHandoffTestArgs_user$scale",
                "value": (v5/*:: as any*/)
              }
            ],
            "fragment": require('./RelayServerHandoffTestArgs_user$normalization.graphql'),
            "kind": "FragmentSpread"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "alternate_name",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "firstName",
            "storageKey": null
          },
          (v7/*:: as any*/),
          {
            "if": null,
            "kind": "Defer",
            "label": "RelayServerHandoffTestQuery$defer$deferred",
            "selections": [
              {
                "fragment": require('./RelayServerHandoffTestDeferred_user$normalization.graphql'),
                "kind": "FragmentSpread"
              }
            ]
          },
          {
            "alias": null,
            "args": (v6/*:: as any*/),
            "concreteType": "FriendsConnection",
            "kind": "LinkedField",
            "name": "friends",
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
                      (v7/*:: as any*/),
                      (v8/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "friends(first:3)"
          },
          (v8/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "34da7b96b5339de2949083d087873ccd",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestQuery(\n  $size: [Int]\n  $secret: Boolean!\n) {\n  me {\n    name\n    username @include(if: $secret)\n    ...RelayServerHandoffTestClient_user\n    ...RelayServerHandoffTestArgs_user_ShfEa\n    ...RelayServerHandoffTestServer_user\n    ...RelayServerHandoffTestDeferred_user @defer(label: \"RelayServerHandoffTestQuery$defer$deferred\")\n    friends(first: 3) {\n      edges {\n        node {\n          ...RelayServerHandoffTestClient_user\n          id\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment RelayServerHandoffTestArgs_user_ShfEa on User {\n  scaled: profilePicture(size: [2]) {\n    uri\n  }\n}\n\nfragment RelayServerHandoffTestClient_user on User {\n  lastName\n  profilePicture(size: $size) {\n    uri\n  }\n}\n\nfragment RelayServerHandoffTestDeferred_user on User {\n  emailAddresses\n}\n\nfragment RelayServerHandoffTestInline_user on User {\n  firstName\n}\n\nfragment RelayServerHandoffTestServer_user on User {\n  alternate_name\n  ...RelayServerHandoffTestInline_user\n  ...RelayServerHandoffTestClient_user\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestArgs_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestArgs_user.graphql')
      },
      {
        "normalization": require('./RelayServerHandoffTestClient_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestClient_user.graphql'),
        "rootVariables": [
          "size"
        ]
      },
      {
        "normalization": require('./RelayServerHandoffTestDeferred_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestDeferred_user.graphql')
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "39f4de9595bc665600f03a86481600a2";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestQuery$variables,
  RelayServerHandoffTestQuery$data,
>*/);
