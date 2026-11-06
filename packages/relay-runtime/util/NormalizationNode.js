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

import type {ResolverFunction, ResolverModule} from './ReaderNode';
import type {ConcreteRequest, ProvidedVariableType} from './RelayConcreteNode';
import type {JSResourceReference} from 'JSResourceReference';

/**
 * Represents a single operation used to processing and normalize runtime
 * request results.
 */
export type NormalizationOperation = {
  readonly kind: 'Operation',
  readonly name: string,
  readonly argumentDefinitions: ReadonlyArray<NormalizationLocalArgumentDefinition>,
  readonly selections: ReadonlyArray<NormalizationSelection>,
  readonly clientAbstractTypes?: {
    readonly [key: string]: ReadonlyArray<string>,
  },
  readonly has_client_to_server_resolvers?: boolean,
  readonly has_server_to_client_resolvers?: boolean,
  readonly use_exec_time_resolvers?: boolean,
  readonly exec_time_resolvers_enabled_provider?: ProvidedVariableType,
  readonly use_experimental_provider?: ProvidedVariableType,
  /**
   * When present, calling `.get()` returns whether the executeWithNetwork
   * coordinated-publish path should be used for this query. Lets engineers
   * opt into network normalization explicitly (e.g., for queries that select
   * S2C resolver fields under a rollout-gated `@include`).
   */
  readonly use_network_normalization_provider?: ProvidedVariableType,
};

export type NormalizationHandle =
  NormalizationScalarHandle | NormalizationLinkedHandle;

export type NormalizationLinkedHandle = {
  readonly kind: 'LinkedHandle',
  readonly alias?: ?string,
  readonly name: string,
  readonly args?: ?ReadonlyArray<NormalizationArgument>,
  readonly handle: string,
  readonly key: string,
  // NOTE: this property is optional because it's expected to be rarely used
  readonly dynamicKey?: ?NormalizationArgument,
  readonly filters?: ?ReadonlyArray<string>,
  readonly handleArgs?: ReadonlyArray<NormalizationArgument>,
};

export type NormalizationScalarHandle = {
  readonly kind: 'ScalarHandle',
  readonly alias?: ?string,
  readonly name: string,
  readonly args?: ?ReadonlyArray<NormalizationArgument>,
  readonly handle: string,
  readonly key: string,
  // NOTE: this property is optional because it's expected to be rarely used
  readonly dynamicKey?: ?NormalizationArgument,
  readonly filters?: ?ReadonlyArray<string>,
  readonly handleArgs?: ReadonlyArray<NormalizationArgument>,
};

export type NormalizationArgument =
  | NormalizationListValueArgument
  | NormalizationLiteralArgument
  | NormalizationObjectValueArgument
  | NormalizationVariableArgument;

export type NormalizationCondition = {
  readonly kind: 'Condition',
  readonly passingValue: boolean,
  readonly condition: string,
  readonly selections: ReadonlyArray<NormalizationSelection>,
};

export type NormalizationClientExtension = {
  readonly kind: 'ClientExtension',
  readonly selections: ReadonlyArray<NormalizationSelection>,
};

export type NormalizationField =
  | NormalizationResolverField
  | NormalizationLiveResolverField
  | NormalizationScalarField
  | NormalizationLinkedField;

export type NormalizationInlineFragment = {
  readonly kind: 'InlineFragment',
  readonly selections: ReadonlyArray<NormalizationSelection>,
  readonly type: string,
  readonly abstractKey?: ?string,
};

export type NormalizationFragmentSpread = {
  readonly kind: 'FragmentSpread',
  readonly fragment: NormalizationSplitOperation,
  readonly args?: ?ReadonlyArray<NormalizationArgument>,
};

export type NormalizationLinkedField = {
  readonly kind: 'LinkedField',
  readonly alias?: ?string,
  readonly name: string,
  readonly storageKey?: ?string,
  readonly args?: ?ReadonlyArray<NormalizationArgument>,
  readonly concreteType?: ?string,
  readonly plural: boolean,
  readonly selections: ReadonlyArray<NormalizationSelection>,
};

export type NormalizationActorChange = {
  readonly kind: 'ActorChange',
  readonly linkedField: NormalizationLinkedField,
};

export type NormalizationModuleImport = {
  readonly args?: ?ReadonlyArray<NormalizationArgument>,
  readonly kind: 'ModuleImport',
  readonly documentName: string,
  readonly fragmentPropName: string,
  readonly fragmentName: string,
  readonly componentModuleProvider?: () =>
    unknown | Promise<unknown> | JSResourceReference<unknown>,
  readonly operationModuleProvider?: () =>
    | NormalizationRootNode
    | Promise<NormalizationRootNode>
    | JSResourceReference<NormalizationRootNode>,
};

export type NormalizationListValueArgument = {
  readonly kind: 'ListValue',
  readonly name: string,
  readonly items: ReadonlyArray<NormalizationArgument | null>,
};

export type NormalizationLiteralArgument = {
  readonly kind: 'Literal',
  readonly name: string,
  readonly type?: ?string,
  readonly value: unknown,
};

export type NormalizationLocalArgumentDefinition = {
  readonly kind: 'LocalArgument',
  readonly name: string,
  readonly defaultValue: unknown,
};

export type NormalizationNode =
  | NormalizationClientExtension
  | NormalizationCondition
  | NormalizationDefer
  | NormalizationInlineFragment
  | NormalizationLinkedField
  | NormalizationOperation
  | NormalizationSplitOperation
  | NormalizationStream;

export type NormalizationScalarField = {
  readonly kind: 'ScalarField',
  readonly alias?: ?string,
  readonly name: string,
  readonly args?: ?ReadonlyArray<NormalizationArgument>,
  readonly storageKey?: ?string,
};

export type ResolverReference = {
  readonly fieldType: string,
  readonly resolverFunctionName: string,
};

export type ResolverInfo = {
  readonly resolverFunction: ResolverFunction,
  readonly rootFragment?: ?NormalizationSplitOperation,
};

type ResolverData =
  | {readonly resolverModule?: ResolverModule}
  | {readonly resolverReference?: ResolverReference}
  | {readonly resolverInfo?: ResolverInfo};

export type NormalizationResolverField = {
  readonly kind: 'RelayResolver',
  readonly name: string,
  readonly args?: ?ReadonlyArray<NormalizationArgument>,
  readonly fragment?: ?NormalizationInlineFragment,
  readonly storageKey?: ?string,
  readonly isOutputType: boolean,
  ...ResolverData,
};

export type NormalizationLiveResolverField = {
  readonly kind: 'RelayLiveResolver',
  readonly name: string,
  readonly args?: ?ReadonlyArray<NormalizationArgument>,
  readonly fragment?: ?NormalizationInlineFragment,
  readonly storageKey?: ?string,
  readonly isOutputType: boolean,
  ...ResolverData,
};

export type NormalizationModelResolvers = {
  [key: string]: {
    readonly resolverModule: ResolverModule,
  },
};

export type NormalizationClientEdgeToClientObject = {
  readonly kind: 'ClientEdgeToClientObject',
  readonly linkedField: NormalizationLinkedField,
  readonly backingField:
    NormalizationResolverField | NormalizationLiveResolverField,
  readonly modelResolvers?: NormalizationModelResolvers | null,
};

export type NormalizationClientEdgeToServerObject = {
  readonly kind: 'ClientEdgeToServerObject',
  readonly linkedField: NormalizationLinkedField,
  readonly backingField:
    NormalizationResolverField | NormalizationLiveResolverField,
  readonly operation: ConcreteRequest,
};

export type NormalizationTypeDiscriminator = {
  readonly kind: 'TypeDiscriminator',
  readonly abstractKey: string,
};

export type NormalizationSelection =
  | NormalizationCondition
  | NormalizationClientExtension
  | NormalizationClientEdgeToClientObject
  | NormalizationClientEdgeToServerObject
  | NormalizationDefer
  | NormalizationField
  | NormalizationFragmentSpread
  | NormalizationHandle
  | NormalizationInlineFragment
  | NormalizationModuleImport
  | NormalizationStream
  | NormalizationActorChange
  | NormalizationTypeDiscriminator;

export type NormalizationSplitOperation = {
  readonly argumentDefinitions?: ReadonlyArray<NormalizationLocalArgumentDefinition>,
  readonly kind: 'SplitOperation',
  readonly name: string,
  readonly metadata?: ?{readonly [key: string]: unknown, ...},
  readonly selections: ReadonlyArray<NormalizationSelection>,
};

export type NormalizationStream = {
  readonly if: string | null,
  readonly kind: 'Stream',
  readonly label: string,
  readonly selections: ReadonlyArray<NormalizationSelection>,
};

export type NormalizationDefer = {
  readonly if: string | null,
  readonly kind: 'Defer',
  readonly label: string,
  readonly selections: ReadonlyArray<NormalizationSelection>,
};

export type NormalizationVariableArgument = {
  readonly kind: 'Variable',
  readonly name: string,
  readonly type?: ?string,
  readonly variableName: string,
};

export type NormalizationObjectValueArgument = {
  readonly kind: 'ObjectValue',
  readonly name: string,
  readonly fields: ReadonlyArray<NormalizationArgument>,
};

export type NormalizationSelectableNode =
  | NormalizationDefer
  | NormalizationLinkedField
  | NormalizationOperation
  | NormalizationSplitOperation
  | NormalizationStream;

export type NormalizationRootNode =
  ConcreteRequest | NormalizationSplitOperation;
