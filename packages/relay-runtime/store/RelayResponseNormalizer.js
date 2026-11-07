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

import type {ActorIdentifier} from '../multi-actor-environment/ActorIdentifier';
import type {PayloadData, PayloadError} from '../network/RelayNetworkTypes';
import type {
  NormalizationActorChange,
  NormalizationArgument,
  NormalizationClientEdgeToClientObject,
  NormalizationClientEdgeToServerObject,
  NormalizationDefer,
  NormalizationInlineFragment,
  NormalizationLinkedField,
  NormalizationLiveResolverField,
  NormalizationModuleImport,
  NormalizationNode,
  NormalizationResolverField,
  NormalizationScalarField,
  NormalizationSplitOperation,
  NormalizationStream,
} from '../util/NormalizationNode';
import type {DataID, Variables} from '../util/RelayRuntimeTypes';
import type {RelayErrorTrie} from './RelayErrorTrie';
import type {
  FollowupPayload,
  HandleFieldPayload,
  IdCollisionTypenameLogEvent,
  IncrementalDataPlaceholder,
  LogFunction,
  MutableRecordSource,
  NormalizationSelector,
  Record,
  RelayResponsePayload,
} from './RelayStoreTypes';

const {
  ACTOR_IDENTIFIER_FIELD_NAME,
  getActorIdentifierFromPayload,
} = require('../multi-actor-environment/ActorUtils');
const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const {generateClientID, isClientID} = require('./ClientID');
const {getLocalVariables} = require('./RelayConcreteVariables');
const {
  buildErrorTrie,
  getErrorsByKey,
  getNestedErrorTrieByKey,
} = require('./RelayErrorTrie');
const RelayModernRecord = require('./RelayModernRecord');
const {createNormalizationSelector} = require('./RelayModernSelector');
const {
  ROOT_ID,
  ROOT_TYPE,
  TYPENAME_KEY,
  getArgumentValues,
  getHandleStorageKey,
  getModuleComponentKey,
  getModuleOperationKey,
  getStorageKey,
} = require('./RelayStoreUtils');
const {TYPE_SCHEMA_TYPE, generateTypeID} = require('./TypeID');
const areEqual = require('areEqual');
const invariant = require('invariant');
const warning = require('warning');

export type GetDataID = (
  fieldValue: {readonly [key: string]: unknown},
  typeName: string,
) => unknown;

export type NormalizationOptions = {
  readonly getDataID: GetDataID,
  readonly treatMissingFieldsAsNull: boolean,
  readonly deferDeduplicatedFields: boolean,
  readonly log: ?LogFunction,
  readonly path?: ReadonlyArray<string>,
  readonly actorIdentifier?: ?ActorIdentifier,
};

/**
 * Normalizes the results of a query and standard GraphQL response, writing the
 * normalized records/fields into the given MutableRecordSource.
 */
function normalize(
  recordSource: MutableRecordSource,
  selector: NormalizationSelector,
  response: PayloadData,
  options: NormalizationOptions,
  errors?: Array<PayloadError>,
  useExecTimeResolvers?: boolean,
): RelayResponsePayload {
  const {dataID, node, variables} = selector;
  const normalizer = new RelayResponseNormalizer(
    recordSource,
    variables,
    options,
    useExecTimeResolvers ?? false,
  );
  return normalizer.normalizeResponse(node, dataID, response, errors);
}

/**
 * @private
 *
 * Helper for handling payloads.
 */
class RelayResponseNormalizer {
  _actorIdentifier: ?ActorIdentifier;
  _getDataId: GetDataID;
  _handleFieldPayloads: Array<HandleFieldPayload>;
  _treatMissingFieldsAsNull: boolean;
  _deferDeduplicatedFields: boolean;
  _incrementalPlaceholders: Array<IncrementalDataPlaceholder>;
  _isClientExtension: boolean;
  _isUnmatchedAbstractType: boolean;
  _followupPayloads: Array<FollowupPayload>;
  _path: Array<string>;
  _recordSource: MutableRecordSource;
  _variables: Variables;
  _useExecTimeResolvers: boolean;
  _errorTrie: RelayErrorTrie | null;
  _log: ?LogFunction;
  _s2cExecutions: Map<
    DataID,
    {
      selections: Array<
        | NormalizationClientEdgeToClientObject
        | NormalizationClientEdgeToServerObject
        | NormalizationLiveResolverField
        | NormalizationResolverField,
      >,
      typeName: string,
    },
  >;

  constructor(
    recordSource: MutableRecordSource,
    variables: Variables,
    options: NormalizationOptions,
    useExecTimeResolvers: boolean,
  ) {
    this._actorIdentifier = options.actorIdentifier;
    this._getDataId = options.getDataID;
    this._handleFieldPayloads = [];
    this._treatMissingFieldsAsNull = options.treatMissingFieldsAsNull;
    this._deferDeduplicatedFields = options.deferDeduplicatedFields;
    this._incrementalPlaceholders = [];
    this._isClientExtension = false;
    this._isUnmatchedAbstractType = false;
    this._useExecTimeResolvers = useExecTimeResolvers;
    this._followupPayloads = [];
    this._path = options.path ? [...options.path] : [];
    this._recordSource = recordSource;
    this._variables = variables;
    this._log = options.log;
    this._s2cExecutions = new Map();
  }

  normalizeResponse(
    node: NormalizationNode,
    dataID: DataID,
    data: PayloadData,
    errors?: Array<PayloadError>,
  ): RelayResponsePayload {
    const record = this._recordSource.get(dataID);
    invariant(
      record,
      'RelayResponseNormalizer(): Expected root record `%s` to exist.',
      dataID,
    );
    this._assignClientAbstractTypes(node);
    this._errorTrie = buildErrorTrie(errors);
    this._traverseSelections(node, record, data);
    return {
      errors,
      fieldPayloads: this._handleFieldPayloads,
      followupPayloads: this._followupPayloads,
      incrementalPlaceholders: this._incrementalPlaceholders,
      isFinal: false,
      s2cExecutions:
        this._s2cExecutions.size > 0
          ? Array.from(this._s2cExecutions.entries()).map(
              ([recordID, entry]) => ({
                recordID,
                selections: entry.selections,
                typeName: entry.typeName,
              }),
            )
          : undefined,
      source: this._recordSource,
    };
  }

  // For abstract types defined in the client schema extension, we won't be
  // getting `__is<AbstractType>` hints from the server. To handle this, the
  // compiler attaches additional metadata on the normalization artifact,
  // which we need to record into the store.
  _assignClientAbstractTypes(node: NormalizationNode) {
    const {clientAbstractTypes} = node;
    if (clientAbstractTypes != null) {
      for (const abstractType of Object.keys(clientAbstractTypes)) {
        for (const concreteType of clientAbstractTypes[abstractType]) {
          const typeID = generateTypeID(concreteType);
          let typeRecord = this._recordSource.get(typeID);
          if (typeRecord == null) {
            typeRecord = RelayModernRecord.create(typeID, TYPE_SCHEMA_TYPE);
            this._recordSource.set(typeID, typeRecord);
          }
          RelayModernRecord.setValue(typeRecord, abstractType, true);
        }
      }
    }
  }

  _getVariableValue(name: string): unknown {
    invariant(
      this._variables.hasOwnProperty(name),
      'RelayResponseNormalizer(): Undefined variable `%s`.',
      name,
    );
    return this._variables[name];
  }

  _getRecordType(data: PayloadData): string {
    const typeName = (data as any)[TYPENAME_KEY];
    invariant(
      typeName != null,
      'RelayResponseNormalizer(): Expected a typename for record `%s`.',
      JSON.stringify(data, null, 2),
    );
    return typeName;
  }

  _traverseSelections(
    node: NormalizationNode,
    record: Record,
    data: PayloadData,
  ): void {
    for (let i = 0; i < node.selections.length; i++) {
      const selection = node.selections[i];
      switch (selection.kind) {
        case 'ScalarField':
        case 'LinkedField':
          this._normalizeField(selection, record, data);
          break;
        case 'Condition':
          const conditionValue = Boolean(
            this._getVariableValue(selection.condition),
          );
          if (conditionValue === selection.passingValue) {
            this._traverseSelections(selection, record, data);
          }
          break;
        case 'FragmentSpread': {
          const prevVariables = this._variables;
          this._variables = getLocalVariables(
            this._variables,
            selection.fragment.argumentDefinitions,
            selection.args,
          );
          this._traverseSelections(selection.fragment, record, data);
          this._variables = prevVariables;
          break;
        }
        case 'InlineFragment': {
          this._normalizeInlineFragment(selection, record, data);
          break;
        }
        case 'TypeDiscriminator': {
          const {abstractKey} = selection;
          // $FlowFixMe[method-unbinding] - data could be prototype less
          /* $FlowFixMe[invalid-this-arg] Error exposed after fixing this
           * typing unsoundness in flow */
          const implementsInterface = Object.prototype.hasOwnProperty.call(
            data,
            abstractKey,
          );
          // Under `deferDeduplicatedFields` a missing abstract typename means
          // the server omitted it as already-delivered, not that the concrete
          // type fails the type refinement. Skip the write; DataChecker then
          // treats the entry as unknown and refetches on the next check.
          if (implementsInterface || !this._deferDeduplicatedFields) {
            const typeName = RelayModernRecord.getType(record);
            const typeID = generateTypeID(typeName);
            let typeRecord = this._recordSource.get(typeID);
            if (typeRecord == null) {
              typeRecord = RelayModernRecord.create(typeID, TYPE_SCHEMA_TYPE);
              this._recordSource.set(typeID, typeRecord);
            }
            RelayModernRecord.setValue(
              typeRecord,
              abstractKey,
              implementsInterface,
            );
          }
          break;
        }
        case 'LinkedHandle':
        case 'ScalarHandle':
          const args = selection.args
            ? getArgumentValues(selection.args, this._variables)
            : {};
          const fieldKey = getStorageKey(selection, this._variables);
          const handleKey = getHandleStorageKey(selection, this._variables);
          this._handleFieldPayloads.push({
            args,
            dataID: RelayModernRecord.getDataID(record),
            fieldKey,
            handle: selection.handle,
            handleArgs: selection.handleArgs
              ? getArgumentValues(selection.handleArgs, this._variables)
              : {},
            handleKey,
          });
          break;
        case 'ModuleImport':
          this._normalizeModuleImport(selection, record, data);
          break;
        case 'Defer':
          this._normalizeDefer(selection, record, data);
          break;
        case 'Stream':
          this._normalizeStream(selection, record, data);
          break;
        case 'ClientExtension':
          const isClientExtension = this._isClientExtension;
          this._isClientExtension = true;
          this._traverseSelections(selection, record, data);
          this._isClientExtension = isClientExtension;
          break;
        case 'ActorChange':
          this._normalizeActorChange(selection, record, data);
          break;
        case 'RelayResolver':
        case 'RelayLiveResolver': {
          if (!this._useExecTimeResolvers) {
            this._normalizeResolver(selection, record, data);
            break;
          }
          const rootFragment = selection.resolverInfo?.rootFragment;
          if (rootFragment != null) {
            this._normalizeResolverRootFragment(
              rootFragment,
              selection.args,
              record,
              data,
            );
            this._collectS2CExecution(selection, record);
          }
          break;
        }
        case 'ClientEdgeToClientObject':
        case 'ClientEdgeToServerObject': {
          // Both variants share the same shape (linkedField, backingField,
          // resolverInfo) for the purposes of normalization. C2S edges are
          // only intended for the exec-time path (compiler enforces it), so
          // the !useExecTimeResolvers branch is treated as a regular client
          // edge backing — the read path will fail later if a C2S edge ever
          // reaches it without exec-time resolvers enabled.
          if (!this._useExecTimeResolvers) {
            this._normalizeResolver(selection.backingField, record, data);
            break;
          }
          const edgeRootFragment =
            selection.backingField.resolverInfo?.rootFragment;
          if (edgeRootFragment != null) {
            this._normalizeResolverRootFragment(
              edgeRootFragment,
              selection.backingField.args,
              record,
              data,
            );
            this._collectS2CExecution(selection, record);
          }
          break;
        }
        default:
          selection as empty;
          invariant(
            false,
            'RelayResponseNormalizer(): Unexpected ast kind `%s`.',
            selection.kind,
          );
      }
    }
  }

  _normalizeInlineFragment(
    selection: NormalizationInlineFragment,
    record: Record,
    data: PayloadData,
  ) {
    const {abstractKey} = selection;
    if (abstractKey == null) {
      const typeName = RelayModernRecord.getType(record);
      if (
        typeName === selection.type ||
        // The root record type is a special `__Root` type and may not match the
        // type on the ast, so ignore type mismatches at the root.  We currently
        // detect whether we're at the root by checking against ROOT_ID, but this
        // does not work for mutations/subscriptions which generate unique root
        // ids. This is acceptable in practice as we don't read data for
        // mutations/subscriptions in a situation where we would use
        // isMissingData to decide whether to suspend or not.
        // TODO T96653810: Correctly detect reading from root of mutation/subscription
        typeName === ROOT_TYPE
      ) {
        this._traverseSelections(selection, record, data);
      }
    } else {
      // $FlowFixMe[method-unbinding] - data could be prototype less
      /* $FlowFixMe[invalid-this-arg] Error exposed after fixing this typing
       * unsoundness in flow */
      const implementsInterface = Object.prototype.hasOwnProperty.call(
        data,
        abstractKey,
      );
      // See the `TypeDiscriminator` case above for the reasoning.
      if (implementsInterface || !this._deferDeduplicatedFields) {
        const typeName = RelayModernRecord.getType(record);
        const typeID = generateTypeID(typeName);
        let typeRecord = this._recordSource.get(typeID);
        if (typeRecord == null) {
          typeRecord = RelayModernRecord.create(typeID, TYPE_SCHEMA_TYPE);
          this._recordSource.set(typeID, typeRecord);
        }
        RelayModernRecord.setValue(
          typeRecord,
          abstractKey,
          implementsInterface,
        );
      }
      if (implementsInterface) {
        this._traverseSelections(selection, record, data);
      }
    }
  }

  _normalizeResolver(
    resolver: NormalizationResolverField | NormalizationLiveResolverField,
    record: Record,
    data: PayloadData,
  ) {
    if (resolver.fragment != null) {
      this._normalizeInlineFragment(resolver.fragment, record, data);
    }
  }

  /**
   * The exec-time counterpart of `_normalizeResolver`. A resolver's root
   * fragment is spread into the operation text, so the server sends its fields,
   * but it rides the artifact as a SplitOperation hanging off `resolverInfo`
   * rather than as sibling selections — so only an explicit descent writes it
   * to the store. Without this the field arrives in the response and is
   * dropped, and the exec-time projection has nothing to copy.
   *
   * `hasServerField` is set by the compiler on the split operation. An
   * identity-only or client-only root fragment — the overwhelming majority —
   * therefore costs one property read and no traversal.
   *
   * The split operation is written against the root fragment's own
   * `@argumentDefinitions` (e.g. `nodes(ids: $ids)`), which the operation need
   * not declare, so it is walked in the fragment's scope, bound from the
   * resolver field's arguments — as a `FragmentSpread` is.
   */
  _normalizeResolverRootFragment(
    rootFragment: NormalizationSplitOperation,
    args: ?ReadonlyArray<NormalizationArgument>,
    record: Record,
    data: PayloadData,
  ): void {
    if (rootFragment.metadata?.hasServerField === true) {
      const prevVariables = this._variables;
      this._variables = getLocalVariables(
        this._variables,
        rootFragment.argumentDefinitions,
        args,
      );
      this._traverseSelections(rootFragment, record, data);
      this._variables = prevVariables;
    }
  }

  _collectS2CExecution(
    selection:
      | NormalizationClientEdgeToClientObject
      | NormalizationClientEdgeToServerObject
      | NormalizationLiveResolverField
      | NormalizationResolverField,
    record: Record,
  ): void {
    const recordID = RelayModernRecord.getDataID(record);
    const typeName = RelayModernRecord.getType(record);
    let entry = this._s2cExecutions.get(recordID);
    if (entry == null) {
      entry = {selections: [], typeName};
      this._s2cExecutions.set(recordID, entry);
    }
    entry.selections.push(selection);
  }

  _normalizeDefer(
    defer: NormalizationDefer,
    record: Record,
    data: PayloadData,
  ) {
    const isDeferred = defer.if === null || this._getVariableValue(defer.if);
    if (__DEV__) {
      warning(
        typeof isDeferred === 'boolean',
        'RelayResponseNormalizer: Expected value for @defer `if` argument to ' +
          'be a boolean, got `%s`.',
        isDeferred,
      );
    }
    if (isDeferred === false) {
      // If defer is disabled there will be no additional response chunk:
      // normalize the data already present.
      this._traverseSelections(defer, record, data);
    } else {
      // Otherwise data *for this selection* should not be present: enqueue
      // metadata to process the subsequent response chunk.
      this._incrementalPlaceholders.push({
        actorIdentifier: this._actorIdentifier,
        data,
        kind: 'defer',
        label: defer.label,
        path: [...this._path],
        selector: createNormalizationSelector(
          defer,
          RelayModernRecord.getDataID(record),
          this._variables,
        ),
        typeName: RelayModernRecord.getType(record),
      });
    }
  }

  _normalizeStream(
    stream: NormalizationStream,
    record: Record,
    data: PayloadData,
  ) {
    // Always normalize regardless of whether streaming is enabled or not,
    // this populates the initial array value (including any items when
    // initial_count > 0).
    this._traverseSelections(stream, record, data);
    const isStreamed = stream.if === null || this._getVariableValue(stream.if);
    if (__DEV__) {
      warning(
        typeof isStreamed === 'boolean',
        'RelayResponseNormalizer: Expected value for @stream `if` argument ' +
          'to be a boolean, got `%s`.',
        isStreamed,
      );
    }
    if (isStreamed === true) {
      // If streaming is enabled, *also* emit metadata to process any
      // response chunks that may be delivered.
      this._incrementalPlaceholders.push({
        actorIdentifier: this._actorIdentifier,
        kind: 'stream',
        label: stream.label,
        node: stream,
        parentID: RelayModernRecord.getDataID(record),
        path: [...this._path],
        variables: this._variables,
      });
    }
  }

  _normalizeModuleImport(
    moduleImport: NormalizationModuleImport,
    record: Record,
    data: PayloadData,
  ): void {
    invariant(
      typeof data === 'object' && data,
      'RelayResponseNormalizer: Expected data for @module to be an object.',
    );
    const typeName: string = RelayModernRecord.getType(record);
    const componentKey = getModuleComponentKey(moduleImport.documentName);
    const componentReference =
      moduleImport.componentModuleProvider || data[componentKey];
    RelayModernRecord.setValue(
      record,
      componentKey,
      componentReference ?? null,
    );
    const operationKey = getModuleOperationKey(moduleImport.documentName);
    const operationReference =
      moduleImport.operationModuleProvider || data[operationKey];
    RelayModernRecord.setValue(
      record,
      operationKey,
      operationReference ?? null,
    );
    if (operationReference != null) {
      this._followupPayloads.push({
        actorIdentifier: this._actorIdentifier,
        args: moduleImport.args,
        data,
        dataID: RelayModernRecord.getDataID(record),
        kind: 'ModuleImportPayload',
        operationReference,
        path: [...this._path],
        typeName,
        variables: this._variables,
      });
    }
  }

  _normalizeField(
    selection: NormalizationLinkedField | NormalizationScalarField,
    record: Record,
    data: PayloadData,
  ): void {
    invariant(
      typeof data === 'object' && data,
      'writeField(): Expected data for field `%s` to be an object.',
      selection.name,
    );
    const responseKey = selection.alias || selection.name;
    const storageKey = getStorageKey(selection, this._variables);
    const fieldValue = data[responseKey];
    const isNoncompliantlyNullish =
      RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS &&
      Array.isArray(fieldValue) &&
      fieldValue.length === 0;
    if (fieldValue == null || isNoncompliantlyNullish) {
      if (fieldValue === undefined) {
        // Fields may be missing in the response in two main cases:
        // - Inside a client extension: the server will not generally return
        //   values for these fields, but a local update may provide them.
        // - Inside an abstract type refinement where the concrete type does
        //   not conform to the interface/union.
        // However an otherwise-required field may also be missing if the server
        // is configured to skip fields with `null` values, in which case the
        // client is assumed to be correctly configured with
        // treatMissingFieldsAsNull=true.
        const isOptionalField =
          this._isClientExtension ||
          this._isUnmatchedAbstractType ||
          this._deferDeduplicatedFields;

        if (isOptionalField) {
          // Field not expected to exist regardless of whether the server is pruning null
          // fields or not.
          return;
        } else if (!this._treatMissingFieldsAsNull) {
          // Not optional and the server is not pruning null fields: field is expected
          // to be present
          if (__DEV__) {
            warning(
              false,
              'RelayResponseNormalizer: Payload did not contain a value ' +
                'for field `%s: %s`. Check that you are parsing with the same ' +
                'query that was used to fetch the payload.',
              responseKey,
              storageKey,
            );
          }
          return;
        }
      }
      if (selection.kind === 'ScalarField') {
        this._validateConflictingFieldsWithIdenticalId(
          record,
          storageKey,
          // When using `treatMissingFieldsAsNull` the conflicting validation raises a false positive
          // because the value is set using `null` but validated using `fieldValue` which at this point
          // will be `undefined`.
          // Setting this to `null` matches the value that we actually set to the `fieldValue`.
          null,
        );
      }
      if (isNoncompliantlyNullish) {
        // We need to preserve the fact that we received an empty list
        if (selection.kind === 'LinkedField') {
          RelayModernRecord.setLinkedRecordIDs(record, storageKey, []);
        } else {
          RelayModernRecord.setValue(record, storageKey, []);
        }
      } else {
        RelayModernRecord.setValue(record, storageKey, null);
      }
      const errorTrie = this._errorTrie;
      if (errorTrie != null) {
        const errors = getErrorsByKey(errorTrie, responseKey);
        if (errors != null) {
          RelayModernRecord.setErrors(record, storageKey, errors);
        }
      }
      return;
    }

    if (selection.kind === 'ScalarField') {
      this._validateConflictingFieldsWithIdenticalId(
        record,
        storageKey,
        fieldValue,
      );
      RelayModernRecord.setValue(record, storageKey, fieldValue);
    } else if (selection.kind === 'LinkedField') {
      this._path.push(responseKey);
      const oldErrorTrie = this._errorTrie;
      this._errorTrie =
        oldErrorTrie == null
          ? null
          : getNestedErrorTrieByKey(oldErrorTrie, responseKey);
      if (selection.plural) {
        this._normalizePluralLink(selection, record, storageKey, fieldValue);
      } else {
        this._normalizeLink(selection, record, storageKey, fieldValue);
      }
      this._errorTrie = oldErrorTrie;
      this._path.pop();
    } else {
      selection as empty;
      invariant(
        false,
        'RelayResponseNormalizer(): Unexpected ast kind `%s` during normalization.',
        selection.kind,
      );
    }
  }

  _normalizeActorChange(
    selection: NormalizationActorChange,
    record: Record,
    data: PayloadData,
  ): void {
    const field = selection.linkedField;
    invariant(
      typeof data === 'object' && data,
      '_normalizeActorChange(): Expected data for field `%s` to be an object.',
      field.name,
    );
    const responseKey = field.alias || field.name;
    const storageKey = getStorageKey(field, this._variables);
    const fieldValue = data[responseKey];

    if (fieldValue == null) {
      if (fieldValue === undefined) {
        const isOptionalField =
          this._isClientExtension || this._isUnmatchedAbstractType;

        if (isOptionalField) {
          return;
        } else if (!this._treatMissingFieldsAsNull) {
          if (__DEV__) {
            warning(
              false,
              'RelayResponseNormalizer: Payload did not contain a value ' +
                'for field `%s: %s`. Check that you are parsing with the same ' +
                'query that was used to fetch the payload.',
              responseKey,
              storageKey,
            );
          }
          return;
        }
      }
      RelayModernRecord.setValue(record, storageKey, null);
      return;
    }

    const actorIdentifier = getActorIdentifierFromPayload(fieldValue);
    if (actorIdentifier == null) {
      if (__DEV__) {
        warning(
          false,
          'RelayResponseNormalizer: Payload did not contain a value ' +
            'for field `%s`. Check that you are parsing with the same ' +
            'query that was used to fetch the payload. Payload is `%s`.',
          ACTOR_IDENTIFIER_FIELD_NAME,
          JSON.stringify(fieldValue, null, 2),
        );
      }
      RelayModernRecord.setValue(record, storageKey, null);
      return;
    }

    // $FlowFixMe[incompatible-type]
    const typeName = field.concreteType ?? this._getRecordType(fieldValue);
    const nextID =
      this._getDataId(
        // $FlowFixMe[incompatible-type]
        fieldValue,
        typeName,
      ) ||
      RelayModernRecord.getLinkedRecordID(record, storageKey) ||
      generateClientID(RelayModernRecord.getDataID(record), storageKey);

    invariant(
      typeof nextID === 'string',
      'RelayResponseNormalizer: Expected id on field `%s` to be a string.',
      storageKey,
    );

    RelayModernRecord.setActorLinkedRecordID(
      record,
      storageKey,
      actorIdentifier,
      nextID,
    );

    this._followupPayloads.push({
      actorIdentifier,
      data: fieldValue as $FlowFixMe,
      dataID: nextID,
      kind: 'ActorPayload',
      node: field,
      path: [...this._path, responseKey],
      typeName,
      variables: this._variables,
    });
  }

  _normalizeLink(
    field: NormalizationLinkedField,
    record: Record,
    storageKey: string,
    fieldValue: unknown,
  ): void {
    invariant(
      typeof fieldValue === 'object' && fieldValue,
      'RelayResponseNormalizer: Expected data for field `%s` to be an object.',
      storageKey,
    );
    const nextID =
      this._getDataId(
        // $FlowFixMe[incompatible-variance]
        fieldValue,
        // $FlowFixMe[incompatible-variance]
        field.concreteType ?? this._getRecordType(fieldValue),
      ) ||
      // Reuse previously generated client IDs
      RelayModernRecord.getLinkedRecordID(record, storageKey) ||
      generateClientID(RelayModernRecord.getDataID(record), storageKey);
    invariant(
      typeof nextID === 'string',
      'RelayResponseNormalizer: Expected id on field `%s` to be a string.',
      storageKey,
    );
    this._validateConflictingLinkedFieldsWithIdenticalId(
      RelayModernRecord.getLinkedRecordID(record, storageKey),
      nextID,
      storageKey,
    );
    RelayModernRecord.setLinkedRecordID(record, storageKey, nextID);
    let nextRecord = this._recordSource.get(nextID);
    if (!nextRecord) {
      // $FlowFixMe[incompatible-variance]
      const typeName = field.concreteType || this._getRecordType(fieldValue);
      nextRecord = RelayModernRecord.create(nextID, typeName);
      this._recordSource.set(nextID, nextRecord);
    } else {
      this._validateRecordType(nextRecord, field, fieldValue);
    }
    // $FlowFixMe[incompatible-variance]
    this._traverseSelections(field, nextRecord, fieldValue);
  }

  _normalizePluralLink(
    field: NormalizationLinkedField,
    record: Record,
    storageKey: string,
    fieldValue: unknown,
  ): void {
    invariant(
      Array.isArray(fieldValue),
      'RelayResponseNormalizer: Expected data for field `%s` to be an array ' +
        'of objects.',
      storageKey,
    );
    const prevIDs = RelayModernRecord.getLinkedRecordIDs(record, storageKey);
    const nextIDs: Array<?DataID> = [];
    fieldValue.forEach((item, nextIndex) => {
      // validate response data
      if (item == null) {
        nextIDs.push(item);
        return;
      }
      this._path.push(String(nextIndex));
      const oldErrorTrie = this._errorTrie;
      this._errorTrie =
        oldErrorTrie == null
          ? null
          : getNestedErrorTrieByKey(oldErrorTrie, nextIndex);
      invariant(
        typeof item === 'object',
        'RelayResponseNormalizer: Expected elements for field `%s` to be ' +
          'objects.',
        storageKey,
      );
      const nextID =
        this._getDataId(
          // $FlowFixMe[incompatible-variance]
          item,
          // $FlowFixMe[incompatible-variance]
          field.concreteType ?? this._getRecordType(item),
        ) ||
        (prevIDs && prevIDs[nextIndex]) || // Reuse previously generated client IDs:
        generateClientID(
          RelayModernRecord.getDataID(record),
          storageKey,
          nextIndex,
        );
      invariant(
        typeof nextID === 'string',
        'RelayResponseNormalizer: Expected id of elements of field `%s` to ' +
          'be strings.',
        storageKey,
      );

      nextIDs.push(nextID);
      let nextRecord = this._recordSource.get(nextID);
      if (!nextRecord) {
        // $FlowFixMe[incompatible-variance]
        const typeName = field.concreteType || this._getRecordType(item);
        nextRecord = RelayModernRecord.create(nextID, typeName);
        this._recordSource.set(nextID, nextRecord);
      } else {
        this._validateRecordType(nextRecord, field, item);
      }
      if (prevIDs) {
        this._validateConflictingLinkedFieldsWithIdenticalId(
          prevIDs[nextIndex],
          nextID,
          storageKey,
        );
      }
      // $FlowFixMe[incompatible-variance]
      this._traverseSelections(field, nextRecord, item);
      this._errorTrie = oldErrorTrie;
      this._path.pop();
    });
    RelayModernRecord.setLinkedRecordIDs(record, storageKey, nextIDs);
  }

  /**
   * Warns if the type of the record does not match the type of the field/payload.
   */
  _validateRecordType(
    record: Record,
    field: NormalizationLinkedField,
    payload: any,
  ): void {
    if (RelayFeatureFlags.ENABLE_STORE_ID_COLLISION_LOGGING) {
      const typeName = field.concreteType ?? this._getRecordType(payload);
      const dataID = RelayModernRecord.getDataID(record);
      const expected =
        (isClientID(dataID) && dataID !== ROOT_ID) ||
        RelayModernRecord.getType(record) === typeName;
      if (!expected) {
        const logEvent: IdCollisionTypenameLogEvent = {
          name: 'idCollision.typename',
          new_typename: typeName,
          previous_typename: RelayModernRecord.getType(record),
        };
        if (this._log != null) {
          this._log(logEvent);
        }
      }
    }
    // NOTE: Only emit a warning in DEV
    if (__DEV__) {
      const typeName = field.concreteType ?? this._getRecordType(payload);
      const dataID = RelayModernRecord.getDataID(record);
      const expected =
        (isClientID(dataID) && dataID !== ROOT_ID) ||
        RelayModernRecord.getType(record) === typeName;
      warning(
        expected,
        'RelayResponseNormalizer: Invalid record `%s`. Expected %s to be ' +
          'consistent, but the record was assigned conflicting types `%s` ' +
          'and `%s`. The GraphQL server likely violated the globally unique ' +
          'id requirement by returning the same id for different objects.',
        dataID,
        TYPENAME_KEY,
        RelayModernRecord.getType(record),
        typeName,
      );
    }
  }

  /**
   * Warns if a single response contains conflicting fields with the same id
   */
  _validateConflictingFieldsWithIdenticalId(
    record: Record,
    storageKey: string,
    fieldValue: unknown,
  ): void {
    // NOTE: Only emit a warning in DEV
    if (__DEV__) {
      const previousValue = RelayModernRecord.getValue(record, storageKey);
      const dataID = RelayModernRecord.getDataID(record);
      const expected =
        storageKey === TYPENAME_KEY ||
        previousValue === undefined ||
        areEqual(previousValue, fieldValue);
      warning(
        expected,
        'RelayResponseNormalizer: Invalid record. The record contains two ' +
          'instances of the same id: `%s` with conflicting field, %s and its values: %s and %s. ' +
          'If two fields are different but share ' +
          'the same id, one field will overwrite the other.',
        dataID,
        storageKey,
        previousValue,
        fieldValue,
      );
    }
  }

  /**
   * Warns if a single response contains conflicting fields with the same id
   */
  _validateConflictingLinkedFieldsWithIdenticalId(
    prevID: ?DataID,
    nextID: DataID,
    storageKey: string,
  ): void {
    // NOTE: Only emit a warning in DEV
    if (__DEV__) {
      const expected = prevID === undefined || prevID === nextID;
      warning(
        expected,
        'RelayResponseNormalizer: Invalid record. The record contains ' +
          'references to the conflicting field, %s and its id values: %s and %s. ' +
          'We need to make sure that the record the field points ' +
          'to remains consistent or one field will overwrite the other.',
        storageKey,
        prevID,
        nextID,
      );
    }
  }
}

module.exports = {
  normalize,
};
