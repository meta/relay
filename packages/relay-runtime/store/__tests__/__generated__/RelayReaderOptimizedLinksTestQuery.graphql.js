/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4726a568410b6247d40d35f6f237b852>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayReaderOptimizedLinksTestQuery$variables = {};
export type RelayReaderOptimizedLinksTestQuery$data = {
  readonly me: ?{
    readonly backgroundImage: ?{
      readonly uri: ?string,
    },
    readonly firstName: ?string,
    readonly hometown: ?{
      readonly name: ?string,
    },
    readonly lastName: ?string,
  },
};
export type RelayReaderOptimizedLinksTestQuery = {
  response: RelayReaderOptimizedLinksTestQuery$data,
  variables: RelayReaderOptimizedLinksTestQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
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
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "firstName",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lastName",
  "storageKey": null
},
v4 = {
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
    "name": "RelayReaderOptimizedLinksTestQuery",
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
          (v1/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Page",
            "kind": "LinkedField",
            "name": "hometown",
            "plural": false,
            "selections": [
              (v2/*:: as any*/)
            ],
            "storageKey": null
          },
          (v3/*:: as any*/)
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
    "name": "RelayReaderOptimizedLinksTestQuery",
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
          (v1/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Page",
            "kind": "LinkedField",
            "name": "hometown",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v4/*:: as any*/)
            ],
            "storageKey": null
          },
          (v3/*:: as any*/),
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5a85c8da0ed79640f62eaff68aaef9fc",
    "id": null,
    "metadata": {},
    "name": "RelayReaderOptimizedLinksTestQuery",
    "operationKind": "query",
    "text": "query RelayReaderOptimizedLinksTestQuery {\n  me {\n    backgroundImage {\n      uri\n    }\n    firstName\n    hometown {\n      name\n      id\n    }\n    lastName\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "78dfc9fcc0b1e47fff3daab48d83aa3e";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReaderOptimizedLinksTestQuery$variables,
  RelayReaderOptimizedLinksTestQuery$data,
>*/);
