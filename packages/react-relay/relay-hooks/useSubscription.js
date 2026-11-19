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

import type {
  Disposable,
  GraphQLSubscriptionConfig,
  IEnvironment,
  Variables,
} from 'relay-runtime';

const useRelayEnvironment = require('./useRelayEnvironment');
const {useEffect} = require('react');
const {requestSubscription} = require('relay-runtime');

type RequestSubscriptionFn<
  TVariables extends Variables,
  TData,
  TRawResponse,
> = (
  environment: IEnvironment,
  config: GraphQLSubscriptionConfig<TVariables, TData, TRawResponse>,
) => Disposable;

hook useSubscription<TVariables extends Variables, TData, TRawResponse>(
  config: GraphQLSubscriptionConfig<TVariables, TData, TRawResponse>,
  requestSubscriptionFn?: RequestSubscriptionFn<
    TVariables,
    TData,
    TRawResponse,
  >,
): void {
  // N.B. this will re-subscribe every render if config or requestSubscriptionFn
  // are not memoized.
  // Please do not pass an object defined in-line.
  const actualRequestSubscription: RequestSubscriptionFn<
    TVariables,
    TData,
    TRawResponse,
  > = requestSubscriptionFn ?? (requestSubscription as $FlowFixMe);
  const environment = useRelayEnvironment();
  useEffect(() => {
    const {dispose} = actualRequestSubscription(environment, config);
    /* $FlowFixMe[incompatible-type] Error exposed after fixing this typing
     * unsoundness in flow */
    return dispose;
  }, [environment, config, actualRequestSubscription]);
}

module.exports = useSubscription;
