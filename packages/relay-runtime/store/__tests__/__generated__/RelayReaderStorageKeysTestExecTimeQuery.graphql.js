/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c1cb49c471b6254a1447512b7e696a26>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { LiveState } from "relay-runtime";
import type { ExecTimeS2CResolvers_IdentityFragment$key } from "./../resolvers/__generated__/ExecTimeS2CResolvers_IdentityFragment.graphql";
import {counter_no_fragment_with_arg as queryCounterNoFragmentWithArgResolverType} from "../resolvers/LiveCounterNoFragmentWithArg.js";
import type { TestResolverContextType } from "../../../mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryCounterNoFragmentWithArgResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryCounterNoFragmentWithArgResolverType as (
  args: {
    prefix: string,
  },
  context: TestResolverContextType,
) => LiveState<?string>);
import {hello_optional_world as queryHelloOptionalWorldResolverType} from "../resolvers/HelloWorldOptionalResolver.js";
// Type assertion validating that `queryHelloOptionalWorldResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryHelloOptionalWorldResolverType as (
  args: {
    world: ?string,
  },
  context: TestResolverContextType,
) => ?string);
import {hello as queryHelloResolverType} from "../resolvers/HelloWorldResolver.js";
// Type assertion validating that `queryHelloResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryHelloResolverType as (
  args: {
    world: string,
  },
  context: TestResolverContextType,
) => ?string);
import {exec_time_s2c_identity as userExecTimeS2cIdentityResolverType} from "../resolvers/ExecTimeS2CResolvers.js";
// Type assertion validating that `userExecTimeS2cIdentityResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(userExecTimeS2cIdentityResolverType as (
  rootKey: ExecTimeS2CResolvers_IdentityFragment$key,
  args: void,
  context: TestResolverContextType,
) => ?string);
export type RelayReaderStorageKeysTestExecTimeQuery$variables = {
  prefix: string,
  world?: ?string,
};
export type RelayReaderStorageKeysTestExecTimeQuery$data = {
  readonly counter_no_fragment_with_arg: ?string,
  readonly hello: ?string,
  readonly hello_optional_world: ?string,
  readonly me: ?{
    readonly exec_time_s2c_identity: ?string,
  },
};
export type RelayReaderStorageKeysTestExecTimeQuery = {
  response: RelayReaderStorageKeysTestExecTimeQuery$data,
  variables: RelayReaderStorageKeysTestExecTimeQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "prefix"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "world"
},
v2 = [
  {
    "kind": "Literal",
    "name": "world",
    "value": "Alice"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "world",
    "variableName": "world"
  }
],
v4 = [
  {
    "kind": "Variable",
    "name": "prefix",
    "variableName": "prefix"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayReaderStorageKeysTestExecTimeQuery",
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
            "alias": null,
            "args": null,
            "fragment": {
              "args": null,
              "kind": "FragmentSpread",
              "name": "ExecTimeS2CResolvers_IdentityFragment"
            },
            "kind": "RelayResolver",
            "name": "exec_time_s2c_identity",
            "resolverModule": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_identity,
            "path": "me.exec_time_s2c_identity"
          }
        ],
        "storageKey": null
      },
      {
        "kind": "ClientExtension",
        "selections": [
          {
            "alias": null,
            "args": (v2/*:: as any*/),
            "fragment": null,
            "kind": "RelayResolver",
            "name": "hello",
            "resolverModule": require('../resolvers/HelloWorldResolver').hello,
            "path": "hello"
          },
          {
            "alias": null,
            "args": (v3/*:: as any*/),
            "fragment": null,
            "kind": "RelayResolver",
            "name": "hello_optional_world",
            "resolverModule": require('../resolvers/HelloWorldOptionalResolver').hello_optional_world,
            "path": "hello_optional_world"
          },
          {
            "alias": null,
            "args": (v4/*:: as any*/),
            "fragment": null,
            "kind": "RelayLiveResolver",
            "name": "counter_no_fragment_with_arg",
            "resolverModule": require('../resolvers/LiveCounterNoFragmentWithArg').counter_no_fragment_with_arg,
            "path": "counter_no_fragment_with_arg"
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "RelayReaderStorageKeysTestExecTimeQuery",
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
            "name": "exec_time_s2c_identity",
            "args": null,
            "kind": "RelayResolver",
            "storageKey": null,
            "isOutputType": true,
            "resolverInfo": {
              "resolverFunction": require('../resolvers/ExecTimeS2CResolvers').exec_time_s2c_identity,
              "rootFragment": require('../resolvers/__generated__/ExecTimeS2CResolvers_IdentityFragment$normalization.graphql')
            },
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                (v5/*:: as any*/)
              ],
              "type": "User",
              "abstractKey": null
            }
          },
          (v5/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "kind": "ClientExtension",
        "selections": [
          {
            "name": "hello",
            "args": (v2/*:: as any*/),
            "kind": "RelayResolver",
            "storageKey": "hello(world:\"Alice\")",
            "isOutputType": true,
            "resolverInfo": {
              "resolverFunction": require('../resolvers/HelloWorldResolver').hello,
              "rootFragment": null
            },
            "fragment": null
          },
          {
            "name": "hello_optional_world",
            "args": (v3/*:: as any*/),
            "kind": "RelayResolver",
            "storageKey": null,
            "isOutputType": true,
            "resolverInfo": {
              "resolverFunction": require('../resolvers/HelloWorldOptionalResolver').hello_optional_world,
              "rootFragment": null
            },
            "fragment": null
          },
          {
            "name": "counter_no_fragment_with_arg",
            "args": (v4/*:: as any*/),
            "kind": "RelayLiveResolver",
            "storageKey": null,
            "isOutputType": true,
            "resolverInfo": {
              "resolverFunction": require('../resolvers/LiveCounterNoFragmentWithArg').counter_no_fragment_with_arg,
              "rootFragment": null
            },
            "fragment": null
          }
        ]
      }
    ],
    "exec_time_resolvers_enabled_provider": require('../relayReaderTestExecTimeResolversTrueProvider'),
    "has_server_to_client_resolvers": true
  },
  "params": {
    "cacheID": "72d2cc4b36e62684eae51bccd0a282b2",
    "id": null,
    "metadata": {
      "server_variables": []
    },
    "name": "RelayReaderStorageKeysTestExecTimeQuery",
    "operationKind": "query",
    "text": "query RelayReaderStorageKeysTestExecTimeQuery {\n  me {\n    ...ExecTimeS2CResolvers_IdentityFragment\n    id\n  }\n}\n\nfragment ExecTimeS2CResolvers_IdentityFragment on User {\n  id\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "ee9d940a8f0d6b32306093873f273f65";
}

if (node.operation.exec_time_resolvers_enabled_provider?.get() === true) {
  (node.params.metadata/*:: as any*/).operation = node.operation;
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReaderStorageKeysTestExecTimeQuery$variables,
  RelayReaderStorageKeysTestExecTimeQuery$data,
>*/);
