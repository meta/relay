/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<06af743ad9540f455b59ad0200b3b059>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayResponseNormalizerTestNestedAbstractListsQuery$variables = {};
export type RelayResponseNormalizerTestNestedAbstractListsQuery$data = {
  readonly actorMatrix: ?ReadonlyArray<?ReadonlyArray<?{
    readonly __typename: string,
    readonly id: string,
    readonly name: ?string,
  }>>,
};
export type RelayResponseNormalizerTestNestedAbstractListsQuery = {
  response: RelayResponseNormalizerTestNestedAbstractListsQuery$data,
  variables: RelayResponseNormalizerTestNestedAbstractListsQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "actorMatrix",
    "plural": true,
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
    "name": "RelayResponseNormalizerTestNestedAbstractListsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RelayResponseNormalizerTestNestedAbstractListsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "707c6fda2886a42d2ef7f35f6369911b",
    "id": null,
    "metadata": {},
    "name": "RelayResponseNormalizerTestNestedAbstractListsQuery",
    "operationKind": "query",
    "text": "query RelayResponseNormalizerTestNestedAbstractListsQuery {\n  actorMatrix {\n    __typename\n    id\n    name\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "5c316dcb2e314bd1bc25538907e9b7bd";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayResponseNormalizerTestNestedAbstractListsQuery$variables,
  RelayResponseNormalizerTestNestedAbstractListsQuery$data,
>*/);
