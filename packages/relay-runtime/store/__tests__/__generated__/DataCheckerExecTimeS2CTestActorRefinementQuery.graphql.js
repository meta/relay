/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<1ec077f74b2fa8b76c6e06fc77654bf8>>
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
export type DataCheckerExecTimeS2CTestActorRefinementQuery$variables = {
  id: string,
};
export type DataCheckerExecTimeS2CTestActorRefinementQuery$data = {
  readonly node: ?{
    readonly exec_time_s2c_identity?: ?string,
  },
};
export type DataCheckerExecTimeS2CTestActorRefinementQuery = {
  response: DataCheckerExecTimeS2CTestActorRefinementQuery$data,
  variables: DataCheckerExecTimeS2CTestActorRefinementQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestActorRefinementQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "kind": "InlineFragment",
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
                    "path": "node.exec_time_s2c_identity"
                  }
                ],
                "type": "User",
                "abstractKey": null
              }
            ],
            "type": "Actor",
            "abstractKey": "__isActor"
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
    "name": "DataCheckerExecTimeS2CTestActorRefinementQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                "kind": "InlineFragment",
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
                  }
                ],
                "type": "User",
                "abstractKey": null
              }
            ],
            "type": "Actor",
            "abstractKey": "__isActor"
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
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "0910ea68422f2d281743aa75d0e2370e",
    "id": null,
    "metadata": {
      "server_variables": [
        "id"
      ]
    },
    "name": "DataCheckerExecTimeS2CTestActorRefinementQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestActorRefinementQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Actor {\n      __isActor: __typename\n      ... on User {\n        ...ExecTimeS2CResolvers_IdentityFragment\n      }\n    }\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "938acb3e59a2e2bc6e77d749de9677d5";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestActorRefinementQuery$variables,
  DataCheckerExecTimeS2CTestActorRefinementQuery$data,
>*/);
