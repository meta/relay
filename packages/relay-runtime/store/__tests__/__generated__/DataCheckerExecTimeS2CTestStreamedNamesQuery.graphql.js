/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<19956a3d08e4f9d58691a7297319a0ee>>
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
export type DataCheckerExecTimeS2CTestStreamedNamesQuery$variables = {
  ids?: ?ReadonlyArray<string>,
};
export type DataCheckerExecTimeS2CTestStreamedNamesQuery$data = {
  readonly me: ?{
    readonly exec_time_s2c_identity: ?string,
  },
  readonly nodes: ?ReadonlyArray<?{
    readonly name: ?string,
  }>,
};
export type DataCheckerExecTimeS2CTestStreamedNamesQuery = {
  response: DataCheckerExecTimeS2CTestStreamedNamesQuery$data,
  variables: DataCheckerExecTimeS2CTestStreamedNamesQuery$variables,
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
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestStreamedNamesQuery",
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
        "kind": "Stream",
        "selections": [
          {
            "alias": null,
            "args": (v1/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nodes",
            "plural": true,
            "selections": [
              (v2/*:: as any*/)
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DataCheckerExecTimeS2CTestStreamedNamesQuery",
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
          (v3/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "if": null,
        "kind": "Stream",
        "label": "DataCheckerExecTimeS2CTestStreamedNamesQuery$stream$DataCheckerExecTimeS2CTestStreamedNames",
        "selections": [
          {
            "alias": null,
            "args": (v1/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nodes",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              (v2/*:: as any*/),
              (v3/*:: as any*/)
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "b8d85970de3dc615735827d9997693fb",
    "id": null,
    "metadata": {
      "server_variables": [
        "ids"
      ]
    },
    "name": "DataCheckerExecTimeS2CTestStreamedNamesQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestStreamedNamesQuery(\n  $ids: [ID!]\n) {\n  me {\n    ...ExecTimeS2CResolvers_IdentityFragment\n    id\n  }\n  nodes(ids: $ids) @stream(label: \"DataCheckerExecTimeS2CTestStreamedNamesQuery$stream$DataCheckerExecTimeS2CTestStreamedNames\", initial_count: 0) {\n    __typename\n    name\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "0bda5724896540e589580b6b462475ac";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestStreamedNamesQuery$variables,
  DataCheckerExecTimeS2CTestStreamedNamesQuery$data,
>*/);
