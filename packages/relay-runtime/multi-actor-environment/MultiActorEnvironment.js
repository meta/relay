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

import type {HandlerProvider} from '../handlers/RelayDefaultHandlerProvider';
import type {GraphQLResponse, PayloadData} from '../network/RelayNetworkTypes';
import type {INetwork} from '../network/RelayNetworkTypes';
import type {ActiveState} from '../store/OperationExecutor';
import type {GetDataID} from '../store/RelayResponseNormalizer';
import type {
  ExecuteMutationConfig,
  LogFunction,
  MissingFieldHandler,
  MutableRecordSource,
  MutationParameters,
  NormalizeResponseFunction,
  OperationAvailability,
  OperationDescriptor,
  OperationLoader,
  OptimisticResponseConfig,
  OptimisticUpdateFunction,
  RelayFieldLogger,
  SelectorStoreUpdater,
  SingularReaderSelector,
  Snapshot,
  Store,
  StoreUpdater,
  TaskScheduler,
} from '../store/RelayStoreTypes';
import type {Disposable} from '../util/RelayRuntimeTypes';
import type {RenderPolicy} from '../util/RelayRuntimeTypes';
import type {ActorIdentifier} from './ActorIdentifier';
import type {
  IActorEnvironment,
  IMultiActorEnvironment,
  MultiActorStoreUpdater,
} from './MultiActorEnvironmentTypes';

const RelayDefaultHandlerProvider = require('../handlers/RelayDefaultHandlerProvider');
const RelayObservable = require('../network/RelayObservable');
const defaultGetDataID = require('../store/defaultGetDataID');
const defaultRelayFieldLogger = require('../store/defaultRelayFieldLogger');
const normalizeResponse = require('../store/normalizeResponse');
const OperationExecutor = require('../store/OperationExecutor');
const RelayModernStore = require('../store/RelayModernStore');
const RelayRecordSource = require('../store/RelayRecordSource');
const ActorSpecificEnvironment = require('./ActorSpecificEnvironment');

export type MultiActorEnvironmentConfig = Readonly<{
  createConfigNameForActor?: ?(actorIdentifier: ActorIdentifier) => string,
  createNetworkForActor: (actorIdentifier: ActorIdentifier) => INetwork,
  createStoreForActor?: ?(actorIdentifier: ActorIdentifier) => Store,
  defaultRenderPolicy?: ?RenderPolicy,
  getDataID?: GetDataID,
  handlerProvider?: HandlerProvider,
  isServer?: ?boolean,
  logFn?: ?LogFunction,
  missingFieldHandlers?: ?ReadonlyArray<MissingFieldHandler>,
  normalizeResponse?: NormalizeResponseFunction,
  operationLoader?: ?OperationLoader,
  relayFieldLogger?: ?RelayFieldLogger,
  scheduler?: ?TaskScheduler,
  treatMissingFieldsAsNull?: boolean,
  deferDeduplicatedFields?: boolean,
}>;

class MultiActorEnvironment implements IMultiActorEnvironment {
  readonly _actorEnvironments: Map<ActorIdentifier, IActorEnvironment>;
  readonly _createConfigNameForActor: ?(
    actorIdentifier: ActorIdentifier,
  ) => string;
  readonly _createNetworkForActor: (
    actorIdentifier: ActorIdentifier,
  ) => INetwork;
  readonly _createStoreForActor: ?(actorIdentifier: ActorIdentifier) => Store;
  readonly _defaultRenderPolicy: RenderPolicy;
  readonly _getDataID: GetDataID;
  readonly _handlerProvider: HandlerProvider;
  readonly _isServer: boolean;
  readonly _logFn: LogFunction;
  readonly _missingFieldHandlers: ReadonlyArray<MissingFieldHandler>;
  readonly _normalizeResponse: NormalizeResponseFunction;
  readonly _operationExecutions: Map<string, ActiveState>;
  readonly _inFlightOperationCompletions: Map<
    string,
    {promise: Promise<void>, resolve: () => void},
  >;
  readonly _operationLoader: ?OperationLoader;
  readonly _relayFieldLogger: RelayFieldLogger;
  readonly _scheduler: ?TaskScheduler;
  readonly _treatMissingFieldsAsNull: boolean;
  readonly _deferDeduplicatedFields: boolean;

  constructor(config: MultiActorEnvironmentConfig) {
    this._actorEnvironments = new Map();
    this._operationLoader = config.operationLoader;
    this._createNetworkForActor = config.createNetworkForActor;
    this._scheduler = config.scheduler;
    this._getDataID = config.getDataID ?? defaultGetDataID;
    this._handlerProvider = config.handlerProvider
      ? config.handlerProvider
      : RelayDefaultHandlerProvider;
    this._logFn = config.logFn ?? emptyFunction;
    this._operationExecutions = new Map();
    this._inFlightOperationCompletions = new Map();
    this._relayFieldLogger = config.relayFieldLogger ?? defaultRelayFieldLogger;
    this._treatMissingFieldsAsNull = config.treatMissingFieldsAsNull ?? false;
    this._deferDeduplicatedFields = config.deferDeduplicatedFields ?? false;
    this._isServer = config.isServer ?? false;
    this._missingFieldHandlers = config.missingFieldHandlers ?? [];
    this._createStoreForActor = config.createStoreForActor;
    this._createConfigNameForActor = config.createConfigNameForActor;
    this._defaultRenderPolicy = config.defaultRenderPolicy ?? 'partial';
    this._normalizeResponse = config.normalizeResponse ?? normalizeResponse;
  }

  /**
   * This method will create an actor specific environment. It will create a new instance
   * and store it in the internal maps. If will return a memoized version
   * of the environment if we already created one for actor.
   */
  forActor(actorIdentifier: ActorIdentifier): IActorEnvironment {
    const environment = this._actorEnvironments.get(actorIdentifier);
    if (environment == null) {
      const newEnvironment = new ActorSpecificEnvironment({
        configName: this._createConfigNameForActor
          ? this._createConfigNameForActor(actorIdentifier)
          : null,
        actorIdentifier,
        multiActorEnvironment: this,
        logFn: this._logFn,
        relayFieldLogger: this._relayFieldLogger,
        store:
          this._createStoreForActor != null
            ? this._createStoreForActor(actorIdentifier)
            : new RelayModernStore(RelayRecordSource.create()),
        network: this._createNetworkForActor(actorIdentifier),
        handlerProvider: this._handlerProvider,
        defaultRenderPolicy: this._defaultRenderPolicy,
        missingFieldHandlers: this._missingFieldHandlers,
      });
      this._actorEnvironments.set(actorIdentifier, newEnvironment);
      return newEnvironment;
    } else {
      return environment;
    }
  }

  check(
    actorEnvironment: IActorEnvironment,
    operation: OperationDescriptor,
  ): OperationAvailability {
    if (
      this._missingFieldHandlers == null ||
      this._missingFieldHandlers.length === 0
    ) {
      return actorEnvironment.getStore().check(operation, {
        handlers: [],
        defaultActorIdentifier: actorEnvironment.actorIdentifier,
        getSourceForActor: actorIdentifier => {
          return this.forActor(actorIdentifier).getStore().getSource();
        },
        getTargetForActor: () => {
          return RelayRecordSource.create();
        },
      });
    }
    return this._checkSelectorAndHandleMissingFields(
      actorEnvironment,
      operation,
      this._missingFieldHandlers,
    );
  }

  _checkSelectorAndHandleMissingFields(
    actorEnvironment: IActorEnvironment,
    operation: OperationDescriptor,
    handlers: ReadonlyArray<MissingFieldHandler>,
  ): OperationAvailability {
    const targets: Map<ActorIdentifier, MutableRecordSource> = new Map([
      [actorEnvironment.actorIdentifier, RelayRecordSource.create()],
    ]);
    const result = actorEnvironment.getStore().check(operation, {
      handlers,
      defaultActorIdentifier: actorEnvironment.actorIdentifier,
      getSourceForActor: actorIdentifier => {
        return this.forActor(actorIdentifier).getStore().getSource();
      },
      getTargetForActor: actorIdentifier => {
        let target = targets.get(actorIdentifier);
        if (target == null) {
          target = RelayRecordSource.create();
          targets.set(actorIdentifier, target);
        }
        return target;
      },
    });
    for (const [actorIdentifier, target] of targets) {
      if (target.size() > 0) {
        this._scheduleUpdates(() => {
          const publishQueue = this.forActor(actorIdentifier).getPublishQueue();
          publishQueue.commitSource(target);
          publishQueue.run();
        });
      }
    }

    return result;
  }

  subscribe(
    actorEnvironment: IActorEnvironment,
    snapshot: Snapshot,
    callback: (snapshot: Snapshot) => void,
  ): Disposable {
    // TODO: make actor aware
    return actorEnvironment.getStore().subscribe(snapshot, callback);
  }

  retain(
    actorEnvironment: IActorEnvironment,
    operation: OperationDescriptor,
  ): Disposable {
    // TODO: make actor aware
    return actorEnvironment.getStore().retain(operation);
  }

  applyUpdate(
    actorEnvironment: IActorEnvironment,
    optimisticUpdate: OptimisticUpdateFunction,
  ): Disposable {
    const publishQueue = actorEnvironment.getPublishQueue();
    const dispose = () => {
      this._scheduleUpdates(() => {
        publishQueue.revertUpdate(optimisticUpdate);
        publishQueue.run();
      });
    };
    this._scheduleUpdates(() => {
      publishQueue.applyUpdate(optimisticUpdate);
      publishQueue.run();
    });
    return {dispose};
  }

  revertUpdate(
    actorEnvironment: IActorEnvironment,
    update: OptimisticUpdateFunction,
  ): void {
    const publishQueue = actorEnvironment.getPublishQueue();
    this._scheduleUpdates(() => {
      publishQueue.revertUpdate(update);
      publishQueue.run();
    });
  }

  replaceUpdate(
    actorEnvironment: IActorEnvironment,
    update: OptimisticUpdateFunction,
    replacement: OptimisticUpdateFunction,
  ): void {
    const publishQueue = actorEnvironment.getPublishQueue();
    this._scheduleUpdates(() => {
      publishQueue.revertUpdate(update);
      publishQueue.applyUpdate(replacement);
      publishQueue.run();
    });
  }

  applyMutation<TMutation extends MutationParameters>(
    actorEnvironment: IActorEnvironment,
    optimisticConfig: OptimisticResponseConfig<TMutation>,
  ): Disposable {
    const subscription = this._execute(actorEnvironment, {
      createSource: () => RelayObservable.create(_sink => {}),
      isClientPayload: false,
      operation: optimisticConfig.operation,
      optimisticConfig,
      updater: null,
    }).subscribe({});
    return {
      dispose: () => subscription.unsubscribe(),
    };
  }

  commitUpdate(
    actorEnvironment: IActorEnvironment,
    updater: StoreUpdater,
  ): void {
    const publishQueue = actorEnvironment.getPublishQueue();
    this._scheduleUpdates(() => {
      publishQueue.commitUpdate(updater);
      publishQueue.run();
    });
  }

  commitPayload(
    actorEnvironment: IActorEnvironment,
    operationDescriptor: OperationDescriptor,
    payload: PayloadData,
  ): void {
    this._execute(actorEnvironment, {
      createSource: () => RelayObservable.from({data: payload}),
      isClientPayload: true,
      operation: operationDescriptor,
      optimisticConfig: null,
      updater: null,
    }).subscribe({});
  }

  lookup(
    actorEnvironment: IActorEnvironment,
    selector: SingularReaderSelector,
  ): Snapshot {
    // TODO: make actor aware
    return actorEnvironment.getStore().lookup(selector);
  }

  execute(
    actorEnvironment: IActorEnvironment,
    {
      operation,
    }: {
      operation: OperationDescriptor,
    },
  ): RelayObservable<GraphQLResponse> {
    return this._execute(actorEnvironment, {
      createSource: () =>
        actorEnvironment
          .getNetwork()
          .execute(
            operation.request.node.params,
            operation.request.variables,
            operation.request.cacheConfig || {},
            null,
            undefined,
            undefined,
            undefined,
            {
              checkOperation: candidateOperation =>
                actorEnvironment.check(candidateOperation),
              parentOperation: operation,
            },
          ),
      isClientPayload: false,
      operation,
      optimisticConfig: null,
      updater: null,
    });
  }

  executeSubscription<TMutation extends MutationParameters>(
    actorEnvironment: IActorEnvironment,
    {
      operation,
      updater,
    }: {
      operation: OperationDescriptor,
      updater?: ?SelectorStoreUpdater<TMutation['response']>,
    },
  ): RelayObservable<GraphQLResponse> {
    return this._execute(actorEnvironment, {
      createSource: () =>
        actorEnvironment
          .getNetwork()
          .execute(
            operation.request.node.params,
            operation.request.variables,
            operation.request.cacheConfig || {},
            null,
          ),
      isClientPayload: false,
      operation,
      optimisticConfig: null,
      updater,
    });
  }

  executeMutation<TMutation extends MutationParameters>(
    actorEnvironment: IActorEnvironment,
    {
      operation,
      optimisticResponse,
      optimisticUpdater,
      updater,
      uploadables,
    }: ExecuteMutationConfig<TMutation>,
  ): RelayObservable<GraphQLResponse> {
    let optimisticConfig;
    if (optimisticResponse || optimisticUpdater) {
      optimisticConfig = {
        operation: operation,
        response: optimisticResponse,
        updater: optimisticUpdater,
      };
    }
    return this._execute(actorEnvironment, {
      createSource: () =>
        actorEnvironment.getNetwork().execute(
          operation.request.node.params,
          operation.request.variables,
          {
            ...operation.request.cacheConfig,
            force: true,
          },
          uploadables,
        ),
      isClientPayload: false,
      operation,
      optimisticConfig,
      updater,
    });
  }

  executeWithSource(
    actorEnvironment: IActorEnvironment,
    config: {
      operation: OperationDescriptor,
      source: RelayObservable<GraphQLResponse>,
    },
  ): RelayObservable<GraphQLResponse> {
    return this._execute(actorEnvironment, {
      createSource: () => config.source,
      isClientPayload: false,
      operation: config.operation,
      optimisticConfig: null,
      updater: null,
    });
  }

  isRequestActive(
    _actorEnvironment: IActorEnvironment,
    requestIdentifier: string,
  ): boolean {
    const activeState = this._operationExecutions.get(requestIdentifier);
    return activeState === 'active';
  }

  getPromiseForInFlightOperation(
    requestIdentifier: string,
  ): Promise<void> | null {
    const entry = this._inFlightOperationCompletions.get(requestIdentifier);
    return entry?.promise ?? null;
  }

  isServer(): boolean {
    return this._isServer;
  }

  _execute<TMutation extends MutationParameters>(
    actorEnvironment: IActorEnvironment,
    {
      createSource,
      isClientPayload,
      operation,
      optimisticConfig,
      updater,
    }: {
      createSource: () => RelayObservable<GraphQLResponse>,
      isClientPayload: boolean,
      operation: OperationDescriptor,
      optimisticConfig: ?OptimisticResponseConfig<TMutation>,
      updater: ?SelectorStoreUpdater<TMutation['response']>,
    },
  ): RelayObservable<GraphQLResponse> {
    return RelayObservable.create<GraphQLResponse>(sink => {
      const executor = OperationExecutor.execute<TMutation>({
        actorIdentifier: actorEnvironment.actorIdentifier,
        getDataID: this._getDataID,
        isClientPayload,
        operation,
        operationExecutions: this._operationExecutions,
        inFlightOperationCompletions: this._inFlightOperationCompletions,
        operationLoader: this._operationLoader,
        operationTracker: actorEnvironment.getOperationTracker(),
        optimisticConfig,
        getPublishQueue: (actorIdentifier: ActorIdentifier) => {
          return this.forActor(actorIdentifier).getPublishQueue();
        },
        scheduler: this._scheduler,
        sink,
        // NOTE: Some product tests expect `Network.execute` to be called only
        //       when the Observable is executed.
        source: createSource(),
        getStore: (actorIdentifier: ActorIdentifier) => {
          return this.forActor(actorIdentifier).getStore();
        },
        treatMissingFieldsAsNull: this._treatMissingFieldsAsNull,
        deferDeduplicatedFields: this._deferDeduplicatedFields,
        updater,
        log: this._logFn,
        normalizeResponse: this._normalizeResponse,
      });
      return () => executor.cancel();
    });
  }

  _scheduleUpdates(task: () => void) {
    const scheduler = this._scheduler;
    if (scheduler != null) {
      scheduler.schedule(task);
    } else {
      task();
    }
  }

  commitMultiActorUpdate(updater: MultiActorStoreUpdater): void {
    for (const [actorIdentifier, environment] of this._actorEnvironments) {
      environment.commitUpdate(storeProxy => {
        updater(actorIdentifier, environment, storeProxy);
      });
    }
  }

  getScheduler(): ?TaskScheduler {
    return this._scheduler;
  }
}

function emptyFunction() {}

module.exports = MultiActorEnvironment;
