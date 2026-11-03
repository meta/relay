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

/* eslint-disable no-unused-vars */

import type {JSResourceReference} from 'JSResourceReference';
import type {ComponentProps} from 'react';
import type {
  CacheConfig,
  FetchPolicy,
  GraphQLResponse,
  IEnvironment,
  Observable,
  OperationType,
  PreloadableConcreteRequest,
  VariablesOf as _VariablesOf,
} from 'relay-runtime';

export type {PreloadableConcreteRequest};

export type VariablesOf<T> = _VariablesOf<T>;

export type PreloadFetchPolicy =
  'store-or-network' | 'store-and-network' | 'network-only';

export type PreloadOptions = {
  readonly fetchKey?: string | number,
  readonly fetchPolicy?: ?PreloadFetchPolicy,
  readonly includeIf?: ?boolean,
  readonly enableForOfflineCacheJob?: ?boolean,
  readonly prefetchExpiryInHours?: ?number,
  readonly networkCacheConfig?: ?CacheConfig,
};

export type LoadQueryOptions = {
  readonly fetchPolicy?: ?FetchPolicy,
  readonly networkCacheConfig?: ?CacheConfig,
  readonly __nameForWarning?: ?string,
};

export type EnvironmentProviderOptions = {readonly [string]: unknown, ...};

export type PreloadedQuery<
  out TQuery extends OperationType,
  TEnvironmentProviderOptions = EnvironmentProviderOptions,
> =
  | PreloadedQueryInner_DEPRECATED<TQuery, TEnvironmentProviderOptions>
  | PreloadedQueryInner<TQuery, TEnvironmentProviderOptions>;

export type PreloadedQueryInner_DEPRECATED<
  out TQuery extends OperationType,
  TEnvironmentProviderOptions = EnvironmentProviderOptions,
> = {
  readonly kind: 'PreloadedQuery_DEPRECATED',
  readonly environment: IEnvironment,
  readonly environmentProviderOptions: ?TEnvironmentProviderOptions,
  readonly fetchKey: ?string | ?number,
  readonly fetchPolicy: FetchPolicy,
  readonly networkCacheConfig?: ?CacheConfig,
  readonly id: ?string,
  readonly name: string,
  readonly source: ?Observable<GraphQLResponse>,
  readonly variables: TQuery['variables'],
  readonly status: PreloadQueryStatus,
};

export type PreloadedQueryInner<
  out TQuery extends OperationType,
  TEnvironmentProviderOptions = EnvironmentProviderOptions,
> = {
  // Releases query data and cancels network request if still in flight
  readonly dispose: () => void,
  // Releases query data
  readonly releaseQuery: () => void,
  // Cancels network request if still in flight
  readonly cancelNetworkRequest: () => void,
  readonly environment: IEnvironment,
  readonly environmentProviderOptions: ?TEnvironmentProviderOptions,
  readonly fetchKey: string | number,
  readonly fetchPolicy: FetchPolicy,
  readonly id: ?string,
  readonly isDisposed: boolean,
  readonly networkError: ?Error,
  readonly name: string,
  readonly networkCacheConfig: ?CacheConfig,
  readonly source: ?Observable<GraphQLResponse>,
  readonly kind: 'PreloadedQuery',
  readonly variables: TQuery['variables'],
};

export type PreloadQueryStatus = {
  readonly cacheConfig: ?CacheConfig,
  readonly source: 'cache' | 'network',
  readonly fetchTime: ?number,
};

/**
The Interface of the EntryPoints .entrypoint files

Every .entrypoint file it's an object that must have two required fields:
- getPreloadProps(...)  function that will return the description of preloaded
  queries and preloaded (nested) entry points for the current entry point
- root - JSResourceReference of the module that will render those preloaded queries

TEntryPointParams - object that contains all necessary information to execute
the preloaders (routeParams, query variables)

TEntryPointComponent -  the root components
*/
export type EntryPoint<
  in TEntryPointParams,
  // $FlowExpectedError[unclear-type] accepts any root component
  out TEntryPointComponent extends EntryPointComponent<any, any, any, any, any>,
> = Readonly<{
  getPreloadProps: (
    entryPointParams: TEntryPointParams,
  ) => PreloadProps<
    ComponentProps<TEntryPointComponent>['queries'],
    ComponentProps<TEntryPointComponent>['entryPoints'],
    ComponentProps<TEntryPointComponent>['extraProps'],
  >,
  root: JSResourceReference<TEntryPointComponent>,
}>;

// The shape of the props of the entry point `root` component
export type EntryPointProps<
  TPreloadedQueries,
  TPreloadedEntryPoints = {},
  TRuntimeProps = {},
  TExtraProps = null,
> = Readonly<{
  entryPoints: TPreloadedEntryPoints,
  extraProps: TExtraProps | null,
  props: TRuntimeProps,
  queries: TPreloadedQueries,
}>;

/**
Type of the entry point `root` component

TEntryPointParams - object that contains all necessary information to execute
the preloaders (routeParams, query variables)

TPreloadedQueries -  queries, defined in the root components

TPreloadedEntryPoints - nested entry points, defined in the root components

TRuntimeProps - the type of additional props that you may pass to the
component (like `onClick` handler, etc) during runtime. Values for them
defined during component runtime

TExtraProps - a bag of extra props that you may define in `entrypoint` file
and they will be passed to the EntryPointComponent as `extraProps`
*/
export type EntryPointComponent<
  TPreloadedQueries,
  TPreloadedEntryPoints = {},
  TRuntimeProps = {},
  TExtraProps = null,
  out TRenders extends React.Node = React.Node,
> = component(
  ...EntryPointProps<
    TPreloadedQueries,
    TPreloadedEntryPoints,
    TRuntimeProps,
    TExtraProps,
  >
) renders TRenders;

// Return type of the `getPreloadProps(...)` of the entry point
export type PreloadProps<
  // $FlowExpectedError[unclear-type] Need any to make it supertype of all PreloadedQuery
  TPreloadedQueries extends {readonly [string]: ?PreloadedQuery<any>},
  TPreloadedEntryPoints extends {...},
  TExtraProps = null,
  TEnvironmentProviderOptions = EnvironmentProviderOptions,
> = Readonly<{
  entryPoints?: {
    readonly [K in keyof TPreloadedEntryPoints]?: ?ThinNestedEntryPointParams,
  },
  extraProps?: TExtraProps,
  queries?: ExtractQueryTypes<TEnvironmentProviderOptions, TPreloadedQueries>,
}>;

// Return type of `loadEntryPoint(...)`
export type PreloadedEntryPoint<TEntryPointComponent> = Readonly<{
  dispose: () => void,
  entryPoints: ComponentProps<TEntryPointComponent>['entryPoints'],
  extraProps: ComponentProps<TEntryPointComponent>['extraProps'],
  getComponent: () => TEntryPointComponent,
  isDisposed: boolean,
  queries: ComponentProps<TEntryPointComponent>['queries'],
  rootModuleID: string,
}>;

export type EntryPointElementConfig<
  out TEntryPoint extends EntryPoint<
    // $FlowExpectedError[unclear-type] Need any to make it supertype of all InternalEntryPointRepresentation
    any,
    // $FlowExpectedError[unclear-type] Need any to make it supertype of all InternalEntryPointRepresentation
    any,
  >,
> =
  TEntryPoint extends EntryPoint<
    infer _EntryPointParams,
    infer EntryPointComponent,
  >
    ? ComponentProps<EntryPointComponent>['props']
    : empty;

export type ThinQueryParams<
  out TQuery extends OperationType,
  TEnvironmentProviderOptions,
> = Readonly<{
  environmentProviderOptions?: ?TEnvironmentProviderOptions,
  options?: ?PreloadOptions,
  parameters: PreloadableConcreteRequest<TQuery>,
  // $FlowFixMe[incompatible-use]
  variables: TQuery['variables'],
}>;

/**
 * We make the type of `ThinNestedEntryPointParams` opaque, so that the only way
 * to construct a `ThinNestedEntryPointParams` is by calling `NestedRelayEntryPoint`
 * from `NestedRelayEntryPointBuilderUtils` module.
 */
declare export opaque type ThinNestedEntryPointParams;

export type ExtractQueryTypeHelper<TEnvironmentProviderOptions> = <TQuery>(
  v: PreloadedQuery<TQuery>,
) => ThinQueryParams<TQuery, TEnvironmentProviderOptions>;

// We need to match both cases without using distributive conditional types,
// because PreloadedQuery's TQuery parameter is almost phantom, and breaking
// up the union type would cause us to lose track of TQuery.
type ExtractThinQueryParams<T, TEnvironmentProviderOptions> = [
  readonly t: T,
] extends [
  // $FlowFixMe[incompatible-type]
  readonly t: PreloadedQuery<infer TQuery extends OperationType>,
]
  ? ThinQueryParams<TQuery, TEnvironmentProviderOptions>
  : [readonly t: T] extends [
        readonly t: PreloadedQuery<infer TQuery extends OperationType> | void,
      ]
    ? ThinQueryParams<TQuery, TEnvironmentProviderOptions> | void
    : [readonly t: T] extends [
          readonly t: PreloadedQuery<
            infer TQuery extends OperationType,
          > | null | void,
        ]
      ? ThinQueryParams<TQuery, TEnvironmentProviderOptions> | null | void
      : empty;

export type ExtractQueryTypes<
  TEnvironmentProviderOptions,
  // $FlowExpectedError[unclear-type] Need any to make it supertype of all PreloadedQuery
  PreloadedQueries extends {readonly [string]: ?PreloadedQuery<any>} | void,
> = {
  [K in keyof PreloadedQueries]: ExtractThinQueryParams<
    PreloadedQueries[K],
    TEnvironmentProviderOptions,
  >,
};

// $FlowFixMe[unclear-type]: we don't care about the props
export type RootComponentRenders<out C extends component(...any)> =
  // $FlowFixMe[unclear-type]: we don't care about the props
  C extends component(...any) renders infer R extends React.Node ? R : empty;

export type PreloadParamsOf<T> = Parameters<T['getPreloadProps']>[0];

export type IEnvironmentProvider<TOptions> = Readonly<{
  getEnvironment: (options: ?TOptions) => IEnvironment,
}>;
