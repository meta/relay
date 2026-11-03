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

import type {GraphQLTaggedNode} from '../query/GraphQLTag';
import type {Fragment} from '../util/RelayRuntimeTypes';
import type {FragmentType, SingularReaderSelector} from './RelayStoreTypes';
import type {ResolverFragmentResult} from './ResolverCache';

const {getFragment} = require('../query/GraphQLTag');
const {eventShouldThrow} = require('../util/handlePotentialSnapshotErrors');
const {getSelector} = require('./RelayModernSelector');
const invariant = require('invariant');

// When we call the user-supplied resolver function, it will in turn call
// `readFragment`, but that's a global function -- it needs information
// about what resolver is being executed, which is supplied by putting the
// info on this stack before we call the resolver function.
type ResolverContext = {
  getDataForResolverFragment: (
    v0: SingularReaderSelector,
    v1: FragmentType,
  ) => ResolverFragmentResult,
};
const contextStack: Array<ResolverContext> = [];

function withResolverContext<T>(context: ResolverContext, cb: () => T): T {
  contextStack.push(context);
  try {
    return cb();
  } finally {
    contextStack.pop();
  }
}

// NOTE: these declarations are copied from 'useFragment'; it would be good
// to figure out how to share the same type signature between the two functions.
// The declarations ensure that the type of the returned data is:
//   - non-nullable if the provided ref type is non-nullable
//   - nullable if the provided ref type is nullable
//   - array of non-nullable if the provided ref type is an array of
//     non-nullable refs
//   - array of nullable if the provided ref type is an array of nullable refs

declare function readFragment<
  TKey extends {
    readonly $data?: unknown,
    readonly $fragmentSpreads: FragmentType,
    ...
  },
>(
  fragmentInput: GraphQLTaggedNode,
  fragmentKey: TKey,
): NonNullable<TKey['$data']>;

declare function readFragment<
  TKey extends ?{
    readonly $data?: unknown,
    readonly $fragmentSpreads: FragmentType,
    ...
  },
>(
  fragmentInput: GraphQLTaggedNode,
  fragmentKey: TKey,
): ?TKey?.['$data'];

declare function readFragment<
  TKey extends ReadonlyArray<{
    readonly $data?: unknown,
    readonly $fragmentSpreads: FragmentType,
    ...
  }>,
>(
  fragmentInput: GraphQLTaggedNode,
  fragmentKey: TKey,
): NonNullable<TKey[number]['$data']>;

declare function readFragment<
  TKey extends ?ReadonlyArray<{
    readonly $data?: unknown,
    readonly $fragmentSpreads: FragmentType,
    ...
  }>,
>(
  fragmentInput: GraphQLTaggedNode,
  fragmentKey: TKey,
): ?TKey?.[number]['$data'];

declare function readFragment<TKey extends FragmentType, TData>(
  fragmentInput: Fragment<TKey, TData>,
  fragmentKey: TKey,
): TData;

function readFragment(
  fragmentInput: GraphQLTaggedNode,
  fragmentKey: FragmentType,
): unknown {
  if (!contextStack.length) {
    throw new Error(
      'readFragment should be called only from within a Relay Resolver function.',
    );
  }
  const context = contextStack[contextStack.length - 1];
  const fragmentNode = getFragment(fragmentInput);
  const fragmentSelector = getSelector(fragmentNode, fragmentKey);
  invariant(
    fragmentSelector != null,
    `Expected a selector for the fragment of the resolver ${fragmentNode.name}, but got null.`,
  );
  invariant(
    fragmentSelector.kind === 'SingularReaderSelector',
    `Expected a singular reader selector for the fragment of the resolver ${fragmentNode.name}, but it was plural.`,
  );
  const {data, isMissingData, fieldErrors} = context.getDataForResolverFragment(
    fragmentSelector,
    fragmentKey,
  );

  if (
    isMissingData ||
    (fieldErrors != null && fieldErrors.some(eventShouldThrow))
  ) {
    throw RESOLVER_FRAGMENT_ERRORED_SENTINEL;
  }

  return data;
}

const RESOLVER_FRAGMENT_ERRORED_SENTINEL: unknown = {};

module.exports = {
  RESOLVER_FRAGMENT_ERRORED_SENTINEL,
  readFragment,
  withResolverContext,
};
