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

/**
 * Basic types used throughout Relay.
 */

import type {ReaderFragment, ReaderInlineDataFragment} from './ReaderNode';
import type {
  ClientRequest,
  ConcreteRequest,
  ConcreteUpdatableQuery,
  ServerRequest,
} from './RelayConcreteNode';

/**
 * Represents any resource that must be explicitly disposed of. The most common
 * use-case is as a return value for subscriptions, where calling `dispose()`
 * would cancel the subscription.
 */
export type Disposable = interface {dispose(): void};

export type DataID = string;

// Variables
export type Variables = {readonly [key: string]: $FlowFixMe};

/**
 * Generated operation flow types are subtypes of this.
 */
export type OperationType = {
  // TODO(T33395812) Make this an open object type
  readonly variables: Variables,
  readonly response: unknown,
  readonly rawResponse?: {...},
};

export type ClientOperationType = {
  ...OperationType,
  readonly $serverOperation?: empty,
};

export type ServerOperationType = {
  ...OperationType,
  readonly $serverOperation: true,
};

export type VariablesOf<T extends OperationType> = T['variables'];

/**
 * Settings for how a query response may be cached.
 *
 * - `force`: causes a query to be issued unconditionally, irrespective of the
 *   state of any configured response cache.
 * - `poll`: causes a query to live update by polling at the specified interval
 *   in milliseconds. (This value will be passed to setTimeout.)
 * - `liveConfigId`: Makes a query live by sending through RTI stack.
 * - `onSubscribe`: Callback to be called when a live query stream is started.
 * - `onPause`: Callback to be called when a live query stream is paused, e.g. due to a network disconnection.
 * - `onResume`: Callback to be called when a live query stream is resumed, e.g. from a network disconnection.
 * - `metadata`: user-supplied metadata.
 * - `transactionId`: a user-supplied value, intended for use as a unique id for
 *   a given instance of executing an operation.
 */
export type CacheConfig = {
  readonly force?: ?boolean,
  readonly poll?: ?number,
  readonly liveConfigId?: ?string,
  readonly onSubscribe?: () => void,
  readonly onResume?: (pauseTimeMs: number) => void,
  readonly onPause?: (
    mqttConnectionIsOk: boolean,
    internetIsOk: boolean,
  ) => void,
  readonly metadata?: {readonly [key: string]: unknown, ...},
  readonly transactionId?: ?string,
  // Provided variables take the values given in the variables, not their
  // providers' (e.g. for queries that extend data a server handed off).
  readonly keepProvidedVariables?: ?boolean,
};

export type FetchQueryFetchPolicy = 'store-or-network' | 'network-only';
export type FetchPolicy =
  FetchQueryFetchPolicy | 'store-and-network' | 'store-only';
export type RenderPolicy = 'full' | 'partial';

/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * Return type of graphql tag literals for all operations.
 */
declare export opaque type Operation<
  in TVariables extends Variables,
  out TData,
  TRawResponse,
>: ConcreteRequest;

/**
 * Return type of graphql tag literals for updatable queries.
 */
declare export opaque type UpdatableQuery<
  in TVariables extends Variables,
  out TData,
>: ConcreteUpdatableQuery;

/**
 * Return type of graphql tag literals for updatable fragments.
 */
declare export opaque type UpdatableFragment<
  TFragmentType,
  out TData,
>: ReaderFragment;

/**
 * Return type of graphql tag literals for queries.
 */
declare export opaque type Query<
  in TVariables extends Variables,
  out TData,
  TRawResponse = void,
>: Operation<TVariables, TData, TRawResponse>;

declare export opaque type ServerQuery<
  in TVariables extends Variables,
  out TData,
  TRawResponse = void,
>: ServerRequest;

/**
 * Return type of graphql tag literals for client-only queries.
 */
declare export opaque type ClientQuery<
  in TVariables extends Variables,
  out TData,
  TRawResponse = void,
>: ClientRequest;

/**
 * Return type of graphql tag literals for mutations.
 */
declare export opaque type Mutation<
  in TVariables extends Variables,
  out TData,
  TRawResponse = {...},
>: Operation<TVariables, TData, TRawResponse>;

/**
 * Return type of graphql tag literals for subscriptions.
 *
 * NOTE: Using the GraphQL prefix here because of a naming conflict with
 *       `RelayObservable`'s `Subscription` type.
 */
declare export opaque type GraphQLSubscription<
  in TVariables extends Variables,
  out TData,
  TRawResponse = void,
>: Operation<TVariables, TData, TRawResponse>;

/**
 * Return type of graphql tag literals for `@inline` fragments.
 */
declare export opaque type InlineFragment<
  TFragmentType,
  out TData,
>: ReaderInlineDataFragment;

/**
 * Return type of graphql tag literals for fragments, except `@inline`
 * fragments.
 */
declare export opaque type Fragment<TFragmentType, out TData>: ReaderFragment;

/**
 * Return type of graphql tag literals for `@refetchable` fragments.
 */
declare export opaque type RefetchableFragment<
  TFragmentType,
  out TData,
  TVariables extends Variables,
>: Fragment<TFragmentType, TData>;

/**
 * Return type of graphql tag literals for `@refetchable` fragments
 * with prefetchable pagination connections.
 */
declare export opaque type PrefetchableRefetchableFragment<
  TFragmentType,
  out TData,
  out TEdgeData,
  TVariables extends Variables,
>: Fragment<TFragmentType, TData>;
