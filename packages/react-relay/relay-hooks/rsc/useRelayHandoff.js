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

import type {RelayHandoff, RelayHandoffChunk} from './RelayHandoff';
import type {
  DataID,
  Disposable,
  GraphQLResponseWithData,
  IEnvironment,
  OperationDescriptor,
  SingularReaderSelector,
  Snapshot,
} from 'relay-runtime';
import type {Record} from 'relay-runtime/store/RelayStoreTypes';

const {getHandoffOperation, getRelayHandoff} = require('./RelayHandoff');
const {setHandoffHydrationLookup} = require('./RelayHandoffSeam');
const React = require('react');
const {
  startTransition,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} = require('react');
const {
  __internal: {fetchQueryDeduped},
  Environment: RelayModernEnvironment,
  FRAGMENT_OWNER_KEY,
  FRAGMENTS_KEY,
  Network,
  Observable,
  Record: RelayModernRecord,
  RecordSource,
  Store,
} = require('relay-runtime');

// Versions of React without insertion effects have no Activity either, so a
// layout effect's cleanup runs only on unmount.
const useInsertionEffect: typeof useLayoutEffect =
  typeof React.useInsertionEffect === 'function'
    ? React.useInsertionEffect
    : useLayoutEffect;

// ConnectionHandler's counter for the edges it creates.
const CONNECTION_NEXT_EDGE_INDEX = '__connection_next_edge_index';

const subscribeNever = () => () => {};
const notHydrating = () => false;

type HandoffRoot = {
  // Its handoff's `id`.
  readonly id: string,
  readonly operation: OperationDescriptor,
  // The server request whose writes its handoff carries (see
  // `HANDOFF_WRITES_KEY`).
  readonly serverStore: string,
  // The full lists its handoff sent, whether or not the client applied them.
  readonly serverLists: Map<string, ReadonlyArray<unknown>>,
  // What the server rendered its readers with, once a hydrating (or server)
  // render executed it: an Environment with the records its handoff sent,
  // which its readers read while they hydrate (see
  // `createHydrationEnvironment`).
  hydration: ?HydrationRecords,
  // The server's ConnectionHandler connections and edges (see `toPayload`).
  readonly connections: Set<string>,
  readonly edges: Set<string>,
  // Whether its records were published into this Environment before; a
  // later execution (e.g. a remount after GC) only fills missing fields.
  published: boolean,
  // Whether an execution is publishing its records now.
  active: boolean,
  // Retains of readers that unmounted while an execution was publishing: its
  // later chunks extend those records, so they are released when it ends.
  readonly releaseOnEnd: Array<Disposable>,
  // Bumped to execute the root again once its records were collected.
  generation: number,
  // The generation a render last executed.
  executed: number,
  // Whether its handoff completed: the server checked that the root's data
  // was complete (see RelayServerHandoff).
  delivered: boolean,
  // The records its handoff published.
  readonly recordIDs: Set<DataID>,
  // Why its server query failed, if it did; reads of the root throw it.
  error: ?Error,
  // Notifies the Store's subscribers of records published during render
  // (see `executeHandoff`); the reader's layout effect calls it.
  notify: ?() => void,
  readonly refs: WeakMap<{...}, {...}>,
};

// Each record a handoff wrote carries, under this key, the request the
// write came from and, per field, where the newest write the client applied
// is in that request's write order and which root made it. Each root's
// records are the request's server Store when they were copied, and its
// readers render and commit in their own order, so a write older than one
// already applied is never applied: the Store only moves forward (see
// `RelayHandoff`). A hydrating reader reads its own root's records instead
// (see `createHydrationEnvironment`). Kept on the record, it goes when the
// record does.
const HANDOFF_WRITES_KEY = '__handoffWrites';

// Where a field's newest applied write is in the request's write order,
// and the `id` of the root that made it.
type HandoffWrite = {readonly sequence: number, readonly root: string};

type HandoffWrites = {
  readonly request: string,
  readonly fields: {readonly [storageKey: string]: HandoffWrite},
};

function getHandoffWrites(
  record: ?Record,
  request: string,
): ?HandoffWrites['fields'] {
  const writes =
    record != null
      ? RelayModernRecord.getValue(record, HANDOFF_WRITES_KEY)
      : null;
  const fields =
    writes != null && typeof writes === 'object' && writes.request === request
      ? writes.fields
      : null;
  if (fields == null || typeof fields !== 'object') {
    return null;
  }
  const result: {[storageKey: string]: HandoffWrite} = {};
  Object.keys(fields).forEach(key => {
    const entry = fields[key];
    if (
      entry != null &&
      typeof entry === 'object' &&
      typeof entry.sequence === 'number' &&
      typeof entry.root === 'string'
    ) {
      result[key] = {root: entry.root, sequence: entry.sequence};
    }
  });
  return result;
}

// What this module keeps for an Environment: the root of each handoff its
// readers read, the owned copy of each plural reference (see `withOwner`),
// and how many of the server's items each list has, so that each streamed
// item is appended once, even when two roots deliver it (e.g. a later
// request's handoff wrote the whole list before this one's stream ended).
type HandoffState = {
  readonly roots: WeakMap<RelayHandoff, HandoffRoot>,
  readonly ownedLists: WeakMap<ReadonlyArray<unknown>, ReadonlyArray<unknown>>,
  readonly serverLengths: Map<string, number>,
};

// The handoff whose root owns each request, so that a reference to a fragment
// the root's records spread keeps the root's records retained (and published
// again once collected) as the handed-off reference does, in any Environment.
const handoffsByOwner: WeakMap<{...}, RelayHandoff> = new WeakMap();

const states: WeakMap<IEnvironment, HandoffState> = new WeakMap();

function getState(environment: IEnvironment): HandoffState {
  let state = states.get(environment);
  if (state == null) {
    state = {
      ownedLists: new WeakMap(),
      roots: new WeakMap(),
      serverLengths: new Map(),
    };
    states.set(environment, state);
  }
  return state;
}

function getRoot(
  environment: IEnvironment,
  handoff: RelayHandoff,
): HandoffRoot {
  const state = getState(environment);
  let root = state.roots.get(handoff);
  if (root == null) {
    root = {
      active: false,
      connections: new Set(),
      delivered: false,
      edges: new Set(),
      error: null,
      executed: -1,
      generation: 0,
      hydration: null,
      id: handoff.id,
      notify: null,
      operation: getHandoffOperation(handoff),
      published: false,
      recordIDs: new Set(),
      releaseOnEnd: [],
      refs: new WeakMap(),
      serverLists: new Map(),
      serverStore: handoff.serverStore,
    };
    state.roots.set(handoff, root);
    handoffsByOwner.set(root.operation.request, handoff);
  }
  return root;
}

function toPayload(
  environment: IEnvironment,
  root: HandoffRoot,
  records: RelayHandoffChunk['records'],
  // Where the records are in the request's write order.
  sequence: number,
  // On a replay, the records it re-created; others only get missing fields.
  created: ?Set<DataID>,
  // In a hydrating render: the root's own records, which this adds to.
  hydrationRecords: ?{[dataID: DataID]: {[key: string]: unknown}},
): GraphQLResponseWithData {
  const source = environment.getStore().getSource();
  const {serverLengths} = getState(environment);
  // A replay only fills missing fields, which no newer write set.
  const ordering = created == null;
  const data: {[key: string]: {[key: string]: unknown}} = {};
  // ConnectionHandler names the edges it creates after their index, on the
  // server as on the client (`client:<connection>:edges:<n>`). The server's
  // get their own IDs, so they never overwrite edges the client created. It
  // names them again for each streamed edge, so every chunk's are renamed.
  Object.keys(records).forEach(dataID => {
    const record = records[dataID];
    if (record[CONNECTION_NEXT_EDGE_INDEX] !== undefined) {
      root.connections.add(dataID);
    }
    if (root.connections.has(dataID)) {
      readList(record.edges)?.ids.forEach(id => {
        if (typeof id === 'string') {
          root.edges.add(id);
        }
      });
    }
  });
  const rename = (id: unknown): unknown =>
    typeof id === 'string' && root.edges.has(id) ? `${id}:handoff` : id;
  Object.keys(records).forEach(serverID => {
    const record = records[serverID];
    const dataID = String(rename(serverID));
    const existingRecord = source.get(dataID);
    if (created != null && existingRecord == null) {
      created.add(dataID);
    }
    const existing =
      created != null && !created.has(dataID) ? existingRecord : null;
    // The record's key carries its ID.
    const copy: {[key: string]: unknown} = {__id: dataID};
    const hydrationRecord =
      hydrationRecords != null
        ? (hydrationRecords[dataID] ??= {__id: dataID})
        : null;
    const priorWrites = ordering
      ? getHandoffWrites(existingRecord, root.serverStore)
      : null;
    const writes: {[storageKey: string]: HandoffWrite} = {};
    Object.keys(record).forEach(key => {
      if (key === '__id') {
        return;
      }
      let value = record[key];
      const listKey = `${dataID}\n${key}`;
      // The list this root's handoff sent before, and what it sends now.
      const serverList = root.serverLists.get(listKey);
      const list = readList(value);
      const ids = list?.ids.map(rename);
      const from = list?.from;
      if (ids != null && from == null) {
        root.serverLists.set(listKey, ids);
      } else if (ids != null && from != null && serverList != null) {
        root.serverLists.set(listKey, serverList.slice(0, from).concat(ids));
      }
      // A field's error is updated only with the field (see
      // `RelayModernRecord.update`).
      const ordered =
        ordering &&
        key !== '__typename' &&
        key !== '__errors' &&
        key !== HANDOFF_WRITES_KEY;
      const newest = ordered ? (writes[key] ?? priorWrites?.[key]) : null;
      const older = newest != null && newest.sequence > sequence;
      let serverLength = ids?.length;
      if (ids != null && from != null) {
        // The items extend the list this root sent. When another root of the
        // request wrote the list last (or wrote it after this one), the
        // client's list is not that one's continuation: the server's list is
        // the list this root sent plus the items. Otherwise they are appended
        // to the client's current list, which may have diverged (e.g. an item
        // it inserted), not to what the server sent.
        const ownBase =
          serverList != null && serverList.length >= from
            ? serverList.slice(0, from)
            : null;
        if (
          ownBase != null &&
          newest != null &&
          (older || newest.root !== root.id)
        ) {
          value = {__refs: ownBase.concat(ids)};
          serverLength = from + ids.length;
        } else {
          const base =
            (existingRecord != null
              ? RelayModernRecord.getLinkedRecordIDs(existingRecord, key)
              : null) ??
            ownBase ??
            [];
          // Items the list already has from the server are not appended again.
          const applied = Math.max(serverLengths.get(listKey) ?? from, from);
          value = {__refs: base.concat(ids.slice(applied - from))};
          serverLength = Math.max(applied, from + ids.length);
        }
      } else if (ids != null) {
        value = {__refs: ids};
      }
      // The client's counter may be ahead of the server's (edges the client
      // added); never move it back.
      if (
        key === CONNECTION_NEXT_EDGE_INDEX &&
        typeof value === 'number' &&
        existingRecord != null
      ) {
        const current = RelayModernRecord.getValue(existingRecord, key);
        if (typeof current === 'number' && current > value) {
          value = current;
        }
      }
      if (hydrationRecord != null) {
        hydrationRecord[key] = value;
      }
      if (
        !older &&
        (existing == null ||
          key === '__typename' ||
          !RelayModernRecord.hasValue(existing, key))
      ) {
        copy[key] = value;
        if (ordered) {
          writes[key] = {root: root.id, sequence};
        }
        if (serverLength != null) {
          serverLengths.set(listKey, serverLength);
        } else if (value === null) {
          // The list was replaced by null: it has none of the server's items.
          serverLengths.delete(listKey);
        }
      }
    });
    if (Object.keys(writes).length > 0) {
      copy[HANDOFF_WRITES_KEY] = {
        fields: {...priorWrites, ...writes},
        request: root.serverStore,
      };
    }
    data[dataID] = copy;
    root.recordIDs.add(dataID);
  });
  return {data, extensions: {is_normalized: true}};
}

// Publishes a handoff's records, then each later chunk, through the
// Environment's normalized-payload path.
function executeHandoff(
  environment: IEnvironment,
  handoff: RelayHandoff,
  root: HandoffRoot,
  inRender: boolean,
  hydrating: boolean,
) {
  return fetchQueryDeduped(environment, root.operation.request.identifier, () =>
    environment.executeWithSource({
      operation: root.operation,
      source: Observable.create(sink => {
        let active = true;
        // Executing a root again (e.g. after its records were collected)
        // replays old data, so it must not overwrite newer fields.
        const created = root.published ? new Set<DataID>() : null;
        root.published = true;
        root.active = true;
        // Notifying subscribers during render would update other components
        // while this one renders, so what is published before the
        // subscription returns notifies later.
        // (Environments without `publishWithDeferredNotify`, e.g. an actor's
        // in a MultiActorEnvironment, publish synchronously.)
        let deferNotify =
          inRender &&
          // $FlowFixMe[prop-missing] Only RelayModernEnvironment has it.
          typeof environment.publishWithDeferredNotify === 'function'
            ? (environment as $FlowFixMe)
            : null;
        // A hydrating render shows what the server rendered, which is the
        // handoff's records, and the chunks without which the root's data is
        // missing (the server render showed nothing else either: its readers
        // also hydrate). Every chunk goes to the Environment at once.
        if (inRender && hydrating) {
          root.hydration = createHydrationEnvironment(environment);
        }
        const publish = (
          records: RelayHandoffChunk['records'],
          sequence: number,
          serverRendered: boolean,
        ) => {
          const hydrationRecords: ?{
            [dataID: DataID]: {[key: string]: unknown},
          } = serverRendered ? {} : null;
          const payload = toPayload(
            environment,
            root,
            records,
            sequence,
            created,
            hydrationRecords,
          );
          if (hydrationRecords != null) {
            root.hydration?.environment.publishWithDeferredNotify(
              root.operation,
              {
                data: hydrationRecords,
                extensions: {is_normalized: true},
              },
            )();
          }
          if (deferNotify != null) {
            const notify = deferNotify.publishWithDeferredNotify(
              root.operation,
              payload,
            );
            root.notify = notify;
            // In case no reader commits, e.g. a render React discards. (A
            // server render has no other readers to update.)
            if (!environment.isServer()) {
              setTimeout(notify, 0);
            }
          } else {
            sink.next(payload);
          }
        };
        // A chunk that fails as it is prepared or published ends the
        // execution with that error, as a failure in the Environment's own
        // handling of a payload does.
        const publishOrFail = (
          records: RelayHandoffChunk['records'],
          sequence: number,
          serverRendered: boolean,
        ): boolean => {
          try {
            publish(records, sequence, serverRendered);
            return true;
          } catch (error: unknown) {
            sink.error(
              error instanceof Error
                ? error
                : new Error('Relay: Publishing a handoff failed.', {
                    cause: error,
                  }),
              true,
            );
            return false;
          }
        };
        const follow = (next: Promise<?RelayHandoffChunk>) => {
          next.then(
            chunk => {
              if (!active) {
                return;
              }
              const apply = (arrived: RelayHandoffChunk) => {
                if (
                  publishOrFail(
                    arrived.records,
                    arrived.sequence,
                    root.hydration != null && !hasData(environment, root),
                  )
                ) {
                  follow(arrived.next);
                }
              };
              if (chunk == null) {
                root.active = false;
                root.delivered = true;
                sink.complete();
              } else if (
                deferNotify != null &&
                root.hydration != null &&
                hasData(environment, root)
              ) {
                // A chunk that had already arrived (production Flight follows
                // a settled chunk at once), during the hydrating render that
                // executes the root: published now, it would reach readers
                // already on screen with this render's records, at its commit.
                // Hydration does not need it, so it is published right after,
                // in a transition: React keeps those readers as they are while
                // what the newer data needs (e.g. an RSC field's value) loads.
                queueMicrotask(() => {
                  if (active) {
                    startTransition(() => apply(chunk));
                  }
                });
              } else {
                apply(chunk);
              }
            },
            error => {
              if (active) {
                root.active = false;
                const failure =
                  error instanceof Error
                    ? error
                    : new Error('Relay: The server query failed.');
                root.error = failure;
                sink.error(failure);
              }
            },
          );
        };
        if (
          publishOrFail(
            handoff.records,
            handoff.sequence,
            root.hydration != null,
          )
        ) {
          follow(handoff.next);
        }
        deferNotify = null;
        return () => {
          active = false;
          root.active = false;
          root.releaseOnEnd.splice(0).forEach(retain => retain.dispose());
        };
      }),
    }),
  );
}

// What the server rendered a root's readers with, as its handoff sent it, in
// an Environment of its own: readers that hydrate read it, so they match the
// server's HTML whatever newer data the root's chunks or other roots wrote to
// the page's Environment since; after they commit they read the page's. It
// has no network and retains nothing, and it is no larger than the handoff's
// records, which it lives no longer than.
type HydrationRecords = {
  readonly environment: RelayModernEnvironment,
  readonly store: Store,
};

// It reads its records as `environment`'s Store does (resolver context and
// all) when that is a `RelayModernStore`.
function createHydrationEnvironment(
  environment: IEnvironment,
): HydrationRecords {
  const source = new RecordSource();
  const pageStore = environment.getStore();
  const store =
    pageStore instanceof Store
      ? pageStore.__createSnapshotStore(source)
      : new Store(source);
  return {
    environment: new RelayModernEnvironment({
      network: Network.create(() => Observable.create(() => {})),
      store,
    }),
    store,
  };
}

// Whether the Store has a root's data. A check that throws (`@module` data
// the client has no operation loader for) counts as missing.
function hasData(environment: IEnvironment, root: HandoffRoot): boolean {
  const store = (root.hydration?.environment ?? environment).getStore();
  try {
    return store.check(root.operation).status !== 'missing';
  } catch {
    return false;
  }
}

// Whether records a root published were collected since. Garbage
// collection removes whole records, so checking that each is still in the
// Store is enough, and needs no operation loader for `@module` data.
function isCollected(
  environment: IEnvironment,
  handoff: RelayHandoff,
): boolean {
  const root = getRoot(environment, handoff);
  if (!root.delivered || root.active) {
    return false;
  }
  const source = environment.getStore().getSource();
  return Array.from(root.recordIDs).some(id => !source.has(id));
}

type Acquisition = {
  release: () => void,
  releaseSoon: () => void,
  cancelRelease: () => void,
};

function createAcquisition(release: () => void): Acquisition {
  let released = false;
  let cancelled = false;
  const acquisition = {
    cancelRelease: () => {
      cancelled = true;
    },
    release: () => {
      if (!released) {
        released = true;
        release();
      }
    },
    releaseSoon: () => {
      cancelled = false;
      void Promise.resolve().then(() => {
        if (!cancelled) {
          acquisition.release();
        }
      });
    },
  };
  return acquisition;
}

// A list field as a handoff sends it: the whole list, or the items appended
// at `from` to the list the root sent before.
type HandoffList = {
  readonly ids: ReadonlyArray<unknown>,
  readonly from: ?number,
};

function readList(value: unknown): ?HandoffList {
  if (value == null || typeof value !== 'object') {
    return null;
  }
  if (Array.isArray(value.__refs)) {
    return {from: null, ids: value.__refs};
  }
  if (
    Array.isArray(value.__refsAppend) &&
    typeof value.__refsAppendFrom === 'number'
  ) {
    return {from: value.__refsAppendFrom, ids: value.__refsAppend};
  }
  return null;
}

// The handoff whose root owns a reference to a fragment its records spread.
function getSpreadHandoff(fragmentRef: unknown): ?RelayHandoff {
  const owner =
    fragmentRef != null && typeof fragmentRef === 'object'
      ? fragmentRef[FRAGMENT_OWNER_KEY]
      : null;
  return owner != null && typeof owner === 'object'
    ? handoffsByOwner.get(owner)
    : null;
}

function getHandoffs(
  fragmentRef: unknown,
  getHandoff: (fragmentRef: unknown) => ?RelayHandoff = getRelayHandoff,
): ?ReadonlyArray<RelayHandoff> {
  if (Array.isArray(fragmentRef)) {
    let handoffs: ?Array<RelayHandoff> = null;
    for (let ii = 0; ii < fragmentRef.length; ii++) {
      const handoff = getHandoff(fragmentRef[ii]);
      if (handoff != null) {
        handoffs = handoffs ?? [];
        handoffs.push(handoff);
      }
    }
    return handoffs;
  }
  const handoff = getHandoff(fragmentRef);
  return handoff == null ? null : [handoff];
}

// The reference a fragment reads from: owned by its root's request.
function withOwner(environment: IEnvironment, fragmentRef: unknown): unknown {
  if (Array.isArray(fragmentRef)) {
    const {ownedLists} = getState(environment);
    let owned = ownedLists.get(fragmentRef);
    if (owned == null) {
      owned = fragmentRef.map(item => withOwner(environment, item));
      ownedLists.set(fragmentRef, owned);
    }
    return owned;
  }
  const handoff = getRelayHandoff(fragmentRef);
  if (
    handoff == null ||
    fragmentRef == null ||
    typeof fragmentRef !== 'object'
  ) {
    return fragmentRef;
  }
  const root = getRoot(environment, handoff);
  let owned = root.refs.get(fragmentRef);
  if (owned == null) {
    const {__handoff: _handoff, ...ref} = fragmentRef;
    owned = {...ref, __fragmentOwner: root.operation.request};
    root.refs.set(fragmentRef, owned);
  }
  return owned;
}

const PLAIN_OBJECT = Object.getPrototypeOf({});

// The fragment references in a fragment's data: its plain objects and arrays,
// not the values a field holds (e.g. an RSC field's React node).
function forEachFragmentRef(
  value: unknown,
  callback: (fragmentRef: {...}) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item: unknown) => forEachFragmentRef(item, callback));
    return;
  }
  if (
    value == null ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== PLAIN_OBJECT
  ) {
    return;
  }
  if (value[FRAGMENTS_KEY] != null) {
    callback(value);
  }
  Object.keys(value).forEach(key => {
    if (key !== FRAGMENTS_KEY) {
      forEachFragmentRef(value[key], callback);
    }
  });
}

/**
 * Lets `useFragment` read a fragment reference a server component handed
 * off: publishes the records it carries into this Environment (once per
 * root), retains them while the component is mounted, and suspends while
 * deferred records it needs are on their way. Ordinary references are
 * returned unchanged.
 */
hook useRelayHandoff(environment: IEnvironment, fragmentRef: unknown): unknown {
  const handoffs = getHandoffs(fragmentRef);
  // The roots this reader keeps: those it was handed, or those whose data
  // spread the fragments it reads.
  const retained = handoffs ?? getHandoffs(fragmentRef, getSpreadHandoff);
  // Whether this render hydrates the server's HTML: React reads the server
  // snapshot only then (and on the server). Both snapshots are the same, so
  // nothing renders again after hydration.
  let hydrating = false;
  useSyncExternalStore(subscribeNever, notHydrating, () => {
    hydrating = true;
    return false;
  });
  // An ordinary reference costs only the checks above: a store that never
  // changes, and an effect whose dependencies never change.
  let key: ?string = null;
  if (retained != null) {
    retained.forEach(handoff => {
      const root = getRoot(environment, handoff);
      // A reader of a spread fragment leaves a failure to the reader of the
      // root's own fragment.
      if (handoffs != null && root.error != null) {
        throw root.error;
      }
      if (isCollected(environment, handoff)) {
        root.generation++;
      }
      const id = `${root.operation.request.identifier}-${root.generation}`;
      key = key == null ? id : `${key} ${id}`;
      // Once per generation: the records are in the Store once the execution
      // starts, retained until the reader's layout effect retains them.
      if (root.executed !== root.generation) {
        root.executed = root.generation;
        executeHandoff(environment, handoff, root, true, hydrating).subscribe({
          error: error => {
            root.error = error;
          },
        });
      }
      // A chunk that had already failed (a settled Flight promise) fails the
      // root while it executes.
      if (handoffs != null && root.error != null) {
        throw root.error;
      }
    });
  }

  // The roots this reader retains. A layout effect acquires them; the final
  // release lives in an insertion effect's cleanup, which, unlike layout
  // and passive effects, stays connected while an Activity or Suspense
  // boundary hides a mounted reader. So a hidden reader keeps its roots, and
  // only a true unmount releases them.
  const acquired = useRef<?Acquisition>(null);
  useLayoutEffect(() => {
    const previous = acquired.current;
    acquired.current = null;
    previous?.cancelRelease();
    let roots: ReadonlyArray<HandoffRoot> = [];
    if (retained != null) {
      // Records collected before this reader committed (e.g. under an
      // Activity hidden from the start): publish them again from the
      // handoff, filling only missing fields.
      retained.forEach(handoff => {
        if (isCollected(environment, handoff)) {
          executeHandoff(
            environment,
            handoff,
            getRoot(environment, handoff),
            false,
            false,
          ).subscribe({});
        }
      });
      // Acquire before releasing the previous roots.
      roots = retained.map(handoff => getRoot(environment, handoff));
      const disposables = roots.map(root => environment.retain(root.operation));
      acquired.current = createAcquisition(() => {
        disposables.forEach((disposable, index) => {
          if (roots[index].active) {
            roots[index].releaseOnEnd.push(disposable);
          } else {
            disposable.dispose();
          }
        });
      });
    }
    previous?.release();
    // Last, so that a Store subscriber that throws leaves nothing acquired
    // without its release.
    roots.forEach(root => {
      const notify = root.notify;
      root.notify = null;
      notify?.();
    });
    // `environment` and `key` identify the retained roots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, key]);
  useInsertionEffect(
    () => () => {
      // A true unmount: release after the current task, unless a reader
      // acquires the roots again first.
      acquired.current?.releaseSoon();
    },
    [],
  );

  if (handoffs == null) {
    return fragmentRef;
  }
  const owned = withOwner(environment, fragmentRef);
  // A hydrating render reads each root's own records (see
  // `createHydrationEnvironment`); other renders read the Environment's.
  const hydrationEnvironments: Map<unknown, HydrationRecords> = new Map();
  if (hydrating) {
    handoffs.forEach(handoff => {
      const root = getRoot(environment, handoff);
      if (root.hydration != null) {
        hydrationEnvironments.set(root.operation.request, root.hydration);
      }
    });
  }
  if (
    hydrationEnvironments.size === 0 ||
    owned == null ||
    typeof owned !== 'object'
  ) {
    return owned;
  }
  const hydratingRef: {...} = Array.isArray(owned) ? [...owned] : {...owned};
  const lookup = (selector: SingularReaderSelector): ?Snapshot => {
    const hydration = hydrationEnvironments.get(selector.owner);
    if (hydration == null) {
      return null;
    }
    const snapshot = hydration.environment.lookup(selector);
    // A Live Resolver's value shows as it was read here; once the reader
    // commits it reads the page's Store, which follows it.
    hydration.store.__unsubscribeFromLiveResolvers();
    // The fragments it spreads hydrate from the same records.
    forEachFragmentRef(snapshot.data, ref =>
      setHandoffHydrationLookup(ref, lookup),
    );
    return snapshot;
  };
  setHandoffHydrationLookup(hydratingRef, lookup);
  return hydratingRef;
}

module.exports = useRelayHandoff;
