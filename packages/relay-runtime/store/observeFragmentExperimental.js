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

import type {
  PluralReaderSelector,
  ReaderSelector,
  RequestDescriptor,
} from './RelayStoreTypes';
import type {
  Fragment,
  FragmentType,
  IEnvironment,
  SingularReaderSelector,
  Snapshot,
} from 'relay-runtime';

const Observable = require('../network/RelayObservable');
const {getObservableForActiveRequest} = require('../query/fetchQueryInternal');
const {getFragment} = require('../query/GraphQLTag');
const {
  handlePotentialSnapshotErrors,
} = require('../util/handlePotentialSnapshotErrors');
const {getSelector} = require('./RelayModernSelector');
const invariant = require('invariant');

/**
 * Models the various states that a fragment can be in over time:
 * - 'ok': The fragment has a value
 * - 'error': The fragment has an error, this could be due to a network error or
 *   a field error due to @required(action: THROW) or @throwOnFieldError
 * - 'loading': The fragment is still in flight and is still expected to resolver.
 */
export type FragmentState<T> =
  {state: 'ok', value: T} | {state: 'error', error: Error} | {state: 'loading'};

export type HasSpread<TFragmentType> = {
  readonly $fragmentSpreads: TFragmentType,
  ...
};

declare function observeFragment<TFragmentType extends FragmentType, TData>(
  environment: IEnvironment,
  fragment: Fragment<TFragmentType, TData>,
  fragmentRef:
    HasSpread<TFragmentType> | ReadonlyArray<HasSpread<TFragmentType>>,
): Observable<FragmentState<TData>>;

/**
 * EXPERIMENTAL: This API is experimental and does not yet support all Relay
 * features. Notably, it does not correctly handle some features of Relay Resolvers.
 *
 * Given a fragment and a fragment reference, returns an observable that emits
 * the state of the fragment over time. The observable will emit the following
 * values:
 * - 'ok': The fragment has a value
 * - 'error': The fragment has an error, this could be due to a network error or
 *  a field error due to @required(action: THROW) or @throwOnFieldError
 * - 'loading': The fragment is still in flight and is still expected to resolver.
 */
function observeFragment<TFragmentType extends FragmentType, TData>(
  environment: IEnvironment,
  fragment: Fragment<TFragmentType, TData>,
  fragmentRef: unknown,
): unknown {
  const fragmentNode = getFragment(fragment);
  const fragmentSelector = getSelector(fragmentNode, fragmentRef);

  invariant(fragmentSelector != null, 'Expected a selector, got null.');

  invariant(
    fragmentNode.metadata?.hasClientEdges == null ||
      fragmentSelectorUsesExecTimeResolver(fragmentSelector),
    "Client edges aren't supported yet.",
  );
  switch (fragmentSelector.kind) {
    case 'SingularReaderSelector':
      return observeSingularSelector(environment, fragment, fragmentSelector);
    case 'PluralReaderSelector': {
      return observePluralSelector(environment, fragment, fragmentSelector);
    }
  }
  invariant(false, 'Unsupported fragment selector kind');
}

function fragmentSelectorUsesExecTimeResolver(
  fragmentSelector: ReaderSelector,
) {
  switch (fragmentSelector?.kind) {
    case 'SingularReaderSelector':
      return (
        (fragmentSelector.owner.node.operation?.use_exec_time_resolvers ??
          fragmentSelector.owner.node.operation?.exec_time_resolvers_enabled_provider?.get()) ===
        true
      );
    case 'PluralReaderSelector': {
      return fragmentSelector.selectors?.every(
        selector =>
          (selector.owner.node.operation.use_exec_time_resolvers ??
            selector.owner.node.operation?.exec_time_resolvers_enabled_provider?.get()) ===
          true,
      );
    }
  }
  return false;
}

function observeSingularSelector<TFragmentType extends FragmentType, TData>(
  environment: IEnvironment,
  fragmentNode: Fragment<TFragmentType, TData>,
  fragmentSelector: SingularReaderSelector,
): Observable<FragmentState<TData>> {
  const snapshot = environment.lookup(fragmentSelector);

  return Observable.create<FragmentState<TData>>(sink => {
    sink.next(
      snapshotToFragmentState<TFragmentType, TData>(
        environment,
        fragmentNode,
        fragmentSelector.owner,
        snapshot,
      ),
    );

    const subscription = environment.subscribe(snapshot, nextSnapshot => {
      sink.next(
        snapshotToFragmentState<TFragmentType, TData>(
          environment,
          fragmentNode,
          fragmentSelector.owner,
          nextSnapshot,
        ),
      );
    });

    return () => subscription.dispose();
  });
}

function observePluralSelector<TFragmentType extends FragmentType, TData>(
  environment: IEnvironment,
  fragmentNode: Fragment<TFragmentType, TData>,
  fragmentSelector: PluralReaderSelector,
): Observable<FragmentState<Array<TData>>> {
  const snapshots = fragmentSelector.selectors.map(selector =>
    environment.lookup(selector),
  );

  return Observable.create(sink => {
    // This array is mutable since each subscription updates the array in place.
    const states = snapshots.map((snapshot, index) =>
      snapshotToFragmentState(
        environment,
        fragmentNode,
        fragmentSelector.selectors[index].owner,
        snapshot,
      ),
    );

    sink.next(mergeFragmentStates(states));

    const subscriptions = snapshots.map((snapshot, index) =>
      environment.subscribe(snapshot, latestSnapshot => {
        states[index] = snapshotToFragmentState(
          environment,
          fragmentNode,
          fragmentSelector.selectors[index].owner,
          latestSnapshot,
        );
        // This doesn't batch updates, so it will notify the subscriber multiple times
        // if a store update impacting multiple items in the list is published.
        sink.next(mergeFragmentStates(states));
      }),
    );

    return () => subscriptions.forEach(subscription => subscription.dispose());
  });
}

function snapshotToFragmentState<TFragmentType extends FragmentType, TData>(
  environment: IEnvironment,
  fragmentNode: Fragment<TFragmentType, TData>,
  owner: RequestDescriptor,
  snapshot: Snapshot,
): FragmentState<TData> {
  const missingLiveResolverFields =
    snapshot.missingLiveResolverFields != null &&
    snapshot.missingLiveResolverFields.length > 0;
  const missingClientEdges =
    snapshot.missingClientEdges != null &&
    snapshot.missingClientEdges.length > 0;
  /**
   * If any live resolvers are in a suspended state, we are in a loading state.
   */
  if (missingLiveResolverFields || missingClientEdges) {
    // Unlike in React where we need to throw a promise, here we can just return
    // a loading state and trust that our snapshot subscription will notify us
    // about all relevant state updates including the one where our live
    // resolver starts returnin a real value. This is a be less efficient than
    // directly getting a promise for the individual live resolver since we have to
    // reread on every intermediate state update, but it's technically more
    // correct since it's possible another update could cause us to stop reading this
    // live resolver.
    return {state: 'loading'};
  }

  if (snapshot.isMissingData) {
    if (
      getObservableForActiveRequest(environment, owner) != null ||
      environment
        .getOperationTracker()
        .getPendingOperationsAffectingOwner(owner) != null
    ) {
      return {state: 'loading'};
    }
  }

  try {
    handlePotentialSnapshotErrors(environment, snapshot.fieldErrors);
  } catch (error) {
    return {error, state: 'error'};
  }

  // Note: It's possible that we are missing data here but there are no requests
  // in flight to get that data. If that's the case, we return data as we have
  // it. Some fields will be `undefined` which will not match the types Relay's
  // compiler generated. This is a known type hole in Relay. To avoid this case
  // users can put `@throwOnFieldError` which changes the behavior to throw an
  // error instead of returning partial data.

  invariant(snapshot.data != null, 'Expected data to be non-null.');

  return {state: 'ok', value: snapshot.data as $FlowFixMe};
}

function mergeFragmentStates<T>(
  states: ReadonlyArray<FragmentState<T>>,
): FragmentState<Array<T>> {
  const value = [];
  for (const state of states) {
    if (state.state === 'ok') {
      value.push(state.value);
    } else {
      return state;
    }
  }
  return {state: 'ok', value};
}

module.exports = {
  observeFragment,
};
