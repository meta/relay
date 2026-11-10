/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<9e7e145da05147fa5e2d392c1bf00e70>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { DataCheckerExecTimeS2CTestDeferredFragment$fragmentType } from "./DataCheckerExecTimeS2CTestDeferredFragment.graphql";
export type DataCheckerExecTimeS2CTestDeferQuery$variables = {
  deferred: boolean,
};
export type DataCheckerExecTimeS2CTestDeferQuery$data = {
  readonly me: ?{
    readonly name: ?string,
    readonly $fragmentSpreads: DataCheckerExecTimeS2CTestDeferredFragment$fragmentType,
  },
};
export type DataCheckerExecTimeS2CTestDeferQuery = {
  response: DataCheckerExecTimeS2CTestDeferQuery$data,
  variables: DataCheckerExecTimeS2CTestDeferQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "deferred"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestDeferQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "kind": "Defer",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DataCheckerExecTimeS2CTestDeferredFragment"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DataCheckerExecTimeS2CTestDeferQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "if": "deferred",
            "kind": "Defer",
            "label": "DataCheckerExecTimeS2CTestDeferQuery$defer$DataCheckerExecTimeS2CTestDeferred",
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
    "cacheID": "6c7ddf2a2a6a256b78c3f37e08486242",
    "id": null,
    "metadata": {
      "server_variables": [
        "deferred"
      ]
    },
    "name": "DataCheckerExecTimeS2CTestDeferQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestDeferQuery(\n  $deferred: Boolean!\n) {\n  me {\n    name\n    ...DataCheckerExecTimeS2CTestDeferredFragment @defer(label: \"DataCheckerExecTimeS2CTestDeferQuery$defer$DataCheckerExecTimeS2CTestDeferred\", if: $deferred)\n    id\n  }\n}\n\nfragment DataCheckerExecTimeS2CTestDeferredFragment on User {\n  ...ExecTimeS2CResolvers_IdentityFragment\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "dcb278385f060689d8265dfddcad7e65";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestDeferQuery$variables,
  DataCheckerExecTimeS2CTestDeferQuery$data,
>*/);
