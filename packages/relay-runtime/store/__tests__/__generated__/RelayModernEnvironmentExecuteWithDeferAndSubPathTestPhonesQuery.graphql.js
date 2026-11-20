/**
 * @generated SignedSource<<fd43623e59cc71d4f9aa48cf2c70ad81>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment.graphql";
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$variables = {
  id: string,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$data = {
  readonly node: ?{
    readonly allPhones?: ?ReadonlyArray<?{
      readonly phoneNumber: ?{
        readonly displayNumber: ?string,
      },
    }>,
    readonly id?: string,
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$fragmentType,
  },
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery = {
  response: RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$data,
  variables: RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$variables,
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
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "Phone",
  "kind": "LinkedField",
  "name": "allPhones",
  "plural": true,
  "selections": [
    (v3/*:: as any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery",
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
              (v4/*:: as any*/),
              {
                "kind": "Defer",
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment"
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
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery",
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
              (v4/*:: as any*/),
              {
                "if": null,
                "kind": "Defer",
                "label": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$defer$PhonesFragment",
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
                      },
                      (v3/*:: as any*/)
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
    "cacheID": "b514fc2d60c74585676058a0d76d1dd3",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      id\n      allPhones {\n        phoneNumber {\n          displayNumber\n        }\n      }\n      ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$defer$PhonesFragment\")\n    }\n    id\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment on User {\n  allPhones {\n    isVerified\n    phoneNumber {\n      displayNumber\n    }\n  }\n}\n"
  }
};
})();

(node/*:: as any*/).hash = "2a2aa7c8efdecd21271297008fa575a8";

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$variables,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$data,
>*/);
