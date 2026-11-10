/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<9e3b6de3f51a772a0132744591273a8f>>
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
export type DataCheckerExecTimeS2CTestConditionQuery$variables = {
  withS2C: boolean,
};
export type DataCheckerExecTimeS2CTestConditionQuery$data = {
  readonly me: ?{
    readonly exec_time_s2c_identity?: ?string,
    readonly name: ?string,
  },
};
export type DataCheckerExecTimeS2CTestConditionQuery = {
  response: DataCheckerExecTimeS2CTestConditionQuery$data,
  variables: DataCheckerExecTimeS2CTestConditionQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "withS2C"
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
    "name": "DataCheckerExecTimeS2CTestConditionQuery",
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
            "condition": "withS2C",
            "kind": "Condition",
            "passingValue": true,
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
                "path": "me.exec_time_s2c_identity"
              }
            ]
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
    "name": "DataCheckerExecTimeS2CTestConditionQuery",
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
            "condition": "withS2C",
            "kind": "Condition",
            "passingValue": true,
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
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "125a736e0f5a7adfc0ce8813b74be36d",
    "id": null,
    "metadata": {
      "server_variables": [
        "withS2C"
      ]
    },
    "name": "DataCheckerExecTimeS2CTestConditionQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestConditionQuery(\n  $withS2C: Boolean!\n) {\n  me {\n    name\n    ...ExecTimeS2CResolvers_IdentityFragment @include(if: $withS2C)\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "1155fa614bd9c36207aea0f28a0d5edd";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestConditionQuery$variables,
  DataCheckerExecTimeS2CTestConditionQuery$data,
>*/);
