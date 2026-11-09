/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<47b2c54fce4e3c7023386f4657354f38>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestResolverServer_user$fragmentType } from "./RelayServerHandoffTestResolverServer_user.graphql";
import {relayServerHandoffTestJoined as userRelayServerHandoffTestJoinedResolverType} from "../RelayServerHandoffTestJoinedResolver.js";
import type { TestResolverContextType } from "../../../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `userRelayServerHandoffTestJoinedResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userRelayServerHandoffTestJoinedResolverType as (
  args: void,
  context: TestResolverContextType,
) => ?unknown);
export type RelayServerHandoffTestResolverQuery$variables = {};
export type RelayServerHandoffTestResolverQuery$data = {
  readonly me: ?{
    readonly $serverFragment: true,
    readonly relayServerHandoffTestJoined: ?ReturnType<typeof userRelayServerHandoffTestJoinedResolverType>,
    readonly $fragmentSpreads: RelayServerHandoffTestResolverServer_user$fragmentType,
  },
};
export type RelayServerHandoffTestResolverQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestResolverQuery$data,
  variables: RelayServerHandoffTestResolverQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = {
  "name": "relayServerHandoffTestJoined",
  "args": null,
  "fragment": null,
  "kind": "RelayResolver",
  "storageKey": null,
  "isOutputType": true
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestResolverQuery",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "RelayServerHandoffTestResolverServer_user"
          },
          {
            "kind": "ClientExtension",
            "selections": [
              {
                "alias": null,
                "args": null,
                "fragment": null,
                "kind": "RelayResolver",
                "name": "relayServerHandoffTestJoined",
                "resolverModule": require('../RelayServerHandoffTestJoinedResolver').relayServerHandoffTestJoined,
                "path": "me.relayServerHandoffTestJoined"
              }
            ]
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
    "name": "RelayServerHandoffTestResolverQuery",
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
            "fragment": require('./RelayServerHandoffTestDeferred_user$normalization.graphql'),
            "kind": "FragmentSpread"
          },
          {
            "kind": "ClientExtension",
            "selections": [
              (v0/*:: as any*/),
              (v0/*:: as any*/)
            ]
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
    "cacheID": "c4260c527555bd2bf5a21619dac81a1f",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestResolverQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestResolverQuery {\n  me {\n    ...RelayServerHandoffTestResolverServer_user\n    id\n  }\n}\n\nfragment RelayServerHandoffTestDeferred_user on User {\n  emailAddresses\n}\n\nfragment RelayServerHandoffTestResolverServer_user on User {\n  ...RelayServerHandoffTestDeferred_user\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestDeferred_user$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestDeferred_user.graphql')
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "2c92489acaa94311bd8e31fbc8b02f55";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestResolverQuery$variables,
  RelayServerHandoffTestResolverQuery$data,
>*/);
