/**
 * @generated SignedSource<<f3cc436c844fb410cb5bf5ee54b5f789>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$data = {
  readonly address: ?{
    readonly city: ?string,
    readonly country: ?string,
  },
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment",
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
  ],
  "type": "User",
  "abstractKey": null
};

(node/*:: as any*/).hash = "274e0765e9812990054a75e1b55ba7a2";

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment$data,
>*/);
