/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<53c1ca7cfeb1cf335842f0ded2426175>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { NormalizationSplitOperation } from 'relay-runtime';

*/

var node/*: NormalizationSplitOperation*/ = {
  "kind": "SplitOperation",
  "metadata": {},
  "name": "useRelayHandoffHydrationTestClientObject_query$normalization",
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
          "alias": null,
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
    },
    {
      "kind": "ClientEdgeToClientObject",
      "backingField": {
        "name": "example_client_object",
        "args": null,
        "fragment": null,
        "kind": "RelayResolver",
        "storageKey": null,
        "isOutputType": true
      },
      "linkedField": {
        "alias": null,
        "args": null,
        "concreteType": "ClientObject",
        "kind": "LinkedField",
        "name": "example_client_object",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "description",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    }
  ]
};

if (__DEV__) {
  (node/*:: as any*/).hash = "fcacdddb42fc49ca8f13daa021fe365c";
}

module.exports = node;
