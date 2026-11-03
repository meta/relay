/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<d05d8b517a1c93155d9a13fe3c0106b6>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentNoInlineTestPlain_name$fragmentType } from "./RelayModernEnvironmentNoInlineTestPlain_name.graphql";
export type RelayModernEnvironmentNoInlineTestUnionQuery$variables = {};
export type RelayModernEnvironmentNoInlineTestUnionQuery$data = {
  readonly me: ?{
    readonly nameRenderer: ?{
      readonly data?: ?{
        readonly markup: ?string,
      },
      readonly plain: ?{
        readonly $fragmentSpreads: RelayModernEnvironmentNoInlineTestPlain_name$fragmentType,
      },
    },
  },
};
export type RelayModernEnvironmentNoInlineTestUnionQuery = {
  response: RelayModernEnvironmentNoInlineTestUnionQuery$data,
  variables: RelayModernEnvironmentNoInlineTestUnionQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
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
    "name": "RelayModernEnvironmentNoInlineTestUnionQuery",
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
                      "name": "RelayModernEnvironmentNoInlineTestPlain_name"
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
    "name": "RelayModernEnvironmentNoInlineTestUnionQuery",
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
                    "args": null,
                    "fragment": require('./RelayModernEnvironmentNoInlineTestPlain_name$normalization.graphql'),
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
    "cacheID": "119781bd5ee22324791d30151a6fc6db",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentNoInlineTestUnionQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentNoInlineTestUnionQuery {\n  me {\n    nameRenderer {\n      __typename\n      ...RelayModernEnvironmentNoInlineTestPlain_name\n      ... on MarkdownUserNameRenderer {\n        data {\n          markup\n          id\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment RelayModernEnvironmentNoInlineTestPlain_name on PlainUserNameRenderer {\n  data {\n    text\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "7353d1e1dc2e4028f661f6403c4e9147";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentNoInlineTestUnionQuery$variables,
  RelayModernEnvironmentNoInlineTestUnionQuery$data,
>*/);
