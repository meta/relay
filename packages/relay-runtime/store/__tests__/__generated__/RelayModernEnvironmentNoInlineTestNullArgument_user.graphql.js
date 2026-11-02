/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<cea0b52e721354960d51b1254ff0802a>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentNoInlineTestNullArgument_user$fragmentType: FragmentType;
export type RelayModernEnvironmentNoInlineTestNullArgument_user$data = {
  readonly profilePicture2: ?{
    readonly uri: ?string,
  },
  readonly $fragmentType: RelayModernEnvironmentNoInlineTestNullArgument_user$fragmentType,
};
export type RelayModernEnvironmentNoInlineTestNullArgument_user$key = {
  readonly $data?: RelayModernEnvironmentNoInlineTestNullArgument_user$data,
  readonly $fragmentSpreads: RelayModernEnvironmentNoInlineTestNullArgument_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [
    {
      "defaultValue": "SMALL",
      "kind": "LocalArgument",
      "name": "preset"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentNoInlineTestNullArgument_user",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "preset",
          "variableName": "preset"
        }
      ],
      "concreteType": "Image",
      "kind": "LinkedField",
      "name": "profilePicture2",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "uri",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "5aa32d5af2b4efa15ab795728b73113b";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentNoInlineTestNullArgument_user$fragmentType,
  RelayModernEnvironmentNoInlineTestNullArgument_user$data,
>*/);
