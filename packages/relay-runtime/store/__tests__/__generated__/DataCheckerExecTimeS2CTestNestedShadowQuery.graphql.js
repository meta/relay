/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2e533a7b0947785a54d1cf0196677c99>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { DataID } from "relay-runtime";
import type { ExecTimeS2CNestedShadowResolver_RootFragment$key } from "./../resolvers/__generated__/ExecTimeS2CNestedShadowResolver_RootFragment.graphql";
import type { ShadowMagicWeakCity____relay_model_instance$data } from "./../resolvers/__generated__/ShadowMagicWeakCity____relay_model_instance.graphql";
import {exec_time_s2c_shadow_nested as queryExecTimeS2cShadowNestedResolverType} from "../resolvers/ExecTimeS2CNestedShadowResolver.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryExecTimeS2cShadowNestedResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryExecTimeS2cShadowNestedResolverType as (
  rootKey: ExecTimeS2CNestedShadowResolver_RootFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?({
  readonly __typename: "ShadowMagicWeakCity",
  readonly __relay_model_instance: ShadowMagicWeakCity____relay_model_instance$data['__relay_model_instance'],
} | {
  readonly __typename: "StreetAddress",
  readonly __id: DataID,
}));
export type DataCheckerExecTimeS2CTestNestedShadowQuery$variables = {};
export type DataCheckerExecTimeS2CTestNestedShadowQuery$data = {
  readonly exec_time_s2c_shadow_nested: ?{
    readonly city: ?string,
  },
};
export type DataCheckerExecTimeS2CTestNestedShadowQuery = {
  response: DataCheckerExecTimeS2CTestNestedShadowQuery$data,
  variables: DataCheckerExecTimeS2CTestNestedShadowQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "city",
  "storageKey": null
},
v1 = {
  "kind": "InlineFragment",
  "selections": [
    (v0/*:: as any*/)
  ],
  "type": "StreetAddress",
  "abstractKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": {
      "hasClientEdges": true
    },
    "name": "DataCheckerExecTimeS2CTestNestedShadowQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "concreteType": null,
        "modelResolvers": {},
        "serverObjectOperations": null,
        "backingField": {
          "alias": null,
          "args": null,
          "fragment": {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ExecTimeS2CNestedShadowResolver_RootFragment"
          },
          "kind": "RelayResolver",
          "name": "exec_time_s2c_shadow_nested",
          "resolverModule": require('../resolvers/ExecTimeS2CNestedShadowResolver').exec_time_s2c_shadow_nested,
          "path": "exec_time_s2c_shadow_nested",
          "normalizationInfo": {
            "kind": "AbstractInline",
            "concreteType": null,
            "plural": false,
            "inlineKinds": {
              "ShadowMagicWeakCity": "WeakModel",
              "StreetAddress": "ServerWeak"
            }
          }
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "exec_time_s2c_shadow_nested",
          "plural": false,
          "selections": [
            (v1/*:: as any*/),
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "fragment": {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ShadowMagicWeakCity____relay_model_instance"
                  },
                  "kind": "RelayResolver",
                  "name": "city",
                  "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./../resolvers/__generated__/ShadowMagicWeakCity____relay_model_instance.graphql'), require('../resolvers/ShadowMagicWeakCityResolvers').city, '__relay_model_instance', true),
                  "path": "exec_time_s2c_shadow_nested.city"
                }
              ],
              "type": "ShadowMagicWeakCity",
              "abstractKey": null
            }
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DataCheckerExecTimeS2CTestNestedShadowQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "backingField": {
          "name": "exec_time_s2c_shadow_nested",
          "args": null,
          "kind": "RelayResolver",
          "storageKey": null,
          "isOutputType": true,
          "resolverInfo": {
            "resolverFunction": require('../resolvers/ExecTimeS2CNestedShadowResolver').exec_time_s2c_shadow_nested,
            "rootFragment": require('../resolvers/__generated__/ExecTimeS2CNestedShadowResolver_RootFragment$normalization.graphql')
          }
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "exec_time_s2c_shadow_nested",
          "plural": false,
          "selections": [
            (v2/*:: as any*/),
            (v1/*:: as any*/),
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "name": "city",
                  "args": null,
                  "kind": "RelayResolver",
                  "storageKey": null,
                  "isOutputType": true,
                  "resolverInfo": {
                    "resolverFunction": require('../resolvers/ShadowMagicWeakCityResolvers').city,
                    "rootFragment": null
                  }
                }
              ],
              "type": "ShadowMagicWeakCity",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      },
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
            "concreteType": "StreetAddress",
            "kind": "LinkedField",
            "name": "address",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v0/*:: as any*/),
              {
                "kind": "ClientExtension",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__id",
                    "storageKey": null
                  }
                ]
              }
            ],
            "storageKey": null
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
    "cacheID": "9c210eddfab5e398678066f8a97fb5f5",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestNestedShadowQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestNestedShadowQuery {\n  ...ExecTimeS2CNestedShadowResolver_RootFragment\n  me {\n    address {\n      __typename\n      city\n    }\n    id\n  }\n}\n\nfragment ExecTimeS2CNestedShadowResolver_RootFragment on Query {\n  me {\n    ...ExecTimeS2CResolvers_KeyedFragment\n    address {\n      __typename\n    }\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_KeyedFragment on User {\n  id\n  alternate_name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "30f5027f4380001c5648bc40f76361a8";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestNestedShadowQuery$variables,
  DataCheckerExecTimeS2CTestNestedShadowQuery$data,
>*/);
