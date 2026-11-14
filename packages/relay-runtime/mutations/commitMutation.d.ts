/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {PayloadError, UploadableMap} from '../network/RelayNetworkTypes';
import { GraphQLTaggedNode } from '../query/GraphQLTag';
import {Environment, SelectorStoreUpdater} from '../store/RelayStoreTypes';
import {CacheConfig, Disposable, Variables} from '../util/RelayRuntimeTypes';
import { DeclarativeMutationConfig } from './RelayDeclarativeMutationConfig';

// Mirrors the Flow type `{response: {...}, variables: {...}, rawResponse?: {...}}`,
// where `{...}` is Flow's inexact empty object ("any object"). `object` is the
// faithful TS equivalent; `Record<string, unknown>` would be too strict — it
// requires an implicit index signature, which `@catch` mutations (whose response
// is a `Result<…>` union) and interface-typed responses do not have.
export interface MutationParameters {
    readonly response: object;
    readonly variables: Variables;
    readonly rawResponse?: object | undefined;
}

export interface MutationConfig<TOperation extends MutationParameters> {
    configs?: DeclarativeMutationConfig[] | undefined;
    cacheConfig?: CacheConfig | undefined;
    mutation: GraphQLTaggedNode;
    onError?: ((error: Error) => void) | null | undefined;
    onCompleted?:
        | ((response: TOperation['response'], errors: readonly PayloadError[] | null | undefined) => void)
        | null
        | undefined;
    onSettled?: ((
        response: TOperation['response'] | null,
        errors: readonly PayloadError[] | null | undefined,
        error: Error | null | undefined,
    ) => void) | null | undefined;
    onUnsubscribe?: (() => void | null | undefined) | undefined;
    /**
     * An object whose type matches the raw response type of the mutation. Make sure you decorate
     * your mutation with `@raw_response_type` if you are using this field.
     */
    optimisticResponse?: (TOperation['rawResponse'] extends Record<string, unknown> ? TOperation['rawResponse'] : never) | undefined;
    optimisticUpdater?: SelectorStoreUpdater<TOperation['response']> | null | undefined;
    updater?: SelectorStoreUpdater<TOperation['response']> | null | undefined;
    uploadables?: UploadableMap | null | undefined;
    variables: TOperation['variables'];
}

/**
 * Higher-level helper function to execute a mutation against a specific
 * environment.
 */
export function commitMutation<TOperation extends MutationParameters = MutationParameters>(
    environment: Environment,
    config: MutationConfig<TOperation>,
): Disposable;
