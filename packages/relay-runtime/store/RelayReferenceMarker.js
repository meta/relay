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
  NormalizationClientEdgeToClientObject,
  NormalizationClientEdgeToServerObject,
  NormalizationLinkedField,
  NormalizationLiveResolverField,
  NormalizationModuleImport,
  NormalizationResolverField,
  NormalizationSelectableNode,
  NormalizationSelection,
} from '../util/NormalizationNode';
import type {DataID, Variables} from '../util/RelayRuntimeTypes';
import type {
  DataIDSet,
  MutableRecordSource,
  NormalizationSelector,
  OperationLoader,
  Record,
  RecordSource,
} from './RelayStoreTypes';

const getOperation = require('../util/getOperation');
const cloneRelayHandleSourceField = require('./cloneRelayHandleSourceField');
const getOutputTypeRecordIDs = require('./live-resolvers/getOutputTypeRecordIDs');
const {getLocalVariables} = require('./RelayConcreteVariables');
const RelayModernRecord = require('./RelayModernRecord');
const RelayStoreUtils = require('./RelayStoreUtils');
const {generateTypeID} = require('./TypeID');
const areEqual = require('areEqual');
const invariant = require('invariant');

export type ReferenceMarkerOptions = {
  // Copies each field the traversal visits, with its errors, into `target`:
  // only fields a Reader of these selections can read. Type refinements are
  // applied (a refinement whose type information is unknown fails closed),
  // and of a handler's record only the selected fields plus the handler's
  // own bookkeeping fields are copied.
  readonly target?: MutableRecordSource,
  // Called before a record is traversed with the selections of `node`;
  // return `false` to skip the record and everything below it (for example,
  // because it was traversed with `node` before and has not changed since).
  // A skipped record is not added to `references`.
  readonly shouldTraverse?: (
    node: NormalizationSelectableNode,
    dataID: DataID,
    variables: Variables,
  ) => boolean,
  // Called before the records of a plural linked field are traversed: the
  // traversal starts at the returned index. A caller that re-copies only what
  // changed returns the length of a list it already copied that only grew.
  readonly firstPluralLinkIndex?: (
    record: Record,
    storageKey: string,
    linkedIDs: ReadonlyArray<?DataID>,
  ) => number,
};

// `ConnectionHandler` numbers the client edges it creates with this field of
// the connection record. A copied connection keeps it, so that the handler
// that receives the copy numbers later edges after the copied ones.
const CONNECTION_NEXT_EDGE_INDEX = '__connection_next_edge_index';

const {
  getHandleStorageKey,
  getModuleComponentKey,
  getModuleOperationKey,
  getReadTimeResolverStorageKey,
  getStorageKey,
} = RelayStoreUtils;

function mark(
  recordSource: RecordSource,
  selector: NormalizationSelector,
  references: DataIDSet,
  operationLoader: ?OperationLoader,
  useExecTimeResolvers: ?boolean,
  options?: ReferenceMarkerOptions,
): void {
  const {dataID, node, variables} = selector;
  const marker = new RelayReferenceMarker(
    recordSource,
    variables,
    references,
    operationLoader,
    useExecTimeResolvers,
    options,
  );
  marker.mark(node, dataID);
}

/**
 * @private
 */
class RelayReferenceMarker {
  _operationLoader: OperationLoader | null;
  _operationName: ?string;
  _recordSource: RecordSource;
  _references: DataIDSet;
  _variables: Variables;
  _useExecTimeResolvers: boolean;
  _target: ?MutableRecordSource;
  _shouldTraverse: ReferenceMarkerOptions['shouldTraverse'];
  _firstPluralLinkIndex: ReferenceMarkerOptions['firstPluralLinkIndex'];

  constructor(
    recordSource: RecordSource,
    variables: Variables,
    references: DataIDSet,
    operationLoader: ?OperationLoader,
    useExecTimeResolvers: ?boolean,
    options?: ReferenceMarkerOptions,
  ) {
    this._target = options?.target;
    this._shouldTraverse = options?.shouldTraverse;
    this._firstPluralLinkIndex = options?.firstPluralLinkIndex;
    invariant(
      this._target == null || useExecTimeResolvers !== true,
      'RelayReferenceMarker: Copying fields (`target`) does not support ' +
        'exec-time resolvers.',
    );
    this._operationLoader = operationLoader ?? null;
    this._operationName = null;
    this._useExecTimeResolvers = useExecTimeResolvers ?? false;
    this._recordSource = recordSource;
    this._references = references;
    this._variables = variables;
  }

  mark(node: NormalizationSelectableNode, dataID: DataID): void {
    if (node.kind === 'Operation' || node.kind === 'SplitOperation') {
      this._operationName = node.name;
    }
    if (node.kind === 'Operation') {
      const {clientAbstractTypes} = node;
      if (clientAbstractTypes != null) {
        for (const abstractType of Object.keys(clientAbstractTypes)) {
          const concreteTypes = clientAbstractTypes[abstractType];
          if (concreteTypes == null) {
            continue;
          }
          for (const concreteType of concreteTypes) {
            this._references.add(generateTypeID(concreteType));
          }
        }
      }
    }
    this._traverse(node, dataID);
  }

  _traverse(
    node: NormalizationSelectableNode,
    dataID: DataID,
    isConnectionRecord: boolean = false,
  ): void {
    if (
      this._shouldTraverse != null &&
      !this._shouldTraverse(node, dataID, this._variables)
    ) {
      return;
    }
    this._references.add(dataID);
    const record = this._recordSource.get(dataID);
    if (record == null) {
      return;
    }
    if (this._target != null) {
      this._copyField(record, null);
      if (isConnectionRecord) {
        this._copyField(record, CONNECTION_NEXT_EDGE_INDEX);
      }
    }
    this._traverseSelections(node.selections, record);
  }

  // Copies `storageKey` (or only the record's identity, for null) into the
  // target, creating the target record on first use.
  _copyField(record: Record, storageKey: ?string): void {
    const target = this._target;
    if (target == null) {
      return;
    }
    const dataID = RelayModernRecord.getDataID(record);
    let copy = target.get(dataID);
    if (copy == null) {
      copy = RelayModernRecord.create(
        dataID,
        RelayModernRecord.getType(record),
      );
      target.set(dataID, copy);
    }
    if (storageKey != null) {
      RelayModernRecord.copyField(record, copy, storageKey);
    }
  }

  // A copy must hold only what the client's Readers read, and they read a
  // connection only through its handle (`LinkedHandle` below), on the record
  // the handler built from the server's records. But the client's availability
  // check also walks the server's connection field, and treats a missing field
  // as missing data. So instead of copying the server's records, the copy links
  // the server's field to the handler's record (or leaves it null or missing
  // when the handle is). Returns whether `connectionField` has a connection
  // handle among `siblingSelections`.
  _copyConnectionLink(
    connectionField: NormalizationLinkedField,
    siblingSelections: ReadonlyArray<NormalizationSelection>,
    parentRecord: Record,
  ): boolean {
    const handle = siblingSelections.find(
      item =>
        item.kind === 'LinkedHandle' &&
        item.handle === 'connection' &&
        item.name === connectionField.name &&
        item.alias === connectionField.alias &&
        areEqual(item.args, connectionField.args),
    );
    if (handle?.kind !== 'LinkedHandle') {
      return false;
    }
    this._copyField(parentRecord, null);
    const copy = this._target?.get(RelayModernRecord.getDataID(parentRecord));
    if (copy == null) {
      return true;
    }
    const storageKey = getStorageKey(connectionField, this._variables);
    const handledID = RelayModernRecord.getLinkedRecordID(
      parentRecord,
      getHandleStorageKey(handle, this._variables),
    );
    if (handledID != null) {
      RelayModernRecord.setLinkedRecordID(copy, storageKey, handledID);
    } else if (
      handledID === null &&
      RelayModernRecord.getLinkedRecordID(parentRecord, storageKey) === null
    ) {
      // The server's field is null too: copy it with its errors.
      RelayModernRecord.copyField(parentRecord, copy, storageKey);
    } else if (handledID === null) {
      RelayModernRecord.setValue(copy, storageKey, null);
      RelayModernRecord.setErrors(copy, storageKey);
    } else if (RelayModernRecord.hasValue(copy, storageKey)) {
      RelayModernRecord.setValue(copy, storageKey, undefined);
      RelayModernRecord.setErrors(copy, storageKey);
    }
    return true;
  }

  // In copy mode, copies the abstract key a type refinement read and reports
  // whether the record's type matches. Unknown type information fails closed.
  _copyRefinement(record: Record, abstractKey: string): boolean {
    const typeRecord = this._recordSource.get(
      generateTypeID(RelayModernRecord.getType(record)),
    );
    if (typeRecord == null) {
      return false;
    }
    this._copyField(typeRecord, abstractKey);
    return RelayModernRecord.getValue(typeRecord, abstractKey) === true;
  }

  _getVariableValue(name: string): unknown {
    invariant(
      this._variables.hasOwnProperty(name),
      'RelayReferenceMarker(): Undefined variable `%s`.',
      name,
    );
    return this._variables[name];
  }

  _traverseSelections(
    selections: ReadonlyArray<NormalizationSelection>,
    record: Record,
  ): void {
    selections.forEach(selection => {
      /* eslint-disable no-fallthrough */
      switch (selection.kind) {
        case 'ActorChange':
          // TODO: T89695151 Support multi-actor record sources in RelayReferenceMarker.js
          this._traverseLink(selection.linkedField, record);
          break;
        case 'LinkedField':
          if (
            this._target != null &&
            this._copyConnectionLink(selection, selections, record)
          ) {
            break;
          }
          if (selection.plural) {
            this._traversePluralLink(selection, record);
          } else {
            this._traverseLink(selection, record);
          }
          break;
        case 'Condition':
          const conditionValue = Boolean(
            this._getVariableValue(selection.condition),
          );
          if (conditionValue === selection.passingValue) {
            this._traverseSelections(selection.selections, record);
          }
          break;
        case 'InlineFragment':
          const abstractKey = selection.abstractKey;
          if (abstractKey == null) {
            const typeName = RelayModernRecord.getType(record);
            if (
              (typeName != null && typeName === selection.type) ||
              // Our root record has a special type of `__Root` which may not
              // match the schema type of Query/Mutation or whatever the schema
              // specifies.
              //
              // If we have an inline fragment on a concrete type within an
              // operation root, and our query has been validated, we know that
              // concrete type must match, since the operation selection must be
              // on a concrete type.
              typeName === RelayStoreUtils.ROOT_TYPE
            ) {
              this._traverseSelections(selection.selections, record);
            }
          } else {
            const typeName = RelayModernRecord.getType(record);
            const typeID = generateTypeID(typeName);
            this._references.add(typeID);
            // Marking for GC deliberately over-retains (the refinement may be
            // unknown yet); copying only takes fields a Reader would read.
            if (
              this._target == null ||
              this._copyRefinement(record, abstractKey)
            ) {
              this._traverseSelections(selection.selections, record);
            }
          }
          break;
        case 'FragmentSpread':
          const prevVariables = this._variables;
          this._variables = getLocalVariables(
            this._variables,
            selection.fragment.argumentDefinitions,
            selection.args,
          );
          this._traverseSelections(selection.fragment.selections, record);
          this._variables = prevVariables;
          break;
        case 'LinkedHandle':
          // The selections for a "handle" field are the same as those of the
          // original linked field where the handle was applied. Reference marking
          // therefore requires traversing the original field selections against
          // the synthesized client field.
          //
          // TODO: Instead of finding the source field in `selections`, change
          // the concrete structure to allow shared subtrees, and have the linked
          // handle directly refer to the same selections as the LinkedField that
          // it was split from.
          const handleField = cloneRelayHandleSourceField(
            selection,
            selections,
            this._variables,
          );
          const isConnectionRecord =
            this._target != null && selection.handle === 'connection';
          if (handleField.plural) {
            this._traversePluralLink(handleField, record, isConnectionRecord);
          } else {
            this._traverseLink(handleField, record, isConnectionRecord);
          }
          break;
        case 'Defer':
        case 'Stream':
          this._traverseSelections(selection.selections, record);
          break;
        case 'ScalarField':
          if (this._target != null) {
            this._copyField(record, getStorageKey(selection, this._variables));
          }
          break;
        case 'ScalarHandle':
          if (this._target != null) {
            this._copyField(
              record,
              getHandleStorageKey(selection, this._variables),
            );
          }
          break;
        case 'TypeDiscriminator': {
          const typeName = RelayModernRecord.getType(record);
          const typeID = generateTypeID(typeName);
          this._references.add(typeID);
          if (this._target != null) {
            this._copyRefinement(record, selection.abstractKey);
          }
          break;
        }
        case 'ModuleImport':
          this._traverseModuleImport(selection, record);
          break;
        case 'ClientExtension':
          this._traverseSelections(selection.selections, record);
          break;
        case 'RelayResolver':
        case 'RelayLiveResolver':
          this._traverseResolverField(selection, record);
          break;
        case 'ClientEdgeToClientObject':
        case 'ClientEdgeToServerObject':
          this._traverseClientEdgeToClientObject(selection, record);
          break;
        default:
          selection as empty;
          invariant(
            false,
            'RelayReferenceMarker: Unknown AST node `%s`.',
            selection,
          );
      }
    });
  }

  _traverseClientEdgeToClientObject(
    field:
      | NormalizationClientEdgeToClientObject
      | NormalizationClientEdgeToServerObject,
    record: Record,
  ): void {
    const {linkedField} = field;
    if (this._useExecTimeResolvers) {
      if (linkedField.plural) {
        this._traversePluralLink(linkedField, record);
      } else {
        this._traverseLink(linkedField, record);
      }
      return;
    }
    const dataID = this._traverseResolverField(field.backingField, record);
    if (dataID == null) {
      return;
    }
    const resolverRecord = this._recordSource.get(dataID);
    if (resolverRecord == null) {
      return;
    }
    if (field.backingField.isOutputType) {
      // Mark all @outputType record IDs
      const outputTypeRecordIDs = getOutputTypeRecordIDs(resolverRecord);
      if (outputTypeRecordIDs != null) {
        for (const dataID of outputTypeRecordIDs) {
          this._references.add(dataID);
          this._traverse(linkedField, dataID);
        }
      }
    } else {
      const concreteType = linkedField.concreteType;
      if (concreteType == null) {
        // TODO: Handle retaining abstract client edges to client types.
        return;
      }
      if (linkedField.plural) {
        const dataIDs = RelayModernRecord.getResolverLinkedRecordIDs(
          resolverRecord,
          concreteType,
        );

        if (dataIDs != null) {
          for (const dataID of dataIDs) {
            if (dataID != null) {
              this._traverse(linkedField, dataID);
            }
          }
        }
      } else {
        const dataID = RelayModernRecord.getResolverLinkedRecordID(
          resolverRecord,
          concreteType,
        );
        if (dataID != null) {
          this._traverse(linkedField, dataID);
        }
      }
    }
  }

  _traverseResolverField(
    field: NormalizationResolverField | NormalizationLiveResolverField,
    record: Record,
  ): ?DataID {
    if (this._useExecTimeResolvers) {
      return;
    }
    const storageKey = getReadTimeResolverStorageKey(field, this._variables);
    const dataID = RelayModernRecord.getLinkedRecordID(record, storageKey);

    // If the resolver value has been created, we should retain it.
    // This record contains our cached resolver value, and potential Live
    // Resolver subscription.
    if (dataID != null) {
      this._references.add(dataID);
    }

    const {fragment} = field;
    if (fragment != null) {
      // Mark the contents of the resolver's data dependencies.
      this._traverseSelections([fragment], record);
    }
    return dataID;
  }

  _traverseModuleImport(
    moduleImport: NormalizationModuleImport,
    record: Record,
  ): void {
    const operationLoader = this._operationLoader;
    invariant(
      operationLoader !== null,
      'RelayReferenceMarker: Expected an operationLoader to be configured when using `@module`. ' +
        'Could not load fragment `%s` in operation `%s`.',
      moduleImport.fragmentName,
      this._operationName ?? '(unknown)',
    );
    const operationKey = getModuleOperationKey(moduleImport.documentName);
    if (this._target != null) {
      this._copyField(record, getModuleComponentKey(moduleImport.documentName));
      this._copyField(record, operationKey);
    }
    const operationReference = RelayModernRecord.getValue(record, operationKey);
    if (operationReference == null) {
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
      this._traverseSelections(operation.selections, record);
      this._variables = prevVariables;
    }
    // Otherwise, if the operation is not available, we assume that the data
    // cannot have been processed yet and therefore isn't in the store to
    // begin with.
  }

  _traverseLink(
    field: NormalizationLinkedField,
    record: Record,
    isConnectionRecord: boolean = false,
  ): void {
    const storageKey = getStorageKey(field, this._variables);
    if (this._target != null) {
      this._copyField(record, storageKey);
    }
    const linkedID = RelayModernRecord.getLinkedRecordID(record, storageKey);

    if (linkedID == null) {
      return;
    }
    this._traverse(field, linkedID, isConnectionRecord);
  }

  _traversePluralLink(
    field: NormalizationLinkedField,
    record: Record,
    isConnectionRecord: boolean = false,
  ): void {
    const storageKey = getStorageKey(field, this._variables);
    if (this._target != null) {
      this._copyField(record, storageKey);
    }
    const linkedIDs = RelayModernRecord.getLinkedRecordIDs(record, storageKey);

    if (linkedIDs == null) {
      return;
    }
    const first =
      this._firstPluralLinkIndex != null
        ? this._firstPluralLinkIndex(record, storageKey, linkedIDs)
        : 0;
    for (let ii = first; ii < linkedIDs.length; ii++) {
      const linkedID = linkedIDs[ii];
      if (linkedID != null) {
        this._traverse(field, linkedID, isConnectionRecord);
      }
    }
  }
}

module.exports = {mark};
