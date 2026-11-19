/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<cc83948290891876b8e833f7e08d4bf7>>
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
  "name": "RelayHandoffUseClientProvidersTestAmbiguous_user$normalization",
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
              "documentName": "RelayHandoffUseClientProvidersTestAmbiguous_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestAmbiguousPlain_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport",
              "componentModuleProvider": () => require('../../RelayHandoffTestPlainRenderer.react'),
              "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestAmbiguousPlain_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestAmbiguousPlain_name$normalization.graphql'))
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
              "documentName": "RelayHandoffUseClientProvidersTestAmbiguous_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport",
              "componentModuleProvider": () => require('../../RelayHandoffTestMarkdownRenderer.react'),
              "operationModuleProvider": require('../../RelayHandoffModuleProviders').operation('./RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$normalization.graphql', () => require('./RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$normalization.graphql'))
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
  (node/*:: as any*/).hash = "857b2e17cb0d550c928d1e00e8693b97";
}

module.exports = node;
