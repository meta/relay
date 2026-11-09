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

/**
 * LLM/AI Agent: Relay documentation is available in node_modules/relay-runtime/llm-docs/
 */

'use strict';

/* eslint relay-internal/esm-compatible-cjs: error */

const {isErrorResult, isValueResult} = require('./experimental');
const ConnectionHandler = require('./handlers/connection/ConnectionHandler');
const ConnectionInterface = require('./handlers/connection/ConnectionInterface');
const MutationHandlers = require('./handlers/connection/MutationHandlers');
const RelayDefaultHandlerProvider = require('./handlers/RelayDefaultHandlerProvider');
const applyOptimisticMutation = require('./mutations/applyOptimisticMutation');
const commitLocalUpdate = require('./mutations/commitLocalUpdate');
const commitMutation = require('./mutations/commitMutation');
const RelayDeclarativeMutationConfig = require('./mutations/RelayDeclarativeMutationConfig');
const RelayNetwork = require('./network/RelayNetwork');
const RelayObservable = require('./network/RelayObservable');
const RelayQueryResponseCache = require('./network/RelayQueryResponseCache');
const fetchQuery = require('./query/fetchQuery');
const fetchQuery_DEPRECATED = require('./query/fetchQuery_DEPRECATED');
const fetchQueryInternal = require('./query/fetchQueryInternal');
const GraphQLTag = require('./query/GraphQLTag');
const PreloadableQueryRegistry = require('./query/PreloadableQueryRegistry');
const {
  generateClientID,
  generateUniqueClientID,
  isClientID,
} = require('./store/ClientID');
const createFragmentSpecResolver = require('./store/createFragmentSpecResolver');
const createRelayContext = require('./store/createRelayContext');
const createRelayLoggingContext = require('./store/createRelayLoggingContext');
const defaultGetDataID = require('./store/defaultGetDataID');
const ExecTimeS2CDataChecker = require('./store/ExecTimeS2CDataChecker');
const isRelayModernEnvironment = require('./store/isRelayModernEnvironment');
const {
  isSuspenseSentinel,
  suspenseSentinel,
} = require('./store/live-resolvers/LiveResolverSuspenseSentinel');
const NormalizationEngine = require('./store/NormalizationEngine');
const normalizeResponse = require('./store/normalizeResponse');
const readInlineData = require('./store/readInlineData');
const RelayConcreteVariables = require('./store/RelayConcreteVariables');
const RelayModernEnvironment = require('./store/RelayModernEnvironment');
const RelayModernOperationDescriptor = require('./store/RelayModernOperationDescriptor');
const RelayModernRecord = require('./store/RelayModernRecord');
const RelayModernSelector = require('./store/RelayModernSelector');
const RelayModernStore = require('./store/RelayModernStore');
const RelayOperationTracker = require('./store/RelayOperationTracker');
const RelayRecordSource = require('./store/RelayRecordSource');
const RelayReferenceMarker = require('./store/RelayReferenceMarker');
const RelayStoreUtils = require('./store/RelayStoreUtils');
const ResolverFragments = require('./store/ResolverFragments');
const TypeID = require('./store/TypeID');
const ViewerPattern = require('./store/ViewerPattern');
const requestSubscription = require('./subscription/requestSubscription');
const createPayloadFor3DField = require('./util/createPayloadFor3DField');
const deepFreeze = require('./util/deepFreeze');
const getFragmentIdentifier = require('./util/getFragmentIdentifier');
const getPaginationMetadata = require('./util/getPaginationMetadata');
const getPaginationVariables = require('./util/getPaginationVariables');
const getPendingOperationsForFragment = require('./util/getPendingOperationsForFragment');
const getRefetchMetadata = require('./util/getRefetchMetadata');
const getRelayHandleKey = require('./util/getRelayHandleKey');
const getRequestIdentifier = require('./util/getRequestIdentifier');
const getValueAtPath = require('./util/getValueAtPath');
const {
  handlePotentialSnapshotErrors,
} = require('./util/handlePotentialSnapshotErrors');
const isPromise = require('./util/isPromise');
const isScalarAndEqual = require('./util/isScalarAndEqual');
const recycleNodesInto = require('./util/recycleNodesInto');
const RelayConcreteNode = require('./util/RelayConcreteNode');
const RelayDefaultHandleKey = require('./util/RelayDefaultHandleKey');
const RelayError = require('./util/RelayError');
const RelayFeatureFlags = require('./util/RelayFeatureFlags');
const RelayProfiler = require('./util/RelayProfiler');
const RelayReplaySubject = require('./util/RelayReplaySubject');
const {hasCycle, stableCopy} = require('./util/stableCopy');
const withProvidedVariables = require('./util/withProvidedVariables');

export type {ConnectionMetadata} from './handlers/connection/ConnectionHandler';
export type {
  EdgeRecord,
  PageInfo,
} from './handlers/connection/ConnectionInterface';
export type {
  DeclarativeMutationConfig,
  MutationType,
  RangeBehaviors,
  RangeOperation,
} from './mutations/RelayDeclarativeMutationConfig';
export type {OptimisticMutationConfig} from './mutations/applyOptimisticMutation';
export type {
  MutationConfig,
  CommitMutationConfig,
} from './mutations/commitMutation';
export type {
  ExecuteFunction,
  ExecuteWithPreloadedSourceFunction,
  FetchFunction,
  GraphQLResponse,
  GraphQLResponseWithData,
  GraphQLResponseWithoutData,
  GraphQLSingularResponse,
  INetwork,
  LogRequestInfoFunction,
  PayloadData,
  PayloadError,
  SubscribeFunction,
  Uploadable,
  UploadableMap,
} from './network/RelayNetworkTypes';
export type {
  ObservableFromValue,
  Observer,
  Sink,
  Source,
  Subscribable,
  Subscription,
} from './network/RelayObservable';
export type {GraphQLTaggedNode} from './query/GraphQLTag';
export type {EnvironmentConfig} from './store/RelayModernEnvironment';
export type {RecordState} from './store/RelayRecordState';
export type {
  ConcreteClientEdgeResolverReturnType,
  ExecuteMutationConfig,
  FragmentMap,
  // DEPRECATED: use FragmentType instead of FragmentReference
  FragmentType as FragmentReference,
  FragmentSpecResolver,
  FragmentType,
  HandleFieldPayload,
  HasUpdatableSpread,
  IEnvironment,
  InvalidationState,
  LogEvent,
  LogFunction,
  MissingFieldHandler,
  ModuleImportPointer,
  MutableRecordSource,
  MutationParameters,
  NormalizationSelector,
  NormalizeResponseFunction,
  OperationAvailability,
  OperationDescriptor,
  OperationLoader,
  OperationTracker,
  OptimisticResponseConfig,
  OptimisticUpdate,
  OptimisticUpdateFunction,
  PluralReaderSelector,
  Props,
  RecordSourceJSON,
  PublishQueue,
  ReaderSelector,
  ReadOnlyRecordProxy,
  ReadOnlyRecordSourceProxy,
  RecordProxy,
  RecordSourceProxy,
  RecordSourceSelectorProxy,
  RelayContext,
  RequestDescriptor,
  RelayFieldLogger,
  SelectorData,
  SelectorStoreUpdater,
  SingularReaderSelector,
  Snapshot,
  StoreUpdater,
  UpdatableData,
  TaskScheduler,
  LiveState,
} from './store/RelayStoreTypes';
export type {
  GraphQLSubscriptionConfig,
  SubscriptionParameters,
} from './subscription/requestSubscription';
export type {JSResourceReference} from './util/JSResourceTypes.flow';
export type {
  NormalizationArgument,
  NormalizationDefer,
  NormalizationField,
  NormalizationLinkedField,
  NormalizationLinkedHandle,
  NormalizationLocalArgumentDefinition,
  NormalizationModuleImport,
  NormalizationRootNode,
  NormalizationScalarField,
  NormalizationSelection,
  NormalizationSplitOperation,
  NormalizationStream,
  NormalizationTypeDiscriminator,
  NormalizationOperation,
} from './util/NormalizationNode';
export type {
  ReaderArgument,
  ReaderArgumentDefinition,
  ReaderField,
  ReaderFragment,
  ReaderInlineDataFragment,
  ReaderInlineDataFragmentSpread,
  ReaderLinkedField,
  ReaderModuleImport,
  ReaderPaginationMetadata,
  ReaderRefetchableFragment,
  ReaderRefetchMetadata,
  ReaderRequiredField,
  ReaderScalarField,
  ReaderSelection,
  RefetchableIdentifierInfo,
  RequiredFieldAction,
} from './util/ReaderNode';
export type {
  ConcreteRequest,
  ClientRequest,
  ConcreteUpdatableQuery,
  GeneratedNode,
  PreloadableConcreteRequest,
  RequestParameters,
  ServerRequest,
} from './util/RelayConcreteNode';
export type {
  CacheConfig,
  DataID,
  Disposable,
  FetchPolicy,
  FetchQueryFetchPolicy,
  Fragment,
  GraphQLSubscription,
  InlineFragment,
  Mutation,
  Operation,
  OperationType,
  Query,
  ServerOperationType,
  ServerQuery,
  ClientQuery,
  RefetchableFragment,
  RenderPolicy,
  PrefetchableRefetchableFragment,
  UpdatableFragment,
  UpdatableQuery,
  Variables,
  VariablesOf,
} from './util/RelayRuntimeTypes';
export type {Local3DPayload} from './util/createPayloadFor3DField';
export type {Direction} from './util/getPaginationVariables';
export type {RequestIdentifier} from './util/getRequestIdentifier';
export type {ResolverFunction} from './util/ReaderNode';
export type {IdOf, RelayResolverValue, Result} from './experimental';

// As early as possible, check for the existence of the JavaScript globals which
// Relay Runtime relies upon, and produce a clear message if they do not exist.
if (__DEV__) {
  const mapStr = typeof Map !== 'function' ? 'Map' : null;
  const setStr = typeof Set !== 'function' ? 'Set' : null;
  const promiseStr = typeof Promise !== 'function' ? 'Promise' : null;
  const objStr = typeof Object.assign !== 'function' ? 'Object.assign' : null;
  if (mapStr || setStr || promiseStr || objStr) {
    throw new Error(
      `relay-runtime requires ${[mapStr, setStr, promiseStr, objStr]
        .filter(Boolean)
        .join(', and ')} to exist. ` +
        'Use a polyfill to provide these for older browsers.',
    );
  }
}

const {
  areEqualSelectors,
  createNormalizationSelector,
  createReaderSelector,
  getDataIDsFromFragment,
  getDataIDsFromObject,
  getPluralSelector,
  getSelector,
  getSelectorsFromObject,
  getSingularSelector,
  getVariablesFromFragment,
  getVariablesFromObject,
  getVariablesFromPluralFragment,
  getVariablesFromSingularFragment,
} = RelayModernSelector;

const {createOperationDescriptor, createRequestDescriptor} =
  RelayModernOperationDescriptor;

const {
  getArgumentValues,
  getModuleComponentKey,
  getModuleOperationKey,
  getStorageKey,
  FRAGMENTS_KEY,
  FRAGMENT_OWNER_KEY,
  ID_KEY,
  REF_KEY,
  REFS_KEY,
  ROOT_ID,
  ROOT_TYPE,
  TYPENAME_KEY,
} = RelayStoreUtils;

const {
  getNode,
  getFragment,
  getInlineDataFragment,
  getPaginationFragment,
  getRefetchableFragment,
  getRequest,
  graphql,
  isFragment,
  isInlineDataFragment,
  isRequest,
} = GraphQLTag;

const {readFragment} = ResolverFragments;

const {DEFAULT_HANDLE_KEY} = RelayDefaultHandleKey;

const {MutationTypes, RangeOperations} = RelayDeclarativeMutationConfig;

const {VIEWER_ID, VIEWER_TYPE} = ViewerPattern;

const __internal = {
  ResolverFragments,
  OperationTracker: RelayOperationTracker,
  createRelayContext: createRelayContext,
  createRelayLoggingContext: createRelayLoggingContext,
  defaultGetDataID: defaultGetDataID,
  getOperationVariables: RelayConcreteVariables.getOperationVariables,
  getLocalVariables: RelayConcreteVariables.getLocalVariables,
  markReferences: RelayReferenceMarker.mark,
  generateTypeID: TypeID.generateTypeID,
  isTypeID: TypeID.isTypeID,
  fetchQuery: fetchQueryInternal.fetchQuery,
  fetchQueryDeduped: fetchQueryInternal.fetchQueryDeduped,
  getPromiseForActiveRequest: fetchQueryInternal.getPromiseForActiveRequest,
  getObservableForActiveRequest:
    fetchQueryInternal.getObservableForActiveRequest,
  NormalizationEngine: NormalizationEngine,
  ExecTimeS2CDataChecker: ExecTimeS2CDataChecker,
  normalizeResponse: normalizeResponse,
  withProvidedVariables: withProvidedVariables,
};

/**
 * The public interface to Relay Runtime.
 */
module.exports = {
  // Core API
  Environment: RelayModernEnvironment,
  Network: RelayNetwork,
  Observable: RelayObservable,
  QueryResponseCache: RelayQueryResponseCache,
  RecordSource: RelayRecordSource,
  Record: RelayModernRecord,
  ReplaySubject: RelayReplaySubject,
  Store: RelayModernStore,

  areEqualSelectors,
  createFragmentSpecResolver: createFragmentSpecResolver,
  createNormalizationSelector,
  createOperationDescriptor,
  createReaderSelector,
  createRequestDescriptor,
  getArgumentValues,
  getDataIDsFromFragment,
  getDataIDsFromObject,
  getNode,
  getFragment,
  getInlineDataFragment,
  getModuleComponentKey,
  getModuleOperationKey,
  getPaginationFragment,
  getPluralSelector,
  getRefetchableFragment,
  getRequest,
  getRequestIdentifier: getRequestIdentifier,
  getSelector,
  getSelectorsFromObject,
  getSingularSelector,
  getStorageKey,
  getVariablesFromFragment,
  getVariablesFromObject,
  getVariablesFromPluralFragment,
  getVariablesFromSingularFragment,
  handlePotentialSnapshotErrors,
  graphql,
  isErrorResult: isErrorResult,
  isValueResult: isValueResult,
  isFragment,
  isInlineDataFragment,
  isSuspenseSentinel,
  suspenseSentinel,
  isRequest,
  readInlineData,
  readFragment,

  // Declarative mutation API
  MutationTypes,
  RangeOperations,

  // Extensions
  DefaultHandlerProvider: RelayDefaultHandlerProvider,
  ConnectionHandler,
  MutationHandlers,
  VIEWER_ID,
  VIEWER_TYPE,

  // Helpers (can be implemented via the above API)
  applyOptimisticMutation,
  commitLocalUpdate,
  commitMutation,
  fetchQuery: fetchQuery,
  fetchQuery_DEPRECATED,
  isRelayModernEnvironment,
  requestSubscription,

  // Configuration interface for legacy or special uses
  ConnectionInterface,

  // Utilities
  PreloadableQueryRegistry,
  RelayProfiler: RelayProfiler,
  createPayloadFor3DField: createPayloadFor3DField,

  // INTERNAL-ONLY: These exports might be removed at any point.
  RelayConcreteNode: RelayConcreteNode,
  RelayError: RelayError,
  RelayFeatureFlags: RelayFeatureFlags,
  DEFAULT_HANDLE_KEY,
  FRAGMENTS_KEY,
  FRAGMENT_OWNER_KEY,
  ID_KEY,
  REF_KEY,
  REFS_KEY,
  ROOT_ID,
  ROOT_TYPE,
  TYPENAME_KEY,

  deepFreeze: deepFreeze,
  generateClientID: generateClientID,
  generateUniqueClientID: generateUniqueClientID,
  getRelayHandleKey: getRelayHandleKey,
  isClientID: isClientID,
  isPromise: isPromise,
  isScalarAndEqual: isScalarAndEqual,
  recycleNodesInto: recycleNodesInto,
  stableCopy: stableCopy,
  hasCycle: hasCycle,
  getFragmentIdentifier: getFragmentIdentifier,
  getRefetchMetadata: getRefetchMetadata,
  getPaginationMetadata: getPaginationMetadata,
  getPaginationVariables: getPaginationVariables,
  getPendingOperationsForFragment: getPendingOperationsForFragment,
  getValueAtPath: getValueAtPath,
  __internal,
};
