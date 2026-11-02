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

import type {LoadMoreFn} from '../useLoadMoreFunction';
import type {
  FetchFn,
  NonNullableData,
  NullableData,
  QueryVariables,
  QueryVariablesSubset,
} from './utils';
import type {IEnvironment, Variables} from 'relay-runtime';

import usePaginationFragment from '../usePaginationFragment';
import {
  fragmentData,
  keyAnotherNonNullable,
  keyAnotherNullable,
  keyNonNullable,
  keyNullable,
  refetchableFragmentInput,
} from './utils';

type ExpectedReturnType<
  TRefetchVariables extends Variables,
  TLoadMoreVariables extends Variables,
  TFragmentData,
> = {
  data: TFragmentData,
  loadNext: LoadMoreFn<TLoadMoreVariables>,
  loadPrevious: LoadMoreFn<TLoadMoreVariables>,
  hasNext: boolean,
  hasPrevious: boolean,
  isLoadingNext: boolean,
  isLoadingPrevious: boolean,
  refetch: FetchFn<TRefetchVariables>,
};

// Refetch function options:
declare var variables: QueryVariables;
declare var environment: IEnvironment;

// LoadMore options
declare var extraVariables: {nickname: string};
declare var invalidVariables: {foo: string};

export hook usePaginationFragmentFlowtest() {
  // Nullability of returned data type is correct
  // $FlowFixMe[prop-missing]
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-exact]
  usePaginationFragment(
    refetchableFragmentInput,
    keyNonNullable,
  ) as ExpectedReturnType<
    QueryVariablesSubset,
    QueryVariables,
    NonNullableData,
  >;

  usePaginationFragment(
    refetchableFragmentInput,
    keyNullable,
  ) as ExpectedReturnType<QueryVariables, QueryVariables, NullableData>;

  // $FlowFixMe[incompatible-type] can't cast nullable to non-nullable
  usePaginationFragment(
    refetchableFragmentInput,
    keyNullable,
  ) as ExpectedReturnType<QueryVariables, QueryVariables, NonNullableData>;

  // $FlowFixMe[incompatible-exact]
  // $FlowFixMe[prop-missing]
  // $FlowFixMe[incompatible-type] actual type of returned data is correct
  usePaginationFragment(
    refetchableFragmentInput,
    // $FlowFixMe[incompatible-type]
    keyAnotherNonNullable,
  ) as ExpectedReturnType<
    QueryVariables,
    QueryVariablesSubset,
    NonNullableData,
  >;
  // $FlowFixMe[incompatible-type]
  usePaginationFragment(
    refetchableFragmentInput,
    // $FlowFixMe[incompatible-type]
    keyAnotherNullable,
  ) as ExpectedReturnType<QueryVariables, QueryVariables, NonNullableData>;

  // $FlowFixMe[incompatible-type] Key should not be a user provided object
  usePaginationFragment(refetchableFragmentInput, {abc: 123});

  // $FlowFixMe[incompatible-type] Key should not be an empty object
  usePaginationFragment(refetchableFragmentInput, {});

  // $FlowFixMe[incompatible-type] Key should be the `<name>$key` type from generated flow
  usePaginationFragment(refetchableFragmentInput, fragmentData);

  const {refetch} = usePaginationFragment(
    refetchableFragmentInput,
    keyNonNullable,
  );
  // $FlowExpectedError[incompatible-type] : internal option
  refetch(variables, {
    __environment: environment,
  });

  // $FlowExpectedError[incompatible-type] : doesn't exist
  refetch(variables, {
    NON_EXIST: 'NON_EXIST',
  });

  const {loadNext} = usePaginationFragment(
    refetchableFragmentInput,
    keyNonNullable,
  );
  // Accepts extraVariables
  loadNext(10, {
    // $FlowFixMe[prop-missing]
    // $FlowFixMe[incompatible-type]
    UNSTABLE_extraVariables: extraVariables,
  });

  // $FlowFixMe[prop-missing]
  loadNext(10, {
    // $FlowExpectedError[incompatible-type] : doesn't accept variables not available in the Flow type
    UNSTABLE_extraVariables: invalidVariables,
  });

  // $FlowExpectedError[incompatible-type] : doesn't exist
  loadNext(10, {
    UNSTABLE_foo: invalidVariables,
  });
}
