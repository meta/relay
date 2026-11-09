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
  DataID,
  IEnvironment,
  OperationDescriptor,
  ServerQuery,
  Variables,
} from 'relay-runtime';
import type {RecordSource} from 'relay-runtime/store/RelayStoreTypes';
import type {
  NormalizationLinkedField,
  NormalizationSelection,
} from 'relay-runtime/util/NormalizationNode';

const RelayServerHandoff = require('./RelayServerHandoff');
const {registerServerQueryExecution} = require('./serverQueryExecutions');
const invariant = require('invariant');
const {
  __internal: {fetchQueryDeduped, getLocalVariables},
  Observable,
  Record: RelayModernRecord,
  RelayFeatureFlags,
  createOperationDescriptor,
  getRequest,
  getStorageKey,
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

type FieldMatch = {
  readonly field: NormalizationLinkedField,
  readonly variables: Variables,
  // The label of the `@stream` the field is under, if any.
  readonly label: ?string,
};

// The linked fields with a response key among selections, through inline
// fragments, conditions, `@defer`, `@stream` and fragment spreads.
function collectFields(
  selections: ReadonlyArray<NormalizationSelection>,
  variables: Variables,
  responseKey: string,
  label: ?string,
  matches: Array<FieldMatch>,
): void {
  selections.forEach(selection => {
    switch (selection.kind) {
      case 'LinkedField':
        if ((selection.alias ?? selection.name) === responseKey) {
          matches.push({field: selection, label, variables});
        }
        break;
      case 'Stream':
        collectFields(
          selection.selections,
          variables,
          responseKey,
          selection.label,
          matches,
        );
        break;
      case 'Condition':
        if (
          Boolean(variables[selection.condition]) === selection.passingValue
        ) {
          collectFields(
            selection.selections,
            variables,
            responseKey,
            label,
            matches,
          );
        }
        break;
      case 'ClientExtension':
      case 'Defer':
      case 'InlineFragment':
        collectFields(
          selection.selections,
          variables,
          responseKey,
          label,
          matches,
        );
        break;
      case 'FragmentSpread':
        collectFields(
          selection.fragment.selections,
          getLocalVariables(
            variables,
            selection.fragment.argumentDefinitions,
            selection.args,
          ),
          responseKey,
          label,
          matches,
        );
        break;
      case 'ActorChange':
        collectFields(
          [selection.linkedField],
          variables,
          responseKey,
          label,
          matches,
        );
        break;
      default:
        break;
    }
  });
}

/**
 * The list an `@stream` item was appended to: the record and storage key at
 * the parent of the item's path, found by following the path through the
 * operation's normalization and the Store. Null if the path does not end at
 * a list under the `@stream` with that label, or cannot be followed
 * unambiguously.
 */
function getStreamTarget(
  operation: OperationDescriptor,
  source: RecordSource,
  path: ReadonlyArray<string | number>,
  label: string,
): ?string {
  let selections = operation.request.node.operation.selections;
  let variables = operation.request.variables;
  let dataID = operation.root.dataID;
  let ii = 0;
  while (ii < path.length - 1) {
    const key = path[ii];
    const record = source.get(dataID);
    if (typeof key !== 'string' || record == null) {
      return null;
    }
    const matches: Array<FieldMatch> = [];
    collectFields(selections, variables, key, null, matches);
    const storageKeys = new Set(
      matches.map(match => getStorageKey(match.field, match.variables)),
    );
    if (matches.length === 0 || storageKeys.size !== 1) {
      return null;
    }
    const {field} = matches[0];
    const storageKey = getStorageKey(field, matches[0].variables);
    if (ii === path.length - 2) {
      // The last key is the item's index: the field is the stream's list.
      return field.plural && matches.every(match => match.label === label)
        ? `${dataID}\n${storageKey}`
        : null;
    }
    let next: ?DataID;
    if (field.plural) {
      const index = path[ii + 1];
      next =
        typeof index === 'number'
          ? RelayModernRecord.getLinkedRecordIDs(record, storageKey)?.[index]
          : null;
      ii += 2;
    } else {
      next = RelayModernRecord.getLinkedRecordID(record, storageKey);
      ii += 1;
    }
    if (next == null) {
      return null;
    }
    dataID = next;
    selections = field.selections;
    variables = matches[0].variables;
  }
  return null;
}

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

// A failed GraphQL request rejects with the GraphQL errors' messages, not
// with Relay's wrapper or the request's other details.
function toServerQueryError(error: Error): Error {
  const source: unknown = Object.getOwnPropertyDescriptor(
    error,
    'source',
  )?.value;
  const errors =
    source != null && typeof source === 'object' ? source.errors : null;
  const messages: Array<string> = [];
  if (Array.isArray(errors)) {
    errors.forEach(item => {
      const message =
        item != null && typeof item === 'object' ? item.message : null;
      if (typeof message === 'string') {
        messages.push(message);
      }
    });
  }
  return messages.length > 0 ? new Error(messages.join('\n')) : error;
}

function execute(
  environment: IEnvironment,
  operation: OperationDescriptor,
  signal: ?ServerQuerySignal,
): Promise<unknown> {
  let settle: () => void = () => {};
  let resolveFirst: () => void = () => {};
  let rejectFirst: (error: Error) => void = () => {};
  const first = new Promise<void>((resolve, reject) => {
    resolveFirst = resolve;
    rejectFirst = reject;
  });
  let subscription = null;
  let receivedPayload = false;
  let detach = () => {};
  // Any failure ends everything: the request, the handoffs, pending reads.
  const fail = (error: Error) => {
    if (execution.done) {
      return;
    }
    execution.done = true;
    execution.error = error;
    detach();
    subscription?.unsubscribe();
    handoff.fail(error);
    rejectFirst(error);
    settle();
  };
  const handoff = new RelayServerHandoff(environment, operation, fail);
  const execution: ServerQueryExecution = {
    done: false,
    environment,
    error: null,
    handOff: data => {
      try {
        return handoff.handOff(data);
      } catch (error: unknown) {
        fail(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    operation,
    settled: new Promise(resolve => {
      settle = resolve;
    }),
  };
  registerServerQueryExecution(execution);
  // The server Environment is request scoped: keep the data for the
  // request's server fragment reads.
  environment.retain(operation);

  const cancelled = () =>
    fail(new Error('serverQuery: The request was cancelled.'));
  if (signal?.aborted === true) {
    cancelled();
  } else {
    signal?.addEventListener('abort', cancelled, {once: true});
    detach = () => signal?.removeEventListener?.('abort', cancelled);
    // Through `fetchQueryDeduped`, so that fragment reads see the request as
    // active while its `@defer` payloads are on their way, and calls with the
    // same variables share it; each call's signal cancels only its own.
    // The request ends at EOF, or at a payload marked final.
    const complete = () => {
      if (execution.done) {
        return;
      }
      if (!receivedPayload && !handoff.isAvailable()) {
        fail(
          new Error(
            `serverQuery: \`${operation.request.node.params.name}\` completed without data.`,
          ),
        );
        return;
      }
      handoff.complete();
      if (!execution.done) {
        execution.done = true;
        detach();
        resolveFirst();
        settle();
      }
    };
    const subscribed = fetchQueryDeduped(
      environment,
      operation.request.identifier,
      // A query that already executed in this request reads the Store.
      () =>
        handoff.isAvailable()
          ? Observable.create(sink => sink.complete())
          : environment.execute({operation}),
    ).subscribe({
      complete,
      error: error => fail(toServerQueryError(error)),
      next: response => {
        if (execution.done) {
          return;
        }
        const responses = Array.isArray(response) ? response : [response];
        // An extensions-only payload or an empty batch delivers no data.
        if (responses.some(item => item.data != null)) {
          receivedPayload = true;
        }
        // A payload of `@stream` items appends to the lists they target;
        // everything else it touched is compared in full.
        const source = environment.getStore().getSource();
        const targets: Set<string> = new Set();
        const streamItems = responses.every(item => {
          const {label, path} = item;
          const target =
            label != null && Array.isArray(path)
              ? getStreamTarget(operation, source, path, label)
              : null;
          if (target != null) {
            targets.add(target);
          }
          return target != null;
        });
        handoff.sync(streamItems ? targets : null);
        if (receivedPayload) {
          resolveFirst();
        }
        if (responses.some(item => item.extensions?.is_final === true)) {
          complete();
        }
      },
    });
    subscription = subscribed;
    // A failure (e.g. an abort) during the synchronous subscribe could not
    // unsubscribe yet.
    if (execution.done && execution.error != null) {
      subscribed.unsubscribe();
    }
  }
  return first.then(() =>
    execution.handOff(environment.lookup(operation.fragment).data),
  );
}

module.exports = serverQuery;
