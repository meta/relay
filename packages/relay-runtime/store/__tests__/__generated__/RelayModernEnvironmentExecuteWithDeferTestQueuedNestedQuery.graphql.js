/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<1e4bd6dab0ef6483371039e302b18844>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment.graphql";
export type RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery$variables = {
  id: string,
};
export type RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery$data = {
  readonly node: ?{
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$fragmentType,
  },
};
export type RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery = {
  response: RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery$data,
  variables: RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery$variables,
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
    "name": "RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery",
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
                "name": "RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment"
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
    "name": "RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery",
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
            "label": "RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery$defer$Outer",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "if": null,
                    "kind": "Defer",
                    "label": "RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$defer$Inner",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "name",
                        "storageKey": null
                      }
                    ]
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
    ]
  },
  "params": {
    "cacheID": "1424f3c3ea9c9b05ff79308c9c600a57",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery$defer$Outer\")\n    id\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment on User {\n  name\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment on User {\n  id\n  ...RelayModernEnvironmentExecuteWithDeferTestQueuedInnerFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferTestQueuedOuterFragment$defer$Inner\")\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "0be77aea46c8fda017f4076c62df0ff7";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery$variables,
  RelayModernEnvironmentExecuteWithDeferTestQueuedNestedQuery$data,
>*/);
