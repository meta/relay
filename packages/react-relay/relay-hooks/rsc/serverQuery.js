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
  IEnvironment,
  OperationDescriptor,
  ServerQuery,
  Variables,
} from 'relay-runtime';

const {startServerExecution} = require('./RelayServerExecution');
const invariant = require('invariant');
const {
  RelayFeatureFlags,
  createOperationDescriptor,
  getRequest,
} = require('relay-runtime');

// The parts of an `AbortSignal` that `serverQuery` uses.
export type ServerQuerySignal = {
  readonly aborted: boolean,
  addEventListener(
    type: 'abort',
    listener: () => void,
    options: {once: boolean},
  ): void,
  readonly removeEventListener?: (type: 'abort', listener: () => void) => void,
  ...
};

export type ServerQueryOptions = {
  // Cancels the request, e.g. when the server response is aborted.
  readonly signal?: ServerQuerySignal,
};

declare function serverQuery<TVariables extends Variables, TData>(
  environment: IEnvironment,
  query: ServerQuery<TVariables, TData>,
  variables: TVariables,
  options?: ServerQueryOptions,
): Promise<TData>;

/**
 * Executes a `@server` query in a request-scoped server Environment and
 * resolves with its data once the Store has the data the query reads itself,
 * as `useLazyLoadQuery` does with `renderPolicy: 'partial'`: a query that only
 * spreads fragments, or whose fields another query of the request wrote,
 * resolves before its response arrives, unless that data was invalidated.
 * Server fragment reads wait for the data they need. Client fragment
 * references in the data carry their root's records, so passing one to a
 * client component is all a server component does to hand it off.
 */
function serverQuery(
  environment: IEnvironment,
  query: ServerQuery<Variables, unknown>,
  variables: Variables,
  options?: ServerQueryOptions,
): Promise<unknown> {
  invariant(
    RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS,
    'serverQuery: Relay RSC requires ' +
      '`RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS` (on by ' +
      'default). Set `RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS ' +
      '= true`, with `RelayFeatureFlags` from `relay-runtime`.',
  );
  const request = getRequest(query);
  invariant(
    request.serverHandoff != null,
    'serverQuery: Expected `%s` to be a `@server` query.',
    request.params.name,
  );
  return execute(
    environment,
    createOperationDescriptor(request, variables),
    options?.signal,
  );
}

function execute(
  environment: IEnvironment,
  operation: OperationDescriptor,
  signal: ?ServerQuerySignal,
): Promise<unknown> {
  // As `QueryResource` does, data invalidated since the query last wrote it is
  // not rendered from: the query waits for its response. Checked with the
  // operation loader that normalizes `@module` data, which the Store may have
  // been created without.
  const store = environment.getStore();
  const stale =
    store.check(operation, {
      operationLoader:
        environment.getOperationLoader?.() ?? store.getOperationLoader(),
    }).status === 'stale';
  const {execution, first} = startServerExecution(
    environment,
    operation,
    signal,
  );
  const read = () =>
    execution.handOff(environment.lookup(operation.fragment).data);
  if (stale) {
    return first.then(read);
  }
  // As in `QueryResource`, a request that fails before its first payload
  // fails the query, if the query has not resolved yet; a later failure fails
  // the fragment reads that wait for the rest.
  let failure: ?Error = null;
  first.catch((error: Error) => {
    failure = error;
  });
  return new Promise<void>(resolve => {
    const snapshot = environment.lookup(operation.fragment);
    if (!snapshot.isMissingData || execution.done) {
      resolve();
      return;
    }
    let subscription = null;
    const done = () => {
      subscription?.dispose();
      resolve();
    };
    subscription = environment.subscribe(snapshot, next => {
      if (!next.isMissingData) {
        done();
      }
    });
    void execution.settled.then(done);
  }).then(() => {
    if (failure != null) {
      throw failure;
    }
    return read();
  });
}

module.exports = serverQuery;
