/**
 * @generated SignedSource<<0000000000000000000000000000000000>>
 * @flow
 * @lightSyntaxTransform
 */

/* eslint-disable */

'use strict';

/*::
import type { Fragment, ReaderFragment } from 'relay-runtime';
import type { FragmentType } from "relay-runtime";
declare export opaque type RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$fragmentType: FragmentType;
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$data = {
  readonly allPhones: ?ReadonlyArray<?{
    readonly phoneNumber: ?{
      readonly countryCode: ?string,
    },
  }>,
  readonly $fragmentType: RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$fragmentType,
};
export type RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$key = {
  readonly $data?: RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$data,
  readonly $fragmentSpreads: RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$fragmentType,
  ...
};
*/

var node/*: ReaderFragment*/ = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment",
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
  ],
  "type": "User",
  "abstractKey": null
};

(node/*:: as any*/).hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1";

module.exports = ((node/*:: as any*/)/*:: as Fragment<
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$fragmentType,
  RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment$data,
>*/);
