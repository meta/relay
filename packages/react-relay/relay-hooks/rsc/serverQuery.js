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
  IEnvironment,
  OperationDescriptor,
  ServerQuery,
  Variables,
} from 'relay-runtime';

const RelayServerHandoff = require('./RelayServerHandoff');
const {registerServerQueryExecution} = require('./serverQueryExecutions');
const invariant = require('invariant');
const {
  __internal: {fetchQueryDeduped},
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

// A request's server Environment executes each query with given variables
// once; later calls share the result.
const resultsByEnvironment: WeakMap<
  IEnvironment,
  Map<string, Promise<unknown>>,
> = new WeakMap();

declare function serverQuery<TVariables extends Variables, TData>(
  environment: IEnvironment,
  query: ServerQuery<TVariables, TData>,
  variables: TVariables,
  options?: ServerQueryOptions,
): Promise<TData>;

/**
 * Executes a `@server` query in a request-scoped server Environment and
 * resolves with its data once the first payload has arrived. `@defer`
 * payloads keep arriving afterwards; server fragment reads wait for the data
 * they need. Client fragment references in the data carry their root's
 * records, so passing one to a client component is all a server component
 * does to hand it off.
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
  const operation = createOperationDescriptor(request, variables);
  let results = resultsByEnvironment.get(environment);
  if (results == null) {
    results = new Map();
    resultsByEnvironment.set(environment, results);
  }
  const identifier = operation.request.identifier;
  let result = results.get(identifier);
  if (result == null) {
    result = execute(environment, operation, options?.signal);
    results.set(identifier, result);
  }
  return result;
}

function execute(
  environment: IEnvironment,
  operation: OperationDescriptor,
  signal: ?ServerQuerySignal,
): Promise<unknown> {
  let settle: () => void = () => {};
  const handoff = new RelayServerHandoff(environment, operation);
  const execution: ServerQueryExecution = {
    environment,
    error: null,
    handOff: data => handoff.handOff(data),
    operation,
    settled: new Promise(resolve => {
      settle = resolve;
    }),
  };
  registerServerQueryExecution(execution);
  // The server Environment is request scoped: keep the data for the
  // request's server fragment reads.
  environment.retain(operation);

  return new Promise<void>((resolve, reject) => {
    let detach = () => {};
    const fail = (error: Error) => {
      detach();
      execution.error ??= error;
      handoff.fail(error);
      reject(error);
      settle();
    };
    // Through `fetchQueryDeduped`, so that fragment reads see the request as
    // active while its `@defer` payloads are on their way.
    const subscription = fetchQueryDeduped(
      environment,
      operation.request.identifier,
      () => environment.execute({operation}),
    ).subscribe({
      complete: () => {
        detach();
        handoff.complete();
        resolve();
        settle();
      },
      error: fail,
      next: () => {
        handoff.sync();
        resolve();
      },
    });
    if (signal != null) {
      const cancel = () => {
        subscription.unsubscribe();
        fail(new Error('serverQuery: The request was cancelled.'));
      };
      if (signal.aborted) {
        cancel();
      } else if (!subscription.closed) {
        signal.addEventListener('abort', cancel, {once: true});
        detach = () => signal.removeEventListener?.('abort', cancel);
      }
    }
  }).then(() => handoff.handOff(environment.lookup(operation.fragment).data));
}

module.exports = serverQuery;
