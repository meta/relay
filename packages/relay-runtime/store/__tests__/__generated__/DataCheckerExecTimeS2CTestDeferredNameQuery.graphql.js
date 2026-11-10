/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<48e66ba7c646e6955729358df128848e>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { DataCheckerExecTimeS2CTestDeferredNameFragment$fragmentType } from "./DataCheckerExecTimeS2CTestDeferredNameFragment.graphql";
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
export type DataCheckerExecTimeS2CTestDeferredNameQuery$variables = {};
export type DataCheckerExecTimeS2CTestDeferredNameQuery$data = {
  readonly me: ?{
    readonly exec_time_s2c_identity: ?string,
    readonly $fragmentSpreads: DataCheckerExecTimeS2CTestDeferredNameFragment$fragmentType,
  },
};
export type DataCheckerExecTimeS2CTestDeferredNameQuery = {
  response: DataCheckerExecTimeS2CTestDeferredNameQuery$data,
  variables: DataCheckerExecTimeS2CTestDeferredNameQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestDeferredNameQuery",
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
          },
          {
            "kind": "Defer",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DataCheckerExecTimeS2CTestDeferredNameFragment"
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DataCheckerExecTimeS2CTestDeferredNameQuery",
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
            "if": null,
            "kind": "Defer",
            "label": "DataCheckerExecTimeS2CTestDeferredNameQuery$defer$DataCheckerExecTimeS2CTestDeferredName",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
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
    "cacheID": "8566fe665f012a59236e72796fc29d3d",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestDeferredNameQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestDeferredNameQuery {\n  me {\n    ...ExecTimeS2CResolvers_IdentityFragment\n    ...DataCheckerExecTimeS2CTestDeferredNameFragment @defer(label: \"DataCheckerExecTimeS2CTestDeferredNameQuery$defer$DataCheckerExecTimeS2CTestDeferredName\")\n    id\n  }\n}\n\nfragment DataCheckerExecTimeS2CTestDeferredNameFragment on User {\n  name\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "93237873ebfd0cb16f81c6feb1916430";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestDeferredNameQuery$variables,
  DataCheckerExecTimeS2CTestDeferredNameQuery$data,
>*/);
