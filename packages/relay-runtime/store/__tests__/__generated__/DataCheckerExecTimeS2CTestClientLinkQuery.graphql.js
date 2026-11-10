/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<0511d3086ac50465a6e09c54b8dd6dea>>
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
export type DataCheckerExecTimeS2CTestClientLinkQuery$variables = {};
export type DataCheckerExecTimeS2CTestClientLinkQuery$data = {
  readonly me: ?{
    readonly client_best_friend: ?{
      readonly exec_time_s2c_identity: ?string,
    },
  },
};
export type DataCheckerExecTimeS2CTestClientLinkQuery = {
  response: DataCheckerExecTimeS2CTestClientLinkQuery$data,
  variables: DataCheckerExecTimeS2CTestClientLinkQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestClientLinkQuery",
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
            "kind": "ClientExtension",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "client_best_friend",
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
                    "path": "me.client_best_friend.exec_time_s2c_identity"
                  }
                ],
                "storageKey": null
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
    "name": "DataCheckerExecTimeS2CTestClientLinkQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v0/*:: as any*/),
          {
            "kind": "ClientExtension",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "client_best_friend",
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
                  (v0/*:: as any*/)
                ],
                "storageKey": null
              }
            ]
          }
        ],
        "storageKey": null
      }
    ],
    "use_exec_time_resolvers": true,
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "b98c10c134ad534fe4ab00853b61235d",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestClientLinkQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestClientLinkQuery {\n  me {\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "219a4bed4b89550fd001bd04e271ac8e";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestClientLinkQuery$variables,
  DataCheckerExecTimeS2CTestClientLinkQuery$data,
>*/);
