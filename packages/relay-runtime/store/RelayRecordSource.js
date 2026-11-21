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

import type {DataID} from '../util/RelayRuntimeTypes';
import type {RecordState} from './RelayRecordState';
import type {
  MutableRecordSource,
  Record,
  RecordSourceJSON,
} from './RelayStoreTypes';

const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const RelayModernRecord = require('./RelayModernRecord');
const RelayRecordState = require('./RelayRecordState');
const {RELAY_RESOLVER_RECORD_TYPENAME} = require('./RelayStoreUtils');

const {EXISTENT, NONEXISTENT, UNKNOWN} = RelayRecordState;

/**
 * An implementation of the `MutableRecordSource` interface (defined in
 * `RelayStoreTypes`) that holds all records in memory (JS Map).
 */
class RelayRecordSource implements MutableRecordSource {
  _records: Map<DataID, ?Record>;

  constructor(records?: RecordSourceJSON) {
    this._records = new Map();
    if (records != null) {
      Object.keys(records).forEach(key => {
        const object = records[key];
        const record = RelayModernRecord.fromObject<null | undefined>(object);
        this._records.set(key, record);
      });
    }
  }

  static create(records?: RecordSourceJSON): MutableRecordSource {
    return new RelayRecordSource(records);
  }

  clear(): void {
    this._records = new Map();
  }

  delete(dataID: DataID): void {
    this._records.set(dataID, null);
  }

  get(dataID: DataID): ?Record {
    return this._records.get(dataID);
  }

  getRecordIDs(): Array<DataID> {
    return Array.from(this._records.keys());
  }

  getStatus(dataID: DataID): RecordState {
    if (!this._records.has(dataID)) {
      return UNKNOWN;
    }
    return this._records.get(dataID) == null ? NONEXISTENT : EXISTENT;
  }

  has(dataID: DataID): boolean {
    return this._records.has(dataID);
  }

  remove(dataID: DataID): void {
    this._records.delete(dataID);
  }

  set(dataID: DataID, record: Record): void {
    this._records.set(dataID, record);
  }

  size(): number {
    return this._records.size;
  }

  toJSON(): RecordSourceJSON {
    const obj: {...RecordSourceJSON} = {};
    for (const [key, record] of this._records) {
      // Filter out any Relay Resolver records
      if (
        RelayFeatureFlags.FILTER_OUT_RELAY_RESOLVER_RECORDS &&
        record != null &&
        RelayModernRecord.getType(record) === RELAY_RESOLVER_RECORD_TYPENAME
      ) {
        continue;
      }
      obj[key] = RelayModernRecord.toJSON<null | undefined>(record);
    }
    return obj;
  }
}

module.exports = RelayRecordSource;
