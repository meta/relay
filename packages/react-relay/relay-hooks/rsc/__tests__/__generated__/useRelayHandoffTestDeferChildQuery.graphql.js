/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<a2e379f2ff636c2f2c1fd8c0b83dc000>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestDeferParent_user$fragmentType } from "./useRelayHandoffTestDeferParent_user.graphql";
export type useRelayHandoffTestDeferChildQuery$variables = {};
export type useRelayHandoffTestDeferChildQuery$data = {
  readonly me: ?{
    readonly parent: {
      readonly $fragmentSpreads: useRelayHandoffTestDeferParent_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestDeferChildQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestDeferChildQuery$data,
  variables: useRelayHandoffTestDeferChildQuery$variables,
};
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestDeferChildQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "useRelayHandoffTestDeferParent_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "parent"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useRelayHandoffTestDeferChildQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "me",
        "plural": false,
        "selections": [
          {
            "fragment": require('./useRelayHandoffTestDeferParent_user$normalization.graphql'),
            "kind": "FragmentSpread"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "32c3c7738050fea264db6480bf8110c2",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestDeferChildQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestDeferChildQuery {\n  me {\n    ...useRelayHandoffTestDeferParent_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestDeferChild_user on User {\n  lastName\n}\n\nfragment useRelayHandoffTestDeferParent_user on User {\n  name\n  ...useRelayHandoffTestDeferChild_user @defer(label: \"useRelayHandoffTestDeferParent_user$defer$child\")\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestDeferParent_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestDeferParent_user.graphql')
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "60ace763004e3e43c10557a6af47c4de";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestDeferChildQuery$variables,
  useRelayHandoffTestDeferChildQuery$data,
>*/);
