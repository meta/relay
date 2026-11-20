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
  const {execution, first} = startServerExecution(
    environment,
    operation,
    signal,
  );
  return first.then(() =>
    execution.handOff(environment.lookup(operation.fragment).data),
  );
}

module.exports = serverQuery;
