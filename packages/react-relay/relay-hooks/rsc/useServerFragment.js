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

import type {ServerQueryExecution} from './serverQueryExecutions';
import type {
  Fragment,
  FragmentType,
  IEnvironment,
  SingularReaderSelector,
} from 'relay-runtime';

const {getServerQueryExecution} = require('./serverQueryExecutions');
const invariant = require('invariant');
const {use} = require('react');
const {
  getFragment,
  getSelector,
  handlePotentialSnapshotErrors,
} = require('relay-runtime');
const {observeFragment} = require('relay-runtime/experimental');

type HasSpread<TFragmentType> = {
  readonly $fragmentSpreads: TFragmentType,
  ...
};

// React reads a thenable whose `status` is already set without suspending,
// so a server component whose data is present renders inline in the same
// Flight row as its parent.
type SettledThenable<T> =
  | {
      readonly status: 'fulfilled',
      readonly value: T,
      then(
        onFulfilled: ?(T) => unknown,
        onRejected: ?(unknown) => unknown,
      ): void,
    }
  | {
      readonly status: 'rejected',
      readonly reason: unknown,
      then(
        onFulfilled: ?(T) => unknown,
        onRejected: ?(unknown) => unknown,
      ): void,
    };

export type ServerFragmentThenable<T> = SettledThenable<T> | Promise<T>;

function fulfilled<T>(value: T): SettledThenable<T> {
  return {
    status: 'fulfilled',
    then(onFulfilled) {
      onFulfilled?.(value);
    },
    value,
  };
}

function rejected<T>(reason: unknown): SettledThenable<T> {
  return {
    reason,
    status: 'rejected',
    then(_onFulfilled, onRejected) {
      onRejected?.(reason);
    },
  };
}

declare function readServerFragment<TFragmentType extends FragmentType, TData>(
  environment: IEnvironment,
  fragment: Fragment<TFragmentType, TData>,
  fragmentRef:
    HasSpread<TFragmentType> | ReadonlyArray<HasSpread<TFragmentType>>,
): ServerFragmentThenable<TData>;

function readServerFragment(
  callerEnvironment: IEnvironment,
  fragment: Fragment<FragmentType, unknown>,
  fragmentRef: HasSpread<FragmentType> | ReadonlyArray<HasSpread<FragmentType>>,
): ServerFragmentThenable<unknown> {
  const fragmentNode = getFragment(fragment);
  const selector = getSelector(fragmentNode, fragmentRef);
  invariant(
    selector != null,
    'readServerFragment: Expected a reference to fragment `%s`.',
    fragmentNode.name,
  );
  const selectors: ReadonlyArray<SingularReaderSelector> =
    selector.kind === 'PluralReaderSelector' ? selector.selectors : [selector];
  const executions: Set<ServerQueryExecution> = new Set();
  for (let ii = 0; ii < selectors.length; ii++) {
    const {owner} = selectors[ii];
    const execution = getServerQueryExecution(owner);
    if (execution != null) {
      executions.add(execution);
    }
  }
  // Read through the Environment of the request the reference came from: a
  // component module can hold another `createServerEnvironment` instance,
  // and so another Environment, of the same request (e.g. after a hot
  // reload re-evaluated the module that created it).
  const environment =
    executions.values().next().value?.environment ?? callerEnvironment;

  const read = () => {
    const snapshots = selectors.map(item => environment.lookup(item));
    if (snapshots.some(snapshot => snapshot.isMissingData)) {
      return null;
    }
    snapshots.forEach(snapshot =>
      handlePotentialSnapshotErrors(environment, snapshot.fieldErrors),
    );
    const data: unknown =
      selector.kind === 'PluralReaderSelector'
        ? snapshots.map(snapshot => snapshot.data)
        : snapshots[0].data;
    return {data};
  };
  try {
    const result = read();
    if (result != null) {
      return fulfilled(result.data);
    }
  } catch (error: unknown) {
    return rejected(error);
  }

  return new Promise((resolve, reject) => {
    let done = false;
    let subscription = null;
    const finish = (settle: () => void) => {
      if (!done) {
        done = true;
        subscription?.unsubscribe();
        settle();
      }
    };
    subscription = observeFragment(
      environment,
      fragment,
      fragmentRef,
    ).subscribe({
      error: error => finish(() => reject(error)),
      next: state => {
        if (state.state === 'ok') {
          const value = state.value;
          finish(() => resolve(value));
        } else if (state.state === 'error') {
          const error = state.error;
          finish(() => reject(error));
        }
      },
    });
    if (done) {
      subscription.unsubscribe();
    }
    // A request that ended without the data, or failed, will not deliver it.
    executions.forEach(execution => {
      void execution.settled.then(() => {
        if (done) {
          return;
        }
        try {
          const result = read();
          if (result != null) {
            finish(() => resolve(result.data));
            return;
          }
        } catch (readError: unknown) {
          finish(() => reject(readError));
          return;
        }
        const error =
          execution.error ??
          new Error(
            `readServerFragment: The server query \`${execution.operation.request.node.params.name}\` ` +
              `completed without the data of fragment \`${fragmentNode.name}\`.`,
          );
        finish(() => reject(error));
      });
    });
  });
}

/**
 * Reads a fragment in a server component, like `useFragment` in a client
 * component. When the data is in the Store it returns it synchronously, so
 * the component does not suspend; otherwise it suspends until the data
 * arrives (e.g. a `@defer` payload), and throws if it cannot.
 */
hook useServerFragment<TFragmentType extends FragmentType, TData>(
  environment: IEnvironment,
  fragment: Fragment<TFragmentType, TData>,
  fragmentRef:
    HasSpread<TFragmentType> | ReadonlyArray<HasSpread<TFragmentType>>,
): TData {
  return use(readServerFragment(environment, fragment, fragmentRef));
}

module.exports = {readServerFragment, useServerFragment};
