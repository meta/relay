/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<ee5e12df49d5e5d7ef2db681f5aa3388>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayReferenceMarkerFieldCopyTestSpread_user$fragmentType } from "./RelayReferenceMarkerFieldCopyTestSpread_user.graphql";
export type RelayReferenceMarkerFieldCopyTestSpreadQuery$variables = {};
export type RelayReferenceMarkerFieldCopyTestSpreadQuery$data = {
  readonly me: ?{
    readonly name: ?string,
    readonly $fragmentSpreads: RelayReferenceMarkerFieldCopyTestSpread_user$fragmentType,
  },
};
export type RelayReferenceMarkerFieldCopyTestSpreadQuery = {
  response: RelayReferenceMarkerFieldCopyTestSpreadQuery$data,
  variables: RelayReferenceMarkerFieldCopyTestSpreadQuery$variables,
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
    "name": "RelayReferenceMarkerFieldCopyTestSpreadQuery",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayReferenceMarkerFieldCopyTestSpread_user"
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
    "name": "RelayReferenceMarkerFieldCopyTestSpreadQuery",
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
            "args": null,
            "fragment": require('./RelayReferenceMarkerFieldCopyTestSpread_user$normalization.graphql'),
            "kind": "FragmentSpread"
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
    ]
  },
  "params": {
    "cacheID": "2a2a91ea3ab0f4c0d86ca92ebf70d251",
    "id": null,
    "metadata": {},
    "name": "RelayReferenceMarkerFieldCopyTestSpreadQuery",
    "operationKind": "query",
    "text": "query RelayReferenceMarkerFieldCopyTestSpreadQuery {\n  me {\n    name\n    ...RelayReferenceMarkerFieldCopyTestSpread_user\n    id\n  }\n}\n\nfragment RelayReferenceMarkerFieldCopyTestSpread_user on User {\n  lastName\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "cc7c2cfc2b32401e5704a8d11666122f";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReferenceMarkerFieldCopyTestSpreadQuery$variables,
  RelayReferenceMarkerFieldCopyTestSpreadQuery$data,
>*/);
