/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<362dc8f2fcf7b37eb62c5457cc564b4b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayHandoffUseClientProvidersHydrationTest_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"../RelayHandoffTestPlainRenderer.react","fragment":"RelayHandoffUseClientProvidersTestPlain_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersTestPlain_name$fragmentType } from "./RelayHandoffUseClientProvidersTestPlain_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayHandoffUseClientProvidersHydrationTest_user$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersHydrationTest_user$data = {
  readonly name: ?string,
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestPlain_name$fragmentType,
  },
  readonly $fragmentType: RelayHandoffUseClientProvidersHydrationTest_user$fragmentType,
};
export type RelayHandoffUseClientProvidersHydrationTest_user$key = {
  readonly $data?: RelayHandoffUseClientProvidersHydrationTest_user$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersHydrationTest_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersHydrationTest_user",
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
              "documentName": "RelayHandoffUseClientProvidersHydrationTest_user",
              "fragmentName": "RelayHandoffUseClientProvidersTestPlain_name",
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
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "f14216b4dc1f723d0ee60ec45639f731";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersHydrationTest_user$fragmentType,
  RelayHandoffUseClientProvidersHydrationTest_user$data,
>*/);
