/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<8c098f96adc8af2c32cbb8448adf91c2>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestModuleArgsName_name$fragmentType: FragmentType;
export type useRelayHandoffTestModuleArgsName_name$data = {
  readonly data?: ?{
    readonly text: ?string,
  },
  readonly plaintext: ?string,
  readonly $fragmentType: useRelayHandoffTestModuleArgsName_name$fragmentType,
};
export type useRelayHandoffTestModuleArgsName_name$key = {
  readonly $data?: useRelayHandoffTestModuleArgsName_name$data,
  readonly $fragmentSpreads: useRelayHandoffTestModuleArgsName_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "withData"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestModuleArgsName_name",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "plaintext",
      "storageKey": null
    },
    {
      "condition": "withData",
      "kind": "Condition",
      "passingValue": true,
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
      ]
    }
  ],
  "type": "PlainUserNameRenderer",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "3b1da713dd0acc6c303901f18795812f";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestModuleArgsName_name$fragmentType,
  useRelayHandoffTestModuleArgsName_name$data,
>*/);
