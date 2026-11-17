/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<eb84c85a82c722fd4d365fd962ba410a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency useRelayHandoffTestNestedOuter_name.user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"Inner.react","fragment":"useRelayHandoffTestNestedInner_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useRelayHandoffTestNestedInner_name$fragmentType } from "./useRelayHandoffTestNestedInner_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestNestedOuter_name$fragmentType: FragmentType;
export type useRelayHandoffTestNestedOuter_name$data = {
  readonly plaintext: ?string,
  readonly user: ?{
    readonly nameRenderer: ?{
      readonly __fragmentPropName?: ?string,
      readonly __module_component?: ?string,
      readonly $fragmentSpreads: useRelayHandoffTestNestedInner_name$fragmentType,
    },
  },
  readonly $fragmentType: useRelayHandoffTestNestedOuter_name$fragmentType,
};
export type useRelayHandoffTestNestedOuter_name$key = {
  readonly $data?: useRelayHandoffTestNestedOuter_name$data,
  readonly $fragmentSpreads: useRelayHandoffTestNestedOuter_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestNestedOuter_name",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "plaintext",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "user",
      "plural": false,
      "selections": [
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
                  "args": [
                    {
                      "kind": "Literal",
                      "name": "cond",
                      "value": true
                    }
                  ],
                  "documentName": "useRelayHandoffTestNestedOuter_name",
                  "fragmentName": "useRelayHandoffTestNestedInner_name",
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
      "storageKey": null
    }
  ],
  "type": "PlainUserNameRenderer",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "0d962eb600694abc49d21bd10904be0e";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestNestedOuter_name$fragmentType,
  useRelayHandoffTestNestedOuter_name$data,
>*/);
