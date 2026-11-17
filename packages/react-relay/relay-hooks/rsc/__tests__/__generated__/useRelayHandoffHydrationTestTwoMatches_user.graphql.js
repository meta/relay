/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c23ff74b9f5a8d89928b455364590a3d>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency useRelayHandoffHydrationTestTwoMatches_user.nameRenderer {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffHydrationTestDefaulted_name$normalization.graphql"}},"plural":false}
// @dataDrivenDependency useRelayHandoffHydrationTestTwoMatches_user.nameRendererForContext {"branches":{"PlainUserNameRenderer":{"component":"PlainUserNameRenderer.react","fragment":"useRelayHandoffHydrationTestDefaulted_name$normalization.graphql"}},"plural":false}

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { useRelayHandoffHydrationTestDefaulted_name$fragmentType } from "./useRelayHandoffHydrationTestDefaulted_name.graphql";
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffHydrationTestTwoMatches_user$fragmentType: FragmentType;
export type useRelayHandoffHydrationTestTwoMatches_user$data = {
  readonly name: ?string,
  readonly nameRenderer: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: useRelayHandoffHydrationTestDefaulted_name$fragmentType,
  },
  readonly nameRendererForContext: ?{
    readonly __fragmentPropName?: ?string,
    readonly __module_component?: ?string,
    readonly $fragmentSpreads: useRelayHandoffHydrationTestDefaulted_name$fragmentType,
  },
  readonly $fragmentType: useRelayHandoffHydrationTestTwoMatches_user$fragmentType,
};
export type useRelayHandoffHydrationTestTwoMatches_user$key = {
  readonly $data?: useRelayHandoffHydrationTestTwoMatches_user$data,
  readonly $fragmentSpreads: useRelayHandoffHydrationTestTwoMatches_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = (function(){
var v0 = {
  "kind": "Literal",
  "name": "supported",
  "value": "1AwQS7"
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffHydrationTestTwoMatches_user",
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
        (v0/*:: as any*/)
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
                  "name": "withData",
                  "value": true
                }
              ],
              "documentName": "useRelayHandoffHydrationTestTwoMatches_user_with",
              "fragmentName": "useRelayHandoffHydrationTestDefaulted_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport"
            }
          ],
          "type": "PlainUserNameRenderer",
          "abstractKey": null
        }
      ],
      "storageKey": "nameRenderer(supported:\"1AwQS7\")"
    },
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "context",
          "value": "HEADER"
        },
        (v0/*:: as any*/)
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "nameRendererForContext",
      "plural": false,
      "selections": [
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "args": null,
              "documentName": "useRelayHandoffHydrationTestTwoMatches_user_default",
              "fragmentName": "useRelayHandoffHydrationTestDefaulted_name",
              "fragmentPropName": "name",
              "kind": "ModuleImport"
            }
          ],
          "type": "PlainUserNameRenderer",
          "abstractKey": null
        }
      ],
      "storageKey": "nameRendererForContext(context:\"HEADER\",supported:\"1AwQS7\")"
    }
  ],
  "type": "User",
  "abstractKey": null
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "a947d1883d7a78dc55ead79f38c122ff";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffHydrationTestTwoMatches_user$fragmentType,
  useRelayHandoffHydrationTestTwoMatches_user$data,
>*/);
