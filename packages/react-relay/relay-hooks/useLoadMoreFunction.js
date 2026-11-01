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
  ConcreteRequest,
  Direction,
  Disposable,
  GraphQLResponse,
  Observer,
  ReaderFragment,
  ReaderPaginationMetadata,
  Variables,
} from 'relay-runtime';

const getConnectionState = require('./getConnectionState');
const getFragmentInternalData = require('./getFragmentInternalData');
const useFetchTrackingRef = require('./useFetchTrackingRef');
const useIsMountedRef = require('./useIsMountedRef');
const useIsOperationNodeActive = require('./useIsOperationNodeActive');
const useLoadMoreFunction_EXPERIMENTAL = require('./useLoadMoreFunction_EXPERIMENTAL');
const useRelayEnvironment = require('./useRelayEnvironment');
const invariant = require('invariant');
const {useCallback, useEffect, useState} = require('react');
const {
  __internal: {fetchQuery},
  RelayFeatureFlags,
  createOperationDescriptor,
  getPaginationVariables,
  getRefetchMetadata,
  getSelector,
} = require('relay-runtime');
const warning = require('warning');

export type LoadMoreFn<TVariables extends Variables> = (
  count: number,
  options?: {
    onComplete?: (Error | null) => void,
    UNSTABLE_extraVariables?: Partial<TVariables>,
  },
) => Disposable;

export type UseLoadMoreFunctionArgs = {
  direction: Direction,
  fragmentNode: ReaderFragment,
  fragmentRef: unknown,
  fragmentIdentifier: string,
  fragmentData: unknown,
  connectionPathInFragmentData: ReadonlyArray<string | number>,
  paginationRequest: ConcreteRequest,
  paginationMetadata: ReaderPaginationMetadata,
  componentDisplayName: string,
  observer: Observer<GraphQLResponse>,
  onReset: () => void,
};

hook useLoadMoreFunction<TVariables extends Variables>(
  args: UseLoadMoreFunctionArgs,
): [LoadMoreFn<TVariables>, boolean, () => void] {
  if (RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY) {
    // $FlowFixMe[react-rule-hook-conditional] - the condition is static
    // $FlowFixMe[incompatible-type]
    return useLoadMoreFunction_EXPERIMENTAL(args);
  }
  // $FlowFixMe[react-rule-hook-conditional] - the condition is static
  return useLoadMoreFunction_CURRENT(args);
}

hook useLoadMoreFunction_CURRENT<TVariables extends Variables>(
  args: UseLoadMoreFunctionArgs,
): [LoadMoreFn<TVariables>, boolean, () => void] {
  const {
    direction,
    fragmentNode,
    fragmentRef,
    fragmentIdentifier,
    fragmentData,
    connectionPathInFragmentData,
    paginationRequest,
    paginationMetadata,
    componentDisplayName,
    observer,
    onReset,
  } = args;
  const environment = useRelayEnvironment();
  const {isFetchingRef, startFetch, disposeFetch, completeFetch} =
    useFetchTrackingRef();

  const {identifierInfo} = getRefetchMetadata(
    fragmentNode,
    componentDisplayName,
  );
  // When @catch wraps the fragment root in a Result envelope, look inside
  // .value for the connection / identifier fields.
  const internalFragmentData = getFragmentInternalData(
    fragmentNode,
    fragmentData,
  );
  const identifierValue =
    identifierInfo?.identifierField != null &&
    internalFragmentData != null &&
    typeof internalFragmentData === 'object'
      ? internalFragmentData[identifierInfo.identifierField]
      : null;

  const isMountedRef = useIsMountedRef();
  const [mirroredEnvironment, setMirroredEnvironment] = useState(environment);
  const [mirroredFragmentIdentifier, setMirroredFragmentIdentifier] =
    useState(fragmentIdentifier);

  const isParentQueryActive = useIsOperationNodeActive(
    fragmentNode,
    fragmentRef,
  );

  const shouldReset =
    environment !== mirroredEnvironment ||
    fragmentIdentifier !== mirroredFragmentIdentifier;
  if (shouldReset) {
    disposeFetch();
    onReset();
    setMirroredEnvironment(environment);
    setMirroredFragmentIdentifier(fragmentIdentifier);
  }

  const {cursor, hasMore} = getConnectionState(
    direction,
    fragmentNode,
    internalFragmentData,
    connectionPathInFragmentData,
  );

  // Dispose of pagination requests in flight when unmounting
  useEffect(() => {
    return () => {
      disposeFetch();
    };
  }, [disposeFetch]);

  const isRequestInvalid = internalFragmentData == null || isParentQueryActive;

  const loadMore = useCallback(
    (
      count: number,
      options: void | {
        UNSTABLE_extraVariables?: Partial<TVariables>,
        onComplete?: (Error | null) => void,
      },
    ) => {
      // TODO(T41131846): Fetch/Caching policies for loadMore

      const onComplete = options?.onComplete;
      if (isMountedRef.current !== true) {
        // Bail out and warn if we're trying to paginate after the component
        // has unmounted
        warning(
          false,
          'Relay: Unexpected fetch on unmounted component for fragment ' +
            '`%s` in `%s`. It looks like some instances of your component are ' +
            'still trying to fetch data but they already unmounted. ' +
            'Please make sure you clear all timers, intervals, ' +
            'async calls, etc that may trigger a fetch.',
          fragmentNode.name,
          componentDisplayName,
        );
        return {dispose: () => {}};
      }

      const fragmentSelector = getSelector(fragmentNode, fragmentRef);

      if (isFetchingRef.current === true || isRequestInvalid) {
        if (fragmentSelector == null) {
          warning(
            false,
            'Relay: Unexpected fetch while using a null fragment ref ' +
              'for fragment `%s` in `%s`. When fetching more items, we expect ' +
              "initial fragment data to be non-null. Please make sure you're " +
              'passing a valid fragment ref to `%s` before paginating.',
            fragmentNode.name,
            componentDisplayName,
            componentDisplayName,
          );
        }

        if (onComplete) {
          onComplete(null);
        }
        return {dispose: () => {}};
      }

      invariant(
        fragmentSelector != null &&
          fragmentSelector.kind !== 'PluralReaderSelector',
        'Relay: Expected to be able to find a non-plural fragment owner for ' +
          "fragment `%s` when using `%s`. If you're seeing this, " +
          'this is likely a bug in Relay.',
        fragmentNode.name,
        componentDisplayName,
      );

      const parentVariables = fragmentSelector.owner.variables;
      const fragmentVariables = fragmentSelector.variables;
      const extraVariables = options?.UNSTABLE_extraVariables;
      const baseVariables = {
        ...parentVariables,
        ...fragmentVariables,
      };
      const paginationVariables = getPaginationVariables(
        direction,
        count,
        cursor,
        baseVariables,
        {...extraVariables},
        paginationMetadata,
      );

      // If the query needs an identifier value ('id' or similar) and one
      // was not explicitly provided, read it from the fragment data.
      if (identifierInfo != null) {
        // @refetchable fragments are guaranteed to have an `id` selection
        // if the type is Node, implements Node, or is @fetchable. Double-check
        // that there actually is a value at runtime.
        if (typeof identifierValue !== 'string') {
          warning(
            false,
            'Relay: Expected result to have a string  ' +
              '`%s` in order to refetch, got `%s`.',
            identifierInfo.identifierField,
            identifierValue,
          );
        }
        paginationVariables[identifierInfo.identifierQueryVariableName] =
          identifierValue;
      }

      const paginationQuery = createOperationDescriptor(
        paginationRequest,
        paginationVariables,
        {force: true},
      );
      fetchQuery(environment, paginationQuery).subscribe({
        ...observer,
        start: subscription => {
          startFetch(subscription);
          observer.start && observer.start(subscription);
        },
        complete: () => {
          completeFetch();
          observer.complete && observer.complete();
          onComplete && onComplete(null);
        },
        error: error => {
          completeFetch();
          observer.error && observer.error(error);
          onComplete && onComplete(error);
        },
      });
      return {dispose: disposeFetch};
    },
    // NOTE: We disable react-hooks-deps warning because all values
    // inside paginationMetadata are static
    // NOTE: `fragmentIdentifier` stands in for `fragmentRef`. The identifier
    // encodes everything `getSelector` derives from the ref (owner identifier,
    // fragment variables, data IDs), so refs sharing an identifier are
    // interchangeable here. Depending on the ref itself would rebuild this
    // callback on every render after a refetch, because
    // `useRefetchableFragmentInternal` re-reads the refetched ref from a fresh
    // `readFragmentInternal` call each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      environment,
      identifierValue,
      direction,
      cursor,
      startFetch,
      disposeFetch,
      completeFetch,
      isFetchingRef,
      isRequestInvalid,
      fragmentNode.name,
      fragmentIdentifier,
      componentDisplayName,
    ],
  );
  return [loadMore, hasMore, disposeFetch];
}

module.exports = useLoadMoreFunction;
