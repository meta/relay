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

'use client';
'use strict';

import type {
  PreloadedQueryRef,
  PreloadedQueryResponse,
} from './serverPreloadQuery';
import type {IEnvironment, Query, Variables} from 'relay-runtime';

const usePreloadedQuery = require('../usePreloadedQuery');
const useRelayEnvironment = require('../useRelayEnvironment');
const invariant = require('invariant');
const {use, useEffect, useLayoutEffect, useMemo} = require('react');
const {
  Environment: RelayModernEnvironment,
  createOperationDescriptor,
  getRequest,
} = require('relay-runtime');

// Which refs have been published to which environment, and the notify each
// still owes. Module state, not a component ref: the attempt that publishes
// need not be the attempt that commits. Keyed by environment because
// "published" is a fact about one store.
const publishedQueryRefs: WeakMap<
  IEnvironment,
  // $FlowFixMe[unclear-type] keyed by ref identity only
  WeakMap<any, (() => void) | null>,
> = new WeakMap();

function getPublishedQueryRefs(
  environment: IEnvironment,
  // $FlowFixMe[unclear-type] keyed by ref identity only
): WeakMap<any, (() => void) | null> {
  let refs = publishedQueryRefs.get(environment);
  if (refs == null) {
    refs = new WeakMap();
    publishedQueryRefs.set(environment, refs);
  }
  return refs;
}

const DEFAULT_STALE_MS = 30_000;

// This is a 'use client' hook, so it still renders during SSR, where
// useLayoutEffect warns and does nothing. There is no notify to flush there
// either: nothing is subscribed to a server render's store.
const useIsomorphicLayoutEffect =
  // $FlowFixMe[cannot-resolve-name] `window` has no libdef in the OSS build
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

hook useQueryFromServer<TVariables extends Variables, TData>(
  query: Query<TVariables, TData>,
  queryRef: PreloadedQueryRef<TVariables, TData>,
  options?: {staleThresholdMs?: number},
): TData {
  const environment = useRelayEnvironment();
  const request = getRequest(query);
  const threshold = options?.staleThresholdMs ?? DEFAULT_STALE_MS;

  const response: PreloadedQueryResponse<TData> = use(queryRef._response);

  const isFresh =
    response.data != null && Date.now() - queryRef.fetchedAt <= threshold;

  // `publishWithDeferredNotify` is on RelayModernEnvironment rather than
  // IEnvironment while the API is experimental.
  invariant(
    environment instanceof RelayModernEnvironment,
    'useQueryFromServer: expected a RelayModernEnvironment, got `%s`. ' +
      'useQueryFromServer is currently only compatible with RelayModernStore.',
    environment.constructor?.name ?? typeof environment,
  );

  const publishedRefs = getPublishedQueryRefs(environment);
  const shouldCommit = isFresh && !publishedRefs.has(queryRef);

  if (shouldCommit) {
    const operation = createOperationDescriptor(request, queryRef.variables);

    // $FlowFixMe[unclear-type]
    const responsePayload: any = {
      data: response.data,
      errors: response.errors,
    };
    publishedRefs.set(
      queryRef,
      environment.publishWithDeferredNotify(operation, responsePayload),
    );
  }

  // A layout effect rather than during render, which would be a setState in
  // another component mid-render, and rather than a microtask, which can land
  // between concurrent-render work units. Not airtight: a subtree that renders
  // but never mounts never runs this, and its notify waits for the next one.
  useIsomorphicLayoutEffect(() => {
    const refs = getPublishedQueryRefs(environment);
    const flushNotify = refs.get(queryRef);
    if (flushNotify != null) {
      // Null rather than delete: the entry is also what marks this ref
      // published, so removing it would republish on the next render and flip
      // the fetch policy below back to network-only.
      refs.set(queryRef, null);
      flushNotify();
    }
  }, [environment, queryRef]);

  // Build a PreloadedQuery shim. Fresh data was committed to the store
  // above, so source is null and fetchPolicy is "store-or-network".
  // Stale path uses "network-only" to trigger a client-side refetch.
  const preloadedQuery = useMemo(() => {
    const isFreshAtMemo =
      response.data != null && Date.now() - queryRef.fetchedAt <= threshold;

    // If this queryRef was already committed to the store by a previous
    // component instance, read from the store even if the server timestamp
    // is past the staleness threshold. This prevents a network refetch
    // from overwriting store mutations made after the initial commit.
    const useStore =
      isFreshAtMemo || getPublishedQueryRefs(environment).has(queryRef);

    return {
      kind: 'PreloadedQuery_DEPRECATED',
      environment,
      fetchKey: queryRef.fetchedAt,
      fetchPolicy: useStore ? 'store-or-network' : 'network-only',
      id: request.params.id ?? request.params.name,
      name: request.params.name,
      source: null,
      variables: queryRef.variables,
    };
  }, [
    environment,
    queryRef.fetchedAt,
    response.data,
    queryRef.variables,
    request.params.id,
    request.params.name,
    threshold,
  ]);

  // usePreloadedQuery expects an opaque PreloadedQuery that can only be
  // created via loadQuery/useQueryLoader. There's no public API to create
  // one from server-fetched data, so we construct a plain object with the
  // fields usePreloadedQuery reads internally.
  // $FlowFixMe[incompatible-type]
  return usePreloadedQuery(query, preloadedQuery);
}

module.exports = useQueryFromServer;
