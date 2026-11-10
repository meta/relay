/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c4865d27fc09e82d6c6fdda7ab513449>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { DataID } from "relay-runtime";
import type { ExecTimeS2CThingsResolver_RootFragment$key } from "./../resolvers/__generated__/ExecTimeS2CThingsResolver_RootFragment.graphql";
import {exec_time_s2c_things as queryExecTimeS2cThingsResolverType} from "../resolvers/ExecTimeS2CThingsResolver.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryExecTimeS2cThingsResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryExecTimeS2cThingsResolverType as (
  rootKey: ExecTimeS2CThingsResolver_RootFragment$key,
  args: {
    ids: ReadonlyArray<string>,
  },
  context: TestResolverContextType,
) => ?ReadonlyArray<?{
  readonly __typename: "Page" | "User",
  readonly id: DataID,
}>);
export type DataCheckerExecTimeS2CTestThingsQuery$variables = {
  ids: ReadonlyArray<string>,
};
export type DataCheckerExecTimeS2CTestThingsQuery$data = {
  readonly exec_time_s2c_things: ?ReadonlyArray<?{
    readonly id: string,
  }>,
};
export type DataCheckerExecTimeS2CTestThingsQuery = {
  response: DataCheckerExecTimeS2CTestThingsQuery$data,
  variables: DataCheckerExecTimeS2CTestThingsQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "ids"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "ids",
    "variableName": "ids"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": {
      "hasClientEdges": true
    },
    "name": "DataCheckerExecTimeS2CTestThingsQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "concreteType": null,
        "modelResolvers": {},
        "serverObjectOperations": null,
        "backingField": {
          "alias": null,
          "args": (v1/*:: as any*/),
          "fragment": {
            "args": (v1/*:: as any*/),
            "kind": "FragmentSpread",
            "name": "ExecTimeS2CThingsResolver_RootFragment"
          },
          "kind": "RelayResolver",
          "name": "exec_time_s2c_things",
          "resolverModule": require('../resolvers/ExecTimeS2CThingsResolver').exec_time_s2c_things,
          "path": "exec_time_s2c_things"
        },
        "linkedField": {
          "alias": null,
          "args": (v1/*:: as any*/),
          "concreteType": null,
          "kind": "LinkedField",
          "name": "exec_time_s2c_things",
          "plural": true,
          "selections": [
            (v2/*:: as any*/)
          ],
          "storageKey": null
        }
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DataCheckerExecTimeS2CTestThingsQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "backingField": {
          "name": "exec_time_s2c_things",
          "args": (v1/*:: as any*/),
          "kind": "RelayResolver",
          "storageKey": null,
          "isOutputType": false,
          "resolverInfo": {
            "resolverFunction": require('../resolvers/ExecTimeS2CThingsResolver').exec_time_s2c_things,
            "rootFragment": require('../resolvers/__generated__/ExecTimeS2CThingsResolver_RootFragment$normalization.graphql')
          }
        },
        "linkedField": {
          "alias": null,
          "args": (v1/*:: as any*/),
          "concreteType": null,
          "kind": "LinkedField",
          "name": "exec_time_s2c_things",
          "plural": true,
          "selections": [
            (v3/*:: as any*/),
            (v2/*:: as any*/)
          ],
          "storageKey": null
        }
      },
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "c36b0564186fdaf3ed15582b31af71a6",
    "id": null,
    "metadata": {
      "server_variables": [
        "ids"
      ]
    },
    "name": "DataCheckerExecTimeS2CTestThingsQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestThingsQuery(\n  $ids: [ID!]!\n) {\n  ...ExecTimeS2CThingsResolver_RootFragment_3pY7A9\n  nodes(ids: $ids) {\n    id\n    __typename\n  }\n}\n\nfragment ExecTimeS2CThingsResolver_RootFragment_3pY7A9 on Query {\n  nodes(ids: $ids) {\n    id\n    __typename\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "c2e0e9b1b1d40fc601a478a1b1603350";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestThingsQuery$variables,
  DataCheckerExecTimeS2CTestThingsQuery$data,
>*/);
