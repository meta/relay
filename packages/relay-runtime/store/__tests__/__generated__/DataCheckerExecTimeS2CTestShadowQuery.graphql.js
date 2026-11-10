/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7c1451c01d1870bc8056bf89da5a5300>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { DataID } from "relay-runtime";
import type { ExecTimeS2CShadowResolver_RootFragment$key } from "./../resolvers/__generated__/ExecTimeS2CShadowResolver_RootFragment.graphql";
import type { ShadowMagicWeakCity____relay_model_instance$data } from "./../resolvers/__generated__/ShadowMagicWeakCity____relay_model_instance.graphql";
import {exec_time_s2c_shadow_address as queryExecTimeS2cShadowAddressResolverType} from "../resolvers/ExecTimeS2CShadowResolver.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryExecTimeS2cShadowAddressResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryExecTimeS2cShadowAddressResolverType as (
  rootKey: ExecTimeS2CShadowResolver_RootFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?({
  readonly __typename: "ShadowMagicWeakCity",
  readonly __relay_model_instance: ShadowMagicWeakCity____relay_model_instance$data['__relay_model_instance'],
} | {
  readonly __typename: "StreetAddress",
  readonly __id: DataID,
}));
export type DataCheckerExecTimeS2CTestShadowQuery$variables = {};
export type DataCheckerExecTimeS2CTestShadowQuery$data = {
  readonly exec_time_s2c_shadow_address: ?{
    readonly city: ?string,
  },
};
export type DataCheckerExecTimeS2CTestShadowQuery = {
  response: DataCheckerExecTimeS2CTestShadowQuery$data,
  variables: DataCheckerExecTimeS2CTestShadowQuery$variables,
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
    "name": "DataCheckerExecTimeS2CTestShadowQuery",
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
            "name": "ExecTimeS2CShadowResolver_RootFragment"
          },
          "kind": "RelayResolver",
          "name": "exec_time_s2c_shadow_address",
          "resolverModule": require('../resolvers/ExecTimeS2CShadowResolver').exec_time_s2c_shadow_address,
          "path": "exec_time_s2c_shadow_address",
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
          "name": "exec_time_s2c_shadow_address",
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
                  "path": "exec_time_s2c_shadow_address.city"
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
    "name": "DataCheckerExecTimeS2CTestShadowQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "backingField": {
          "name": "exec_time_s2c_shadow_address",
          "args": null,
          "kind": "RelayResolver",
          "storageKey": null,
          "isOutputType": true,
          "resolverInfo": {
            "resolverFunction": require('../resolvers/ExecTimeS2CShadowResolver').exec_time_s2c_shadow_address,
            "rootFragment": require('../resolvers/__generated__/ExecTimeS2CShadowResolver_RootFragment$normalization.graphql')
          }
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "exec_time_s2c_shadow_address",
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
    "cacheID": "5759c81d38cfcc9dc7ea942de35d42f4",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerExecTimeS2CTestShadowQuery",
    "operationKind": "query",
    "text": "query DataCheckerExecTimeS2CTestShadowQuery {\n  ...ExecTimeS2CShadowResolver_RootFragment\n  me {\n    address {\n      __typename\n      city\n    }\n    id\n  }\n}\n\nfragment ExecTimeS2CShadowResolver_RootFragment on Query {\n  me {\n    address {\n      __typename\n    }\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "027042358a8ae3ff1234ac57557b40a5";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerExecTimeS2CTestShadowQuery$variables,
  DataCheckerExecTimeS2CTestShadowQuery$data,
>*/);
