/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7a6b6d73d38ac5548754d19fbd547973>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferTestUserFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferTestUserFragment.graphql";
export type RelayModernEnvironmentExecuteWithDeferTestResolverQuery$variables = {
  id: string,
};
export type RelayModernEnvironmentExecuteWithDeferTestResolverQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferTestUserFragment$fragmentType,
  },
};
export type RelayModernEnvironmentExecuteWithDeferTestResolverQuery = {
  response: RelayModernEnvironmentExecuteWithDeferTestResolverQuery$data,
  variables: RelayModernEnvironmentExecuteWithDeferTestResolverQuery$variables,
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
],
v2 = {
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
    "name": "RelayModernEnvironmentExecuteWithDeferTestResolverQuery",
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
            "kind": "Defer",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "RelayModernEnvironmentExecuteWithDeferTestUserFragment"
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
    "name": "RelayModernEnvironmentExecuteWithDeferTestResolverQuery",
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
            "if": null,
            "kind": "Defer",
            "label": "RelayModernEnvironmentExecuteWithDeferTestResolverQuery$defer$UserFragment",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "name",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "filters": null,
                    "handle": "name_handler",
                    "key": "",
                    "kind": "ScalarHandle",
                    "name": "name"
                  }
                ],
                "type": "User",
                "abstractKey": null
              }
            ]
          },
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "use_exec_time_resolvers": true
  },
  "params": {
    "cacheID": "9a09609b9ab83ed0f5a23b28a0be2a87",
    "id": null,
    "metadata": {
      "server_variables": [
        "id"
      ]
    },
    "name": "RelayModernEnvironmentExecuteWithDeferTestResolverQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithDeferTestResolverQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RelayModernEnvironmentExecuteWithDeferTestUserFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferTestResolverQuery$defer$UserFragment\")\n    id\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferTestUserFragment on User {\n  id\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "56440e2904f55cb46bcb26cb00575108";
}

(node.params.metadata/*:: as any*/).operation = node.operation;

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithDeferTestResolverQuery$variables,
  RelayModernEnvironmentExecuteWithDeferTestResolverQuery$data,
>*/);
