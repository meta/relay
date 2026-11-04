/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<bcd8c42b57b473f2a2156d7d1ce2dc84>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayModernStoreObserveUpdatedRecordIDsTestQuery$variables = {};
export type RelayModernStoreObserveUpdatedRecordIDsTestQuery$data = {
  readonly me: ?{
    readonly name: ?string,
  },
};
export type RelayModernStoreObserveUpdatedRecordIDsTestQuery = {
  response: RelayModernStoreObserveUpdatedRecordIDsTestQuery$data,
  variables: RelayModernStoreObserveUpdatedRecordIDsTestQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernStoreObserveUpdatedRecordIDsTestQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          (v0/*:: as any*/)
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
    "name": "RelayModernStoreObserveUpdatedRecordIDsTestQuery",
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
    "cacheID": "b0da21b91cdba79747b6a46aaad4952f",
    "id": null,
    "metadata": {},
    "name": "RelayModernStoreObserveUpdatedRecordIDsTestQuery",
    "operationKind": "query",
    "text": "query RelayModernStoreObserveUpdatedRecordIDsTestQuery {\n  me {\n    name\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "45e6ad3a1e4b5f5e993fa9963503ab63";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernStoreObserveUpdatedRecordIDsTestQuery$variables,
  RelayModernStoreObserveUpdatedRecordIDsTestQuery$data,
>*/);
