/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<f1d4b1b524677854f0c07724daf19437>>
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
export type DataCheckerExecTimeS2CTestAbstractQuery$variables = {
  id: string,
};
export type DataCheckerExecTimeS2CTestAbstractQuery$data = {
  readonly node: ?{
    readonly exec_time_s2c_identity?: ?string,
    readonly name?: ?string,
  },
};
export type DataCheckerExecTimeS2CTestAbstractQuery = {
  response: DataCheckerExecTimeS2CTestAbstractQuery$data,
  variables: DataCheckerExecTimeS2CTestAbstractQuery$variables,
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
],
v2 = {
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
    "name": "DataCheckerExecTimeS2CTestAbstractQuery",
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
              (v2/*:: as any*/),
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
            "type": "Named",
            "abstractKey": "__isNamed"
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
    "name": "DataCheckerExecTimeS2CTestAbstractQuery",
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
              (v2/*:: as any*/),
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
            "type": "Named",
            "abstractKey": "__isNamed"
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
    "cacheID": "9bd84b9f1e678df9eb04ba9605cb2853",
    "id": null,
    "metadata": {
      "server_variables": [
        "id"
      ]
    },
    "name": "DataCheckerExecTimeS2CTestAbstractQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestAbstractQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Named {\n      __isNamed: __typename\n      name\n      ... on User {\n        ...ExecTimeS2CResolvers_IdentityFragment\n      }\n    }\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "c34e91a62b4c085951ff8e5acd29dc63";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestAbstractQuery$variables,
  DataCheckerExecTimeS2CTestAbstractQuery$data,
>*/);
