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

import type {QueryResult} from './QueryResource';
import type {
  FetchPolicy,
  GraphQLResponse,
  Observable,
  OperationDescriptor,
  OperationType,
  ReaderFragment,
  RenderPolicy,
} from 'relay-runtime';

const ProfilerContext = require('./ProfilerContext');
const {
  getQueryCacheIdentifier,
  getQueryResourceForEnvironment,
} = require('./QueryResource');
const useFetchTrackingRef = require('./useFetchTrackingRef');
const useFragmentInternal = require('./useFragmentInternal');
const useRelayEnvironment = require('./useRelayEnvironment');
const React = require('react');

const {useContext, useEffect, useState, useRef} = React;

export type LazyLoadQueryNodeParamsWithQuery = Readonly<{
  query: OperationDescriptor,
  componentDisplayName: string,
  fetchObservable: Observable<GraphQLResponse>,
  fetchPolicy?: ?FetchPolicy,
  fetchKey?: ?string | ?number,
  renderPolicy?: ?RenderPolicy,
}>;

/**
 * This param will be used when the query key is not provided
 * (e.g. in usePreloadedQuery)
 */
export type LazyLoadQueryNodeParamsWithoutQuery = Readonly<{
  componentDisplayName: string,
  fragmentNode: ReaderFragment,
}>;

export type LazyLoadQueryNodeParams =
  LazyLoadQueryNodeParamsWithQuery | LazyLoadQueryNodeParamsWithoutQuery;

hook useLazyLoadQueryNode<
  TQuery extends OperationType,
  TParams extends LazyLoadQueryNodeParams = LazyLoadQueryNodeParams,
>(
  params: TParams,
): TParams extends LazyLoadQueryNodeParamsWithQuery
  ? TQuery['response']
  : null {
  const environment = useRelayEnvironment();
  const profilerContext = useContext(ProfilerContext);
  const QueryResource = getQueryResourceForEnvironment(environment);

  const [forceUpdateKey, forceUpdate] = useState(0);
  const {startFetch, completeFetch} = useFetchTrackingRef();

  let cacheIdentifier = null;
  let preparedQueryResult = null;
  let fragmentNode;
  if (params.query != null) {
    const {query, fetchObservable, fetchPolicy, fetchKey, renderPolicy} =
      params;
    const cacheBreaker = `${forceUpdateKey}-${fetchKey ?? ''}`;
    const queryCacheIdentifier = getQueryCacheIdentifier(
      environment,
      query,
      fetchPolicy,
      renderPolicy,
      cacheBreaker,
    );
    cacheIdentifier = queryCacheIdentifier;

    preparedQueryResult = profilerContext.wrapPrepareQueryResource(() => {
      return QueryResource.prepareWithIdentifier(
        queryCacheIdentifier,
        query,
        fetchObservable,
        fetchPolicy,
        renderPolicy,
        {start: startFetch, complete: completeFetch, error: completeFetch},
        profilerContext,
      );
    });
    fragmentNode = preparedQueryResult.fragmentNode;
  } else {
    fragmentNode = params.fragmentNode;
  }

  const maybeHiddenOrFastRefresh = useRef(false);
  useEffect(() => {
    return () => {
      // Attempt to detect if the component was
      // hidden (by Offscreen API), or fast refresh occurred;
      // Only in these situations would the effect cleanup
      // for "unmounting" run multiple times, so if
      // we are ever able to read this ref with a value
      // of true, it means that one of these cases
      // has happened.
      maybeHiddenOrFastRefresh.current = true;
    };
  }, []);

  const retainedQueryResultRef = useRef<?QueryResult>(null);
  useEffect(() => {
    if (maybeHiddenOrFastRefresh.current === true) {
      // This block only runs if the component has previously "unmounted"
      // due to it being hidden by the Offscreen API, or during fast refresh.
      // At this point, the current cached resource will have been disposed
      // by the previous cleanup, so instead of attempting to
      // do our regular commit setup, which would incorrectly attempt to
      // retain a cached query resource that was disposed, we need to force
      // a re-render so that the cache entry for this query is re-intiliazed and
      // and re-evaluated (and potentially cause a refetch).
      // A render while hidden may have already prepared a new cache entry;
      // that entry can be retained instead.
      maybeHiddenOrFastRefresh.current = false;
      if (
        preparedQueryResult == null ||
        preparedQueryResult === retainedQueryResultRef.current ||
        !QueryResource.isCached(preparedQueryResult)
      ) {
        forceUpdate(n => n + 1);
        return;
      }
    }

    if (preparedQueryResult == null) {
      return;
    }

    retainedQueryResultRef.current = preparedQueryResult;
    const disposable = QueryResource.retain(
      preparedQueryResult,
      profilerContext,
    );
    return () => {
      disposable.dispose();
    };
    // NOTE: We disable react-hooks-deps warning because the `environment`
    // and `cacheIdentifier` identities are capturing all information about whether
    // the effect should be re-executed and the query re-retained.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, cacheIdentifier]);

  useEffect(() => {
    if (preparedQueryResult == null) {
      return;
    }

    // Release any temporary retain that's not released. At this point, if the
    // cacheIdentifier doesn't change, the query is still permanently retained,
    // and the temporary retain is redundant.
    QueryResource.releaseTemporaryRetain(preparedQueryResult);
    // This effect is intended to run on every commit, thus no dependency
  });

  const data = useFragmentInternal(
    fragmentNode,
    preparedQueryResult?.fragmentRef,
    params.componentDisplayName,
  );

  // Flow is confused in understanding the conditional type.
  // We know data is the query response if input params is LazyLoadQueryNodeParamsWithQuery,
  // and void if otherwise.
  return data as $FlowFixMe;
}

module.exports = useLazyLoadQueryNode;
