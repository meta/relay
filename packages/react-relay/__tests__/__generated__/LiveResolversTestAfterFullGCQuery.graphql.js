/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<bfd62f913b1a6b7c5094df4be889750e>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ClientRequest, ClientQuery } from 'relay-runtime';
import type { LiveState } from "relay-runtime";
import {counter_no_fragment as queryCounterNoFragmentResolverType} from "../../../relay-runtime/store/__tests__/resolvers/LiveCounterNoFragment.js";
import type { TestResolverContextType } from "../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryCounterNoFragmentResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryCounterNoFragmentResolverType as (
  args: void,
  context: TestResolverContextType,
) => LiveState<?number>);
export type LiveResolversTestAfterFullGCQuery$variables = {};
export type LiveResolversTestAfterFullGCQuery$data = {
  readonly counter_no_fragment: ?number,
};
export type LiveResolversTestAfterFullGCQuery = {
  response: LiveResolversTestAfterFullGCQuery$data,
  variables: LiveResolversTestAfterFullGCQuery$variables,
};
*/

var node/*: ClientRequest*/ = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "LiveResolversTestAfterFullGCQuery",
    "selections": [
      {
        "kind": "ClientExtension",
        "selections": [
          {
            "alias": null,
            "args": null,
            "fragment": null,
            "kind": "RelayLiveResolver",
            "name": "counter_no_fragment",
            "resolverModule": require('../../../relay-runtime/store/__tests__/resolvers/LiveCounterNoFragment').counter_no_fragment,
            "path": "counter_no_fragment"
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "LiveResolversTestAfterFullGCQuery",
    "selections": [
      {
        "kind": "ClientExtension",
        "selections": [
          {
            "name": "counter_no_fragment",
            "args": null,
            "fragment": null,
            "kind": "RelayResolver",
            "storageKey": null,
            "isOutputType": true
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "b575a6f1a45a5e9f4c7f5702a8597be6",
    "id": null,
    "metadata": {},
    "name": "LiveResolversTestAfterFullGCQuery",
    "operationKind": "query",
    "text": null
  }
};

if (__DEV__) {
  (node/*:: as any*/).hash = "ee3ec3397d35c524f30dc778818b6a48";
}

module.exports = ((node/*:: as any*/)/*:: as ClientQuery<
  LiveResolversTestAfterFullGCQuery$variables,
  LiveResolversTestAfterFullGCQuery$data,
>*/);
