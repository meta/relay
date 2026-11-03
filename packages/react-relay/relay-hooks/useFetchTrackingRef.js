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

import type {Subscription} from 'relay-runtime';

const useUnsafeRef_DEPRECATED = require('./useUnsafeRef_DEPRECATED');
const {useCallback, useEffect} = require('react');

/**
 * This hook returns a mutable React ref that holds the value of whether a
 * fetch request is in flight. The reason this is a mutable ref instead of
 * state is because we don't actually want to trigger an update when this
 * changes, but instead synchronously keep track of whether the network request
 * is in flight, for example in order to bail out of a request if one is
 * already in flight. If this was state, due to the nature of concurrent
 * updates, this value wouldn't be in sync with when the request is actually
 * in flight.
 * The additional functions returned by this Hook can be used to mutate
 * the ref.
 */
hook useFetchTrackingRef(): {
  isFetchingRef: {current: ?boolean, ...},
  startFetch: (v: Subscription) => void,
  disposeFetch: () => void,
  completeFetch: () => void,
} {
  const subscriptionRef = useUnsafeRef_DEPRECATED<?Subscription>(null);
  const isFetchingRef = useUnsafeRef_DEPRECATED<?boolean>(false);

  const disposeFetch = useCallback(() => {
    if (subscriptionRef.current != null) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    isFetchingRef.current = false;
  }, []);

  const startFetch = useCallback((subscription: Subscription) => {
    subscriptionRef.current = subscription;
    isFetchingRef.current = true;
  }, []);

  const completeFetch = useCallback(() => {
    subscriptionRef.current = null;
    isFetchingRef.current = false;
  }, []);

  // Dipose of ongoing fetch on unmount
  useEffect(() => disposeFetch, [disposeFetch]);

  return {isFetchingRef, startFetch, disposeFetch, completeFetch};
}

module.exports = useFetchTrackingRef;
