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
  PreloadableConcreteRequest,
  PreloadedQuery,
} from './EntryPointTypes.flow';
import type {
  NullQueryReference,
  UseQueryLoaderHookReturnType,
  UseQueryLoaderLoadQueryOptions,
} from './useQueryLoader';
import type {OperationType, Query, Variables} from 'relay-runtime';

const {loadQuery} = require('./loadQuery');
const useIsMountedRef = require('./useIsMountedRef');
const useRelayEnvironment = require('./useRelayEnvironment');
const {
  useCallback,
  useEffect,
  useInsertionEffect,
  useRef,
  useState,
} = require('react');
const {getRequest} = require('relay-runtime');

const initialNullQueryReferenceState: NullQueryReference = {
  kind: 'NullQueryReference',
};

function requestIsLiveQuery<
  TVariables extends Variables,
  TData,
  TRawResponse extends ?{...} = void,
  TQuery extends OperationType = {
    response: TData,
    variables: TVariables,
    rawResponse?: NonNullable<TRawResponse>,
  },
>(
  preloadableRequest:
    Query<TVariables, TData, TRawResponse> | PreloadableConcreteRequest<TQuery>,
): boolean {
  if (preloadableRequest.kind === 'PreloadableConcreteRequest') {
    return preloadableRequest.params.metadata.live !== undefined;
  }
  const request = getRequest(preloadableRequest);
  return request.params.metadata.live !== undefined;
}

const CLEANUP_TIMEOUT = 1000 * 60 * 5; // 5 minutes;

hook useQueryLoader_EXPERIMENTAL<
  TVariables extends Variables,
  TData,
  TRawResponse extends ?{...} = void,
>(
  preloadableRequest: Query<TVariables, TData, TRawResponse>,
  initialQueryReference?: ?PreloadedQuery<{
    response: TData,
    variables: TVariables,
    rawResponse?: NonNullable<TRawResponse>,
  }>,
): UseQueryLoaderHookReturnType<TVariables, TData> {
  type QueryType = {
    response: TData,
    variables: TVariables,
    rawResponse?: NonNullable<TRawResponse>,
  };

  /**
   * We want to always call `queryReference.dispose()` for every call to
   * `setQueryReference(loadQuery(...))` so that no leaks of data in Relay stores
   * will occur.
   *
   * However, a call to `setState(newState)` is not always followed by a commit where
   * this value is reflected in the state. Thus, we cannot reliably clean up each
   * ref with `useEffect(() => () => queryReference.dispose(), [queryReference])`.
   *
   * Instead, we keep track of each call to `loadQuery` in a ref.
   * Relying on the fact that if a state change commits, no state changes that were
   * initiated prior to the currently committing state change will ever subsequently
   * commit, we can safely dispose of all preloaded query references
   * associated with state changes initiated prior to the currently committing state
   * change.
   *
   * Finally, when the hook unmounts, we also dispose of all remaining uncommitted
   * query references.
   */

  const initialQueryReferenceInternal =
    initialQueryReference ?? initialNullQueryReferenceState;

  const environment = useRelayEnvironment();

  const isMountedRef = useIsMountedRef();
  const undisposedQueryReferencesRef = useRef<Set<
    PreloadedQuery<QueryType> | NullQueryReference,
  > | null>(null);
  if (undisposedQueryReferencesRef.current == null) {
    undisposedQueryReferencesRef.current = new Set([
      initialQueryReferenceInternal,
    ]);
  }

  const [queryReference, setQueryReference] = useState<
    PreloadedQuery<QueryType> | NullQueryReference,
  >(() => initialQueryReferenceInternal);

  const [previousInitialQueryReference, setPreviousInitialQueryReference] =
    useState<PreloadedQuery<QueryType> | NullQueryReference>(
      () => initialQueryReferenceInternal,
    );

  if (initialQueryReferenceInternal !== previousInitialQueryReference) {
    // Rendering the query reference makes it "managed" by this hook, so
    // we start keeping track of it so we can dispose it when it is no longer
    // necessary here
    // TODO(T78446637): Handle disposal of managed query references in
    // components that were never mounted after rendering
    // $FlowFixMe[react-rule-unsafe-ref]
    undisposedQueryReferencesRef.current?.add(initialQueryReferenceInternal);
    setPreviousInitialQueryReference(initialQueryReferenceInternal);
    setQueryReference(initialQueryReferenceInternal);
  }

  const disposeQuery = useCallback(() => {
    if (isMountedRef.current) {
      undisposedQueryReferencesRef.current?.add(initialNullQueryReferenceState);
      setQueryReference(initialNullQueryReferenceState);
    }
  }, [isMountedRef]);

  const queryLoaderCallback = useCallback(
    (variables: TVariables, options?: ?UseQueryLoaderLoadQueryOptions) => {
      if (!isMountedRef.current) {
        return;
      }
      const mergedOptions: ?UseQueryLoaderLoadQueryOptions =
        options != null && options.hasOwnProperty('__environment')
          ? {
              __nameForWarning: options.__nameForWarning,
              fetchPolicy: options.fetchPolicy,
              networkCacheConfig: options.networkCacheConfig,
            }
          : options;
      const updatedQueryReference = loadQuery(
        options?.__environment ?? environment,
        preloadableRequest,
        variables,
        mergedOptions as $FlowFixMe,
      );
      undisposedQueryReferencesRef.current?.add(updatedQueryReference);
      setQueryReference(updatedQueryReference);
    },
    [environment, preloadableRequest, setQueryReference, isMountedRef],
  );

  const disposeAllRemainingQueryReferences = useCallback(
    function disposeAllRemainingQueryReferences(
      preloadableRequest: Query<TVariables, TData, TRawResponse>,
      currentQueryReference:
        PreloadedQuery<QueryType> | NullQueryReference | null,
    ) {
      const undisposedQueryReferences =
        undisposedQueryReferencesRef.current ?? new Set();
      // undisposedQueryReferences.current is never reassigned
      // eslint-disable-next-line react-hooks/exhaustive-deps
      for (const undisposedQueryReference of undisposedQueryReferences) {
        if (undisposedQueryReference === currentQueryReference) {
          continue;
        }
        undisposedQueryReferences.delete(undisposedQueryReference);
        if (undisposedQueryReference.kind !== 'NullQueryReference') {
          if (requestIsLiveQuery(preloadableRequest)) {
            undisposedQueryReference.dispose &&
              undisposedQueryReference.dispose();
          } else {
            undisposedQueryReference.releaseQuery &&
              undisposedQueryReference.releaseQuery();
          }
        }
      }
    },
    [],
  );

  const cleanupTimerRef = useRef<?ReturnType<typeof setTimeout>>(null);
  const releasedWhileHiddenRef = useRef(false);
  useEffect(() => {
    if (releasedWhileHiddenRef.current) {
      // The cleanup timer released the committed query while the component
      // was hidden, so its data may have been collected. Load it again.
      releasedWhileHiddenRef.current = false;
      if (queryReference.kind !== 'NullQueryReference') {
        queryLoaderCallback(queryReference.variables, {
          fetchPolicy: queryReference.fetchPolicy,
          networkCacheConfig: queryReference.networkCacheConfig,
        });
      }
      return;
    }

    // When a new queryReference is committed, we iterate over all
    // query references in undisposedQueryReferences and dispose all of
    // the refs that aren't the currently committed one. This ensures
    // that we don't leave any dangling query references for the
    // case that loadQuery is called multiple times before commit; when
    // this happens, multiple state updates will be scheduled, but only one
    // will commit, meaning that we need to keep track of and dispose any
    // query references that don't end up committing.
    // - We are relying on the fact that sets iterate in insertion order, and we
    // can remove items from a set as we iterate over it (i.e. no iterator
    // invalidation issues.) Thus, it is safe to loop through
    // undisposedQueryReferences until we find queryReference, and
    // remove and dispose all previous references.
    // - We are guaranteed to find queryReference in the set, because if a
    // state update results in a commit, no state updates initiated prior to that
    // one will be committed, and we are disposing and removing references
    // associated with updates that were scheduled prior to the currently
    // committing state change. (A useEffect callback is called during the commit
    // phase.)
    disposeAllRemainingQueryReferences(preloadableRequest, queryReference);
    if (cleanupTimerRef.current != null) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    return () => {
      cleanupTimerRef.current = setTimeout(() => {
        cleanupTimerRef.current = null;
        releasedWhileHiddenRef.current = true;
        disposeAllRemainingQueryReferences(preloadableRequest, null);
      }, CLEANUP_TIMEOUT);
    };
  }, [preloadableRequest, queryReference, queryLoaderCallback]);

  useInsertionEffect(() => {
    // We use an insertion effect to ensure that we cleanup the final query
    // reference when the component truly unmounts. Note that a regular
    // useEffect may detach/reattach due to <Activity> multiple times, and
    // we don't want to free queries that may be used when the component reveals
    // again.
    return () => {
      if (cleanupTimerRef.current != null) {
        clearTimeout(cleanupTimerRef.current);
      }
      cleanupTimerRef.current = null;
      disposeAllRemainingQueryReferences(preloadableRequest, null);
    };
  }, [preloadableRequest]);

  return [
    queryReference.kind === 'NullQueryReference' ? null : queryReference,
    queryLoaderCallback,
    disposeQuery,
  ];
}

module.exports = useQueryLoader_EXPERIMENTAL;
