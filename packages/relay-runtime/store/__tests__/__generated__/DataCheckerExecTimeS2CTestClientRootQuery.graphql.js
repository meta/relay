/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<0eab660c461fd36e3cc47e976ce3e19c>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { ExecTimeS2CResolvers_ClientRootFragment$key } from "./../resolvers/__generated__/ExecTimeS2CResolvers_ClientRootFragment.graphql";
import type { ExecTimeS2CResolvers_IdentityFragment$key } from "./../resolvers/__generated__/ExecTimeS2CResolvers_IdentityFragment.graphql";
import {exec_time_s2c_client_root as queryExecTimeS2cClientRootResolverType} from "../resolvers/ExecTimeS2CResolvers.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryExecTimeS2cClientRootResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryExecTimeS2cClientRootResolverType as (
  rootKey: ExecTimeS2CResolvers_ClientRootFragment$key,
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
export type DataCheckerExecTimeS2CTestClientRootQuery$variables = {};
export type DataCheckerExecTimeS2CTestClientRootQuery$data = {
  readonly exec_time_s2c_client_root: ?string,
  readonly me: ?{
    readonly exec_time_s2c_identity: ?string,
  },
};
export type DataCheckerExecTimeS2CTestClientRootQuery = {
  response: DataCheckerExecTimeS2CTestClientRootQuery$data,
  variables: DataCheckerExecTimeS2CTestClientRootQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestClientRootQuery",
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
          "name": "ExecTimeS2CResolvers_ClientRootFragment"
        },
        "kind": "RelayResolver",
        "name": "exec_time_s2c_client_root",
        "resolverModule": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_client_root,
        "path": "exec_time_s2c_client_root"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DataCheckerExecTimeS2CTestClientRootQuery",
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
        "name": "exec_time_s2c_client_root",
        "args": null,
        "kind": "RelayResolver",
        "storageKey": null,
        "isOutputType": true,
        "resolverInfo": {
          "resolverFunction": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_client_root,
          "rootFragment": require('../resolvers/__generated__/ExecTimeS2CResolvers_ClientRootFragment$normalization.graphql')
        }
      }
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "5fc85ef1989e6bc126f4e0b35eaee8f0",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestClientRootQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestClientRootQuery {\n  me {\n    ...ExecTimeS2CResolvers_IdentityFragment\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "059604dc99fbc7993e419ba47e032cf1";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestClientRootQuery$variables,
  DataCheckerExecTimeS2CTestClientRootQuery$data,
>*/);
