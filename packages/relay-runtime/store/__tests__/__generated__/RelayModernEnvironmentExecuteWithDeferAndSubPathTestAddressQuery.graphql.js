/**
 * @generated SignedSource<<399fd526d4d897ef162b23f7aa9567b4>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$fragmentType } from "./RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment.graphql";
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$variables = {
  id: string,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$data = {
  readonly node: ?{
    readonly id?: string,
    readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$fragmentType,
  },
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery = {
  response: RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$data,
  variables: RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$variables,
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery",
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
              {
                "kind": "Defer",
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment"
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
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery",
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
              {
                "if": null,
                "kind": "Defer",
                "label": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$defer$AddressFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "StreetAddress",
                    "kind": "LinkedField",
                    "name": "address",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "city",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "country",
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
    "cacheID": "c84e3031b9d6b7dd2abe4e2c5e48a42c",
    "id": null,
    "metadata": {},
    "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery",
    "operationKind": "query",
    "text": "query RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      id\n      ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment @defer(label: \"RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$defer$AddressFragment\")\n    }\n    id\n  }\n}\n\nfragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment on User {\n  address {\n    city\n    country\n  }\n}\n"
  }
};
})();

(node/*:: as any*/).hash = "c30cda65cc7c383f034293ef3abf08eb";

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$variables,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$data,
>*/);
