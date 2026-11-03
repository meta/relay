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

import type {DataID} from 'relay-runtime/util/RelayRuntimeTypes';

const defaultGetDataID = require('../../store/defaultGetDataID');
const RelayRecordSource = require('../../store/RelayRecordSource');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const RelayRecordSourceMutator = require('../RelayRecordSourceMutator');
const RelayRecordSourceProxy = require('../RelayRecordSourceProxy');
const {
  RelayRecordSourceProxyOptimized,
  createRelayRecordSourceProxy,
} = require('../RelayRecordSourceProxyOptimized');

// The names of the methods of a class, with the build's per-class renaming of
// `_` members (`$<Class>_<name>`) undone.
function ownMethods(prototype: interface {}): Array<string> {
  const names: Array<string> = [];
  for (const key of Reflect.ownKeys(prototype)) {
    if (typeof key === 'string' && key !== 'constructor') {
      names.push(key.replace(/^\$[A-Za-z0-9]+_/, '_'));
    }
  }
  return names.sort();
}

describe('RelayRecordSourceProxyOptimized', () => {
  let previousFlag;
  beforeEach(() => {
    previousFlag = RelayFeatureFlags.ENABLE_PERF_PUBLISH;
  });
  afterEach(() => {
    RelayFeatureFlags.ENABLE_PERF_PUBLISH = previousFlag;
  });

  it('overrides only the methods that keep record proxies', () => {
    // RelayRecordSourceProxy's other methods reach records through these.
    expect(ownMethods(RelayRecordSourceProxyOptimized.prototype)).toEqual([
      'create',
      'delete',
      'get',
    ]);
  });

  it('gives the proxies RelayRecordSourceProxy gives for numeric IDs', () => {
    // Untyped updaters can pass a number; read from JSON to get past Flow.
    const numericID: DataID = JSON.parse('4');
    const lookups = (
      ProxyClass: typeof RelayRecordSourceProxy,
      ids: ReadonlyArray<DataID>,
    ) => {
      const store = new ProxyClass(
        new RelayRecordSourceMutator(
          RelayRecordSource.create({'4': {__id: '4', __typename: 'User'}}),
          RelayRecordSource.create(),
        ),
        defaultGetDataID,
        null,
        [],
        null,
      );
      const proxies = ids.map(id => store.get(id));
      return [
        proxies.map(proxy => proxy?.getDataID()),
        proxies[0] === proxies[1],
      ];
    };
    for (const ids of [
      ['4', numericID],
      [numericID, '4'],
    ]) {
      expect(lookups(RelayRecordSourceProxyOptimized, ids)).toEqual(
        lookups(RelayRecordSourceProxy, ids),
      );
    }
  });

  it('supports IDs that are Object.prototype property names', () => {
    // RelayRecordSourceProxy's plain object answers these from its prototype.
    const store = new RelayRecordSourceProxyOptimized(
      new RelayRecordSourceMutator(
        RelayRecordSource.create(),
        RelayRecordSource.create(),
      ),
      defaultGetDataID,
      null,
      [],
      null,
    );
    expect(store.get('hasOwnProperty')).toBe(undefined);
    const created = store.create('constructor', 'User');
    expect(store.get('constructor')).toBe(created);
  });

  it('is created only with ENABLE_PERF_PUBLISH', () => {
    const mutator = new RelayRecordSourceMutator(
      RelayRecordSource.create(),
      RelayRecordSource.create(),
    );
    RelayFeatureFlags.ENABLE_PERF_PUBLISH = false;
    expect(
      createRelayRecordSourceProxy(mutator, defaultGetDataID, null, [], null),
    ).not.toBeInstanceOf(RelayRecordSourceProxyOptimized);
    RelayFeatureFlags.ENABLE_PERF_PUBLISH = true;
    expect(
      createRelayRecordSourceProxy(mutator, defaultGetDataID, null, [], null),
    ).toBeInstanceOf(RelayRecordSourceProxyOptimized);
  });
});
