/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<554b40a917c17d490685a4ac2d08d105>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestPlainName_name$fragmentType: FragmentType;
export type RelayServerHandoffTestPlainName_name$data = {
  readonly data: ?{
    readonly text: ?string,
  },
  readonly $fragmentType: RelayServerHandoffTestPlainName_name$fragmentType,
};
export type RelayServerHandoffTestPlainName_name$key = {
  readonly $data?: RelayServerHandoffTestPlainName_name$data,
  readonly $fragmentSpreads: RelayServerHandoffTestPlainName_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestPlainName_name",
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
  (node/*:: as any*/).hash = "3edf14f1960741a6bbd5933d98af3b7d";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestPlainName_name$fragmentType,
  RelayServerHandoffTestPlainName_name$data,
>*/);
