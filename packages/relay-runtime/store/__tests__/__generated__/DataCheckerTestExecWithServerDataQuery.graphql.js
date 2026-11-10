/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<be6d84e641caabc2e34afc7c8e1ddfd6>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { DataID } from "relay-runtime";
import type { RelayReaderExecResolversTestUser____relay_model_instance$data } from "./RelayReaderExecResolversTestUser____relay_model_instance.graphql";
import {RelayReaderExecResolversTest_user_one as queryRelayReaderExecResolversTestUserOneResolverType} from "../RelayReader-ExecResolvers-test.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryRelayReaderExecResolversTestUserOneResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryRelayReaderExecResolversTestUserOneResolverType as (
  args: void,
  context: TestResolverContextType,
) => ?{
  readonly id: DataID,
});
import {best_friend as relayReaderExecResolversTestUserBestFriendResolverType} from "../RelayReader-ExecResolvers-test.js";
// Type assertion validating that `relayReaderExecResolversTestUserBestFriendResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(relayReaderExecResolversTestUserBestFriendResolverType as (
  __relay_model_instance: RelayReaderExecResolversTestUser____relay_model_instance$data['__relay_model_instance'],
  args: void,
  context: TestResolverContextType,
) => ?{
  readonly id: DataID,
});
import {name as relayReaderExecResolversTestUserNameResolverType} from "../RelayReader-ExecResolvers-test.js";
// Type assertion validating that `relayReaderExecResolversTestUserNameResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(relayReaderExecResolversTestUserNameResolverType as (
  __relay_model_instance: RelayReaderExecResolversTestUser____relay_model_instance$data['__relay_model_instance'],
  args: void,
  context: TestResolverContextType,
) => ?string);
export type DataCheckerTestExecWithServerDataQuery$variables = {};
export type DataCheckerTestExecWithServerDataQuery$data = {
  readonly RelayReaderExecResolversTest_user_one: ?{
    readonly best_friend: ?{
      readonly best_friend: ?{
        readonly name: ?string,
      },
      readonly name: ?string,
    },
    readonly name: ?string,
  },
  readonly me: ?{
    readonly name: ?string,
  },
};
export type DataCheckerTestExecWithServerDataQuery = {
  response: DataCheckerTestExecWithServerDataQuery$data,
  variables: DataCheckerTestExecWithServerDataQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "args": null,
  "kind": "FragmentSpread",
  "name": "RelayReaderExecResolversTestUser__id"
},
v1 = {
  "args": null,
  "kind": "FragmentSpread",
  "name": "RelayReaderExecResolversTestUser____relay_model_instance"
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "RelayReaderExecResolversTestUser": {
    "resolverModule": require('../RelayReader-ExecResolvers-test').RelayReaderExecResolversTestUser
  }
},
v4 = {
  "name": "name",
  "args": null,
  "kind": "RelayResolver",
  "storageKey": null,
  "isOutputType": true,
  "resolverInfo": {
    "resolverFunction": require('../RelayReader-ExecResolvers-test').name,
    "rootFragment": null
  }
},
v5 = {
  "name": "best_friend",
  "args": null,
  "kind": "RelayResolver",
  "storageKey": null,
  "isOutputType": false,
  "resolverInfo": {
    "resolverFunction": require('../RelayReader-ExecResolvers-test').best_friend,
    "rootFragment": null
  }
},
v6 = {
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
    "metadata": {
      "hasClientEdges": true
    },
    "name": "DataCheckerTestExecWithServerDataQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "concreteType": "RelayReaderExecResolversTestUser",
        "modelResolvers": {
          "RelayReaderExecResolversTestUser": {
            "alias": null,
            "args": null,
            "fragment": (v0/*:: as any*/),
            "kind": "RelayResolver",
            "name": "__relay_model_instance",
            "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./RelayReaderExecResolversTestUser__id.graphql'), require('../RelayReader-ExecResolvers-test').RelayReaderExecResolversTestUser, 'id', true),
            "path": "RelayReaderExecResolversTest_user_one.__relay_model_instance"
          }
        },
        "serverObjectOperations": null,
        "backingField": {
          "alias": null,
          "args": null,
          "fragment": null,
          "kind": "RelayResolver",
          "name": "RelayReaderExecResolversTest_user_one",
          "resolverModule": require('../RelayReader-ExecResolvers-test').RelayReaderExecResolversTest_user_one,
          "path": "RelayReaderExecResolversTest_user_one"
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": "RelayReaderExecResolversTestUser",
          "kind": "LinkedField",
          "name": "RelayReaderExecResolversTest_user_one",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "fragment": (v1/*:: as any*/),
              "kind": "RelayResolver",
              "name": "name",
              "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./RelayReaderExecResolversTestUser____relay_model_instance.graphql'), require('../RelayReader-ExecResolvers-test').name, '__relay_model_instance', true),
              "path": "RelayReaderExecResolversTest_user_one.name"
            },
            {
              "kind": "ClientEdgeToClientObject",
              "concreteType": "RelayReaderExecResolversTestUser",
              "modelResolvers": {
                "RelayReaderExecResolversTestUser": {
                  "alias": null,
                  "args": null,
                  "fragment": (v0/*:: as any*/),
                  "kind": "RelayResolver",
                  "name": "__relay_model_instance",
                  "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./RelayReaderExecResolversTestUser__id.graphql'), require('../RelayReader-ExecResolvers-test').RelayReaderExecResolversTestUser, 'id', true),
                  "path": "RelayReaderExecResolversTest_user_one.best_friend.__relay_model_instance"
                }
              },
              "serverObjectOperations": null,
              "backingField": {
                "alias": null,
                "args": null,
                "fragment": (v1/*:: as any*/),
                "kind": "RelayResolver",
                "name": "best_friend",
                "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./RelayReaderExecResolversTestUser____relay_model_instance.graphql'), require('../RelayReader-ExecResolvers-test').best_friend, '__relay_model_instance', true),
                "path": "RelayReaderExecResolversTest_user_one.best_friend"
              },
              "linkedField": {
                "alias": null,
                "args": null,
                "concreteType": "RelayReaderExecResolversTestUser",
                "kind": "LinkedField",
                "name": "best_friend",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "fragment": (v1/*:: as any*/),
                    "kind": "RelayResolver",
                    "name": "name",
                    "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./RelayReaderExecResolversTestUser____relay_model_instance.graphql'), require('../RelayReader-ExecResolvers-test').name, '__relay_model_instance', true),
                    "path": "RelayReaderExecResolversTest_user_one.best_friend.name"
                  },
                  {
                    "kind": "ClientEdgeToClientObject",
                    "concreteType": "RelayReaderExecResolversTestUser",
                    "modelResolvers": {
                      "RelayReaderExecResolversTestUser": {
                        "alias": null,
                        "args": null,
                        "fragment": (v0/*:: as any*/),
                        "kind": "RelayResolver",
                        "name": "__relay_model_instance",
                        "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./RelayReaderExecResolversTestUser__id.graphql'), require('../RelayReader-ExecResolvers-test').RelayReaderExecResolversTestUser, 'id', true),
                        "path": "RelayReaderExecResolversTest_user_one.best_friend.best_friend.__relay_model_instance"
                      }
                    },
                    "serverObjectOperations": null,
                    "backingField": {
                      "alias": null,
                      "args": null,
                      "fragment": (v1/*:: as any*/),
                      "kind": "RelayResolver",
                      "name": "best_friend",
                      "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./RelayReaderExecResolversTestUser____relay_model_instance.graphql'), require('../RelayReader-ExecResolvers-test').best_friend, '__relay_model_instance', true),
                      "path": "RelayReaderExecResolversTest_user_one.best_friend.best_friend"
                    },
                    "linkedField": {
                      "alias": null,
                      "args": null,
                      "concreteType": "RelayReaderExecResolversTestUser",
                      "kind": "LinkedField",
                      "name": "best_friend",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "fragment": (v1/*:: as any*/),
                          "kind": "RelayResolver",
                          "name": "name",
                          "resolverModule": require('relay-runtime/experimental').resolverDataInjector(require('./RelayReaderExecResolversTestUser____relay_model_instance.graphql'), require('../RelayReader-ExecResolvers-test').name, '__relay_model_instance', true),
                          "path": "RelayReaderExecResolversTest_user_one.best_friend.best_friend.name"
                        }
                      ],
                      "storageKey": null
                    }
                  }
                ],
                "storageKey": null
              }
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
          (v2/*:: as any*/)
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
    "name": "DataCheckerTestExecWithServerDataQuery",
    "selections": [
      {
        "kind": "ClientEdgeToClientObject",
        "modelResolvers": (v3/*:: as any*/),
        "backingField": {
          "name": "RelayReaderExecResolversTest_user_one",
          "args": null,
          "kind": "RelayResolver",
          "storageKey": null,
          "isOutputType": false,
          "resolverInfo": {
            "resolverFunction": require('../RelayReader-ExecResolvers-test').RelayReaderExecResolversTest_user_one,
            "rootFragment": null
          }
        },
        "linkedField": {
          "alias": null,
          "args": null,
          "concreteType": "RelayReaderExecResolversTestUser",
          "kind": "LinkedField",
          "name": "RelayReaderExecResolversTest_user_one",
          "plural": false,
          "selections": [
            (v4/*:: as any*/),
            {
              "kind": "ClientEdgeToClientObject",
              "modelResolvers": (v3/*:: as any*/),
              "backingField": (v5/*:: as any*/),
              "linkedField": {
                "alias": null,
                "args": null,
                "concreteType": "RelayReaderExecResolversTestUser",
                "kind": "LinkedField",
                "name": "best_friend",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/),
                  {
                    "kind": "ClientEdgeToClientObject",
                    "modelResolvers": (v3/*:: as any*/),
                    "backingField": (v5/*:: as any*/),
                    "linkedField": {
                      "alias": null,
                      "args": null,
                      "concreteType": "RelayReaderExecResolversTestUser",
                      "kind": "LinkedField",
                      "name": "best_friend",
                      "plural": false,
                      "selections": [
                        (v4/*:: as any*/),
                        (v6/*:: as any*/)
                      ],
                      "storageKey": null
                    }
                  },
                  (v6/*:: as any*/)
                ],
                "storageKey": null
              }
            },
            (v6/*:: as any*/)
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
          (v2/*:: as any*/),
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "use_exec_time_resolvers": true
  },
  "params": {
    "cacheID": "ff49275f22dc118a4a5554e2bb81b93a",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "DataCheckerTestExecWithServerDataQuery",
    "operationKind": "query",
    "text": "query DataCheckerTestExecWithServerDataQuery {\n  me {\n    name\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "6e8ef036cc7105493415758b86368fe7";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerTestExecWithServerDataQuery$variables,
  DataCheckerTestExecWithServerDataQuery$data,
>*/);
