/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<159045f2c09546984a627b37498d2d54>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayReaderOptimizedLinksTestMergeQuery$variables = {
  withUri: boolean,
};
export type RelayReaderOptimizedLinksTestMergeQuery$data = {
  readonly me: ?{
    readonly backgroundImage: ?{
      readonly uri: ?string,
      readonly width?: ?number,
    },
  },
};
export type RelayReaderOptimizedLinksTestMergeQuery = {
  response: RelayReaderOptimizedLinksTestMergeQuery$data,
  variables: RelayReaderOptimizedLinksTestMergeQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "withUri"
  }
],
v1 = {
  "condition": "withUri",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Image",
      "kind": "LinkedField",
      "name": "backgroundImage",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "uri",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ]
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "Image",
  "kind": "LinkedField",
  "name": "backgroundImage",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "width",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayReaderOptimizedLinksTestMergeQuery",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "RelayReaderOptimizedLinksTestMergeQuery",
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
          (v2/*:: as any*/),
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
    ]
  },
  "params": {
    "cacheID": "97bdaf5b5eb9037b57c06895efe998ff",
    "id": null,
    "metadata": {},
    "name": "RelayReaderOptimizedLinksTestMergeQuery",
    "operationKind": "query",
    "text": "query RelayReaderOptimizedLinksTestMergeQuery(\n  $withUri: Boolean!\n) {\n  me {\n    backgroundImage @include(if: $withUri) {\n      uri\n    }\n    backgroundImage {\n      width\n    }\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "d7fd58053156dfb002c85ae5fa219f54";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReaderOptimizedLinksTestMergeQuery$variables,
  RelayReaderOptimizedLinksTestMergeQuery$data,
>*/);
