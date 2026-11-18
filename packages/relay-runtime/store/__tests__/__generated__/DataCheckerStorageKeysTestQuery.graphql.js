/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<666f2bc08edeacafa8fb0dad60d43322>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type DataCheckerStorageKeysTestQuery$variables = {
  ids?: ?ReadonlyArray<string>,
  site?: ?string,
  size?: ?ReadonlyArray<?number>,
};
export type DataCheckerStorageKeysTestQuery$data = {
  readonly me: ?{
    readonly accounts: ?ReadonlyArray<?{
      readonly name: ?string,
    }>,
    readonly cover: ?{
      readonly uri: ?string,
    },
    readonly familyName: ?string,
    readonly id: string,
    readonly name: ?string,
    readonly picture: ?{
      readonly uri: ?string,
    },
    readonly shortName: ?string,
    readonly siteUrl: ?string,
    readonly smallPicture: ?{
      readonly uri: ?string,
    },
    readonly url: ?string,
  },
  readonly nodes: ?ReadonlyArray<?{
    readonly id: string,
  }>,
  readonly variableNodes: ?ReadonlyArray<?{
    readonly id: string,
  }>,
};
export type DataCheckerStorageKeysTestQuery = {
  response: DataCheckerStorageKeysTestQuery$data,
  variables: DataCheckerStorageKeysTestQuery$variables,
};
*/

var node/*: ConcreteRequest*/ = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "ids"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "site"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "size"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "uri",
    "storageKey": null
  }
],
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "me",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    {
      "alias": "familyName",
      "args": null,
      "kind": "ScalarField",
      "name": "lastName",
      "storageKey": null
    },
    {
      "alias": "shortName",
      "args": [
        {
          "kind": "Literal",
          "name": "if",
          "value": true
        }
      ],
      "kind": "ScalarField",
      "name": "firstName",
      "storageKey": "firstName(if:true)"
    },
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "relative",
          "value": true
        }
      ],
      "kind": "ScalarField",
      "name": "url",
      "storageKey": "url(relative:true)"
    },
    {
      "alias": "siteUrl",
      "args": [
        {
          "kind": "Variable",
          "name": "site",
          "variableName": "site"
        }
      ],
      "kind": "ScalarField",
      "name": "url",
      "storageKey": null
    },
    {
      "alias": "smallPicture",
      "args": [
        {
          "kind": "Literal",
          "name": "size",
          "value": 32
        }
      ],
      "concreteType": "Image",
      "kind": "LinkedField",
      "name": "profilePicture",
      "plural": false,
      "selections": (v5/*:: as any*/),
      "storageKey": "profilePicture(size:32)"
    },
    {
      "alias": "picture",
      "args": [
        {
          "kind": "Variable",
          "name": "size",
          "variableName": "size"
        }
      ],
      "concreteType": "Image",
      "kind": "LinkedField",
      "name": "profilePicture",
      "plural": false,
      "selections": (v5/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": "accounts",
      "args": null,
      "concreteType": "Screenname",
      "kind": "LinkedField",
      "name": "screennames",
      "plural": true,
      "selections": [
        (v4/*:: as any*/)
      ],
      "storageKey": null
    },
    {
      "alias": "cover",
      "args": null,
      "concreteType": "Image",
      "kind": "LinkedField",
      "name": "backgroundImage",
      "plural": false,
      "selections": (v5/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = [
  {
    "kind": "Literal",
    "name": "ids",
    "value": [
      "2"
    ]
  }
],
v8 = [
  (v3/*:: as any*/)
],
v9 = [
  {
    "kind": "Variable",
    "name": "ids",
    "variableName": "ids"
  }
],
v10 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "__typename",
    "storageKey": null
  },
  (v3/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DataCheckerStorageKeysTestQuery",
    "selections": [
      (v6/*:: as any*/),
      {
        "alias": null,
        "args": (v7/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": (v8/*:: as any*/),
        "storageKey": "nodes(ids:[\"2\"])"
      },
      {
        "alias": "variableNodes",
        "args": (v9/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": (v8/*:: as any*/),
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "DataCheckerStorageKeysTestQuery",
    "selections": [
      (v6/*:: as any*/),
      {
        "alias": null,
        "args": (v7/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": (v10/*:: as any*/),
        "storageKey": "nodes(ids:[\"2\"])"
      },
      {
        "alias": "variableNodes",
        "args": (v9/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": (v10/*:: as any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "28bd7aba3633e71feb2ca44c760b8833",
    "id": null,
    "metadata": {},
    "name": "DataCheckerStorageKeysTestQuery",
    "operationKind": "query",
    "text": "query DataCheckerStorageKeysTestQuery(\n  $site: String\n  $size: [Int]\n  $ids: [ID!]\n) {\n  me {\n    id\n    name\n    familyName: lastName\n    shortName: firstName(if: true)\n    url(relative: true)\n    siteUrl: url(site: $site)\n    smallPicture: profilePicture(size: 32) {\n      uri\n    }\n    picture: profilePicture(size: $size) {\n      uri\n    }\n    accounts: screennames {\n      name\n    }\n    cover: backgroundImage {\n      uri\n    }\n  }\n  nodes(ids: [\"2\"]) {\n    __typename\n    id\n  }\n  variableNodes: nodes(ids: $ids) {\n    __typename\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "465f96b4f412afa5d2a4558a9d2bd983";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  DataCheckerStorageKeysTestQuery$variables,
  DataCheckerStorageKeysTestQuery$data,
>*/);
