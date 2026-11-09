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
  NormalizationOperation,
  NormalizationSplitOperation,
} from './NormalizationNode';
import type {ReaderFragment, ReaderInlineDataFragment} from './ReaderNode';
import type {OperationType} from './RelayRuntimeTypes';

/**
 * Represents a common GraphQL request that can be executed, an `operation`
 * containing information to normalize the results, and a `fragment` derived
 * from that operation to read the response data (masking data from child
 * fragments).
 */
export type ConcreteRequest = {
  readonly kind: 'Request',
  readonly fragment: ReaderFragment,
  readonly operation: NormalizationOperation,
  readonly params: RequestParameters,
  readonly serverHandoff?: ServerHandoff,
};

export type ServerRequest = {
  readonly kind: 'Request',
  readonly fragment: ReaderFragment,
  readonly operation: NormalizationOperation,
  readonly params: RequestParameters,
  readonly serverHandoff: ServerHandoff,
};

/**
 * What a `@server` operation hands to client components: for each client
 * fragment it spreads, the Reader fragment, its normalization operation, and
 * the operation variables that normalization reads.
 */
export type ServerHandoff = {
  readonly clientFragments?: ReadonlyArray<{
    readonly fragment: ReaderFragment,
    readonly normalization: NormalizationSplitOperation,
    readonly rootVariables?: ReadonlyArray<string>,
  }>,
  ...
};

export type ConcreteUpdatableQuery = {
  readonly kind: 'UpdatableQuery',
  readonly fragment: ReaderFragment,
};

/**
 * A lightweight stand-in for a `ConcreteRequest` emitted by the compiler for
 * `@preloadable` queries: a `$Parameters.js` artifact containing only the
 * `RequestParameters` (e.g. the persisted query `id`), so that the full
 * normalization/reader AST can be code-split away from eager query loaders.
 *
 * This mirrors the type already published in the TypeScript declarations
 * (`RelayConcreteNode.d.ts`) and re-exported from `relay-runtime`'s
 * `index.d.ts`; the Flow definition previously only lived in `react-relay`
 * (`EntryPointTypes.flow.js`), so Flow consumers could not import it from
 * `relay-runtime` the way TypeScript consumers can.
 */
export type PreloadableConcreteRequest<out TQuery extends OperationType> = {
  kind: 'PreloadableConcreteRequest',
  params: RequestParameters,
  // Note: the phantom type parameter here helps ensures that the
  // $Parameters.js value matches the type param provided to preloadQuery.
  // We also need to add usage of this generic here,
  // becuase not using the generic in the definition makes it
  // unconstrained in the call to a function that accepts PreloadableConcreteRequest<T>
  readonly __phantom__?: ?TQuery,
};

export type NormalizationRootNode =
  ConcreteRequest | NormalizationSplitOperation;

export type ProvidedVariableType = {get(): unknown};

export type ProvidedVariablesType = {
  readonly [key: string]: ProvidedVariableType,
};

/**
 * Contains the parameters required for executing a GraphQL request.
 * The operation can either be provided as a persisted `id` or `text` or both.
 * If `text` format is provided, a `cacheID` as a hash of the text should be set
 * to be used for local caching.
 */
export type RequestParameters =
  | {
      readonly cacheID?: string,
      readonly id: string,
      readonly text: string | null,
      // Optional when the compiler is configured with `include_query_text: true`
      // for persisted queries — artifacts then carry both `id` and `text`, and a
      // `cacheID` (hash of the text) for local caching. See the doc comment above.
      readonly cacheID?: string,
      // common fields
      readonly name: string,
      readonly operationKind: 'mutation' | 'query' | 'subscription',
      readonly providedVariables?: ProvidedVariablesType,
      readonly metadata: {[key: string]: unknown, ...},
    }
  | {
      readonly cacheID: string,
      readonly id: null,
      readonly text: string | null,
      // common fields
      readonly name: string,
      readonly operationKind: 'mutation' | 'query' | 'subscription',
      readonly providedVariables?: ProvidedVariablesType,
      readonly metadata: {[key: string]: unknown, ...},
    };

export type ClientRequestParameters = {
  readonly cacheID: string,
  readonly id: null,
  readonly text: null,
  // common fields
  readonly name: string,
  readonly operationKind: 'query' | 'mutation',
  readonly providedVariables?: ProvidedVariablesType,
  readonly metadata: {[key: string]: unknown, ...},
};

export type ClientRequest = {
  readonly kind: 'Request',
  readonly fragment: ReaderFragment,
  readonly operation: NormalizationOperation,
  readonly params: ClientRequestParameters,
};

export type GeneratedNode =
  | ConcreteRequest
  | ServerRequest
  | ReaderFragment
  | ReaderInlineDataFragment
  | NormalizationSplitOperation
  | ConcreteUpdatableQuery;

const RelayConcreteNode = {
  ACTOR_CHANGE: 'ActorChange',
  CATCH_FIELD: 'CatchField',
  CONDITION: 'Condition',
  CLIENT_EDGE_TO_SERVER_OBJECT: 'ClientEdgeToServerObject',
  CLIENT_EDGE_TO_CLIENT_OBJECT: 'ClientEdgeToClientObject',
  CLIENT_EXTENSION: 'ClientExtension',
  DEFER: 'Defer',
  CONNECTION: 'Connection',
  FRAGMENT: 'Fragment',
  FRAGMENT_SPREAD: 'FragmentSpread',
  INLINE_DATA_FRAGMENT_SPREAD: 'InlineDataFragmentSpread',
  INLINE_DATA_FRAGMENT: 'InlineDataFragment',
  INLINE_FRAGMENT: 'InlineFragment',
  LINKED_FIELD: 'LinkedField',
  LINKED_HANDLE: 'LinkedHandle',
  LITERAL: 'Literal',
  LIST_VALUE: 'ListValue',
  LOCAL_ARGUMENT: 'LocalArgument',
  MODULE_IMPORT: 'ModuleImport',
  ALIASED_FRAGMENT_SPREAD: 'AliasedFragmentSpread',
  ALIASED_INLINE_FRAGMENT_SPREAD: 'AliasedInlineFragmentSpread',
  RELAY_RESOLVER: 'RelayResolver',
  RELAY_LIVE_RESOLVER: 'RelayLiveResolver',
  REQUIRED_FIELD: 'RequiredField',
  OBJECT_VALUE: 'ObjectValue',
  OPERATION: 'Operation',
  REQUEST: 'Request',
  ROOT_ARGUMENT: 'RootArgument',
  SCALAR_FIELD: 'ScalarField',
  SCALAR_HANDLE: 'ScalarHandle',
  SPLIT_OPERATION: 'SplitOperation',
  STREAM: 'Stream',
  TYPE_DISCRIMINATOR: 'TypeDiscriminator',
  UPDATABLE_QUERY: 'UpdatableQuery',
  VARIABLE: 'Variable',
} as const;

module.exports = RelayConcreteNode;
