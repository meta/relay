/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<8f516155af598f6e116133dd98e07f98>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayMockPayloadGeneratorTestHasOwnPropertyQuery$variables = {};
export type RelayMockPayloadGeneratorTestHasOwnPropertyQuery$data = {
  readonly me: ?{
    readonly hasOwnProperty: ?string,
    readonly id: string,
  },
};
export type RelayMockPayloadGeneratorTestHasOwnPropertyQuery = {
  response: RelayMockPayloadGeneratorTestHasOwnPropertyQuery$data,
  variables: RelayMockPayloadGeneratorTestHasOwnPropertyQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "me",
    "plural": false,
    "selections": [
      {
        "alias": "hasOwnProperty",
        "args": null,
        "kind": "ScalarField",
        "name": "name",
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
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayMockPayloadGeneratorTestHasOwnPropertyQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayMockPayloadGeneratorTestHasOwnPropertyQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "e18f8b4c678019f58d83ec0d1c3d140c",
    "id": null,
    "metadata": {},
    "name": "RelayMockPayloadGeneratorTestHasOwnPropertyQuery",
    "operationKind": "query",
    "text": "query RelayMockPayloadGeneratorTestHasOwnPropertyQuery {\n  me {\n    hasOwnProperty: name\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "d25a3d8febdb0d766a6bebd1a942fdf0";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayMockPayloadGeneratorTestHasOwnPropertyQuery$variables,
  RelayMockPayloadGeneratorTestHasOwnPropertyQuery$data,
>*/);
