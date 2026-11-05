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

import type {HandlerProvider} from '../handlers/RelayDefaultHandlerProvider';
import type {GetDataID} from '../store/RelayResponseNormalizer';
import type {
  DataIDSet,
  FragmentType,
  HandleFieldPayload,
  HasUpdatableSpread,
  LogFunction,
  MissingFieldHandler,
  RecordProxy,
  RecordSource,
  RecordSourceProxy,
  UpdatableData,
} from '../store/RelayStoreTypes';
import type {
  DataID,
  UpdatableFragment,
  UpdatableQuery,
  Variables,
} from '../util/RelayRuntimeTypes';
import type RelayRecordSourceMutator from './RelayRecordSourceMutator';

const RelayModernRecord = require('../store/RelayModernRecord');
const {EXISTENT, NONEXISTENT} = require('../store/RelayRecordState');
const {ROOT_ID, ROOT_TYPE} = require('../store/RelayStoreUtils');
const {readUpdatableFragment} = require('./readUpdatableFragment');
const {readUpdatableQuery} = require('./readUpdatableQuery');
const RelayRecordProxy = require('./RelayRecordProxy');
const invariant = require('invariant');

/**
 * @internal
 *
 * A helper for manipulating a `RecordSource` via an imperative/OO-style API.
 */
class RelayRecordSourceProxy implements RecordSourceProxy {
  _handlerProvider: ?HandlerProvider;
  __mutator: RelayRecordSourceMutator;
  _proxies: {[dataID: DataID]: ?RelayRecordProxy, ...};
  _getDataID: GetDataID;
  _invalidatedStore: boolean;
  _idsMarkedForInvalidation: DataIDSet;
  _missingFieldHandlers: ReadonlyArray<MissingFieldHandler>;
  _log: LogFunction;

  constructor(
    mutator: RelayRecordSourceMutator,
    getDataID: GetDataID,
    handlerProvider?: ?HandlerProvider,
    missingFieldHandlers: ReadonlyArray<MissingFieldHandler>,
    log: ?LogFunction,
  ) {
    this.__mutator = mutator;
    this._handlerProvider = handlerProvider || null;
    this._proxies = {};
    this._getDataID = getDataID;
    this._invalidatedStore = false;
    this._idsMarkedForInvalidation = new Set();
    this._missingFieldHandlers = missingFieldHandlers;
    this._log = log ?? (LogEvent => {});
  }

  publishSource(
    source: RecordSource,
    fieldPayloads?: ?Array<HandleFieldPayload>,
  ): void {
    const dataIDs = source.getRecordIDs();
    dataIDs.forEach(dataID => {
      const status = source.getStatus(dataID);
      if (status === EXISTENT) {
        const sourceRecord = source.get(dataID);
        if (sourceRecord) {
          if (this.__mutator.getStatus(dataID) !== EXISTENT) {
            this.create(dataID, RelayModernRecord.getType(sourceRecord));
          }
          this.__mutator.copyFieldsFromRecord(sourceRecord, dataID);
        }
      } else if (status === NONEXISTENT) {
        this.delete(dataID);
      }
    });

    if (fieldPayloads && fieldPayloads.length) {
      fieldPayloads.forEach(fieldPayload => {
        const handler =
          this._handlerProvider && this._handlerProvider(fieldPayload.handle);
        invariant(
          handler,
          'RelayModernEnvironment: Expected a handler to be provided for handle `%s`.',
          fieldPayload.handle,
        );
        handler.update(this, fieldPayload);
      });
    }
  }

  create(dataID: DataID, typeName: string): RecordProxy {
    this.__mutator.create(dataID, typeName);
    delete this._proxies[dataID];
    const record = this.get(dataID);
    // For flow
    invariant(
      record,
      'RelayRecordSourceProxy#create(): Expected the created record to exist.',
    );
    return record;
  }

  delete(dataID: DataID): void {
    invariant(
      dataID !== ROOT_ID,
      'RelayRecordSourceProxy#delete(): Cannot delete the root record.',
    );
    delete this._proxies[dataID];
    this.__mutator.delete(dataID);
  }

  get(dataID: DataID): ?RecordProxy {
    if (!this._proxies.hasOwnProperty(dataID)) {
      const status = this.__mutator.getStatus(dataID);
      if (status === EXISTENT) {
        this._proxies[dataID] = new RelayRecordProxy(
          this,
          this.__mutator,
          dataID,
        );
      } else {
        this._proxies[dataID] = status === NONEXISTENT ? null : undefined;
      }
    }
    return this._proxies[dataID];
  }

  getRoot(): RecordProxy {
    let root = this.get(ROOT_ID);
    if (!root) {
      root = this.create(ROOT_ID, ROOT_TYPE);
    }
    invariant(
      root && root.getType() === ROOT_TYPE,
      'RelayRecordSourceProxy#getRoot(): Expected the source to contain a ' +
        'root record, %s.',
      root == null
        ? 'no root record found'
        : `found a root record of type \`${root.getType()}\``,
    );
    return root;
  }

  invalidateStore(): void {
    this._invalidatedStore = true;
  }

  isStoreMarkedForInvalidation(): boolean {
    return this._invalidatedStore;
  }

  markIDForInvalidation(dataID: DataID): void {
    this._idsMarkedForInvalidation.add(dataID);
  }

  getIDsMarkedForInvalidation(): DataIDSet {
    return this._idsMarkedForInvalidation;
  }

  readUpdatableQuery<TVariables extends Variables, TData>(
    query: UpdatableQuery<TVariables, TData>,
    variables: TVariables,
  ): UpdatableData<TData> {
    return readUpdatableQuery(
      query,
      variables,
      this,
      this._missingFieldHandlers,
    );
  }

  readUpdatableFragment<
    TFragmentType extends FragmentType,
    TData extends {...},
  >(
    fragment: UpdatableFragment<TFragmentType, TData>,
    fragmentReference: HasUpdatableSpread<TFragmentType>,
  ): UpdatableData<TData> {
    return readUpdatableFragment(
      fragment,
      fragmentReference,
      this,
      this._missingFieldHandlers,
    );
  }
}

module.exports = RelayRecordSourceProxy;
