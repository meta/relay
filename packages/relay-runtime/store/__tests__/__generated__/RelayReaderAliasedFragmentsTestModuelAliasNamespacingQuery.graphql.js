/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @oncall relay
 *
 * @generated SignedSource<<c962fa4b1de4ccdaf4bf458a30009755>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

// @dataDrivenDependency RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery.node.a_common_alias {"branches":{"User":{"component":"PlainUserNameRenderer.react","fragment":"RelayReaderAliasedFragmentsTestModuleA_user$normalization.graphql"}},"plural":false}
// @dataDrivenDependency RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery.node.a_namespace_alias_that_prevents_collisions.a_common_alias {"branches":{"User":{"component":"PlainUserNameRenderer.react","fragment":"RelayReaderAliasedFragmentsTestModuleB_user$normalization.graphql"}},"plural":false}

/*::
import type { ConcreteRequest, Query } from 'relay-runtime';
import type { RelayReaderAliasedFragmentsTestModuleA_user$fragmentType } from "./RelayReaderAliasedFragmentsTestModuleA_user.graphql";
import type { RelayReaderAliasedFragmentsTestModuleB_user$fragmentType } from "./RelayReaderAliasedFragmentsTestModuleB_user.graphql";
export type RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery$variables = {
  id: string,
};
export type RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery$data = {
  readonly node: ?{
    readonly a_common_alias: ?{
      readonly __fragmentPropName: ?string,
      readonly __module_component: ?string,
      readonly $fragmentSpreads: RelayReaderAliasedFragmentsTestModuleA_user$fragmentType,
    },
    readonly a_namespace_alias_that_prevents_collisions: {
      readonly a_common_alias: ?{
        readonly __fragmentPropName: ?string,
        readonly __module_component: ?string,
        readonly $fragmentSpreads: RelayReaderAliasedFragmentsTestModuleB_user$fragmentType,
      },
    },
  },
};
export type RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery = {
  response: RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery$data,
  variables: RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery$variables,
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
  "args": null,
  "documentName": "RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery_a_common_alias",
  "fragmentName": "RelayReaderAliasedFragmentsTestModuleA_user",
  "fragmentPropName": "user",
  "kind": "ModuleImport"
},
v3 = {
  "args": null,
  "documentName": "RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery_a_namespace_alias_that_prevents_collisions_a_common_alias",
  "fragmentName": "RelayReaderAliasedFragmentsTestModuleB_user",
  "fragmentPropName": "user",
  "kind": "ModuleImport"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery",
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
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                (v2/*:: as any*/)
              ],
              "type": "User",
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "a_common_alias"
          },
          {
            "fragment": {
              "kind": "InlineFragment",
              "selections": [
                {
                  "fragment": {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*:: as any*/)
                    ],
                    "type": "User",
                    "abstractKey": null
                  },
                  "kind": "AliasedInlineFragmentSpread",
                  "name": "a_common_alias"
                }
              ],
              "type": null,
              "abstractKey": null
            },
            "kind": "AliasedInlineFragmentSpread",
            "name": "a_namespace_alias_that_prevents_collisions"
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
    "name": "RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery",
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/)
            ],
            "type": "User",
            "abstractKey": null
          },
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4f273786cf269a557e112486d70dcd59",
    "id": null,
    "metadata": {},
    "name": "RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery",
    "operationKind": "query",
    "text": "query RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on User {\n      ...RelayReaderAliasedFragmentsTestModuleA_user\n      __module_operation_RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery_a_common_alias: js(module: \"RelayReaderAliasedFragmentsTestModuleA_user$normalization.graphql\", id: \"RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery.node.a_common_alias\")\n      __module_component_RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery_a_common_alias: js(module: \"PlainUserNameRenderer.react\", id: \"RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery.node.a_common_alias\")\n      ...RelayReaderAliasedFragmentsTestModuleB_user\n      __module_operation_RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery_a_namespace_alias_that_prevents_collisions_a_common_alias: js(module: \"RelayReaderAliasedFragmentsTestModuleB_user$normalization.graphql\", id: \"RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery.node.a_namespace_alias_that_prevents_collisions.a_common_alias\")\n      __module_component_RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery_a_namespace_alias_that_prevents_collisions_a_common_alias: js(module: \"PlainUserNameRenderer.react\", id: \"RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery.node.a_namespace_alias_that_prevents_collisions.a_common_alias\")\n    }\n    __isNode: __typename\n    id\n  }\n}\n\nfragment RelayReaderAliasedFragmentsTestModuleA_user on User {\n  name\n}\n\nfragment RelayReaderAliasedFragmentsTestModuleB_user on User {\n  name\n}\n"
  }
};
})();

if (__DEV__) {
  (node/*:: as any*/).hash = "8deb3de5ffb9bc595f8cc31652d4ce7a";
}

module.exports = ((node/*:: as any*/)/*:: as Query<
  RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery$variables,
  RelayReaderAliasedFragmentsTestModuelAliasNamespacingQuery$data,
>*/);
