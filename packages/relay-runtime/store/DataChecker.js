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
import type RelayRecordSourceProxy from '../mutations/RelayRecordSourceProxy';
import type {
  NormalizationClientEdgeToClientObject,
  NormalizationClientEdgeToServerObject,
  NormalizationLinkedField,
  NormalizationLiveResolverField,
  NormalizationModuleImport,
  NormalizationNode,
  NormalizationResolverField,
  NormalizationScalarField,
  NormalizationSelection,
} from '../util/NormalizationNode';
import type {DataID, Variables} from '../util/RelayRuntimeTypes';
import type {GetDataID} from './RelayResponseNormalizer';
import type {
  LogFunction,
  MissingFieldHandler,
  MutableRecordSource,
  NormalizationSelector,
  OperationLoader,
  RecordSource,
} from './RelayStoreTypes';

const RelayRecordSourceMutator = require('../mutations/RelayRecordSourceMutator');
const {
  createRelayRecordSourceProxy,
} = require('../mutations/RelayRecordSourceProxyOptimized');
const getOperation = require('../util/getOperation');
const {isClientID} = require('./ClientID');
const cloneRelayHandleSourceField = require('./cloneRelayHandleSourceField');
const cloneRelayScalarHandleSourceField = require('./cloneRelayScalarHandleSourceField');
const {getLocalVariables} = require('./RelayConcreteVariables');
const RelayModernRecord = require('./RelayModernRecord');
const {EXISTENT, UNKNOWN} = require('./RelayRecordState');
const RelayStoreUtils = require('./RelayStoreUtils');
const {TYPE_SCHEMA_TYPE, generateTypeID} = require('./TypeID');
const invariant = require('invariant');

export type Availability = {
  readonly status: 'available' | 'missing',
  readonly mostRecentlyInvalidatedAt: ?number,
};

const {getModuleOperationKey, getStorageKey, getArgumentValues} =
  RelayStoreUtils;

/**
 * Synchronously check whether the records required to fulfill the given
 * `selector` are present in `source`.
 *
 * If a field is missing, it uses the provided handlers to attempt to substitute
 * data. The `target` will store all records that are modified because of a
 * successful substitution.
 *
 * If all records are present, returns `true`, otherwise `false`.
 */
function check(
  getSourceForActor: (actorIdentifier: ActorIdentifier) => RecordSource,
  getTargetForActor: (actorIdentifier: ActorIdentifier) => MutableRecordSource,
  defaultActorIdentifier: ActorIdentifier,
  selector: NormalizationSelector,
  handlers: ReadonlyArray<MissingFieldHandler>,
  operationLoader: ?OperationLoader,
  getDataID: GetDataID,
  log: ?LogFunction,
  useExecTimeResolvers: ?boolean,
): Availability {
  if (log != null) {
    log({
      name: 'store.datachecker.start',
      selector,
    });
  }
  const {dataID, node, variables} = selector;
  const checker = new DataChecker(
    getSourceForActor,
    getTargetForActor,
    defaultActorIdentifier,
    variables,
    handlers,
    operationLoader,
    getDataID,
    log,
    useExecTimeResolvers,
  );
  const result = checker.check(node, dataID);
  if (log != null) {
    log({
      name: 'store.datachecker.end',
      selector,
    });
  }
  return result;
}

/**
 * @private
 */
class DataChecker {
  _handlers: ReadonlyArray<MissingFieldHandler>;
  _mostRecentlyInvalidatedAt: number | null;
  _mutator: RelayRecordSourceMutator;
  _operationLoader: OperationLoader | null;
  _recordSourceProxy: RelayRecordSourceProxy;
  _recordWasMissing: boolean;
  _source: RecordSource;
  _useExecTimeResolvers: boolean;
  _variables: Variables;
  readonly _getSourceForActor: (
    actorIdentifier: ActorIdentifier,
  ) => RecordSource;
  readonly _getTargetForActor: (
    actorIdentifier: ActorIdentifier,
  ) => MutableRecordSource;
  readonly _getDataID: GetDataID;
  readonly _mutatorRecordSourceProxyCache: Map<
    ActorIdentifier,
    [RelayRecordSourceMutator, RelayRecordSourceProxy],
  >;
  _log: ?LogFunction;

  constructor(
    getSourceForActor: (actorIdentifier: ActorIdentifier) => RecordSource,
    getTargetForActor: (
      actorIdentifier: ActorIdentifier,
    ) => MutableRecordSource,
    defaultActorIdentifier: ActorIdentifier,
    variables: Variables,
    handlers: ReadonlyArray<MissingFieldHandler>,
    operationLoader: ?OperationLoader,
    getDataID: GetDataID,
    log: ?LogFunction,
    useExecTimeResolvers: ?boolean,
  ) {
    this._getSourceForActor = getSourceForActor;
    this._getTargetForActor = getTargetForActor;
    this._getDataID = getDataID;
    this._source = getSourceForActor(defaultActorIdentifier);
    this._mutatorRecordSourceProxyCache = new Map();
    const [mutator, recordSourceProxy] = this._getMutatorAndRecordProxyForActor(
      defaultActorIdentifier,
    );
    this._useExecTimeResolvers = useExecTimeResolvers ?? false;
    this._mostRecentlyInvalidatedAt = null;
    this._handlers = handlers;
    this._mutator = mutator;
    this._operationLoader = operationLoader ?? null;
    this._recordSourceProxy = recordSourceProxy;
    this._recordWasMissing = false;
    this._variables = variables;
    this._log = log;
  }

  _getMutatorAndRecordProxyForActor(
    actorIdentifier: ActorIdentifier,
  ): [RelayRecordSourceMutator, RelayRecordSourceProxy] {
    let tuple = this._mutatorRecordSourceProxyCache.get(actorIdentifier);
    if (tuple == null) {
      const target = this._getTargetForActor(actorIdentifier);

      const mutator = new RelayRecordSourceMutator(
        this._getSourceForActor(actorIdentifier),
        target,
      );
      const recordSourceProxy = createRelayRecordSourceProxy(
        mutator,
        this._getDataID,
        undefined,
        this._handlers,
        this._log,
      );
      tuple = [mutator, recordSourceProxy];
      this._mutatorRecordSourceProxyCache.set(actorIdentifier, tuple);
    }
    return tuple;
  }

  check(node: NormalizationNode, dataID: DataID): Availability {
    this._assignClientAbstractTypes(node);
    this._traverse(node, dataID);

    return this._recordWasMissing === true
      ? {
          mostRecentlyInvalidatedAt: this._mostRecentlyInvalidatedAt,
          status: 'missing',
        }
      : {
          mostRecentlyInvalidatedAt: this._mostRecentlyInvalidatedAt,
          status: 'available',
        };
  }

  _getVariableValue(name: string): unknown {
    invariant(
      this._variables.hasOwnProperty(name),
      'RelayAsyncLoader(): Undefined variable `%s`.',
      name,
    );
    return this._variables[name];
  }

  _handleMissing(): void {
    this._recordWasMissing = true;
  }

  _handleMissingScalarField(
    field: NormalizationScalarField,
    dataID: DataID,
  ): unknown {
    if (field.name === 'id' && field.alias == null && isClientID(dataID)) {
      return undefined;
    }
    const args =
      field.args != undefined
        ? getArgumentValues(field.args, this._variables)
        : {};
    for (const handler of this._handlers) {
      if (handler.kind === 'scalar') {
        const newValue = handler.handle(
          field,
          this._recordSourceProxy.get(dataID),
          args,
          this._recordSourceProxy,
        );
        if (newValue !== undefined) {
          return newValue;
        }
      }
    }
    if (this._log != null) {
      this._log({
        name: 'store.datachecker.missing',
        kind: 'scalar',
        dataID,
        fieldName: field.name,
        storageKey: getStorageKey(field, this._variables),
      });
    }
    this._handleMissing();
  }

  _handleMissingLinkField(
    field: NormalizationLinkedField,
    dataID: DataID,
  ): ?DataID {
    const args =
      field.args != undefined
        ? getArgumentValues(field.args, this._variables)
        : {};
    for (const handler of this._handlers) {
      if (handler.kind === 'linked') {
        const newValue = handler.handle(
          field,
          this._recordSourceProxy.get(dataID),
          args,
          this._recordSourceProxy,
        );
        if (
          newValue !== undefined &&
          (newValue === null || this._mutator.getStatus(newValue) === EXISTENT)
        ) {
          return newValue;
        }
      }
    }
    if (this._log != null) {
      this._log({
        name: 'store.datachecker.missing',
        kind: 'linked',
        dataID,
        fieldName: field.name,
        storageKey: getStorageKey(field, this._variables),
      });
    }
    this._handleMissing();
  }

  _handleMissingPluralLinkField(
    field: NormalizationLinkedField,
    dataID: DataID,
  ): ?Array<?DataID> {
    const args =
      field.args != undefined
        ? getArgumentValues(field.args, this._variables)
        : {};
    for (const handler of this._handlers) {
      if (handler.kind === 'pluralLinked') {
        const newValue = handler.handle(
          field,
          this._recordSourceProxy.get(dataID),
          args,
          this._recordSourceProxy,
        );
        if (newValue != null) {
          const allItemsKnown = newValue.every(
            linkedID =>
              linkedID != null &&
              this._mutator.getStatus(linkedID) === EXISTENT,
          );
          if (allItemsKnown) {
            return newValue;
          }
        } else if (newValue === null) {
          return null;
        }
      }
    }
    if (this._log != null) {
      this._log({
        name: 'store.datachecker.missing',
        kind: 'pluralLinked',
        dataID,
        fieldName: field.name,
        storageKey: getStorageKey(field, this._variables),
      });
    }
    this._handleMissing();
  }

  _traverse(node: NormalizationNode, dataID: DataID): void {
    const status = this._mutator.getStatus(dataID);
    if (status === UNKNOWN) {
      if (this._log != null) {
        this._log({
          name: 'store.datachecker.missing',
          kind: 'unknown_record',
          dataID,
        });
      }
      this._handleMissing();
    }

    if (status === EXISTENT) {
      const record = this._source.get(dataID);
      const invalidatedAt = RelayModernRecord.getInvalidationEpoch(record);
      if (invalidatedAt != null) {
        this._mostRecentlyInvalidatedAt =
          this._mostRecentlyInvalidatedAt != null
            ? Math.max(this._mostRecentlyInvalidatedAt, invalidatedAt)
            : invalidatedAt;
      }

      this._traverseSelections(node.selections, dataID);
    }
  }

  _traverseSelections(
    selections: ReadonlyArray<NormalizationSelection>,
    dataID: DataID,
  ): void {
    selections.forEach(selection => {
      switch (selection.kind) {
        case 'ScalarField':
          this._checkScalar(selection, dataID);
          break;
        case 'LinkedField':
          if (selection.plural) {
            this._checkPluralLink(selection, dataID);
          } else {
            this._checkLink(selection, dataID);
          }
          break;
        case 'ActorChange':
          this._checkActorChange(selection.linkedField, dataID);
          break;
        case 'Condition':
          const conditionValue = Boolean(
            this._getVariableValue(selection.condition),
          );
          if (conditionValue === selection.passingValue) {
            this._traverseSelections(selection.selections, dataID);
          }
          break;
        case 'InlineFragment': {
          const {abstractKey} = selection;
          if (abstractKey == null) {
            // concrete type refinement: only check data if the type exactly matches
            const typeName = this._mutator.getType(dataID);
            if (typeName === selection.type) {
              this._traverseSelections(selection.selections, dataID);
            }
          } else {
            // Abstract refinement: check data depending on whether the type
            // conforms to the interface/union or not:
            // - Type known to _not_ implement the interface: don't check the selections.
            // - Type is known _to_ implement the interface: check selections.
            // - Unknown whether the type implements the interface: don't check the selections
            //   and treat the data as missing; we do this because the Relay Compiler
            //   guarantees that the type discriminator will always be fetched.
            const recordType = this._mutator.getType(dataID);
            invariant(
              recordType != null,
              'DataChecker: Expected record `%s` to have a known type',
              dataID,
            );
            const typeID = generateTypeID(recordType);
            const implementsInterface = this._mutator.getValue(
              typeID,
              abstractKey,
            );
            if (implementsInterface === true) {
              this._traverseSelections(selection.selections, dataID);
            } else if (implementsInterface == null) {
              // unsure if the type implements the interface: data is
              // missing so don't bother reading the fragment
              this._handleMissing();
            } else {
              // false: known to not implement the interface
              this.onRefinementRuledOut();
            }
          }
          break;
        }
        case 'LinkedHandle': {
          // Handles have no selections themselves; traverse the original field
          // where the handle was set-up instead.
          const handleField = cloneRelayHandleSourceField(
            selection,
            selections,
            this._variables,
          );
          if (handleField.plural) {
            this._checkPluralLink(handleField, dataID);
          } else {
            this._checkLink(handleField, dataID);
          }
          break;
        }
        case 'ScalarHandle': {
          const handleField = cloneRelayScalarHandleSourceField(
            selection,
            selections,
            this._variables,
          );

          this._checkScalar(handleField, dataID);
          break;
        }
        case 'ModuleImport':
          this._checkModuleImport(selection, dataID);
          break;
        case 'Defer':
        case 'Stream':
          this._traverseSelections(selection.selections, dataID);
          break;
        case 'FragmentSpread':
          const prevVariables = this._variables;
          this._variables = getLocalVariables(
            this._variables,
            selection.fragment.argumentDefinitions,
            selection.args,
          );
          this._traverseSelections(selection.fragment.selections, dataID);
          this._variables = prevVariables;
          break;
        case 'ClientExtension':
          const recordWasMissing = this._recordWasMissing;
          this._traverseSelections(selection.selections, dataID);
          this._recordWasMissing = recordWasMissing;
          break;
        case 'TypeDiscriminator':
          const {abstractKey} = selection;
          const recordType = this._mutator.getType(dataID);
          invariant(
            recordType != null,
            'DataChecker: Expected record `%s` to have a known type',
            dataID,
          );
          const typeID = generateTypeID(recordType);
          const implementsInterface = this._mutator.getValue(
            typeID,
            abstractKey,
          );
          if (implementsInterface == null) {
            // unsure if the type implements the interface: data is
            // missing
            this._handleMissing();
          } // else: if it does or doesn't implement, we don't need to check or skip anything else
          break;
        case 'RelayResolver':
        case 'RelayLiveResolver':
          if (!this._useExecTimeResolvers) {
            this._checkResolver(selection, dataID);
          } else {
            this.checkExecTimeResolver(selection, dataID);
          }
          break;
        case 'ClientEdgeToClientObject':
        case 'ClientEdgeToServerObject':
          if (!this._useExecTimeResolvers) {
            this._checkResolver(selection.backingField, dataID);
          } else {
            this.checkExecTimeResolver(selection, dataID);
          }
          break;
        default:
          selection as empty;
          invariant(
            false,
            'RelayAsyncLoader(): Unexpected ast kind `%s`.',
            selection.kind,
          );
      }
    });
  }
  // Methods without a leading underscore can be overridden by a subclass, such
  // as `ExecTimeS2CDataChecker`.

  // An exec-time resolver's value is not in the store: nothing to check.
  checkExecTimeResolver(
    _resolver:
      | NormalizationClientEdgeToClientObject
      | NormalizationClientEdgeToServerObject
      | NormalizationLiveResolverField
      | NormalizationResolverField,
    _dataID: DataID,
  ): void {}

  onRefinementRuledOut(): void {}

  _checkResolver(
    resolver: NormalizationResolverField | NormalizationLiveResolverField,
    dataID: DataID,
  ) {
    if (resolver.fragment) {
      this._traverseSelections([resolver.fragment], dataID);
    }
  }

  _checkModuleImport(
    moduleImport: NormalizationModuleImport,
    dataID: DataID,
  ): void {
    const operationLoader = this._operationLoader;
    invariant(
      operationLoader !== null,
      'DataChecker: Expected an operationLoader to be configured when using `@module`.',
    );
    const operationKey = getModuleOperationKey(moduleImport.documentName);
    const operationReference = this._mutator.getValue(dataID, operationKey);
    if (operationReference == null) {
      if (operationReference === undefined) {
        this._handleMissing();
      }
      return;
    }
    const normalizationRootNode = operationLoader.get(operationReference);
    if (normalizationRootNode != null) {
      const operation = getOperation(normalizationRootNode);
      const prevVariables = this._variables;
      this._variables = getLocalVariables(
        this._variables,
        operation.argumentDefinitions,
        moduleImport.args,
      );
      this._traverse(operation, dataID);
      this._variables = prevVariables;
    } else {
      // If the fragment is not available, we assume that the data cannot have been
      // processed yet and must therefore be missing.
      this._handleMissing();
    }
  }

  _checkScalar(field: NormalizationScalarField, dataID: DataID): void {
    const storageKey = getStorageKey(field, this._variables);
    let fieldValue = this._mutator.getValue(dataID, storageKey);
    if (fieldValue === undefined) {
      fieldValue = this._handleMissingScalarField(field, dataID);
      if (fieldValue !== undefined) {
        this._mutator.setValue(dataID, storageKey, fieldValue);
      }
    }
  }

  _checkLink(field: NormalizationLinkedField, dataID: DataID): void {
    const storageKey = getStorageKey(field, this._variables);
    let linkedID = this._mutator.getLinkedRecordID(dataID, storageKey);

    if (linkedID === undefined) {
      linkedID = this._handleMissingLinkField(field, dataID);
      if (linkedID != null) {
        this._mutator.setLinkedRecordID(dataID, storageKey, linkedID);
      } else if (linkedID === null) {
        this._mutator.setValue(dataID, storageKey, null);
      }
    }
    if (linkedID != null) {
      this._traverse(field, linkedID);
    }
  }

  _checkPluralLink(field: NormalizationLinkedField, dataID: DataID): void {
    const storageKey = getStorageKey(field, this._variables);
    let linkedIDs = this._mutator.getLinkedRecordIDs(dataID, storageKey);

    if (linkedIDs === undefined) {
      linkedIDs = this._handleMissingPluralLinkField(field, dataID);
      if (linkedIDs != null) {
        this._mutator.setLinkedRecordIDs(dataID, storageKey, linkedIDs);
      } else if (linkedIDs === null) {
        this._mutator.setValue(dataID, storageKey, null);
      }
    }
    if (linkedIDs) {
      linkedIDs.forEach(linkedID => {
        if (linkedID != null) {
          this._traverse(field, linkedID);
        }
      });
    }
  }

  _checkActorChange(field: NormalizationLinkedField, dataID: DataID): void {
    const storageKey = getStorageKey(field, this._variables);
    const record = this._source.get(dataID);
    const tuple =
      record != null
        ? RelayModernRecord.getActorLinkedRecordID(record, storageKey)
        : record;

    if (tuple == null) {
      if (tuple === undefined) {
        this._handleMissing();
      }
    } else {
      const [actorIdentifier, linkedID] = tuple;
      const prevSource = this._source;
      const prevMutator = this._mutator;
      const prevRecordSourceProxy = this._recordSourceProxy;

      const [mutator, recordSourceProxy] =
        this._getMutatorAndRecordProxyForActor(actorIdentifier);

      this._source = this._getSourceForActor(actorIdentifier);
      this._mutator = mutator;
      this._recordSourceProxy = recordSourceProxy;
      this._assignClientAbstractTypes(field);
      this._traverse(field, linkedID);
      this._source = prevSource;
      this._mutator = prevMutator;
      this._recordSourceProxy = prevRecordSourceProxy;
    }
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
          if (this._source.get(typeID) == null) {
            this._mutator.create(typeID, TYPE_SCHEMA_TYPE);
          }
          if (this._mutator.getValue(typeID, abstractType) == null) {
            this._mutator.setValue(typeID, abstractType, true);
          }
        }
      }
    }
  }
}

module.exports = {
  DataChecker,
  check,
};
