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

import type {DeclarativeMutationConfig} from '../mutations/RelayDeclarativeMutationConfig';
import type {
  IEnvironment,
  SelectorStoreUpdater,
} from '../store/RelayStoreTypes';
import type {
  CacheConfig,
  Disposable,
  GraphQLSubscription,
  Variables,
} from '../util/RelayRuntimeTypes';

const RelayDeclarativeMutationConfig = require('../mutations/RelayDeclarativeMutationConfig');
const {getRequest} = require('../query/GraphQLTag');
const {
  createOperationDescriptor,
} = require('../store/RelayModernOperationDescriptor');
const {createReaderSelector} = require('../store/RelayModernSelector');
const warning = require('warning');

export type SubscriptionParameters = {
  readonly response: {...},
  readonly variables: {...},
  readonly rawResponse?: {...},
};

/**
 * Updated Flow type that makes use of typed graphql tagged literals with
 * type information.
 */
export type GraphQLSubscriptionConfig<
  TVariables extends Variables,
  TData,
  TRawResponse,
> = Readonly<{
  configs?: Array<DeclarativeMutationConfig>,
  cacheConfig?: CacheConfig,
  subscription: GraphQLSubscription<TVariables, TData, TRawResponse>,
  variables: NoInfer<TVariables>,
  onCompleted?: ?() => void,
  onError?: ?(error: Error) => void,
  onNext?: ?(response: ?TData) => void,
  updater?: ?SelectorStoreUpdater<TData>,
}>;

function requestSubscription<TVariables extends Variables, TData, TRawResponse>(
  environment: IEnvironment,
  config: GraphQLSubscriptionConfig<TVariables, TData, TRawResponse>,
): Disposable {
  const subscription = getRequest(config.subscription);
  if (subscription.params.operationKind !== 'subscription') {
    throw new Error('requestSubscription: Must use Subscription operation');
  }
  const {configs, onCompleted, onError, onNext, variables, cacheConfig} =
    config;
  const operation = createOperationDescriptor(
    subscription,
    variables,
    cacheConfig,
  );

  warning(
    !(config.updater && configs),
    'requestSubscription: Expected only one of `updater` and `configs` to be provided',
  );

  const {updater} = configs
    ? RelayDeclarativeMutationConfig.convert<$FlowFixMe>(
        configs,
        subscription,
        null /* optimisticUpdater */,
        config.updater,
      )
    : config;

  const sub = environment
    .executeSubscription<$FlowFixMe>({
      operation,
      updater,
    })
    .subscribe({
      complete: onCompleted,
      error: onError,
      next: responses => {
        if (onNext != null) {
          let selector = operation.fragment;
          let nextID;
          if (Array.isArray(responses)) {
            nextID = responses[0]?.extensions?.__relay_subscription_root_id;
          } else {
            nextID = responses.extensions?.__relay_subscription_root_id;
          }
          if (typeof nextID === 'string') {
            selector = createReaderSelector(
              selector.node,
              nextID,
              selector.variables,
              selector.owner,
            );
          }
          const data = environment.lookup(selector).data;
          // $FlowFixMe[incompatible-type]
          onNext(data as TData);
        }
      },
    });
  return {
    dispose: sub.unsubscribe,
  };
}

module.exports = requestSubscription;
