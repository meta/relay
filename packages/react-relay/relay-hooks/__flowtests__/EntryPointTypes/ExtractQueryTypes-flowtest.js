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
  EnvironmentProviderOptions,
  ExtractQueryTypes,
  PreloadedQuery,
  ThinQueryParams,
} from '../../EntryPointTypes.flow';
import type {OperationType} from 'relay-runtime';

type Query = {
  readonly variables: {foo: string, bar: number},
  readonly response: unknown,
  readonly rawResponse?: {...},
};

const _good: ExtractQueryTypes<
  EnvironmentProviderOptions,
  {root: PreloadedQuery<Query>},
>['root']['variables'] = {
  foo: 'bar',
  bar: 3,
};

const _bad: ExtractQueryTypes<
  EnvironmentProviderOptions,
  {root: PreloadedQuery<Query>},
  // $FlowExpectedError[prop-missing]
  // $FlowExpectedError[incompatible-type]
>['root']['variables'] = {
  memebers_are_checked: true,
  // $FlowExpectedError[incompatible-type]
  foo: 1,
  bar: 3,
};

declare type RootQuery = OperationType;

type ActualRequiredQueryType = ExtractQueryTypes<
  EnvironmentProviderOptions,
  {root: PreloadedQuery<RootQuery>},
>;

type ExpectedRequiredQueryType = {
  root: ThinQueryParams<RootQuery, EnvironmentProviderOptions>,
};

declare const ActualRequiredQuery: ActualRequiredQueryType;
declare const ExpectedRequiredQuery: ExpectedRequiredQueryType;
ActualRequiredQuery as ExpectedRequiredQueryType;
ExpectedRequiredQuery as ActualRequiredQueryType;

type ActualOptionalQueryType = ExtractQueryTypes<
  EnvironmentProviderOptions,
  {root: PreloadedQuery<RootQuery> | undefined},
>;

type ExpectedOptionalQueryType = {
  root: ThinQueryParams<RootQuery, EnvironmentProviderOptions> | undefined,
};

declare const ActualOptionalQuery: ActualOptionalQueryType;
declare const ExpectedOptionalQuery: ExpectedOptionalQueryType;
ActualOptionalQuery as ExpectedOptionalQueryType;
ExpectedOptionalQuery as ActualOptionalQueryType;

type ActualNullableQueryType = ExtractQueryTypes<
  EnvironmentProviderOptions,
  {root: PreloadedQuery<RootQuery> | undefined},
>;

type ExpectedNullableQueryType = {
  root: ThinQueryParams<RootQuery, EnvironmentProviderOptions> | undefined,
};

declare const ActualNullableQuery: ActualNullableQueryType;
declare const ExpectedNullableQuery: ExpectedNullableQueryType;
ActualNullableQuery as ExpectedNullableQueryType;
ExpectedNullableQuery as ActualNullableQueryType;
