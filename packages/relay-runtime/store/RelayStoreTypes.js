/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

'use strict';
import type {
  ActorIdentifier,
  IActorEnvironment,
} from '../multi-actor-environment';
import type {
  GraphQLResponse,
  GraphQLResponseWithData,
  INetwork,
  PayloadData,
  PayloadError,
  UploadableMap,
} from '../network/RelayNetworkTypes';
import type RelayObservable from '../network/RelayObservable';
import type {RequestIdentifier} from '../util/getRequestIdentifier';
import type {
  NormalizationArgument,
  NormalizationLinkedField,
  NormalizationRootNode,
  NormalizationScalarField,
  NormalizationSelectableNode,
  NormalizationSelection,
} from '../util/NormalizationNode';
import type {ReaderFragment, ReaderLinkedField} from '../util/ReaderNode';
import type {
  ConcreteRequest,
  RequestParameters,
} from '../util/RelayConcreteNode';
import type {
  CacheConfig,
  DataID,
  Disposable,
  RenderPolicy,
  UpdatableFragment,
  UpdatableQuery,
  Variables,
} from '../util/RelayRuntimeTypes';
import type {TRelayFieldError} from './RelayErrorTrie';
import type {
  Record as RelayModernRecord,
  RecordJSON,
} from './RelayModernRecord';
import type {InvalidationState} from './RelayModernStore';
import type RelayOperationTracker from './RelayOperationTracker';
import type {RecordState} from './RelayRecordState';
import type {NormalizationOptions} from './RelayResponseNormalizer';

export opaque type FragmentType = empty;
export type OperationTracker = RelayOperationTracker;

export type Record = RelayModernRecord;

export type MutationParameters = {
  readonly response: {...},
  readonly variables: {...},
  readonly rawResponse?: {...},
};

export type FragmentMap = {[key: string]: ReaderFragment, ...};

/**
 * The results of a selector given a store/RecordSource.
 */
export type SelectorData = {[key: string]: unknown, ...};

export type SingularReaderSelector = {
  readonly kind: 'SingularReaderSelector',
  readonly dataID: DataID,
  readonly isWithinUnmatchedTypeRefinement: boolean,
  readonly parentClientEdge: ClientEdgeTraversalInfo | null,
  readonly node: ReaderFragment,
  readonly owner: RequestDescriptor,
  readonly variables: Variables,
};

export type ReaderSelector = SingularReaderSelector | PluralReaderSelector;

export type PluralReaderSelector = {
  readonly kind: 'PluralReaderSelector',
  readonly selectors: ReadonlyArray<SingularReaderSelector>,
};

export type FieldErrorType =
  'MISSING_DATA' | 'MISSING_REQUIRED' | 'PAYLOAD_ERROR';

export type RequestDescriptor = {
  readonly identifier: RequestIdentifier,
  readonly node: ConcreteRequest,
  readonly variables: Variables,
  readonly cacheConfig: ?CacheConfig,
};

/**
 * A selector defines the starting point for a traversal into the graph for the
 * purposes of targeting a subgraph.
 */
export type NormalizationSelector = {
  readonly dataID: DataID,
  readonly node: NormalizationSelectableNode,
  readonly variables: Variables,
};

export type FieldError =
  | RelayFieldPayloadErrorEvent
  | MissingExpectedDataLogEvent
  | MissingExpectedDataThrowEvent
  | RelayResolverErrorEvent
  | MissingRequiredFieldLogEvent
  | MissingRequiredFieldThrowEvent;

export type FieldErrors = Array<FieldError>;

export type ClientEdgeTraversalInfo = {
  readonly readerClientEdge: {readonly operation: ConcreteRequest, ...},
  readonly clientEdgeDestinationID: DataID,
};

export type MissingClientEdgeRequestInfo = {
  readonly request: ConcreteRequest,
  readonly clientEdgeDestinationID: DataID,
};

/**
 * A representation of a selector and its results at a particular point in time.
 */
export type Snapshot = {
  readonly data: ?SelectorData,
  readonly isMissingData: boolean,
  readonly missingLiveResolverFields?: ReadonlyArray<DataID>,
  readonly missingClientEdges: null | ReadonlyArray<MissingClientEdgeRequestInfo>,
  readonly seenRecords: DataIDSet,
  readonly selector: SingularReaderSelector,
  readonly fieldErrors: ?FieldErrors,
};

/**
 * An operation selector describes a specific instance of a GraphQL operation
 * with variables applied.
 *
 * - `root`: a selector intended for processing server results or retaining
 *   response data in the store.
 * - `fragment`: a selector intended for use in reading or subscribing to
 *   the results of the operation.
 */
export type OperationDescriptor = {
  readonly fragment: SingularReaderSelector,
  readonly request: RequestDescriptor,
  readonly root: NormalizationSelector,
};

/**
 * Arbitrary data e.g. received by a container as props.
 */
export type Props = {[key: string]: unknown, ...};

/**
 * The type of the `relay` property set on React context by the React/Relay
 * integration layer (e.g. QueryRenderer, FragmentContainer, etc).
 */
export type RelayContext = {
  environment: IEnvironment,
  getEnvironmentForActor?: ?(
    actorIdentifier: ActorIdentifier,
  ) => IActorEnvironment,
};

/**
 * The results of reading the results of a FragmentMap given some input
 * `Props`.
 */
export type FragmentSpecResults = {[key: string]: unknown, ...};

/**
 * A utility for resolving and subscribing to the results of a fragment spec
 * (key -> fragment mapping) given some "props" that determine the root ID
 * and variables to use when reading each fragment. When props are changed via
 * `setProps()`, the resolver will update its results and subscriptions
 * accordingly. Internally, the resolver:
 * - Converts the fragment map & props map into a map of `Selector`s.
 * - Removes any resolvers for any props that became null.
 * - Creates resolvers for any props that became non-null.
 * - Updates resolvers with the latest props.
 */
export interface FragmentSpecResolver {
  /**
   * Stop watching for changes to the results of the fragments.
   */
  dispose(): void;

  /**
   * Get the current results.
   */
  resolve(): FragmentSpecResults;

  /**
   * Update the resolver with new inputs. Call `resolve()` to get the updated
   * results.
   */
  setProps(props: Props): void;

  /**
   * Override the variables used to read the results of the fragments. Call
   * `resolve()` to get the updated results.
   */
  setVariables(variables: Variables, node: ConcreteRequest): void;

  /**
   * Subscribe to resolver updates.
   * Overrides existing callback (if one has been specified).
   */
  setCallback(props: Props, callback: () => void): void;
}

/**
 * A read-only interface for accessing cached graph data.
 */
export interface RecordSource {
  get(dataID: DataID): ?Record;
  getRecordIDs(): Array<DataID>;
  getStatus(dataID: DataID): RecordState;
  has(dataID: DataID): boolean;
  size(): number;
  toJSON(): RecordSourceJSON;
}

/**
 * A collection of records keyed by id.
 */
export type RecordSourceJSON = {readonly [DataID]: ?RecordJSON};

/**
 * A read/write interface for accessing and updating graph data.
 */
export interface MutableRecordSource extends RecordSource {
  clear(): void;
  delete(dataID: DataID): void;
  remove(dataID: DataID): void;
  set(dataID: DataID, record: Record): void;
}

export type CheckOptions = {
  readonly handlers: ReadonlyArray<MissingFieldHandler>,
  readonly defaultActorIdentifier: ActorIdentifier,
  readonly getTargetForActor: (
    actorIdentifier: ActorIdentifier,
  ) => MutableRecordSource,
  readonly getSourceForActor: (
    actorIdentifier: ActorIdentifier,
  ) => RecordSource,
};

export type OperationAvailability =
  | {status: 'available', fetchTime: ?number}
  | {status: 'stale'}
  | {status: 'missing'};

export type {InvalidationState} from './RelayModernStore';

/**
 * An interface for keeping multiple views of data consistent across an
 * application.
 */
export interface Store {
  /**
   * Get a read-only view of the store's internal RecordSource.
   */
  getSource(): RecordSource;

  /**
   * Determine if the operation can be resolved with data in the store (i.e. no
   * fields are missing).
   */
  check(
    operation: OperationDescriptor,
    options?: CheckOptions,
  ): OperationAvailability;

  /**
   * Read the results of a selector from in-memory records in the store.
   */
  lookup(selector: SingularReaderSelector): Snapshot;

  /**
   * Notify subscribers (see `subscribe`) of any data that was published
   * (`publish()`) since the last time `notify` was called.
   * Optionally provide an OperationDescriptor indicating the source operation
   * that was being processed to produce this run.
   *
   * This method should return an array of the affected fragment owners.
   */
  notify(
    sourceOperation?: OperationDescriptor,
    invalidateStore?: boolean,
  ): ReadonlyArray<RequestDescriptor>;

  /**
   * Publish new information (e.g. from the network) to the store, updating its
   * internal record source. Subscribers are not immediately notified - this
   * occurs when `notify()` is called.
   */
  publish(source: RecordSource, idsMarkedForInvalidation?: DataIDSet): void;

  /**
   * Publish on behalf of `sourceOperation` when no `notify()` will follow in
   * this turn. `publish()` also defers notification, but expects a `notify()`
   * imminently, and it is that call which records the operation as written.
   * Until the deferred notify happens the store must treat the operation as
   * written: `check()` must resolve it, and its records must not be collected.
   */
  publishWithDeferredNotify(
    source: RecordSource,
    sourceOperation: OperationDescriptor,
    idsMarkedForInvalidation?: DataIDSet,
  ): void;

  /**
   * Ensure that all the records necessary to fulfill the given selector are
   * retained in memory. The records will not be eligible for garbage collection
   * until the returned reference is disposed.
   */
  retain(operation: OperationDescriptor): Disposable;

  /**
   * Subscribe to changes to the results of a selector. The callback is called
   * when `notify()` is called *and* records have been published that affect the
   * selector results relative to the last `notify()`.
   */
  subscribe(
    snapshot: Snapshot,
    callback: (snapshot: Snapshot) => void,
  ): Disposable;

  /**
   * The method should disable garbage collection until
   * the returned reference is disposed.
   */
  holdGC(): Disposable;

  /**
   * Record a backup/snapshot of the current state of the store, including
   * records and derived data such as fragment subscriptions.
   * This state can be restored with restore().
   */
  snapshot(): void;

  /**
   * Reset the state of the store to the point that snapshot() was last called.
   */
  restore(): void;

  /**
   * Will return an opaque snapshot of the current invalidation state of
   * the data ids that were provided.
   */
  lookupInvalidationState(dataIDs: ReadonlyArray<DataID>): InvalidationState;

  /**
   * Given the previous invalidation state for those
   * ids, this function will return:
   *   - false, if the invalidation state for those ids is the same, meaning
   *     **it has not changed**
   *   - true, if the invalidation state for the given ids has changed
   */
  checkInvalidationState(previousInvalidationState: InvalidationState): boolean;

  /**
   * Will subscribe the provided callback to the invalidation state of the
   * given data ids. Whenever the invalidation state for any of the provided
   * ids changes, the callback will be called, and provide the latest
   * invalidation state.
   * Disposing of the returned disposable will remove the subscription.
   */
  subscribeToInvalidationState(
    invalidationState: InvalidationState,
    callback: () => void,
  ): Disposable;

  /**
   * Get the current write epoch
   */
  getEpoch(): number;

  /**
   * Get the current operation loader if it exists
   */
  getOperationLoader(): ?OperationLoader;
}

export interface StoreSubscriptions {
  /**
   * Subscribe to changes to the results of a selector. The callback is called
   * when `updateSubscriptions()` is called *and* records have been published that affect the
   * selector results relative to the last update.
   */
  subscribe(
    snapshot: Snapshot,
    callback: (snapshot: Snapshot) => void,
  ): Disposable;

  /**
   * Record a backup/snapshot of the current state of the subscriptions.
   * This state can be restored with restore().
   */
  snapshotSubscriptions(source: RecordSource): void;

  /**
   * Reset the state of the subscriptions to the point that snapshot() was last called.
   */
  restoreSubscriptions(): void;

  /**
   * Notifies each subscription if the snapshot for the subscription selector has changed.
   * Mutates the updatedOwners array with any owners (RequestDescriptors) associated
   * with the subscriptions that were notified; i.e. the owners affected by the changes.
   */
  updateSubscriptions(
    source: RecordSource,
    updatedRecordIDs: DataIDSet,
    updatedOwners: Array<RequestDescriptor>,
    sourceOperation?: OperationDescriptor,
  ): void;

  /**
   * Same as `updateSubscriptions`, except it only notifies subscriptions with stale snapshots.
   */
  updateStaleSubscriptions(
    source: RecordSource,
    updatedRecordIDs: DataIDSet,
    updatedOwners: Array<RequestDescriptor>,
    sourceOperation?: OperationDescriptor,
  ): void;

  /**
   * returns the number of subscriptions
   */
  size(): number;
}

/**
 * A type that accepts a callback and schedules it to run at some future time.
 * By convention, implementations should not execute the callback immediately.
 */
export type Scheduler = (() => void) => void;

/**
 * A type that can schedule callbacks and also cancel them.
 */
export type TaskScheduler = {
  readonly cancel: (id: string) => void,
  readonly schedule: (fn: () => void, priority?: TaskPriority) => string,
};

export type TaskPriority = 'default' | 'low';

/**
 * An interface for imperatively getting/setting properties of a `Record`. This interface
 * is designed to allow the appearance of direct Record manipulation while
 * allowing different implementations that may e.g. create a changeset of
 * the modifications.
 */
export interface RecordProxy {
  copyFieldsFrom(source: RecordProxy): void;
  getDataID(): DataID;
  getLinkedRecord(name: string, args?: ?Variables): ?RecordProxy;
  getLinkedRecords(name: string, args?: ?Variables): ?Array<?RecordProxy>;
  getOrCreateLinkedRecord(
    name: string,
    typeName: string,
    args?: ?Variables,
  ): RecordProxy;
  getType(): string;
  getValue(name: string, args?: ?Variables): unknown;
  getErrors(name: string, args?: ?Variables): ?ReadonlyArray<TRelayFieldError>;
  setLinkedRecord(
    record: RecordProxy,
    name: string,
    args?: ?Variables,
  ): RecordProxy;
  setLinkedRecords(
    records: ReadonlyArray<?RecordProxy>,
    name: string,
    args?: ?Variables,
  ): RecordProxy;
  setValue(
    value: unknown,
    name: string,
    args?: ?Variables,
    errors?: ?ReadonlyArray<TRelayFieldError>,
  ): RecordProxy;
  invalidateRecord(): void;
}

export interface ReadOnlyRecordProxy {
  getDataID(): DataID;
  getLinkedRecord(name: string, args?: ?Variables): ?RecordProxy;
  getLinkedRecords(name: string, args?: ?Variables): ?Array<?RecordProxy>;
  getType(): string;
  getValue(name: string, args?: ?Variables): unknown;
}

/**
 * A linked field where an updatable fragment is spread has the type
 * HasUpdatableSpread.
 * This type is expected by store.readUpdatableFragment.
 */
export type HasUpdatableSpread<TFragmentType> = {
  readonly $updatableFragmentSpreads: TFragmentType,
  ...
};

/**
 * The return type of calls to readUpdatableQuery and
 * readUpdatableFragment.
 */
export type UpdatableData<TData> = {
  readonly updatableData: TData,
};

/**
 * An interface for imperatively getting/setting properties of a `RecordSource`. This interface
 * is designed to allow the appearance of direct RecordSource manipulation while
 * allowing different implementations that may e.g. create a changeset of
 * the modifications.
 */
export interface RecordSourceProxy {
  create(dataID: DataID, typeName: string): RecordProxy;
  delete(dataID: DataID): void;
  get(dataID: DataID): ?RecordProxy;
  getRoot(): RecordProxy;
  invalidateStore(): void;
  readUpdatableQuery<TVariables extends Variables, TData>(
    query: UpdatableQuery<TVariables, TData>,
    variables: TVariables,
  ): UpdatableData<TData>;
  readUpdatableFragment<TFragmentType extends FragmentType, TData>(
    fragment: UpdatableFragment<TFragmentType, TData>,
    fragmentReference: HasUpdatableSpread<TFragmentType>,
  ): UpdatableData<TData>;
}

export interface ReadOnlyRecordSourceProxy {
  get(dataID: DataID): ?ReadOnlyRecordProxy;
  getRoot(): ReadOnlyRecordProxy;
}

/**
 * Extends the RecordSourceProxy interface with methods for accessing the root
 * fields of a Selector.
 */
export interface RecordSourceSelectorProxy extends RecordSourceProxy {
  getRootField(fieldName: string): ?RecordProxy;
  getPluralRootField(fieldName: string): ?Array<?RecordProxy>;
  invalidateStore(): void;
}

export type SuspenseFragmentLogEvent = {
  readonly name: 'suspense.fragment',
  readonly data: unknown,
  readonly fragment: ReaderFragment,
  readonly isRelayHooks: boolean,
  readonly isMissingData: boolean,
  readonly isPromiseCached: boolean,
  readonly pendingOperations: ReadonlyArray<RequestDescriptor>,
};

export type SuspenseResolverLogEvent = {
  readonly name: 'suspense.resolver',
  readonly fragment: ReaderFragment,
  readonly fragmentOwner: RequestDescriptor,
  readonly isMount: boolean,
  readonly suspendingLiveResolvers: ReadonlyArray<DataID>,
};

export type SuspenseClientEdgeLogEvent = {
  readonly name: 'suspense.client_edge',
  readonly fragment: ReaderFragment,
  readonly fragmentOwner: RequestDescriptor,
  readonly isMount: boolean,
};

export type SuspenseMissingDataLogEvent = {
  readonly name: 'suspense.missing_data',
  readonly fragment: ReaderFragment,
  readonly fragmentOwner: RequestDescriptor,
  readonly isMount: boolean,
  readonly pendingOperations: ReadonlyArray<RequestDescriptor>,
};

export type SuspenseQueryLogEvent = {
  readonly name: 'suspense.query',
  readonly fetchPolicy: string,
  readonly isPromiseCached: boolean,
  readonly operation: OperationDescriptor,
  readonly queryAvailability: ?OperationAvailability,
  readonly renderPolicy: RenderPolicy,
};

export type QueryResourceFetchLogEvent = {
  readonly name: 'queryresource.fetch',
  // ID of this query resource request and will be the same
  // if there is an associated queryresource.retain event.
  readonly resourceID: number,
  readonly operation: OperationDescriptor,
  // value from ProfilerContext
  readonly profilerContext: unknown,
  // FetchPolicy from Relay Hooks
  readonly fetchPolicy: string,
  // RenderPolicy from Relay Hooks
  readonly renderPolicy: RenderPolicy,
  readonly queryAvailability: OperationAvailability,
  readonly shouldFetch: boolean,
};

export type QueryResourceRetainLogEvent = {
  readonly name: 'queryresource.retain',
  readonly resourceID: number,
  // value from ProfilerContext
  readonly profilerContext: unknown,
};

export type FragmentResourceMissingDataLogEvent = {
  // Indicates FragmentResource is going to return a result that is missing
  // data.
  readonly name: 'fragmentresource.missing_data',
  readonly data: unknown,
  readonly fragment: ReaderFragment,
  readonly isRelayHooks: boolean,
  // Are we reading this result from the fragment resource cache?
  readonly cached: boolean,
};

export type PendingOperationFoundLogEvent = {
  // Indicates getPendingOperationForFragment identified a pending operation.
  // Useful for measuring how frequently RelayOperationTracker identifies a
  // related operation on which to suspend.
  readonly name: 'pendingoperation.found',
  readonly fragment: ReaderFragment,
  readonly fragmentOwner: RequestDescriptor,
  readonly pendingOperations: ReadonlyArray<RequestDescriptor>,
};

export type NetworkInfoLogEvent = {
  readonly name: 'network.info',
  readonly networkRequestId: number,
  readonly info: unknown,
};

export type NetworkStartLogEvent = {
  readonly name: 'network.start',
  readonly networkRequestId: number,
  readonly params: RequestParameters,
  readonly variables: Variables,
  readonly cacheConfig: CacheConfig,
};

export type NetworkNextLogEvent = {
  readonly name: 'network.next',
  readonly networkRequestId: number,
  readonly response: GraphQLResponse,
};

export type NetworkErrorLogEvent = {
  readonly name: 'network.error',
  readonly networkRequestId: number,
  readonly error: Error,
};

export type NetworkCompleteLogEvent = {
  readonly name: 'network.complete',
  readonly networkRequestId: number,
};

export type NetworkUnsubscribeLogEvent = {
  readonly name: 'network.unsubscribe',
  readonly networkRequestId: number,
};

export type ExecuteStartLogEvent = {
  readonly name: 'execute.start',
  readonly executeId: number,
  readonly params: RequestParameters,
  readonly variables: Variables,
  readonly cacheConfig: CacheConfig,
};

export type ExecuteNextStartLogEvent = {
  readonly name: 'execute.next.start',
  readonly executeId: number,
  readonly response: GraphQLResponse,
  readonly operation: OperationDescriptor,
};

export type ExecuteNextEndLogEvent = {
  readonly name: 'execute.next.end',
  readonly executeId: number,
  readonly response: GraphQLResponse,
  readonly operation: OperationDescriptor,
};

export type ExecuteAsyncModuleLogEvent = {
  readonly name: 'execute.async.module',
  readonly executeId: number,
  readonly operationName: string,
  readonly duration: number,
};

export type ExecuteErrorLogEvent = {
  readonly name: 'execute.error',
  readonly executeId: number,
  readonly error: Error,
};

export type ExecuteCompleteLogEvent = {
  readonly name: 'execute.complete',
  readonly executeId: number,
};

export type ExecuteUnsubscribeLogEvent = {
  readonly name: 'execute.unsubscribe',
  readonly executeId: number,
};

export type ExecuteNormalizeStart = {
  readonly name: 'execute.normalize.start',
  readonly operation: OperationDescriptor,
};

export type ExecuteNormalizeEnd = {
  readonly name: 'execute.normalize.end',
  readonly operation: OperationDescriptor,
};

export type StoreDataCheckerStartEvent = {
  readonly name: 'store.datachecker.start',
  readonly selector: NormalizationSelector,
};

export type StoreDataCheckerEndEvent = {
  readonly name: 'store.datachecker.end',
  readonly selector: NormalizationSelector,
};

export type StoreDataCheckerMissingEvent = {
  readonly name: 'store.datachecker.missing',
  readonly kind: 'scalar' | 'linked' | 'pluralLinked' | 'unknown_record',
  readonly dataID: DataID,
  readonly fieldName?: string,
  readonly storageKey?: string,
};

export type StorePublishLogEvent = {
  readonly name: 'store.publish',
  readonly source: RecordSource,
  readonly optimistic: boolean,
};

export type StoreSnapshotLogEvent = {
  readonly name: 'store.snapshot',
};

export type StoreLookupStartEvent = {
  readonly name: 'store.lookup.start',
  readonly selector: SingularReaderSelector,
};

export type StoreLookupEndEvent = {
  readonly name: 'store.lookup.end',
  readonly selector: SingularReaderSelector,
};

export type StoreRestoreLogEvent = {
  readonly name: 'store.restore',
};

export type StoreGcStartEvent = {
  readonly name: 'store.gc.start',
};

export type StoreGcInterruptedEvent = {
  readonly name: 'store.gc.interrupted',
};

export type StoreGcEndEvent = {
  readonly name: 'store.gc.end',
  readonly references: DataIDSet,
};

export type StoreBatchStartLogEvent = {
  readonly name: 'store.batch.start',
};

export type StoreBatchCompleteLogEvent = {
  readonly name: 'store.batch.complete',
  readonly sourceOperations: Array<OperationDescriptor>,
  readonly invalidateStore: boolean,
};

export type StoreNotifyStartLogEvent = {
  readonly name: 'store.notify.start',
  readonly sourceOperation: ?OperationDescriptor,
};

export type StoreNotifyCompleteLogEvent = {
  readonly name: 'store.notify.complete',
  readonly sourceOperation: ?OperationDescriptor,
  readonly updatedRecordIDs: DataIDSet,
  readonly invalidatedRecordIDs: DataIDSet,
  readonly subscriptionsSize: number,
  readonly updatedOwners: Array<RequestDescriptor>,
};

export type StoreNotifySubscriptionLogEvent = {
  readonly name: 'store.notify.subscription',
  readonly sourceOperation: ?OperationDescriptor,
  readonly snapshot: Snapshot,
  readonly nextSnapshot: Snapshot,
};

export type ReaderReadFragmentSpread = {
  readonly name: 'reader.fragmentSpread',
  fragmentName: string,
  data: SelectorData,
};

export type ReaderRead = {
  name: 'reader.read',
  selector: SingularReaderSelector,
};

export type EntrypointRootConsumeLogEvent = {
  readonly name: 'entrypoint.root.consume',
  readonly profilerContext: unknown,
  readonly rootModuleID: string,
};

export type LiveResolverBatchStartLogEvent = {
  readonly name: 'liveresolver.batch.start',
};

export type LiveResolverBatchEndLogEvent = {
  readonly name: 'liveresolver.batch.end',
};

export type UseFragmentSubscriptionMissedUpdates = {
  readonly name: 'useFragment.subscription.missedUpdates',
  readonly hasDataChanges: boolean,
};

/**
 * This event is logged when two strong objects share the same id,
 * but have different types, resulting in an collision in the store.
 */
export type IdCollisionTypenameLogEvent = {
  readonly name: 'idCollision.typename',
  readonly previous_typename: string,
  readonly new_typename: string,
};

export type FetchQueryFetchLogEvent = {
  readonly name: 'fetchquery.fetch',
  readonly operation: OperationDescriptor,
  // FetchPolicy from Relay Hooks
  readonly fetchPolicy: string,
  readonly queryAvailability: OperationAvailability,
  readonly shouldFetch: boolean,
};

export type LogEvent =
  | SuspenseFragmentLogEvent
  | SuspenseResolverLogEvent
  | SuspenseClientEdgeLogEvent
  | SuspenseMissingDataLogEvent
  | SuspenseQueryLogEvent
  | QueryResourceFetchLogEvent
  | QueryResourceRetainLogEvent
  | FragmentResourceMissingDataLogEvent
  | IdCollisionTypenameLogEvent
  | PendingOperationFoundLogEvent
  | NetworkInfoLogEvent
  | NetworkStartLogEvent
  | NetworkNextLogEvent
  | NetworkErrorLogEvent
  | NetworkCompleteLogEvent
  | NetworkUnsubscribeLogEvent
  | ExecuteStartLogEvent
  | ExecuteNextStartLogEvent
  | ExecuteNextEndLogEvent
  | ExecuteAsyncModuleLogEvent
  | ExecuteErrorLogEvent
  | ExecuteCompleteLogEvent
  | ExecuteUnsubscribeLogEvent
  | ExecuteNormalizeStart
  | ExecuteNormalizeEnd
  | StoreDataCheckerStartEvent
  | StoreDataCheckerEndEvent
  | StoreDataCheckerMissingEvent
  | StorePublishLogEvent
  | StoreSnapshotLogEvent
  | StoreLookupStartEvent
  | StoreLookupEndEvent
  | StoreRestoreLogEvent
  | StoreGcStartEvent
  | StoreGcInterruptedEvent
  | StoreGcEndEvent
  | StoreBatchStartLogEvent
  | StoreBatchCompleteLogEvent
  | StoreNotifyStartLogEvent
  | StoreNotifyCompleteLogEvent
  | StoreNotifySubscriptionLogEvent
  | EntrypointRootConsumeLogEvent
  | LiveResolverBatchStartLogEvent
  | LiveResolverBatchEndLogEvent
  | UseFragmentSubscriptionMissedUpdates
  | FetchQueryFetchLogEvent
  | ReaderRead
  | ReaderReadFragmentSpread;

export type LogFunction = LogEvent => void;
export type LogRequestInfoFunction = unknown => void;

/**
 * The public API of Relay core. Represents an encapsulated environment with its
 * own in-memory cache.
 */
export interface IEnvironment {
  /**
   * Extra information attached to the environment instance
   */
  readonly options: unknown;

  /**
   * **UNSTABLE** Event based logging API thats scoped to the environment.
   */
  __log: LogFunction;

  /**
   * Determine if the operation can be resolved with data in the store (i.e. no
   * fields are missing).
   *
   * Note that this operation effectively "executes" the selector against the
   * cache and therefore takes time proportional to the size/complexity of the
   * selector.
   */
  check(operation: OperationDescriptor): OperationAvailability;

  /**
   * Subscribe to changes to the results of a selector. The callback is called
   * when data has been committed to the store that would cause the results of
   * the snapshot's selector to change.
   */
  subscribe(
    snapshot: Snapshot,
    callback: (snapshot: Snapshot) => void,
  ): Disposable;

  /**
   * Ensure that all the records necessary to fulfill the given selector are
   * retained in-memory. The records will not be eligible for garbage collection
   * until the returned reference is disposed.
   */
  retain(operation: OperationDescriptor): Disposable;

  /**
   * Apply an optimistic update to the environment. The mutation can be reverted
   * by calling `dispose()` on the returned value.
   */
  applyUpdate(optimisticUpdate: OptimisticUpdateFunction): Disposable;

  /**
   * Revert updates for the `update` function.
   */
  revertUpdate(update: OptimisticUpdateFunction): void;

  /**
   * Revert updates for the `update` function, and apply the `replacement` update.
   */
  replaceUpdate(
    update: OptimisticUpdateFunction,
    replacement: OptimisticUpdateFunction,
  ): void;

  /**
   * Apply an optimistic mutation response and/or updater. The mutation can be
   * reverted by calling `dispose()` on the returned value.
   */
  applyMutation<TMutation extends MutationParameters>(
    optimisticConfig: OptimisticResponseConfig<TMutation>,
  ): Disposable;

  /**
   * Commit an updater to the environment. This mutation cannot be reverted and
   * should therefore not be used for optimistic updates. This is mainly
   * intended for updating fields from client schema extensions.
   */
  commitUpdate(updater: StoreUpdater): void;

  /**
   * Commit a payload to the environment using the given operation selector.
   */
  commitPayload(
    operationDescriptor: OperationDescriptor,
    payload: PayloadData,
  ): void;

  /**
   * Returns the environment's Network.
   */
  getNetwork(): INetwork;

  /**
   * Returns the environment's Store.
   */
  getStore(): Store;

  /**
   * Returns the environment's OperationTracker.
   */
  getOperationTracker(): RelayOperationTracker;

  /**
   * Returns the environment's TaskScheduler if one has been configured.
   */
  getScheduler(): ?TaskScheduler;

  /**
   * EXPERIMENTAL
   * Returns the default render policy to use when rendering a query
   * that uses Relay Hooks.
   */
  UNSTABLE_getDefaultRenderPolicy(): RenderPolicy;

  /**
   * Read the results of a selector from in-memory records in the store.
   */
  lookup(selector: SingularReaderSelector): Snapshot;

  /**
   * Send a query to the server with Observer semantics: one or more
   * responses may be returned (via `next`) over time followed by either
   * the request completing (`completed`) or an error (`error`).
   *
   * Note: Observables are lazy, so calling this method will do nothing until
   * the result is subscribed to: environment.execute({...}).subscribe({...}).
   */
  execute(config: {
    operation: OperationDescriptor,
  }): RelayObservable<GraphQLResponse>;

  /**
   * Send a subscription to the server with Observer semantics: one or more
   * responses may be returned (via `next`) over time followed by either
   * the request completing (`completed`) or an error (`error`).
   *
   * Networks/servers that support subscriptions may choose to hold the
   * subscription open indefinitely such that `complete` is not called.
   *
   * Note: Observables are lazy, so calling this method will do nothing until
   * the result is subscribed to: environment.executeSubscription({...}).subscribe({...}).
   */
  executeSubscription<TMutation extends MutationParameters>(config: {
    operation: OperationDescriptor,
    updater?: ?SelectorStoreUpdater<TMutation['response']>,
  }): RelayObservable<GraphQLResponse>;

  /**
   * Returns an Observable of GraphQLResponse resulting from executing the
   * provided Mutation operation, the result of which is then normalized and
   * committed to the publish queue along with an optional optimistic response
   * or updater.
   *
   * Note: Observables are lazy, so calling this method will do nothing until
   * the result is subscribed to:
   * environment.executeMutation({...}).subscribe({...}).
   */
  executeMutation<TMutation extends MutationParameters>(
    config: ExecuteMutationConfig<TMutation>,
  ): RelayObservable<GraphQLResponse>;

  /**
   * Returns an Observable of GraphQLResponse resulting from executing the
   * provided Query or Subscription operation responses, the result of which is
   * then normalized and committed to the publish queue.
   *
   * Note: Observables are lazy, so calling this method will do nothing until
   * the result is subscribed to:
   * environment.executeWithSource({...}).subscribe({...}).
   */
  executeWithSource({
    operation: OperationDescriptor,
    source: RelayObservable<GraphQLResponse>,
  }): RelayObservable<GraphQLResponse>;

  /**
   * Returns true if a request is currently "active", meaning it's currently
   * actively receiving payloads or downloading modules, and has not received
   * a final payload yet. Note that a request might still be pending (or "in flight")
   * without actively receiving payload, for example a live query or an
   * active GraphQL subscription
   */
  isRequestActive(requestIdentifier: string): boolean;

  /**
   * Returns a Promise that resolves when the operation with this identifier
   * completes, or null if no such operation is currently in flight. Backs
   * fragment-to-owner correlation across render passes that momentarily
   * drop the underlying request-cache subject.
   */
  getPromiseForInFlightOperation(
    requestIdentifier: string,
  ): Promise<void> | null;

  /**
   * Returns true if the environment is for use during server side rendering.
   * functions like getQueryResource key off of this in order to determine
   * whether we need to set up certain caches and timeout's.
   */
  isServer(): boolean;

  /**
   * Called by Relay when it encounters a missing field that has been annotated
   * with `@required(action: LOG)`.
   */
  relayFieldLogger: RelayFieldLogger;
}

/**
 * The partial shape of an object with a '...Fragment @module(name: "...")'
 * selection
 */
export type ModuleImportPointer = {
  readonly __fragmentPropName: ?string,
  readonly __module_component: unknown,
  readonly $fragmentSpreads: unknown,
  ...
};

/**
 * A set of DataIDs used to track which IDs a read() operation observed and which IDs
 * a publish operation updated.
 */
export type DataIDSet = Set<DataID>;

/**
 * A function that updates a store (via a proxy) given the results of a "handle"
 * field payload.
 */
export type Handler = Readonly<{
  update: (store: RecordSourceProxy, fieldPayload: HandleFieldPayload) => void,
  ...
}>;

/**
 * A payload that is used to initialize or update a "handle" field with
 * information from the server.
 */
export type HandleFieldPayload = {
  // The arguments that were fetched.
  readonly args: Variables,
  // The __id of the record containing the source/handle field.
  readonly dataID: DataID,
  // The (storage) key at which the original server data was written.
  readonly fieldKey: string,
  // The name of the handle.
  readonly handle: string,
  // The (storage) key at which the handle's data should be written by the
  // handler.
  readonly handleKey: string,
  // The arguments applied to the handle
  readonly handleArgs: Variables,
};

/**
 * A payload that represents data necessary to process the results of an object
 * with a `@module` fragment spread:
 *
 * ## @module Fragment Spread
 * - args: Local arguments from the parent
 * - data: The GraphQL response value for the @match field.
 * - dataID: The ID of the store object linked to by the @match field.
 * - operationReference: A reference to a generated module containing the
 *   SplitOperation with which to normalize the field's `data`.
 * - variables: Query variables.
 * - typeName: the type that matched.
 *
 * The dataID, variables, and fragmentName can be used to create a Selector
 * which can in turn be used to normalize and publish the data. The dataID and
 * typeName can also be used to construct a root record for normalization.
 *
 */
export type ModuleImportPayload = {
  readonly kind: 'ModuleImportPayload',
  readonly args: ?ReadonlyArray<NormalizationArgument>,
  readonly data: PayloadData,
  readonly dataID: DataID,
  readonly operationReference: unknown,
  readonly path: ReadonlyArray<string>,
  readonly typeName: string,
  readonly variables: Variables,
  readonly actorIdentifier: ?ActorIdentifier,
};

/**
 * A payload that represents data necessary to process the results of an object
 * with experimental actor change directive.
 *
 * - data: The GraphQL response value for the actor change field.
 * - dataID: The ID of the store object linked to by the actor change field.
 * - node: NormalizationLinkedField, where the actor change directive is used
 * - path: to a field in the response
 * - variables: Query variables.
 * - typeName: the type that matched.
 *
 * The dataID, variables, and fragmentName can be used to create a Selector
 * which can in turn be used to normalize and publish the data. The dataID and
 * typeName can also be used to construct a root record for normalization.
 */
export type ActorPayload = {
  readonly kind: 'ActorPayload',
  readonly data: PayloadData,
  readonly dataID: DataID,
  readonly node: NormalizationLinkedField,
  readonly path: ReadonlyArray<string>,
  readonly typeName: string,
  readonly variables: Variables,
  readonly actorIdentifier: ActorIdentifier,
};

/**
 * Union type of possible payload followups we may handle during normalization.
 */
export type FollowupPayload = ModuleImportPayload | ActorPayload;

/**
 * Data emitted after processing a Defer or Stream node during normalization
 * that describes how to process the corresponding response chunk when it
 * arrives.
 */
export type DeferPlaceholder = {
  readonly kind: 'defer',
  readonly data: PayloadData,
  readonly label: string,
  readonly path: ReadonlyArray<string>,
  readonly selector: NormalizationSelector,
  readonly typeName: string,
  readonly actorIdentifier: ?ActorIdentifier,
};
export type StreamPlaceholder = {
  readonly kind: 'stream',
  readonly label: string,
  readonly path: ReadonlyArray<string>,
  readonly parentID: DataID,
  readonly node: NormalizationSelectableNode,
  readonly variables: Variables,
  readonly actorIdentifier: ?ActorIdentifier,
};
export type IncrementalDataPlaceholder = DeferPlaceholder | StreamPlaceholder;

export type NormalizeResponseFunction = (
  response: GraphQLResponseWithData,
  selector: NormalizationSelector,
  typeName: string,
  options: NormalizationOptions,
  useExecTimeResolvers: boolean,
) => RelayResponsePayload;

/**
 * A user-supplied object to load a generated operation (SplitOperation or
 * ConcreteRequest) AST by a module reference. The exact format of a module
 * reference is left to the application, but it must be a plain JavaScript value
 * (string, number, or object/array of same).
 */
export type OperationLoader = {
  /**
   * Synchronously load an operation, returning either the node or null if it
   * cannot be resolved synchronously.
   */
  get(reference: unknown): ?NormalizationRootNode,

  /**
   * Asynchronously load an operation.
   */
  load(reference: unknown): Promise<?NormalizationRootNode>,
};

/**
 * A function that receives a proxy over the store and may trigger side-effects
 * (indirectly) by calling `set*` methods on the store or its record proxies.
 */
export type StoreUpdater = (store: RecordSourceProxy) => void;

/**
 * Similar to StoreUpdater, but accepts a proxy tied to a specific selector in
 * order to easily access the root fields of a query/mutation as well as a
 * second argument of the response object of the mutation.
 */
export type SelectorStoreUpdater<in TMutationResponse> = (
  store: RecordSourceSelectorProxy,
  data: ?TMutationResponse,
) => void;

/**
 * A set of configs that can be used to apply an optimistic update into the
 * store.
 */
export type OptimisticUpdate<TMutation extends MutationParameters> =
  OptimisticUpdateFunction | OptimisticUpdateRelayPayload<TMutation>;

export type OptimisticUpdateFunction = {
  readonly storeUpdater: StoreUpdater,
};

export type OptimisticUpdateRelayPayload<TMutation extends MutationParameters> =
  {
    readonly operation: OperationDescriptor,
    readonly payload: RelayResponsePayload,
    readonly updater: ?SelectorStoreUpdater<TMutation['response']>,
  };

export type OptimisticResponseConfig<TMutation extends MutationParameters> = {
  readonly operation: OperationDescriptor,
  readonly response: ?PayloadData,
  readonly updater: ?SelectorStoreUpdater<TMutation['response']>,
};

/**
 * A set of handlers that can be used to provide substitute data for missing
 * fields when reading a selector from a source.
 */
export type MissingFieldHandler =
  | {
      kind: 'scalar',
      handle: (
        field: NormalizationScalarField,
        parentRecord: ?ReadOnlyRecordProxy,
        args: Variables,
        store: ReadOnlyRecordSourceProxy,
      ) => unknown,
    }
  | {
      kind: 'linked',
      handle: (
        field: NormalizationLinkedField | ReaderLinkedField,
        parentRecord: ?ReadOnlyRecordProxy,
        args: Variables,
        store: ReadOnlyRecordSourceProxy,
      ) => ?DataID,
    }
  | {
      kind: 'pluralLinked',
      handle: (
        field: NormalizationLinkedField | ReaderLinkedField,
        parentRecord: ?ReadOnlyRecordProxy,
        args: Variables,
        store: ReadOnlyRecordSourceProxy,
      ) => ?Array<?DataID>,
    };

/**
 * Data which Relay expected to be in the store (because it was requested by
 * the parent query/mutation/subscription) was missing. This can happen due
 * to graph relationship changes observed by other queries/mutations, or
 * imperative updates that don't provide all needed data.
 *
 * https://relay.dev/docs/next/debugging/why-null/#graph-relationship-change
 *
 * In this case Relay will render with the referenced field as `undefined`.
 *
 * __NOTE__: This may break with the type contract of Relay's generated types.
 *
 * To turn this into a hard error for a given fragment/query, you can use
 * `@throwOnFieldError`.
 *
 * https://relay.dev/docs/next/guides/throw-on-field-error-directive/
 */
export type MissingExpectedDataLogEvent = {
  readonly kind: 'missing_expected_data.log',
  readonly owner: string,
  fieldPath: string, // Purposefully mutable to allow lazy construction in RelayReader
  // To populate this, you should pass the value to a ReactRelayLoggingContext
  readonly uiContext: unknown | void,
};

/**
 * Data which Relay expected to be in the store (because it was requested by
 * the parent query/mutation/subscription) was missing. This can happen due
 * to graph relationship changes observed by other queries/mutations, or
 * imperative updates that don't provide all needed data.
 *
 * https://relay.dev/docs/next/debugging/why-null/#graph-relationship-change
 *
 * This event is as `.throw` because the missing data was encountered in a
 * query/fragment/mutation with `@throwOnFieldError` `@throwOnFieldError`.
 *
 * https://relay.dev/docs/next/guides/throw-on-field-error-directive/
 *
 * Relay will throw immediately after logging this event. If you wish to
 * customize the error being thrown, you may throw your own error.
 *
 * *NOTE*: Only throw on this event if `handled` is false. Errors that have been
 * handled by a `@catch` directive or by making a resolver null will have
 * `handled: true` and should not trigger a throw.
 */
export type MissingExpectedDataThrowEvent = {
  readonly kind: 'missing_expected_data.throw',
  readonly owner: string,
  fieldPath: string, // Purposefully mutable to allow lazy construction in RelayReader
  readonly handled: boolean,
  // To populate this, you should pass the value to a ReactRelayLoggingContext
  readonly uiContext: unknown | void,
};

/**
 * A field was marked as @required(action: LOG) but was null or missing in the
 * store.
 */
export type MissingRequiredFieldLogEvent = {
  readonly kind: 'missing_required_field.log',
  readonly owner: string,
  fieldPath: string, // Purposefully mutable to allow lazy construction in RelayReader
  /**
   * The value that was read for the @required field:
   * - `null`: the server returned null for this field. If `fieldError` is also
   *   set, the server attached an error explaining why.
   * - `undefined` (void): the field was absent from the Relay store entirely.
   *   This is commonly caused by a graph relationship change observed by another
   *   query/mutation, or by an imperative store update that omitted this field.
   *   See https://relay.dev/docs/next/debugging/why-null/#graph-relationship-change
   */
  readonly fieldValue: null | void,
  /**
   * When `fieldValue` is `null` and the server attached a field error to this
   * field in the GraphQL response, this contains that error. This is the most
   * likely explanation for why the field was null.
   */
  readonly fieldError: ?TRelayFieldError,
  // To populate this, you should pass the value to a ReactRelayLoggingContext
  readonly uiContext: unknown | void,
};

/**
 * A field was marked as @required(action: THROW) but was null or missing in the
 * store.
 *
 * Relay will throw immediately after logging this event. If you wish to
 * customize the error being thrown, you may throw your own error.
 *
 * *NOTE*: Only throw on this event if `handled` is false. Errors that have been
 * handled by a `@catch` directive or by making a resolver null will have
 * `handled: true` and should not trigger a throw.
 */
export type MissingRequiredFieldThrowEvent = {
  readonly kind: 'missing_required_field.throw',
  readonly owner: string,
  fieldPath: string, // Purposefully mutable to allow lazy construction in RelayReader
  readonly handled: boolean,
  /**
   * The value that was read for the @required field:
   * - `null`: the server returned null for this field. If `fieldError` is also
   *   set, the server attached an error explaining why.
   * - `undefined` (void): the field was absent from the Relay store entirely.
   *   This is commonly caused by a graph relationship change observed by another
   *   query/mutation, or by an imperative store update that omitted this field.
   *   See https://relay.dev/docs/next/debugging/why-null/#graph-relationship-change
   */
  readonly fieldValue: null | void,
  /**
   * When `fieldValue` is `null` and the server attached a field error to this
   * field in the GraphQL response, this contains that error. This is the most
   * likely explanation for why the field was null.
   */
  readonly fieldError: ?TRelayFieldError,
  // To populate this, you should pass the value to a ReactRelayLoggingContext
  readonly uiContext: unknown | void,
};

/**
 * A Relay Resolver that is currently being read threw a JavaScript error when
 * it was last evaluated. By default, the value has been coerced to null and
 * passed to the product code.
 *
 * If `@throwOnFieldError` was used on the parent query/fragment/mutation, you
 * will also receive a TODO
 *
 * *NOTE*: Only throw on this event if `handled` is false. Errors that have been
 * handled by a `@catch` directive or by making a resolver null will have
 * `handled: true` and should not trigger a throw.
 */
export type RelayResolverErrorEvent = {
  readonly kind: 'relay_resolver.error',
  readonly owner: string,
  readonly fieldPath: string,
  readonly error: Error,
  readonly shouldThrow: boolean,
  readonly handled: boolean,
  // To populate this, you should pass the value to a ReactRelayLoggingContext
  readonly uiContext: unknown | void,
};

/**
 * A field being read by Relay was marked as being in an error state by the
 * GraphQL response.
 *
 * https://spec.graphql.org/October2021/#sec-Errors.Field-errors
 *
 * If the field's parent query/fragment/mutation was annotated with
 * `@throwOnFieldError` and no `@catch` directive was used to catch the error,
 * Relay will throw an error immediately after logging this event.
 *
 * https://relay.dev/docs/next/guides/catch-directive/
 * https://relay.dev/docs/next/guides/throw-on-field-error-directive/
 *
 * *NOTE*: Only throw on this event if `handled` is false. Errors that have been
 * handled by a `@catch` directive or by making a resolver null will have
 * `handled: true` and should not trigger a throw.
 */
export type RelayFieldPayloadErrorEvent = {
  readonly kind: 'relay_field_payload.error',
  readonly owner: string,
  readonly fieldPath: string,
  readonly error: TRelayFieldError,
  readonly shouldThrow: boolean,
  readonly handled: boolean,
  // To populate this, you should pass the value to a ReactRelayLoggingContext
  readonly uiContext: unknown | void,
};

/**
 * Union of all RelayFieldLoggerEvent types
 */
export type RelayFieldLoggerEvent =
  | MissingExpectedDataLogEvent
  | MissingExpectedDataThrowEvent
  | MissingRequiredFieldLogEvent
  | MissingRequiredFieldThrowEvent
  | RelayResolverErrorEvent
  | RelayFieldPayloadErrorEvent;

/**
 * A handler for events related to field errors.
 */
export type RelayFieldLogger = (event: RelayFieldLoggerEvent) => void;

/**
 * Exec-time server-to-client (S2C) work: build `selections`, resolvers and
 * client edges with a root fragment, beneath the record `recordID`.
 */
export type S2CExecution = {
  readonly recordID: DataID,
  readonly selections: ReadonlyArray<NormalizationSelection>,
  readonly typeName: string,
};

/**
 * The results of normalizing a query.
 */
export type RelayResponsePayload = {
  readonly errors: ?Array<PayloadError>,
  readonly fieldPayloads: ?Array<HandleFieldPayload>,
  readonly incrementalPlaceholders: ?Array<IncrementalDataPlaceholder>,
  readonly followupPayloads: ?Array<FollowupPayload>,
  readonly isFinal: boolean,
  readonly isPreNormalized?: boolean,
  readonly s2cExecutions?: ?ReadonlyArray<S2CExecution>,
  readonly source: MutableRecordSource,
  readonly storeUpdater?: ?(store: RecordSourceProxy) => void,
};

/**
 * Configuration on the executeMutation(...).
 */
export type ExecuteMutationConfig<TMutation extends MutationParameters> = {
  operation: OperationDescriptor,
  optimisticUpdater?: ?SelectorStoreUpdater<TMutation['response']>,
  optimisticResponse?: ?any,
  updater?: ?SelectorStoreUpdater<TMutation['response']>,
  uploadables?: ?UploadableMap,
};

/**
 * Public interface for Publish Queue.
 */
export interface PublishQueue {
  /**
   * Schedule applying an optimistic updates on the next `run()`.
   */
  applyUpdate<TMutation extends MutationParameters>(
    updater: OptimisticUpdate<TMutation>,
  ): void;

  /**
   * Schedule reverting an optimistic updates on the next `run()`.
   */
  revertUpdate<TMutation extends MutationParameters>(
    updater: OptimisticUpdate<TMutation>,
  ): void;

  /**
   * Schedule a revert of all optimistic updates on the next `run()`.
   */
  revertAll(): void;

  /**
   * Schedule applying a payload to the store on the next `run()`.
   */
  commitPayload<TMutation extends MutationParameters>(
    operation: OperationDescriptor,
    payload: RelayResponsePayload,
    updater?: ?SelectorStoreUpdater<TMutation['response']>,
  ): void;

  /**
   * Schedule an updater to mutate the store on the next `run()` typically to
   * update client schema fields.
   */
  commitUpdate(updater: StoreUpdater): void;

  /**
   * Schedule a publish to the store from the provided source on the next
   * `run()`. As an example, to update the store with substituted fields that
   * are missing in the store.
   */
  commitSource(source: RecordSource): void;

  /**
   * Publish a payload into the store replaying any pending optimistic updates
   * but without triggering a notification. Instead a continuation function is
   * returned which will trigger a notification if needed.
   *
   * **It is the responsibility of the caller to invoke the returned
   * continuation function before the next browser paint**.
   */
  publishWithDeferredNotify(
    operation: OperationDescriptor,
    payload: RelayResponsePayload,
  ): () => void;

  /**
   * Execute all queued up operations from the other public methods.
   * Optionally provide an OperationDescriptor indicating the source operation
   * that was being processed to produce this run.
   */
  run(sourceOperation?: OperationDescriptor): ReadonlyArray<RequestDescriptor>;
}

/**
 * The return type of a client edge resolver pointing to a concrete type.
 * T can be overridden to be more specific than a DataID, e.g. if the IDs
 * can only come from a given set.
 */
export type ConcreteClientEdgeResolverReturnType<T = any> = {
  readonly id: T & DataID,
};

/**
 * The return type of a Live Resolver. Models an external value which can
 * be read lazily and which might change over time. The subscribe method
 * returns a callback which should be called when the value _may_ have changed.
 *
 * While over-notification (subscription notifications when the read value has
 * not actually changed) is supported, for performance reasons, it is recommended
 * that the provider of the LiveState value confirms that the value has indeed
 * change before notifying Relay of the change.
 */
export type LiveState<out T> = {
  /**
   * Returns the current value of the live state.
   */
  read(): T,
  /**
   * Subscribes to changes in the live state. The state provider should
   * call the callback when the value of the live state changes.
   */
  subscribe(cb: () => void): () => void,
  /**
   * Optional. Called when Relay creates a suspense promise for this live
   * state, and used to name that promise. Called at promise-creation time, so
   * it can describe whatever is loading at that moment.
   *
   * Runs while a read is suspending, so it must be pure and cheap. The name
   * may be reported to profiling tools, so prefer a fixed label or a small
   * enum over anything request-specific. Return null when there is nothing
   * specific to say.
   */
  readonly getSuspenseDisplayName?: () => ?string,
};

/**
 * Context that will be provided to live resolvers if
 * `resolverContext` is set on the Relay Store.
 * This context will be passed as the third argument to the live resolver
 */
export type ResolverContext = unknown;
