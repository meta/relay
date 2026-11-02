/**
 * @generated SignedSource<<89dc8dea6c66d9af6c6badac4c20cdb8>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$data = {
  readonly allPhones: ?ReadonlyArray<?{
    readonly isVerified: ?boolean,
    readonly phoneNumber: ?{
      readonly displayNumber: ?string,
    },
  }>,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment",
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
    }
  ],
  "type": "User",
  "abstractKey": null
};

(node/*:: as any*/).hash = "9f85512473f742e9293d095e9b587bc6";

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment$data,
>*/);
