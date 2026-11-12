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

import type {ReaderFragment} from '../../util/ReaderNode';
import type {ConcreteRequest} from '../../util/RelayConcreteNode';
import type {DataIDSet, Snapshot} from '../RelayStoreTypes';

const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const hasOverlappingIDs = require('../hasOverlappingIDs');
const hasOverlappingIDsPerf = require('../hasOverlappingIDsPerf');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');

type MockOverlapCheck = (seen: DataIDSet, updated: DataIDSet) => boolean;

jest.mock('../hasOverlappingIDs', () =>
  jest.fn(jest.requireActual<MockOverlapCheck>('../hasOverlappingIDs')),
);
jest.mock('../hasOverlappingIDsPerf', () =>
  jest.fn(jest.requireActual<MockOverlapCheck>('../hasOverlappingIDsPerf')),
);

const FRAGMENT: ReaderFragment = {
  abstractKey: null,
  argumentDefinitions: [],
  kind: 'Fragment',
  metadata: null,
  name: 'RelayStoreSubscriptionsOverlapCheckTestFragment',
  selections: [
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'name',
      storageKey: null,
    },
  ],
  type: 'User',
};

const QUERY: ConcreteRequest = {
  fragment: {
    ...FRAGMENT,
    name: 'RelayStoreSubscriptionsOverlapCheckTestQuery',
    selections: [],
    type: 'Query',
  },
  kind: 'Request',
  operation: {
    argumentDefinitions: [],
    kind: 'Operation',
    name: 'RelayStoreSubscriptionsOverlapCheckTestQuery',
    selections: [],
  },
  params: {
    cacheID: 'RelayStoreSubscriptionsOverlapCheckTestQuery',
    id: null,
    metadata: {},
    name: 'RelayStoreSubscriptionsOverlapCheckTestQuery',
    operationKind: 'query',
    text: null,
  },
};

// A store holding users `a` and `b`.
function createStore(): RelayModernStore {
  return new RelayModernStore(
    RelayRecordSource.create({
      a: {__id: 'a', __typename: 'User', name: 'A'},
      b: {__id: 'b', __typename: 'User', name: 'B'},
    }),
  );
}

// Subscribes `callback` to user `a`'s name.
function subscribeToA(
  store: RelayModernStore,
  callback: (snapshot: Snapshot) => void,
): void {
  const owner = createOperationDescriptor(QUERY, {});
  const selector = createReaderSelector(FRAGMENT, 'a', {}, owner.request);
  store.subscribe(store.lookup(selector), callback);
}

function publishAndNotify(store: RelayModernStore, id: string): void {
  store.publish(
    RelayRecordSource.create({
      [id]: {__id: id, __typename: 'User', name: 'Changed'},
    }),
  );
  store.notify();
}

describe('RelayStoreSubscriptions overlap check', () => {
  let previousFlag;
  beforeEach(() => {
    previousFlag = RelayFeatureFlags.ENABLE_PERF_NOTIFY;
    jest.clearAllMocks();
  });
  afterEach(() => {
    RelayFeatureFlags.ENABLE_PERF_NOTIFY = previousFlag;
  });

  it('uses hasOverlappingIDs with ENABLE_PERF_NOTIFY off', () => {
    RelayFeatureFlags.ENABLE_PERF_NOTIFY = false;
    const callback = jest.fn();
    const store = createStore();
    subscribeToA(store, callback);
    publishAndNotify(store, 'b');
    expect(callback).not.toHaveBeenCalled();
    publishAndNotify(store, 'a');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(hasOverlappingIDs).toHaveBeenCalledTimes(2);
    expect(hasOverlappingIDsPerf).not.toHaveBeenCalled();
  });

  it('uses hasOverlappingIDsPerf with ENABLE_PERF_NOTIFY on', () => {
    RelayFeatureFlags.ENABLE_PERF_NOTIFY = true;
    const callback = jest.fn();
    const store = createStore();
    subscribeToA(store, callback);
    publishAndNotify(store, 'b');
    expect(callback).not.toHaveBeenCalled();
    publishAndNotify(store, 'a');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(hasOverlappingIDsPerf).toHaveBeenCalledTimes(2);
    expect(hasOverlappingIDs).not.toHaveBeenCalled();
  });

  it('reads ENABLE_PERF_NOTIFY when the store is created', () => {
    RelayFeatureFlags.ENABLE_PERF_NOTIFY = true;
    const store = createStore();
    RelayFeatureFlags.ENABLE_PERF_NOTIFY = false;
    subscribeToA(store, jest.fn());
    publishAndNotify(store, 'b');
    expect(hasOverlappingIDsPerf).toHaveBeenCalledTimes(1);
    expect(hasOverlappingIDs).not.toHaveBeenCalled();
  });
});
