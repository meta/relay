/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<00898504e7a8a57e1698b5b98851a582>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { ExecTimeS2CThingsResolver_LabelFragment$key } from "./../resolvers/__generated__/ExecTimeS2CThingsResolver_LabelFragment.graphql";
import {exec_time_s2c_thing_label as iExecTimeS2CThingExecTimeS2cThingLabelResolverType} from "../resolvers/ExecTimeS2CThingsResolver.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `iExecTimeS2CThingExecTimeS2cThingLabelResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(iExecTimeS2CThingExecTimeS2cThingLabelResolverType as (
  rootKey: ExecTimeS2CThingsResolver_LabelFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?string);
export type DataCheckerExecTimeS2CTestClientAbstractQuery$variables = {
  id: string,
};
export type DataCheckerExecTimeS2CTestClientAbstractQuery$data = {
  readonly node: ?{
    readonly exec_time_s2c_thing_label?: ?string,
  },
};
export type DataCheckerExecTimeS2CTestClientAbstractQuery = {
  response: DataCheckerExecTimeS2CTestClientAbstractQuery$data,
  variables: DataCheckerExecTimeS2CTestClientAbstractQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerExecTimeS2CTestClientAbstractQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "fragment": {
              "args": null,
              "kind": "FragmentSpread",
              "name": "ExecTimeS2CThingsResolver_LabelFragment"
            },
            "kind": "RelayResolver",
            "name": "exec_time_s2c_thing_label",
            "resolverModule": require('../resolvers/ExecTimeS2CThingsResolver').exec_time_s2c_thing_label,
            "path": "node.exec_time_s2c_thing_label"
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
    "name": "DataCheckerExecTimeS2CTestClientAbstractQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "ClientExtension",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "name": "exec_time_s2c_thing_label",
                    "args": null,
                    "kind": "RelayResolver",
                    "storageKey": null,
                    "isOutputType": true,
                    "resolverInfo": {
                      "resolverFunction": require('../resolvers/ExecTimeS2CThingsResolver').exec_time_s2c_thing_label,
                      "rootFragment": require('../resolvers/__generated__/ExecTimeS2CThingsResolver_LabelFragment$normalization.graphql')
                    }
                  }
                ],
                "type": "IExecTimeS2CThing",
                "abstractKey": "__isIExecTimeS2CThing"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ],
    "use_exec_time_resolvers": true,
    "clientAbstractTypes": {
      "__isIExecTimeS2CThing": [
        "Page",
        "User"
      ]
    }
  },
  "params": {
    "cacheID": "d810c74885d3e49289ca9c68b844f3cb",
    "id": null,
    "metadata": {
      "server_variables": [
        "id"
      ]
    },
    "name": "DataCheckerExecTimeS2CTestClientAbstractQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestClientAbstractQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "7ce0a10f4c6390d3ef1d201ded859f0c";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestClientAbstractQuery$variables,
  DataCheckerExecTimeS2CTestClientAbstractQuery$data,
>*/);
