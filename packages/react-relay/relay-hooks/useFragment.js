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

import type {Fragment, FragmentType, GraphQLTaggedNode} from 'relay-runtime';

const useFragmentInternal = require('./useFragmentInternal');
const useStaticFragmentNodeWarning = require('./useStaticFragmentNodeWarning');
const {useDebugValue} = require('react');
const {getFragment} = require('relay-runtime');

type HasSpread<TFragmentType> = {
  readonly $fragmentSpreads: TFragmentType,
  ...
};

// if the key is non-nullable, return non-nullable value
declare hook useFragment<TFragmentType extends FragmentType, TData>(
  fragment: Fragment<TFragmentType, TData>,
  key: HasSpread<TFragmentType>,
): TData;

// if the key is nullable, return nullable value
declare hook useFragment<TFragmentType extends FragmentType, TData>(
  fragment: Fragment<TFragmentType, TData>,
  key: ?HasSpread<TFragmentType>,
): ?TData;

// if the key is a non-nullable array of keys, return non-nullable array
declare hook useFragment<TFragmentType extends FragmentType, TData>(
  fragment: Fragment<TFragmentType, TData>,
  key: ReadonlyArray<HasSpread<TFragmentType>>,
): TData;

// if the key is a nullable array of keys, return nullable array
declare hook useFragment<TFragmentType extends FragmentType, TData>(
  fragment: Fragment<TFragmentType, TData>,
  key: ?ReadonlyArray<HasSpread<TFragmentType>>,
): ?TData;

hook useFragment(fragment: GraphQLTaggedNode, key: unknown): unknown {
  const fragmentNode = getFragment(fragment);
  useStaticFragmentNodeWarning(fragmentNode, 'first argument of useFragment()');
  const data = useFragmentInternal(fragmentNode, key, 'useFragment()');
  if (__DEV__) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // $FlowFixMe[react-rule-hook-conditional]
    useDebugValue({fragment: fragmentNode.name, data});
  }
  return data;
}

module.exports = useFragment;
