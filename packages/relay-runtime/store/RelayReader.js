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

import type {Result} from '../experimental';
import type {
  CatchFieldTo,
  ReaderActorChange,
  ReaderAliasedInlineFragmentSpread,
  ReaderCatchField,
  ReaderClientEdge,
  ReaderFragment,
  ReaderFragmentSpread,
  ReaderInlineDataFragmentSpread,
  ReaderInlineFragment,
  ReaderLinkedField,
  ReaderModuleImport,
  ReaderNode,
  ReaderRelayLiveResolver,
  ReaderRelayResolver,
  ReaderRequiredField,
  ReaderScalarField,
  ReaderSelection,
} from '../util/ReaderNode';
import type {DataID, Variables} from '../util/RelayRuntimeTypes';
import type {
  ClientEdgeTraversalInfo,
  DataIDSet,
  FieldError,
  FieldErrors,
  LogFunction,
  MissingClientEdgeRequestInfo,
  Record,
  RecordSource,
  RequestDescriptor,
  ResolverContext,
  SelectorData,
  SingularReaderSelector,
  Snapshot,
} from './RelayStoreTypes';
import type {Arguments} from './RelayStoreUtils';
import type {EvaluationResult, ResolverCache} from './ResolverCache';

const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const {
  isSuspenseSentinel,
} = require('./live-resolvers/LiveResolverSuspenseSentinel');
const RelayConcreteVariables = require('./RelayConcreteVariables');
const RelayModernRecord = require('./RelayModernRecord');
const {
  FIELD_GRANULAR_NOTIFICATIONS_KEY,
  FRAGMENT_OWNER_KEY,
  FRAGMENT_POINTER_IS_WITHIN_UNMATCHED_TYPE_REFINEMENT,
  FRAGMENT_PROP_NAME_KEY,
  FRAGMENTS_KEY,
  ID_KEY,
  MODULE_COMPONENT_KEY,
  PARENT_CLIENT_EDGE,
  ROOT_ID,
  getArgumentValues,
  getFieldNotificationKey,
  getModuleComponentKey,
  getStorageKey,
} = require('./RelayStoreUtils');
const {NoopResolverCache} = require('./ResolverCache');
const {
  RESOLVER_FRAGMENT_ERRORED_SENTINEL,
  withResolverContext,
} = require('./ResolverFragments');
const {generateTypeID} = require('./TypeID');
const invariant = require('invariant');

function read(
  recordSource: RecordSource,
  selector: SingularReaderSelector,
  log: ?LogFunction,
  resolverCache?: ResolverCache,
  resolverContext?: ResolverContext,
): Snapshot {
  if (RelayFeatureFlags.ENABLE_PERF_READER) {
    return readPerf(
      recordSource,
      selector,
      log,
      resolverCache,
      resolverContext,
    );
  }
  const reader = new RelayReader(
    recordSource,
    selector,
    log,
    resolverCache ?? new NoopResolverCache(),
    resolverContext,
  );
  return reader.read();
}

/**
 * @private
 */
class RelayReader {
  _parentClientEdge: ClientEdgeTraversalInfo | null;
  _isMissingData: boolean;
  _missingClientEdges: Array<MissingClientEdgeRequestInfo>;
  _missingLiveResolverFields: Array<DataID>;
  _isWithinUnmatchedTypeRefinement: boolean;
  _fieldErrors: ?FieldErrors;
  _fieldGranularNotificationDataID: ?DataID;
  _owner: RequestDescriptor;
  // Exec time resolvers are run before reaching the Relay store so the store already contains
  // the normalized data; the same as if the data were sent from the server. However, since a
  // resolver could be used at read time or exec time in different queries, the reader AST for
  // a resolver is the read time AST. At runtime, this flag is used to ignore the extra
  // information in the read time resolver AST and use the "standard", non-resolver read paths
  _useExecTimeResolvers: boolean;
  _recordSource: RecordSource;
  _seenRecords: DataIDSet;
  _updatedDataIDs: DataIDSet;
  _selector: SingularReaderSelector;
  _variables: Variables;
  _resolverCache: ResolverCache;
  _fragmentName: string;
  _resolverContext: ?ResolverContext;
  // The log function currently is only used to log fragment spread accesses for unused
  // fragments detection, so it is not passed in from all callsites. If we decide to
  // extend the logging, this needs to be updated.
  _log: ?LogFunction;

  constructor(
    recordSource: RecordSource,
    selector: SingularReaderSelector,
    log: ?LogFunction,
    resolverCache: ResolverCache,
    resolverContext: ?ResolverContext,
  ) {
    this._parentClientEdge = selector.parentClientEdge;
    this._missingClientEdges = [];
    this._missingLiveResolverFields = [];
    this._isMissingData = false;
    this._isWithinUnmatchedTypeRefinement = false;
    this._fieldErrors = null;
    this._fieldGranularNotificationDataID = null;
    this._owner = selector.owner;
    this._useExecTimeResolvers =
      this._owner.node.operation.use_exec_time_resolvers ??
      this._owner.node.operation.exec_time_resolvers_enabled_provider?.get() ===
        true ??
      false;
    this._recordSource = recordSource;
    this._seenRecords = new Set();
    this._selector = selector;
    this._variables = selector.variables;
    this._resolverCache = resolverCache;
    this._fragmentName = selector.node.name;
    this._updatedDataIDs = new Set();
    this._resolverContext = resolverContext;
    this._log = log;
  }

  read(): Snapshot {
    const {node, dataID, isWithinUnmatchedTypeRefinement} = this._selector;
    const {abstractKey} = node;
    const record = this._recordSource.get(dataID);

    // Relay historically allowed child fragments to be read even if the root object
    // did not match the type of the fragment: either the root object has a different
    // concrete type than the fragment (for concrete fragments) or the root object does
    // not conform to the interface/union for abstract fragments.
    // For suspense purposes, however, we want to accurately compute whether any data
    // is missing: but if the fragment type doesn't match (or a parent type didn't
    // match), then no data is expected to be present.

    // By default data is expected to be present unless this selector was read out
    // from within a non-matching type refinement in a parent fragment:
    let isDataExpectedToBePresent = !isWithinUnmatchedTypeRefinement;

    // If this is a concrete fragment and the concrete type of the record does not
    // match, then no data is expected to be present.
    if (isDataExpectedToBePresent && abstractKey == null && record != null) {
      if (!this._recordMatchesTypeCondition(record, node.type)) {
        isDataExpectedToBePresent = false;
      }
    }

    // If this is an abstract fragment (and the precise refinement GK is enabled)
    // then data is only expected to be present if the record type is known to
    // implement the interface. If we aren't sure whether the record implements
    // the interface, that itself constitutes "expected" data being missing.
    if (isDataExpectedToBePresent && abstractKey != null && record != null) {
      const implementsInterface = this._implementsInterface(
        record,
        abstractKey,
      );
      if (implementsInterface === false) {
        // Type known to not implement the interface
        isDataExpectedToBePresent = false;
      }
    }

    this._isWithinUnmatchedTypeRefinement = !isDataExpectedToBePresent;
    let data = this._traverse(node, dataID, null);

    // If the fragment/operation was marked with @catch, we need to handle any
    // errors that were encountered while reading the fields within it.
    const catchTo = this._selector.node.metadata?.catchTo;
    if (catchTo != null) {
      data = this._catchErrors(data, catchTo, null) as $FlowFixMe;
    }

    if (this._updatedDataIDs.size > 0) {
      this._resolverCache.notifyUpdatedSubscribers(this._updatedDataIDs);
      this._updatedDataIDs.clear();
    }

    if (RelayFeatureFlags.ENABLE_READER_FRAGMENTS_LOGGING) {
      this._log?.({
        name: 'reader.read',
        selector: this._selector,
      });
    }

    return {
      data,
      fieldErrors: this._fieldErrors,
      isMissingData: this._isMissingData && isDataExpectedToBePresent,
      missingClientEdges: this._missingClientEdges.length
        ? this._missingClientEdges
        : null,
      missingLiveResolverFields: this._missingLiveResolverFields,
      seenRecords: this._seenRecords,
      selector: this._selector,
    };
  }

  _maybeAddFieldErrors(
    record: Record,
    storageKey: string,
    fieldName: string,
  ): void {
    const errors = RelayModernRecord.getErrors(record, storageKey);

    if (errors == null) {
      return;
    }
    const owner = this._fragmentName;

    if (this._fieldErrors == null) {
      this._fieldErrors = [];
    }
    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];
      this._fieldErrors.push({
        error,
        // Like the other field error kinds, start from this field's name and
        // let _prependPreviousErrors add the parent fields on the way out.
        // The stored error has no usable `path`: the normalizer strips it when
        // attaching the error to the record.
        fieldPath: fieldName,
        handled: false,
        kind: 'relay_field_payload.error',
        owner,
        shouldThrow: this._selector.node.metadata?.throwOnFieldError ?? false,
        // the uiContext is always undefined here.
        // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
        uiContext: undefined,
      });
    }
  }

  _markDataAsMissing(fieldName: string): void {
    if (this._isWithinUnmatchedTypeRefinement) {
      return;
    }
    if (this._fieldErrors == null) {
      this._fieldErrors = [];
    }

    // we will add the path later
    const owner = this._fragmentName;

    this._fieldErrors.push(
      (this._selector.node.metadata?.throwOnFieldError ?? false)
        ? {
            fieldPath: fieldName,
            handled: false,
            kind: 'missing_expected_data.throw',
            owner,
            // the uiContext is always undefined here.
            // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
            uiContext: undefined,
          }
        : {
            fieldPath: fieldName,
            kind: 'missing_expected_data.log',
            owner,
            // the uiContext is always undefined here.
            // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
            uiContext: undefined,
          },
    );

    this._isMissingData = true;

    // _parentClientEdge is null when not inside a fetchable client edge (e.g.
    // inside a client extension field); we never want to fetch in response to
    // missing data off of a client extension field.
    if (this._parentClientEdge !== null) {
      this._missingClientEdges.push({
        clientEdgeDestinationID: this._parentClientEdge.clientEdgeDestinationID,
        request: this._parentClientEdge.readerClientEdge.operation,
      });
    }
  }

  _traverse(
    node: ReaderNode,
    dataID: DataID,
    prevData: ?SelectorData,
  ): ?SelectorData {
    const record = this._recordSource.get(dataID);
    const prevFieldGranularDataID = this._fieldGranularNotificationDataID;
    if (
      record != null &&
      RelayModernRecord.getValue(record, FIELD_GRANULAR_NOTIFICATIONS_KEY)
    ) {
      this._fieldGranularNotificationDataID = dataID;
    } else {
      this._seenRecords.add(dataID);
      this._fieldGranularNotificationDataID = null;
    }
    if (record == null) {
      if (record === undefined) {
        this._markDataAsMissing('<record>');
      }
      this._fieldGranularNotificationDataID = prevFieldGranularDataID;
      // $FlowFixMe[incompatible-type]
      return record;
    }
    const data = prevData || {};
    const hadRequiredData = this._traverseSelections(
      node.selections,
      record,
      data,
    );
    this._fieldGranularNotificationDataID = prevFieldGranularDataID;
    return hadRequiredData ? data : null;
  }

  _getVariableValue(name: string): unknown {
    invariant(
      this._variables.hasOwnProperty(name),
      'RelayReader(): Undefined variable `%s`.',
      name,
    );
    return this._variables[name];
  }

  _maybeReportUnexpectedNull(
    selection: ReaderRequiredField,
    fieldValue: null | void,
  ) {
    if (selection.action === 'NONE') {
      return;
    }
    const owner = this._fragmentName;

    if (this._fieldErrors == null) {
      this._fieldErrors = [];
    }

    let fieldName: string;
    if (selection.field.linkedField != null) {
      fieldName =
        selection.field.linkedField.alias ?? selection.field.linkedField.name;
    } else {
      fieldName = selection.field.alias ?? selection.field.name;
    }

    // When the field was null (not missing from the store), check whether the
    // server also attached a field error to it. _maybeAddFieldErrors runs in
    // the same call stack just before this method, so any companion error for
    // this field is always the last entry pushed to this._fieldErrors.
    let fieldError = null;
    if (fieldValue === null && this._fieldErrors.length > 0) {
      const lastError = this._fieldErrors[this._fieldErrors.length - 1];
      if (lastError.kind === 'relay_field_payload.error') {
        fieldError = lastError.error;
      }
    }

    switch (selection.action) {
      case 'THROW':
        this._fieldErrors.push({
          fieldError,
          fieldPath: fieldName,
          fieldValue,
          handled: false,
          kind: 'missing_required_field.throw',
          owner,
          // the uiContext is always undefined here.
          // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
          uiContext: undefined,
        });
        return;
      case 'LOG':
        this._fieldErrors.push({
          fieldError,
          fieldPath: fieldName,
          fieldValue,
          kind: 'missing_required_field.log',
          owner,
          // the uiContext is always undefined here.
          // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
          uiContext: undefined,
        });
        return;
      default:
        selection.action as empty;
    }
  }

  _handleRequiredFieldValue(
    selection: ReaderRequiredField,
    value: unknown,
  ): boolean /*should continue to siblings*/ {
    if (value == null) {
      this._maybeReportUnexpectedNull(selection, value);
      // We are going to throw, or our parent is going to get nulled out.
      // Either way, sibling values are going to be ignored, so we can
      // bail early here as an optimization.
      return false;
    }
    return true;
  }

  /**
   * Fields, aliased inline fragments, fragments and operations with `@catch`
   * directives must handle the case that errors were encountered while reading
   * any fields within them.
   *
   * 1. Before traversing into the selection(s) marked as `@catch`, the caller
   *   stores the previous field errors (`this._fieldErrors`) in a
   *   variable.
   * 2. After traversing into the selection(s) marked as `@catch`, the caller
   *   calls this method with the resulting value, the `to` value from the
   *   `@catch` directive, and the previous field errors.
   *
   * This method will then:
   *
   * 1. Compute the correct value to return based on any errors encountered and the supplied `to` type.
   * 2. Mark any errors encountered within the `@catch` as "handled" to ensure they don't cause the reader to throw.
   * 3. Merge any errors encountered within the `@catch` with the previous field errors.
   */
  _catchErrors<T>(
    _value: T,
    to: CatchFieldTo,
    previousResponseFields: ?FieldErrors,
  ): ?T | Result<T, unknown> {
    let value: T | null | Result<T, unknown> = _value;
    switch (to) {
      case 'RESULT':
        value = this._asResult(_value);
        break;
      case 'NULL':
        if (RelayFeatureFlags.ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS) {
          // Only null the field when there are errors not yet handled by an
          // inner @catch boundary.
          if (
            this._fieldErrors != null &&
            this._fieldErrors.some(e => !e.handled)
          ) {
            value = null;
          }
        } else if (this._fieldErrors != null && this._fieldErrors.length > 0) {
          value = null;
        }
        break;
      default:
        to as empty;
    }

    const childrenFieldErrors = this._fieldErrors;

    this._fieldErrors = previousResponseFields;

    // Merge any errors encountered within the @catch with the previous field
    // errors, but mark them as "handled" first.
    if (childrenFieldErrors != null) {
      if (this._fieldErrors == null) {
        this._fieldErrors = [];
      }
      for (let i = 0; i < childrenFieldErrors.length; i++) {
        // We mark any errors encountered within the @catch as "handled"
        // to ensure that they don't cause the reader to throw, but can
        // still be logged.
        this._fieldErrors.push(
          markFieldErrorHasHandled(childrenFieldErrors[i]),
        );
      }
    }
    return value;
  }

  /**
   * Convert a value into a Result object based on the presence of errors in the
   * `this._fieldErrors` array.
   *
   * **Note**: This method does _not_ mark errors as handled. It is the caller's
   * responsibility to ensure that errors are marked as handled.
   */
  _asResult<T>(value: T): Result<T, unknown> {
    // When ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS is off (the default), this
    // method behaves exactly as before: all entries in _fieldErrors, including
    // those already marked handled by an inner @catch, influence this boundary.
    // When the flag is on, already-handled errors are excluded so that an inner
    // @catch fully consumes its error without affecting outer boundaries.
    const fieldErrors =
      RelayFeatureFlags.ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS
        ? this._fieldErrors?.filter(e => !e.handled)
        : this._fieldErrors;
    if (fieldErrors == null || fieldErrors.length === 0) {
      return {ok: true, value};
    }

    // TODO: Should we be hiding log level events here?
    const errors = fieldErrors
      .map(error => {
        switch (error.kind) {
          case 'relay_field_payload.error':
            const {message, ...displayError} = error.error;
            return displayError;
          case 'missing_expected_data.throw':
          case 'missing_expected_data.log':
            return {
              path: error.fieldPath.split('.'),
            };
          case 'relay_resolver.error':
            return {
              message: `Relay: Error in resolver for field at ${error.fieldPath} in ${error.owner}`,
            };
          case 'missing_required_field.throw': {
            // If we have a nested @required(THROW) that will throw,
            // we want to catch that error and provide it
            let reason: string;
            if (error.fieldValue === null) {
              reason =
                error.fieldError != null
                  ? `the server returned null with an error: ${error.fieldError.message}`
                  : 'the server returned null';
            } else {
              reason =
                'the field was missing in the store (data may not have been fetched, or was removed by a graph relationship change: https://relay.dev/docs/next/debugging/why-null/#graph-relationship-change)';
            }
            return {
              message: `Relay: Missing @required value at path '${error.fieldPath}' in '${error.owner}': ${reason}.`,
            };
          }
          case 'missing_required_field.log':
            // For backwards compatibility, we don't surface log level missing required fields
            return null;
          default:
            error.kind as empty;
            invariant(
              false,
              'Unexpected error fieldError kind: %s',
              error.kind,
            );
        }
      })
      .filter(Boolean);

    return {errors, ok: false};
  }

  _traverseSelections(
    selections: ReadonlyArray<ReaderSelection>,
    record: Record,
    data: SelectorData,
  ): boolean /* had all expected data */ {
    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i];

      switch (selection.kind) {
        case 'RequiredField':
          const requiredFieldValue = this._readClientSideDirectiveField(
            selection,
            record,
            data,
          );
          if (!this._handleRequiredFieldValue(selection, requiredFieldValue)) {
            return false;
          }
          break;
        case 'CatchField': {
          const previousResponseFields = this._fieldErrors;

          this._fieldErrors = null;

          const catchFieldValue = this._readClientSideDirectiveField(
            selection,
            record,
            data,
          );

          const field = selection.field?.backingField ?? selection.field;
          const fieldName = field?.alias ?? field?.name;
          // ReaderClientExtension doesn't have `alias` or `name`
          // so we don't support this yet
          invariant(
            fieldName != null,
            "Couldn't determine field name for this field. It might be a ReaderClientExtension - which is not yet supported.",
          );

          data[fieldName] = this._catchErrors(
            catchFieldValue,
            selection.to,
            previousResponseFields,
          );

          break;
        }
        case 'ScalarField':
          this._readScalar(selection, record, data);
          break;
        case 'LinkedField':
          if (selection.plural) {
            this._readPluralLink(selection, record, data);
          } else {
            this._readLink(selection, record, data);
          }
          break;
        case 'Condition':
          const conditionValue = Boolean(
            this._getVariableValue(selection.condition),
          );
          if (conditionValue === selection.passingValue) {
            const hasExpectedData = this._traverseSelections(
              selection.selections,
              record,
              data,
            );
            if (!hasExpectedData) {
              return false;
            }
          }
          break;
        case 'InlineFragment': {
          const hasExpectedData = this._readInlineFragment(
            selection,
            record,
            data,
            false,
          );
          if (hasExpectedData === false) {
            // We are missing @required data, so we bubble up.
            return false;
          }
          break;
        }
        case 'RelayLiveResolver':
        case 'RelayResolver': {
          if (this._useExecTimeResolvers) {
            this._readScalar(selection, record, data);
          } else {
            this._readResolverField(selection, record, data);
          }
          break;
        }
        case 'FragmentSpread':
          this._createFragmentPointer(selection, record, data);
          break;
        case 'AliasedInlineFragmentSpread': {
          this._readAliasedInlineFragment(selection, record, data);
          break;
        }
        case 'ModuleImport':
          this._readModuleImport(selection, record, data);
          break;
        case 'InlineDataFragmentSpread':
          this._createInlineDataOrResolverFragmentPointer(
            selection,
            record,
            data,
          );
          break;
        case 'Defer':
        case 'ClientExtension': {
          const isMissingData = this._isMissingData;
          const alreadyMissingClientEdges = this._missingClientEdges.length;
          const prevParentClientEdge = this._parentClientEdge;
          this._parentClientEdge = null;
          const hasExpectedData = this._traverseSelections(
            selection.selections,
            record,
            data,
          );
          // The only case where we want to suspend due to missing data off of
          // a client extension is if we reached a client edge that we might be
          // able to fetch, or there is a missing data in one of the live resolvers.
          this._isMissingData =
            isMissingData ||
            this._missingClientEdges.length > alreadyMissingClientEdges ||
            this._missingLiveResolverFields.length > 0;
          this._parentClientEdge = prevParentClientEdge;
          if (!hasExpectedData) {
            return false;
          }
          break;
        }
        case 'Stream': {
          const hasExpectedData = this._traverseSelections(
            selection.selections,
            record,
            data,
          );
          if (!hasExpectedData) {
            return false;
          }
          break;
        }
        case 'ActorChange':
          this._readActorChange(selection, record, data);
          break;
        case 'ClientEdgeToClientObject':
        case 'ClientEdgeToServerObject':
          if (
            this._useExecTimeResolvers &&
            (selection.backingField.kind === 'RelayResolver' ||
              selection.backingField.kind === 'RelayLiveResolver')
          ) {
            const {linkedField} = selection;
            if (linkedField.plural) {
              this._readPluralLink(linkedField, record, data);
            } else {
              this._readLink(linkedField, record, data);
            }
          } else {
            this._readClientEdge(selection, record, data);
          }
          break;
        default:
          selection as empty;
          invariant(
            false,
            'RelayReader(): Unexpected ast kind `%s`.',
            selection.kind,
          );
      }
    }
    return true;
  }

  _readClientSideDirectiveField(
    selection: ReaderRequiredField | ReaderCatchField,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    switch (selection.field.kind) {
      case 'ScalarField':
        return this._readScalar(selection.field, record, data);
      case 'LinkedField':
        if (selection.field.plural) {
          return this._readPluralLink(selection.field, record, data);
        } else {
          return this._readLink(selection.field, record, data);
        }

      case 'RelayResolver':
      case 'RelayLiveResolver': {
        if (this._useExecTimeResolvers) {
          return this._readScalar(selection.field, record, data);
        } else {
          return this._readResolverField(selection.field, record, data);
        }
      }
      case 'ClientEdgeToClientObject':
      case 'ClientEdgeToServerObject':
        if (
          this._useExecTimeResolvers &&
          (selection.field.backingField.kind === 'RelayResolver' ||
            selection.field.backingField.kind === 'RelayLiveResolver')
        ) {
          const {field} = selection;
          if (field.linkedField.plural) {
            return this._readPluralLink(field.linkedField, record, data);
          } else {
            return this._readLink(field.linkedField, record, data);
          }
        } else {
          return this._readClientEdge(selection.field, record, data);
        }
      case 'AliasedInlineFragmentSpread':
        return this._readAliasedInlineFragment(selection.field, record, data);
      default:
        selection.field.kind as empty;
        invariant(
          false,
          'RelayReader(): Unexpected ast kind `%s`.',
          selection.field.kind,
        );
    }
  }

  _readResolverField(
    field: ReaderRelayResolver | ReaderRelayLiveResolver,
    record: Record,
    data: SelectorData,
  ): unknown {
    const parentRecordID = RelayModernRecord.getDataID(record);
    const prevErrors = this._fieldErrors;
    this._fieldErrors = null;
    const result = this._readResolverFieldImpl(field, parentRecordID);

    const fieldName = field.alias ?? field.name;
    this._prependPreviousErrors(prevErrors, fieldName);
    data[fieldName] = result;
    return result;
  }

  _readResolverFieldImpl(
    field: ReaderRelayResolver | ReaderRelayLiveResolver,
    parentRecordID: DataID,
  ): unknown {
    const {fragment} = field;

    // Found when reading the resolver fragment, which can happen either when
    // evaluating the resolver and it calls readFragment, or when checking if the
    // inputs have changed since a previous evaluation:
    let snapshot: ?Snapshot;

    // The function `getDataForResolverFragment` serves two purposes:
    // 1. To memoize reads of the resolver's root fragment. This is important
    //    because we may read it twice. Once to check if the results have changed
    //    since last read, and once when we actually evaluate.
    // 2. To intercept the snapshot so that it can be cached by the resolver
    //    cache. This is what enables the change detection described in #1.
    //
    // Note: In the future this can be moved into the ResolverCache.
    const getDataForResolverFragment = (
      singularReaderSelector: SingularReaderSelector,
    ) => {
      if (snapshot != null) {
        // It was already read when checking for input staleness; no need to read it again.
        // Note that the variables like fragmentSeenRecordIDs in the outer closure will have
        // already been set and will still be used in this case.
        return {
          data: snapshot.data,
          fieldErrors: snapshot.fieldErrors,
          isMissingData: snapshot.isMissingData,
        };
      }

      snapshot = read(
        this._recordSource,
        singularReaderSelector,
        // This reads data for a rootFragment in read time resolvers. There is no fragment
        // spread created for it so the existing fragment spread logger can't be used to log
        // unused rootFragments. Thus we skip passing the logger here for now.
        null,
        this._resolverCache,
        undefined,
      );

      return {
        data: snapshot.data,
        fieldErrors: snapshot.fieldErrors,
        isMissingData: snapshot.isMissingData,
      };
    };

    // This function `evaluate` tells the resolver cache how to read this
    // resolver. It returns an `EvaluationResult` which gives the resolver cache:
    // * `resolverResult` The value returned by the resolver function
    // * `snapshot` The snapshot returned when reading the resolver's root fragment (if it has one)
    // * `error` If the resolver throws, its error is caught (inside
    //   `getResolverValue`) and converted into an error object.
    const evaluate = (): EvaluationResult<unknown> => {
      if (fragment != null) {
        const key: SelectorData = {
          __fragmentOwner: this._owner,
          __fragments: {
            [fragment.name]: fragment.args
              ? getArgumentValues(fragment.args, this._variables)
              : {},
          },
          __id: parentRecordID,
        };
        if (this._parentClientEdge !== null) {
          key[PARENT_CLIENT_EDGE] = this._parentClientEdge;
        }
        const resolverContext = {getDataForResolverFragment};
        // $FlowFixMe[incompatible-type]
        return withResolverContext(resolverContext, () => {
          const [resolverResult, resolverError] = getResolverValue(
            field,
            this._variables,
            key,
            this._resolverContext,
          );
          return {error: resolverError, resolverResult, snapshot};
        });
      } else {
        const [resolverResult, resolverError] = getResolverValue(
          field,
          this._variables,
          null,
          this._resolverContext,
        );
        return {error: resolverError, resolverResult, snapshot: undefined};
      }
    };

    const [
      result,
      seenRecord,
      resolverError,
      cachedSnapshot,
      suspenseID,
      updatedDataIDs,
    ] = this._resolverCache.readFromCacheOrEvaluate(
      parentRecordID,
      field,
      this._variables,
      evaluate,
      getDataForResolverFragment,
    );

    this._propagateResolverMetadata(
      field.path,
      cachedSnapshot,
      resolverError,
      seenRecord,
      suspenseID,
      updatedDataIDs,
    );

    return result;
  }

  // Reading a resolver field can uncover missing data, errors, suspense,
  // additional seen records and updated dataIDs. All of these facts must be
  // represented in the snapshot we return for this fragment.
  _propagateResolverMetadata(
    fieldPath: string,
    cachedSnapshot: ?Snapshot,
    resolverError: ?Error,
    seenRecord: ?DataID,
    suspenseID: ?DataID,
    updatedDataIDs: ?DataIDSet,
  ) {
    // The resolver's root fragment (if there is one) may be missing data, have
    // errors, or be in a suspended state. Here we propagate those cases
    // upwards to mimic the behavior of having traversed into that fragment directly.
    if (cachedSnapshot != null) {
      if (cachedSnapshot.missingClientEdges != null) {
        for (let i = 0; i < cachedSnapshot.missingClientEdges.length; i++) {
          const missing = cachedSnapshot.missingClientEdges[i];
          this._missingClientEdges.push(missing);
        }
      }
      if (cachedSnapshot.missingLiveResolverFields != null) {
        this._isMissingData =
          this._isMissingData ||
          cachedSnapshot.missingLiveResolverFields.length > 0;

        for (
          let i = 0;
          i < cachedSnapshot.missingLiveResolverFields.length;
          i++
        ) {
          const missingResolverField =
            cachedSnapshot.missingLiveResolverFields[i];
          this._missingLiveResolverFields.push(missingResolverField);
        }
      }
      if (cachedSnapshot.fieldErrors != null) {
        if (this._fieldErrors == null) {
          this._fieldErrors = [];
        }
        for (let i = 0; i < cachedSnapshot.fieldErrors.length; i++) {
          const error = cachedSnapshot.fieldErrors[i];
          if (this._selector.node.metadata?.throwOnFieldError === true) {
            // If this fragment is @throwOnFieldError, any destructive error
            // encountered inside a resolver's fragment is equivilent to the
            // resolver field having a field error, and we want that to cause this
            // fragment to throw. So, we propagate all errors as is.
            this._fieldErrors.push(error);
          } else {
            // If this fragment is _not_ @throwOnFieldError, we will simply
            // accept that any destructive errors encountered in the resolver's
            // root fragment will cause the resolver to return null, and well
            // pass the errors along to the logger marked as "handled".
            this._fieldErrors.push(markFieldErrorHasHandled(error));
          }
        }
      }
      this._isMissingData = this._isMissingData || cachedSnapshot.isMissingData;
    }

    // If the resolver errored, we track that as part of our traversal so that
    // the errors can be attached to this read's snapshot. This allows the error
    // to be logged.
    if (resolverError) {
      const errorEvent: FieldError = {
        error: resolverError,
        fieldPath,
        handled: false,
        kind: 'relay_resolver.error',
        owner: this._fragmentName,
        shouldThrow: this._selector.node.metadata?.throwOnFieldError ?? false,
        // the uiContext is always undefined here.
        // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
        uiContext: undefined,
      };
      if (this._fieldErrors == null) {
        this._fieldErrors = [errorEvent];
      } else {
        this._fieldErrors.push(errorEvent);
      }
    }

    // The resolver itself creates a record in the store. We record that we've
    // read this record so that subscribers to this snapshot also subscribe to
    // this resolver.
    if (seenRecord != null) {
      this._seenRecords.add(seenRecord);
    }

    // If this resolver, or a dependency of this resolver, has suspended, we
    // need to report that in our snapshot. The `suspenseID` is the key in to
    // store where the suspended LiveState value lives. This ID allows readers
    // of the snapshot to subscribe to updates on that live resolver so that
    // they know when to unsuspend.
    if (suspenseID != null) {
      this._isMissingData = true;
      this._missingLiveResolverFields.push(suspenseID);
    }
    if (updatedDataIDs != null) {
      // Iterating a Set with for of is okay
      // eslint-disable-next-line relay-internal/no-for-of-loops
      updatedDataIDs.forEach(recordID => {
        this._updatedDataIDs.add(recordID);
      });
    }
  }

  _readClientEdge(
    field: ReaderClientEdge,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const backingField = field.backingField;

    // Because ReaderClientExtension doesn't have `alias` or `name` and so I don't know
    // how to get its fieldName or storageKey yet:
    invariant(
      backingField.kind !== 'ClientExtension',
      'Client extension client edges are not yet implemented.',
    );

    const fieldName = backingField.alias ?? backingField.name;
    const backingFieldData = {};
    this._traverseSelections([backingField], record, backingFieldData);
    // At this point, backingFieldData is an object with a single key (fieldName)
    // whose value is the value returned from the resolver, or a suspense sentinel.

    // $FlowFixMe[invalid-computed-prop]
    const clientEdgeResolverResponse = backingFieldData[fieldName];
    if (
      clientEdgeResolverResponse == null ||
      isSuspenseSentinel(clientEdgeResolverResponse)
    ) {
      data[fieldName] = clientEdgeResolverResponse;
      return clientEdgeResolverResponse;
    }

    if (field.linkedField.plural) {
      invariant(
        Array.isArray(clientEdgeResolverResponse),
        'Expected plural Client Edge Relay Resolver at `%s` in `%s` to return an array containing IDs or objects with shape {id}.',
        backingField.path,
        this._owner.identifier,
      );
      invariant(
        field.kind === 'ClientEdgeToClientObject',
        'Unexpected Client Edge to plural server type `%s`. This should be prevented by the compiler.',
        field.kind,
      );
      let storeIDs: Array<?DataID>;
      let perItemEdges: ?Array<ClientEdgeTraversalInfo | null>;
      if (field.backingField.normalizationInfo == null) {
        // @edgeTo case: compute storeIDs and per-item traversal segments.
        // Server-type items get a segment so that missing data in their
        // sub-tree triggers a waterfall refetch; all other items get null.
        storeIDs = [];
        perItemEdges = [];
        for (let i = 0; i < clientEdgeResolverResponse.length; i++) {
          const itemResponse = clientEdgeResolverResponse[i];
          // A plural resolver (e.g. a plural magic fragment) may return a list
          // with nullish items — a nullable list element. Read those through as a
          // null edge rather than dereferencing `__typename` on a nullish value.
          if (itemResponse == null) {
            storeIDs.push(null);
            perItemEdges.push(null);
            continue;
          }
          const concreteType = field.concreteType ?? itemResponse.__typename;
          invariant(
            typeof concreteType === 'string',
            'Expected resolver for field at `%s` in `%s` modeling an edge to an abstract type to return an object with a `__typename` property.',
            backingField.path,
            this._owner.identifier,
          );
          const localId = extractIdFromResponse(
            itemResponse,
            backingField.path,
            this._owner.identifier,
          );
          const modelResolvers = field.modelResolvers;
          if (modelResolvers != null) {
            const modelResolver = modelResolvers[concreteType];
            if (modelResolver !== undefined) {
              // Model resolver type: namespace the ID and read the model.
              const id = this._resolverCache.ensureClientRecord(
                localId,
                concreteType,
              );
              const model = this._readResolverFieldImpl(modelResolver, id);
              storeIDs.push(model != null ? id : null);
              perItemEdges.push(null);
            } else {
              storeIDs.push(localId);

              // Server/CLient Schema Extension type: check for a refetch operation so that
              // missing data in this item's sub-tree triggers a waterfall.
              const serverOperation =
                field.serverObjectOperations?.[concreteType] ?? null;
              if (serverOperation != null) {
                perItemEdges.push({
                  clientEdgeDestinationID: localId,
                  readerClientEdge: {operation: serverOperation},
                });
              } else {
                perItemEdges.push(null);
              }
            }
          } else {
            // No model resolvers — concrete client object edge.
            storeIDs.push(
              this._resolverCache.ensureClientRecord(localId, concreteType),
            );
            perItemEdges.push(null);
          }
        }
      } else {
        // The normalization process in LiveResolverCache should take care of
        // generating the correct ID.
        // (The read-in-place inline arms (`ServerWeak`/`AbstractInline`) are
        // singular-only at the compiler, so this plural branch never carries a
        // resolver-returned `__id` pointer and keeps `extractIdFromResponse`
        // unchanged.)
        storeIDs = clientEdgeResolverResponse.map(obj =>
          extractIdFromResponse(obj, backingField.path, this._owner.identifier),
        );
        perItemEdges = null;
      }
      const prevParentClientEdge = this._parentClientEdge;
      this._parentClientEdge = null;
      const edgeValues = this._readLinkedIds(
        field.linkedField,
        storeIDs,
        record,
        data,
        perItemEdges,
      );
      this._parentClientEdge = prevParentClientEdge;
      data[fieldName] = edgeValues;
      return edgeValues;
    } else {
      // The resolver-returned `__id` store key is preferred ONLY for the
      // read-in-place inline arms (`ServerWeak`/`AbstractInline`), whose value
      // is normalized in place by the magic-fragment transplant and surfaced via
      // `__id`. Every other edge — `@edgeTo`/CSE server objects and the
      // `OutputType`/`WeakModel` inline arms — keeps `extractIdFromResponse`
      // exactly, so this change alters no existing client-edge store key.
      const inlineKind = backingField.normalizationInfo?.kind;
      const id =
        inlineKind === 'ServerWeak' || inlineKind === 'AbstractInline'
          ? extractStoreIDFromResponse(
              clientEdgeResolverResponse,
              backingField.path,
              this._owner.identifier,
            )
          : extractIdFromResponse(
              clientEdgeResolverResponse,
              backingField.path,
              this._owner.identifier,
            );
      let storeID: DataID;
      const concreteType =
        field.concreteType ?? clientEdgeResolverResponse.__typename;
      let traversalPathSegment: ClientEdgeTraversalInfo | null;
      if (field.kind === 'ClientEdgeToClientObject') {
        if (field.backingField.normalizationInfo == null) {
          invariant(
            typeof concreteType === 'string',
            'Expected resolver for field at `%s` in `%s` modeling an edge to an abstract type to return an object with a `__typename` property.',
            backingField.path,
            this._owner.identifier,
          );
          const modelResolvers = field.modelResolvers;
          if (modelResolvers != null) {
            const modelResolver = modelResolvers[concreteType];
            if (modelResolver !== undefined) {
              // Model resolver type: namespace the ID and read the model.
              storeID = this._resolverCache.ensureClientRecord(
                id,
                concreteType,
              );
              const model = this._readResolverFieldImpl(modelResolver, storeID);
              if (model == null) {
                // If the model resolver returns undefined, we should still
                // return null to match GQL behavior.
                data[fieldName] = null;
                return null;
              }
              traversalPathSegment = null;
            } else {
              // Server/CSE type: use the original ID directly. The data
              // lives in the store under the original ID, not a namespaced
              // client record.
              storeID = id;
              // Check if there is a refetch query for this server type.
              const serverObjectOperations = field.serverObjectOperations;
              const serverOp =
                serverObjectOperations != null
                  ? serverObjectOperations[concreteType]
                  : null;
              if (serverOp != null) {
                traversalPathSegment = {
                  clientEdgeDestinationID: id,
                  readerClientEdge: {operation: serverOp},
                };
              } else {
                traversalPathSegment = null;
              }
            }
          } else {
            // No model resolvers — concrete client object edge.
            // @edgeTo case where we need to ensure that the record has `id` field
            storeID = this._resolverCache.ensureClientRecord(id, concreteType);
            traversalPathSegment = null;
          }
        } else {
          // Inline arm. Shapes that share this branch:
          //  * `OutputType`/`WeakModel`: LiveResolverCache normalized the resolver
          //    value into a record under `id` (the resolver-returned id).
          //  * `ServerWeak` (shadow server-value): NO second
          //    normalization happened. `id` is the injected `__id` (the DataID of
          //    the transplanted `client:<parentid>:<field>` record), so `storeID`
          //    addresses the record the main operation already normalized in
          //    place. Mis-wiring this `__id` would silently read a wrong/empty
          //    record (a prod-silent miscompile), so in dev we assert the record
          //    exists before reading its selections.
          //  * `AbstractInline` (interface/union): dispatched per concrete
          //    `__typename` via `inlineKinds` — a `ServerWeak` member behaves like
          //    the scalar `ServerWeak` arm, a `WeakModel` member like `WeakModel`.
          storeID = id;
          const inlineNormalizationInfo = field.backingField.normalizationInfo;
          const effectiveKind =
            inlineNormalizationInfo?.kind === 'AbstractInline'
              ? inlineNormalizationInfo.inlineKinds[concreteType]
              : inlineNormalizationInfo?.kind;
          if (__DEV__ && effectiveKind === 'ServerWeak') {
            invariant(
              this._recordSource.get(storeID) != null,
              'RelayReader: Expected the in-place shadow record `%s` (read off ' +
                'the injected `__id` for field at `%s` in `%s`) to exist in the ' +
                'store. A missing record means the magic-fragment transplant did ' +
                'not normalize the shadowed server value at this DataID.',
              storeID,
              backingField.path,
              this._owner.identifier,
            );
          }
          traversalPathSegment = null;
        }
      } else {
        storeID = id;
        traversalPathSegment = {
          clientEdgeDestinationID: id,
          readerClientEdge: field,
        };
      }
      const prevParentClientEdge = this._parentClientEdge;
      this._parentClientEdge = traversalPathSegment;

      const prevData = data[fieldName];
      invariant(
        prevData == null || typeof prevData === 'object',
        'RelayReader(): Expected data for field at `%s` in `%s` on record `%s` ' +
          'to be an object, got `%s`.',
        backingField.path,
        this._owner.identifier,
        RelayModernRecord.getDataID(record),
        prevData,
      );
      const prevErrors = this._fieldErrors;
      this._fieldErrors = null;
      const edgeValue = this._traverse(
        field.linkedField,
        storeID,
        // $FlowFixMe[incompatible-variance]
        prevData,
      );
      this._prependPreviousErrors(prevErrors, fieldName);
      this._parentClientEdge = prevParentClientEdge;
      data[fieldName] = edgeValue;
      return edgeValue;
    }
  }

  _readScalar(
    field: ReaderScalarField | ReaderRelayResolver | ReaderRelayLiveResolver,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;
    const storageKey = getStorageKey(field, this._variables);
    if (this._fieldGranularNotificationDataID != null) {
      this._seenRecords.add(
        getFieldNotificationKey(
          this._fieldGranularNotificationDataID,
          storageKey,
        ),
      );
    }
    const value = RelayModernRecord.getValue(record, storageKey);
    if (
      value === null ||
      (RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS &&
        Array.isArray(value) &&
        value.length === 0)
    ) {
      this._maybeAddFieldErrors(record, storageKey, fieldName);
    } else if (value === undefined) {
      this._markDataAsMissing(fieldName);
    }
    data[fieldName] = value;
    return value;
  }

  _readLink(
    field: ReaderLinkedField,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;
    const storageKey = getStorageKey(field, this._variables);
    if (this._fieldGranularNotificationDataID != null) {
      this._seenRecords.add(
        getFieldNotificationKey(
          this._fieldGranularNotificationDataID,
          storageKey,
        ),
      );
    }
    const linkedID = RelayModernRecord.getLinkedRecordID(record, storageKey);
    if (linkedID == null) {
      data[fieldName] = linkedID;
      if (linkedID === null) {
        this._maybeAddFieldErrors(record, storageKey, fieldName);
      } else if (linkedID === undefined) {
        this._markDataAsMissing(fieldName);
      }
      return linkedID;
    }

    const prevData = data[fieldName];
    invariant(
      prevData == null || typeof prevData === 'object',
      'RelayReader(): Expected data for field `%s` at `%s` on record `%s` ' +
        'to be an object, got `%s`.',
      fieldName,
      this._owner.identifier,
      RelayModernRecord.getDataID(record),
      prevData,
    );
    const prevErrors = this._fieldErrors;
    this._fieldErrors = null;
    // $FlowFixMe[incompatible-variance]
    const value = this._traverse(field, linkedID, prevData);

    this._prependPreviousErrors(prevErrors, fieldName);
    data[fieldName] = value;
    return value;
  }

  /**
   * Adds a set of field errors to `this._fieldErrors`, ensuring the
   * `fieldPath` property of existing field errors are prefixed with the given
   * `fieldNameOrIndex`.
   *
   * In order to make field errors maximally useful in logs/errors, we want to
   * include the path to the field that caused the error. A naive approach would
   * be to maintain a path property on RelayReader which we push/pop field names
   * to as we traverse into fields/etc. However, this would be expensive to
   * maintain, and in the common case where there are no field errors, the work
   * would go unused.
   *
   * Instead, we take a lazy approach where as we exit the recurison into a
   * field/etc we prepend any errors encountered while traversing that field
   * with the field name. This is somewhat more expensive in the error case, but
   * ~free in the common case where there are no errors.
   *
   * To achieve this, named field readers must do the following to correctly
   * track error filePaths:
   *
   * 1. Stash the value of `this._fieldErrors` in a local variable
   * 2. Set `this._fieldErrors` to `null`
   * 3. Traverse into the field
   * 4. Call this method with the stashed errors and the field's name
   *
   * Similarly, when creating field errors, we simply initialize the `fieldPath`
   * as the direct field name.
   *
   * Today we use this apporach for `missing_expected_data`,
   * `missing_required_field` and `relay_field_payload` errors, but we intend
   * to broaden it to handle all field error paths.
   */
  _prependPreviousErrors(
    prevErrors: ?Array<FieldError>,
    fieldNameOrIndex: string | number,
  ): void {
    if (this._fieldErrors != null) {
      for (let i = 0; i < this._fieldErrors.length; i++) {
        const event = this._fieldErrors[i];
        if (
          event.owner === this._fragmentName &&
          (event.kind === 'relay_field_payload.error' ||
            event.kind === 'missing_expected_data.throw' ||
            event.kind === 'missing_expected_data.log' ||
            event.kind === 'missing_required_field.throw' ||
            event.kind === 'missing_required_field.log')
        ) {
          event.fieldPath = `${fieldNameOrIndex}.${event.fieldPath}`;
        }
      }
      if (prevErrors != null) {
        for (let i = this._fieldErrors.length - 1; i >= 0; i--) {
          prevErrors.push(this._fieldErrors[i]);
        }
        this._fieldErrors = prevErrors;
      }
    } else {
      this._fieldErrors = prevErrors;
    }
  }

  _readActorChange(
    field: ReaderActorChange,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;
    const storageKey = getStorageKey(field, this._variables);
    const externalRef = RelayModernRecord.getActorLinkedRecordID(
      record,
      storageKey,
    );

    if (externalRef == null) {
      data[fieldName] = externalRef;
      if (externalRef === undefined) {
        this._markDataAsMissing(fieldName);
      } else if (externalRef === null) {
        this._maybeAddFieldErrors(record, storageKey, fieldName);
      }
      return data[fieldName];
    }
    const [actorIdentifier, dataID] = externalRef;

    const fragmentRef = {};
    this._createFragmentPointer(
      field.fragmentSpread,
      RelayModernRecord.fromObject<>({
        __id: dataID,
      }),
      fragmentRef,
    );
    data[fieldName] = {
      __fragmentRef: fragmentRef,
      __viewer: actorIdentifier,
    };
    return data[fieldName];
  }

  _readPluralLink(
    field: ReaderLinkedField,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;
    const storageKey = getStorageKey(field, this._variables);
    if (this._fieldGranularNotificationDataID != null) {
      this._seenRecords.add(
        getFieldNotificationKey(
          this._fieldGranularNotificationDataID,
          storageKey,
        ),
      );
    }
    const linkedIDs = RelayModernRecord.getLinkedRecordIDs(record, storageKey);
    if (
      linkedIDs === null ||
      (RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS &&
        Array.isArray(linkedIDs) &&
        linkedIDs.length === 0)
    ) {
      this._maybeAddFieldErrors(record, storageKey, fieldName);
    }
    return this._readLinkedIds(field, linkedIDs, record, data);
  }

  _readLinkedIds(
    field: ReaderLinkedField,
    linkedIDs: ?ReadonlyArray<?DataID>,
    record: Record,
    data: SelectorData,
    perItemEdges?: ?ReadonlyArray<ClientEdgeTraversalInfo | null>,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;

    if (linkedIDs == null) {
      data[fieldName] = linkedIDs;
      if (linkedIDs === undefined) {
        this._markDataAsMissing(fieldName);
      }
      return linkedIDs;
    }

    const prevData = data[fieldName];
    invariant(
      prevData == null || Array.isArray(prevData),
      'RelayReader(): Expected data for field `%s` on record `%s` ' +
        'to be an array, got `%s`.',
      fieldName,
      RelayModernRecord.getDataID(record),
      prevData,
    );
    const prevErrors = this._fieldErrors;
    this._fieldErrors = null;
    const linkedArray = prevData || [];
    linkedIDs.forEach((linkedID, nextIndex) => {
      if (linkedID == null) {
        if (linkedID === undefined) {
          this._markDataAsMissing(String(nextIndex));
        }
        // $FlowFixMe[cannot-write]
        linkedArray[nextIndex] = linkedID;
        return;
      }
      const prevItem = linkedArray[nextIndex];
      invariant(
        prevItem == null || typeof prevItem === 'object',
        'RelayReader(): Expected data for field `%s` on record `%s` ' +
          'to be an object, got `%s`.',
        fieldName,
        RelayModernRecord.getDataID(record),
        prevItem,
      );
      const prevErrors = this._fieldErrors;
      this._fieldErrors = null;
      const prevParentClientEdge = this._parentClientEdge;
      if (perItemEdges != null) {
        this._parentClientEdge = perItemEdges[nextIndex] ?? null;
      }
      // $FlowFixMe[cannot-write]
      // $FlowFixMe[incompatible-variance]
      linkedArray[nextIndex] = this._traverse(field, linkedID, prevItem);
      this._parentClientEdge = prevParentClientEdge;
      this._prependPreviousErrors(prevErrors, nextIndex);
    });
    this._prependPreviousErrors(prevErrors, fieldName);
    data[fieldName] = linkedArray;
    return linkedArray;
  }

  /**
   * Reads a ReaderModuleImport, which was generated from using the @module
   * directive.
   */
  _readModuleImport(
    moduleImport: ReaderModuleImport,
    record: Record,
    data: SelectorData,
  ): void {
    // Determine the component module from the store: if the field is missing
    // it means we don't know what component to render the match with.
    const componentKey = getModuleComponentKey(moduleImport.documentName);
    const relayStoreComponent = RelayModernRecord.getValue(
      record,
      componentKey,
    );
    // componentModuleProvider is used by Client 3D for read time resolvers.
    const component =
      relayStoreComponent !== undefined
        ? relayStoreComponent
        : moduleImport.componentModuleProvider;
    if (component == null) {
      if (component === undefined) {
        this._markDataAsMissing('<module-import>');
      }
      return;
    }

    // Otherwise, read the fragment and module associated to the concrete
    // type, and put that data with the result:
    // - For the matched fragment, create the relevant fragment pointer and add
    //   the expected fragmentPropName
    // - For the matched module, create a reference to the module
    this._createFragmentPointer(
      {
        args: moduleImport.args,
        kind: 'FragmentSpread',
        name: moduleImport.fragmentName,
      },
      record,
      data,
    );
    data[FRAGMENT_PROP_NAME_KEY] = moduleImport.fragmentPropName;
    data[MODULE_COMPONENT_KEY] = component;
  }

  /**
   * Aliased inline fragments allow the user to check if the data in an inline
   * fragment was fetched. Data in the inline fragment can be conditional in the
   * case of a type condition on the inline fragment or directives like `@skip`
   * or `@include`.
   *
   * We model aliased inline fragments as a special reader node wrapped around a
   * regular inline fragment reader node.
   *
   * This allows us to read the inline fragment as normal, check if it matched,
   * and then define the alias to either contain the inline fragment's data, or
   * null.
   */
  _readAliasedInlineFragment(
    aliasedInlineFragment: ReaderAliasedInlineFragmentSpread,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const prevErrors = this._fieldErrors;
    this._fieldErrors = null;
    let fieldValue = this._readInlineFragment(
      aliasedInlineFragment.fragment,
      record,
      {},
      true,
    );
    this._prependPreviousErrors(prevErrors, aliasedInlineFragment.name);
    if (fieldValue === false) {
      fieldValue = null;
    }
    data[aliasedInlineFragment.name] = fieldValue;
    return fieldValue;
  }

  // Has three possible return values:
  // * null: The type condition did not match
  // * undefined: We are missing data
  // * false: The selection contained missing @required fields
  // * data: The successfully populated SelectorData object
  //
  // The `skipUnmatchedAbstractTypes` flag is used to signal if we should skip
  // reading the contents of an inline fragment on an abstract type if we _know_
  // the type condition does not match.
  _readInlineFragment(
    inlineFragment: ReaderInlineFragment,
    record: Record,
    data: SelectorData,
    skipUnmatchedAbstractTypes: boolean,
  ): ?(SelectorData | false) {
    if (inlineFragment.type == null) {
      // Inline fragment without a type condition: always read data
      // Usually this would get compiled away, but fragments with @alias
      // and no type condition will get preserved.
      const hasExpectedData = this._traverseSelections(
        inlineFragment.selections,
        record,
        data,
      );
      if (hasExpectedData === false) {
        return false;
      }
      return data;
    }
    const {abstractKey} = inlineFragment;
    if (abstractKey == null) {
      // concrete type refinement: only read data if the type exactly matches
      if (!this._recordMatchesTypeCondition(record, inlineFragment.type)) {
        // This selection does not match the fragment spread. Do nothing.
        return null;
      } else {
        const hasExpectedData = this._traverseSelections(
          inlineFragment.selections,
          record,
          data,
        );
        if (!hasExpectedData) {
          // Bubble up null due to a missing @required field
          return false;
        }
      }
    } else {
      const implementsInterface = this._implementsInterface(
        record,
        abstractKey,
      );

      if (implementsInterface === false && skipUnmatchedAbstractTypes) {
        return null;
      }

      // store flags to reset after reading
      const parentIsMissingData = this._isMissingData;
      const parentIsWithinUnmatchedTypeRefinement =
        this._isWithinUnmatchedTypeRefinement;

      this._isWithinUnmatchedTypeRefinement =
        parentIsWithinUnmatchedTypeRefinement || implementsInterface === false;

      // @required is allowed within inline fragments on abstract types if they
      // have @alias. So we must bubble up null if we have a missing @required
      // field.
      const hasMissingData = this._traverseSelections(
        inlineFragment.selections,
        record,
        data,
      );

      // Reset
      this._isWithinUnmatchedTypeRefinement =
        parentIsWithinUnmatchedTypeRefinement;

      if (implementsInterface === false) {
        // Type known to not implement the interface, no data expected
        this._isMissingData = parentIsMissingData;
        return null;
      } else if (implementsInterface == null) {
        // Don't know if the type implements the interface or not
        return undefined;
      } else if (hasMissingData === false) {
        // Bubble up null due to a missing @required field
        return false;
      }
    }
    return data;
  }

  _recordMatchesTypeCondition(record: Record, type: string): boolean {
    const typeName = RelayModernRecord.getType(record);
    return (
      (typeName != null && typeName === type) ||
      // The root record type is a special `__Root` type and may not match the
      // type on the ast, so ignore type mismatches at the root.  We currently
      // detect whether we're at the root by checking against ROOT_ID, but this
      // does not work for mutations/subscriptions which generate unique root
      // ids. This is acceptable in practice as we don't read data for
      // mutations/subscriptions in a situation where we would use
      // isMissingData to decide whether to suspend or not.
      // TODO T96653810: Correctly detect reading from root of mutation/subscription
      RelayModernRecord.getDataID(record) === ROOT_ID
    );
  }

  _createFragmentPointer(
    fragmentSpread: ReaderFragmentSpread,
    record: Record,
    data: SelectorData,
  ): void {
    let fragmentPointers = data[FRAGMENTS_KEY];
    if (fragmentPointers == null) {
      fragmentPointers = data[FRAGMENTS_KEY] = {} as {
        [key: string]: Arguments,
      };
    }
    invariant(
      typeof fragmentPointers === 'object' && fragmentPointers != null,
      'RelayReader: Expected fragment spread data to be an object, got `%s`.',
      fragmentPointers,
    );

    if (data[ID_KEY] == null) {
      data[ID_KEY] = RelayModernRecord.getDataID(record);
    }
    const args = getArgumentValues(
      fragmentSpread.args,
      this._variables,
      this._isWithinUnmatchedTypeRefinement,
    );
    // $FlowFixMe[cannot-write] - writing into read-only field
    fragmentPointers[fragmentSpread.name] = args;
    data[FRAGMENT_OWNER_KEY] = this._owner;

    if (this._parentClientEdge !== null) {
      data[PARENT_CLIENT_EDGE] = this._parentClientEdge;
    }

    if (RelayFeatureFlags.ENABLE_READER_FRAGMENTS_LOGGING) {
      this._log?.({
        name: 'reader.fragmentSpread',
        fragmentName: fragmentSpread.name,
        data,
      });
    }
  }

  _createInlineDataOrResolverFragmentPointer(
    fragmentSpreadOrFragment: ReaderInlineDataFragmentSpread | ReaderFragment,
    record: Record,
    data: SelectorData,
  ): void {
    let fragmentPointers = data[FRAGMENTS_KEY];
    if (fragmentPointers == null) {
      fragmentPointers = data[FRAGMENTS_KEY] = {} as {[key: string]: {...}};
    }
    invariant(
      typeof fragmentPointers === 'object' && fragmentPointers != null,
      'RelayReader: Expected fragment spread data to be an object, got `%s`.',
      fragmentPointers,
    );
    if (data[ID_KEY] == null) {
      data[ID_KEY] = RelayModernRecord.getDataID(record);
    }
    const inlineData = {};
    const parentFragmentName = this._fragmentName;
    this._fragmentName = fragmentSpreadOrFragment.name;

    const parentVariables = this._variables;

    // If the inline fragment spread has arguments, we need to temporarily
    // switch this._variables to include the fragment spread's arguments
    // for the duration of its traversal.
    const argumentVariables = fragmentSpreadOrFragment.args
      ? getArgumentValues(fragmentSpreadOrFragment.args, this._variables)
      : {};

    this._variables = RelayConcreteVariables.getFragmentVariables(
      fragmentSpreadOrFragment,
      this._owner.variables,
      argumentVariables,
    );

    this._traverseSelections(
      fragmentSpreadOrFragment.selections,
      record,
      inlineData,
    );

    // Put the parent variables back
    this._variables = parentVariables;

    this._fragmentName = parentFragmentName;
    // $FlowFixMe[cannot-write] - writing into read-only field
    fragmentPointers[fragmentSpreadOrFragment.name] = inlineData;
  }

  _implementsInterface(record: Record, abstractKey: string): ?boolean {
    const typeName = RelayModernRecord.getType(record);
    const typeRecord = this._recordSource.get(generateTypeID(typeName));
    const implementsInterface =
      typeRecord != null
        ? RelayModernRecord.getValue(typeRecord, abstractKey)
        : null;

    if (implementsInterface == null) {
      // The compiler lists every implementor of a client abstract type in the
      // operation's `clientAbstractTypes`, so a listed type implements it even
      // when no type record answers: `check()` writes none for an operation
      // not written since `invalidateStore()`, and GC collects it once no
      // retained operation references it. An unlisted type stays unknown,
      // because nothing guarantees the owner was compiled with this fragment.
      if (
        this._owner.node.operation.clientAbstractTypes?.[abstractKey]?.includes(
          typeName,
        ) === true
      ) {
        return true;
      }
      // In some cases, like a graph relationship change, we might have never
      // fetched the `__is[AbstractType]` flag for this concrete type. In this
      // case we need to report that we are missing data, in case that field is
      // still in flight.
      this._markDataAsMissing('<abstract-type-hint>');
    }
    // $FlowFixMe[incompatible-type] Casting record value
    return implementsInterface;
  }
}

function markFieldErrorHasHandled(event: FieldError): FieldError {
  switch (event.kind) {
    case 'missing_expected_data.throw':
    case 'missing_required_field.throw':
    case 'relay_field_payload.error':
    case 'relay_resolver.error':
      return {...event, handled: true};
    case 'missing_expected_data.log':
    case 'missing_required_field.log':
      return event;
    default:
      event.kind as empty;
      invariant(false, 'Unexpected error response field kind: %s', event.kind);
  }
}

// Constructs the arguments for a resolver function and then evaluates it.
//
// If the resolver's fragment is missing data (query is in-flight, a dependency
// field is suspending, or is missing required fields) then `readFragment` will
// throw `RESOLVER_FRAGMENT_MISSING_DATA_SENTINEL`. This function ensures that
// we catch that error and instead create an error object which can be
// propagated to the reader snapshot.
function getResolverValue(
  field: ReaderRelayResolver | ReaderRelayLiveResolver,
  variables: Variables,
  fragmentKey: unknown,
  resolverContext: ?ResolverContext,
): [unknown, ?Error] {
  // Support for languages that work (best) with ES6 modules, such as TypeScript.
  const resolverFunction =
    typeof field.resolverModule === 'function'
      ? field.resolverModule
      : field.resolverModule.default;

  let resolverResult = null;
  let resolverError = null;

  try {
    const resolverFunctionArgs = [];
    if (field.fragment != null) {
      resolverFunctionArgs.push(fragmentKey);
    }
    const args = field.args
      ? getArgumentValues(field.args, variables)
      : undefined;

    resolverFunctionArgs.push(args);

    resolverFunctionArgs.push(resolverContext);

    resolverResult = resolverFunction.apply(null, resolverFunctionArgs);
  } catch (e) {
    // GraphQL coerces resolver errors to null or nullable fields, and Relay
    // does not support non-nullable Relay Resolvers.
    resolverResult = null;
    if (e !== RESOLVER_FRAGMENT_ERRORED_SENTINEL) {
      resolverError = e;
    }
  }
  return [resolverResult, resolverError];
}

function extractIdFromResponse(
  individualResponse: unknown,
  path: string,
  owner: string,
): string {
  if (typeof individualResponse === 'string') {
    return individualResponse;
  } else if (
    typeof individualResponse === 'object' &&
    individualResponse != null &&
    typeof individualResponse.id === 'string'
  ) {
    return individualResponse.id;
  }
  invariant(
    false,
    'Expected object returned from edge resolver to be a string or an object with an `id` property at path %s in %s,',
    path,
    owner,
  );
}

// The DataID (store key) for a read-in-place inline arm. Called ONLY for the
// `ServerWeak`/`AbstractInline` kinds (the caller gates on kind so no other edge
// reaches here).
//
// A `ServerWeak` member's resolver surfaces the shadowed record's `__id` (its
// exact DataID, e.g. `client:<parentid>:<field>`), so we read off that directly
// — a non-Node server value type has no `id` field to guess from. A `WeakModel`
// member of an `AbstractInline` return carries no `__id`, so it falls back to
// `extractIdFromResponse` (the resolver-returned id), exactly as a scalar
// `WeakModel` arm does.
function extractStoreIDFromResponse(
  individualResponse: unknown,
  path: string,
  owner: string,
): string {
  if (
    typeof individualResponse === 'object' &&
    individualResponse != null &&
    typeof individualResponse.__id === 'string'
  ) {
    return individualResponse.__id;
  }
  return extractIdFromResponse(individualResponse, path, owner);
}

// ----------------------------------------------------------------------
// Optimized implementation: RelayReaderOptimized, readPerf.
// Used only when ENABLE_PERF_READER is on; otherwise the code above runs
// unchanged.

// Fragment pointers to fragment spreads without arguments (nearly all) share
// these arguments objects.
const NO_FRAGMENT_ARGUMENTS: Arguments = Object.freeze({});

const NO_FRAGMENT_ARGUMENTS_WITHIN_UNMATCHED_TYPE_REFINEMENT: Arguments =
  Object.freeze({[FRAGMENT_POINTER_IS_WITHIN_UNMATCHED_TYPE_REFINEMENT]: true});

// Snapshots of reads without missing live resolver fields (nearly all) share
// this array.
const NO_MISSING_LIVE_RESOLVER_FIELDS: ReadonlyArray<DataID> = Object.freeze(
  [],
);

/**
 * @private
 */
class RelayReaderOptimized {
  _parentClientEdge: ClientEdgeTraversalInfo | null;
  _isMissingData: boolean;
  _missingClientEdges: ?Array<MissingClientEdgeRequestInfo>;
  _missingLiveResolverFields: ?Array<DataID>;
  _isWithinUnmatchedTypeRefinement: boolean;
  _fieldErrors: ?FieldErrors;
  _fieldGranularNotificationDataID: ?DataID;
  _owner: RequestDescriptor;
  // Exec time resolvers are run before reaching the Relay store so the store already contains
  // the normalized data; the same as if the data were sent from the server. However, since a
  // resolver could be used at read time or exec time in different queries, the reader AST for
  // a resolver is the read time AST. At runtime, this flag is used to ignore the extra
  // information in the read time resolver AST and use the "standard", non-resolver read paths
  _useExecTimeResolvers: boolean;
  _recordSource: RecordSource;
  _seenRecords: DataIDSet;
  _updatedDataIDs: ?DataIDSet;
  _selector: SingularReaderSelector;
  _variables: Variables;
  _resolverCache: ResolverCache;
  _fragmentName: string;
  _resolverContext: ?ResolverContext;
  // The log function currently is only used to log fragment spread accesses for unused
  // fragments detection, so it is not passed in from all callsites. If we decide to
  // extend the logging, this needs to be updated.
  _log: ?LogFunction;

  constructor(
    recordSource: RecordSource,
    selector: SingularReaderSelector,
    log: ?LogFunction,
    resolverCache: ResolverCache,
    resolverContext: ?ResolverContext,
  ) {
    this._parentClientEdge = selector.parentClientEdge;
    this._missingClientEdges = null;
    this._missingLiveResolverFields = null;
    this._isMissingData = false;
    this._isWithinUnmatchedTypeRefinement = false;
    this._fieldErrors = null;
    this._fieldGranularNotificationDataID = null;
    this._owner = selector.owner;
    this._useExecTimeResolvers =
      this._owner.node.operation.use_exec_time_resolvers ??
      this._owner.node.operation.exec_time_resolvers_enabled_provider?.get() ===
        true ??
      false;
    this._recordSource = recordSource;
    this._seenRecords = new Set();
    this._selector = selector;
    this._variables = selector.variables;
    this._resolverCache = resolverCache;
    this._fragmentName = selector.node.name;
    this._updatedDataIDs = null;
    this._resolverContext = resolverContext;
    this._log = log;
  }

  read(): Snapshot {
    const {node, dataID, isWithinUnmatchedTypeRefinement} = this._selector;
    const {abstractKey} = node;
    const record = this._recordSource.get(dataID);

    // Relay historically allowed child fragments to be read even if the root object
    // did not match the type of the fragment: either the root object has a different
    // concrete type than the fragment (for concrete fragments) or the root object does
    // not conform to the interface/union for abstract fragments.
    // For suspense purposes, however, we want to accurately compute whether any data
    // is missing: but if the fragment type doesn't match (or a parent type didn't
    // match), then no data is expected to be present.

    // By default data is expected to be present unless this selector was read out
    // from within a non-matching type refinement in a parent fragment:
    let isDataExpectedToBePresent = !isWithinUnmatchedTypeRefinement;

    // If this is a concrete fragment and the concrete type of the record does not
    // match, then no data is expected to be present.
    if (isDataExpectedToBePresent && abstractKey == null && record != null) {
      if (!this._recordMatchesTypeCondition(record, node.type)) {
        isDataExpectedToBePresent = false;
      }
    }

    // If this is an abstract fragment (and the precise refinement GK is enabled)
    // then data is only expected to be present if the record type is known to
    // implement the interface. If we aren't sure whether the record implements
    // the interface, that itself constitutes "expected" data being missing.
    if (isDataExpectedToBePresent && abstractKey != null && record != null) {
      const implementsInterface = this._implementsInterface(
        record,
        abstractKey,
      );
      if (implementsInterface === false) {
        // Type known to not implement the interface
        isDataExpectedToBePresent = false;
      }
    }

    this._isWithinUnmatchedTypeRefinement = !isDataExpectedToBePresent;
    let data = this._traverse(node, dataID, null);

    // If the fragment/operation was marked with @catch, we need to handle any
    // errors that were encountered while reading the fields within it.
    const catchTo = this._selector.node.metadata?.catchTo;
    if (catchTo != null) {
      data = this._catchErrors(data, catchTo, null) as $FlowFixMe;
    }

    const updatedDataIDs = this._updatedDataIDs;
    if (updatedDataIDs != null && updatedDataIDs.size > 0) {
      this._resolverCache.notifyUpdatedSubscribers(updatedDataIDs);
      this._updatedDataIDs = null;
    }

    if (RelayFeatureFlags.ENABLE_READER_FRAGMENTS_LOGGING) {
      this._log?.({
        name: 'reader.read',
        selector: this._selector,
      });
    }

    return {
      data,
      fieldErrors: this._fieldErrors,
      isMissingData: this._isMissingData && isDataExpectedToBePresent,
      missingClientEdges:
        this._missingClientEdges != null && this._missingClientEdges.length
          ? this._missingClientEdges
          : null,
      missingLiveResolverFields:
        this._missingLiveResolverFields ?? NO_MISSING_LIVE_RESOLVER_FIELDS,
      seenRecords: this._seenRecords,
      selector: this._selector,
    };
  }

  _maybeAddFieldErrors(record: Record, storageKey: string): void {
    const errors = RelayModernRecord.getErrors(record, storageKey);

    if (errors == null) {
      return;
    }
    const owner = this._fragmentName;

    if (this._fieldErrors == null) {
      this._fieldErrors = [];
    }
    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];
      this._fieldErrors.push({
        error,
        fieldPath: (error.path ?? []).join('.'),
        handled: false,
        kind: 'relay_field_payload.error',
        owner,
        shouldThrow: this._selector.node.metadata?.throwOnFieldError ?? false,
        // the uiContext is always undefined here.
        // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
        uiContext: undefined,
      });
    }
  }

  _markDataAsMissing(fieldName: string): void {
    if (this._isWithinUnmatchedTypeRefinement) {
      return;
    }
    if (this._fieldErrors == null) {
      this._fieldErrors = [];
    }

    // we will add the path later
    const owner = this._fragmentName;

    this._fieldErrors.push(
      (this._selector.node.metadata?.throwOnFieldError ?? false)
        ? {
            fieldPath: fieldName,
            handled: false,
            kind: 'missing_expected_data.throw',
            owner,
            // the uiContext is always undefined here.
            // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
            uiContext: undefined,
          }
        : {
            fieldPath: fieldName,
            kind: 'missing_expected_data.log',
            owner,
            // the uiContext is always undefined here.
            // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
            uiContext: undefined,
          },
    );

    this._isMissingData = true;

    // _parentClientEdge is null when not inside a fetchable client edge (e.g.
    // inside a client extension field); we never want to fetch in response to
    // missing data off of a client extension field.
    if (this._parentClientEdge !== null) {
      this._addMissingClientEdge({
        clientEdgeDestinationID: this._parentClientEdge.clientEdgeDestinationID,
        request: this._parentClientEdge.readerClientEdge.operation,
      });
    }
  }

  _traverse(
    node: ReaderNode,
    dataID: DataID,
    prevData: ?SelectorData,
  ): ?SelectorData {
    const record = this._recordSource.get(dataID);
    const prevFieldGranularDataID = this._fieldGranularNotificationDataID;
    // As in RelayModernStore's publish: with ENABLE_PERF_PUBLISH, the
    // field-granular marker is ignored while field-granular notifications are
    // off.
    if (
      (!RelayFeatureFlags.ENABLE_PERF_PUBLISH ||
        RelayFeatureFlags.ENABLE_FIELD_GRANULAR_NOTIFICATIONS) &&
      record != null &&
      RelayModernRecord.getValue(record, FIELD_GRANULAR_NOTIFICATIONS_KEY)
    ) {
      this._fieldGranularNotificationDataID = dataID;
    } else {
      this._seenRecords.add(dataID);
      this._fieldGranularNotificationDataID = null;
    }
    if (record == null) {
      if (record === undefined) {
        this._markDataAsMissing('<record>');
      }
      this._fieldGranularNotificationDataID = prevFieldGranularDataID;
      // $FlowFixMe[incompatible-type]
      return record;
    }
    const data = prevData || {};
    const hadRequiredData = this._traverseSelections(
      node.selections,
      record,
      data,
    );
    this._fieldGranularNotificationDataID = prevFieldGranularDataID;
    return hadRequiredData ? data : null;
  }

  _getVariableValue(name: string): unknown {
    invariant(
      this._variables.hasOwnProperty(name),
      'RelayReader(): Undefined variable `%s`.',
      name,
    );
    return this._variables[name];
  }

  _maybeReportUnexpectedNull(
    selection: ReaderRequiredField,
    fieldValue: null | void,
  ) {
    if (selection.action === 'NONE') {
      return;
    }
    const owner = this._fragmentName;

    if (this._fieldErrors == null) {
      this._fieldErrors = [];
    }

    let fieldName: string;
    if (selection.field.linkedField != null) {
      fieldName =
        selection.field.linkedField.alias ?? selection.field.linkedField.name;
    } else {
      fieldName = selection.field.alias ?? selection.field.name;
    }

    // When the field was null (not missing from the store), check whether the
    // server also attached a field error to it. _maybeAddFieldErrors runs in
    // the same call stack just before this method, so any companion error for
    // this field is always the last entry pushed to this._fieldErrors.
    let fieldError = null;
    if (fieldValue === null && this._fieldErrors.length > 0) {
      const lastError = this._fieldErrors[this._fieldErrors.length - 1];
      if (lastError.kind === 'relay_field_payload.error') {
        fieldError = lastError.error;
      }
    }

    switch (selection.action) {
      case 'THROW':
        this._fieldErrors.push({
          fieldError,
          fieldPath: fieldName,
          fieldValue,
          handled: false,
          kind: 'missing_required_field.throw',
          owner,
          // the uiContext is always undefined here.
          // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
          uiContext: undefined,
        });
        return;
      case 'LOG':
        this._fieldErrors.push({
          fieldError,
          fieldPath: fieldName,
          fieldValue,
          kind: 'missing_required_field.log',
          owner,
          // the uiContext is always undefined here.
          // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
          uiContext: undefined,
        });
        return;
      default:
        selection.action as empty;
    }
  }

  _handleRequiredFieldValue(
    selection: ReaderRequiredField,
    value: unknown,
  ): boolean /*should continue to siblings*/ {
    if (value == null) {
      this._maybeReportUnexpectedNull(selection, value);
      // We are going to throw, or our parent is going to get nulled out.
      // Either way, sibling values are going to be ignored, so we can
      // bail early here as an optimization.
      return false;
    }
    return true;
  }

  /**
   * Fields, aliased inline fragments, fragments and operations with `@catch`
   * directives must handle the case that errors were encountered while reading
   * any fields within them.
   *
   * 1. Before traversing into the selection(s) marked as `@catch`, the caller
   *   stores the previous field errors (`this._fieldErrors`) in a
   *   variable.
   * 2. After traversing into the selection(s) marked as `@catch`, the caller
   *   calls this method with the resulting value, the `to` value from the
   *   `@catch` directive, and the previous field errors.
   *
   * This method will then:
   *
   * 1. Compute the correct value to return based on any errors encountered and the supplied `to` type.
   * 2. Mark any errors encountered within the `@catch` as "handled" to ensure they don't cause the reader to throw.
   * 3. Merge any errors encountered within the `@catch` with the previous field errors.
   */
  _catchErrors<T>(
    _value: T,
    to: CatchFieldTo,
    previousResponseFields: ?FieldErrors,
  ): ?T | Result<T, unknown> {
    let value: T | null | Result<T, unknown> = _value;
    switch (to) {
      case 'RESULT':
        value = this._asResult(_value);
        break;
      case 'NULL':
        if (RelayFeatureFlags.ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS) {
          // Only null the field when there are errors not yet handled by an
          // inner @catch boundary.
          if (
            this._fieldErrors != null &&
            this._fieldErrors.some(e => !e.handled)
          ) {
            value = null;
          }
        } else if (this._fieldErrors != null && this._fieldErrors.length > 0) {
          value = null;
        }
        break;
      default:
        to as empty;
    }

    const childrenFieldErrors = this._fieldErrors;

    this._fieldErrors = previousResponseFields;

    // Merge any errors encountered within the @catch with the previous field
    // errors, but mark them as "handled" first.
    if (childrenFieldErrors != null) {
      if (this._fieldErrors == null) {
        this._fieldErrors = [];
      }
      for (let i = 0; i < childrenFieldErrors.length; i++) {
        // We mark any errors encountered within the @catch as "handled"
        // to ensure that they don't cause the reader to throw, but can
        // still be logged.
        this._fieldErrors.push(
          markFieldErrorHasHandled(childrenFieldErrors[i]),
        );
      }
    }
    return value;
  }

  /**
   * Convert a value into a Result object based on the presence of errors in the
   * `this._fieldErrors` array.
   *
   * **Note**: This method does _not_ mark errors as handled. It is the caller's
   * responsibility to ensure that errors are marked as handled.
   */
  _asResult<T>(value: T): Result<T, unknown> {
    // When ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS is off (the default), this
    // method behaves exactly as before: all entries in _fieldErrors, including
    // those already marked handled by an inner @catch, influence this boundary.
    // When the flag is on, already-handled errors are excluded so that an inner
    // @catch fully consumes its error without affecting outer boundaries.
    const fieldErrors =
      RelayFeatureFlags.ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS
        ? this._fieldErrors?.filter(e => !e.handled)
        : this._fieldErrors;
    if (fieldErrors == null || fieldErrors.length === 0) {
      return {ok: true, value};
    }

    // TODO: Should we be hiding log level events here?
    const errors = fieldErrors
      .map(error => {
        switch (error.kind) {
          case 'relay_field_payload.error':
            const {message, ...displayError} = error.error;
            return displayError;
          case 'missing_expected_data.throw':
          case 'missing_expected_data.log':
            return {
              path: error.fieldPath.split('.'),
            };
          case 'relay_resolver.error':
            return {
              message: `Relay: Error in resolver for field at ${error.fieldPath} in ${error.owner}`,
            };
          case 'missing_required_field.throw': {
            // If we have a nested @required(THROW) that will throw,
            // we want to catch that error and provide it
            let reason: string;
            if (error.fieldValue === null) {
              reason =
                error.fieldError != null
                  ? `the server returned null with an error: ${error.fieldError.message}`
                  : 'the server returned null';
            } else {
              reason =
                'the field was missing in the store (data may not have been fetched, or was removed by a graph relationship change: https://relay.dev/docs/next/debugging/why-null/#graph-relationship-change)';
            }
            return {
              message: `Relay: Missing @required value at path '${error.fieldPath}' in '${error.owner}': ${reason}.`,
            };
          }
          case 'missing_required_field.log':
            // For backwards compatibility, we don't surface log level missing required fields
            return null;
          default:
            error.kind as empty;
            invariant(
              false,
              'Unexpected error fieldError kind: %s',
              error.kind,
            );
        }
      })
      .filter(Boolean);

    return {errors, ok: false};
  }

  _traverseSelections(
    selections: ReadonlyArray<ReaderSelection>,
    record: Record,
    data: SelectorData,
  ): boolean /* had all expected data */ {
    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i];

      switch (selection.kind) {
        case 'RequiredField':
          const requiredFieldValue = this._readClientSideDirectiveField(
            selection,
            record,
            data,
          );
          if (!this._handleRequiredFieldValue(selection, requiredFieldValue)) {
            return false;
          }
          break;
        case 'CatchField': {
          const previousResponseFields = this._fieldErrors;

          this._fieldErrors = null;

          const catchFieldValue = this._readClientSideDirectiveField(
            selection,
            record,
            data,
          );

          const field = selection.field?.backingField ?? selection.field;
          const fieldName = field?.alias ?? field?.name;
          // ReaderClientExtension doesn't have `alias` or `name`
          // so we don't support this yet
          invariant(
            fieldName != null,
            "Couldn't determine field name for this field. It might be a ReaderClientExtension - which is not yet supported.",
          );

          data[fieldName] = this._catchErrors(
            catchFieldValue,
            selection.to,
            previousResponseFields,
          );

          break;
        }
        case 'ScalarField':
          this._readScalar(selection, record, data);
          break;
        case 'LinkedField':
          if (selection.plural) {
            this._readPluralLink(selection, record, data);
          } else {
            this._readLink(selection, record, data);
          }
          break;
        case 'Condition':
          const conditionValue = Boolean(
            this._getVariableValue(selection.condition),
          );
          if (conditionValue === selection.passingValue) {
            const hasExpectedData = this._traverseSelections(
              selection.selections,
              record,
              data,
            );
            if (!hasExpectedData) {
              return false;
            }
          }
          break;
        case 'InlineFragment': {
          const hasExpectedData = this._readInlineFragment(
            selection,
            record,
            data,
            false,
          );
          if (hasExpectedData === false) {
            // We are missing @required data, so we bubble up.
            return false;
          }
          break;
        }
        case 'RelayLiveResolver':
        case 'RelayResolver': {
          if (this._useExecTimeResolvers) {
            this._readScalar(selection, record, data);
          } else {
            this._readResolverField(selection, record, data);
          }
          break;
        }
        case 'FragmentSpread':
          this._createFragmentPointer(selection, record, data);
          break;
        case 'AliasedInlineFragmentSpread': {
          this._readAliasedInlineFragment(selection, record, data);
          break;
        }
        case 'ModuleImport':
          this._readModuleImport(selection, record, data);
          break;
        case 'InlineDataFragmentSpread':
          this._createInlineDataOrResolverFragmentPointer(
            selection,
            record,
            data,
          );
          break;
        case 'Defer':
        case 'ClientExtension': {
          const isMissingData = this._isMissingData;
          const alreadyMissingClientEdges =
            this._missingClientEdges?.length ?? 0;
          const prevParentClientEdge = this._parentClientEdge;
          this._parentClientEdge = null;
          const hasExpectedData = this._traverseSelections(
            selection.selections,
            record,
            data,
          );
          // The only case where we want to suspend due to missing data off of
          // a client extension is if we reached a client edge that we might be
          // able to fetch, or there is a missing data in one of the live resolvers.
          this._isMissingData =
            isMissingData ||
            (this._missingClientEdges?.length ?? 0) >
              alreadyMissingClientEdges ||
            (this._missingLiveResolverFields != null &&
              this._missingLiveResolverFields.length > 0);
          this._parentClientEdge = prevParentClientEdge;
          if (!hasExpectedData) {
            return false;
          }
          break;
        }
        case 'Stream': {
          const hasExpectedData = this._traverseSelections(
            selection.selections,
            record,
            data,
          );
          if (!hasExpectedData) {
            return false;
          }
          break;
        }
        case 'ActorChange':
          this._readActorChange(selection, record, data);
          break;
        case 'ClientEdgeToClientObject':
        case 'ClientEdgeToServerObject':
          if (
            this._useExecTimeResolvers &&
            (selection.backingField.kind === 'RelayResolver' ||
              selection.backingField.kind === 'RelayLiveResolver')
          ) {
            const {linkedField} = selection;
            if (linkedField.plural) {
              this._readPluralLink(linkedField, record, data);
            } else {
              this._readLink(linkedField, record, data);
            }
          } else {
            this._readClientEdge(selection, record, data);
          }
          break;
        default:
          selection as empty;
          invariant(
            false,
            'RelayReader(): Unexpected ast kind `%s`.',
            selection.kind,
          );
      }
    }
    return true;
  }

  _readClientSideDirectiveField(
    selection: ReaderRequiredField | ReaderCatchField,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    switch (selection.field.kind) {
      case 'ScalarField':
        return this._readScalar(selection.field, record, data);
      case 'LinkedField':
        if (selection.field.plural) {
          return this._readPluralLink(selection.field, record, data);
        } else {
          return this._readLink(selection.field, record, data);
        }

      case 'RelayResolver':
      case 'RelayLiveResolver': {
        if (this._useExecTimeResolvers) {
          return this._readScalar(selection.field, record, data);
        } else {
          return this._readResolverField(selection.field, record, data);
        }
      }
      case 'ClientEdgeToClientObject':
      case 'ClientEdgeToServerObject':
        if (
          this._useExecTimeResolvers &&
          (selection.field.backingField.kind === 'RelayResolver' ||
            selection.field.backingField.kind === 'RelayLiveResolver')
        ) {
          const {field} = selection;
          if (field.linkedField.plural) {
            return this._readPluralLink(field.linkedField, record, data);
          } else {
            return this._readLink(field.linkedField, record, data);
          }
        } else {
          return this._readClientEdge(selection.field, record, data);
        }
      case 'AliasedInlineFragmentSpread':
        return this._readAliasedInlineFragment(selection.field, record, data);
      default:
        selection.field.kind as empty;
        invariant(
          false,
          'RelayReader(): Unexpected ast kind `%s`.',
          selection.field.kind,
        );
    }
  }

  _readResolverField(
    field: ReaderRelayResolver | ReaderRelayLiveResolver,
    record: Record,
    data: SelectorData,
  ): unknown {
    const parentRecordID = RelayModernRecord.getDataID(record);
    const prevErrors = this._fieldErrors;
    this._fieldErrors = null;
    const result = this._readResolverFieldImpl(field, parentRecordID);

    const fieldName = field.alias ?? field.name;
    this._prependPreviousErrors(prevErrors, fieldName);
    data[fieldName] = result;
    return result;
  }

  _readResolverFieldImpl(
    field: ReaderRelayResolver | ReaderRelayLiveResolver,
    parentRecordID: DataID,
  ): unknown {
    const {fragment} = field;

    // Found when reading the resolver fragment, which can happen either when
    // evaluating the resolver and it calls readFragment, or when checking if the
    // inputs have changed since a previous evaluation:
    let snapshot: ?Snapshot;

    // The function `getDataForResolverFragment` serves two purposes:
    // 1. To memoize reads of the resolver's root fragment. This is important
    //    because we may read it twice. Once to check if the results have changed
    //    since last read, and once when we actually evaluate.
    // 2. To intercept the snapshot so that it can be cached by the resolver
    //    cache. This is what enables the change detection described in #1.
    //
    // Note: In the future this can be moved into the ResolverCache.
    const getDataForResolverFragment = (
      singularReaderSelector: SingularReaderSelector,
    ) => {
      if (snapshot != null) {
        // It was already read when checking for input staleness; no need to read it again.
        // Note that the variables like fragmentSeenRecordIDs in the outer closure will have
        // already been set and will still be used in this case.
        return {
          data: snapshot.data,
          fieldErrors: snapshot.fieldErrors,
          isMissingData: snapshot.isMissingData,
        };
      }

      snapshot = readPerf(
        this._recordSource,
        singularReaderSelector,
        // This reads data for a rootFragment in read time resolvers. There is no fragment
        // spread created for it so the existing fragment spread logger can't be used to log
        // unused rootFragments. Thus we skip passing the logger here for now.
        null,
        this._resolverCache,
        undefined,
      );

      return {
        data: snapshot.data,
        fieldErrors: snapshot.fieldErrors,
        isMissingData: snapshot.isMissingData,
      };
    };

    // This function `evaluate` tells the resolver cache how to read this
    // resolver. It returns an `EvaluationResult` which gives the resolver cache:
    // * `resolverResult` The value returned by the resolver function
    // * `snapshot` The snapshot returned when reading the resolver's root fragment (if it has one)
    // * `error` If the resolver throws, its error is caught (inside
    //   `getResolverValue`) and converted into an error object.
    const evaluate = (): EvaluationResult<unknown> => {
      if (fragment != null) {
        const key: SelectorData = {
          __fragmentOwner: this._owner,
          __fragments: {
            [fragment.name]: fragment.args
              ? getArgumentValues(fragment.args, this._variables)
              : {},
          },
          __id: parentRecordID,
        };
        if (this._parentClientEdge !== null) {
          key[PARENT_CLIENT_EDGE] = this._parentClientEdge;
        }
        const resolverContext = {getDataForResolverFragment};
        // $FlowFixMe[incompatible-type]
        return withResolverContext(resolverContext, () => {
          const [resolverResult, resolverError] = getResolverValue(
            field,
            this._variables,
            key,
            this._resolverContext,
          );
          return {error: resolverError, resolverResult, snapshot};
        });
      } else {
        const [resolverResult, resolverError] = getResolverValue(
          field,
          this._variables,
          null,
          this._resolverContext,
        );
        return {error: resolverError, resolverResult, snapshot: undefined};
      }
    };

    const [
      result,
      seenRecord,
      resolverError,
      cachedSnapshot,
      suspenseID,
      updatedDataIDs,
    ] = this._resolverCache.readFromCacheOrEvaluate(
      parentRecordID,
      field,
      this._variables,
      evaluate,
      getDataForResolverFragment,
    );

    this._propagateResolverMetadata(
      field.path,
      cachedSnapshot,
      resolverError,
      seenRecord,
      suspenseID,
      updatedDataIDs,
    );

    return result;
  }

  // Reading a resolver field can uncover missing data, errors, suspense,
  // additional seen records and updated dataIDs. All of these facts must be
  // represented in the snapshot we return for this fragment.
  _propagateResolverMetadata(
    fieldPath: string,
    cachedSnapshot: ?Snapshot,
    resolverError: ?Error,
    seenRecord: ?DataID,
    suspenseID: ?DataID,
    updatedDataIDs: ?DataIDSet,
  ) {
    // The resolver's root fragment (if there is one) may be missing data, have
    // errors, or be in a suspended state. Here we propagate those cases
    // upwards to mimic the behavior of having traversed into that fragment directly.
    if (cachedSnapshot != null) {
      if (cachedSnapshot.missingClientEdges != null) {
        for (let i = 0; i < cachedSnapshot.missingClientEdges.length; i++) {
          const missing = cachedSnapshot.missingClientEdges[i];
          this._addMissingClientEdge(missing);
        }
      }
      const missingLiveResolverFields =
        cachedSnapshot.missingLiveResolverFields;
      if (
        missingLiveResolverFields != null &&
        missingLiveResolverFields.length > 0
      ) {
        this._isMissingData = true;
        for (let i = 0; i < missingLiveResolverFields.length; i++) {
          this._addMissingLiveResolverField(missingLiveResolverFields[i]);
        }
      }
      if (cachedSnapshot.fieldErrors != null) {
        if (this._fieldErrors == null) {
          this._fieldErrors = [];
        }
        for (let i = 0; i < cachedSnapshot.fieldErrors.length; i++) {
          const error = cachedSnapshot.fieldErrors[i];
          if (this._selector.node.metadata?.throwOnFieldError === true) {
            // If this fragment is @throwOnFieldError, any destructive error
            // encountered inside a resolver's fragment is equivilent to the
            // resolver field having a field error, and we want that to cause this
            // fragment to throw. So, we propagate all errors as is.
            this._fieldErrors.push(error);
          } else {
            // If this fragment is _not_ @throwOnFieldError, we will simply
            // accept that any destructive errors encountered in the resolver's
            // root fragment will cause the resolver to return null, and well
            // pass the errors along to the logger marked as "handled".
            this._fieldErrors.push(markFieldErrorHasHandled(error));
          }
        }
      }
      this._isMissingData = this._isMissingData || cachedSnapshot.isMissingData;
    }

    // If the resolver errored, we track that as part of our traversal so that
    // the errors can be attached to this read's snapshot. This allows the error
    // to be logged.
    if (resolverError) {
      const errorEvent: FieldError = {
        error: resolverError,
        fieldPath,
        handled: false,
        kind: 'relay_resolver.error',
        owner: this._fragmentName,
        shouldThrow: this._selector.node.metadata?.throwOnFieldError ?? false,
        // the uiContext is always undefined here.
        // the loggingContext is provided by hooks - and assigned to uiContext in handlePotentialSnapshotErrors
        uiContext: undefined,
      };
      if (this._fieldErrors == null) {
        this._fieldErrors = [errorEvent];
      } else {
        this._fieldErrors.push(errorEvent);
      }
    }

    // The resolver itself creates a record in the store. We record that we've
    // read this record so that subscribers to this snapshot also subscribe to
    // this resolver.
    if (seenRecord != null) {
      this._seenRecords.add(seenRecord);
    }

    // If this resolver, or a dependency of this resolver, has suspended, we
    // need to report that in our snapshot. The `suspenseID` is the key in to
    // store where the suspended LiveState value lives. This ID allows readers
    // of the snapshot to subscribe to updates on that live resolver so that
    // they know when to unsuspend.
    if (suspenseID != null) {
      this._isMissingData = true;
      this._addMissingLiveResolverField(suspenseID);
    }
    if (updatedDataIDs != null) {
      let readerUpdatedDataIDs = this._updatedDataIDs;
      if (readerUpdatedDataIDs == null) {
        readerUpdatedDataIDs = new Set();
        this._updatedDataIDs = readerUpdatedDataIDs;
      }
      const target = readerUpdatedDataIDs;
      // Iterating a Set with for of is okay
      // eslint-disable-next-line relay-internal/no-for-of-loops
      updatedDataIDs.forEach(recordID => {
        target.add(recordID);
      });
    }
  }

  // Most reads have no missing client edges or resolver updates, so those
  // collections are only allocated when first needed.
  _addMissingLiveResolverField(id: DataID): void {
    if (this._missingLiveResolverFields == null) {
      this._missingLiveResolverFields = [id];
    } else {
      this._missingLiveResolverFields.push(id);
    }
  }

  _addMissingClientEdge(missing: MissingClientEdgeRequestInfo): void {
    if (this._missingClientEdges == null) {
      this._missingClientEdges = [missing];
    } else {
      this._missingClientEdges.push(missing);
    }
  }

  _readClientEdge(
    field: ReaderClientEdge,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const backingField = field.backingField;

    // Because ReaderClientExtension doesn't have `alias` or `name` and so I don't know
    // how to get its fieldName or storageKey yet:
    invariant(
      backingField.kind !== 'ClientExtension',
      'Client extension client edges are not yet implemented.',
    );

    const fieldName = backingField.alias ?? backingField.name;
    const backingFieldData = {};
    this._traverseSelections([backingField], record, backingFieldData);
    // At this point, backingFieldData is an object with a single key (fieldName)
    // whose value is the value returned from the resolver, or a suspense sentinel.

    // $FlowFixMe[invalid-computed-prop]
    const clientEdgeResolverResponse = backingFieldData[fieldName];
    if (
      clientEdgeResolverResponse == null ||
      isSuspenseSentinel(clientEdgeResolverResponse)
    ) {
      data[fieldName] = clientEdgeResolverResponse;
      return clientEdgeResolverResponse;
    }

    if (field.linkedField.plural) {
      invariant(
        Array.isArray(clientEdgeResolverResponse),
        'Expected plural Client Edge Relay Resolver at `%s` in `%s` to return an array containing IDs or objects with shape {id}.',
        backingField.path,
        this._owner.identifier,
      );
      invariant(
        field.kind === 'ClientEdgeToClientObject',
        'Unexpected Client Edge to plural server type `%s`. This should be prevented by the compiler.',
        field.kind,
      );
      let storeIDs: Array<?DataID>;
      let perItemEdges: ?Array<ClientEdgeTraversalInfo | null>;
      if (field.backingField.normalizationInfo == null) {
        // @edgeTo case: compute storeIDs and per-item traversal segments.
        // Server-type items get a segment so that missing data in their
        // sub-tree triggers a waterfall refetch; all other items get null.
        storeIDs = [];
        perItemEdges = [];
        for (let i = 0; i < clientEdgeResolverResponse.length; i++) {
          const itemResponse = clientEdgeResolverResponse[i];
          // A plural resolver (e.g. a plural magic fragment) may return a list
          // with nullish items — a nullable list element. Read those through as a
          // null edge rather than dereferencing `__typename` on a nullish value.
          if (itemResponse == null) {
            storeIDs.push(null);
            perItemEdges.push(null);
            continue;
          }
          const concreteType = field.concreteType ?? itemResponse.__typename;
          invariant(
            typeof concreteType === 'string',
            'Expected resolver for field at `%s` in `%s` modeling an edge to an abstract type to return an object with a `__typename` property.',
            backingField.path,
            this._owner.identifier,
          );
          const localId = extractIdFromResponse(
            itemResponse,
            backingField.path,
            this._owner.identifier,
          );
          const modelResolvers = field.modelResolvers;
          if (modelResolvers != null) {
            const modelResolver = modelResolvers[concreteType];
            if (modelResolver !== undefined) {
              // Model resolver type: namespace the ID and read the model.
              const id = this._resolverCache.ensureClientRecord(
                localId,
                concreteType,
              );
              const model = this._readResolverFieldImpl(modelResolver, id);
              storeIDs.push(model != null ? id : null);
              perItemEdges.push(null);
            } else {
              storeIDs.push(localId);

              // Server/CLient Schema Extension type: check for a refetch operation so that
              // missing data in this item's sub-tree triggers a waterfall.
              const serverOperation =
                field.serverObjectOperations?.[concreteType] ?? null;
              if (serverOperation != null) {
                perItemEdges.push({
                  clientEdgeDestinationID: localId,
                  readerClientEdge: {operation: serverOperation},
                });
              } else {
                perItemEdges.push(null);
              }
            }
          } else {
            // No model resolvers — concrete client object edge.
            storeIDs.push(
              this._resolverCache.ensureClientRecord(localId, concreteType),
            );
            perItemEdges.push(null);
          }
        }
      } else {
        // The normalization process in LiveResolverCache should take care of
        // generating the correct ID.
        // (The read-in-place inline arms (`ServerWeak`/`AbstractInline`) are
        // singular-only at the compiler, so this plural branch never carries a
        // resolver-returned `__id` pointer and keeps `extractIdFromResponse`
        // unchanged.)
        storeIDs = clientEdgeResolverResponse.map(obj =>
          extractIdFromResponse(obj, backingField.path, this._owner.identifier),
        );
        perItemEdges = null;
      }
      const prevParentClientEdge = this._parentClientEdge;
      this._parentClientEdge = null;
      const edgeValues = this._readLinkedIds(
        field.linkedField,
        storeIDs,
        record,
        data,
        perItemEdges,
      );
      this._parentClientEdge = prevParentClientEdge;
      data[fieldName] = edgeValues;
      return edgeValues;
    } else {
      // The resolver-returned `__id` store key is preferred ONLY for the
      // read-in-place inline arms (`ServerWeak`/`AbstractInline`), whose value
      // is normalized in place by the magic-fragment transplant and surfaced via
      // `__id`. Every other edge — `@edgeTo`/CSE server objects and the
      // `OutputType`/`WeakModel` inline arms — keeps `extractIdFromResponse`
      // exactly, so this change alters no existing client-edge store key.
      const inlineKind = backingField.normalizationInfo?.kind;
      const id =
        inlineKind === 'ServerWeak' || inlineKind === 'AbstractInline'
          ? extractStoreIDFromResponse(
              clientEdgeResolverResponse,
              backingField.path,
              this._owner.identifier,
            )
          : extractIdFromResponse(
              clientEdgeResolverResponse,
              backingField.path,
              this._owner.identifier,
            );
      let storeID: DataID;
      const concreteType =
        field.concreteType ?? clientEdgeResolverResponse.__typename;
      let traversalPathSegment: ClientEdgeTraversalInfo | null;
      if (field.kind === 'ClientEdgeToClientObject') {
        if (field.backingField.normalizationInfo == null) {
          invariant(
            typeof concreteType === 'string',
            'Expected resolver for field at `%s` in `%s` modeling an edge to an abstract type to return an object with a `__typename` property.',
            backingField.path,
            this._owner.identifier,
          );
          const modelResolvers = field.modelResolvers;
          if (modelResolvers != null) {
            const modelResolver = modelResolvers[concreteType];
            if (modelResolver !== undefined) {
              // Model resolver type: namespace the ID and read the model.
              storeID = this._resolverCache.ensureClientRecord(
                id,
                concreteType,
              );
              const model = this._readResolverFieldImpl(modelResolver, storeID);
              if (model == null) {
                // If the model resolver returns undefined, we should still
                // return null to match GQL behavior.
                data[fieldName] = null;
                return null;
              }
              traversalPathSegment = null;
            } else {
              // Server/CSE type: use the original ID directly. The data
              // lives in the store under the original ID, not a namespaced
              // client record.
              storeID = id;
              // Check if there is a refetch query for this server type.
              const serverObjectOperations = field.serverObjectOperations;
              const serverOp =
                serverObjectOperations != null
                  ? serverObjectOperations[concreteType]
                  : null;
              if (serverOp != null) {
                traversalPathSegment = {
                  clientEdgeDestinationID: id,
                  readerClientEdge: {operation: serverOp},
                };
              } else {
                traversalPathSegment = null;
              }
            }
          } else {
            // No model resolvers — concrete client object edge.
            // @edgeTo case where we need to ensure that the record has `id` field
            storeID = this._resolverCache.ensureClientRecord(id, concreteType);
            traversalPathSegment = null;
          }
        } else {
          // Inline arm. Shapes that share this branch:
          //  * `OutputType`/`WeakModel`: LiveResolverCache normalized the resolver
          //    value into a record under `id` (the resolver-returned id).
          //  * `ServerWeak` (shadow server-value): NO second
          //    normalization happened. `id` is the injected `__id` (the DataID of
          //    the transplanted `client:<parentid>:<field>` record), so `storeID`
          //    addresses the record the main operation already normalized in
          //    place. Mis-wiring this `__id` would silently read a wrong/empty
          //    record (a prod-silent miscompile), so in dev we assert the record
          //    exists before reading its selections.
          //  * `AbstractInline` (interface/union): dispatched per concrete
          //    `__typename` via `inlineKinds` — a `ServerWeak` member behaves like
          //    the scalar `ServerWeak` arm, a `WeakModel` member like `WeakModel`.
          storeID = id;
          const inlineNormalizationInfo = field.backingField.normalizationInfo;
          const effectiveKind =
            inlineNormalizationInfo?.kind === 'AbstractInline'
              ? inlineNormalizationInfo.inlineKinds[concreteType]
              : inlineNormalizationInfo?.kind;
          if (__DEV__ && effectiveKind === 'ServerWeak') {
            invariant(
              this._recordSource.get(storeID) != null,
              'RelayReader: Expected the in-place shadow record `%s` (read off ' +
                'the injected `__id` for field at `%s` in `%s`) to exist in the ' +
                'store. A missing record means the magic-fragment transplant did ' +
                'not normalize the shadowed server value at this DataID.',
              storeID,
              backingField.path,
              this._owner.identifier,
            );
          }
          traversalPathSegment = null;
        }
      } else {
        storeID = id;
        traversalPathSegment = {
          clientEdgeDestinationID: id,
          readerClientEdge: field,
        };
      }
      const prevParentClientEdge = this._parentClientEdge;
      this._parentClientEdge = traversalPathSegment;

      const prevData = data[fieldName];
      invariant(
        prevData == null || typeof prevData === 'object',
        'RelayReader(): Expected data for field at `%s` in `%s` on record `%s` ' +
          'to be an object, got `%s`.',
        backingField.path,
        this._owner.identifier,
        RelayModernRecord.getDataID(record),
        prevData,
      );
      const prevErrors = this._fieldErrors;
      this._fieldErrors = null;
      const edgeValue = this._traverse(
        field.linkedField,
        storeID,
        // $FlowFixMe[incompatible-variance]
        prevData,
      );
      this._prependPreviousErrors(prevErrors, fieldName);
      this._parentClientEdge = prevParentClientEdge;
      data[fieldName] = edgeValue;
      return edgeValue;
    }
  }

  _readScalar(
    field: ReaderScalarField | ReaderRelayResolver | ReaderRelayLiveResolver,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;
    // A scalar field without arguments is stored under its name. A resolver
    // field may not be (getStorageKey adds its root fragment's arguments), and
    // every field with arguments calls getStorageKey too, also when they are
    // all literals (it returns the static `storageKey` first): if only rarer
    // fields made the call, V8 could optimize this method before the call had
    // run, and the first such field would then deoptimize the reader.
    const storageKey =
      field.args == null && field.kind === 'ScalarField'
        ? field.name
        : getStorageKey(field, this._variables);
    if (this._fieldGranularNotificationDataID != null) {
      this._seenRecords.add(
        getFieldNotificationKey(
          this._fieldGranularNotificationDataID,
          storageKey,
        ),
      );
    }
    const value = RelayModernRecord.getValue(record, storageKey);
    if (
      value === null ||
      (RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS &&
        Array.isArray(value) &&
        value.length === 0)
    ) {
      this._maybeAddFieldErrors(record, storageKey);
    } else if (value === undefined) {
      this._markDataAsMissing(fieldName);
    }
    data[fieldName] = value;
    return value;
  }

  _readLink(
    field: ReaderLinkedField,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;
    // See _readScalar.
    const storageKey =
      field.args == null ? field.name : getStorageKey(field, this._variables);
    if (this._fieldGranularNotificationDataID != null) {
      this._seenRecords.add(
        getFieldNotificationKey(
          this._fieldGranularNotificationDataID,
          storageKey,
        ),
      );
    }
    const linkedID = RelayModernRecord.getLinkedRecordID(record, storageKey);
    if (linkedID == null) {
      data[fieldName] = linkedID;
      if (linkedID === null) {
        this._maybeAddFieldErrors(record, storageKey);
      } else if (linkedID === undefined) {
        this._markDataAsMissing(fieldName);
      }
      return linkedID;
    }

    const prevData = data[fieldName];
    invariant(
      prevData == null || typeof prevData === 'object',
      'RelayReader(): Expected data for field `%s` at `%s` on record `%s` ' +
        'to be an object, got `%s`.',
      fieldName,
      this._owner.identifier,
      RelayModernRecord.getDataID(record),
      prevData,
    );
    const prevErrors = this._fieldErrors;
    this._fieldErrors = null;
    // $FlowFixMe[incompatible-variance]
    const value = this._traverse(field, linkedID, prevData);

    this._prependPreviousErrors(prevErrors, fieldName);
    data[fieldName] = value;
    return value;
  }

  /**
   * Adds a set of field errors to `this._fieldErrors`, ensuring the
   * `fieldPath` property of existing field errors are prefixed with the given
   * `fieldNameOrIndex`.
   *
   * In order to make field errors maximally useful in logs/errors, we want to
   * include the path to the field that caused the error. A naive approach would
   * be to maintain a path property on RelayReader which we push/pop field names
   * to as we traverse into fields/etc. However, this would be expensive to
   * maintain, and in the common case where there are no field errors, the work
   * would go unused.
   *
   * Instead, we take a lazy approach where as we exit the recurison into a
   * field/etc we prepend any errors encountered while traversing that field
   * with the field name. This is somewhat more expensive in the error case, but
   * ~free in the common case where there are no errors.
   *
   * To achieve this, named field readers must do the following to correctly
   * track error filePaths:
   *
   * 1. Stash the value of `this._fieldErrors` in a local variable
   * 2. Set `this._fieldErrors` to `null`
   * 3. Traverse into the field
   * 4. Call this method with the stashed errors and the field's name
   *
   * Similarly, when creating field errors, we simply initialize the `fieldPath`
   * as the direct field name.
   *
   * Today we only use this apporach for `missing_expected_data` and
   * `missing_required_field` errors, but we intend to broaden it to handle all
   * field error paths.
   */
  _prependPreviousErrors(
    prevErrors: ?Array<FieldError>,
    fieldNameOrIndex: string | number,
  ): void {
    if (this._fieldErrors != null) {
      for (let i = 0; i < this._fieldErrors.length; i++) {
        const event = this._fieldErrors[i];
        if (
          event.owner === this._fragmentName &&
          (event.kind === 'missing_expected_data.throw' ||
            event.kind === 'missing_expected_data.log' ||
            event.kind === 'missing_required_field.throw' ||
            event.kind === 'missing_required_field.log')
        ) {
          event.fieldPath = `${fieldNameOrIndex}.${event.fieldPath}`;
        }
      }
      if (prevErrors != null) {
        for (let i = this._fieldErrors.length - 1; i >= 0; i--) {
          prevErrors.push(this._fieldErrors[i]);
        }
        this._fieldErrors = prevErrors;
      }
    } else {
      this._fieldErrors = prevErrors;
    }
  }

  _readActorChange(
    field: ReaderActorChange,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;
    const storageKey = getStorageKey(field, this._variables);
    const externalRef = RelayModernRecord.getActorLinkedRecordID(
      record,
      storageKey,
    );

    if (externalRef == null) {
      data[fieldName] = externalRef;
      if (externalRef === undefined) {
        this._markDataAsMissing(fieldName);
      } else if (externalRef === null) {
        this._maybeAddFieldErrors(record, storageKey);
      }
      return data[fieldName];
    }
    const [actorIdentifier, dataID] = externalRef;

    const fragmentRef = {};
    this._createFragmentPointer(
      field.fragmentSpread,
      RelayModernRecord.fromObject<>({
        __id: dataID,
      }),
      fragmentRef,
    );
    data[fieldName] = {
      __fragmentRef: fragmentRef,
      __viewer: actorIdentifier,
    };
    return data[fieldName];
  }

  _readPluralLink(
    field: ReaderLinkedField,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    // See _readScalar.
    const storageKey =
      field.args == null ? field.name : getStorageKey(field, this._variables);
    if (this._fieldGranularNotificationDataID != null) {
      this._seenRecords.add(
        getFieldNotificationKey(
          this._fieldGranularNotificationDataID,
          storageKey,
        ),
      );
    }
    const linkedIDs = RelayModernRecord.getLinkedRecordIDs(record, storageKey);
    if (
      linkedIDs === null ||
      (RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS &&
        Array.isArray(linkedIDs) &&
        linkedIDs.length === 0)
    ) {
      this._maybeAddFieldErrors(record, storageKey);
    }
    return this._readLinkedIds(field, linkedIDs, record, data);
  }

  _readLinkedIds(
    field: ReaderLinkedField,
    linkedIDs: ?ReadonlyArray<?DataID>,
    record: Record,
    data: SelectorData,
    perItemEdges?: ?ReadonlyArray<ClientEdgeTraversalInfo | null>,
  ): ?unknown {
    const fieldName = field.alias ?? field.name;

    if (linkedIDs == null) {
      data[fieldName] = linkedIDs;
      if (linkedIDs === undefined) {
        this._markDataAsMissing(fieldName);
      }
      return linkedIDs;
    }

    const prevData = data[fieldName];
    invariant(
      prevData == null || Array.isArray(prevData),
      'RelayReader(): Expected data for field `%s` on record `%s` ' +
        'to be an array, got `%s`.',
      fieldName,
      RelayModernRecord.getDataID(record),
      prevData,
    );
    const prevErrors = this._fieldErrors;
    this._fieldErrors = null;
    const linkedArray = prevData || [];
    linkedIDs.forEach((linkedID, nextIndex) => {
      if (linkedID == null) {
        if (linkedID === undefined) {
          this._markDataAsMissing(String(nextIndex));
        }
        // $FlowFixMe[cannot-write]
        linkedArray[nextIndex] = linkedID;
        return;
      }
      const prevItem = linkedArray[nextIndex];
      invariant(
        prevItem == null || typeof prevItem === 'object',
        'RelayReader(): Expected data for field `%s` on record `%s` ' +
          'to be an object, got `%s`.',
        fieldName,
        RelayModernRecord.getDataID(record),
        prevItem,
      );
      const prevErrors = this._fieldErrors;
      this._fieldErrors = null;
      const prevParentClientEdge = this._parentClientEdge;
      if (perItemEdges != null) {
        this._parentClientEdge = perItemEdges[nextIndex] ?? null;
      }
      // $FlowFixMe[cannot-write]
      // $FlowFixMe[incompatible-variance]
      linkedArray[nextIndex] = this._traverse(field, linkedID, prevItem);
      this._parentClientEdge = prevParentClientEdge;
      this._prependPreviousErrors(prevErrors, nextIndex);
    });
    this._prependPreviousErrors(prevErrors, fieldName);
    data[fieldName] = linkedArray;
    return linkedArray;
  }

  /**
   * Reads a ReaderModuleImport, which was generated from using the @module
   * directive.
   */
  _readModuleImport(
    moduleImport: ReaderModuleImport,
    record: Record,
    data: SelectorData,
  ): void {
    // Determine the component module from the store: if the field is missing
    // it means we don't know what component to render the match with.
    const componentKey = getModuleComponentKey(moduleImport.documentName);
    const relayStoreComponent = RelayModernRecord.getValue(
      record,
      componentKey,
    );
    // componentModuleProvider is used by Client 3D for read time resolvers.
    const component =
      relayStoreComponent !== undefined
        ? relayStoreComponent
        : moduleImport.componentModuleProvider;
    if (component == null) {
      if (component === undefined) {
        this._markDataAsMissing('<module-import>');
      }
      return;
    }

    // Otherwise, read the fragment and module associated to the concrete
    // type, and put that data with the result:
    // - For the matched fragment, create the relevant fragment pointer and add
    //   the expected fragmentPropName
    // - For the matched module, create a reference to the module
    this._createFragmentPointer(
      {
        args: moduleImport.args,
        kind: 'FragmentSpread',
        name: moduleImport.fragmentName,
      },
      record,
      data,
    );
    data[FRAGMENT_PROP_NAME_KEY] = moduleImport.fragmentPropName;
    data[MODULE_COMPONENT_KEY] = component;
  }

  /**
   * Aliased inline fragments allow the user to check if the data in an inline
   * fragment was fetched. Data in the inline fragment can be conditional in the
   * case of a type condition on the inline fragment or directives like `@skip`
   * or `@include`.
   *
   * We model aliased inline fragments as a special reader node wrapped around a
   * regular inline fragment reader node.
   *
   * This allows us to read the inline fragment as normal, check if it matched,
   * and then define the alias to either contain the inline fragment's data, or
   * null.
   */
  _readAliasedInlineFragment(
    aliasedInlineFragment: ReaderAliasedInlineFragmentSpread,
    record: Record,
    data: SelectorData,
  ): ?unknown {
    const prevErrors = this._fieldErrors;
    this._fieldErrors = null;
    let fieldValue = this._readInlineFragment(
      aliasedInlineFragment.fragment,
      record,
      {},
      true,
    );
    this._prependPreviousErrors(prevErrors, aliasedInlineFragment.name);
    if (fieldValue === false) {
      fieldValue = null;
    }
    data[aliasedInlineFragment.name] = fieldValue;
    return fieldValue;
  }

  // Has three possible return values:
  // * null: The type condition did not match
  // * undefined: We are missing data
  // * false: The selection contained missing @required fields
  // * data: The successfully populated SelectorData object
  //
  // The `skipUnmatchedAbstractTypes` flag is used to signal if we should skip
  // reading the contents of an inline fragment on an abstract type if we _know_
  // the type condition does not match.
  _readInlineFragment(
    inlineFragment: ReaderInlineFragment,
    record: Record,
    data: SelectorData,
    skipUnmatchedAbstractTypes: boolean,
  ): ?(SelectorData | false) {
    if (inlineFragment.type == null) {
      // Inline fragment without a type condition: always read data
      // Usually this would get compiled away, but fragments with @alias
      // and no type condition will get preserved.
      const hasExpectedData = this._traverseSelections(
        inlineFragment.selections,
        record,
        data,
      );
      if (hasExpectedData === false) {
        return false;
      }
      return data;
    }
    const {abstractKey} = inlineFragment;
    if (abstractKey == null) {
      // concrete type refinement: only read data if the type exactly matches
      if (!this._recordMatchesTypeCondition(record, inlineFragment.type)) {
        // This selection does not match the fragment spread. Do nothing.
        return null;
      } else {
        const hasExpectedData = this._traverseSelections(
          inlineFragment.selections,
          record,
          data,
        );
        if (!hasExpectedData) {
          // Bubble up null due to a missing @required field
          return false;
        }
      }
    } else {
      const implementsInterface = this._implementsInterface(
        record,
        abstractKey,
      );

      if (implementsInterface === false && skipUnmatchedAbstractTypes) {
        return null;
      }

      // store flags to reset after reading
      const parentIsMissingData = this._isMissingData;
      const parentIsWithinUnmatchedTypeRefinement =
        this._isWithinUnmatchedTypeRefinement;

      this._isWithinUnmatchedTypeRefinement =
        parentIsWithinUnmatchedTypeRefinement || implementsInterface === false;

      // @required is allowed within inline fragments on abstract types if they
      // have @alias. So we must bubble up null if we have a missing @required
      // field.
      const hasMissingData = this._traverseSelections(
        inlineFragment.selections,
        record,
        data,
      );

      // Reset
      this._isWithinUnmatchedTypeRefinement =
        parentIsWithinUnmatchedTypeRefinement;

      if (implementsInterface === false) {
        // Type known to not implement the interface, no data expected
        this._isMissingData = parentIsMissingData;
        return null;
      } else if (implementsInterface == null) {
        // Don't know if the type implements the interface or not
        return undefined;
      } else if (hasMissingData === false) {
        // Bubble up null due to a missing @required field
        return false;
      }
    }
    return data;
  }

  _recordMatchesTypeCondition(record: Record, type: string): boolean {
    const typeName = RelayModernRecord.getType(record);
    return (
      (typeName != null && typeName === type) ||
      // The root record type is a special `__Root` type and may not match the
      // type on the ast, so ignore type mismatches at the root.  We currently
      // detect whether we're at the root by checking against ROOT_ID, but this
      // does not work for mutations/subscriptions which generate unique root
      // ids. This is acceptable in practice as we don't read data for
      // mutations/subscriptions in a situation where we would use
      // isMissingData to decide whether to suspend or not.
      // TODO T96653810: Correctly detect reading from root of mutation/subscription
      RelayModernRecord.getDataID(record) === ROOT_ID
    );
  }

  _createFragmentPointer(
    fragmentSpread: ReaderFragmentSpread,
    record: Record,
    data: SelectorData,
  ): void {
    let fragmentPointers = data[FRAGMENTS_KEY];
    if (fragmentPointers == null) {
      fragmentPointers = data[FRAGMENTS_KEY] = {} as {
        [key: string]: Arguments,
      };
    }
    invariant(
      typeof fragmentPointers === 'object' && fragmentPointers != null,
      'RelayReader: Expected fragment spread data to be an object, got `%s`.',
      fragmentPointers,
    );

    if (data[ID_KEY] == null) {
      data[ID_KEY] = RelayModernRecord.getDataID(record);
    }
    const args =
      fragmentSpread.args == null
        ? this._isWithinUnmatchedTypeRefinement
          ? NO_FRAGMENT_ARGUMENTS_WITHIN_UNMATCHED_TYPE_REFINEMENT
          : NO_FRAGMENT_ARGUMENTS
        : getArgumentValues(
            fragmentSpread.args,
            this._variables,
            this._isWithinUnmatchedTypeRefinement,
          );
    // $FlowFixMe[cannot-write] - writing into read-only field
    fragmentPointers[fragmentSpread.name] = args;
    data[FRAGMENT_OWNER_KEY] = this._owner;

    if (this._parentClientEdge !== null) {
      data[PARENT_CLIENT_EDGE] = this._parentClientEdge;
    }

    if (RelayFeatureFlags.ENABLE_READER_FRAGMENTS_LOGGING) {
      this._log?.({
        name: 'reader.fragmentSpread',
        fragmentName: fragmentSpread.name,
        data,
      });
    }
  }

  _createInlineDataOrResolverFragmentPointer(
    fragmentSpreadOrFragment: ReaderInlineDataFragmentSpread | ReaderFragment,
    record: Record,
    data: SelectorData,
  ): void {
    let fragmentPointers = data[FRAGMENTS_KEY];
    if (fragmentPointers == null) {
      fragmentPointers = data[FRAGMENTS_KEY] = {} as {[key: string]: {...}};
    }
    invariant(
      typeof fragmentPointers === 'object' && fragmentPointers != null,
      'RelayReader: Expected fragment spread data to be an object, got `%s`.',
      fragmentPointers,
    );
    if (data[ID_KEY] == null) {
      data[ID_KEY] = RelayModernRecord.getDataID(record);
    }
    const inlineData = {};
    const parentFragmentName = this._fragmentName;
    this._fragmentName = fragmentSpreadOrFragment.name;

    const parentVariables = this._variables;

    // If the inline fragment spread has arguments, we need to temporarily
    // switch this._variables to include the fragment spread's arguments
    // for the duration of its traversal.
    const argumentVariables = fragmentSpreadOrFragment.args
      ? getArgumentValues(fragmentSpreadOrFragment.args, this._variables)
      : {};

    this._variables = RelayConcreteVariables.getFragmentVariables(
      fragmentSpreadOrFragment,
      this._owner.variables,
      argumentVariables,
    );

    this._traverseSelections(
      fragmentSpreadOrFragment.selections,
      record,
      inlineData,
    );

    // Put the parent variables back
    this._variables = parentVariables;

    this._fragmentName = parentFragmentName;
    // $FlowFixMe[cannot-write] - writing into read-only field
    fragmentPointers[fragmentSpreadOrFragment.name] = inlineData;
  }

  _implementsInterface(record: Record, abstractKey: string): ?boolean {
    const typeName = RelayModernRecord.getType(record);
    const typeRecord = this._recordSource.get(generateTypeID(typeName));
    const implementsInterface =
      typeRecord != null
        ? RelayModernRecord.getValue(typeRecord, abstractKey)
        : null;

    if (implementsInterface == null) {
      // The compiler lists every implementor of a client abstract type in the
      // operation's `clientAbstractTypes`, so a listed type implements it even
      // when no type record answers: `check()` writes none for an operation
      // not written since `invalidateStore()`, and GC collects it once no
      // retained operation references it. An unlisted type stays unknown,
      // because nothing guarantees the owner was compiled with this fragment.
      if (
        this._owner.node.operation.clientAbstractTypes?.[abstractKey]?.includes(
          typeName,
        ) === true
      ) {
        return true;
      }
      // In some cases, like a graph relationship change, we might have never
      // fetched the `__is[AbstractType]` flag for this concrete type. In this
      // case we need to report that we are missing data, in case that field is
      // still in flight.
      this._markDataAsMissing('<abstract-type-hint>');
    }
    // $FlowFixMe[incompatible-type] Casting record value
    return implementsInterface;
  }
}

function readPerf(
  recordSource: RecordSource,
  selector: SingularReaderSelector,
  log: ?LogFunction,
  resolverCache?: ResolverCache,
  resolverContext?: ResolverContext,
): Snapshot {
  const reader = new RelayReaderOptimized(
    recordSource,
    selector,
    log,
    resolverCache ?? new NoopResolverCache(),
    resolverContext,
  );
  return reader.read();
}

module.exports = {read, readPerf};
