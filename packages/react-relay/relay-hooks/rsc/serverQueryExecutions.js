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
  RequestDescriptor,
} from 'relay-runtime';

/**
 * One execution of a `@server` query. Its operation's request descriptor owns
 * every fragment reference in the query's data, so server fragment reads use
 * it to wait for the request's later payloads, and to fail rather than hang
 * once the request has ended.
 */
export type ServerQueryExecution = {
  readonly environment: IEnvironment,
  readonly operation: OperationDescriptor,
  // Resolves when the request completes, fails or is cancelled.
  readonly settled: Promise<void>,
  error: ?Error,
  // Prepares data read from the query for server components: client
  // fragment references carry their root's data (see RelayServerHandoff).
  readonly handOff: (data: unknown) => unknown,
};

const executionsByOwner: WeakMap<RequestDescriptor, ServerQueryExecution> =
  new WeakMap();

function registerServerQueryExecution(execution: ServerQueryExecution): void {
  executionsByOwner.set(execution.operation.request, execution);
}

function getServerQueryExecution(
  owner: RequestDescriptor,
): ?ServerQueryExecution {
  return executionsByOwner.get(owner);
}

module.exports = {getServerQueryExecution, registerServerQueryExecution};
