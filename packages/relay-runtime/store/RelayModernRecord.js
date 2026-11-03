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
import type {DataID} from '../util/RelayRuntimeTypes';
import type {TRelayFieldError} from './RelayErrorTrie';

const deepFreeze = require('../util/deepFreeze');
const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const {generateClientObjectClientID, isClientID} = require('./ClientID');
const {
  isSuspenseSentinel,
} = require('./live-resolvers/LiveResolverSuspenseSentinel');
const {
  ACTOR_IDENTIFIER_KEY,
  ERRORS_KEY,
  ID_KEY,
  INVALIDATED_AT_KEY,
  REF_KEY,
  REFS_KEY,
  RELAY_RESOLVER_VALUE_KEY,
  ROOT_ID,
  TYPENAME_KEY,
} = require('./RelayStoreUtils');
const areEqual = require('areEqual');
const invariant = require('invariant');
const warning = require('warning');

export type StorageKey = Exclude<string, typeof ERRORS_KEY>;

type RelayFieldErrors = {[StorageKey]: ReadonlyArray<TRelayFieldError>};

export type RecordJSON = {
  /**
   * We cannot replace __errors with typeof ERRORS_KEY because Flow does
   * not support types with multiple indexers.
   */
  __errors?: RelayFieldErrors,
  [StorageKey]: unknown,
  ...
};

/*
 * An individual cached graph object.
 */
export opaque type Record = RecordJSON;

/**
 * @public
 *
 * Low-level record manipulation methods.
 *
 * A note about perf: we use long-hand property access rather than computed
 * properties in this file for speed ie.
 *
 *    const object = {};
 *    object[KEY] = value;
 *    record[storageKey] = object;
 *
 * instead of:
 *
 *    record[storageKey] = {
 *      [KEY]: value,
 *    };
 *
 * The latter gets transformed by Babel into something like:
 *
 *    function _defineProperty(obj, key, value) {
 *      if (key in obj) {
 *        Object.defineProperty(obj, key, {
 *          value: value,
 *          enumerable: true,
 *          configurable: true,
 *          writable: true,
 *        });
 *      } else {
 *        obj[key] = value;
 *      }
 *      return obj;
 *    }
 *
 *    record[storageKey] = _defineProperty({}, KEY, value);
 *
 * A quick benchmark shows that computed property access is an order of
 * magnitude slower (times in seconds for 100,000 iterations):
 *
 *               best     avg     sd
 *    computed 0.02175 0.02292 0.00113
 *      manual 0.00110 0.00123 0.00008
 */

/**
 * @public
 *
 * Clone a record.
 */
function clone(record: Record): Record {
  return {
    ...record,
  };
}

/**
 * @public
 *
 * Copies all fields from `source` to `sink`, excluding `__id` and `__typename`.
 *
 * NOTE: This function does not treat `id` specially. To preserve the id,
 * manually reset it after calling this function. Also note that values are
 * copied by reference and not value; callers should ensure that values are
 * copied on write.
 */
function copyFields(source: Record, sink: Record): void {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (key !== ID_KEY && key !== TYPENAME_KEY) {
        sink[key] = source[key];
      }
    }
  }
}

/**
 * @public
 *
 * Create a new record.
 */
function create(dataID: DataID, typeName: string): Record {
  // See perf note above for why we aren't using computed property access.
  const record: Record = {};
  record[ID_KEY] = dataID;
  record[TYPENAME_KEY] = typeName;
  return record;
}

/**
 * @public
 *
 * Convert the JSON representation of a record into a record.
 */
function fromObject<TMaybe extends ?empty = empty>(
  json: RecordJSON | TMaybe,
): Record | TMaybe {
  return json;
}

/**
 * @public
 *
 * Get the record's `id` if available or the client-generated identifier.
 */
function getDataID(record: Record): DataID {
  return record[ID_KEY] as any;
}

/**
 * @public
 *
 * Get the fields of a record.
 */
function getFields(record: Record): Array<StorageKey> {
  if (ERRORS_KEY in record) {
    return Object.keys(record).filter(field => field !== ERRORS_KEY);
  }
  return Object.keys(record);
}

/**
 * @public
 *
 * Get the concrete type of the record.
 */
function getType(record: Record): string {
  return record[TYPENAME_KEY] as any;
}

/**
 * @public
 *
 * Get the errors associated with particular field.
 */
function getErrors(
  record: Record,
  storageKey: StorageKey,
): ReadonlyArray<TRelayFieldError> | void {
  return record[ERRORS_KEY]?.[storageKey];
}

/**
 * @public
 *
 * Get a scalar (non-link) field value.
 */
function getValue(record: Record, storageKey: StorageKey): unknown {
  const value = record[storageKey];
  if (value && typeof value === 'object') {
    invariant(
      !value.hasOwnProperty(REF_KEY) && !value.hasOwnProperty(REFS_KEY),
      'RelayModernRecord.getValue(): Expected a scalar (non-link) value for `%s.%s` ' +
        'but found %s.',
      record[ID_KEY],
      storageKey,
      value.hasOwnProperty(REF_KEY)
        ? 'a linked record'
        : 'plural linked records',
    );
  }
  return value;
}

/**
 * @public
 *
 * Check if a record has a value for the given field.
 */
function hasValue(record: Record, storageKey: StorageKey): boolean {
  return storageKey in record;
}

/**
 * @public
 *
 * Get the value of a field as a reference to another record. Throws if the
 * field has a different type.
 */
function getLinkedRecordID(record: Record, storageKey: StorageKey): ?DataID {
  const maybeLink = record[storageKey];
  if (maybeLink == null) {
    return maybeLink;
  }
  // We reassign here so that the JSON.stringify call in invariant does not invalidate the
  // non-maybe refinement from above.
  const link = maybeLink;
  invariant(
    typeof link === 'object' && link && typeof link[REF_KEY] === 'string',
    'RelayModernRecord.getLinkedRecordID(): Expected `%s.%s` to be a linked ID, ' +
      'was `%s`.%s',
    record[ID_KEY],
    storageKey,
    JSON.stringify(link),
    typeof link === 'object' && link[REFS_KEY] !== undefined
      ? ' It appears to be a plural linked record: did you mean to call ' +
          'getLinkedRecords() instead of getLinkedRecord()?'
      : '',
  );
  // $FlowFixMe[incompatible-type]
  return link[REF_KEY];
}

/**
 * @public
 *
 * Checks if a field has a reference to another record.
 */
function hasLinkedRecordID(record: Record, storageKey: StorageKey): boolean {
  const maybeLink = record[storageKey];
  if (maybeLink == null) {
    return false;
  }
  const link = maybeLink;
  return typeof link === 'object' && link && typeof link[REF_KEY] === 'string';
}

/**
 * @public
 *
 * Get the value of a field as a list of references to other records. Throws if
 * the field has a different type.
 */
function getLinkedRecordIDs(
  record: Record,
  storageKey: StorageKey,
): ?Array<?DataID> {
  const links = record[storageKey];
  if (links == null) {
    return links;
  }
  invariant(
    typeof links === 'object' && Array.isArray(links[REFS_KEY]),
    'RelayModernRecord.getLinkedRecordIDs(): Expected `%s.%s` to contain an array ' +
      'of linked IDs, got `%s`.%s',
    record[ID_KEY],
    storageKey,
    JSON.stringify(links),
    typeof links === 'object' && links[REF_KEY] !== undefined
      ? ' It appears to be a singular linked record: did you mean to call ' +
          'getLinkedRecord() instead of getLinkedRecords()?'
      : '',
  );
  // assume items of the array are ids
  return links[REFS_KEY] as any;
}

/**
 * @public
 *
 * Checks if a field have references to other records.
 */
function hasLinkedRecordIDs(record: Record, storageKey: StorageKey): boolean {
  const links = record[storageKey];
  if (links == null) {
    return false;
  }
  return (
    typeof links === 'object' &&
    Array.isArray(links[REFS_KEY]) &&
    links[REFS_KEY].every(link => typeof link === 'string')
  );
}

/**
 * @public
 *
 * Returns the epoch at which the record was invalidated, if it
 * ever was; otherwise returns null;
 */
function getInvalidationEpoch(record: ?Record): ?number {
  if (record == null) {
    return null;
  }

  const invalidatedAt = record[INVALIDATED_AT_KEY];
  if (typeof invalidatedAt !== 'number') {
    // If the record has never been invalidated, it isn't stale.
    return null;
  }
  return invalidatedAt;
}

/**
 * @public
 *
 * Compares the fields of a previous and new record, returning either the
 * previous record if all fields are equal or a new record (with merged fields)
 * if any fields have changed.
 */
function update(prevRecord: Record, nextRecord: Record): Record {
  if (RelayFeatureFlags.ENABLE_PERF_PUBLISH) {
    return updatePerf(prevRecord, nextRecord);
  }
  if (__DEV__) {
    const prevID = getDataID(prevRecord);
    const nextID = getDataID(nextRecord);
    warning(
      prevID === nextID,
      'RelayModernRecord: Invalid record update, expected both versions of ' +
        'the record to have the same id, got `%s` and `%s`.',
      prevID,
      nextID,
    );
    // note: coalesce null/undefined to null
    const prevType = getType(prevRecord) ?? null;
    const nextType = getType(nextRecord) ?? null;
    warning(
      (isClientID(nextID) && nextID !== ROOT_ID) || prevType === nextType,
      'RelayModernRecord: Invalid record update, expected both versions of ' +
        'record `%s` to have the same `%s` but got conflicting types `%s` ' +
        'and `%s`. The GraphQL server likely violated the globally unique ' +
        'id requirement by returning the same id for different objects.',
      prevID,
      TYPENAME_KEY,
      prevType,
      nextType,
    );
  }
  const prevErrorsByKey = prevRecord[ERRORS_KEY];
  const nextErrorsByKey = nextRecord[ERRORS_KEY];
  let updated: Record | null = null;
  if (prevErrorsByKey == null && nextErrorsByKey == null) {
    for (const storageKey in nextRecord) {
      if (
        updated ||
        !areEqual(prevRecord[storageKey], nextRecord[storageKey])
      ) {
        updated = updated !== null ? updated : {...prevRecord};
        updated[storageKey] = nextRecord[storageKey];
      }
    }
    return updated ?? prevRecord;
  }
  for (const storageKey in nextRecord) {
    if (storageKey === ERRORS_KEY) {
      continue;
    }
    const nextValue = nextRecord[storageKey];
    const nextErrors = nextErrorsByKey?.[storageKey];
    if (updated == null) {
      const prevValue = prevRecord[storageKey];
      const prevErrors = prevErrorsByKey?.[storageKey];
      if (areEqual(prevValue, nextValue) && areEqual(prevErrors, nextErrors)) {
        continue;
      }
      updated = {...prevRecord};
      if (prevErrorsByKey != null) {
        // Make a copy of prevErrorsByKey so that our changes don't affect prevRecord
        updated[ERRORS_KEY] = {...prevErrorsByKey};
      }
    }
    setValue(updated, storageKey, nextValue);
    setErrors(updated, storageKey, nextErrors);
  }
  return updated ?? prevRecord;
}

/**
 * @public
 *
 * Returns a new record with the contents of the given records. Fields in the
 * second record will overwrite identical fields in the first record.
 */
function merge(record1: Record, record2: Record): Record {
  if (__DEV__) {
    const prevID = getDataID(record1);
    const nextID = getDataID(record2);
    warning(
      prevID === nextID,
      'RelayModernRecord: Invalid record merge, expected both versions of ' +
        'the record to have the same id, got `%s` and `%s`.',
      prevID,
      nextID,
    );
    // note: coalesce null/undefined to null
    const prevType = getType(record1) ?? null;
    const nextType = getType(record2) ?? null;
    warning(
      (isClientID(nextID) && nextID !== ROOT_ID) || prevType === nextType,
      'RelayModernRecord: Invalid record merge, expected both versions of ' +
        'record `%s` to have the same `%s` but got conflicting types `%s` ' +
        'and `%s`. The GraphQL server likely violated the globally unique ' +
        'id requirement by returning the same id for different objects.',
      prevID,
      TYPENAME_KEY,
      prevType,
      nextType,
    );
  }
  if (ERRORS_KEY in record1 || ERRORS_KEY in record2) {
    const {[ERRORS_KEY]: errors1, ...fields1} = record1;
    const {[ERRORS_KEY]: errors2, ...fields2} = record2;
    // $FlowFixMe[cannot-spread-indexer]
    const updated: Record = {...fields1, ...fields2};
    if (errors1 == null && errors2 == null) {
      return updated;
    }
    const updatedErrors: RelayFieldErrors = {};
    for (const storageKey in errors1) {
      if (fields2.hasOwnProperty(storageKey)) {
        continue;
      }
      updatedErrors[storageKey] = errors1[storageKey];
    }
    for (const storageKey in errors2) {
      updatedErrors[storageKey] = errors2[storageKey];
    }
    for (const _storageKey in updatedErrors) {
      // We only need to add updatedErrors to updated if there was one or more error
      updated[ERRORS_KEY] = updatedErrors;
      break;
    }
    return updated;
  } else {
    // $FlowFixMe[cannot-spread-indexer]
    return {...record1, ...record2};
  }
}

/**
 * @public
 *
 * Prevent modifications to the record. Attempts to call `set*` functions on a
 * frozen record will fatal at runtime.
 */
function freeze(record: Record): void {
  deepFreeze(record);
}

/**
 * @public
 *
 * Set the errors associated with a particular field.
 */
function setErrors(
  record: Record,
  storageKey: StorageKey,
  errors?: ReadonlyArray<TRelayFieldError>,
): void {
  if (__DEV__) {
    warning(
      storageKey in record,
      'RelayModernRecord: Invalid error update, `%s` should not be undefined.',
      storageKey,
    );
  }
  const errorsByStorageKey = record[ERRORS_KEY];
  if (errors != null && errors.length > 0) {
    if (errorsByStorageKey == null) {
      record[ERRORS_KEY] = {[storageKey]: errors};
    } else {
      errorsByStorageKey[storageKey] = errors;
    }
  } else if (errorsByStorageKey != null) {
    if (delete errorsByStorageKey[storageKey]) {
      for (const otherStorageKey in errorsByStorageKey) {
        if (errorsByStorageKey.hasOwnProperty(otherStorageKey)) {
          // That wasn't the last error, so we shouldn't remove the error map
          return;
        }
      }
      // That was the last error, so we should remove the error map
      delete record[ERRORS_KEY];
    }
  }
}

/**
 * @public
 *
 * Set the value of a storageKey to a scalar.
 */
function setValue(
  record: Record,
  storageKey: StorageKey,
  value: unknown,
): void {
  if (__DEV__) {
    const prevID = getDataID(record);
    if (storageKey === ID_KEY) {
      warning(
        prevID === value,
        'RelayModernRecord: Invalid field update, expected both versions of ' +
          'the record to have the same id, got `%s` and `%s`.',
        prevID,
        value,
      );
    } else if (storageKey === TYPENAME_KEY) {
      // note: coalesce null/undefined to null
      const prevType = getType(record) ?? null;
      const nextType = value ?? null;
      warning(
        (isClientID(getDataID(record)) && getDataID(record) !== ROOT_ID) ||
          prevType === nextType,
        'RelayModernRecord: Invalid field update, expected both versions of ' +
          'record `%s` to have the same `%s` but got conflicting types `%s` ' +
          'and `%s`. The GraphQL server likely violated the globally unique ' +
          'id requirement by returning the same id for different objects.',
        prevID,
        TYPENAME_KEY,
        prevType,
        nextType,
      );
    }
  }
  record[storageKey] = value;
}

/**
 * @public
 *
 * Set the value of a field to a reference to another record.
 */
function setLinkedRecordID(
  record: Record,
  storageKey: StorageKey,
  linkedID: DataID,
): void {
  // See perf note above for why we aren't using computed property access.
  const link: {[string]: DataID} = {};
  link[REF_KEY] = linkedID;
  record[storageKey] = link;
}

/**
 * @public
 *
 * Set the value of a field to a list of references other records.
 */
function setLinkedRecordIDs(
  record: Record,
  storageKey: StorageKey,
  linkedIDs: Array<?DataID>,
): void {
  // See perf note above for why we aren't using computed property access.
  const links: {[string]: Array<?DataID>} = {};
  links[REFS_KEY] = linkedIDs;
  record[storageKey] = links;
}

/**
 * @public
 *
 * Set the value of a field to a reference to another record in the actor specific store.
 */
function setActorLinkedRecordID(
  record: Record,
  storageKey: StorageKey,
  actorIdentifier: ActorIdentifier,
  linkedID: DataID,
): void {
  // See perf note above for why we aren't using computed property access.
  const link: {[string]: ActorIdentifier | DataID} = {};
  link[REF_KEY] = linkedID;
  link[ACTOR_IDENTIFIER_KEY] = actorIdentifier;
  record[storageKey] = link;
}

/**
 * @public
 *
 * Get link to a record and the actor identifier for the store.
 */
function getActorLinkedRecordID(
  record: Record,
  storageKey: StorageKey,
): ?[ActorIdentifier, DataID] {
  const link = record[storageKey];
  if (link == null) {
    return link;
  }
  invariant(
    typeof link === 'object' &&
      typeof link[REF_KEY] === 'string' &&
      link[ACTOR_IDENTIFIER_KEY] != null,
    'RelayModernRecord.getActorLinkedRecordID(): Expected `%s.%s` to be an actor specific linked ID, ' +
      'was `%s`.',
    record[ID_KEY],
    storageKey,
    JSON.stringify(link),
  );

  return [link[ACTOR_IDENTIFIER_KEY] as any, link[REF_KEY] as any];
}

function getResolverLinkedRecordID(record: Record, typeName: string): ?DataID {
  let id = getValue(record, RELAY_RESOLVER_VALUE_KEY);
  if (id == null || isSuspenseSentinel(id)) {
    return null;
  }
  // TODD: Deprecate client edges that return just id.
  if (typeof id === 'object') {
    id = id.id;
  }
  invariant(
    typeof id === 'string',
    'RelayModernRecord.getResolverLinkedRecordID(): Expected value to be a linked ID, ' +
      'was `%s`.',
    JSON.stringify(id),
  );
  return generateClientObjectClientID(typeName, id);
}

function getResolverLinkedRecordIDs(
  record: Record,
  typeName: string,
): ?Array<?DataID> {
  const resolverValue = getValue(record, RELAY_RESOLVER_VALUE_KEY);
  if (resolverValue == null || isSuspenseSentinel(resolverValue)) {
    return null;
  }
  invariant(
    Array.isArray(resolverValue),
    'RelayModernRecord.getResolverLinkedRecordIDs(): Expected value to be an array of linked IDs, ' +
      'was `%s`.',
    JSON.stringify(resolverValue),
  );
  return resolverValue.map(id => {
    if (id == null) {
      return null;
    }
    // TODD: Deprecate client edges that return just id.
    if (typeof id === 'object') {
      id = id.id;
    }
    invariant(
      typeof id === 'string',
      'RelayModernRecord.getResolverLinkedRecordIDs(): Expected item within resolver linked field to be a DataID, ' +
        'was `%s`.',
      JSON.stringify(id),
    );
    return generateClientObjectClientID(typeName, id);
  });
}

/**
 * @public
 *
 * Returns true if the value of a field differs between two records.
 * Unlike getValue(), this works for all field types (scalar, linked, plural linked).
 */
function hasFieldChanged(
  prevRecord: Record,
  nextRecord: Record,
  storageKey: StorageKey,
): boolean {
  if (RelayFeatureFlags.ENABLE_PERF_PUBLISH) {
    return hasFieldChangedPerf(prevRecord, nextRecord, storageKey);
  }
  if (!areEqual(prevRecord[storageKey], nextRecord[storageKey])) {
    return true;
  }
  const prevErrors = prevRecord[ERRORS_KEY]?.[storageKey];
  const nextErrors = nextRecord[ERRORS_KEY]?.[storageKey];
  return !areEqual(prevErrors, nextErrors);
}

/**
 * @public
 *
 * Convert a record to JSON.
 */
function toJSON<TMaybe extends ?empty = empty>(
  record: Record | TMaybe,
): RecordJSON | TMaybe {
  return record;
}

// ----------------------------------------------------------------------
// Optimized variants (`*Perf`) of the functions above.
// Used only when ENABLE_PERF_PUBLISH is on; with it off the code above runs
// unchanged.

// Same result as `areEqual`, without its bookkeeping for the common case: most
// record fields hold scalars, which are equal only when identical (`areEqual`
// treats +0 and -0 as different). Only two objects need the deep comparison.
function areFieldValuesEqual(prevValue: unknown, nextValue: unknown): boolean {
  if (prevValue === nextValue) {
    return (
      typeof prevValue !== 'number' ||
      prevValue !== 0 ||
      Object.is(prevValue, nextValue)
    );
  }
  if (
    prevValue == null ||
    nextValue == null ||
    typeof prevValue !== 'object' ||
    typeof nextValue !== 'object'
  ) {
    return false;
  }
  // Same result as areEqual() for the links setLinkedRecordID(s) write,
  // `{[REF_KEY]: id}` and `{[REFS_KEY]: ids}`, without its generic deep walk.
  const prevID = prevValue[REF_KEY];
  if (typeof prevID === 'string') {
    if (nextValue[REF_KEY] !== prevID) {
      return false;
    }
    if (hasOnlyKey(prevValue, REF_KEY) && hasOnlyKey(nextValue, REF_KEY)) {
      return true;
    }
  } else {
    const prevIDs = prevValue[REFS_KEY];
    const nextIDs = nextValue[REFS_KEY];
    if (
      Array.isArray(prevIDs) &&
      Array.isArray(nextIDs) &&
      hasOnlyKey(prevValue, REFS_KEY) &&
      hasOnlyKey(nextValue, REFS_KEY)
    ) {
      return areLinkedIDsEqual(prevIDs, nextIDs);
    }
  }
  return areEqual(prevValue, nextValue);
}

// Whether `object`'s only enumerable property is `key`.
function hasOnlyKey(
  object: {readonly [string]: unknown},
  key: string,
): boolean {
  for (const k in object) {
    if (k !== key) {
      return false;
    }
  }
  return true;
}

function areLinkedIDsEqual(
  prevIDs: ReadonlyArray<unknown>,
  nextIDs: ReadonlyArray<unknown>,
): boolean {
  if (prevIDs === nextIDs) {
    return true;
  }
  if (prevIDs.length !== nextIDs.length) {
    return false;
  }
  // From the end, as areEqual() compares arrays: a list that only changed at
  // its end is told apart at once.
  for (let ii = prevIDs.length - 1; ii >= 0; ii--) {
    const prevID = prevIDs[ii];
    const nextID = nextIDs[ii];
    if (prevID !== nextID) {
      // IDs are strings or null; compare anything else like areEqual().
      return (
        typeof prevID === 'object' &&
        typeof nextID === 'object' &&
        areEqual(prevIDs, nextIDs)
      );
    }
  }
  return true;
}

/**
 * @public
 *
 * Compares the fields of a previous and new record, returning either the
 * previous record if all fields are equal or a new record (with merged fields)
 * if any fields have changed.
 */
function updatePerf(prevRecord: Record, nextRecord: Record): Record {
  if (__DEV__) {
    const prevID = getDataID(prevRecord);
    const nextID = getDataID(nextRecord);
    warning(
      prevID === nextID,
      'RelayModernRecord: Invalid record update, expected both versions of ' +
        'the record to have the same id, got `%s` and `%s`.',
      prevID,
      nextID,
    );
    // note: coalesce null/undefined to null
    const prevType = getType(prevRecord) ?? null;
    const nextType = getType(nextRecord) ?? null;
    warning(
      (isClientID(nextID) && nextID !== ROOT_ID) || prevType === nextType,
      'RelayModernRecord: Invalid record update, expected both versions of ' +
        'record `%s` to have the same `%s` but got conflicting types `%s` ' +
        'and `%s`. The GraphQL server likely violated the globally unique ' +
        'id requirement by returning the same id for different objects.',
      prevID,
      TYPENAME_KEY,
      prevType,
      nextType,
    );
  }
  const prevErrorsByKey = prevRecord[ERRORS_KEY];
  const nextErrorsByKey = nextRecord[ERRORS_KEY];
  let updated: Record | null = null;
  if (prevErrorsByKey == null && nextErrorsByKey == null) {
    for (const storageKey in nextRecord) {
      if (
        updated ||
        !areFieldValuesEqual(prevRecord[storageKey], nextRecord[storageKey])
      ) {
        updated = updated !== null ? updated : {...prevRecord};
        updated[storageKey] = nextRecord[storageKey];
      }
    }
    return updated ?? prevRecord;
  }
  for (const storageKey in nextRecord) {
    if (storageKey === ERRORS_KEY) {
      continue;
    }
    const nextValue = nextRecord[storageKey];
    const nextErrors = nextErrorsByKey?.[storageKey];
    if (updated == null) {
      const prevValue = prevRecord[storageKey];
      const prevErrors = prevErrorsByKey?.[storageKey];
      if (
        areFieldValuesEqual(prevValue, nextValue) &&
        areFieldValuesEqual(prevErrors, nextErrors)
      ) {
        continue;
      }
      updated = {...prevRecord};
      if (prevErrorsByKey != null) {
        // Make a copy of prevErrorsByKey so that our changes don't affect prevRecord
        updated[ERRORS_KEY] = {...prevErrorsByKey};
      }
    }
    setValue(updated, storageKey, nextValue);
    setErrors(updated, storageKey, nextErrors);
  }
  return updated ?? prevRecord;
}

/**
 * @public
 *
 * Returns true if the value of a field differs between two records.
 * Unlike getValue(), this works for all field types (scalar, linked, plural linked).
 */
function hasFieldChangedPerf(
  prevRecord: Record,
  nextRecord: Record,
  storageKey: StorageKey,
): boolean {
  if (!areFieldValuesEqual(prevRecord[storageKey], nextRecord[storageKey])) {
    return true;
  }
  const prevErrors = prevRecord[ERRORS_KEY]?.[storageKey];
  const nextErrors = nextRecord[ERRORS_KEY]?.[storageKey];
  return !areFieldValuesEqual(prevErrors, nextErrors);
}

module.exports = {
  clone,
  copyFields,
  create,
  freeze,
  fromObject,
  getActorLinkedRecordID,
  getDataID,
  getErrors,
  getFields,
  getInvalidationEpoch,
  getLinkedRecordID,
  getLinkedRecordIDs,
  getResolverLinkedRecordID,
  getResolverLinkedRecordIDs,
  getType,
  getValue,
  hasFieldChanged,
  hasLinkedRecordID,
  hasLinkedRecordIDs,
  hasValue,
  merge,
  setActorLinkedRecordID,
  setErrors,
  setLinkedRecordID,
  setLinkedRecordIDs,
  setValue,
  toJSON,
  update,
};
