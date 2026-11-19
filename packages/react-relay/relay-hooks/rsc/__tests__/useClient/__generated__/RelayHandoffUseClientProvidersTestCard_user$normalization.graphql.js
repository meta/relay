/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<2f6667715664aba1025310a99ac8a4bd>>
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
  "name": "RelayHandoffUseClientProvidersTestCard_user$normalization",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "supported",
          "value": "34hjiS"
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
              "documentName": "RelayHandoffUseClientProvidersTestCard_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestPlain_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport",
              "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
              "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql'))
            }
          ],
          "type": "PlainUserNameRenderer",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": null,
              "documentName": "RelayHandoffUseClientProvidersTestCard_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestMarkdown_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport",
              "componentModuleProvider": () => require('../../RelayHandoffTestMarkdownRenderer.react'),
              "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestMarkdown_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestMarkdown_name$normalization.graphql'))
            }
          ],
          "type": "MarkdownUserNameRenderer",
          "abstractKey": null
        }
      ],
      "storageKey": "nameRenderer(supported:\"34hjiS\")"
    }
  ]
};

if (__DEV__) {
  (node/*:: as any*/).hash = "2062262980b4a26ab977c903304182a4";
}

module.exports = node;
