/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b197b8f4e77be881b7bba94acb7df253>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayResponseNormalizerTestNestedConcreteListsQuery$variables = {};
export type RelayResponseNormalizerTestNestedConcreteListsQuery$data = {
  readonly userMatrix: ?ReadonlyArray<?ReadonlyArray<?{
    readonly id: string,
    readonly name: ?string,
  }>>,
};
export type RelayResponseNormalizerTestNestedConcreteListsQuery = {
  response: RelayResponseNormalizerTestNestedConcreteListsQuery$data,
  variables: RelayResponseNormalizerTestNestedConcreteListsQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "userMatrix",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
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
    "name": "RelayResponseNormalizerTestNestedConcreteListsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayResponseNormalizerTestNestedConcreteListsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "69c40b663798c42ccfb6c7dfbee6f306",
    "id": null,
    "metadata": {},
    "name": "RelayResponseNormalizerTestNestedConcreteListsQuery",
    "operationKind": "query",
    "text": "query RelayResponseNormalizerTestNestedConcreteListsQuery {\n  userMatrix {\n    id\n    name\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "021297d98a70b0c755129ecf8c4463df";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayResponseNormalizerTestNestedConcreteListsQuery$variables,
  RelayResponseNormalizerTestNestedConcreteListsQuery$data,
>*/);
