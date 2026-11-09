/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ArrayKeyType, ArrayKeyTypeData, KeyType, KeyTypeData} from './ReactRelayTypes';
import {
  GraphQLTaggedNode,
  IEnvironment,
  OperationType,
  ServerOperationType,
  ServerRequest,
} from 'relay-runtime';

export interface PreloadedQueryResponse<TData> {
    readonly data: TData;
    readonly errors?: ReadonlyArray<{ readonly message: string }>;
}

export interface PreloadedQueryRef<TVariables, TData> {
    readonly kind: 'PreloadedQueryRef';
    readonly queryId: string;
    readonly variables: TVariables;
    readonly _response: Promise<PreloadedQueryResponse<TData>>;
    readonly fetchedAt: number;
}

export interface ServerEnvironment {
    readonly getEnvironment: () => IEnvironment;
    readonly serverFetchQuery: <T extends OperationType>(
        query: GraphQLTaggedNode,
        variables: T['variables'],
    ) => Promise<T['response']>;
    readonly serverPreloadQuery: <T extends OperationType>(
        query: GraphQLTaggedNode,
        variables: T['variables'],
    ) => PreloadedQueryRef<T['variables'], T['response']>;
    readonly serverReadFragment: {
        <TKey extends KeyType>(
            fragment: GraphQLTaggedNode,
            fragmentRef: TKey,
        ): Promise<KeyTypeData<TKey>>;
        <TKey extends ArrayKeyType>(
            fragment: GraphQLTaggedNode,
            fragmentRef: TKey,
        ): Promise<ArrayKeyTypeData<TKey>>;
    };
    /**
     * Executes a `@server` query in this request's server environment and
     * resolves with its data once the first payload has arrived. Client
     * fragment references in the data carry their data to client components.
     */
    readonly serverQuery: {
        <T extends ServerOperationType>(
            query: ServerRequest<T>,
            variables: NoInfer<T['variables']>,
            options?: ServerQueryOptions,
        ): Promise<T['response']>;
        <T extends ServerOperationType = never>(
            query: GraphQLTaggedNode,
            variables: [T] extends [never] ? never : NoInfer<T['variables']>,
            options?: ServerQueryOptions,
        ): Promise<T['response']>;
    };
    /**
     * Reads a `@server` fragment in a server component. Returns synchronously
     * when the data is present; suspends until it arrives otherwise.
     */
    readonly useServerFragment: {
        <TKey extends ServerKeyType>(
            fragment: GraphQLTaggedNode,
            fragmentRef: TKey,
        ): KeyTypeData<TKey>;
        <TKey extends ServerArrayKeyType>(
            fragment: GraphQLTaggedNode,
            fragmentRef: TKey,
        ): ArrayKeyTypeData<TKey>;
    };
}

type ServerKeyType<TData = unknown> = KeyType<TData> & Readonly<{
    ' $serverFragment': true;
}>;

type ServerArrayKeyType<TData = unknown> = ReadonlyArray<
    ServerKeyType<readonly TData[]> | null | undefined
>;

export interface ServerQueryOptions {
    readonly signal?: AbortSignal;
}

export function createServerEnvironment(
    create: () => IEnvironment,
): ServerEnvironment;
