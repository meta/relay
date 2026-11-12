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

import type {RequestParameters} from '../util/RelayConcreteNode';
import type {CacheConfig, Variables} from '../util/RelayRuntimeTypes';
import type {
  FetchFunction,
  GraphQLResponse,
  INetwork,
  LogRequestInfoFunction,
  SubscribeFunction,
  UploadableMap,
} from './RelayNetworkTypes';
import type RelayObservable from './RelayObservable';

const withProvidedVariables = require('../util/withProvidedVariables');
const {convertFetch} = require('./ConvertToExecuteFunction');
const invariant = require('invariant');

/**
 * Creates an implementation of the `Network` interface defined in
 * `RelayNetworkTypes` given `fetch` and `subscribe` functions.
 */
function create(
  fetchFn: FetchFunction,
  subscribe?: SubscribeFunction,
): INetwork {
  // Convert to functions that returns RelayObservable.
  const observeFetch = convertFetch(fetchFn);
  // Keyed on the provider's `get`, which the compiler emits as a method on a
  // module-scope singleton — so these keys are never collectable and a
  // WeakMap would buy nothing over a Map.
  const providerValueCache: Map<() => unknown, unknown> = new Map();

  function execute(
    request: RequestParameters,
    variables: Variables,
    cacheConfig: CacheConfig,
    uploadables?: ?UploadableMap,
    logRequestInfo: ?LogRequestInfoFunction,
  ): RelayObservable<GraphQLResponse> {
    const operationVariables = withProvidedVariables(
      variables,
      request.providedVariables,
      providerValueCache,
      cacheConfig?.keepProvidedVariables,
    );
    if (request.operationKind === 'subscription') {
      invariant(
        subscribe,
        'RelayNetwork: This network layer does not support Subscriptions. ' +
          'To use Subscriptions, provide a custom network layer.',
      );

      invariant(
        !uploadables,
        'RelayNetwork: Cannot provide uploadables while subscribing.',
      );
      return subscribe(request, operationVariables, cacheConfig);
    }

    const pollInterval = cacheConfig.poll;
    if (pollInterval != null) {
      invariant(
        !uploadables,
        'RelayNetwork: Cannot provide uploadables while polling.',
      );
      return observeFetch(request, operationVariables, {force: true}).poll(
        pollInterval,
      );
    }

    return observeFetch(
      request,
      operationVariables,
      cacheConfig,
      uploadables,
      logRequestInfo,
    );
  }

  return {execute};
}

module.exports = {create};
