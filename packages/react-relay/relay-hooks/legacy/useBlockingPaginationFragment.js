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

import type {LoadMoreFn, UseLoadMoreFunctionArgs} from '../useLoadMoreFunction';
import type {Options} from './useRefetchableFragmentNode';
import type {RefetchableFragment} from 'relay-runtime';
import type {Disposable, FragmentType, Variables} from 'relay-runtime';

const useLoadMoreFunction = require('../useLoadMoreFunction');
const useStaticFragmentNodeWarning = require('../useStaticFragmentNodeWarning');
const useRefetchableFragmentNode = require('./useRefetchableFragmentNode');
const invariant = require('invariant');
const {useCallback, useEffect, useRef, useState} = require('react');
const {
  getFragment,
  getFragmentIdentifier,
  getPaginationMetadata,
} = require('relay-runtime');

type RefetchVariables<TVariables, TKey> =
  // NOTE: This type ensures that the type of the variables is either:
  //   - nullable if the provided ref type is non-nullable
  //   - non-nullable if the provided ref type is nullable, and the caller need to provide the full set of variables
  [readonly key: TKey] extends [
    readonly key: {readonly $fragmentSpreads: unknown, ...},
  ]
    ? Partial<TVariables>
    : TVariables;

type RefetchFnBase<TVars, TOptions> = (
  vars: TVars,
  options?: TOptions,
) => Disposable;

type RefetchFn<TVariables, TKey, TOptions = Options> = RefetchFnBase<
  RefetchVariables<TVariables, TKey>,
  TOptions,
>;

type ReturnType<TVariables extends Variables, TData, TKey> = {
  // NOTE: This rtpw ensures that the type of the returned data is either:
  //   - nullable if the provided ref type is nullable
  //   - non-nullable if the provided ref type is non-nullable
  data: [readonly key: TKey] extends [
    readonly key: {readonly $fragmentSpreads: unknown, ...},
  ]
    ? TData
    : ?TData,
  loadNext: LoadMoreFn<TVariables>,
  loadPrevious: LoadMoreFn<TVariables>,
  hasNext: boolean,
  hasPrevious: boolean,
  refetch: RefetchFn<TVariables, TKey>,
};

hook useBlockingPaginationFragment<
  TFragmentType extends FragmentType,
  TVariables extends Variables,
  TData,
  TKey extends ?{readonly $fragmentSpreads: TFragmentType, ...},
>(
  fragmentInput: RefetchableFragment<TFragmentType, TData, TVariables>,
  parentFragmentRef: TKey,
  componentDisplayName: string = 'useBlockingPaginationFragment()',
): ReturnType<TVariables, TData, TKey> {
  const fragmentNode = getFragment(fragmentInput);
  useStaticFragmentNodeWarning(
    fragmentNode,
    `first argument of ${componentDisplayName}`,
  );

  const {
    connectionPathInFragmentData,
    paginationRequest,
    paginationMetadata,
    stream,
  } = getPaginationMetadata(fragmentNode, componentDisplayName);
  invariant(
    stream === false,
    'Relay: @stream_connection is not compatible with `useBlockingPaginationFragment`. ' +
      'Use `useStreamingPaginationFragment` instead.',
  );

  const {
    fragmentData,
    fragmentRef,
    refetch,
    disableStoreUpdates,
    enableStoreUpdates,
  } = useRefetchableFragmentNode<
    {
      response: TData,
      variables: TVariables,
    },
    {
      readonly $data: unknown,
      ...
    },
  >(fragmentNode, parentFragmentRef, componentDisplayName);
  const fragmentIdentifier = getFragmentIdentifier(fragmentNode, fragmentRef);

  // Backward pagination
  const [loadPrevious, hasPrevious, disposeFetchPrevious] = useLoadMore<
    TVariables,
    TData,
  >({
    componentDisplayName,
    connectionPathInFragmentData,
    direction: 'backward',
    disableStoreUpdates,
    enableStoreUpdates,
    fragmentData,
    fragmentIdentifier,
    fragmentNode,
    fragmentRef,
    paginationMetadata,
    paginationRequest,
  });

  // Forward pagination
  const [loadNext, hasNext, disposeFetchNext] = useLoadMore<TVariables, TData>({
    componentDisplayName,
    connectionPathInFragmentData,
    direction: 'forward',
    disableStoreUpdates,
    enableStoreUpdates,
    fragmentData,
    fragmentIdentifier,
    fragmentNode,
    fragmentRef,
    paginationMetadata,
    paginationRequest,
  });

  const refetchPagination: RefetchFn<TVariables, TKey> = useCallback(
    (variables: TVariables, options: void | Options) => {
      disposeFetchNext();
      disposeFetchPrevious();
      // $FlowFixMe[incompatible-type]
      return refetch(variables, {...options, __environment: undefined});
    },
    [disposeFetchNext, disposeFetchPrevious, refetch],
  );

  return {
    // $FlowFixMe[incompatible-type]
    // $FlowFixMe[incompatible-type]
    data: fragmentData as TData,
    hasNext,
    hasPrevious,
    loadNext,
    loadPrevious,
    refetch: refetchPagination,
  };
}

hook useLoadMore<TVariables extends Variables>(args: {
  disableStoreUpdates: () => void,
  enableStoreUpdates: () => void,
  ...$Exact<Omit<UseLoadMoreFunctionArgs, 'observer' | 'onReset'>>,
}): [LoadMoreFn<TVariables>, boolean, () => void] {
  const {disableStoreUpdates, enableStoreUpdates, ...loadMoreArgs} = args;
  const [requestPromise, setRequestPromise] = useState<null | Promise<unknown>>(
    null,
  );
  const requestPromiseRef = useRef<null | Promise<unknown>>(null);
  const promiseResolveRef = useRef<null | (() => void)>(null);

  const promiseResolve = () => {
    if (promiseResolveRef.current != null) {
      promiseResolveRef.current();
      promiseResolveRef.current = null;
    }
  };

  const handleReset = () => {
    promiseResolve();
  };

  const observer = {
    complete: promiseResolve,
    // TODO: Handle error; we probably don't want to throw an error
    // and blow away the whole list of items.
    error: promiseResolve,
    // NOTE: Since streaming is disallowed with this hook, this means that the
    // first payload will always contain the entire next page of items,
    // while subsequent paylaods will contain @defer'd payloads.
    // This allows us to unsuspend here, on the first payload, and allow
    // descendant components to suspend on their respective @defer payloads
    next: promiseResolve,
    // NOTE: loadMore is a no-op if a request is already in flight, so we
    // can safely assume that `start` will only be called once while a
    // request is in flight.
    start: () => {
      // NOTE: We disable store updates when we suspend to ensure
      // that higher-pri updates from the Relay store don't disrupt
      // any Suspense timeouts passed via withSuspenseConfig.
      disableStoreUpdates();

      const promise = new Promise(resolve => {
        promiseResolveRef.current = () => {
          requestPromiseRef.current = null;
          resolve();
        };
      });
      requestPromiseRef.current = promise;
      setRequestPromise(promise);
    },
  };
  const [loadMore, hasMore, disposeFetch] = useLoadMoreFunction<TVariables>({
    ...loadMoreArgs,
    observer,
    onReset: handleReset,
  });

  // NOTE: To determine if we need to suspend, we check that the promise in
  // state is the same as the promise on the ref, which ensures that we
  // wont incorrectly suspend on other higher-pri updates before the update
  // to suspend has committed.
  if (requestPromise != null && requestPromise === requestPromiseRef.current) {
    throw requestPromise;
  }

  useEffect(() => {
    if (requestPromise !== requestPromiseRef.current) {
      // NOTE: After suspense pagination has resolved, we re-enable store updates
      // for this fragment. This may cause the component to re-render if
      // we missed any updates to the fragment data other than the pagination update.
      enableStoreUpdates();
    }
    // NOTE: We know the identity of enableStoreUpdates wont change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestPromise]);

  return [loadMore, hasMore, disposeFetch];
}

module.exports = useBlockingPaginationFragment;
