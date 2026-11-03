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

import type {RefetchFn} from './useRefetchableFragment';
import type {Options} from './useRefetchableFragmentInternal';
import type {FragmentType, Variables} from 'relay-runtime';
import type {PrefetchableRefetchableFragment} from 'relay-runtime';

const getFragmentInternalData = require('./getFragmentInternalData');
const useFragment = require('./useFragment');
const useLoadMoreFunction = require('./useLoadMoreFunction');
const useRefetchableFragmentInternal = require('./useRefetchableFragmentInternal');
const useRelayEnvironment = require('./useRelayEnvironment');
const useStaticFragmentNodeWarning = require('./useStaticFragmentNodeWarning');
const invariant = require('invariant');
const {
  useCallback,
  useDebugValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} = require('react');
const {
  getFragment,
  getFragmentIdentifier,
  getPaginationMetadata,
} = require('relay-runtime');
const {
  ConnectionInterface,
  getSelector,
  getValueAtPath,
} = require('relay-runtime');

type LoadMoreFn<TVariables extends Variables> = (
  count: number,
  options?: {
    onComplete?: (v: Error | null) => void,
    UNSTABLE_extraVariables?: Partial<TVariables>,
  },
) => void;

export type ReturnType<TVariables, TData, TEdgeData, TKey> = {
  // NOTE: This type ensures that the type of the returned data is either:
  //   - nullable if the provided ref type is nullable
  //   - non-nullable if the provided ref type is non-nullable
  data: [readonly key: TKey] extends [
    readonly key: {readonly $fragmentSpreads: unknown, ...},
  ]
    ? TData
    : ?TData,
  loadNext: LoadMoreFn<TVariables>,
  hasNext: boolean,
  isLoadingNext: boolean,
  refetch: RefetchFn<TVariables, TKey>,
  edges: TEdgeData,
};

type LoadMoreOptions<TVariables> = {
  UNSTABLE_extraVariables?: Partial<TVariables>,
  onComplete?: (v: Error | null) => void,
};

export type GetExtraVariablesFn<TEdgeData, TData, TVariables, TKey> = (v: {
  hasNext: boolean,
  data: [readonly key: TKey] extends [
    readonly key: {readonly $fragmentSpreads: unknown, ...},
  ]
    ? TData
    : ?TData,
  getServerEdges: () => TEdgeData,
}) => Partial<TVariables>;

hook usePrefetchableForwardPaginationFragment<
  TFragmentType extends FragmentType,
  TVariables extends Variables,
  TData,
  TEdgeData,
  TKey extends ?{readonly $fragmentSpreads: TFragmentType, ...},
>(
  fragmentInput: PrefetchableRefetchableFragment<
    TFragmentType,
    TData,
    TEdgeData,
    TVariables,
  >,
  parentFragmentRef: TKey,
  bufferSize: number,
  initialSize?: ?number,
  prefetchingLoadMoreOptions?: {
    UNSTABLE_extraVariables?:
      | Partial<TVariables>
      | GetExtraVariablesFn<TEdgeData, TData, TVariables, TKey>,
    onComplete?: (v: Error | null) => void,
  },
  minimalFetchSize: number = 1,
  disablePrefetching?: boolean = false,
  maxFetchSize?: ?number,
): ReturnType<TVariables, TData, TEdgeData, TKey> {
  const fragmentNode = getFragment(fragmentInput);
  useStaticFragmentNodeWarning(
    fragmentNode,
    'first argument of usePrefetchableForwardPaginationFragment()',
  );
  const componentDisplayName = 'usePrefetchableForwardPaginationFragment()';

  const {connectionPathInFragmentData, paginationRequest, paginationMetadata} =
    getPaginationMetadata(fragmentNode, componentDisplayName);

  const {fragmentData, fragmentRef, refetch} = useRefetchableFragmentInternal<
    {variables: TVariables, response: TData},
    {data?: TData},
  >(fragmentNode, parentFragmentRef, componentDisplayName);
  // TODO: Get rid of `getFragmentIdentifier`
  const fragmentIdentifier = getFragmentIdentifier(fragmentNode, fragmentRef);

  const edgeKeys = useMemo(() => {
    const connection = getValueAtPath(
      getFragmentInternalData(fragmentNode, fragmentData),
      connectionPathInFragmentData,
    );
    if (connection == null) {
      return null;
    }
    const {EDGES} = ConnectionInterface.get();
    // $FlowFixMe[incompatible-use]
    return connection[EDGES];
  }, [connectionPathInFragmentData, fragmentData, fragmentNode]);

  const sourceSize = edgeKeys == null ? -1 : edgeKeys.length;

  const [_numInUse, setNumInUse] = useState(
    initialSize != null ? initialSize : sourceSize,
  );
  let numInUse = _numInUse;
  // We can only reset the source size when the component is
  // updated with new edgeKeys
  if (_numInUse === -1 && sourceSize !== -1) {
    numInUse = initialSize != null ? initialSize : sourceSize;
    setNumInUse(numInUse);
  }

  const environment = useRelayEnvironment();
  const [isLoadingMore, reallySetIsLoadingMore] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const availableSizeRef = useRef(0);
  // Schedule this update since it must be observed by components at the same
  // batch as when hasNext changes. hasNext is read from the store and store
  // updates are scheduled, so this must be scheduled too.
  const setIsLoadingMore = useCallback(
    (value: boolean) => {
      const schedule = environment.getScheduler()?.schedule;
      if (schedule) {
        schedule(() => {
          reallySetIsLoadingMore(value);
        });
      } else {
        reallySetIsLoadingMore(value);
      }
    },
    [environment],
  );

  // `isLoadingMore` state is updated in a low priority, internally we need
  // to synchronously get the loading state to decide whether to load more
  const isLoadingMoreRef = useRef(false);

  // When a pagination request fails, automatic prefetching is paused so we don't
  // keep retrying against a failing server in a tight loop (which can effectively
  // DDOS the backend). Prefetching resumes when the product explicitly calls
  // `loadNext`, or after a `refetch`/reset.
  const hasPrefetchErroredRef = useRef(false);

  const observer = useMemo(() => {
    function setIsLoadingFalse() {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
    function handleError() {
      // Stop the automatic prefetch loop until the product explicitly asks for
      // more items again, otherwise the prefetch `useEffect` would immediately
      // re-issue the request and hammer the server.
      hasPrefetchErroredRef.current = true;
      setIsLoadingFalse();
    }
    return {
      start: () => {
        isLoadingMoreRef.current = true;
        // We want to make sure that `isLoadingMore` is updated immediately, to avoid
        // product code triggering multiple `loadMore` calls
        reallySetIsLoadingMore(true);
      },
      complete: setIsLoadingFalse,
      error: handleError,
      unsubscribe: setIsLoadingFalse,
    };
  }, [setIsLoadingMore]);
  const handleReset = useCallback(() => {
    hasPrefetchErroredRef.current = false;
    if (!isRefetching) {
      // Do not reset items count during refetching
      const schedule = environment.getScheduler()?.schedule;
      if (schedule) {
        schedule(() => {
          setNumInUse(-1);
        });
      } else {
        setNumInUse(-1);
      }
    }
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
  }, [environment, isRefetching, setIsLoadingMore]);

  const [loadMore, hasNext, disposeFetchNext] = useLoadMoreFunction<TVariables>(
    {
      componentDisplayName,
      connectionPathInFragmentData,
      direction: 'forward',
      fragmentData,
      fragmentIdentifier,
      fragmentNode,
      fragmentRef,
      paginationMetadata,
      paginationRequest,
      observer,
      onReset: handleReset,
    },
  );

  useLayoutEffect(() => {
    // Make sure `availableSize` is updated before `showMore` from current render can be called
    availableSizeRef.current = sourceSize - numInUse;
  }, [numInUse, sourceSize]);

  const prefetchingUNSTABLE_extraVariables =
    prefetchingLoadMoreOptions?.UNSTABLE_extraVariables;
  const prefetchingOnComplete = prefetchingLoadMoreOptions?.onComplete;

  // Normalize the cap to a usable upper bound. A non-positive `maxFetchSize` is
  // treated as "no cap" rather than clamping requests to `first: 0`, which would
  // make no progress and re-introduce the infinite prefetch loop this cap exists
  // to prevent.
  const effectiveMaxFetchSize =
    maxFetchSize != null && maxFetchSize > 0 ? maxFetchSize : Infinity;

  const showMore = useCallback(
    (numToAdd: number, options?: LoadMoreOptions<TVariables>) => {
      // Matches the behavior of `usePaginationFragment`. If there is a `loadMore` ongoing,
      // the hook handles making the `loadMore` a no-op.
      if (!isLoadingMoreRef.current || availableSizeRef.current >= 0) {
        // An explicit `loadNext` is a deliberate user action, so clear any
        // previous prefetch error and re-enable automatic prefetching — even
        // when this call is served entirely from the buffer and issues no
        // network request.
        hasPrefetchErroredRef.current = false;

        // Preemtively update `availableSizeRef`, so if two `loadMore` is called in the same tick,
        // a second `loadMore` can be no-op
        availableSizeRef.current -= numToAdd;

        setNumInUse(lastNumInUse => {
          return lastNumInUse + numToAdd;
        });

        // If the product needs more items from network, load the amount needed to fullfil
        // the requirement and cache, capped at the current amount defined by product
        if (!isLoadingMoreRef.current && availableSizeRef.current < 0) {
          loadMore(
            // Cap the request at `maxFetchSize` so we never generate a query
            // large enough to overwhelm the backend.
            Math.min(
              Math.max(
                minimalFetchSize,
                Math.min(numToAdd, bufferSize - availableSizeRef.current),
              ),
              effectiveMaxFetchSize,
            ),
            // Keep options For backward compatibility
            options ?? {
              onComplete: prefetchingOnComplete,
              UNSTABLE_extraVariables:
                typeof prefetchingUNSTABLE_extraVariables === 'function'
                  ? // $FlowFixMe[incompatible-type]
                    prefetchingUNSTABLE_extraVariables({
                      hasNext,
                      // $FlowFixMe[incompatible-type]
                      data: fragmentData,
                      getServerEdges: () => {
                        const selector = getSelector(
                          // $FlowFixMe[incompatible-type]
                          edgesFragment,
                          edgeKeys,
                        );
                        if (selector == null) {
                          // $FlowFixMe[incompatible-type]
                          return [];
                        }
                        invariant(
                          selector.kind === 'PluralReaderSelector',
                          'Expected a plural selector',
                        );
                        // $FlowFixMe[incompatible-type]
                        return selector.selectors.map(
                          sel => environment.lookup(sel).data,
                        );
                      },
                    })
                  : prefetchingUNSTABLE_extraVariables,
            },
          );
        }
      }
    },
    [
      bufferSize,
      loadMore,
      minimalFetchSize,
      effectiveMaxFetchSize,
      edgeKeys,
      fragmentData,
      prefetchingUNSTABLE_extraVariables,
      prefetchingOnComplete,
    ],
  );

  const edgesFragment = fragmentInput.metadata?.refetch?.edgesFragment;
  invariant(
    edgesFragment != null,
    'usePrefetchableForwardPaginationFragment: Expected the edge fragment to be defined, ' +
      'please make sure you have added `prefetchable_pagination: true`  to `@connection`',
  );

  // Always try to keep `bufferSize` items in the buffer
  // Or load the number of items that have been registred to show
  useEffect(() => {
    if (
      // Check the ref to avoid infinite `loadMore`, when a `loadMore` has started,
      // but `isLoadingMore` isn't updated
      !isLoadingMoreRef.current &&
      // Check the original `isLoadingMore` so when `loadMore` is called,  the internal
      // `loadMore` hook has been updated with the latest cursor
      !isLoadingMore &&
      !isRefetching &&
      !disablePrefetching &&
      // If a previous prefetch request errored, stop automatically retrying so
      // we don't thrash the server. Prefetching resumes after an explicit
      // `loadNext` or a `refetch`.
      !hasPrefetchErroredRef.current &&
      hasNext &&
      (sourceSize - numInUse < bufferSize || numInUse > sourceSize)
    ) {
      const onComplete = prefetchingOnComplete;
      loadMore(
        // Cap the request at `maxFetchSize` so we never generate a query large
        // enough to overwhelm the backend (e.g. close to the connection's
        // entire `totalCount`).
        Math.min(
          Math.max(
            bufferSize - Math.max(sourceSize - numInUse, 0),
            numInUse - sourceSize,
            minimalFetchSize,
          ),
          effectiveMaxFetchSize,
        ),
        {
          onComplete,
          UNSTABLE_extraVariables:
            typeof prefetchingUNSTABLE_extraVariables === 'function'
              ? // $FlowFixMe[incompatible-type]
                prefetchingUNSTABLE_extraVariables({
                  hasNext,
                  // $FlowFixMe[incompatible-type]
                  data: fragmentData,
                  getServerEdges: () => {
                    const selector = getSelector(edgesFragment, edgeKeys);
                    if (selector == null) {
                      // $FlowFixMe[incompatible-type]
                      return [];
                    }
                    invariant(
                      selector.kind === 'PluralReaderSelector',
                      'Expected a plural selector',
                    );
                    // $FlowFixMe[incompatible-type]
                    return selector.selectors.map(
                      sel => environment.lookup(sel).data,
                    );
                  },
                })
              : prefetchingUNSTABLE_extraVariables,
        },
      );
    }
  }, [
    hasNext,
    bufferSize,
    isRefetching,
    loadMore,
    numInUse,
    prefetchingUNSTABLE_extraVariables,
    prefetchingOnComplete,
    sourceSize,
    edgeKeys,
    isLoadingMore,
    minimalFetchSize,
    effectiveMaxFetchSize,
    disablePrefetching,
    environment,
    edgesFragment,
  ]);

  const realNumInUse = Math.min(numInUse, sourceSize);

  const derivedEdgeKeys: ReadonlyArray<unknown> = useMemo(
    () => edgeKeys?.slice(0, realNumInUse) ?? [],
    [edgeKeys, realNumInUse],
  );

  // $FlowExpectedError[incompatible-type] - we know derivedEdgeKeys are the correct keys
  const edges: TEdgeData = useFragment(edgesFragment, derivedEdgeKeys);

  const refetchPagination = useCallback(
    (variables: TVariables, options?: Options) => {
      disposeFetchNext();
      // A refetch is a fresh start, so re-enable automatic prefetching.
      hasPrefetchErroredRef.current = false;
      setIsRefetching(true);
      return refetch(variables, {
        ...options,
        onComplete: maybeError => {
          // Need to be batched with the store update
          const schedule = environment.getScheduler()?.schedule;
          if (schedule) {
            schedule(() => {
              setIsRefetching(false);
              setNumInUse(-1);
            });
          } else {
            setIsRefetching(false);
            setNumInUse(-1);
          }
          options?.onComplete?.(maybeError);
        },
        __environment: undefined,
      });
    },
    [disposeFetchNext, environment, refetch],
  );

  if (__DEV__) {
    // $FlowFixMe[react-rule-hook-conditional]
    useDebugValue({
      fragment: fragmentNode.name,
      data: fragmentData,
      hasNext,
      isLoadingNext: isLoadingMore,
    });
  }

  return {
    edges,
    // $FlowFixMe[incompatible-type]
    data: fragmentData,
    loadNext: showMore,
    hasNext: hasNext || sourceSize > numInUse,
    // Only reflect `isLoadingMore` if the product depends on it, do not refelect
    // `isLoaindgMore` state if it is for fufilling the buffer
    isLoadingNext: isLoadingMore && numInUse > sourceSize,
    // $FlowFixMe[incompatible-type]
    refetch: refetchPagination,
  };
}

module.exports = usePrefetchableForwardPaginationFragment;
