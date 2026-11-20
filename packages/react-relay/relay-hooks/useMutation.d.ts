/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  DeclarativeMutationConfig,
  Disposable,
  GraphQLTaggedNode,
  IEnvironment,
  MutationConfig,
  MutationParameters,
  PayloadError,
  SelectorStoreUpdater,
  UploadableMap,
  VariablesOf,
} from 'relay-runtime';

export interface UseMutationConfig<TMutation extends MutationParameters> {
    variables: VariablesOf<TMutation>;
    updater?: SelectorStoreUpdater<TMutation['response']> | null | undefined;
    uploadables?: UploadableMap | undefined;
    optimisticUpdater?: SelectorStoreUpdater<TMutation['response']> | null | undefined;
    optimisticResponse?: TMutation['rawResponse'] | undefined;
    configs?: DeclarativeMutationConfig[] | undefined;
    onError?: ((error: Error) => void | null) | undefined;
    onCompleted?: ((response: TMutation['response'], errors: PayloadError[] | null) => void | null) | undefined;
    onSettled?: ((
        response: TMutation['response'] | null,
        errors: PayloadError[] | null | undefined,
        error: Error | null | undefined,
    ) => void | null) | undefined;
    onUnsubscribe?: (() => void | null) | undefined;
}

export function useMutation<TMutation extends MutationParameters>(
    mutation: GraphQLTaggedNode,
    commitMutationFn?: (environment: IEnvironment, config: MutationConfig<TMutation>) => Disposable,
): [(config: UseMutationConfig<TMutation>) => Disposable, boolean];
