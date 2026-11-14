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

import type {
  EnvironmentProviderOptions,
  PreloadedQueryInner,
  PreloadedQueryInner_DEPRECATED,
} from './EntryPointTypes.flow';
import type {ClientQuery, Query, RenderPolicy, Variables} from 'relay-runtime';

const useLazyLoadQueryNode = require('./useLazyLoadQueryNode');
const useMemoOperationDescriptor = require('./useMemoOperationDescriptor');
const useRelayEnvironment = require('./useRelayEnvironment');
const invariant = require('invariant');
const {useDebugValue} = require('react');
const {
  __internal: {fetchQueryDeduped, fetchQuery},
} = require('relay-runtime');
const warning = require('warning');

type PreloadedQuery<
  TVariables extends Variables,
  TData,
  TRawResponse,
  TEnvironmentProviderOptions = EnvironmentProviderOptions,
> =
  | PreloadedQueryInner_DEPRECATED<
      {
        variables: TVariables,
        response: TData,
        rawResponse?: TRawResponse,
      },
      TEnvironmentProviderOptions,
    >
  | PreloadedQueryInner<
      {
        variables: TVariables,
        response: TData,
        rawResponse?: TRawResponse,
      },
      TEnvironmentProviderOptions,
    >;

declare hook usePreloadedQuery<
  TVariables extends Variables,
  TData,
  TRawResponse extends ?{...} = void,
>(
  gqlQuery:
    | Query<TVariables, TData, TRawResponse>
    | ClientQuery<TVariables, TData, TRawResponse>,
  preloadedQuery: PreloadedQuery<TVariables, TData, NonNullable<TRawResponse>>,
  options?: {
    UNSTABLE_renderPolicy?: RenderPolicy,
  },
): TData;

declare hook usePreloadedQuery<
  TVariables extends Variables,
  TData,
  TRawResponse extends ?{...} = void,
>(
  gqlQuery:
    | Query<TVariables, TData, TRawResponse>
    | ClientQuery<TVariables, TData, TRawResponse>,
  preloadedQuery: ?PreloadedQuery<TVariables, TData, NonNullable<TRawResponse>>,
  options?: {
    UNSTABLE_renderPolicy?: RenderPolicy,
  },
): ?TData;

hook usePreloadedQuery<
  TVariables extends Variables,
  TData,
  TRawResponse extends ?{...} = void,
  TPreloadedQuery extends ?PreloadedQuery<
    TVariables,
    TData,
    NonNullable<TRawResponse>,
  > = PreloadedQuery<TVariables, TData, NonNullable<TRawResponse>>,
>(
  gqlQuery:
    | Query<TVariables, TData, TRawResponse>
    | ClientQuery<TVariables, TData, TRawResponse>,
  preloadedQuery: TPreloadedQuery,
  options?: {
    UNSTABLE_renderPolicy?: RenderPolicy,
  },
): ?TData {
  const environment = useRelayEnvironment();
  const operation = useMemoOperationDescriptor(
    gqlQuery,
    preloadedQuery != null ? preloadedQuery.variables : {},
    preloadedQuery != null ? preloadedQuery.networkCacheConfig : undefined,
  );

  let useLazyLoadQueryNodeParams;
  if (preloadedQuery != null) {
    const {fetchKey, fetchPolicy, source} = preloadedQuery;
    if (preloadedQuery.kind === 'PreloadedQuery_DEPRECATED') {
      invariant(
        operation.request.node.params.name === preloadedQuery.name,
        'usePreloadedQuery(): Expected data to be prefetched for query `%s`, ' +
          'got prefetch results for query `%s`.',
        operation.request.node.params.name,
        preloadedQuery.name,
      );

      useLazyLoadQueryNodeParams = {
        componentDisplayName: 'usePreloadedQuery()',
        fetchKey,
        fetchObservable: fetchQueryDeduped(
          environment,
          operation.request.identifier,
          () => {
            if (environment === preloadedQuery.environment && source != null) {
              return environment.executeWithSource({operation, source});
            } else {
              return environment.execute({operation});
            }
          },
        ),
        fetchPolicy,
        query: operation,
        renderPolicy: options?.UNSTABLE_renderPolicy,
      };
    } else {
      warning(
        preloadedQuery.isDisposed === false,
        'usePreloadedQuery(): Expected preloadedQuery to not be disposed yet. ' +
          'This is because disposing the query marks it for future garbage ' +
          'collection, and as such query results may no longer be present in the Relay ' +
          'store. In the future, this will become a hard error.',
      );

      const fallbackFetchObservable = fetchQuery(environment, operation);
      let fetchObservable;
      if (
        source != null &&
        environment === preloadedQuery.environment &&
        !preloadedQuery.isDisposed
      ) {
        // If the source observable exists and the environments match, reuse
        // the source observable.
        // If the source observable happens to be empty, we need to fall back
        // and re-execute and de-dupe the query (at render time).
        // A released query's source replays a response whose data may have
        // been garbage collected, so it is not reused.
        fetchObservable = source.ifEmpty(fallbackFetchObservable);
      } else if (environment !== preloadedQuery.environment) {
        // If a call to loadQuery is made with a particular environment, and that
        // preloaded query is passed to usePreloadedQuery in a different environment
        // context, we cannot re-use the existing preloaded query.
        // Instead, we need to fall back and re-execute and de-dupe the query with
        // the new environment (at render time).
        // TODO T68036756 track occurrences of this warning and turn it into a hard error
        warning(
          false,
          'usePreloadedQuery(): usePreloadedQuery was passed a preloaded query ' +
            'that was created with a different environment than the one that is currently ' +
            'in context. In the future, this will become a hard error.',
        );
        fetchObservable = fallbackFetchObservable;
      } else {
        // if (source == null)
        // If the source observable does not exist, we need to
        // fall back and re-execute and de-dupe the query (at render time).
        fetchObservable = fallbackFetchObservable;
      }

      useLazyLoadQueryNodeParams = {
        componentDisplayName: 'usePreloadedQuery()',
        fetchKey,
        fetchObservable,
        fetchPolicy,
        query: operation,
        renderPolicy: options?.UNSTABLE_renderPolicy,
      };
    }
  } else {
    useLazyLoadQueryNodeParams = {
      componentDisplayName: 'usePreloadedQuery()',
      fragmentNode: gqlQuery.fragment,
    };
  }

  const data = useLazyLoadQueryNode<{
    variables: TVariables,
    response: TData,
    rawResponse?: NonNullable<TRawResponse>,
  }>(useLazyLoadQueryNodeParams);

  if (__DEV__) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // $FlowFixMe[react-rule-hook-conditional]
    useDebugValue({
      data,
      fetchKey: preloadedQuery?.fetchKey,
      fetchPolicy: preloadedQuery?.fetchPolicy,
      query: preloadedQuery?.name,
      renderPolicy: options?.UNSTABLE_renderPolicy,
      variables: preloadedQuery?.variables,
    });
  }

  return data;
}

module.exports = usePreloadedQuery;
