/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<fb4967957b4f355b8cbb538042fc3997>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentNoInlineTestNullArgument_user$fragmentType } from "./RelayModernEnvironmentNoInlineTestNullArgument_user.graphql";
export type PhotoSize = "LARGE" | "SMALL" | "%future added value";
export type RelayModernEnvironmentNoInlineTestNullArgumentQuery$variables = {
  preset?: ?PhotoSize,
};
export type RelayModernEnvironmentNoInlineTestNullArgumentQuery$data = {
  readonly me: ?{
    readonly $fragmentSpreads: RelayModernEnvironmentNoInlineTestNullArgument_user$fragmentType,
  },
};
export type RelayModernEnvironmentNoInlineTestNullArgumentQuery = {
  response: RelayModernEnvironmentNoInlineTestNullArgumentQuery$data,
  variables: RelayModernEnvironmentNoInlineTestNullArgumentQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "preset"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernEnvironmentNoInlineTestNullArgumentQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          {
            "args": [
              {
                "kind": "Variable",
                "name": "preset",
                "variableName": "preset"
              }
            ],
            "kind": "FragmentSpread",
            "name": "RelayModernEnvironmentNoInlineTestNullArgument_user"
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
    "name": "RelayModernEnvironmentNoInlineTestNullArgumentQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          {
            "args": [
              {
                "kind": "Variable",
                "name": "RelayModernEnvironmentNoInlineTestNullArgument_user$preset",
                "variableName": "preset"
              }
            ],
            "fragment": require('./RelayModernEnvironmentNoInlineTestNullArgument_user$normalization.graphql'),
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
    "cacheID": "66f2bb8ea1dcb967e8051bf4b06ee6d9",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentNoInlineTestNullArgumentQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentNoInlineTestNullArgumentQuery(\n  $preset: PhotoSize\n) {\n  me {\n    ...RelayModernEnvironmentNoInlineTestNullArgument_user_3sTInB\n    id\n  }\n}\n\nfragment RelayModernEnvironmentNoInlineTestNullArgument_user_3sTInB on User {\n  profilePicture2(preset: $preset) {\n    uri\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "924668eba9edd7f99322e317c4544807";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentNoInlineTestNullArgumentQuery$variables,
  RelayModernEnvironmentNoInlineTestNullArgumentQuery$data,
>*/);
