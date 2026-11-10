/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<56aa33224d672fab3355b11bc189d7c3>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { ExecTimeS2CResolvers_IdentityFragment$key } from "./../resolvers/__generated__/ExecTimeS2CResolvers_IdentityFragment.graphql";
import {exec_time_s2c_identity as userExecTimeS2cIdentityResolverType} from "../resolvers/ExecTimeS2CResolvers.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `userExecTimeS2cIdentityResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userExecTimeS2cIdentityResolverType as (
  rootKey: ExecTimeS2CResolvers_IdentityFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?string);
export type DataCheckerExecTimeS2CTestConnectionQuery$variables = {};
export type DataCheckerExecTimeS2CTestConnectionQuery$data = {
  readonly me: ?{
    readonly friends: ?{
      readonly edges: ?ReadonlyArray<?{
        readonly node: ?{
          readonly exec_time_s2c_identity: ?string,
        },
      }>,
    },
  },
};
export type DataCheckerExecTimeS2CTestConnectionQuery = {
  response: DataCheckerExecTimeS2CTestConnectionQuery$data,
  variables: DataCheckerExecTimeS2CTestConnectionQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
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
  "name": "cursor",
  "storageKey": null
},
v2 = {
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
},
v3 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 1
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestConnectionQuery",
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
            "alias": "friends",
            "args": null,
            "concreteType": "FriendsConnection",
            "kind": "LinkedField",
            "name": "__DataCheckerExecTimeS2CTest_friends_connection",
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
                        "fragment": {
                          "args": null,
                          "kind": "FragmentSpread",
                          "name": "ExecTimeS2CResolvers_IdentityFragment"
                        },
                        "kind": "RelayResolver",
                        "name": "exec_time_s2c_identity",
                        "resolverModule": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_identity,
                        "path": "me.friends.edges.node.exec_time_s2c_identity"
                      },
                      (v0/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v1/*:: as any*/)
                ],
                "storageKey": null
              },
              (v2/*:: as any*/)
            ],
            "storageKey": null
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
    "name": "DataCheckerExecTimeS2CTestConnectionQuery",
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
            "alias": null,
            "args": (v3/*:: as any*/),
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
                      {
                        "name": "exec_time_s2c_identity",
                        "args": null,
                        "kind": "RelayResolver",
                        "storageKey": null,
                        "isOutputType": true,
                        "resolverInfo": {
                          "resolverFunction": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_identity,
                          "rootFragment": require('../resolvers/__generated__/ExecTimeS2CResolvers_IdentityFragment$normalization.graphql')
                        }
                      },
                      (v4/*:: as any*/),
                      (v0/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v1/*:: as any*/)
                ],
                "storageKey": null
              },
              (v2/*:: as any*/)
            ],
            "storageKey": "friends(first:1)"
          },
          {
            "alias": null,
            "args": (v3/*:: as any*/),
            "filters": null,
            "handle": "connection",
            "key": "DataCheckerExecTimeS2CTest_friends",
            "kind": "LinkedHandle",
            "name": "friends"
          },
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "30916c0c27963c17c98211b3065347dd",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "me",
            "friends"
          ]
        }
      ],
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestConnectionQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestConnectionQuery {\n  me {\n    friends(first: 1) {\n      edges {\n        node {\n          ...ExecTimeS2CResolvers_IdentityFragment\n          id\n          __typename\n        }\n        cursor\n      }\n      pageInfo {\n        endCursor\n        hasNextPage\n      }\n    }\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "dc4f39ee949aef40d5fe07a6249bfb88";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestConnectionQuery$variables,
  DataCheckerExecTimeS2CTestConnectionQuery$data,
>*/);
