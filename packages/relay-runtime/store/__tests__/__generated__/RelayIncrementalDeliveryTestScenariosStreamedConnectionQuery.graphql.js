/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b947e7e359d445e986c89ee01550da3e>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$variables = {};
export type RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$data = {
  readonly viewer: ?{
    readonly newsFeed: ?{
      readonly edges: ?ReadonlyArray<?{
        readonly cursor: ?string,
        readonly node: ?{
          readonly __typename: string,
          readonly id: string,
        },
      }>,
    },
  },
};
export type RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery = {
  response: RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$data,
  variables: RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "NewsFeedEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "cursor",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
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
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v1 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "PageInfo",
    "kind": "LinkedField",
    "name": "pageInfo",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "endCursor",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hasNextPage",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v2 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 3
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          {
            "alias": "newsFeed",
            "args": null,
            "concreteType": "NewsFeedConnection",
            "kind": "LinkedField",
            "name": "__RelayIncrementalDeliveryTestScenarios_newsFeed_connection",
            "plural": false,
            "selections": [
              {
                "kind": "Stream",
                "selections": (v0/*:: as any*/)
              },
              {
                "kind": "Defer",
                "selections": (v1/*:: as any*/)
              }
            ],
            "storageKey": null
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
    "name": "RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Viewer",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": (v2/*:: as any*/),
            "concreteType": "NewsFeedConnection",
            "kind": "LinkedField",
            "name": "newsFeed",
            "plural": false,
            "selections": [
              {
                "if": null,
                "kind": "Stream",
                "label": "RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$stream$RelayIncrementalDeliveryTestScenarios_newsFeed",
                "selections": (v0/*:: as any*/)
              },
              {
                "if": null,
                "kind": "Defer",
                "label": "RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$defer$RelayIncrementalDeliveryTestScenarios_newsFeed$pageInfo",
                "selections": (v1/*:: as any*/)
              }
            ],
            "storageKey": "newsFeed(first:3)"
          },
          {
            "alias": null,
            "args": (v2/*:: as any*/),
            "filters": null,
            "handle": "connection",
            "key": "RelayIncrementalDeliveryTestScenarios_newsFeed",
            "kind": "LinkedHandle",
            "name": "newsFeed"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3ea2380691242b728b52ac27a1d73de8",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "viewer",
            "newsFeed"
          ],
          "stream": true
        }
      ]
    },
    "name": "RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery",
    "operationKind": "query",
    "text": "query RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery {\n  viewer {\n    newsFeed(first: 3) {\n      edges @stream(label: \"RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$stream$RelayIncrementalDeliveryTestScenarios_newsFeed\", initial_count: 1) {\n        cursor\n        node {\n          __typename\n          id\n        }\n      }\n      ... @defer(label: \"RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$defer$RelayIncrementalDeliveryTestScenarios_newsFeed$pageInfo\") {\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "a20ffc1c87bcbe1d134d6dc89c732f6d";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$variables,
  RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$data,
>*/);
