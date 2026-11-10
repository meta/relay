/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2e26600a70532cbae3f77e87a8f64f82>>
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
export type DataCheckerExecTimeS2CTestScalarQuery$variables = {};
export type DataCheckerExecTimeS2CTestScalarQuery$data = {
  readonly me: ?{
    readonly exec_time_s2c_identity: ?string,
  },
};
export type DataCheckerExecTimeS2CTestScalarQuery = {
  response: DataCheckerExecTimeS2CTestScalarQuery$data,
  variables: DataCheckerExecTimeS2CTestScalarQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestScalarQuery",
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
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DataCheckerExecTimeS2CTestScalarQuery",
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
      }
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "4bda9f27d450c70401ada89f74b477b8",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestScalarQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestScalarQuery {\n  me {\n    ...ExecTimeS2CResolvers_IdentityFragment\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "8fb95b0981b47fde72674685ead90520";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestScalarQuery$variables,
  DataCheckerExecTimeS2CTestScalarQuery$data,
>*/);
