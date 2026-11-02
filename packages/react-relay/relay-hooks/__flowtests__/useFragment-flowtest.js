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
  useFragmentFlowtest_user$data,
  useFragmentFlowtest_user$key,
} from './__generated__/useFragmentFlowtest_user.graphql';
import typeof useFragmentFlowtest_user$fragment from './__generated__/useFragmentFlowtest_user.graphql';
import type {
  useFragmentFlowtest_users$data,
  useFragmentFlowtest_users$key,
} from './__generated__/useFragmentFlowtest_users.graphql';
import typeof useFragmentFlowtest_users$fragment from './__generated__/useFragmentFlowtest_users.graphql';

import useFragment from '../useFragment';
import {graphql} from 'relay-runtime';

declare var Any: $FlowFixMe;

const userFragment: useFragmentFlowtest_user$fragment = graphql`
  fragment useFragmentFlowtest_user on User {
    id
  }
`;

const usersFragment: useFragmentFlowtest_users$fragment = graphql`
  fragment useFragmentFlowtest_users on User @relay(plural: true) {
    id
  }
`;

export hook useFragmentFlowtest() {
  // Nullability of returned data type is correct
  useFragment(
    userFragment,
    Any as useFragmentFlowtest_user$key,
  ) as useFragmentFlowtest_user$data;
  useFragment(
    userFragment,
    Any as ?useFragmentFlowtest_user$key,
  ) as ?useFragmentFlowtest_user$data;
  useFragment(
    usersFragment,
    Any as useFragmentFlowtest_users$key,
  ) as useFragmentFlowtest_users$data;
  useFragment(
    usersFragment,
    Any as ?useFragmentFlowtest_users$key,
  ) as ?useFragmentFlowtest_users$data;

  // $FlowExpectedError[incompatible-type] : can't cast nullable to non-nullable
  useFragment(
    userFragment,
    Any as ?useFragmentFlowtest_user$key,
  ) as useFragmentFlowtest_user$data;
  // $FlowExpectedError[incompatible-type] : can't cast nullable plural to non-nullable plural
  useFragment(
    usersFragment,
    Any as ?useFragmentFlowtest_users$key,
  ) as useFragmentFlowtest_users$data;

  // $FlowExpectedError[incompatible-type] : Key should be one of the generated types
  useFragment(userFragment, 'INVALID_KEY');

  // $FlowExpectedError[incompatible-type] : Key should not be a user provided object
  useFragment(userFragment, {a: 123});

  // $FlowExpectedError[incompatible-type] : Key should not be an empty object
  useFragment(userFragment, {});

  // $FlowExpectedError[incompatible-type] : Key should be the `<name>$key` type from generated flow
  useFragment(userFragment, Any as useFragmentFlowtest_user$data);
}
