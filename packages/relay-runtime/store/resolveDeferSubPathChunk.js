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

import type {GraphQLResponseWithData} from '../network/RelayNetworkTypes';
import type {
  NormalizationLinkedField,
  NormalizationSelectableNode,
  NormalizationSelection,
} from '../util/NormalizationNode';
import type {DataID, Variables} from '../util/RelayRuntimeTypes';
import type {
  DeferPlaceholder,
  NormalizationSelector,
  Record,
  RecordSource,
} from './RelayStoreTypes';

import RelayModernRecord from './RelayModernRecord';
import {createNormalizationSelector} from './RelayModernSelector';
import {getStorageKey} from './RelayStoreUtils';

export type RecoveredDeferPayload = {
  readonly selector: NormalizationSelector,
  readonly typeName: string,
  readonly response: GraphQLResponseWithData,
  readonly existingRootRecord: ?Record,
};

/**
 * Recover the effective selector + response for a deferred chunk that
 * landed at a `subPath` beyond its placeholder's registration path.
 * Returns null when the addressed location can't be resolved in the store.
 */
function resolveDeferSubPathChunk(
  placeholder: DeferPlaceholder,
  response: GraphQLResponseWithData,
  subPath: ReadonlyArray<unknown>,
  storeSource: RecordSource,
): ?RecoveredDeferPayload {
  return subPath.some(key => typeof key === 'number')
    ? recoverAtChildRecord(placeholder, response, subPath, storeSource)
    : recoverAtParentRecord(placeholder, response, subPath, storeSource);
}

function recoverAtParentRecord(
  placeholder: DeferPlaceholder,
  response: GraphQLResponseWithData,
  subPath: ReadonlyArray<unknown>,
  storeSource: RecordSource,
): RecoveredDeferPayload {
  return {
    selector: placeholder.selector,
    typeName: placeholder.typeName,
    response: {...response, data: wrapUnderSubPath(subPath, response.data)},
    existingRootRecord: storeSource.get(placeholder.selector.dataID),
  };
}

function recoverAtChildRecord(
  placeholder: DeferPlaceholder,
  response: GraphQLResponseWithData,
  subPath: ReadonlyArray<unknown>,
  storeSource: RecordSource,
): ?RecoveredDeferPayload {
  const walk = walkSubPathToLinkedField(
    placeholder.selector.node,
    subPath,
    storeSource,
    placeholder.selector.dataID,
    placeholder.selector.variables,
  );
  if (walk == null) return null;
  const {dataID, field} = walk;
  const {concreteType} = field;
  if (concreteType == null) return null;
  return {
    selector: createNormalizationSelector(
      field,
      dataID,
      placeholder.selector.variables,
    ),
    typeName: concreteType,
    response,
    existingRootRecord: storeSource.get(dataID),
  };
}

/**
 * Fold string subPath keys back into `data`:
 * `wrapUnderSubPath(['address'], {city}) → {address: {city}}`.
 */
function wrapUnderSubPath(
  subPath: ReadonlyArray<unknown>,
  data: unknown,
): {[string]: unknown} {
  let wrapped: {[string]: unknown} = {
    [String(subPath[subPath.length - 1])]: data,
  };
  for (let i = subPath.length - 2; i >= 0; i--) {
    wrapped = {[String(subPath[i])]: wrapped};
  }
  return wrapped;
}

type WalkState = {
  readonly field: ?NormalizationLinkedField,
  readonly selections: ReadonlyArray<NormalizationSelection>,
  readonly dataID: DataID,
  readonly pendingIDs: ?ReadonlyArray<?DataID>,
};

/**
 * Walk the fragment's normalization AST alongside the store, following each
 * `subPath` key (string = LinkedField name, number = index into the previous
 * plural link), to find the target LinkedField and its item dataID.
 */
function walkSubPathToLinkedField(
  node: NormalizationSelectableNode,
  subPath: ReadonlyArray<unknown>,
  storeSource: RecordSource,
  rootDataID: DataID,
  variables: Variables,
): ?{dataID: DataID, field: NormalizationLinkedField} {
  let state: WalkState = {
    field: null,
    selections: node.selections,
    dataID: rootDataID,
    pendingIDs: null,
  };
  for (const key of subPath) {
    const next =
      typeof key === 'string'
        ? stepIntoField(state, key, storeSource, variables)
        : typeof key === 'number'
          ? stepIntoIndex(state, key)
          : null;
    if (next == null) return null;
    state = next;
  }
  return state.field != null
    ? {dataID: state.dataID, field: state.field}
    : null;
}

function stepIntoField(
  state: WalkState,
  name: string,
  storeSource: RecordSource,
  variables: Variables,
): ?WalkState {
  const field = findLinkedField(state.selections, name);
  if (field == null) return null;
  const record = storeSource.get(state.dataID);
  if (record == null) return null;
  const storageKey = getStorageKey(field, variables);
  if (field.plural === true) {
    const pendingIDs = RelayModernRecord.getLinkedRecordIDs(record, storageKey);
    if (pendingIDs == null) return null;
    return {field, selections: field.selections, dataID: state.dataID, pendingIDs};
  }
  const linked = RelayModernRecord.getLinkedRecordID(record, storageKey);
  if (linked == null) return null;
  return {field, selections: field.selections, dataID: linked, pendingIDs: null};
}

function stepIntoIndex(state: WalkState, index: number): ?WalkState {
  if (state.pendingIDs == null) return null;
  const itemID = state.pendingIDs[index];
  if (itemID == null) return null;
  return {...state, dataID: itemID, pendingIDs: null};
}

function findLinkedField(
  selections: ReadonlyArray<NormalizationSelection>,
  responseKey: string,
): ?NormalizationLinkedField {
  for (const selection of selections) {
    if (
      selection.kind === 'LinkedField' &&
      (selection.alias ?? selection.name) === responseKey
    ) {
      return selection;
    }
  }
  return null;
}

module.exports = resolveDeferSubPathChunk;
