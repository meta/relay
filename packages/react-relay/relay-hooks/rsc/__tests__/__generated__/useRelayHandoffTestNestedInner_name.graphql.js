/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<389ccdf18017b4e6e5ac22bcf4311e97>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestNestedInner_name$fragmentType: FragmentType;
export type useRelayHandoffTestNestedInner_name$data = {
  readonly data?: ?{
    readonly text: ?string,
  },
  readonly plaintext: ?string,
  readonly $fragmentType: useRelayHandoffTestNestedInner_name$fragmentType,
};
export type useRelayHandoffTestNestedInner_name$key = {
  readonly $data?: useRelayHandoffTestNestedInner_name$data,
  readonly $fragmentSpreads: useRelayHandoffTestNestedInner_name$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [
    {
      "defaultValue": false,
      "kind": "LocalArgument",
      "name": "cond"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestNestedInner_name",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "plaintext",
      "storageKey": null
    },
    {
      "condition": "cond",
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
  (node/*:: as any*/).hash = "afab71b17fcbac7d337ce95783c4fb82";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestNestedInner_name$fragmentType,
  useRelayHandoffTestNestedInner_name$data,
>*/);
