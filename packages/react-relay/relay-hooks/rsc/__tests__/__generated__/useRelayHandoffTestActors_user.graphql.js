/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<fab274c5530e7e1723a7e8561a74e8be>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type useRelayHandoffTestActors_user$fragmentType: FragmentType;
export type useRelayHandoffTestActors_user$data = {
  readonly actors: ?ReadonlyArray<?{
    readonly name: ?string,
  }>,
  readonly $fragmentType: useRelayHandoffTestActors_user$fragmentType,
};
export type useRelayHandoffTestActors_user$key = {
  readonly $data?: useRelayHandoffTestActors_user$data,
  readonly $fragmentSpreads: useRelayHandoffTestActors_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useRelayHandoffTestActors_user",
  "selections": [
    {
      "kind": "Stream",
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "actors",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "name",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ]
    }
  ],
  "type": "User",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "c560d985328be2ca62d05056b784ec92";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffTestActors_user$fragmentType,
  useRelayHandoffTestActors_user$data,
>*/);
