/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall relay
 */

'use strict';

import type {
  FragmentType,
  HasUpdatableSpread,
  MissingFieldHandler,
  RecordSourceProxy,
  UpdatableData,
} from '../store/RelayStoreTypes';
import type {UpdatableFragment} from '../util/RelayRuntimeTypes';

const {getFragment} = require('../query/GraphQLTag');
const {getVariablesFromFragment} = require('../store/RelayModernSelector');
const {ID_KEY} = require('../store/RelayStoreUtils');
const {createUpdatableProxy} = require('./createUpdatableProxy');
const invariant = require('invariant');

// Note: plural fragment references are currently not supported
function readUpdatableFragment<
  TFragmentType extends FragmentType,
  TData extends {...},
>(
  fragment: UpdatableFragment<TFragmentType, TData>,
  fragmentReference: HasUpdatableSpread<TFragmentType>,
  proxy: RecordSourceProxy,
  missingFieldHandlers: ReadonlyArray<MissingFieldHandler>,
): UpdatableData<TData> {
  const updatableFragment = getFragment(fragment);
  const fragmentVariables = getVariablesFromFragment(
    updatableFragment,
    fragmentReference,
  );
  // $FlowFixMe[prop-missing] it's there, we just don't include it in the type
  const id = fragmentReference[ID_KEY];

  const fragmentRoot = proxy.get(id);
  invariant(
    fragmentRoot != null,
    `No record with ${id} was found. This likely indicates a problem with Relay.`,
  );

  return {
    updatableData: createUpdatableProxy<TData>(
      fragmentRoot,
      fragmentVariables,
      updatableFragment.selections,
      proxy,
      missingFieldHandlers,
    ),
  };
}

module.exports = {readUpdatableFragment};
