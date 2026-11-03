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
  ReaderRelayLiveResolver,
  ReaderRelayResolver,
} from '../util/ReaderNode';
import type {DataID, Variables} from '../util/RelayRuntimeTypes';
import type {
  DataIDSet,
  FieldErrors,
  SingularReaderSelector,
  Snapshot,
} from './RelayStoreTypes';

const {RELAY_LIVE_RESOLVER} = require('../util/RelayConcreteNode');
const invariant = require('invariant');

export type EvaluationResult<T> = {
  resolverResult: ?T,
  snapshot: ?Snapshot,
  error: ?Error,
};

export type ResolverFragmentResult = Readonly<{
  data: unknown,
  isMissingData: boolean,
  fieldErrors: ?FieldErrors,
}>;

export type GetDataForResolverFragmentFn = (
  v: SingularReaderSelector,
) => ResolverFragmentResult;

export interface ResolverCache {
  readFromCacheOrEvaluate<T>(
    recordID: DataID,
    field: ReaderRelayResolver | ReaderRelayLiveResolver,
    variables: Variables,
    evaluate: () => EvaluationResult<T>,
    getDataForResolverFragment: GetDataForResolverFragmentFn,
  ): [
    ?T /* Answer */,
    ?DataID /* Seen record */,
    ?Error,
    ?Snapshot,
    ?DataID /* ID of record containing a suspended Live field */,
    ?DataIDSet /** Set of updated records after read. Then need to be consumed by `processFollowupUpdates` */,
  ];
  invalidateDataIDs(
    updatedDataIDs: DataIDSet, // Mutated in place
  ): void;
  ensureClientRecord(id: string, typename: string): DataID;
  notifyUpdatedSubscribers(updatedDataIDs: DataIDSet): void;
}

class NoopResolverCache implements ResolverCache {
  readFromCacheOrEvaluate<T>(
    recordID: DataID,
    field: ReaderRelayResolver | ReaderRelayLiveResolver,
    variables: Variables,
    evaluate: () => EvaluationResult<T>,
    getDataForResolverFragment: GetDataForResolverFragmentFn,
  ): [
    ?T /* Answer */,
    ?DataID /* Seen record */,
    ?Error,
    ?Snapshot,
    ?DataID /* ID of record containing a suspended Live field */,
    ?DataIDSet /** Set of dirty records after read */,
  ] {
    invariant(
      field.kind !== RELAY_LIVE_RESOLVER,
      'This store does not support Live Resolvers',
    );
    const {resolverResult, snapshot, error} = evaluate();

    return [resolverResult, undefined, error, snapshot, undefined, undefined];
  }
  invalidateDataIDs(updatedDataIDs: DataIDSet): void {}
  ensureClientRecord(id: string, typeName: string): DataID {
    invariant(
      false,
      'Client Edges to Client Objects are not supported in this version of Relay Store',
    );
  }
  notifyUpdatedSubscribers(updatedDataIDs: DataIDSet): void {}
}

module.exports = {
  NoopResolverCache,
};
