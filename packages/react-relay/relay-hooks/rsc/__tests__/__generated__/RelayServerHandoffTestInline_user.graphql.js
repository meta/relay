/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b996afed4a560646a3d21c53572f5277>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { InlineFragment, ReaderInlineDataFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestInline_user$fragmentType: FragmentType;
export type RelayServerHandoffTestInline_user$data = {
  readonly firstName: ?string,
  readonly $fragmentType: RelayServerHandoffTestInline_user$fragmentType,
};
export type RelayServerHandoffTestInline_user$key = {
  readonly $data?: RelayServerHandoffTestInline_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestInline_user$fragmentType,
  ...
};
*/

var node/*: ReaderInlineDataFragment*/ = {
  "kind": "InlineDataFragment",
  "name": "RelayServerHandoffTestInline_user"
};

if (__DEV__) {
  (node/*:: as any*/).hash = "6927addbc1df1e4148a2e8e8bf50dc2a";
}

module.exports = ((node/*:: as any*/)/*:: as InlineFragment<
  RelayServerHandoffTestInline_user$fragmentType,
  RelayServerHandoffTestInline_user$data,
>*/);
