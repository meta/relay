/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<fe992075ace27f878abfe1ed3f2f6f9d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { ExecTimeS2CResolvers_ActorNameFragment$key } from "./../resolvers/__generated__/ExecTimeS2CResolvers_ActorNameFragment.graphql";
import {exec_time_s2c_actor_name as userExecTimeS2cActorNameResolverType} from "../resolvers/ExecTimeS2CResolvers.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `userExecTimeS2cActorNameResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userExecTimeS2cActorNameResolverType as (
  rootKey: ExecTimeS2CResolvers_ActorNameFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?string);
export type DataCheckerExecTimeS2CTestActorNameQuery$variables = {};
export type DataCheckerExecTimeS2CTestActorNameQuery$data = {
  readonly me: ?{
    readonly exec_time_s2c_actor_name: ?string,
  },
};
export type DataCheckerExecTimeS2CTestActorNameQuery = {
  response: DataCheckerExecTimeS2CTestActorNameQuery$data,
  variables: DataCheckerExecTimeS2CTestActorNameQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestActorNameQuery",
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
              "name": "ExecTimeS2CResolvers_ActorNameFragment"
            },
            "kind": "RelayResolver",
            "name": "exec_time_s2c_actor_name",
            "resolverModule": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_actor_name,
            "path": "me.exec_time_s2c_actor_name"
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
    "name": "DataCheckerExecTimeS2CTestActorNameQuery",
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
            "name": "exec_time_s2c_actor_name",
            "args": null,
            "kind": "RelayResolver",
            "storageKey": null,
            "isOutputType": true,
            "resolverInfo": {
              "resolverFunction": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_actor_name,
              "rootFragment": require('../resolvers/__generated__/ExecTimeS2CResolvers_ActorNameFragment$normalization.graphql')
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
    "cacheID": "de312bbcae6273e332c2276056ddb074",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestActorNameQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestActorNameQuery {\n  me {\n    ...ExecTimeS2CResolvers_ActorNameFragment\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_ActorNameFragment on User {\n  id\n  ... on Actor {\n    __isActor: __typename\n    name\n  }\n}\n"
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "62b08183c8eee8781ab05e98025d49ab";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestActorNameQuery$variables,
  DataCheckerExecTimeS2CTestActorNameQuery$data,
>*/);
