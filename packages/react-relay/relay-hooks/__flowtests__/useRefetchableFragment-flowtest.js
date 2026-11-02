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

import type {
  FetchFn,
  NonNullableData,
  NullableData,
  QueryVariables,
  QueryVariablesSubset,
} from './utils';
import type {IEnvironment} from 'relay-runtime';

import useRefetchableFragment from '../useRefetchableFragment';
import {
  fragmentData,
  keyAnotherNonNullable,
  keyAnotherNullable,
  keyNonNullable,
  keyNullable,
  refetchableFragmentInput,
} from './utils';

// Refetch function options:
declare var variables: QueryVariables;
declare var environment: IEnvironment;

export hook useRefetchableFragmentFlowtest() {
  // Nullability of returned data type is correct
  // $FlowFixMe[prop-missing]
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-exact]
  useRefetchableFragment(refetchableFragmentInput, keyNonNullable) as [
    NonNullableData,
    FetchFn<QueryVariablesSubset>,
  ];

  useRefetchableFragment(refetchableFragmentInput, keyNullable) as [
    NullableData,
    FetchFn<QueryVariables>,
  ];

  // $FlowFixMe[incompatible-type] can't cast nullable to non-nullable
  useRefetchableFragment(refetchableFragmentInput, keyNullable) as [
    NonNullableData,
    FetchFn<QueryVariables>,
  ];

  // $FlowFixMe[incompatible-exact]
  // $FlowFixMe[incompatible-type] refetch requires exact type if key is nullable
  useRefetchableFragment(refetchableFragmentInput, keyNullable) as [
    NullableData,
    FetchFn<QueryVariablesSubset>,
  ];

  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[incompatible-exact]
  // $FlowFixMe[prop-missing]
  // $FlowFixMe[incompatible-type] actual type of returned data is correct
  useRefetchableFragment(refetchableFragmentInput, keyAnotherNonNullable) as [
    NonNullableData,
    FetchFn<QueryVariablesSubset>,
  ];

  // $FlowFixMe[incompatible-type]: incompatible key types
  useRefetchableFragment(refetchableFragmentInput, keyAnotherNullable) as [
    NullableData,
    FetchFn<QueryVariables>,
  ];

  // $FlowFixMe[incompatible-type] Key should not be a user provided object
  useRefetchableFragment(refetchableFragmentInput, {abc: 123});

  // $FlowFixMe[incompatible-type] Key should not be an empty object
  useRefetchableFragment(refetchableFragmentInput, {});

  // $FlowFixMe[incompatible-type] Key should be the `<name>$key` type from generated flow
  useRefetchableFragment(refetchableFragmentInput, fragmentData);

  const [, refetch] = useRefetchableFragment(
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
}
