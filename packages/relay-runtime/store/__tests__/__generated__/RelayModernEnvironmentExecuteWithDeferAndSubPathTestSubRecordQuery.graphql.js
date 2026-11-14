/**
 * @generated SignedSource<<0000000000000000000000000000000000>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment.graphql";
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$variables = {
  id: string,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$data = {
  readonly node: ?{
    readonly allPhones?: ?ReadonlyArray<?{
      readonly phoneNumber: ?{
        readonly displayNumber: ?string,
      },
    }>,
    readonly id?: string,
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$fragmentType,
  },
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery = {
  response: RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$data,
  variables: RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$variables,
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
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery",
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
                    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment"
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
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery",
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
                "label": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$defer$SubRecordFragment",
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
                        "concreteType": "PhoneNumber",
                        "kind": "LinkedField",
                        "name": "phoneNumber",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "countryCode",
                            "storageKey": null
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
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      id\n      allPhones {\n        phoneNumber {\n          displayNumber\n        }\n      }\n      ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$defer$SubRecordFragment\")\n    }\n    id\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment on User {\n  allPhones {\n    phoneNumber {\n      countryCode\n    }\n  }\n}\n"
  }
};
})();

(node/*:: as any*/).hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3";

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$variables,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$data,
>*/);
