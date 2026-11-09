/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<51184cb25531a58d1dace0f234641bff>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ServerQuery, ServerRequest } from 'relay-runtime';
import type { RelayServerHandoffTestPlainName_name$fragmentType } from "./RelayServerHandoffTestPlainName_name.graphql";
export type RelayServerHandoffTestUnionQuery$variables = {};
export type RelayServerHandoffTestUnionQuery$data = {
  readonly me: ?{
    readonly nameRenderer: ?{
      readonly data?: ?{
        readonly markup: ?string,
      },
      readonly plain: ?{
        readonly $fragmentSpreads: RelayServerHandoffTestPlainName_name$fragmentType,
      },
    },
  },
};
export type RelayServerHandoffTestUnionQuery = {
  readonly $serverOperation: true,
  response: RelayServerHandoffTestUnionQuery$data,
  variables: RelayServerHandoffTestUnionQuery$variables,
};
*/

var node/*: ServerRequest*/ = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "markup",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayServerHandoffTestUnionQuery",
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
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
            "plural": false,
            "selections": [
              {
                "fragment": {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "args": null,
                      "kind": "FragmentSpread",
                      "name": "RelayServerHandoffTestPlainName_name"
                    }
                  ],
                  "type": "PlainUserNameRenderer",
                  "abstractKey": null
                },
                "kind": "AliasedInlineFragmentSpread",
                "name": "plain"
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "MarkdownUserNameData",
                    "kind": "LinkedField",
                    "name": "data",
                    "plural": false,
                    "selections": [
                      (v0/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "type": "MarkdownUserNameRenderer",
                "abstractKey": null
              }
            ],
            "storageKey": null
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
    "name": "RelayServerHandoffTestUnionQuery",
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
            "concreteType": null,
            "kind": "LinkedField",
            "name": "nameRenderer",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "fragment": require('./RelayServerHandoffTestPlainName_name$normalization.graphql'),
                    "kind": "FragmentSpread"
                  }
                ],
                "type": "PlainUserNameRenderer",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "MarkdownUserNameData",
                    "kind": "LinkedField",
                    "name": "data",
                    "plural": false,
                    "selections": [
                      (v0/*:: as any*/),
                      (v1/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "type": "MarkdownUserNameRenderer",
                "abstractKey": null
              }
            ],
            "storageKey": null
          },
          (v1/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "416c8e46e3b34bf645e701b169600e97",
    "id": null,
    "metadata": {},
    "name": "RelayServerHandoffTestUnionQuery",
    "operationKind": "query",
    "text": "query RelayServerHandoffTestUnionQuery {\n  me {\n    nameRenderer {\n      __typename\n      ...RelayServerHandoffTestPlainName_name\n      ... on MarkdownUserNameRenderer {\n        data {\n          markup\n          id\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment RelayServerHandoffTestPlainName_name on PlainUserNameRenderer {\n  data {\n    text\n    id\n  }\n}\n"
  },
  "serverHandoff": {
    "clientFragments": [
      {
        "normalization": require('./RelayServerHandoffTestPlainName_name$normalization.graphql'),
        "fragment": require('./RelayServerHandoffTestPlainName_name.graphql')
      }
    ]
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "4d57402eb3da6a986682df48daea1ebc";
}

module.exports = ((node/*:: as any*/)/*:: as ServerQuery<
  RelayServerHandoffTestUnionQuery$variables,
  RelayServerHandoffTestUnionQuery$data,
>*/);
