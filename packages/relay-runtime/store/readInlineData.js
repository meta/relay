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

import type {GraphQLTaggedNode} from '../query/GraphQLTag';
import type {InlineFragment} from '../util/RelayRuntimeTypes';
import type {FragmentType} from './RelayStoreTypes';

const {getInlineDataFragment} = require('../query/GraphQLTag');
const {FRAGMENTS_KEY} = require('./RelayStoreUtils');
const invariant = require('invariant');

type HasSpread<TFragmentType> = {
  readonly $fragmentSpreads: TFragmentType,
  ...
};

/**
 * Reads an @inline data fragment that was spread into the parent fragment.
 */
declare function readInlineData<TFragmentType extends FragmentType, TData>(
  fragment: InlineFragment<TFragmentType, TData>,
  key: HasSpread<TFragmentType>,
): TData;
declare function readInlineData<TFragmentType extends FragmentType, TData>(
  fragment: InlineFragment<TFragmentType, TData>,
  key: ?HasSpread<TFragmentType>,
): ?TData;

function readInlineData(
  fragment: GraphQLTaggedNode,
  fragmentRef: ?{[key: string]: {[key: string]: unknown}, ...},
): unknown {
  const inlineDataFragment = getInlineDataFragment(fragment);
  if (fragmentRef == null) {
    return fragmentRef;
  }
  invariant(
    typeof fragmentRef === 'object',
    'readInlineData(): Expected an object, got `%s`.',
    typeof fragmentRef,
  );
  const inlineData = fragmentRef[FRAGMENTS_KEY]?.[inlineDataFragment.name];
  invariant(
    inlineData != null,
    'readInlineData(): Expected fragment `%s` to be spread in the parent ' +
      'fragment.',
    inlineDataFragment.name,
  );
  return inlineData;
}

module.exports = readInlineData;
