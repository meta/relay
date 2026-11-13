/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c35905969dc32b40b01d6364bd4a7615>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
export type RelayReaderStorageKeysTestQuery$variables = {
  ids?: ?ReadonlyArray<string>,
  site?: ?string,
  size?: ?ReadonlyArray<?number>,
};
export type RelayReaderStorageKeysTestQuery$data = {
  readonly me: ?{
    readonly firstName: ?string,
    readonly id: string,
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
export type RelayReaderStorageKeysTestQuery = {
  response: RelayReaderStorageKeysTestQuery$data,
  variables: RelayReaderStorageKeysTestQuery$variables,
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
v4 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "uri",
    "storageKey": null
  }
],
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "me",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "firstName",
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
      "selections": (v4/*:: as any*/),
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
      "selections": (v4/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v6 = [
  {
    "kind": "Literal",
    "name": "ids",
    "value": [
      "2"
    ]
  }
],
v7 = [
  (v3/*:: as any*/)
],
v8 = [
  {
    "kind": "Variable",
    "name": "ids",
    "variableName": "ids"
  }
],
v9 = [
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
    "name": "RelayReaderStorageKeysTestQuery",
    "selections": [
      (v5/*:: as any*/),
      {
        "alias": null,
        "args": (v6/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": (v7/*:: as any*/),
        "storageKey": "nodes(ids:[\"2\"])"
      },
      {
        "alias": "variableNodes",
        "args": (v8/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": (v7/*:: as any*/),
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
    "name": "RelayReaderStorageKeysTestQuery",
    "selections": [
      (v5/*:: as any*/),
      {
        "alias": null,
        "args": (v6/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": (v9/*:: as any*/),
        "storageKey": "nodes(ids:[\"2\"])"
      },
      {
        "alias": "variableNodes",
        "args": (v8/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "nodes",
        "plural": true,
        "selections": (v9/*:: as any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9a1b930264e6ab8ba2263d87002de963",
    "id": null,
    "metadata": {},
    "name": "RelayReaderStorageKeysTestQuery",
    "operationKind": "query",
    "text": "query RelayReaderStorageKeysTestQuery(\n  $site: String\n  $size: [Int]\n  $ids: [ID!]\n) {\n  me {\n    id\n    firstName\n    shortName: firstName(if: true)\n    url(relative: true)\n    siteUrl: url(site: $site)\n    smallPicture: profilePicture(size: 32) {\n      uri\n    }\n    picture: profilePicture(size: $size) {\n      uri\n    }\n  }\n  nodes(ids: [\"2\"]) {\n    __typename\n    id\n  }\n  variableNodes: nodes(ids: $ids) {\n    __typename\n    id\n  }\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "fcdbdbd7cf3a74c0ca82feaecca6b750";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReaderStorageKeysTestQuery$variables,
  RelayReaderStorageKeysTestQuery$data,
>*/);
