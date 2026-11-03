/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {OperationAvailability, OperationDescriptor, RecordSource} from '../store/RelayStoreTypes';
import { RequestParameters } from '../util/RelayConcreteNode';
import {CacheConfig, Disposable, Variables} from '../util/RelayRuntimeTypes';
import {ObservableFromValue, RelayObservable} from './RelayObservable';

/**
 * An interface for fetching the data for one or more (possibly interdependent)
 * queries.
 */
export interface Network {
    execute: ExecuteFunction;
    executeWithPreloadedSource?: ExecuteWithPreloadedSourceFunction;
    UNSTABLE_preloadQueryOnQueryAstLoad?: (
        queryID: string,
        variables: Variables,
    ) => void;
}
export type LogRequestInfoFunction = (arg: any) => void;

export interface PayloadData {
    [key: string]: any;
}

export interface PayloadError {
    message: string;
    locations?:
        | Array<{
            line: number;
            column: number;
        }>
        | undefined;
    path?: Array<string | number>;
    extensions?: PayloadExtensions;
    severity?: 'CRITICAL' | 'ERROR' | 'WARNING' | undefined; // Not officially part of the spec, but used at Facebook
}

export interface PayloadExtensions {
    [key: string]: any;
}

/**
 * The shape of a GraphQL response as dictated by the
 * [spec](https://graphql.github.io/graphql-spec/June2018/#sec-Response-Format)
 */
export interface GraphQLResponseWithData {
    data: PayloadData;
    errors?: PayloadError[] | undefined;
    extensions?: PayloadExtensions | undefined;
    label?: string | undefined;
    path?: Array<string | number> | undefined;
}
export interface GraphQLResponseWithoutData {
    data?: PayloadData | undefined;
    errors: PayloadError[];
    extensions?: PayloadExtensions | undefined;
    label?: string | undefined;
    path?: Array<string | number> | undefined;
}
export interface GraphQLResponseWithExtensionsOnly {
    // Per https://spec.graphql.org/June2018/#sec-Errors
    // > If the data entry in the response is not present, the errors entry
    // > in the response must not be empty. It must contain at least one error
    // This means a payload has to have either a data key or an errors key:
    // but the spec leaves room for the combination of data: null plus extensions
    // since `data: null` is a *required* output if there was an error during
    // execution, but the inverse is not described in the sepc: `data: null`
    // does not necessarily indicate that there was an error.
    data: null;
    extensions: PayloadExtensions;
}

export type GraphQLSingularResponse =
    | GraphQLResponseWithData
    | GraphQLResponseWithExtensionsOnly
    | GraphQLResponseWithoutData;

export type GraphQLResponse = GraphQLSingularResponse | readonly GraphQLSingularResponse[];

/**
 * A function that returns an Observable representing the response of executing
 * a GraphQL operation.
 */
export type ExecuteFunction = (
    request: RequestParameters,
    variables: Variables,
    cacheConfig: CacheConfig,
    uploadables?: UploadableMap | null,
) => RelayObservable<GraphQLResponse>;

export type CheckOperation = (
    operation: OperationDescriptor,
) => OperationAvailability;

// `CheckOperation` as if the records in `unpublished`, oldest first, were
// published over the store. Like it, commits what missing-field handlers
// supply; the records in `unpublished` stay unpublished.
export type CheckOperationWithUnpublished = (
    operation: OperationDescriptor,
    unpublished: readonly RecordSource[],
) => OperationAvailability;

export interface OperationAvailabilityConfig {
    readonly checkOperation: CheckOperation;
    // Set by environments that can also read records the caller holds without
    // having published them.
    readonly checkOperationWithUnpublished?: CheckOperationWithUnpublished | null | undefined;
    readonly parentOperation: OperationDescriptor | null | undefined;
}

/**
 * Allows a network to adopt a source that was started before the full request
 * artifact was available.
 */
export type ExecuteWithPreloadedSourceFunction = (
    request: RequestParameters,
    variables: Variables,
    cacheConfig: CacheConfig,
    source: RelayObservable<GraphQLResponse>,
    operationAvailability?: OperationAvailabilityConfig | null,
) => RelayObservable<GraphQLResponse>;

/**
 * A function that executes a GraphQL operation with request/response semantics.
 *
 * May return an Observable or Promise of a plain GraphQL server response, or
 * a composed ExecutePayload object supporting additional metadata.
 */
export type FetchFunction = (
    request: RequestParameters,
    variables: Variables,
    cacheConfig: CacheConfig,
    uploadables?: UploadableMap | null,
) => ObservableFromValue<GraphQLResponse>;

export interface LegacyObserver<T> {
    onCompleted?: (() => void) | undefined;
    onError?: ((error: Error) => void) | undefined;
    onNext?: ((data: T) => void) | undefined;
}

/**
 * A function that executes a GraphQL subscription operation, returning zero or
 * more raw server responses over time.
 */
export type SubscribeFunction = (
    request: RequestParameters,
    variables: Variables,
    cacheConfig: CacheConfig,
    observer?: LegacyObserver<GraphQLResponse>,
) => RelayObservable<GraphQLResponse> | Disposable;

export type Uploadable = File | Blob;
export interface UploadableMap {
    [key: string]: Uploadable;
}

/**
 * React Flight tree created on the server.
 */
export type ReactFlightServerTree = any;
export interface ReactFlightPayloadQuery {
    readonly id: any;
    readonly module: any;
    readonly response: GraphQLSingularResponse;
    readonly variables: Variables;
}
/**
 * Data that is returned by a Flight compliant GraphQL server.
 *
 * - tree: an array of values that will be iterated and fed into
 *     ReactFlightDOMRelayClient.
 * - queries: an array of queries that the server preloaded for the client.
 */
export interface ReactFlightPayloadData {
    readonly tree: ReactFlightServerTree[];
    readonly queries: ReactFlightPayloadQuery[];
}
