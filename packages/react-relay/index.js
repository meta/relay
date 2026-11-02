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

const ReactRelayContext = require('./ReactRelayContext');
const ReactRelayFragmentContainer = require('./ReactRelayFragmentContainer');
const ReactRelayLocalQueryRenderer = require('./ReactRelayLocalQueryRenderer');
const ReactRelayPaginationContainer = require('./ReactRelayPaginationContainer');
const ReactRelayQueryRenderer = require('./ReactRelayQueryRenderer');
const ReactRelayRefetchContainer = require('./ReactRelayRefetchContainer');
const EntryPointContainer = require('./relay-hooks/EntryPointContainer.react');
const loadEntryPoint = require('./relay-hooks/loadEntryPoint');
const {loadQuery} = require('./relay-hooks/loadQuery');
const MatchContainer = require('./relay-hooks/MatchContainer');
const ProfilerContext = require('./relay-hooks/ProfilerContext');
const RelayEnvironmentProvider = require('./relay-hooks/RelayEnvironmentProvider');
const useClientQuery = require('./relay-hooks/useClientQuery');
const useEntryPointLoader = require('./relay-hooks/useEntryPointLoader');
const useFragment = require('./relay-hooks/useFragment');
const useLazyLoadQuery = require('./relay-hooks/useLazyLoadQuery');
const useMutation = require('./relay-hooks/useMutation');
const useMutationAction_EXPERIMENTAL = require('./relay-hooks/useMutationAction_EXPERIMENTAL');
const usePaginationFragment = require('./relay-hooks/usePaginationFragment');
const usePrefetchableForwardPaginationFragment = require('./relay-hooks/usePrefetchableForwardPaginationFragment');
const usePreloadedQuery = require('./relay-hooks/usePreloadedQuery');
const useQueryLoader = require('./relay-hooks/useQueryLoader');
const useRefetchableFragment = require('./relay-hooks/useRefetchableFragment');
const useRelayEnvironment = require('./relay-hooks/useRelayEnvironment');
const useSubscribeToInvalidationState = require('./relay-hooks/useSubscribeToInvalidationState');
const useSubscription = require('./relay-hooks/useSubscription');
const RelayRuntime = require('relay-runtime');

export type {
  $FragmentRef,
  $RelayProps,
  RelayFragmentContainer,
  RelayPaginationContainer,
  RelayPaginationProp,
  RelayProp,
  RelayRefetchContainer,
  RelayRefetchProp,
} from './ReactRelayTypes';
export type * from './relay-hooks/EntryPointTypes.flow';
export type {
  MatchContainerProps,
  MatchPointer,
} from './relay-hooks/MatchContainer';
export type {ProfilerContextType} from './relay-hooks/ProfilerContext';
export type {LoadMoreFn} from './relay-hooks/useLoadMoreFunction';
export type {UseMutationConfig} from './relay-hooks/useMutation';
export type {UseQueryLoaderLoadQueryOptions} from './relay-hooks/useQueryLoader';
export type {
  RefetchFn,
  RefetchFnDynamic,
  Options as RefetchOptions,
} from './relay-hooks/legacy/useRefetchableFragmentNode';
export type {
  DataID,
  DeclarativeMutationConfig,
  Direction,
  Disposable,
  // RelayRuntime has two environment exports: one interface, one concrete.
  IEnvironment as Environment,
  GraphQLTaggedNode,
  MutationType,
  NormalizationSelector,
  OperationDescriptor,
  RangeOperation,
  ReaderSelector,
  RelayContext,
  Snapshot,
  Variables,
  FetchPolicy,
} from 'relay-runtime';

const {
  ConnectionHandler,
  MutationTypes,
  RangeOperations,
  applyOptimisticMutation,
  commitLocalUpdate,
  commitMutation,
  fetchQuery_DEPRECATED,
  graphql,
  readInlineData,
  requestSubscription,
  fetchQuery,
} = RelayRuntime;

const createFragmentContainer = ReactRelayFragmentContainer.createContainer;
const createPaginationContainer = ReactRelayPaginationContainer.createContainer;
const createRefetchContainer = ReactRelayRefetchContainer.createContainer;

/**
 * The public interface to react-relay.
 * Currently contains both Relay Hooks and legacy Container APIs.
 * Will eventually only export the interface from ./hooks.js.
 */
module.exports = {
  ConnectionHandler,
  QueryRenderer: ReactRelayQueryRenderer,
  LocalQueryRenderer: ReactRelayLocalQueryRenderer,

  MutationTypes,
  RangeOperations,

  ReactRelayContext,

  applyOptimisticMutation,
  commitLocalUpdate,
  commitMutation,
  createFragmentContainer,
  createPaginationContainer,
  createRefetchContainer,
  fetchQuery_DEPRECATED,
  graphql,
  readInlineData,
  requestSubscription,

  // Relay Hooks
  EntryPointContainer: EntryPointContainer,
  RelayEnvironmentProvider: RelayEnvironmentProvider,
  MatchContainer: MatchContainer,
  ProfilerContext: ProfilerContext,

  fetchQuery,

  loadQuery: loadQuery,
  loadEntryPoint: loadEntryPoint,

  useClientQuery: useClientQuery,
  useFragment: useFragment,
  useLazyLoadQuery: useLazyLoadQuery,
  useEntryPointLoader: useEntryPointLoader,
  useQueryLoader: useQueryLoader,
  useMutation: useMutation,
  useMutationAction_EXPERIMENTAL: useMutationAction_EXPERIMENTAL,
  usePaginationFragment: usePaginationFragment,
  usePreloadedQuery: usePreloadedQuery,
  useRefetchableFragment: useRefetchableFragment,
  usePrefetchableForwardPaginationFragment:
    usePrefetchableForwardPaginationFragment,
  useRelayEnvironment: useRelayEnvironment,
  useSubscribeToInvalidationState: useSubscribeToInvalidationState,
  useSubscription: useSubscription,
};
