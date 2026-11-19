/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<5d9e7f3fefd25fd3718ca9e738ac8807>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { RelayHandoffUseClientProvidersResolver$key } from "./RelayHandoffUseClientProvidersResolver.graphql";
import type { FragmentType } from "relay-runtime";
import {handoffRendererProp as userHandoffRendererPropResolverType} from "../RelayHandoffUseClientProvidersResolver.js";
// Type assertion validating that `userHandoffRendererPropResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userHandoffRendererPropResolverType as (
  rootKey: RelayHandoffUseClientProvidersResolver$key,
) => ?string);
declare export opaque type RelayHandoffUseClientProvidersTestResolver_user$fragmentType: FragmentType;
export type RelayHandoffUseClientProvidersTestResolver_user$data = {
  readonly handoffRendererProp: ?string,
  readonly $fragmentType: RelayHandoffUseClientProvidersTestResolver_user$fragmentType,
};
export type RelayHandoffUseClientProvidersTestResolver_user$key = {
  readonly $data?: RelayHandoffUseClientProvidersTestResolver_user$data,
  readonly $fragmentSpreads: RelayHandoffUseClientProvidersTestResolver_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayHandoffUseClientProvidersTestResolver_user",
  "selections": [
    {
      "alias": null,
      "args": null,
      "fragment": {
        "args": null,
        "kind": "FragmentSpread",
        "name": "RelayHandoffUseClientProvidersResolver"
      },
      "kind": "RelayResolver",
      "name": "handoffRendererProp",
      "resolverModule": require('../RelayHandoffUseClientProvidersResolver').handoffRendererProp,
      "path": "handoffRendererProp"
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "4c3aa05160024a2c561b7236aefaf7dc";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayHandoffUseClientProvidersTestResolver_user$fragmentType,
  RelayHandoffUseClientProvidersTestResolver_user$data,
>*/);
