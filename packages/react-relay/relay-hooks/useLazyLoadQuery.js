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

import type {LazyLoadQueryNodeParamsWithQuery} from './useLazyLoadQueryNode';
import type {
  CacheConfig,
  FetchPolicy,
  Query,
  RenderPolicy,
  Variables,
} from 'relay-runtime';

const useLazyLoadQueryNode = require('./useLazyLoadQueryNode');
const useMemoOperationDescriptor = require('./useMemoOperationDescriptor');
const useRelayEnvironment = require('./useRelayEnvironment');
const {
  __internal: {fetchQuery},
} = require('relay-runtime');

// This separate type export is only needed as long as we are injecting
// a separate hooks implementation in ./HooksImplementation -- it can
// be removed after we stop doing that.
export type UseLazyLoadQueryHookType = hook <
  TVariables extends Variables,
  TData,
>(
  gqlQuery: Query<TVariables, TData>,
  variables: TVariables,
  options?: Options,
) => TData;

type Options = {
  /**
   * Determines if cached data should be used, and when to send a network request based on the cached data that is currently available in the Relay store (for more details, see our [Fetch Policies](../../guided-tour/reusing-cached-data/fetch-policies) and [Garbage Collection](../../guided-tour/reusing-cached-data/presence-of-data) guides):
   *      * "store-or-network": _*(default)*_ *will* reuse locally cached data and will *only* send a network request if any data for the query is missing. If the query is fully cached, a network request will *not* be made.
   *      * "store-and-network": *will* reuse locally cached data and will *always* send a network request, regardless of whether any data was missing from the local cache or not.
   *      * "network-only": *will* *not* reuse locally cached data, and will *always* send a network request to fetch the query, ignoring any data that might be locally cached in Relay.
   *      * "store-only": *will* *only* reuse locally cached data, and will *never* send a network request to fetch the query. In this case, the responsibility of fetching the query falls to the caller, but this policy could also be used to read and operate on data that is entirely [local](../../guided-tour/updating-data/local-data-updates).
   */
  readonly fetchPolicy?: FetchPolicy,
  /**
   * A `fetchKey` can be passed to force a re-evaluation of the current query and variables when the component re-renders, even if the variables didn't change, or even if the component isn't remounted (similarly to how passing a different `key` to a React component will cause it to remount). If the `fetchKey` is different from the one used in the previous render, the current query will be re-evaluated against the store, and it might be refetched depending on the current `fetchPolicy` and the state of the cache.
   */
  readonly fetchKey?: string | number,
  /**
   * Default value: `{force: true}`. Object containing cache config options for the *network layer*. Note that the network layer may contain an *additional* query response cache which will reuse network responses for identical queries. If you want to bypass this cache completely (which is the default behavior), pass `{force: true}` as the value for this option.
   */
  readonly networkCacheConfig?: CacheConfig,
  /**
   * Undocumented option.
   */
  readonly UNSTABLE_renderPolicy?: RenderPolicy,
};

/**
 * Hook used to fetch a GraphQL query during render. This hook can trigger multiple nested or waterfalling round trips if used without caution, and waits until render to start a data fetch (when it can usually start a lot sooner than render), thereby degrading performance. Instead, prefer [`usePreloadedQuery`](../use-preloaded-query).
 *
 * @example
 * const React = require('React');
 *
 * const {graphql, useLazyLoadQuery} = require('react-relay');
 *
 * function App() {
 *   const data = useLazyLoadQuery(
 *     graphql`
 *       query AppQuery($id: ID!) {
 *         user(id: $id) {
 *           name
 *         }
 *       }
 *     `,
 *     {id: 4},
 *     {fetchPolicy: 'store-or-network'},
 *   );
 *
 *  return <h1>{data.user?.name}</h1>;
 * }
 *
 * @returns - `data`: Object that contains data which has been read out from the Relay store; the object matches the shape of specified query.
 *   - The Flow type for data will also match this shape, and contain types derived from the GraphQL Schema. For example, the type of `data` above is: `{| user: ?{| name: ?string |} |}`.
 */
hook useLazyLoadQuery<TVariables extends Variables, TData>(
  /**
   * GraphQL query specified using a `graphql` template literal.
   */
  gqlQuery: Query<TVariables, TData>,
  /**
   * Object containing the variable values to fetch the query. These variables need to match GraphQL variables declared inside the query.
   */
  variables: NoInfer<TVariables>,
  /**
   * options object
   */
  options?: Options,
): TData {
  const environment = useRelayEnvironment();

  const query = useMemoOperationDescriptor(
    gqlQuery,
    variables,
    options && options.networkCacheConfig
      ? options.networkCacheConfig
      : {force: true},
  );
  const data = useLazyLoadQueryNode<
    {variables: TVariables, response: TData},
    LazyLoadQueryNodeParamsWithQuery,
  >({
    componentDisplayName: 'useLazyLoadQuery()',
    fetchKey: options?.fetchKey,
    fetchObservable: fetchQuery(environment, query),
    fetchPolicy: options?.fetchPolicy,
    query,
    renderPolicy: options?.UNSTABLE_renderPolicy,
  });
  return data;
}

module.exports = useLazyLoadQuery;
