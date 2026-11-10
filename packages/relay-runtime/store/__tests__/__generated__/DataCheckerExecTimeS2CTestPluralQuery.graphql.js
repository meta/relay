/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<9477b856602817fcd1bd06c9717d4791>>
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
export type DataCheckerExecTimeS2CTestPluralQuery$variables = {
  ids?: ?ReadonlyArray<string>,
};
export type DataCheckerExecTimeS2CTestPluralQuery$data = {
  readonly nodes: ?ReadonlyArray<?{
    readonly exec_time_s2c_identity?: ?string,
  }>,
};
export type DataCheckerExecTimeS2CTestPluralQuery = {
  response: DataCheckerExecTimeS2CTestPluralQuery$data,
  variables: DataCheckerExecTimeS2CTestPluralQuery$variables,
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestPluralQuery",
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
                "path": "nodes.exec_time_s2c_identity"
              }
            ],
            "type": "User",
            "abstractKey": null
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
    "name": "DataCheckerExecTimeS2CTestPluralQuery",
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
    "cacheID": "40d59b987afa97aa329c53b51932fbf7",
    "id": null,
    "metadata": {
      "server_variables": [
        "ids"
      ]
    },
    "name": "DataCheckerExecTimeS2CTestPluralQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestPluralQuery(\n  $ids: [ID!]\n) {\n  nodes(ids: $ids) {\n    __typename\n    ... on User {\n      ...ExecTimeS2CResolvers_IdentityFragment\n    }\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "b6f04bbf7555838c4c722b28d276bc3f";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestPluralQuery$variables,
  DataCheckerExecTimeS2CTestPluralQuery$data,
>*/);
