/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  _FragmentRefs,
  _RefType,
  CacheConfig,
  ConcreteRequest,
  Disposable,
  DisposeFn,
  Environment,
  FetchPolicy,
  FragmentType,
  GraphQLResponse,
  IEnvironment,
  Observable,
  Observer,
  OperationType,
  PreloadableConcreteRequest,
  RenderPolicy,
  Variables,
  VariablesOf,
} from 'relay-runtime';

export { FragmentRef } from 'relay-runtime';
export { VariablesOf } from 'relay-runtime';

// --- Legacy container types ---

export interface RelayProp {
    environment: Environment;
    refetch: undefined; // ensures no RelayRefetchProp is used with a fragment container
    hasMore: undefined; // ensures no RelayPaginationProp is used with a fragment container
}

export interface RelayRefetchProp {
    environment: Environment;
    refetch: (
        refetchVariables: Variables | ((fragmentVariables: Variables) => Variables),
        renderVariables?: Variables | null,
        observerOrCallback?: ObserverOrCallback | null,
        options?: RefetchOptions,
    ) => Disposable;
    hasMore: undefined; // ensures no RelayPaginationProp is used with a refetch container
}
export interface RefetchOptions {
    force?: boolean | undefined;
    fetchPolicy?: 'store-or-network' | 'network-only' | undefined;
}

type ObserverOrCallback = Observer<void> | ((error: Error | null | undefined) => void);

export interface RelayPaginationProp {
    readonly environment: Environment;
    readonly hasMore: () => boolean;
    readonly isLoading: () => boolean;
    readonly loadMore: (
        pageSize: number,
        observerOrCallback?: ObserverOrCallback | null,
        options?: RefetchOptions | null,
    ) => Disposable | null | undefined;
    readonly refetchConnection: (
        totalCount: number,
        observerOrCallback?: ObserverOrCallback | null,
        refetchVariables?: Variables | null,
    ) => Disposable | null | undefined;
    refetch: undefined; // ensures no RelayRefetchProp is used with a pagination container
}

export type FragmentOrRegularProp<T> = T extends _RefType<infer U> ? _FragmentRefs<U>
    : T extends ReadonlyArray<_RefType<infer U>> ? ReadonlyArray<_FragmentRefs<U>>
    : T;

export type MappedFragmentProps<T> = {
    [K in keyof T]: FragmentOrRegularProp<T[K]>;
};

// --- Fragment key types (from helpers) ---

export type KeyType<TData = unknown> = Readonly<{
    ' $data'?: TData | undefined;
    ' $fragmentSpreads': FragmentType;
}>;

export type KeyTypeData<TKey extends KeyType<TData>, TData = unknown> = Required<TKey>[' $data'];

export type ArrayKeyType<TData = unknown> = ReadonlyArray<KeyType<readonly TData[]> | null | undefined>;
export type ArrayKeyTypeData<TKey extends ArrayKeyType<TData>, TData = unknown> = KeyTypeData<
    NonNullable<TKey[number]>
>;

export type GetEntryPointParamsFromEntryPoint<TEntryPoint> = TEntryPoint extends EntryPoint<
    infer _TEntryPointComponent,
    infer TEntryPointParams
> ? TEntryPointParams
    : never;

export type GetEntryPointComponentFromEntryPoint<TEntryPoint> = TEntryPoint extends EntryPoint<
    infer TEntryPointComponent,
    infer _TEntryPointParams
> ? TEntryPointComponent
    : never;

// --- EntryPoint types ---

export interface JSResourceReference<TModule> {
    getModuleId(): string;

    getModuleIfRequired(): TModule | null;

    load(): Promise<TModule>;
}

export type PreloadFetchPolicy = 'store-or-network' | 'store-and-network' | 'network-only';

export type PreloadOptions = Readonly<{
    fetchKey?: string | number | undefined;
    fetchPolicy?: PreloadFetchPolicy | null | undefined;
    networkCacheConfig?: CacheConfig | null | undefined;
}>;

export type LoadQueryOptions = Readonly<{
    fetchPolicy?: FetchPolicy | null | undefined;
    networkCacheConfig?: CacheConfig | null | undefined;
    onQueryAstLoadTimeout?: (() => void) | null | undefined;
}>;

export type EnvironmentProviderOptions<T extends Record<string, unknown> = Record<string, unknown>> = T;

export type PreloadedQuery<
    TQuery extends OperationType,
    TEnvironmentProviderOptions = EnvironmentProviderOptions,
> = Readonly<{
    ' $queryShape': TQuery;
    kind: 'PreloadedQuery';
    environment: IEnvironment;
    environmentProviderOptions?: TEnvironmentProviderOptions | null | undefined;
    fetchKey: string | number;
    fetchPolicy: PreloadFetchPolicy;
    networkCacheConfig?: CacheConfig | null | undefined;
    id?: string | null | undefined;
    name: string;
    source?: Observable<GraphQLResponse> | null | undefined;
    variables: VariablesOf<TQuery>;
    dispose: DisposeFn;
    isDisposed: boolean;
}>;

export type PreloadQueryStatus = Readonly<{
    cacheConfig?: CacheConfig | null | undefined;
    source: 'cache' | 'network';
    fetchTime?: number | null | undefined;
}>;

/**
 * The Interface of the EntryPoints .entrypoint files
 *
 * Every .entrypoint file it's an object that must have two required fields:
 * - getPreloadProps(...)  function that will return the description of preloaded
 *   queries and preloaded (nested) entry points for the current entry point
 * - root - JSResource of the module that will render those preloaded queries
 *
 * TEntryPointParams - object that contains all necessary information to execute
 * the preloaders (routeParams, query variables)
 *
 * TPreloadedQueries -  queries, defined in the root components
 *
 * TNestedEntryPoints - nested entry points, defined in the root components
 *
 * TRuntimeProps - the type of additional props that you may pass to the
 * component (like `onClick` handler, etc) during runtime. Values for them
 * defined during component runtime
 *
 * TExtraProps - a bag of extra props that you may define in `entrypoint` file
 * and they will be passed to the EntryPointComponent as `extraProps`
 */
interface InternalEntryPointRepresentation<
    TEntryPointParams extends Record<string, unknown>,
    TPreloadedQueries extends Record<string, OperationType>,
    TNestedEntryPoints extends Record<string, any>,
    TRuntimeProps extends Record<string, unknown>,
    TExtraProps extends Record<string, unknown> | null,
> {
    readonly root: JSResourceReference<
        EntryPointComponent<TPreloadedQueries, TNestedEntryPoints, TRuntimeProps, TExtraProps>
    >;
    readonly getPreloadProps: (
        entryPointParams: TEntryPointParams,
    ) => PreloadProps<TEntryPointParams, TPreloadedQueries, TNestedEntryPoints, TExtraProps>;
}

type ThinQueryParamsObject<TPreloadedQueries extends Record<string, OperationType> = Record<string, never>> = {
    [K in keyof TPreloadedQueries]: ThinQueryParams<TPreloadedQueries[K]>;
};

type ThinNestedEntryPointParamsObject<
    TEntryPoints extends Record<string, EntryPoint<any, any> | undefined> = Record<string, never>,
> = {
    [K in keyof TEntryPoints]: ThinNestedEntryPointParams<TEntryPoints[K]>;
};

type PreloadedQueries<TPreloadedQueries> = TPreloadedQueries extends Record<string, OperationType> ? {
        [T in keyof TPreloadedQueries]: PreloadedQuery<TPreloadedQueries[T]>;
    }
    : never;

type PreloadedEntryPoints<TEntryPoints> = TEntryPoints extends Record<
    string,
    InternalEntryPointRepresentation<any, any, any, any, any> | undefined
> ? {
        [T in keyof TEntryPoints]: PreloadedEntryPoint<
            GetEntryPointComponentFromEntryPoint<TEntryPoints[T]>
        >;
    }
    : never;

export type PreloadProps<
    _TPreloadParams extends Record<string, unknown>,
    TPreloadedQueries extends Record<string, OperationType>,
    TNestedEntryPoints extends Record<string, EntryPoint<any, any> | undefined>,
    TExtraProps extends Record<string, unknown> | null,
> = Readonly<{
    entryPoints?: ThinNestedEntryPointParamsObject<TNestedEntryPoints> | undefined;
    extraProps?: TExtraProps | undefined;
    queries?: ThinQueryParamsObject<TPreloadedQueries> | undefined;
}>;

export interface EntryPointProps<TPreloadedQueries, TNestedEntryPoints, TRuntimeProps, TExtraProps> {
    readonly entryPoints: PreloadedEntryPoints<TNestedEntryPoints>;
    readonly extraProps: TExtraProps;
    readonly props: TRuntimeProps;
    readonly queries: PreloadedQueries<TPreloadedQueries>;
}

export type EntryPointComponent<
    TPreloadedQueries extends Record<string, OperationType>,
    TNestedEntryPoints extends Record<string, EntryPoint<any, any> | undefined>,
    TRuntimeProps extends Record<string, unknown> = Record<string, unknown>,
    TExtraProps extends Record<string, unknown> | null = Record<string, unknown>,
> = React.ComponentType<EntryPointProps<TPreloadedQueries, TNestedEntryPoints, TRuntimeProps, TExtraProps>>;

export type PreloadedEntryPoint<TEntryPointComponent> = TEntryPointComponent extends EntryPointComponent<
    infer TPreloadedQueries,
    infer TNestedEntryPoints,
    infer _TRuntimeProps,
    infer TExtraProps
> ? Readonly<{
        dispose: DisposeFn;
        entryPoints: PreloadedEntryPoints<TNestedEntryPoints>;
        extraProps: TExtraProps;
        getComponent: () => TEntryPointComponent;
        isDisposed: boolean;
        queries: PreloadedQueries<TPreloadedQueries>;
        rootModuleID: string;
    }>
    : never;

export type ThinQueryParams<
    TQuery extends OperationType,
    TEnvironmentProviderOptions extends EnvironmentProviderOptions = EnvironmentProviderOptions,
> = Readonly<{
    parameters: ConcreteRequest | PreloadableConcreteRequest<TQuery>;
    variables: VariablesOf<TQuery>;
    options?: PreloadOptions | null | undefined;
    environmentProviderOptions?: TEnvironmentProviderOptions | null | undefined;
}>;

export type ThinNestedEntryPointParams<TEntryPoint> = Readonly<{
    entryPoint: TEntryPoint;
    entryPointParams: GetEntryPointParamsFromEntryPoint<TEntryPoint>;
}>;

export type EntryPoint<TEntryPointComponent, TEntryPointParams extends Record<string, unknown> = Record<string, unknown>> = InternalEntryPointRepresentation<
    TEntryPointParams,
    TEntryPointComponent extends EntryPointComponent<infer TPreloadedQueries, any, any, any> ? TPreloadedQueries
        : never,
    TEntryPointComponent extends EntryPointComponent<any, infer TNestedEntryPoints, any, any> ? TNestedEntryPoints
        : never,
    TEntryPointComponent extends EntryPointComponent<any, any, infer TRuntimeProps, any> ? TRuntimeProps : never,
    TEntryPointComponent extends EntryPointComponent<any, any, any, infer TExtraProps> ? TExtraProps : never
>;

export interface IEnvironmentProvider<TOptions> {
    getEnvironment(options: TOptions | null): IEnvironment;
}

// --- Refetchable fragment types (from useRefetchableFragmentNode) ---

export type RefetchFn<TQuery extends OperationType, TOptions = RefetchableOptions> = RefetchFnExact<TQuery, TOptions>;

export type RefetchFnDynamic<
    TQuery extends OperationType,
    _TKey extends KeyType | null | undefined,
    TOptions = RefetchableOptions,
> = RefetchInexactDynamicResponse<TQuery, TOptions> & RefetchExactDynamicResponse<TQuery, TOptions>;

export type RefetchInexact<TQuery extends OperationType, TOptions> = (
    data?: unknown,
) => RefetchFnInexact<TQuery, TOptions>;
export type RefetchInexactDynamicResponse<TQuery extends OperationType, TOptions> = ReturnType<
    RefetchInexact<TQuery, TOptions>
>;

export type RefetchExact<TQuery extends OperationType, TOptions> = (
    data?: unknown | null,
) => RefetchFnExact<TQuery, TOptions>;
export type RefetchExactDynamicResponse<TQuery extends OperationType, TOptions> = ReturnType<
    RefetchExact<TQuery, TOptions>
>;

export type RefetchFnBase<TVars, TOptions> = (vars: TVars, options?: TOptions) => Disposable;

export type RefetchFnExact<TQuery extends OperationType, TOptions = RefetchableOptions> = RefetchFnBase<
    VariablesOf<TQuery>,
    TOptions
>;
export type RefetchFnInexact<TQuery extends OperationType, TOptions = RefetchableOptions> = RefetchFnBase<
    Partial<VariablesOf<TQuery>>,
    TOptions
>;

export interface ReturnTypeNode<
    TQuery extends OperationType,
    TKey extends KeyType | null | undefined,
    TOptions = RefetchableOptions,
> {
    fragmentData: unknown;
    fragmentRef: unknown;
    refetch: RefetchFnDynamic<TQuery, TKey, TOptions>;
    disableStoreUpdates: () => void;
    enableStoreUpdates: () => void;
}

export interface RefetchableOptions {
    fetchPolicy?: FetchPolicy | undefined;
    networkCacheConfig?: CacheConfig | null | undefined;
    onComplete?: ((arg: Error | null) => void) | undefined;
    UNSTABLE_renderPolicy?: RenderPolicy | undefined;
}

export interface InternalRefetchableOptions extends RefetchableOptions {
    __environment?: IEnvironment | undefined;
}

export type RefetchableAction =
    | {
        type: 'reset';
        environment: IEnvironment;
        fragmentIdentifier: string;
    }
    | {
        type: 'refetch';
        refetchVariables: Variables;
        fetchPolicy?: FetchPolicy | undefined;
        renderPolicy?: RenderPolicy | undefined;
        onComplete?: ((args: Error | null) => void) | undefined;
        environment?: IEnvironment | null | undefined;
    };

export interface RefetchState {
    fetchPolicy?: FetchPolicy | undefined;
    renderPolicy?: RenderPolicy | undefined;
    mirroredEnvironment: IEnvironment;
    mirroredFragmentIdentifier: string;
    onComplete?: ((arg: Error | null) => void) | undefined;
    refetchEnvironment?: IEnvironment | null | undefined;
    refetchVariables?: Variables | null | undefined;
    refetchGeneration: number;
}

export interface DebugIDandTypename {
    id: string;
    typename: string;
}
