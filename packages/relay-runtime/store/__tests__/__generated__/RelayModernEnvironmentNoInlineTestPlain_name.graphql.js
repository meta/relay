/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<8456b45adc54bb8e26e42730a370ed5b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentNoInlineTestPlain_name$fragmentType: FragmentType;
export type RelayModernEnvironmentNoInlineTestPlain_name$data = {
  readonly data: ?{
    readonly text: ?string,
  },
  readonly $fragmentType: RelayModernEnvironmentNoInlineTestPlain_name$fragmentType,
};
export type RelayModernEnvironmentNoInlineTestPlain_name$key = {
  readonly $data?: RelayModernEnvironmentNoInlineTestPlain_name$data,
  readonly $fragmentSpreads: RelayModernEnvironmentNoInlineTestPlain_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentNoInlineTestPlain_name",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PlainUserNameData",
      "kind": "LinkedField",
      "name": "data",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "text",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "PlainUserNameRenderer",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "0fc7f24e63b8f599c0b1bfda6141edb2";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentNoInlineTestPlain_name$fragmentType,
  RelayModernEnvironmentNoInlineTestPlain_name$data,
>*/);
