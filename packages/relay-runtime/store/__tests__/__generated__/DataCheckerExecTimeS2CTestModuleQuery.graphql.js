/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<106aeef9da5ab55d740444d11b819fe3>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency DataCheckerExecTimeS2CTestModuleQuery.me.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"DataCheckerExecTimeS2CTestPlainUserNameRenderer_name$normalization.graphql"}},"plural":false}

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { DataCheckerExecTimeS2CTestPlainUserNameRenderer_name$fragmentType } from "./DataCheckerExecTimeS2CTestPlainUserNameRenderer_name.graphql";
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
export type DataCheckerExecTimeS2CTestModuleQuery$variables = {};
export type DataCheckerExecTimeS2CTestModuleQuery$data = {
  readonly me: ?{
    readonly exec_time_s2c_identity: ?string,
    readonly nameRenderer: ?{
      readonly __fragmentPropName?: ?string,
      readonly __module_component?: ?string,
      readonly $fragmentSpreads: DataCheckerExecTimeS2CTestPlainUserNameRenderer_name$fragmentType,
    },
  },
};
export type DataCheckerExecTimeS2CTestModuleQuery = {
  response: DataCheckerExecTimeS2CTestModuleQuery$data,
  variables: DataCheckerExecTimeS2CTestModuleQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "supported",
    "value": "1AwQS7"
  }
],
v1 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "args": null,
      "documentName": "DataCheckerExecTimeS2CTestModuleQuery",
      "fragmentName": "DataCheckerExecTimeS2CTestPlainUserNameRenderer_name",
      "fragmentPropName": "name",
      "kind": "ModuleImport"
    }
  ],
  "type": "PlainUserNameRenderer",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestModuleQuery",
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
            "alias": null,
            "args": (v0/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
            "plural": false,
            "selections": [
              (v1/*:: as any*/)
            ],
            "storageKey": "nameRenderer(supported:\"1AwQS7\")"
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
    "name": "DataCheckerExecTimeS2CTestModuleQuery",
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
            "args": (v0/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              (v1/*:: as any*/)
            ],
            "storageKey": "nameRenderer(supported:\"1AwQS7\")"
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
    "cacheID": "f2748938d37c092b3b7ebbabc24288fe",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestModuleQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestModuleQuery {\n  me {\n    ...ExecTimeS2CResolvers_IdentityFragment\n    nameRenderer(supported: [\"PlainUserNameRenderer\"]) {\n      __typename\n      ... on PlainUserNameRenderer {\n        ...DataCheckerExecTimeS2CTestPlainUserNameRenderer_name\n        __module_operation_DataCheckerExecTimeS2CTestModuleQuery: js(module: \"DataCheckerExecTimeS2CTestPlainUserNameRenderer_name$normalization.graphql\", id: \"DataCheckerExecTimeS2CTestModuleQuery.me.nameRenderer\")\n        __module_component_DataCheckerExecTimeS2CTestModuleQuery: js(module: \"PlainUserNameRenderer.react\", id: \"DataCheckerExecTimeS2CTestModuleQuery.me.nameRenderer\")\n      }\n    }\n    id\n  }\n}\n\nfragment DataCheckerExecTimeS2CTestPlainUserNameRenderer_name on PlainUserNameRenderer {\n  plaintext\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "cd66a999510f56059e91f1aa982604b7";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestModuleQuery$variables,
  DataCheckerExecTimeS2CTestModuleQuery$data,
>*/);
