/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2da404e2584a442877bb66eeeebd9427>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { ExecTimeS2CResolvers_KeyedFragment$key } from "./../resolvers/__generated__/ExecTimeS2CResolvers_KeyedFragment.graphql";
import {exec_time_s2c_keyed as userExecTimeS2cKeyedResolverType} from "../resolvers/ExecTimeS2CResolvers.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `userExecTimeS2cKeyedResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userExecTimeS2cKeyedResolverType as (
  rootKey: ExecTimeS2CResolvers_KeyedFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?string);
export type DataCheckerExecTimeS2CTestKeyedQuery$variables = {};
export type DataCheckerExecTimeS2CTestKeyedQuery$data = {
  readonly me: ?{
    readonly exec_time_s2c_keyed: ?string,
  },
};
export type DataCheckerExecTimeS2CTestKeyedQuery = {
  response: DataCheckerExecTimeS2CTestKeyedQuery$data,
  variables: DataCheckerExecTimeS2CTestKeyedQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestKeyedQuery",
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
              "name": "ExecTimeS2CResolvers_KeyedFragment"
            },
            "kind": "RelayResolver",
            "name": "exec_time_s2c_keyed",
            "resolverModule": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_keyed,
            "path": "me.exec_time_s2c_keyed"
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
    "name": "DataCheckerExecTimeS2CTestKeyedQuery",
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
            "name": "exec_time_s2c_keyed",
            "args": null,
            "kind": "RelayResolver",
            "storageKey": null,
            "isOutputType": true,
            "resolverInfo": {
              "resolverFunction": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_keyed,
              "rootFragment": require('../resolvers/__generated__/ExecTimeS2CResolvers_KeyedFragment$normalization.graphql')
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
    "cacheID": "6b0fb00b1c383bf3d2548dbd57fc779b",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestKeyedQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestKeyedQuery {\n  me {\n    ...ExecTimeS2CResolvers_KeyedFragment\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_KeyedFragment on User {\n  id\n  alternate_name\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "88031b63c35e22c486ee013982d8f395";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestKeyedQuery$variables,
  DataCheckerExecTimeS2CTestKeyedQuery$data,
>*/);
