/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

'use strict';

import type {PayloadError, UploadableMap} from '../network/RelayNetworkTypes';
import type {GraphQLTaggedNode} from '../query/GraphQLTag';
import type {
  IEnvironment,
  MutationParameters,
  SelectorStoreUpdater,
} from '../store/RelayStoreTypes';
import type {
  CacheConfig,
  Disposable,
  Mutation,
  Variables,
} from '../util/RelayRuntimeTypes';
import type {DeclarativeMutationConfig} from './RelayDeclarativeMutationConfig';

const {getRequest} = require('../query/GraphQLTag');
const {generateUniqueClientID} = require('../store/ClientID');
const isRelayModernEnvironment = require('../store/isRelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../store/RelayModernOperationDescriptor');
const RelayDeclarativeMutationConfig = require('./RelayDeclarativeMutationConfig');
const validateMutation = require('./validateMutation');
const invariant = require('invariant');
const warning = require('warning');

export type MutationConfig<TMutation extends MutationParameters> = Readonly<{
  cacheConfig?: CacheConfig,
  configs?: Array<DeclarativeMutationConfig>,
  mutation: GraphQLTaggedNode,
  onCompleted?: ?(
    response: TMutation['response'],
    errors: ?Array<PayloadError>,
  ) => void,
  onError?: ?(error: Error) => void,
  onNext?: ?() => void,
  onSettled?: ?(
    response: TMutation['response'] | null,
    errors: ?Array<PayloadError>,
    error: ?Error,
  ) => void,
  onUnsubscribe?: ?() => void,
  optimisticResponse?: {
    readonly rawResponse?: {...},
    ...TMutation,
    ...
  }['rawResponse'],
  optimisticUpdater?: ?SelectorStoreUpdater<TMutation['response']>,
  updater?: ?SelectorStoreUpdater<TMutation['response']>,
  uploadables?: UploadableMap,
  variables: TMutation['variables'],
}>;

export type CommitMutationConfig<TVariables, TData, TRawResponse> = Readonly<{
  cacheConfig?: CacheConfig,
  configs?: Array<DeclarativeMutationConfig>,
  mutation: Mutation<TVariables, TData, TRawResponse>,
  onCompleted?: ?(response: TData, errors: ?Array<PayloadError>) => void,
  onError?: ?(error: Error) => void,
  onNext?: ?() => void,
  onSettled?: ?(
    response: TData | null,
    errors: ?Array<PayloadError>,
    error: ?Error,
  ) => void,
  onUnsubscribe?: ?() => void,
  optimisticResponse?: TRawResponse,
  optimisticUpdater?: ?SelectorStoreUpdater<TData>,
  updater?: ?SelectorStoreUpdater<TData>,
  uploadables?: UploadableMap,
  variables: NoInfer<TVariables>,
}>;

/**
 * Higher-level helper function to execute a mutation against a specific
 * environment.
 */
function commitMutation<
  TVariables extends Variables,
  TData,
  TRawResponse = {...},
>(
  environment: IEnvironment,
  config: CommitMutationConfig<TVariables, TData, TRawResponse>,
): Disposable {
  invariant(
    isRelayModernEnvironment(environment),
    'commitMutation: expected `environment` to be an instance of ' +
      '`RelayModernEnvironment`.',
  );
  const mutation = getRequest(config.mutation);
  if (mutation.params.operationKind !== 'mutation') {
    throw new Error('commitMutation: Expected mutation operation');
  }
  if (mutation.kind !== 'Request') {
    throw new Error('commitMutation: Expected mutation to be of type request');
  }
  let {optimisticResponse, optimisticUpdater, updater} = config;
  const {configs, cacheConfig, onUnsubscribe, variables, uploadables} = config;
  const operation = createOperationDescriptor(
    mutation,
    variables,
    cacheConfig,
    generateUniqueClientID(),
  );
  // TODO: remove this check after we fix flow.
  if (typeof optimisticResponse === 'function') {
    /* $FlowFixMe[incompatible-use] error exposed when improving flow typing of
     * commitMutation */
    optimisticResponse = optimisticResponse();
    warning(
      false,
      'commitMutation: Expected `optimisticResponse` to be an object, ' +
        'received a function.',
    );
  }
  if (__DEV__) {
    if (optimisticResponse instanceof Object) {
      validateMutation(optimisticResponse, mutation, variables);
    }
  }
  if (configs) {
    ({optimisticUpdater, updater} = RelayDeclarativeMutationConfig.convert<{
      variables: TVariables,
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      response: TData,
    }>(configs, mutation, optimisticUpdater, updater));
  }
  const errors: Array<PayloadError> = [];
  const subscription = environment
    .executeMutation<{
      variables: TVariables,
      /* $FlowFixMe[incompatible-type] error exposed when improving flow typing
       * of commitMutation */
      response: TData,
    }>({
      operation,
      optimisticResponse,
      optimisticUpdater,
      updater,
      uploadables,
    })
    .subscribe({
      complete: () => {
        const {onCompleted, onSettled} = config;
        const payloadErrors = errors.length !== 0 ? errors : null;
        if (onCompleted != null || onSettled != null) {
          const snapshot = environment.lookup(operation.fragment);
          onCompleted?.(snapshot.data as $FlowFixMe, payloadErrors);
          onSettled?.(snapshot.data as $FlowFixMe, payloadErrors, null);
        }
      },
      error: (err: Error) => {
        const {onError, onSettled} = config;
        onError?.(err);
        onSettled?.(null, null, err);
      },
      next: payload => {
        if (Array.isArray(payload)) {
          payload.forEach(item => {
            if (item.errors) {
              errors.push(...item.errors);
            }
          });
        } else {
          if (payload.errors) {
            errors.push(...payload.errors);
          }
        }
        config.onNext?.();
      },
      unsubscribe: onUnsubscribe,
    });
  return {dispose: subscription.unsubscribe};
}

module.exports = commitMutation;
