/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<4a8873128820a716c00cc19e3858e4e8>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { Query__example_client_object$normalization } from "./../../../../../relay-runtime/store/__tests__/resolvers/__generated__/Query__example_client_object$normalization.graphql";
import type { FragmentType } from "relay-runtime";
import {example_client_object as queryExampleClientObjectResolverType} from "../../../../../relay-runtime/store/__tests__/resolvers/ExampleClientObjectResolver.js";
import type { TestResolverContextType } from "../../../../../relay-runtime/mutations/__tests__/TestResolverContextType";
// Type assertion validating that `queryExampleClientObjectResolverType` resolver is correctly implemented.
// A type error here indicates that the type signature of the resolver module is incorrect.
(queryExampleClientObjectResolverType as (
  args: void,
  context: TestResolverContextType,
) => ?Query__example_client_object$normalization);
declare export opaque type useRelayHandoffHydrationTestClientObject_query$fragmentType: FragmentType;
export type useRelayHandoffHydrationTestClientObject_query$data = {
  readonly example_client_object: ?{
    readonly description: ?string,
  },
  readonly me: ?{
    readonly name: ?string,
  },
  readonly $fragmentType: useRelayHandoffHydrationTestClientObject_query$fragmentType,
};
export type useRelayHandoffHydrationTestClientObject_query$key = {
  readonly $data?: useRelayHandoffHydrationTestClientObject_query$data,
  readonly $fragmentSpreads: useRelayHandoffHydrationTestClientObject_query$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "hasClientEdges": true
  },
  "name": "useRelayHandoffHydrationTestClientObject_query",
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
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "kind": "ClientEdgeToClientObject",
      "concreteType": "ClientObject",
      "modelResolvers": null,
      "serverObjectOperations": null,
      "backingField": {
        "alias": null,
        "args": null,
        "fragment": null,
        "kind": "RelayResolver",
        "name": "example_client_object",
        "resolverModule": require('../../../../../relay-runtime/store/__tests__/resolvers/ExampleClientObjectResolver').example_client_object,
        "path": "example_client_object",
        "normalizationInfo": {
          "kind": "OutputType",
          "concreteType": "ClientObject",
          "plural": false,
          "normalizationNode": require('./../../../../../relay-runtime/store/__tests__/resolvers/__generated__/Query__example_client_object$normalization.graphql')
        }
      },
      "linkedField": {
        "alias": null,
        "args": null,
        "concreteType": "ClientObject",
        "kind": "LinkedField",
        "name": "example_client_object",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "description",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    }
  ],
  "type": "Query",
  "abstractKey": null
};

if (__DEV__) {
  (node/*:: as any*/).hash = "fcacdddb42fc49ca8f13daa021fe365c";
}

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  useRelayHandoffHydrationTestClientObject_query$fragmentType,
  useRelayHandoffHydrationTestClientObject_query$data,
>*/);
