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

import type {ActorIdentifier} from '../multi-actor-environment/ActorIdentifier';
import type {
  GraphQLResponse,
  GraphQLResponseWithData,
  GraphQLSingularResponse,
} from '../network/RelayNetworkTypes';
import type {Sink, Subscription} from '../network/RelayObservable';
import type {
  DeferPlaceholder,
  FollowupPayload,
  HandleFieldPayload,
  IncrementalDataPlaceholder,
  LogFunction,
  ModuleImportPayload,
  MutationParameters,
  OperationDescriptor,
  OperationLoader,
  OperationTracker,
  OptimisticResponseConfig,
  OptimisticUpdate,
  PublishQueue,
  Record,
  RelayResponsePayload,
  RequestDescriptor,
  SelectorStoreUpdater,
  Store,
  StreamPlaceholder,
  TaskPriority,
  TaskScheduler,
} from '../store/RelayStoreTypes';
import type {
  NormalizationDefer,
  NormalizationLinkedField,
  NormalizationOperation,
  NormalizationRootNode,
  NormalizationSelectableNode,
  NormalizationSelection,
  NormalizationSplitOperation,
} from '../util/NormalizationNode';
import type {NormalizationSelector} from './RelayStoreTypes';
import type {DataID, Disposable, Variables} from '../util/RelayRuntimeTypes';
import type {GetDataID} from './RelayResponseNormalizer';
import type {NormalizeResponseFunction} from './RelayStoreTypes';

const RelayObservable = require('../network/RelayObservable');
const generateID = require('../util/generateID');
const getOperation = require('../util/getOperation');
const RelayError = require('../util/RelayError');
const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const {stableCopy} = require('../util/stableCopy');
const withStartAndDuration = require('../util/withStartAndDuration');
const {generateClientID, generateUniqueClientID} = require('./ClientID');
const {getLocalVariables} = require('./RelayConcreteVariables');
const RelayModernRecord = require('./RelayModernRecord');
const {
  createNormalizationSelector,
  createReaderSelector,
} = require('./RelayModernSelector');
const RelayRecordSource = require('./RelayRecordSource');
const resolveDeferSubPathChunk = require('./resolveDeferSubPathChunk');
const {ROOT_TYPE, TYPENAME_KEY, getStorageKey} = require('./RelayStoreUtils');
const invariant = require('invariant');
const warning = require('warning');

// A network response OR a pre-normalized payload from the network layer.
// RelayObservable<+T> is covariant, so Observable<GraphQLResponse> is
// assignable to Observable<NetworkResponse> automatically.
type NetworkResponse = GraphQLResponse | RelayResponsePayload;

export type ExecuteConfig<TMutation extends MutationParameters> = {
  readonly actorIdentifier: ActorIdentifier,
  readonly getDataID: GetDataID,
  readonly getPublishQueue: (actorIdentifier: ActorIdentifier) => PublishQueue,
  readonly getStore: (actorIdentifier: ActorIdentifier) => Store,
  readonly normalizeResponse: NormalizeResponseFunction,
  readonly isClientPayload?: boolean,
  readonly operation: OperationDescriptor,
  readonly operationExecutions: Map<string, ActiveState>,
  readonly operationLoader: ?OperationLoader,
  readonly operationTracker: OperationTracker,
  readonly optimisticConfig: ?OptimisticResponseConfig<TMutation>,
  readonly scheduler?: ?TaskScheduler,
  readonly sink: Sink<GraphQLResponse>,
  readonly source: RelayObservable<NetworkResponse>,
  readonly treatMissingFieldsAsNull: boolean,
  readonly deferDeduplicatedFields: boolean,
  readonly updater?: ?SelectorStoreUpdater<TMutation['response']>,
  readonly log: LogFunction,
};

export type ActiveState = 'active' | 'inactive';

type Label = string;
type PathKey = string;
type IncrementalResults =
  | {
      readonly kind: 'placeholder',
      readonly placeholder: IncrementalDataPlaceholder,
    }
  | {
      readonly kind: 'response',
      readonly responses: Array<IncrementalGraphQLResponse>,
    };

type IncrementalGraphQLResponse = {
  label: string,
  path: ReadonlyArray<unknown>,
  response: GraphQLResponseWithData,
};

function execute<TMutation extends MutationParameters>(
  config: ExecuteConfig<TMutation>,
): Executor<TMutation> {
  return new Executor(config);
}

/**
 * Coordinates the execution of a query, handling network callbacks
 * including optimistic payloads, standard payloads, resolution of match
 * dependencies, etc.
 */
class Executor<TMutation extends MutationParameters> {
  _actorIdentifier: ActorIdentifier;
  _getDataID: GetDataID;
  _treatMissingFieldsAsNull: boolean;
  _deferDeduplicatedFields: boolean;
  _incrementalPayloadsPending: boolean;
  _incrementalResults: Map<Label, Map<PathKey, IncrementalResults>>;
  _log: LogFunction;
  _executeId: number;
  _nextSubscriptionId: number;
  _operation: OperationDescriptor;
  _operationExecutions: Map<string, ActiveState>;
  _operationLoader: ?OperationLoader;
  _operationTracker: OperationTracker;
  _operationUpdateEpochs: Map<string, number>;
  _optimisticUpdates: null | Array<OptimisticUpdate<TMutation>>;
  _useExecTimeResolvers: boolean;
  _pendingModulePayloadsCount: number;
  readonly _getPublishQueue: (actorIdentifier: ActorIdentifier) => PublishQueue;
  _scheduler: ?TaskScheduler;
  _sink: Sink<GraphQLResponse>;
  _source: Map<
    string,
    {
      readonly record: Record,
      readonly fieldPayloads: Array<HandleFieldPayload>,
    },
  >;
  _state: 'started' | 'loading_incremental' | 'loading_final' | 'completed';
  readonly _getStore: (actorIdentifier: ActorIdentifier) => Store;
  _subscriptions: Map<number, Subscription>;
  _updater: ?SelectorStoreUpdater<TMutation['response']>;
  _asyncStoreUpdateDisposable: ?Disposable;
  _completeFns: Array<() => void>;
  readonly _retainDisposables: Map<ActorIdentifier, Disposable>;
  readonly _isClientPayload: boolean;
  readonly _isSubscriptionOperation: boolean;
  readonly _seenActors: Set<ActorIdentifier>;
  _normalizeResponse: NormalizeResponseFunction;
  _execTimeResolverResponseComplete: boolean;
  _isClientQuery: boolean;

  constructor({
    actorIdentifier,
    getDataID,
    getPublishQueue,
    getStore,
    isClientPayload,
    operation,
    operationExecutions,
    operationLoader,
    operationTracker,
    optimisticConfig,
    scheduler,
    sink,
    source,
    treatMissingFieldsAsNull,
    deferDeduplicatedFields,
    updater,
    log,
    normalizeResponse,
  }: ExecuteConfig<TMutation>): void {
    this._actorIdentifier = actorIdentifier;
    this._getDataID = getDataID;
    this._treatMissingFieldsAsNull = treatMissingFieldsAsNull;
    this._deferDeduplicatedFields = deferDeduplicatedFields;
    this._incrementalPayloadsPending = false;
    this._incrementalResults = new Map();
    this._log = log;
    this._executeId = generateID();
    this._nextSubscriptionId = 0;
    this._operation = operation;
    this._operationExecutions = operationExecutions;
    this._operationLoader = operationLoader;
    this._operationTracker = operationTracker;
    this._operationUpdateEpochs = new Map();
    this._optimisticUpdates = null;
    this._useExecTimeResolvers =
      this._operation.request.node.operation.use_exec_time_resolvers ??
      this._operation.request.node.operation.exec_time_resolvers_enabled_provider?.get() ===
        true ??
      false;
    this._execTimeResolverResponseComplete = false;
    this._pendingModulePayloadsCount = 0;
    this._getPublishQueue = getPublishQueue;
    this._scheduler = scheduler;
    this._sink = sink;
    this._source = new Map();
    this._state = 'started';
    this._getStore = getStore;
    this._subscriptions = new Map();
    this._updater = updater;
    this._isClientPayload = isClientPayload === true;
    this._isSubscriptionOperation =
      this._operation.request.node.params.operationKind === 'subscription';
    this._retainDisposables = new Map();
    this._seenActors = new Set();
    this._completeFns = [];
    this._normalizeResponse = normalizeResponse;
    this._isClientQuery =
      this._operation.request.node.params.id == null &&
      this._operation.request.node.params.text == null;

    const id = this._nextSubscriptionId++;

    if (
      RelayFeatureFlags.PROCESS_OPTIMISTIC_UPDATE_BEFORE_SUBSCRIPTION &&
      optimisticConfig != null
    ) {
      this._processOptimisticResponse(
        optimisticConfig.response != null
          ? {data: optimisticConfig.response}
          : null,
        optimisticConfig.updater,
        false,
      );
    }
    source.subscribe({
      complete: () => this._complete(id),
      error: error => this._error(error),
      next: response => {
        try {
          this._next(id, response);
        } catch (error) {
          sink.error(error);
        }
      },
      start: subscription => {
        this._start(id, subscription);
        this._log({
          cacheConfig: this._operation.request.cacheConfig ?? {},
          executeId: this._executeId,
          name: 'execute.start',
          params: this._operation.request.node.params,
          variables: this._operation.request.variables,
        });
      },
      unsubscribe: () => {
        this._log({
          executeId: this._executeId,
          name: 'execute.unsubscribe',
        });
      },
    });

    if (
      !RelayFeatureFlags.PROCESS_OPTIMISTIC_UPDATE_BEFORE_SUBSCRIPTION &&
      optimisticConfig != null
    ) {
      this._processOptimisticResponse(
        optimisticConfig.response != null
          ? {data: optimisticConfig.response}
          : null,
        optimisticConfig.updater,
        false,
      );
    }
  }

  // Cancel any pending execution tasks and mark the executor as completed.
  cancel(): void {
    if (this._state === 'completed') {
      return;
    }
    this._state = 'completed';
    this._operationExecutions.delete(this._operation.request.identifier);

    if (this._subscriptions.size !== 0) {
      this._subscriptions.forEach(sub => sub.unsubscribe());
      this._subscriptions.clear();
    }
    const optimisticUpdates = this._optimisticUpdates;
    if (optimisticUpdates !== null) {
      this._optimisticUpdates = null;
      optimisticUpdates.forEach(update =>
        this._getPublishQueueAndSaveActor().revertUpdate(update),
      );
      // OK: run revert on cancel
      this._runPublishQueue();
    }
    this._incrementalResults.clear();
    if (this._asyncStoreUpdateDisposable != null) {
      this._asyncStoreUpdateDisposable.dispose();
      this._asyncStoreUpdateDisposable = null;
    }
    this._completeFns = [];
    this._completeOperationTracker();
    this._disposeRetainedData();
  }

  _updateActiveState(): void {
    let activeState: ActiveState;
    switch (this._state) {
      case 'started': {
        activeState = 'active';
        break;
      }
      case 'loading_incremental': {
        activeState = 'active';
        break;
      }
      case 'completed': {
        activeState = 'inactive';
        break;
      }
      case 'loading_final': {
        activeState =
          this._pendingModulePayloadsCount > 0 ||
          (this._useExecTimeResolvers &&
            !this._execTimeResolverResponseComplete)
            ? 'active'
            : 'inactive';
        break;
      }
      default:
        this._state as empty;
        invariant(false, 'OperationExecutor: invalid executor state.');
    }
    this._operationExecutions.set(
      this._operation.request.identifier,
      activeState,
    );
  }

  _schedule(task: () => void, priority: TaskPriority): void {
    const scheduler = this._scheduler;
    if (scheduler != null) {
      const id = this._nextSubscriptionId++;
      RelayObservable.create<empty>(sink => {
        const cancellationToken = scheduler.schedule(() => {
          try {
            task();
            sink.complete();
          } catch (error) {
            sink.error(error);
          }
        }, priority);
        return () => scheduler.cancel(cancellationToken);
      }).subscribe({
        complete: () => this._complete(id),
        error: error => this._error(error),
        start: subscription => this._start(id, subscription),
      });
    } else {
      task();
    }
  }

  _complete(id: number): void {
    this._subscriptions.delete(id);
    if (this._subscriptions.size === 0) {
      this.cancel();
      this._sink.complete();
      this._log({
        executeId: this._executeId,
        name: 'execute.complete',
      });
    }
  }

  _error(error: Error): void {
    this.cancel();
    this._sink.error(error);
    this._log({
      error,
      executeId: this._executeId,
      name: 'execute.error',
    });
  }

  _start(id: number, subscription: Subscription): void {
    this._subscriptions.set(id, subscription);
    this._updateActiveState();
  }

  // Handle a raw GraphQL response or a pre-normalized payload from the
  // network layer. Pre-normalized payloads bypass the normal GraphQL pipeline.
  _next(_id: number, response: NetworkResponse): void {
    const priority = this._state === 'loading_incremental' ? 'low' : 'default';
    this._schedule(() => {
      // Pre-normalized payloads from the network layer have isPreNormalized
      // set by NormalizationEngine. Route them to a dedicated handler that
      // commits directly to the store, bypassing normalizeResponse().
      if (
        !Array.isArray(response) &&
        // $FlowFixMe[prop-missing] isPreNormalized exists on RelayResponsePayload branch
        response.isPreNormalized === true
      ) {
        // $FlowFixMe[incompatible-type] narrowed by isPreNormalized check
        this._handlePreNormalizedPayload(response);
        return;
      }
      // After the pre-normalized early return, response is a standard
      // GraphQLResponse (Flow cannot narrow this automatically because
      // isPreNormalized is optional, so we cast once here at the boundary).
      // $FlowFixMe[incompatible-type] narrowed by isPreNormalized check above
      const graphQLResponse: GraphQLResponse = response;
      this._log({
        executeId: this._executeId,
        name: 'execute.next.start',
        operation: this._operation,
        response: graphQLResponse,
      });
      this._handleNext(graphQLResponse);
      this._maybeCompleteSubscriptionOperationTracking();
      this._log({
        executeId: this._executeId,
        name: 'execute.next.end',
        operation: this._operation,
        response: graphQLResponse,
      });
    }, priority);
  }

  _handleErrorResponse(
    responses: ReadonlyArray<GraphQLSingularResponse>,
  ): ReadonlyArray<GraphQLResponseWithData> {
    const results = [];
    responses.forEach(response => {
      if (
        response.data === null &&
        response.extensions != null &&
        !response.hasOwnProperty('errors')
      ) {
        // Skip extensions-only payloads
        return;
      } else if (response.data == null) {
        // Error if any other payload in the batch is missing data, regardless of whether
        // it had `errors` or not.
        const errors =
          response.hasOwnProperty('errors') && response.errors != null
            ? response.errors
            : null;
        const messages = errors
          ? errors.map(({message}) => message).join('\n')
          : '(No errors)';
        const error = RelayError.create(
          'RelayNetwork',
          'No data returned for operation `' +
            this._operation.request.node.params.name +
            '`, got error(s):\n' +
            messages +
            '\n\nSee the error `source` property for more information.',
        );
        (error as $FlowFixMe).source = {
          errors,
          operation: this._operation.request.node,
          variables: this._operation.request.variables,
        };
        // In V8, Error objects keep the closure scope chain alive until the
        // err.stack property is accessed.
        error.stack;
        throw error;
      } else {
        const responseWithData: GraphQLResponseWithData =
          response as $FlowFixMe;
        results.push(responseWithData);
      }
    });
    return results;
  }

  /**
   * This method return boolean to indicate if the optimistic
   * response has been handled
   */
  _handleOptimisticResponses(
    responses: ReadonlyArray<GraphQLResponseWithData>,
  ): boolean {
    if (responses.length > 1) {
      if (
        responses.some(
          responsePart => responsePart.extensions?.isOptimistic === true,
        )
      ) {
        invariant(
          false,
          'OperationExecutor: Optimistic responses cannot be batched.',
        );
      }
      return false;
    }
    const response = responses[0];
    const isOptimistic = response.extensions?.isOptimistic === true;
    if (isOptimistic && this._state !== 'started') {
      invariant(
        false,
        'OperationExecutor: optimistic payload received after server payload.',
      );
    }
    if (isOptimistic) {
      this._processOptimisticResponse(
        response,
        null,
        this._treatMissingFieldsAsNull,
      );
      this._sink.next(response);
      return true;
    }
    return false;
  }

  _handlePreNormalizedPayload(payload: RelayResponsePayload): void {
    // NOTE: This path intentionally skips _maybeCompleteSubscriptionOperationTracking
    // and the execute.next.start/end log events. Pre-normalized payloads come from
    // the network-normalization path (NormalizationEngine via executeWithNetwork),
    // which is used only for live exec-time-resolver queries. Those queries never
    // complete from the consumer's perspective — exec-time resolvers re-emit on
    // updates indefinitely — so completion tracking would never fire and is not
    // needed.
    if (this._state === 'completed') {
      return;
    }
    this._seenActors.clear();
    if (this._optimisticUpdates !== null) {
      this._optimisticUpdates.forEach(update =>
        this._getPublishQueueAndSaveActor().revertUpdate(update),
      );
      this._optimisticUpdates = null;
    }
    this._getPublishQueueAndSaveActor().commitPayload(
      this._operation,
      payload,
      payload.storeUpdater ?? this._updater,
    );
    if (payload.isFinal) {
      this._state = 'loading_final';
    } else if (this._state === 'started') {
      this._state = 'loading_incremental';
    }
    // Both reads are confined to this method on purpose. Detecting the
    // transition inside `_updateActiveState` would be tidier, but that runs on
    // every payload of every operation in the app, and only this path — which
    // no non-exec-time query can reach — needs the answer. Keep it free for
    // everyone else.
    const identifier = this._operation.request.identifier;
    const wasActive = this._operationExecutions.get(identifier) === 'active';
    const updatedOwners = this._runPublishQueue(this._operation);
    this._updateActiveState();
    this._updateOperationTracker(updatedOwners);
    // Announce the end of the request on the operation sink.
    //
    // `commitPayload` + `_runPublishQueue` above reach consumers that are
    // already mounted and subscribed to the store. A consumer *suspended* on
    // this operation is not one of them: it is parked on
    // `getPromiseForActiveRequest`, which re-reads `isRequestActive` only when
    // a response lands on the sink. Ending the request without emitting leaves
    // that consumer waiting on a state change it can never observe.
    //
    // The payload carries no data — `commitPayload` already normalized it into
    // the store — so this is a liveness signal, not a second delivery.
    if (wasActive && this._operationExecutions.get(identifier) === 'inactive') {
      this._sink.next({data: null, extensions: {is_final: true}});
    }
  }

  _handleNext(response: GraphQLResponse): void {
    if (this._state === 'completed') {
      return;
    }
    this._seenActors.clear();

    const responses = Array.isArray(response) ? response : [response];
    const responsesWithData = this._handleErrorResponse(responses);

    if (responsesWithData.length === 0) {
      // no results with data, nothing to process
      // this can occur with extensions-only payloads, or exec time resolver
      // responses
      const isFinal = responses.some(x => x.extensions?.is_final === true);
      if (isFinal) {
        if (
          this._useExecTimeResolvers &&
          this._state !== 'loading_final' &&
          responses.some(x => x.extensions?.is_normalized === true)
        ) {
          // An exec time resolver query can flush an empty response, if the
          // same response has been included in other queries. Check if we need
          // to mark the request as final
          this._execTimeResolverResponseComplete = true;
          if (
            !this._isClientQuery &&
            responses.some(x => x.extensions?.is_client_only === true)
          ) {
            this._isClientQuery = true;
          }
          // Need to update the active state to mark the query as inactive,
          // incase server payloads have completed
          if (this._isClientQuery) {
            // If it is a client query, there is no server response to set the
            // final state, so we need to set it here
            this._state = 'loading_final';
          }
          this._updateActiveState();
        } else {
          this._state = 'loading_final';
          this._updateActiveState();
          this._incrementalPayloadsPending = false;
        }
      }
      this._sink.next(response);
      return;
    }

    // Next, handle optimistic responses
    const isOptimistic = this._handleOptimisticResponses(responsesWithData);
    if (isOptimistic) {
      return;
    }

    const [nonIncrementalResponses, incrementalResponses, normalizedResponses] =
      partitionGraphQLResponses(responsesWithData);
    const hasNonIncrementalResponses = nonIncrementalResponses.length > 0;
    const hasNormalizedResponses = normalizedResponses.length > 0;

    // In theory this doesn't preserve the ordering of the batch.
    // The idea is that a batch is always:
    //  * at most one non-incremental payload
    //  * followed by zero or more incremental payloads
    // The non-incremental payload can appear if the server sends a batch
    // with the initial payload followed by some early-to-resolve incremental
    // payloads (although, can that even happen?)
    if (hasNonIncrementalResponses) {
      // For subscriptions, to avoid every new payload from overwriting existing
      // data from previous payloads, assign a unique rootID for every new
      // non-incremental payload.
      if (this._isSubscriptionOperation) {
        const nextID = generateUniqueClientID();
        this._operation = {
          fragment: createReaderSelector(
            this._operation.fragment.node,
            nextID,
            this._operation.fragment.variables,
            this._operation.fragment.owner,
          ),
          request: this._operation.request,
          root: createNormalizationSelector(
            this._operation.root.node,
            nextID,
            this._operation.root.variables,
          ),
        };
      }

      const payloadFollowups = this._processResponses(nonIncrementalResponses);
      this._processPayloadFollowups(payloadFollowups);
    }

    if (hasNormalizedResponses) {
      const payloadFollowups = [];
      for (let i = 0; i < normalizedResponses.length; i++) {
        const response = normalizedResponses[i];
        const source = new RelayRecordSource(response.data as $FlowFixMe);
        const isFinal = response.extensions?.is_final === true;
        if (response.extensions?.is_client_only === true) {
          // For a mixed server and client query, if the network request is
          // skipped, need to treat it as a client query
          this._isClientQuery = true;
        }
        const payload: RelayResponsePayload = {
          errors: [],
          fieldPayloads: [],
          followupPayloads: [],
          incrementalPlaceholders: [],
          isFinal,
          source,
        };
        this._getPublishQueueAndSaveActor().commitPayload(
          this._operation,
          payload,
          this._updater,
        );
        payloadFollowups.push(payload);
        this._execTimeResolverResponseComplete = isFinal;
        if (isFinal && this._isClientQuery) {
          // If it is a client query, there is no server response to set the
          // final state, so we need to set it here
          this._state = 'loading_final';
        }
      }
      // Refresh the request-active cache after each batch of normalized
      // payloads. Without this, when an @exec_time_resolvers query has
      // already settled (is_final: true) and a @live resolver later
      // re-publishes with is_final: false, _execTimeResolverResponseComplete
      // flips back to false but _operationExecutions stays stuck on
      // 'inactive' → isRequestActive returns false → late-mount useFragment
      // with @throwOnFieldError throws on transiently-missing fields.
      //
      // One call per batch (rather than per iteration) is sufficient because
      // _state and _execTimeResolverResponseComplete are last-write-wins
      // across iterations, commitPayload only queues to the publish queue,
      // and no consumer reads the cache between iterations.
      this._updateActiveState();
    }

    if (incrementalResponses.length > 0) {
      const payloadFollowups =
        this._processIncrementalResponses(incrementalResponses);

      this._processPayloadFollowups(payloadFollowups);
    }
    if (this._isSubscriptionOperation) {
      // We attach the id to allow the `requestSubscription` to read from the store using
      // the current id in its `onNext` callback
      if (responsesWithData[0].extensions == null) {
        // $FlowFixMe[cannot-write]
        responsesWithData[0].extensions = {
          __relay_subscription_root_id: this._operation.fragment.dataID,
        };
      } else {
        responsesWithData[0].extensions.__relay_subscription_root_id =
          this._operation.fragment.dataID;
      }
    }

    // OK: run once after each new payload
    // If we have non-incremental responses, we passing `this._operation` to
    // the publish queue here, which will later be passed to the store (via
    // notify) to indicate that this operation caused the store to update
    const updatedOwners = this._runPublishQueue(
      hasNonIncrementalResponses || hasNormalizedResponses
        ? this._operation
        : undefined,
    );

    if (hasNonIncrementalResponses) {
      if (this._incrementalPayloadsPending) {
        this._retainData();
      }
    }
    this._updateOperationTracker(updatedOwners);
    this._sink.next(response);
  }

  _processOptimisticResponse(
    response: ?GraphQLResponseWithData,
    updater: ?SelectorStoreUpdater<TMutation['response']>,
    treatMissingFieldsAsNull: boolean,
  ): void {
    invariant(
      this._optimisticUpdates === null,
      'OperationExecutor: environment.execute: only support one optimistic response per ' +
        'execute.',
    );
    if (response == null && updater == null) {
      return;
    }
    const optimisticUpdates: Array<OptimisticUpdate<TMutation>> = [];
    if (response) {
      const payload = this._normalizeResponse(
        response,
        this._operation.root,
        ROOT_TYPE,
        {
          actorIdentifier: this._actorIdentifier,
          deferDeduplicatedFields: false,
          getDataID: this._getDataID,
          log: this._log,
          path: [],
          treatMissingFieldsAsNull,
        },
        this._useExecTimeResolvers,
      );
      validateOptimisticResponsePayload(payload);
      optimisticUpdates.push({
        operation: this._operation,
        payload,
        updater,
      });
      this._processOptimisticFollowups(payload, optimisticUpdates);
    } else if (updater) {
      optimisticUpdates.push({
        operation: this._operation,
        payload: {
          errors: null,
          fieldPayloads: null,
          followupPayloads: null,
          incrementalPlaceholders: null,
          isFinal: false,
          source: RelayRecordSource.create(),
        },
        updater,
      });
    }
    this._optimisticUpdates = optimisticUpdates;
    optimisticUpdates.forEach(update =>
      this._getPublishQueueAndSaveActor().applyUpdate(update),
    );
    // OK: only called on construction and when receiving an optimistic payload from network,
    // which doesn't fall-through to the regular next() handling
    const updatedOwners = this._runPublishQueue();
    if (RelayFeatureFlags.ENABLE_OPERATION_TRACKER_OPTIMISTIC_UPDATES) {
      this._updateOperationTracker(updatedOwners);
    }
  }

  _processOptimisticFollowups(
    payload: RelayResponsePayload,
    optimisticUpdates: Array<OptimisticUpdate<TMutation>>,
  ): void {
    if (payload.followupPayloads && payload.followupPayloads.length) {
      const followupPayloads = payload.followupPayloads;
      for (const followupPayload of followupPayloads) {
        switch (followupPayload.kind) {
          case 'ModuleImportPayload':
            const operationLoader = this._expectOperationLoader();
            const operation = operationLoader.get(
              followupPayload.operationReference,
            );
            if (operation == null) {
              this._processAsyncOptimisticModuleImport(followupPayload);
            } else {
              const moduleImportOptimisticUpdates =
                this._processOptimisticModuleImport(operation, followupPayload);
              optimisticUpdates.push(...moduleImportOptimisticUpdates);
            }
            break;
          case 'ActorPayload':
            warning(
              false,
              'OperationExecutor: Unexpected optimistic ActorPayload. These updates are not supported.',
            );
            break;
          default:
            followupPayload as empty;
            invariant(
              false,
              'OperationExecutor: Unexpected followup kind `%s`. when processing optimistic updates.',
              followupPayload.kind,
            );
        }
      }
    }
  }

  /**
   * Normalize Data for @module payload, and actor-specific payload
   */
  _normalizeFollowupPayload(
    followupPayload: FollowupPayload,
    normalizationNode: NormalizationSelectableNode,
  ): RelayResponsePayload {
    let variables;
    if (
      normalizationNode.kind === 'SplitOperation' &&
      followupPayload.kind === 'ModuleImportPayload'
    ) {
      variables = getLocalVariables(
        followupPayload.variables,
        normalizationNode.argumentDefinitions,
        followupPayload.args,
      );
    } else {
      variables = followupPayload.variables;
    }
    const selector = createNormalizationSelector(
      normalizationNode,
      followupPayload.dataID,
      variables,
    );
    const nextResponse: GraphQLResponseWithData = {
      data: followupPayload.data,
      // `is_final` flag needs to be set for processing nested defer and 3D
      // when the server doesn't support streaming
      extensions:
        this._state === 'loading_final' ? {is_final: true} : undefined,
    };
    return this._normalizeResponse(
      nextResponse,
      selector,
      followupPayload.typeName,
      {
        actorIdentifier: this._actorIdentifier,
        deferDeduplicatedFields: false,
        getDataID: this._getDataID,
        log: this._log,
        path: followupPayload.path,
        treatMissingFieldsAsNull: this._treatMissingFieldsAsNull,
      },
      this._useExecTimeResolvers,
    );
  }

  _processOptimisticModuleImport(
    normalizationRootNode: NormalizationRootNode,
    moduleImportPayload: ModuleImportPayload,
  ): ReadonlyArray<OptimisticUpdate<TMutation>> {
    const operation = getOperation(normalizationRootNode);
    const optimisticUpdates: Array<OptimisticUpdate<TMutation>> = [];
    const modulePayload = this._normalizeFollowupPayload(
      moduleImportPayload,
      operation,
    );
    validateOptimisticResponsePayload(modulePayload);
    optimisticUpdates.push({
      operation: this._operation,
      payload: modulePayload,
      updater: null,
    });
    this._processOptimisticFollowups(modulePayload, optimisticUpdates);
    return optimisticUpdates;
  }

  _processAsyncOptimisticModuleImport(
    moduleImportPayload: ModuleImportPayload,
  ): void {
    // $FlowFixMe[unused-promise]
    this._expectOperationLoader()
      .load(moduleImportPayload.operationReference)
      .then(operation => {
        if (operation == null || this._state !== 'started') {
          return;
        }
        const moduleImportOptimisticUpdates =
          this._processOptimisticModuleImport(operation, moduleImportPayload);
        moduleImportOptimisticUpdates.forEach(update =>
          this._getPublishQueueAndSaveActor().applyUpdate(update),
        );
        if (this._optimisticUpdates == null) {
          warning(
            false,
            'OperationExecutor: Unexpected ModuleImport optimistic ' +
              'update in operation %s.' +
              this._operation.request.node.params.name,
          );
        } else {
          this._optimisticUpdates.push(...moduleImportOptimisticUpdates);
          // OK: always have to run() after an module import resolves async
          this._runPublishQueue();
        }
      });
  }

  _processResponses(
    responses: ReadonlyArray<GraphQLResponseWithData>,
  ): ReadonlyArray<RelayResponsePayload> {
    this._log({
      name: 'execute.normalize.start',
      operation: this._operation,
    });
    if (this._optimisticUpdates !== null) {
      this._optimisticUpdates.forEach(update => {
        this._getPublishQueueAndSaveActor().revertUpdate(update);
      });
      this._optimisticUpdates = null;
    }

    this._incrementalPayloadsPending = false;
    this._incrementalResults.clear();
    this._source.clear();
    return responses.map(payloadPart => {
      const relayPayload = this._normalizeResponse(
        payloadPart,
        this._operation.root,
        ROOT_TYPE,
        {
          actorIdentifier: this._actorIdentifier,
          deferDeduplicatedFields: false,
          getDataID: this._getDataID,
          log: this._log,
          path: [],
          treatMissingFieldsAsNull: this._treatMissingFieldsAsNull,
        },
        this._useExecTimeResolvers,
      );
      this._getPublishQueueAndSaveActor().commitPayload(
        this._operation,
        relayPayload,
        this._updater,
      );
      this._log({
        name: 'execute.normalize.end',
        operation: this._operation,
      });
      return relayPayload;
    });
  }

  /**
   * Handles any follow-up actions for a Relay payload for @match, @defer,
   * and @stream directives.
   */
  _processPayloadFollowups(
    payloads: ReadonlyArray<RelayResponsePayload>,
  ): void {
    if (this._state === 'completed') {
      return;
    }
    payloads.forEach(payload => {
      const {incrementalPlaceholders, followupPayloads, isFinal} = payload;
      this._state = isFinal ? 'loading_final' : 'loading_incremental';
      this._updateActiveState();
      if (isFinal) {
        this._incrementalPayloadsPending = false;
      }
      if (followupPayloads && followupPayloads.length !== 0) {
        followupPayloads.forEach(followupPayload => {
          const prevActorIdentifier = this._actorIdentifier;
          this._actorIdentifier =
            followupPayload.actorIdentifier ?? this._actorIdentifier;
          this._processFollowupPayload(followupPayload);
          this._actorIdentifier = prevActorIdentifier;
        });
      }

      if (incrementalPlaceholders && incrementalPlaceholders.length !== 0) {
        this._incrementalPayloadsPending = this._state !== 'loading_final';
        incrementalPlaceholders.forEach(incrementalPlaceholder => {
          const prevActorIdentifier = this._actorIdentifier;
          this._actorIdentifier =
            incrementalPlaceholder.actorIdentifier ?? this._actorIdentifier;
          this._processIncrementalPlaceholder(payload, incrementalPlaceholder);
          this._actorIdentifier = prevActorIdentifier;
        });

        if (this._isClientPayload || this._state === 'loading_final') {
          // The query has defer/stream selections that are enabled, but either
          // the server indicated that this is a "final" payload: no incremental
          // payloads will be delivered, then warn that the query was (likely)
          // executed on the server in non-streaming mode, with incremental
          // delivery disabled; or this is a client payload, and there will be
          // no incremental payload.
          warning(
            this._isClientPayload,
            'RelayModernEnvironment: Operation `%s` contains @defer/@stream ' +
              'directives but was executed in non-streaming mode. See ' +
              'https://fburl.com/relay-incremental-delivery-non-streaming-warning.',
            this._operation.request.node.params.name,
          );
          // But eagerly process any deferred payloads
          const relayPayloads = [];
          incrementalPlaceholders.forEach(placeholder => {
            if (placeholder.kind === 'defer') {
              relayPayloads.push(
                this._processDeferResponse(
                  placeholder.label,
                  placeholder.path,
                  placeholder,
                  // `is_final` flag needs to be set for processing nested defer payloads
                  {data: placeholder.data, extensions: {is_final: true}},
                ),
              );
            }
          });
          if (relayPayloads.length > 0) {
            this._processPayloadFollowups(relayPayloads);
          }
        }
      }
    });
  }

  _maybeCompleteSubscriptionOperationTracking() {
    if (
      !this._isSubscriptionOperation &&
      !(
        this._useExecTimeResolvers &&
        this._execTimeResolverResponseComplete &&
        this._state === 'loading_final'
      )
    ) {
      return;
    }
    if (
      this._pendingModulePayloadsCount === 0 &&
      this._incrementalPayloadsPending === false
    ) {
      this._completeOperationTracker();
    }
  }

  /**
   * Processes a ModuleImportPayload, asynchronously resolving the normalization
   * AST and using it to normalize the field data into a RelayResponsePayload.
   * The resulting payload may contain other incremental payloads (match,
   * defer, stream, etc); these are handled by calling
   * `_processPayloadFollowups()`.
   */
  _processFollowupPayload(followupPayload: FollowupPayload): void {
    switch (followupPayload.kind) {
      case 'ModuleImportPayload':
        const operationLoader = this._expectOperationLoader();
        const node = operationLoader.get(followupPayload.operationReference);
        if (node != null) {
          // If the operation module is available synchronously, normalize the
          // data synchronously.
          this._processFollowupPayloadWithNormalizationNode(
            followupPayload,
            getOperation(node),
          );
        } else {
          // Otherwise load the operation module and schedule a task to normalize
          // the data when the module is available.
          const id = this._nextSubscriptionId++;
          this._pendingModulePayloadsCount++;

          const decrementPendingCount = () => {
            this._pendingModulePayloadsCount--;
            this._maybeCompleteSubscriptionOperationTracking();
          };

          // Observable.from(operationLoader.load()) wouldn't catch synchronous
          // errors thrown by the load function, which is user-defined. Guard
          // against that with Observable.from(new Promise(<work>)).
          const networkObservable =
            RelayObservable.from<?NormalizationRootNode>(
              new Promise<?NormalizationRootNode>((resolve, reject) => {
                operationLoader
                  .load(followupPayload.operationReference)
                  .then(resolve, reject);
              }),
            );
          RelayObservable.create<empty>(sink => {
            let cancellationToken;
            const subscription = networkObservable.subscribe({
              error: sink.error,
              next: (loadedNode: ?NormalizationRootNode) => {
                if (loadedNode != null) {
                  const publishModuleImportPayload = () => {
                    try {
                      const operation = getOperation(loadedNode);
                      const batchAsyncModuleUpdatesFN =
                        RelayFeatureFlags.BATCH_ASYNC_MODULE_UPDATES_FN;
                      const shouldScheduleAsyncStoreUpdate =
                        batchAsyncModuleUpdatesFN != null &&
                        this._pendingModulePayloadsCount > 1;
                      const [_, duration] = withStartAndDuration(() => {
                        this._handleFollowupPayload(followupPayload, operation);
                        // OK: always have to run after an async module import resolves
                        if (shouldScheduleAsyncStoreUpdate) {
                          this._scheduleAsyncStoreUpdate(
                            // $FlowFixMe[incompatible-type] `shouldScheduleAsyncStoreUpdate` check should cover `null` case
                            batchAsyncModuleUpdatesFN,
                            sink.complete,
                          );
                        } else {
                          const updatedOwners = this._runPublishQueue();
                          this._updateOperationTracker(updatedOwners);
                        }
                      });
                      this._log({
                        duration,
                        executeId: this._executeId,
                        name: 'execute.async.module',
                        operationName: operation.name,
                      });
                      if (!shouldScheduleAsyncStoreUpdate) {
                        sink.complete();
                      }
                    } catch (error) {
                      sink.error(error);
                    }
                  };
                  const scheduler = this._scheduler;
                  if (scheduler == null) {
                    publishModuleImportPayload();
                  } else {
                    cancellationToken = scheduler.schedule(
                      publishModuleImportPayload,
                    );
                  }
                } else {
                  sink.complete();
                }
              },
            });
            return () => {
              subscription.unsubscribe();
              if (this._scheduler != null && cancellationToken != null) {
                this._scheduler.cancel(cancellationToken);
              }
            };
          }).subscribe({
            complete: () => {
              this._complete(id);
              decrementPendingCount();
            },
            error: error => {
              this._error(error);
              decrementPendingCount();
            },
            start: subscription => this._start(id, subscription),
          });
        }
        break;
      case 'ActorPayload':
        this._processFollowupPayloadWithNormalizationNode(
          followupPayload,
          followupPayload.node,
        );
        break;
      default:
        followupPayload as empty;
        invariant(
          false,
          'OperationExecutor: Unexpected followup kind `%s`.',
          followupPayload.kind,
        );
    }
  }

  _processFollowupPayloadWithNormalizationNode(
    followupPayload: FollowupPayload,
    normalizationNode:
      | NormalizationSplitOperation
      | NormalizationOperation
      | NormalizationLinkedField,
  ) {
    this._handleFollowupPayload(followupPayload, normalizationNode);
    this._maybeCompleteSubscriptionOperationTracking();
  }

  _handleFollowupPayload(
    followupPayload: FollowupPayload,
    normalizationNode:
      | NormalizationSplitOperation
      | NormalizationOperation
      | NormalizationLinkedField,
  ): void {
    const relayPayload = this._normalizeFollowupPayload(
      followupPayload,
      normalizationNode,
    );
    this._getPublishQueueAndSaveActor().commitPayload(
      this._operation,
      relayPayload,
    );
    this._processPayloadFollowups([relayPayload]);
  }

  /**
   * The executor now knows that GraphQL responses are expected for a given
   * label/path:
   * - Store the placeholder in order to process any future responses that may
   *   arrive.
   * - Then process any responses that had already arrived.
   *
   * The placeholder contains the normalization selector, path (for nested
   * defer/stream), and other metadata used to normalize the incremental
   * response(s).
   */
  _processIncrementalPlaceholder(
    relayPayload: RelayResponsePayload,
    placeholder: IncrementalDataPlaceholder,
  ): void {
    // Update the label => path => placeholder map
    const {label, path} = placeholder;
    const pathKey = path.map(String).join('.');
    let resultForLabel = this._incrementalResults.get(label);
    if (resultForLabel == null) {
      resultForLabel = new Map();
      this._incrementalResults.set(label, resultForLabel);
    }
    const resultForPath = resultForLabel.get(pathKey);
    const pendingResponses =
      resultForPath != null && resultForPath.kind === 'response'
        ? resultForPath.responses
        : null;
    resultForLabel.set(pathKey, {kind: 'placeholder', placeholder});

    // If the parent has no data of its own (only inner @defers), the
    // server never emits a parent chunk — register inner placeholders
    // here so their chunks find a home.
    if (placeholder.kind === 'defer') {
      this._registerInnerDeferPlaceholders(placeholder);
    }

    // Store references to the parent node to allow detecting concurrent
    // modifications to the parent before items arrive and to replay
    // handle field payloads to account for new information on source records.
    let parentID;
    if (placeholder.kind === 'stream') {
      parentID = placeholder.parentID;
    } else if (placeholder.kind === 'defer') {
      parentID = placeholder.selector.dataID;
    } else {
      placeholder as empty;
      invariant(
        false,
        'OperationExecutor: Unsupported incremental placeholder kind `%s`.',
        placeholder.kind,
      );
    }
    const parentRecord = relayPayload.source.get(parentID);
    const parentPayloads = (relayPayload.fieldPayloads ?? []).filter(
      fieldPayload => {
        const fieldID = generateClientID(
          fieldPayload.dataID,
          fieldPayload.fieldKey,
        );
        return (
          // handlers applied to the streamed field itself
          fieldPayload.dataID === parentID ||
          // handlers applied to a field on an ancestor object, where
          // ancestor.field links to the parent record (example: connections)
          fieldID === parentID
        );
      },
    );
    // If an incremental payload exists for some id that record should also
    // exist.
    invariant(
      parentRecord != null,
      'OperationExecutor: Expected record `%s` to exist.',
      parentID,
    );
    let nextParentRecord;
    let nextParentPayloads;
    const previousParentEntry = this._source.get(parentID);
    if (previousParentEntry != null) {
      // If a previous entry exists, merge the previous/next records and
      // payloads together.
      nextParentRecord = RelayModernRecord.update(
        previousParentEntry.record,
        parentRecord,
      );
      const handlePayloads = new Map<string, HandleFieldPayload>();
      const dedupePayload = (payload: HandleFieldPayload) => {
        const key = stableStringify(payload);
        handlePayloads.set(key, payload);
      };
      previousParentEntry.fieldPayloads.forEach(dedupePayload);
      parentPayloads.forEach(dedupePayload);
      nextParentPayloads = Array.from(handlePayloads.values());
    } else {
      nextParentRecord = parentRecord;
      nextParentPayloads = parentPayloads;
    }
    this._source.set(parentID, {
      fieldPayloads: nextParentPayloads,
      record: nextParentRecord,
    });

    // If there were any queued responses, process them now that placeholders
    // are in place
    if (pendingResponses != null) {
      const payloadFollowups =
        this._processIncrementalResponses(pendingResponses);
      this._processPayloadFollowups(payloadFollowups);
    }
  }

  /**
   * Lookup the placeholder the describes how to process an incremental
   * response, normalize/publish it, and process any nested defer/match/stream
   * metadata.
   */
  _processIncrementalResponses(
    incrementalResponses: ReadonlyArray<IncrementalGraphQLResponse>,
  ): ReadonlyArray<RelayResponsePayload> {
    const relayPayloads = [];
    incrementalResponses.forEach(incrementalResponse => {
      const {label, path, response} = incrementalResponse;
      let resultForLabel = this._incrementalResults.get(label);
      if (resultForLabel == null) {
        resultForLabel = new Map();
        this._incrementalResults.set(label, resultForLabel);
      }

      if (label.indexOf('$defer$') !== -1) {
        const pathKey = path.map(String).join('.');
        let resultForPath = resultForLabel.get(pathKey);
        let deferSubPath: ?ReadonlyArray<unknown> = null;
        if (resultForPath == null || resultForPath.kind !== 'placeholder') {
          const prefix = findDeferPlaceholderByPrefix(resultForLabel, path);
          if (prefix != null) {
            resultForPath = prefix.placeholder;
            deferSubPath = prefix.subPath;
          }
        }
        if (resultForPath == null) {
          resultForPath = {kind: 'response', responses: [incrementalResponse]};
          resultForLabel.set(pathKey, resultForPath);
          return;
        } else if (resultForPath.kind === 'response') {
          resultForPath.responses.push(incrementalResponse);
          return;
        }
        const placeholder = resultForPath.placeholder;
        invariant(
          placeholder.kind === 'defer',
          'OperationExecutor: Expected data for path `%s` for label `%s` ' +
            'to be data for @defer, was `@%s`.',
          pathKey,
          label,
          placeholder.kind,
        );
        this._registerInnerDeferPlaceholders(placeholder);
        relayPayloads.push(
          this._processDeferResponse(
            label,
            path,
            placeholder,
            response,
            deferSubPath,
          ),
        );
      } else {
        // @stream payload path values end in the field name and item index,
        // but Relay records paths relative to the parent of the stream node:
        // therefore we strip the last two elements just to lookup the path
        // (the item index is used later to insert the element in the list)
        const pathKey = path.slice(0, -2).map(String).join('.');
        let resultForPath = resultForLabel.get(pathKey);
        if (resultForPath == null) {
          resultForPath = {kind: 'response', responses: [incrementalResponse]};
          resultForLabel.set(pathKey, resultForPath);
          return;
        } else if (resultForPath.kind === 'response') {
          resultForPath.responses.push(incrementalResponse);
          return;
        }
        const placeholder = resultForPath.placeholder;
        invariant(
          placeholder.kind === 'stream',
          'OperationExecutor: Expected data for path `%s` for label `%s` ' +
            'to be data for @stream, was `@%s`.',
          pathKey,
          label,
          placeholder.kind,
        );
        relayPayloads.push(
          this._processStreamResponse(label, path, placeholder, response),
        );
      }
    });
    return relayPayloads;
  }

  /**
   * Register placeholders for any top-level Defer selections inside a parent
   * defer's fragment. Called from two sites so both failure modes are covered:
   *   - `_processIncrementalPlaceholder`, when the parent placeholder is
   *     created from the initial payload — needed if the parent has no data
   *     of its own (only inner @defers), because in that case the server
   *     never emits a chunk for the parent label.
   *   - `_processIncrementalResponses`, when a chunk arrives that matches
   *     the parent placeholder — needed when the parent streams as sub-path
   *     chunks only (per-item, single sub-record), so the fragment root is
   *     never normalized and inner @defer AST nodes are never encountered.
   * Without either registration, inner chunks arrive with an unregistered
   * label and get silently queued forever. Idempotent, recurses so multiple
   * levels of nesting are handled, and drains any responses that queued
   * before the placeholder existed.
   */
  _registerInnerDeferPlaceholders(parentPlaceholder: DeferPlaceholder): void {
    const parentPathKey = parentPlaceholder.path.map(String).join('.');
    forEachInnerDefer(parentPlaceholder.selector, defer => {
      let resultForLabel = this._incrementalResults.get(defer.label);
      if (resultForLabel == null) {
        resultForLabel = new Map();
        this._incrementalResults.set(defer.label, resultForLabel);
      }
      const existing = resultForLabel.get(parentPathKey);
      if (existing != null && existing.kind === 'placeholder') {
        return;
      }
      const innerPlaceholder = buildInnerDeferPlaceholder(
        parentPlaceholder,
        defer,
      );
      resultForLabel.set(parentPathKey, {
        kind: 'placeholder',
        placeholder: innerPlaceholder,
      });
      this._registerInnerDeferPlaceholders(innerPlaceholder);
      if (existing != null && existing.kind === 'response') {
        const payloadFollowups = this._processIncrementalResponses(
          existing.responses,
        );
        this._processPayloadFollowups(payloadFollowups);
      }
    });
  }

  _processDeferResponse(
    label: string,
    path: ReadonlyArray<unknown>,
    placeholder: DeferPlaceholder,
    response: GraphQLResponseWithData,
    subPath?: ?ReadonlyArray<unknown>,
  ): RelayResponsePayload {
    const {dataID: parentID} = placeholder.selector;
    const prevActorIdentifier = this._actorIdentifier;
    this._actorIdentifier =
      placeholder.actorIdentifier ?? this._actorIdentifier;
    const activeSubPath =
      subPath != null && subPath.length > 0 ? subPath : null;
    const recovery =
      activeSubPath != null
        ? resolveDeferSubPathChunk(
            placeholder,
            response,
            activeSubPath,
            this._getStore(this._actorIdentifier).getSource(),
          )
        : null;
    if (activeSubPath != null && recovery == null) {
      this._actorIdentifier = prevActorIdentifier;
      return {
        errors: response.errors ?? null,
        fieldPayloads: [],
        followupPayloads: null,
        incrementalPlaceholders: null,
        isFinal: false,
        source: RelayRecordSource.create(),
      };
    }
    const relayPayload = this._normalizeResponse(
      recovery?.response ?? response,
      recovery?.selector ?? placeholder.selector,
      recovery?.typeName ?? placeholder.typeName,
      {
        actorIdentifier: this._actorIdentifier,
        deferDeduplicatedFields: this._deferDeduplicatedFields,
        getDataID: this._getDataID,
        log: this._log,
        path: placeholder.path,
        treatMissingFieldsAsNull: this._treatMissingFieldsAsNull,
      },
      this._useExecTimeResolvers,
      recovery?.existingRootRecord,
    );
    this._getPublishQueueAndSaveActor().commitPayload(
      this._operation,
      relayPayload,
    );

    // Load the version of the parent record from which this incremental data
    // was derived
    const parentEntry = this._source.get(parentID);
    invariant(
      parentEntry != null,
      'OperationExecutor: Expected the parent record `%s` for @defer ' +
        'data to exist.',
      parentID,
    );
    const {fieldPayloads} = parentEntry;
    if (fieldPayloads.length !== 0) {
      const handleFieldsRelayPayload = {
        errors: null,
        fieldPayloads,
        followupPayloads: null,
        incrementalPlaceholders: null,
        isFinal: response.extensions?.is_final === true,
        source: RelayRecordSource.create(),
      };
      this._getPublishQueueAndSaveActor().commitPayload(
        this._operation,
        handleFieldsRelayPayload,
      );
    }

    this._actorIdentifier = prevActorIdentifier;
    return relayPayload;
  }

  /**
   * Process the data for one item in a @stream field.
   */
  _processStreamResponse(
    label: string,
    path: ReadonlyArray<unknown>,
    placeholder: StreamPlaceholder,
    response: GraphQLResponseWithData,
  ): RelayResponsePayload {
    const {parentID, node, variables, actorIdentifier} = placeholder;
    const prevActorIdentifier = this._actorIdentifier;
    this._actorIdentifier = actorIdentifier ?? this._actorIdentifier;
    // Find the LinkedField where @stream was applied
    const field = node.selections[0];
    invariant(
      field != null && field.kind === 'LinkedField' && field.plural === true,
      'OperationExecutor: Expected @stream to be used on a plural field.',
    );
    const {
      fieldPayloads,
      itemID,
      itemIndex,
      prevIDs,
      relayPayload,
      storageKey,
    } = this._normalizeStreamItem(
      response,
      parentID,
      field,
      variables,
      path,
      placeholder.path,
    );
    // Publish the new item and update the parent record to set
    // field[index] = item *if* the parent record hasn't been concurrently
    // modified.
    this._getPublishQueueAndSaveActor().commitPayload(
      this._operation,
      relayPayload,
      store => {
        const currentParentRecord = store.get(parentID);
        if (currentParentRecord == null) {
          // parent has since been deleted, stream data is stale
          return;
        }
        const currentItems = currentParentRecord.getLinkedRecords(storageKey);
        if (currentItems == null) {
          // field has since been deleted, stream data is stale
          return;
        }
        if (
          currentItems.length !== prevIDs.length ||
          currentItems.some(
            (currentItem, index) =>
              prevIDs[index] !== (currentItem && currentItem.getDataID()),
          )
        ) {
          // field has been modified by something other than this query,
          // stream data is stale
          return;
        }
        // parent.field has not been concurrently modified:
        // update `parent.field[index] = item`
        const nextItems = [...currentItems];
        nextItems[itemIndex] = store.get(itemID);
        currentParentRecord.setLinkedRecords(nextItems, storageKey);
      },
    );

    // Now that the parent record has been updated to include the new item,
    // also update any handle fields that are derived from the parent record.
    if (fieldPayloads.length !== 0) {
      const handleFieldsRelayPayload = {
        errors: null,
        fieldPayloads,
        followupPayloads: null,
        incrementalPlaceholders: null,
        isFinal: false,
        source: RelayRecordSource.create(),
      };
      this._getPublishQueueAndSaveActor().commitPayload(
        this._operation,
        handleFieldsRelayPayload,
      );
    }

    this._actorIdentifier = prevActorIdentifier;
    return relayPayload;
  }

  _normalizeStreamItem(
    response: GraphQLResponseWithData,
    parentID: DataID,
    field: NormalizationLinkedField,
    variables: Variables,
    path: ReadonlyArray<unknown>,
    normalizationPath: ReadonlyArray<string>,
  ): {
    fieldPayloads: Array<HandleFieldPayload>,
    itemID: DataID,
    itemIndex: number,
    prevIDs: Array<?DataID>,
    relayPayload: RelayResponsePayload,
    storageKey: string,
  } {
    const {data} = response;
    invariant(
      typeof data === 'object',
      'OperationExecutor: Expected the GraphQL @stream payload `data` ' +
        'value to be an object.',
    );
    const responseKey = field.alias ?? field.name;
    const storageKey = getStorageKey(field, variables);

    // Load the version of the parent record from which this incremental data
    // was derived
    const parentEntry = this._source.get(parentID);
    invariant(
      parentEntry != null,
      'OperationExecutor: Expected the parent record `%s` for @stream ' +
        'data to exist.',
      parentID,
    );
    const {record: parentRecord, fieldPayloads} = parentEntry;

    // Load the field value (items) that were created by *this* query executor
    // in order to check if there has been any concurrent modifications by some
    // other operation.
    const prevIDs = RelayModernRecord.getLinkedRecordIDs(
      parentRecord,
      storageKey,
    );
    invariant(
      prevIDs != null,
      'OperationExecutor: Expected record `%s` to have fetched field ' +
        '`%s` with @stream.',
      parentID,
      field.name,
    );

    // Determine the index in the field of the new item
    const finalPathEntry = path[path.length - 1];
    const itemIndex = parseInt(finalPathEntry, 10);
    invariant(
      itemIndex === finalPathEntry && itemIndex >= 0,
      'OperationExecutor: Expected path for @stream to end in a ' +
        'positive integer index, got `%s`',
      finalPathEntry,
    );

    const typeName = field.concreteType ?? data[TYPENAME_KEY];
    invariant(
      typeof typeName === 'string',
      'OperationExecutor: Expected @stream field `%s` to have a ' +
        '__typename.',
      field.name,
    );

    // Determine the __id of the new item: this must equal the value that would
    // be assigned had the item not been streamed
    const itemID =
      this._getDataID(data, typeName) ??
      prevIDs?.[itemIndex] ?? // Reuse previously generated client IDs
      generateClientID(parentID, storageKey, itemIndex);
    invariant(
      typeof itemID === 'string',
      'OperationExecutor: Expected id of elements of field `%s` to ' +
        'be strings.',
      storageKey,
    );

    // Build a selector to normalize the item data with
    const selector = createNormalizationSelector(field, itemID, variables);

    // Update the cached version of the parent record to reflect the new item:
    // this is used when subsequent stream payloads arrive to see if there
    // have been concurrent modifications to the list
    const nextParentRecord = RelayModernRecord.clone(parentRecord);
    const nextIDs = [...prevIDs];
    nextIDs[itemIndex] = itemID;
    RelayModernRecord.setLinkedRecordIDs(nextParentRecord, storageKey, nextIDs);
    this._source.set(parentID, {
      fieldPayloads,
      record: nextParentRecord,
    });
    const relayPayload = this._normalizeResponse(
      response,
      selector,
      typeName,
      {
        actorIdentifier: this._actorIdentifier,
        deferDeduplicatedFields: false,
        getDataID: this._getDataID,
        log: this._log,
        path: [...normalizationPath, responseKey, String(itemIndex)],
        treatMissingFieldsAsNull: this._treatMissingFieldsAsNull,
      },
      this._useExecTimeResolvers,
    );
    return {
      fieldPayloads,
      itemID,
      itemIndex,
      prevIDs,
      relayPayload,
      storageKey,
    };
  }

  _scheduleAsyncStoreUpdate(
    scheduleFn: (() => void) => Disposable,
    completeFn: () => void,
  ): void {
    this._completeFns.push(completeFn);
    if (this._asyncStoreUpdateDisposable != null) {
      return;
    }
    this._asyncStoreUpdateDisposable = scheduleFn(() => {
      this._asyncStoreUpdateDisposable = null;
      const updatedOwners = this._runPublishQueue();
      this._updateOperationTracker(updatedOwners);
      for (const complete of this._completeFns) {
        complete();
      }
      this._completeFns = [];
    });
  }

  _updateOperationTracker(
    updatedOwners: ?ReadonlyArray<RequestDescriptor>,
  ): void {
    if (updatedOwners != null && updatedOwners.length > 0) {
      this._operationTracker.update(
        this._operation.request,
        new Set(updatedOwners),
      );
    }
  }

  _completeOperationTracker() {
    this._operationTracker.complete(this._operation.request);
  }

  _getPublishQueueAndSaveActor(): PublishQueue {
    this._seenActors.add(this._actorIdentifier);
    return this._getPublishQueue(this._actorIdentifier);
  }

  _getActorsToVisit(): ReadonlySet<ActorIdentifier> {
    if (this._seenActors.size === 0) {
      return new Set([this._actorIdentifier]);
    } else {
      return this._seenActors;
    }
  }

  _runPublishQueue(
    operation?: OperationDescriptor,
  ): ReadonlyArray<RequestDescriptor> {
    const updatedOwners = new Set<RequestDescriptor>();
    for (const actorIdentifier of this._getActorsToVisit()) {
      const owners = this._getPublishQueue(actorIdentifier).run(operation);
      owners.forEach(owner => updatedOwners.add(owner));
    }
    return Array.from(updatedOwners);
  }

  _retainData() {
    for (const actorIdentifier of this._getActorsToVisit()) {
      if (!this._retainDisposables.has(actorIdentifier)) {
        this._retainDisposables.set(
          actorIdentifier,
          this._getStore(actorIdentifier).retain(this._operation),
        );
      }
    }
  }

  _disposeRetainedData() {
    for (const disposable of this._retainDisposables.values()) {
      disposable.dispose();
    }
    this._retainDisposables.clear();
  }

  _expectOperationLoader(): OperationLoader {
    const operationLoader = this._operationLoader;
    invariant(
      operationLoader,
      'OperationExecutor: Expected an operationLoader to be ' +
        'configured when using `@match`.',
    );
    return operationLoader;
  }
}

function partitionGraphQLResponses(
  responses: ReadonlyArray<GraphQLResponseWithData>,
): [
  ReadonlyArray<GraphQLResponseWithData>,
  ReadonlyArray<IncrementalGraphQLResponse>,
  ReadonlyArray<GraphQLResponseWithData>,
] {
  const nonIncrementalResponses: Array<GraphQLResponseWithData> = [];
  const incrementalResponses: Array<IncrementalGraphQLResponse> = [];
  const normalizedResponses: Array<GraphQLResponseWithData> = [];
  responses.forEach(response => {
    if (response.path != null || response.label != null) {
      const {label, path} = response;
      if (label == null || path == null) {
        invariant(
          false,
          'OperationExecutor: invalid incremental payload, expected ' +
            '`path` and `label` to either both be null/undefined, or ' +
            '`path` to be an `Array<string | number>` and `label` to be a ' +
            '`string`.',
        );
      }
      incrementalResponses.push({
        label,
        path,
        response,
      });
    } else if (response.extensions?.is_normalized === true) {
      normalizedResponses.push(response);
    } else {
      nonIncrementalResponses.push(response);
    }
  });
  return [nonIncrementalResponses, incrementalResponses, normalizedResponses];
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableCopy(value)) ?? ''; // null-check for flow
}

function validateOptimisticResponsePayload(
  payload: RelayResponsePayload,
): void {
  const {incrementalPlaceholders} = payload;
  if (incrementalPlaceholders != null && incrementalPlaceholders.length !== 0) {
    invariant(
      false,
      'OperationExecutor: optimistic responses cannot be returned ' +
        'for operations that use incremental data delivery (@defer, ' +
        '@stream, and @stream_connection).',
    );
  }
}

function findDeferPlaceholderByPrefix(
  resultForLabel: Map<PathKey, IncrementalResults>,
  path: ReadonlyArray<unknown>,
): ?{
  placeholder: IncrementalResults,
  subPath: ReadonlyArray<unknown>,
} {
  for (let prefixLen = path.length - 1; prefixLen > 0; prefixLen--) {
    const prefixKey = path.slice(0, prefixLen).map(String).join('.');
    const result = resultForLabel.get(prefixKey);
    if (result != null && result.kind === 'placeholder') {
      return {placeholder: result, subPath: path.slice(prefixLen)};
    }
  }
  return null;
}

/**
 * Walk the top-level selections of a placeholder's fragment for Defer nodes,
 * descending through wrapper selections that don't change the record scope
 * (InlineFragment, ClientExtension, Condition). Conditional defers are
 * skipped when their `if` variable resolves to false at the placeholder's
 * variables — matching `_normalizeDefer`'s behavior.
 */
function forEachInnerDefer(
  selector: NormalizationSelector,
  visit: (defer: NormalizationDefer) => void,
): void {
  const walk = (selections: ReadonlyArray<NormalizationSelection>) => {
    for (const sel of selections) {
      switch (sel.kind) {
        case 'Defer':
          if (
            sel.if === null ||
            Boolean(selector.variables[sel.if])
          ) {
            visit(sel);
          }
          break;
        case 'InlineFragment':
        case 'ClientExtension':
        case 'Condition':
          walk(sel.selections);
          break;
      }
    }
  };
  const selections = selector.node.selections;
  if (selections != null) {
    walk(selections);
  }
}

function buildInnerDeferPlaceholder(
  parent: DeferPlaceholder,
  defer: NormalizationDefer,
): DeferPlaceholder {
  return {
    actorIdentifier: parent.actorIdentifier,
    data: {},
    kind: 'defer',
    label: defer.label,
    path: parent.path,
    selector: {
      dataID: parent.selector.dataID,
      node: defer,
      variables: parent.selector.variables,
    },
    typeName: parent.typeName,
  };
}

module.exports = {
  execute,
};
