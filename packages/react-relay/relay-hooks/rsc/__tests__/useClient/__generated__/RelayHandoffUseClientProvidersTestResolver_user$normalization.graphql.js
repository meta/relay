/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4bee9b836f8729507c7675c17c8623ed>>
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
  "name": "RelayHandoffUseClientProvidersTestResolver_user$normalization",
  "selections": [
    {
      "name": "handoffRendererProp",
      "args": null,
      "fragment": {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": "resolverRenderer",
            "args": [
              {
                "kind": "Literal",
                "name": "supported",
                "value": "1AwQS7"
              }
            ],
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
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
                "kind": "InlineFragment",
                "selections": [
                  {
                    "args": null,
                    "documentName": "RelayHandoffUseClientProvidersResolverInline_user",
                    "fragmentName": "RelayHandoffUseClientProvidersResolverPlain_name",
                    "fragmentPropName": "name",
                    "kind": "ModuleImport",
                    "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
                    "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersResolverPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersResolverPlain_name$normalization.graphql'))
                  }
                ],
                "type": "PlainUserNameRenderer",
                "abstractKey": null
              }
            ],
            "storageKey": "nameRenderer(supported:\"1AwQS7\")"
          }
        ],
        "type": "User",
        "abstractKey": null
      },
      "kind": "RelayResolver",
      "storageKey": null,
      "isOutputType": true
    }
  ]
};

if (__DEV__) {
  (node/*:: as any*/).hash = "4c3aa05160024a2c561b7236aefaf7dc";
}

module.exports = node;
