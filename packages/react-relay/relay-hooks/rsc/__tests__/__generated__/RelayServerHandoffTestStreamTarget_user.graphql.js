/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<b61671b76a5702fec5e8965593ff62c7>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayServerHandoffTestStreamTarget_user$fragmentType: FragmentType;
export type RelayServerHandoffTestStreamTarget_user$data = {
  readonly friends: ?{
    readonly edges: ?ReadonlyArray<?{
      readonly node: ?{
        readonly friends: ?{
          readonly edges: ?ReadonlyArray<?{
            readonly node: ?{
              readonly name: ?string,
            },
          }>,
        },
        readonly name: ?string,
      },
    }>,
  },
  readonly $fragmentType: RelayServerHandoffTestStreamTarget_user$fragmentType,
};
export type RelayServerHandoffTestStreamTarget_user$key = {
  readonly $data?: RelayServerHandoffTestStreamTarget_user$data,
  readonly $fragmentSpreads: RelayServerHandoffTestStreamTarget_user$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayServerHandoffTestStreamTarget_user",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 10
        }
      ],
      "concreteType": "FriendsConnection",
      "kind": "LinkedField",
      "name": "friends",
      "plural": false,
      "selections": [
        {
          "kind": "Stream",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "FriendsEdge",
              "kind": "LinkedField",
              "name": "edges",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "User",
                  "kind": "LinkedField",
                  "name": "node",
                  "plural": false,
                  "selections": [
                    (v0/*:: as any*/),
                    {
                      "alias": null,
                      "args": [
                        {
                          "kind": "Literal",
                          "name": "first",
                          "value": 3
                        }
                      ],
                      "concreteType": "FriendsConnection",
                      "kind": "LinkedField",
                      "name": "friends",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "FriendsEdge",
                          "kind": "LinkedField",
                          "name": "edges",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "User",
                              "kind": "LinkedField",
                              "name": "node",
                              "plural": false,
                              "selections": [
                                (v0/*:: as any*/)
                              ],
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "storageKey": "friends(first:3)"
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ]
        }
      ],
      "storageKey": "friends(first:10)"
    }
  ],
  "type": "User",
  "abstractKey": null
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "f8180f2347bcd17f285eac28cefd76eb";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayServerHandoffTestStreamTarget_user$fragmentType,
  RelayServerHandoffTestStreamTarget_user$data,
>*/);
