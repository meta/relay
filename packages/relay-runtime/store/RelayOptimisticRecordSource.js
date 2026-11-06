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
import type {RecordJSON} from './RelayModernRecord';
import type {RecordState} from './RelayRecordState';
import type {
  MutableRecordSource,
  Record,
  RecordSource,
} from './RelayStoreTypes';

const RelayModernRecord = require('./RelayModernRecord');
const RelayRecordSource = require('./RelayRecordSource');
const invariant = require('invariant');

const UNPUBLISH_RECORD_SENTINEL = RelayModernRecord.fromObject(
  // $FlowFixMe[incompatible-type] frozen objects are readonly
  Object.freeze({
    __UNPUBLISH_RECORD_SENTINEL: true,
  }),
);

/**
 * An implementation of MutableRecordSource that represents a base RecordSource
 * with optimistic updates stacked on top: records with optimistic updates
 * shadow the base version of the record rather than updating/replacing them.
 */
class RelayOptimisticRecordSource implements MutableRecordSource {
  _base: RecordSource;
  _sink: MutableRecordSource;

  constructor(base: RecordSource): void {
    this._base = base;
    this._sink = RelayRecordSource.create();
  }

  has(dataID: DataID): boolean {
    if (this._sink.has(dataID)) {
      const sinkRecord = this._sink.get(dataID);
      return sinkRecord !== UNPUBLISH_RECORD_SENTINEL;
    } else {
      return this._base.has(dataID);
    }
  }

  get(dataID: DataID): ?Record {
    if (this._sink.has(dataID)) {
      const sinkRecord = this._sink.get(dataID);
      if (sinkRecord === UNPUBLISH_RECORD_SENTINEL) {
        return undefined;
      } else {
        return sinkRecord;
      }
    } else {
      return this._base.get(dataID);
    }
  }

  getStatus(dataID: DataID): RecordState {
    const record = this.get(dataID);
    if (record === undefined) {
      return 'UNKNOWN';
    } else if (record === null) {
      return 'NONEXISTENT';
    } else {
      return 'EXISTENT';
    }
  }

  clear(): void {
    this._base = RelayRecordSource.create();
    this._sink.clear();
  }

  delete(dataID: DataID): void {
    this._sink.delete(dataID);
  }

  remove(dataID: DataID): void {
    // $FlowFixMe[incompatible-type] frozen objects are readonly
    this._sink.set(dataID, UNPUBLISH_RECORD_SENTINEL);
  }

  set(dataID: DataID, record: Record): void {
    this._sink.set(dataID, record);
  }

  getRecordIDs(): Array<DataID> {
    return Object.keys(this.toJSON());
  }

  size(): number {
    return Object.keys(this.toJSON()).length;
  }

  toJSON(): {[key: DataID]: ?RecordJSON} {
    const merged = {...this._base.toJSON()};
    this._sink.getRecordIDs().forEach(dataID => {
      const record = this.get(dataID);
      if (record === undefined) {
        delete merged[dataID];
      } else {
        merged[dataID] = RelayModernRecord.toJSON<null | void>(record);
      }
    });
    return merged;
  }

  getOptimisticRecordIDs(): Set<DataID> {
    return new Set(this._sink.getRecordIDs());
  }
}

function create(base: RecordSource): MutableRecordSource {
  return new RelayOptimisticRecordSource(base);
}

function getOptimisticRecordIDs(source: MutableRecordSource): Set<DataID> {
  invariant(
    source instanceof RelayOptimisticRecordSource,
    'getOptimisticRecordIDs: Instance of RelayOptimisticRecordSource is expected',
  );

  return source.getOptimisticRecordIDs();
}

module.exports = {create, getOptimisticRecordIDs};
