/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {ActorIdentifier} from '../multi-actor-environment/ActorIdentifier';
import type {DataID} from '../util/RelayRuntimeTypes';
import type {Record, TRelayFieldError} from './RelayStoreTypes';

type RelayFieldErrors = {
  [storageKey: string]: ReadonlyArray<TRelayFieldError>;
};

export type LinkedRecordListShape = Array<
  number | LinkedRecordListShape | null | undefined
>;

export type RecordJSON = {
  __errors?: RelayFieldErrors;
  [storageKey: string]: unknown;
};

/**
 * Clone a record.
 */
export function clone(record: Record): Record;

/**
 * Copies all fields from `source` to `sink`, excluding `__id` and `__typename`.
 *
 * NOTE: This function does not treat `id` specially. To preserve the id,
 * manually reset it after calling this function. Also note that values are
 * copied by reference and not value; callers should ensure that values are
 * copied on write.
 */
export function copyFields(source: Record, sink: Record): void;

/**
 * Create a new record.
 */
export function create(dataID: DataID, typeName: string): Record;

/**
 * Convert the JSON representation of a record into a record.
 */
export function fromObject<TJSON extends RecordJSON | null | undefined>(
  json: TJSON,
): TJSON extends RecordJSON ? Record : TJSON;

/**
 * Get the record's `id` if available or the client-generated identifier.
 */
export function getDataID(record: Record): DataID;

/**
 * Get the fields of a record.
 */
export function getFields(record: Record): string[];

/**
 * Get the concrete type of the record.
 */
export function getType(record: Record): string;

/**
 * Get the errors associated with particular field.
 */
export function getErrors(
  record: Record,
  storageKey: string,
): ReadonlyArray<TRelayFieldError> | undefined;

/**
 * Get a scalar (non-link) field value.
 */
export function getValue(record: Record, storageKey: string): unknown;

/**
 * Check if a record has a value for the given field.
 */
export function hasValue(record: Record, storageKey: string): boolean;

/**
 * Get the value of a field as a reference to another record. Throws if the
 * field has a different type.
 */
export function getLinkedRecordID(
  record: Record,
  storageKey: string,
): DataID | null | undefined;

/**
 * Checks if a field has a reference to another record.
 */
export function hasLinkedRecordID(record: Record, storageKey: string): boolean;

/**
 * Get the value of a field as a list of references to other records. Throws if
 * the field has a different type.
 */
export function getLinkedRecordIDs(
  record: Record,
  storageKey: string,
): Array<DataID | null | undefined> | null | undefined;

export function getLinkedRecordListShape(
  record: Record,
  storageKey: string,
): LinkedRecordListShape | null | undefined;

/**
 * Checks if a field have references to other records.
 */
export function hasLinkedRecordIDs(record: Record, storageKey: string): boolean;

/**
 * Returns the epoch at which the record was invalidated, if it
 * ever was; otherwise returns null;
 */
export function getInvalidationEpoch(
  record: Record | null | undefined,
): number | null;

/**
 * Compares the fields of a previous and new record, returning either the
 * previous record if all fields are equal or a new record (with merged fields)
 * if any fields have changed.
 */
export function update(prevRecord: Record, nextRecord: Record): Record;

/**
 * Returns a new record with the contents of the given records. Fields in the
 * second record will overwrite identical fields in the first record.
 */
export function merge(record1: Record, record2: Record): Record;

/**
 * Prevent modifications to the record. Attempts to call `set*` functions on a
 * frozen record will fatal at runtime.
 */
export function freeze(record: Record): void;

/**
 * Set the errors associated with a particular field.
 */
export function setErrors(
  record: Record,
  storageKey: string,
  errors?: ReadonlyArray<TRelayFieldError>,
): void;

/**
 * Set the value of a storageKey to a scalar.
 */
export function setValue(
  record: Record,
  storageKey: string,
  value: unknown,
): void;

/**
 * Set the value of a field to a reference to another record.
 */
export function setLinkedRecordID(
  record: Record,
  storageKey: string,
  linkedID: DataID,
): void;

/**
 * Set the value of a field to a list of references other records.
 */
export function setLinkedRecordIDs(
  record: Record,
  storageKey: string,
  linkedIDs: Array<DataID | null | undefined>,
  listShape?: LinkedRecordListShape,
): void;

/**
 * Set the value of a field to a reference to another record in the actor specific store.
 */
export function setActorLinkedRecordID(
  record: Record,
  storageKey: string,
  actorIdentifier: ActorIdentifier,
  linkedID: DataID,
): void;

/**
 * Get link to a record and the actor identifier for the store.
 */
export function getActorLinkedRecordID(
  record: Record,
  storageKey: string,
): [ActorIdentifier, DataID] | null | undefined;

/**
 * Returns true if the value of a field differs between two records.
 * Unlike getValue(), this works for all field types (scalar, linked, plural linked).
 */
export function hasFieldChanged(
  prevRecord: Record,
  nextRecord: Record,
  storageKey: string,
): boolean;

/**
 * Convert a record to JSON.
 */
export function toJSON<TRecord extends Record | null | undefined>(
  record: TRecord,
): TRecord extends Record ? RecordJSON : TRecord;
