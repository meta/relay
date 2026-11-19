/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<e262b4798a147734bce1a39eef511c40>>
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
  "name": "RelayHandoffUseClientProvidersTestShared_user$normalization",
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
              "documentName": "RelayHandoffUseClientProvidersTestShared_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestSharedPlain_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport",
              "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
              "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestSharedPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestSharedPlain_name$normalization.graphql'))
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
              "documentName": "RelayHandoffUseClientProvidersTestShared_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestSharedMarkdown_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport",
              "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
              "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestSharedMarkdown_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestSharedMarkdown_name$normalization.graphql'))
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
  (node/*:: as any*/).hash = "05f6dbc8df7a6d0ca9a0341d8502cead";
}

module.exports = node;
