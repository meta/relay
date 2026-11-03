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
import type {Record, RecordSource, RecordSourceJSON} from './RelayStoreTypes';

const RelayModernRecord = require('./RelayModernRecord');
const RelayRecordState = require('./RelayRecordState');

const {EXISTENT, NONEXISTENT, UNKNOWN} = RelayRecordState;

/**
 * A read-only view of a record source as it will be once `layers` are
 * published onto it in order: a layer's record merges its fields into the
 * record below it, and a `null` record deletes it.
 */
class RelayRecordSourceOverlay implements RecordSource {
  _base: RecordSource;
  _layers: ReadonlyArray<RecordSource>;
  _records: Map<DataID, ?Record>;

  constructor(base: RecordSource, layers: ReadonlyArray<RecordSource>) {
    this._base = base;
    this._layers = layers;
    this._records = new Map();
  }

  get(dataID: DataID): ?Record {
    if (this._records.has(dataID)) {
      return this._records.get(dataID);
    }
    let record = this._base.get(dataID);
    const layers = this._layers;
    for (let ii = 0; ii < layers.length; ii++) {
      const next = layers[ii].get(dataID);
      if (next !== undefined) {
        record =
          next === null || record == null
            ? next
            : RelayModernRecord.update(record, next);
      }
    }
    this._records.set(dataID, record);
    return record;
  }

  getRecordIDs(): Array<DataID> {
    const ids = new Set<DataID>(this._base.getRecordIDs());
    const layers = this._layers;
    for (let ii = 0; ii < layers.length; ii++) {
      const layerIDs = layers[ii].getRecordIDs();
      for (let jj = 0; jj < layerIDs.length; jj++) {
        ids.add(layerIDs[jj]);
      }
    }
    return Array.from(ids);
  }

  getStatus(dataID: DataID): RecordState {
    if (!this.has(dataID)) {
      return UNKNOWN;
    }
    return this.get(dataID) == null ? NONEXISTENT : EXISTENT;
  }

  has(dataID: DataID): boolean {
    if (this._base.has(dataID)) {
      return true;
    }
    const layers = this._layers;
    for (let ii = 0; ii < layers.length; ii++) {
      if (layers[ii].has(dataID)) {
        return true;
      }
    }
    return false;
  }

  size(): number {
    return this.getRecordIDs().length;
  }

  toJSON(): RecordSourceJSON {
    const json: {...RecordSourceJSON} = {};
    const ids = this.getRecordIDs();
    for (let ii = 0; ii < ids.length; ii++) {
      json[ids[ii]] = RelayModernRecord.toJSON<null | void>(this.get(ids[ii]));
    }
    return json;
  }
}

module.exports = RelayRecordSourceOverlay;
