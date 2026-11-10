/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<8fdcce7053f7bc85be92bf871850de95>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { ExecTimeS2CResolvers_ClientRootOuterFragment$key } from "./../resolvers/__generated__/ExecTimeS2CResolvers_ClientRootOuterFragment.graphql";
import type { ExecTimeS2CResolvers_IdentityFragment$key } from "./../resolvers/__generated__/ExecTimeS2CResolvers_IdentityFragment.graphql";
import {exec_time_s2c_client_root_outer as queryExecTimeS2cClientRootOuterResolverType} from "../resolvers/ExecTimeS2CResolvers.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryExecTimeS2cClientRootOuterResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryExecTimeS2cClientRootOuterResolverType as (
  rootKey: ExecTimeS2CResolvers_ClientRootOuterFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?string);
import {exec_time_s2c_identity as userExecTimeS2cIdentityResolverType} from "../resolvers/ExecTimeS2CResolvers.js";
// Type assertion validating that `userExecTimeS2cIdentityResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userExecTimeS2cIdentityResolverType as (
  rootKey: ExecTimeS2CResolvers_IdentityFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?string);
export type DataCheckerExecTimeS2CTestClientRootOuterQuery$variables = {};
export type DataCheckerExecTimeS2CTestClientRootOuterQuery$data = {
  readonly exec_time_s2c_client_root_outer: ?string,
  readonly me: ?{
    readonly exec_time_s2c_identity: ?string,
  },
};
export type DataCheckerExecTimeS2CTestClientRootOuterQuery = {
  response: DataCheckerExecTimeS2CTestClientRootOuterQuery$data,
  variables: DataCheckerExecTimeS2CTestClientRootOuterQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestClientRootOuterQuery",
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
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "fragment": {
          "args": null,
          "kind": "FragmentSpread",
          "name": "ExecTimeS2CResolvers_ClientRootOuterFragment"
        },
        "kind": "RelayResolver",
        "name": "exec_time_s2c_client_root_outer",
        "resolverModule": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_client_root_outer,
        "path": "exec_time_s2c_client_root_outer"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DataCheckerExecTimeS2CTestClientRootOuterQuery",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "name": "exec_time_s2c_client_root_outer",
        "args": null,
        "kind": "RelayResolver",
        "storageKey": null,
        "isOutputType": true,
        "resolverInfo": {
          "resolverFunction": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_client_root_outer,
          "rootFragment": require('../resolvers/__generated__/ExecTimeS2CResolvers_ClientRootOuterFragment$normalization.graphql')
        }
      }
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "ef20d648c8a6399a229e609b84e5c841",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestClientRootOuterQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestClientRootOuterQuery {\n  me {\n    ...ExecTimeS2CResolvers_IdentityFragment\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "bf07488c8eb816edbf45d4bfbedb0cfc";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestClientRootOuterQuery$variables,
  DataCheckerExecTimeS2CTestClientRootOuterQuery$data,
>*/);
