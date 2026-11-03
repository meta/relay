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

import type {HandlerProvider} from '../handlers/RelayDefaultHandlerProvider';
import type {GetDataID} from '../store/RelayResponseNormalizer';
import type {
  LogFunction,
  MissingFieldHandler,
  RecordProxy,
} from '../store/RelayStoreTypes';
import type {DataID} from '../util/RelayRuntimeTypes';
import type RelayRecordSourceMutator from './RelayRecordSourceMutator';

const {EXISTENT, NONEXISTENT} = require('../store/RelayRecordState');
const {ROOT_ID} = require('../store/RelayStoreUtils');
const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const RelayRecordProxy = require('./RelayRecordProxy');
const RelayRecordSourceProxy = require('./RelayRecordSourceProxy');
const invariant = require('invariant');

// RelayRecordSourceProxy keeps the proxies in a plain object, whose keys are
// the IDs' strings: an untyped caller's numeric ID shares its string's proxy.
function getProxyKey(dataID: DataID): DataID {
  return typeof dataID === 'string' ? dataID : String(dataID);
}

class RelayRecordSourceProxyOptimized extends RelayRecordSourceProxy {
  // Only get(), create() and delete() touch the record proxies; the inherited
  // methods (publishSource, getRoot, the invalidation and updatable-data
  // methods) reach records through them. Flow treats `_`-prefixed fields as
  // private to the class that declares them, so this class declares again the
  // parent field its methods use; a field declared again is reset when
  // `super()` returns, so the constructor assigns it again.
  __mutator: RelayRecordSourceMutator;

  // The record proxies, kept here instead of in the parent's `_proxies`;
  // created by the first get(): most proxies (one per published payload) are
  // never asked for a record.
  _proxyMap: ?Map<DataID, ?RelayRecordProxy>;

  constructor(
    mutator: RelayRecordSourceMutator,
    getDataID: GetDataID,
    handlerProvider?: ?HandlerProvider,
    missingFieldHandlers: ReadonlyArray<MissingFieldHandler>,
    log: ?LogFunction,
  ) {
    super(mutator, getDataID, handlerProvider, missingFieldHandlers, log);
    this.__mutator = mutator;
    this._proxyMap = null;
  }

  create(dataID: DataID, typeName: string): RecordProxy {
    this.__mutator.create(dataID, typeName);
    const proxies = this._proxyMap;
    if (proxies != null) {
      proxies.delete(getProxyKey(dataID));
    }
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
    const proxies = this._proxyMap;
    if (proxies != null) {
      proxies.delete(getProxyKey(dataID));
    }
    this.__mutator.delete(dataID);
  }

  get(dataID: DataID): ?RecordProxy {
    let proxies = this._proxyMap;
    if (proxies == null) {
      proxies = new Map();
      this._proxyMap = proxies;
    }
    const key = getProxyKey(dataID);
    let proxy = proxies.get(key);
    if (proxy === undefined && !proxies.has(key)) {
      const status = this.__mutator.getStatus(dataID);
      if (status === EXISTENT) {
        proxy = new RelayRecordProxy(this, this.__mutator, dataID);
      } else {
        proxy = status === NONEXISTENT ? null : undefined;
      }
      proxies.set(key, proxy);
    }
    return proxy;
  }
}

/**
 * A new RelayRecordSourceProxy: RelayRecordSourceProxyOptimized when the
 * publish area is on (`ENABLE_PERF_PUBLISH`).
 */
function createRelayRecordSourceProxy(
  mutator: RelayRecordSourceMutator,
  getDataID: GetDataID,
  handlerProvider?: ?HandlerProvider,
  missingFieldHandlers: ReadonlyArray<MissingFieldHandler>,
  log: ?LogFunction,
): RelayRecordSourceProxy {
  return RelayFeatureFlags.ENABLE_PERF_PUBLISH
    ? new RelayRecordSourceProxyOptimized(
        mutator,
        getDataID,
        handlerProvider,
        missingFieldHandlers,
        log,
      )
    : new RelayRecordSourceProxy(
        mutator,
        getDataID,
        handlerProvider,
        missingFieldHandlers,
        log,
      );
}

module.exports = {
  RelayRecordSourceProxyOptimized,
  createRelayRecordSourceProxy,
};
