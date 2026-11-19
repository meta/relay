/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<13c623fe8b0adc83427bb7988892cba0>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayHandoffUseClientProvidersResolverInline_user.resolverRenderer {"branches":{"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersResolverPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersResolverInline_user$fragmentType } from "./RelayHandoffUseClientProvidersResolverInline_user.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersResolver$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersResolver$data = {
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersResolverInline_user$fragmentType,
  readonly $fragmentType: RelayHandoffUseClientProvidersResolver$fragmentType,
};
export type RelayHandoffUseClientProvidersResolver$key = {
  readonly $data?: RelayHandoffUseClientProvidersResolver$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersResolver$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersResolver",
  "selections": [
    {
      "kind": "InlineDataFragmentSpread",
      "name": "RelayHandoffUseClientProvidersResolverInline_user",
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
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "documentName": "RelayHandoffUseClientProvidersResolverInline_user",
                  "fragmentName": "RelayHandoffUseClientProvidersResolverPlain_name",
                  "fragmentPropName": "name",
                  "kind": "ModuleImport"
                }
              ],
              "type": "PlainUserNameRenderer",
              "abstractKey": null
            }
          ],
          "storageKey": "nameRenderer(supported:\"1AwQS7\")"
        }
      ],
      "args": null,
      "argumentDefinitions": []
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "249ee3686648cf7a9b832f95ade19b6f";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersResolver$fragmentType,
  RelayHandoffUseClientProvidersResolver$data,
>*/);
