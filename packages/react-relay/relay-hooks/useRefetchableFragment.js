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

import type {Options} from './useRefetchableFragmentInternal';
import type {
  Disposable,
  FragmentType,
  RefetchableFragment,
  Variables,
} from 'relay-runtime';

const useRefetchableFragmentInternal = require('./useRefetchableFragmentInternal');
const useStaticFragmentNodeWarning = require('./useStaticFragmentNodeWarning');
const {useDebugValue} = require('react');
const {getFragment} = require('relay-runtime');

type RefetchVariables<
  TVariables,
  TKey extends ?{readonly $fragmentSpreads: unknown, ...},
> =
  // NOTE: This type ensures that the type of the returned variables is either:
  //   - nullable if the provided ref type is nullable
  //   - non-nullable if the provided ref type is non-nullable
  [readonly key: TKey] extends [
    readonly key: {readonly $fragmentSpreads: unknown, ...},
  ]
    ? Partial<TVariables>
    : TVariables;

type RefetchFnBase<TVars, TOptions> = (
  vars: TVars,
  options?: TOptions,
) => Disposable;

export type RefetchFn<TVariables, TKey, TOptions = Options> = RefetchFnBase<
  RefetchVariables<TVariables, TKey>,
  TOptions,
>;

export type ReturnType<
  TVariables,
  TData,
  TKey extends ?{readonly $fragmentSpreads: unknown, ...},
> = [
  // NOTE: This type ensures that the type of the returned data is either:
  //   - nullable if the provided ref type is nullable
  //   - non-nullable if the provided ref type is non-nullable
  [readonly key: TKey] extends [
    readonly key: {readonly $fragmentSpreads: unknown, ...},
  ]
    ? TData
    : ?TData,
  RefetchFn<TVariables, TKey>,
];

export type UseRefetchableFragmentType = <
  TFragmentType extends FragmentType,
  TVariables extends Variables,
  TData,
  TKey extends ?{readonly $fragmentSpreads: TFragmentType, ...},
>(
  fragment: RefetchableFragment<TFragmentType, TData, TVariables>,
  key: TKey,
) => ReturnType<TVariables, TData, TKey>;

hook useRefetchableFragment<
  TFragmentType extends FragmentType,
  TVariables extends Variables,
  TData,
  TKey extends ?{readonly $fragmentSpreads: TFragmentType, ...},
>(
  fragmentInput: RefetchableFragment<TFragmentType, TData, TVariables>,
  fragmentRef: TKey,
): ReturnType<TVariables, TData, TKey> {
  const fragmentNode = getFragment(fragmentInput);
  useStaticFragmentNodeWarning(
    fragmentNode,
    'first argument of useRefetchableFragment()',
  );
  const {fragmentData, refetch} = useRefetchableFragmentInternal<
    {variables: TVariables, response: TData},
    {data?: TData},
  >(fragmentNode, fragmentRef, 'useRefetchableFragment()');
  if (__DEV__) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // $FlowFixMe[react-rule-hook-conditional]
    useDebugValue({fragment: fragmentNode.name, data: fragmentData});
  }
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[prop-missing]
  return [fragmentData, refetch];
}

module.exports = useRefetchableFragment;
