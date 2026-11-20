/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<6f6535ffbc9b7458ef23684766e33ea6>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment.graphql";
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$variables = {
  id: string,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$data = {
  readonly node: ?({
    readonly __typename: "User",
    readonly allPhones: ?ReadonlyArray<?{
      readonly phoneNumber: ?{
        readonly displayNumber: ?string,
      },
    }>,
    readonly id: string,
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$fragmentType,
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other",
  }),
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery = {
  response: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$data,
  variables: RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "Phone",
  "kind": "LinkedField",
  "name": "allPhones",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PhoneNumber",
      "kind": "LinkedField",
      "name": "phoneNumber",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "displayNumber",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "kind": "Defer",
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment"
                  }
                ]
              }
            ],
            "type": "User",
            "abstractKey": null
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              {
                "if": null,
                "kind": "Defer",
                "label": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$defer$NestedOuterFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Phone",
                    "kind": "LinkedField",
                    "name": "allPhones",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "isVerified",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "if": null,
                    "kind": "Defer",
                    "label": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$defer$NestedInnerFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "name",
                        "storageKey": null
                      }
                    ]
                  }
                ]
              }
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "450865a9ea11afe26c8f79351f5552cb",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      id\n      allPhones {\n        phoneNumber {\n          displayNumber\n        }\n      }\n      ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$defer$NestedOuterFragment\")\n    }\n    id\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment on User {\n  name\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment on User {\n  allPhones {\n    isVerified\n  }\n  ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$defer$NestedInnerFragment\")\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "dfc01954ee757284b4310b2d0208711c";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$variables,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$data,
>*/);
