/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<7a70fdd43124df11b348066c1ce4196b>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { useRelayHandoffTestProvided_user$fragmentType } from "./useRelayHandoffTestProvided_user.graphql";
export type useRelayHandoffTestProvidedQuery$variables = {};
export type useRelayHandoffTestProvidedQuery$data = {
  readonly me: ?{
    readonly provided: {
      readonly $fragmentSpreads: useRelayHandoffTestProvided_user$fragmentType,
    },
  },
};
export type useRelayHandoffTestProvidedQuery = {
  readonly $serverOperation: true,
  response: useRelayHandoffTestProvidedQuery$data,
  variables: useRelayHandoffTestProvidedQuery$variables,
};
({
  "__relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider": require('../../../__tests__/RelayProvider_returnsTrue.relayprovider')
} as {
  readonly __relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider: {
    readonly get: () => boolean,
  },
});
*/

var node/*: ServerRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useRelayHandoffTestProvidedQuery",
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
                  "name": "useRelayHandoffTestProvided_user"
                }
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "provided"
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
    "argumentDefinitions": [
      {
        "defaultValue": null,
        "kind": "LocalArgument",
        "name": "__relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider"
      }
    ],
    "kind": "Operation",
    "name": "useRelayHandoffTestProvidedQuery",
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
            "fragment": require('./useRelayHandoffTestProvided_user$normalization.graphql'),
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
    "cacheID": "9e57012a92249f3bff593b46d68119a6",
    "id": null,
    "metadata": {},
    "name": "useRelayHandoffTestProvidedQuery",
    "operationKind": "query",
    "text": "query useRelayHandoffTestProvidedQuery(\n  $__relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider: Boolean!\n) {\n  me {\n    ...useRelayHandoffTestProvided_user\n    id\n  }\n}\n\nfragment useRelayHandoffTestProvided_user on User {\n  name @include(if: $__relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider)\n}\n",
    "providedVariables": {
      "__relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider": require('../../../__tests__/RelayProvider_returnsTrue.relayprovider')
    }
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./useRelayHandoffTestProvided_user$normalization.graphql'),
        "fragment": require('./useRelayHandoffTestProvided_user.graphql'),
        "rootVariables": [
          "__relay_internal__pv____tests__RelayProvider_returnsTruerelayprovider"
        ]
      }
    ]
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "4d5b0604e9571cb3552cc566f3db1fe4";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  useRelayHandoffTestProvidedQuery$variables,
  useRelayHandoffTestProvidedQuery$data,
>*/);
