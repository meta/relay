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
  RelayHandoff,
  RelayHandoffChunk,
  RelayHandoffRecords,
} from './RelayHandoff';
import type {
  DataID,
  Disposable,
  IEnvironment,
  NormalizationSplitOperation,
  OperationDescriptor,
  Variables,
} from 'relay-runtime';
import type {Record} from 'relay-runtime/store/RelayStoreTypes';
import type {NormalizationSelectableNode} from 'relay-runtime/util/NormalizationNode';

const {getHandoffOperation} = require('./RelayHandoff');
const invariant = require('invariant');
const {
  __internal: {generateTypeID, isTypeID, markReferences},
  FRAGMENT_OWNER_KEY,
  FRAGMENTS_KEY,
  Record: RelayModernRecord,
  RecordSource,
  Store,
  stableCopy,
} = require('relay-runtime');

type ClientFragment = {
  readonly normalization: NormalizationSplitOperation,
  readonly rootVariables: ReadonlyArray<string>,
};

type Visit = {
  readonly node: NormalizationSelectableNode,
  readonly variables: Variables,
};

type Root = {
  handoff: ?RelayHandoff,
  readonly dataID: DataID,
  readonly node: NormalizationSplitOperation,
  readonly variables: Variables,
  // The selections each record was traversed with, so that a payload re-copies
  // only the records it updated.
  readonly visits: Map<DataID, Map<string, Visit>>,
  // The field values the client has, per record.
  readonly sent: Map<DataID, {[key: string]: unknown}>,
  // The ID the client has for each connection edge created again with the
  // same data, and the edges each connection had when last copied (see
  // `_project`).
  readonly aliases: Map<DataID, DataID>,
  readonly connectionEdges: Map<DataID, ReadonlyArray<unknown>>,
  settleNext: ?(result: ?RelayHandoffChunk | Error) => void,
};

// The order of the writes the handoffs of a request carry: its server queries
// share one Environment, and so one Store. Each copy of a root's records takes
// the next `sequence`.
type WriteOrder = {
  readonly id: string,
  sequence: number,
};

const writeOrders: WeakMap<IEnvironment, WriteOrder> = new WeakMap();

let nextSessionID = 0;
const sessionPrefix = Math.random().toString(36).slice(2);

let nextWriteOrderID = 0;
function getWriteOrder(environment: IEnvironment): WriteOrder {
  let writeOrder = writeOrders.get(environment);
  if (writeOrder == null) {
    writeOrder = {
      id: `${sessionPrefix}.${nextWriteOrderID++}`,
      sequence: 0,
    };
    writeOrders.set(environment, writeOrder);
  }
  return writeOrder;
}

// ConnectionHandler's counter for the edges it creates.
const CONNECTION_NEXT_EDGE_INDEX = '__connection_next_edge_index';

function pending(root: Root): Promise<?RelayHandoffChunk> {
  const promise = new Promise<?RelayHandoffChunk>((resolve, reject) => {
    root.settleNext = result => {
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    };
  });
  // A client that never reads the rest must not cause an unhandled rejection.
  promise.catch(() => {});
  return promise;
}

const nodeIDs: WeakMap<NormalizationSelectableNode, number> = new WeakMap();
let nextNodeID = 0;
function visitKey(node: NormalizationSelectableNode, variables: Variables) {
  let id = nodeIDs.get(node);
  if (id == null) {
    id = nextNodeID++;
    nodeIDs.set(node, id);
  }
  return `${id}:${JSON.stringify(variables)}`;
}

function getRefs(value: unknown): ?ReadonlyArray<unknown> {
  return value != null &&
    typeof value === 'object' &&
    Array.isArray(value.__refs)
    ? value.__refs
    : null;
}

// The length of `before` if `after` only appended to it. For the list an
// `@stream` item was appended to, checking the old list's ends is enough, so
// streaming a list costs time proportional to what each payload adds; any
// other list is compared entry by entry.
function appendedFrom(
  before: ?ReadonlyArray<unknown>,
  after: ?ReadonlyArray<unknown>,
  streamTarget: boolean,
): ?number {
  if (before == null || after == null || after.length < before.length) {
    return null;
  }
  const last = before.length - 1;
  if (streamTarget) {
    RelayServerHandoff.compareCount += 2;
    if (last >= 0 && (after[0] !== before[0] || after[last] !== before[last])) {
      return null;
    }
    return before.length;
  }
  for (let ii = 0; ii <= last; ii++) {
    RelayServerHandoff.compareCount++;
    if (before[ii] !== after[ii]) {
      return null;
    }
  }
  return before.length;
}

// Whether two copies of a record have the same fields, whatever their IDs.
function isSameRecord(
  a: ?{readonly [key: string]: unknown},
  b: ?{readonly [key: string]: unknown},
): boolean {
  if (a == null || b == null) {
    return false;
  }
  const keys = (record: {readonly [key: string]: unknown}) =>
    Object.keys(record).filter(
      key => key !== '__id' && record[key] !== undefined,
    );
  const aKeys = keys(a);
  return (
    aKeys.length === keys(b).length &&
    aKeys.every(key => isSameValue(a[key], b[key]))
  );
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  const refs = getRefs(a);
  const nextRefs = getRefs(b);
  if (refs != null || nextRefs != null) {
    return (
      refs != null &&
      nextRefs != null &&
      refs.length === nextRefs.length &&
      refs.every((id, index) => id === nextRefs[index])
    );
  }
  return (
    a != null &&
    b != null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    JSON.stringify(a, sortKeys) === JSON.stringify(b, sortKeys)
  );
}

// A `JSON.stringify` replacer that ignores the key order of plain objects.
// Other values serialize as they otherwise would (a `Date` by its `toJSON`).
function sortKeys(key: string, value: unknown): unknown {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const sorted: {[key: string]: unknown} = {};
  Object.keys(value)
    .sort()
    .forEach(name => {
      sorted[name] = value[name];
    });
  return sorted;
}

/**
 * Hands the data of one server query execution to client components. Each
 * client fragment reference in data a server component receives (from
 * `serverQuery` or a server fragment read) gets a `__handoff` with its
 * root's records; server fragment references keep their owner and
 * `__fragments` as non-enumerable properties, so serializing them sends
 * nothing about the server query.
 */
class RelayServerHandoff {
  // How many records projections have traversed, and how many list entries
  // they compared (for tests and diagnostics).
  static visitCount: number = 0;
  static compareCount: number = 0;

  _environment: IEnvironment;
  _operation: OperationDescriptor;
  _clientFragments: Map<string, ClientFragment>;
  _roots: Map<string, Root> = new Map();
  _copies: WeakMap<{...}, unknown> = new WeakMap();
  _updated: Set<DataID> = new Set();
  _observer: ?Disposable = null;
  _sessionID: string;
  _writeOrder: WriteOrder;
  _onError: (error: Error) => void;
  _done: boolean = false;
  _error: ?Error = null;

  constructor(
    environment: IEnvironment,
    operation: OperationDescriptor,
    onError: (error: Error) => void,
  ) {
    this._environment = environment;
    this._onError = onError;
    this._operation = operation;
    this._sessionID = `${sessionPrefix}${nextSessionID++}`;
    this._writeOrder = getWriteOrder(environment);
    this._clientFragments = new Map();
    (operation.request.node.serverHandoff?.clientFragments ?? []).forEach(
      entry => {
        this._clientFragments.set(entry.fragment.name, {
          normalization: entry.normalization,
          rootVariables: entry.rootVariables ?? [],
        });
      },
    );
    const store = environment.getStore();
    // Without the Store's updated record IDs, each payload re-copies every
    // root instead of what it touched.
    if (store instanceof Store) {
      this._observer = store.observeUpdatedRecordIDs(updatedRecordIDs => {
        updatedRecordIDs.forEach(id => this._updated.add(id));
      });
    }
  }

  // Copies the arrays and plain objects (the Reader's data) that hold
  // fragment references; anything else, such as a Relay Resolver's value, is
  // returned as it is.
  handOff(value: unknown): unknown {
    if (value == null || typeof value !== 'object') {
      return value;
    }
    const cached = this._copies.get(value);
    if (cached != null) {
      return cached;
    }
    let result: unknown = value;
    if (Array.isArray(value)) {
      const items: ReadonlyArray<unknown> = value;
      const copy = items.map(item => this.handOff(item));
      if (copy.some((item, index) => item !== items[index])) {
        result = copy;
      }
    } else if (value.constructor === Object) {
      result = this._handOffObject(value);
    }
    this._copies.set(value, result);
    return result;
  }

  _handOffObject(value: {readonly [key: string]: unknown}): {...} {
    const fragments = value[FRAGMENTS_KEY];
    let changed = fragments != null;
    const copy: {[key: string]: unknown} = {};
    Object.keys(value).forEach(key => {
      if (key !== FRAGMENTS_KEY && key !== FRAGMENT_OWNER_KEY) {
        copy[key] = this.handOff(value[key]);
        changed = changed || copy[key] !== value[key];
      }
    });
    if (!changed) {
      return value;
    }
    const owner = value[FRAGMENT_OWNER_KEY];
    if (fragments != null && typeof fragments === 'object') {
      const names = Object.keys(fragments);
      const name = names.length === 1 ? names[0] : null;
      const id = value.__id;
      if (
        owner === this._operation.request &&
        name != null &&
        typeof id === 'string' &&
        this._clientFragments.has(name)
      ) {
        // A client reference is a plain object (React Flight passes only
        // plain objects to client components) with no owner: the client
        // reads it as owned by its root's request.
        copy[FRAGMENTS_KEY] = fragments;
        copy.__handoff = this._handoffFor(id, name, fragments[name]);
      } else {
        Object.defineProperty(copy, FRAGMENTS_KEY, {value: fragments});
        Object.defineProperty(copy, FRAGMENT_OWNER_KEY, {value: owner});
      }
    }
    return copy;
  }

  // Projects the roots again after a payload was published. `streamTargets`:
  // the lists (`<dataID>\n<storageKey>`) the payload's `@stream` items were
  // appended to, if it consisted of such items.
  sync(streamTargets: ?ReadonlySet<string> = null): void {
    const updated = this._observer != null ? this._updated : null;
    this._updated = new Set();
    try {
      this._roots.forEach(root => {
        const records = this._project(root, updated, streamTargets);
        const sequence = ++this._writeOrder.sequence;
        if (records != null) {
          const settle = root.settleNext;
          const next = pending(root);
          settle?.({next, records, sequence});
        }
      });
    } catch (error) {
      this.fail(error, true);
      this._onError(error);
    }
  }

  complete(): void {
    if (this._done) {
      return;
    }
    this.sync();
    if (!this._done) {
      this._finish(null);
    }
  }

  // A failed request (e.g. one `@defer` payload failed) fails only the roots
  // whose data it did not deliver: the others end normally. `everyRoot`
  // fails them all, when what was delivered may not have been handed off.
  fail(error: Error, everyRoot: boolean = false): void {
    if (this._done) {
      return;
    }
    this._finish(
      __DEV__ ? error : new Error('Relay: The server query failed.'),
      everyRoot,
    );
  }

  _finish(error: ?Error, everyRoot: boolean = false): void {
    this._done = true;
    this._error = error;
    this._observer?.dispose();
    this._observer = null;
    this._roots.forEach(root => {
      const handoff = root.handoff;
      const missing =
        handoff == null || everyRoot ? error : this._checkComplete(handoff);
      root.settleNext?.(missing != null ? (error ?? missing) : null);
      root.settleNext = null;
    });
  }

  // A request that completed without a root's data (e.g. a `@defer` payload
  // that never came) will not deliver it: fail the root rather than leave
  // its readers waiting. Checked here, where the operation loader has every
  // `@module` normalization the root selects.
  // Whether the Store has all of the operation's data.
  isAvailable(): boolean {
    return this._environment.check(this._operation).status === 'available';
  }

  _checkComplete(handoff: {
    readonly id: string,
    readonly dataID: DataID,
    readonly fragment: NormalizationSplitOperation,
    readonly variables: Variables,
    ...
  }): ?Error {
    let status;
    try {
      status = this._environment.check(getHandoffOperation(handoff)).status;
    } catch (error: unknown) {
      // A root whose data cannot be checked fails rather than counting as
      // complete.
      return error instanceof Error ? error : new Error(String(error));
    }
    return status === 'available'
      ? null
      : new Error(
          `Relay: The server query completed without the data of \`${handoff.fragment.name}\`.`,
        );
  }

  _handoffFor(dataID: DataID, name: string, args: unknown): RelayHandoff {
    const clientFragment = this._clientFragments.get(name);
    if (clientFragment == null) {
      throw new Error(`Relay: Unknown client fragment \`${name}\`.`);
    }
    const {normalization} = clientFragment;
    const variables: {[key: string]: unknown} = {};
    // The normalization operation's arguments are the fragment's arguments;
    // `@no_inline` operations prefix them with the fragment name.
    const prefix = `${name}$`;
    (normalization.argumentDefinitions ?? []).forEach(definition => {
      const argName = definition.name.startsWith(prefix)
        ? definition.name.slice(prefix.length)
        : definition.name;
      variables[definition.name] =
        args != null && typeof args === 'object' && Object.hasOwn(args, argName)
          ? args[argName]
          : definition.kind === 'LocalArgument'
            ? definition.defaultValue
            : undefined;
    });
    const operationVariables = this._operation.request.variables;
    clientFragment.rootVariables.forEach(variable => {
      variables[variable] = operationVariables[variable];
    });
    const key = `${dataID}\n${name}\n${JSON.stringify(stableCopy(variables))}`;
    let root = this._roots.get(key);
    if (root == null) {
      root = this._createRoot(dataID, normalization, variables);
      this._roots.set(key, root);
    }
    const handoff = root.handoff;
    invariant(handoff != null, 'RelayServerHandoff: Expected a handoff.');
    return handoff;
  }

  _createRoot(
    dataID: DataID,
    node: NormalizationSplitOperation,
    variables: Variables,
  ): Root {
    const root: Root = {
      aliases: new Map(),
      connectionEdges: new Map(),
      dataID,
      handoff: null,
      node,
      sent: new Map(),
      settleNext: null,
      variables,
      visits: new Map(),
    };
    const records = this._project(root, null) ?? {};
    const sequence = ++this._writeOrder.sequence;
    const id = this._sessionID + ':' + String(this._roots.size);
    // A root created after the request ended (e.g. by data read once it
    // completed) gets the same verdict as the roots that existed then.
    const missing = this._done
      ? this._checkComplete({dataID, fragment: node, id, variables})
      : null;
    const error = missing != null ? (this._error ?? missing) : null;
    let next: Promise<?RelayHandoffChunk>;
    if (error != null) {
      next = Promise.reject(error);
      next.catch(() => {});
    } else if (this._done) {
      next = Promise.resolve(null);
    } else {
      next = pending(root);
    }
    root.handoff = {
      dataID,
      fragment: node,
      id,
      next,
      records,
      sequence,
      serverStore: this._writeOrder.id,
      variables,
    };
    return root;
  }

  _project(
    root: Root,
    updated: ?Set<DataID>,
    streamTargets: ?ReadonlySet<string> = null,
  ): ?RelayHandoffRecords {
    const source = this._environment.getStore().getSource();
    const target = RecordSource.create();
    const traversed: Set<string> = new Set();
    // Lists the client already has that only grew: traverse and send only
    // their new items.
    const appended: Map<string, number> = new Map();
    const firstPluralLinkIndex = (
      record: Record,
      storageKey: string,
      linkedIDs: ReadonlyArray<?DataID>,
    ) => {
      const dataID = RelayModernRecord.getDataID(record);
      const from = appendedFrom(
        getRefs(root.sent.get(dataID)?.[storageKey]),
        linkedIDs,
        streamTargets?.has(`${dataID}\n${storageKey}`) === true,
      );
      if (from == null) {
        return 0;
      }
      appended.set(`${dataID}\n${storageKey}`, from);
      return updated == null ? 0 : from;
    };
    const shouldTraverse = (
      node: NormalizationSelectableNode,
      dataID: DataID,
      variables: Variables,
    ) => {
      RelayServerHandoff.visitCount++;
      const key = visitKey(node, variables);
      const passKey = `${dataID}\n${key}`;
      if (traversed.has(passKey)) {
        return false;
      }
      traversed.add(passKey);
      let visits = root.visits.get(dataID);
      if (visits == null) {
        visits = new Map();
        root.visits.set(dataID, visits);
      }
      if (!visits.has(key)) {
        visits.set(key, {node, variables});
        return true;
      }
      return updated == null || updated.has(dataID);
    };
    const copy = (
      node: NormalizationSelectableNode,
      dataID: DataID,
      variables: Variables,
    ) =>
      markReferences(
        source,
        {dataID, node, variables},
        new Set(),
        null,
        false,
        {
          firstPluralLinkIndex,
          shouldTraverse,
          target,
        },
      );
    if (updated == null) {
      copy(root.node, root.dataID, root.variables);
    } else {
      // Refinements read whether a record's type implements an interface from
      // the type's record: when that changes, records of the type are copied
      // again.
      if (Array.from(updated).some(isTypeID)) {
        root.visits.forEach((_visits, dataID) => {
          const record = source.get(dataID);
          if (
            record != null &&
            updated.has(generateTypeID(RelayModernRecord.getType(record)))
          ) {
            updated.add(dataID);
          }
        });
      }
      updated.forEach(dataID => {
        root.visits
          .get(dataID)
          ?.forEach(visit => copy(visit.node, dataID, visit.variables));
      });
    }

    const records: {[dataID: DataID]: {readonly [key: string]: unknown}} = {};
    let changed = false;
    const copied = {...target.toJSON()};
    // ConnectionHandler creates all of a connection's edges again whenever a
    // payload updates the connection (e.g. each `@stream` item or `@defer`
    // payload). An edge with the same data as the one the client has at the
    // same index keeps that one's ID, so the client gets only new edges.
    Object.keys(copied).forEach(dataID => {
      const record = copied[dataID];
      const sentRecord = root.sent.get(dataID);
      const edges = getRefs(record?.edges);
      if (
        record == null ||
        edges == null ||
        (record[CONNECTION_NEXT_EDGE_INDEX] ??
          sentRecord?.[CONNECTION_NEXT_EDGE_INDEX]) === undefined
      ) {
        return;
      }
      // Edges the connection no longer has are never copied again.
      const current = new Set(edges);
      root.connectionEdges.get(dataID)?.forEach(id => {
        if (typeof id === 'string' && !current.has(id)) {
          root.aliases.delete(id);
          root.visits.delete(id);
        }
      });
      root.connectionEdges.set(dataID, edges);
      const sentEdges = getRefs(sentRecord?.edges);
      if (sentEdges == null) {
        return;
      }
      const ids = edges.map((id, index) => {
        const sentID = sentEdges[index];
        if (
          typeof id === 'string' &&
          typeof sentID === 'string' &&
          isSameRecord(copied[id], root.sent.get(sentID))
        ) {
          root.aliases.set(id, sentID);
        }
        return typeof id === 'string' ? (root.aliases.get(id) ?? id) : id;
      });
      copied[dataID] = {...record, edges: {__refs: ids}};
      const from = appendedFrom(sentEdges, ids, false);
      if (from != null) {
        appended.set(`${dataID}\nedges`, from);
      }
    });
    const copiedIDs = Object.keys(copied);
    for (let ii = 0; ii < copiedIDs.length; ii++) {
      const copiedRecord = copied[copiedIDs[ii]];
      if (copiedRecord == null) {
        continue;
      }
      const dataID = root.aliases.get(copiedIDs[ii]) ?? copiedIDs[ii];
      // The record's key carries its ID.
      const {__id: _id, ...record} = copiedRecord;
      const sent = root.sent.get(dataID);
      if (sent == null) {
        root.sent.set(dataID, {...record});
        records[dataID] = record;
        changed = true;
        continue;
      }
      const delta: {[key: string]: unknown} = {
        __typename: record.__typename,
      };
      // A field's value and its error are sent together, so that the client's
      // record update sets or clears the error with the value.
      const errors: {readonly [key: string]: unknown} = record.__errors ?? {};
      const sentErrorsValue = sent.__errors;
      const sentErrors: {readonly [key: string]: unknown} =
        sentErrorsValue != null && typeof sentErrorsValue === 'object'
          ? sentErrorsValue
          : {};
      const deltaErrors: {[key: string]: unknown} = {};
      let hasDelta = false;
      const keys = Object.keys(record);
      for (let jj = 0; jj < keys.length; jj++) {
        const key = keys[jj];
        if (key === '__errors') {
          continue;
        }
        const value = record[key];
        const valueChanged = !isSameValue(sent[key], value);
        if (!valueChanged && isSameValue(sentErrors[key], errors[key])) {
          continue;
        }
        const from = appended.get(`${dataID}\n${key}`);
        const refs = getRefs(value);
        delta[key] =
          valueChanged && from != null && refs != null
            ? {__refsAppend: refs.slice(from), __refsAppendFrom: from}
            : value;
        if (errors[key] != null) {
          deltaErrors[key] = errors[key];
        }
        sent[key] = value;
        hasDelta = true;
      }
      if (Object.keys(deltaErrors).length > 0) {
        delta.__errors = deltaErrors;
      }
      sent.__errors = record.__errors;
      if (hasDelta) {
        records[dataID] = delta;
        changed = true;
      }
    }
    return changed ? records : null;
  }
}

module.exports = RelayServerHandoff;
