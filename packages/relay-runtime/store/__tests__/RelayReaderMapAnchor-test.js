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
import typeof RelayFeatureFlagsModule from '../../util/RelayFeatureFlags';
import typeof RelayModernOperationDescriptorModule from '../RelayModernOperationDescriptor';
import typeof RelayModernSelectorModule from '../RelayModernSelector';
import typeof RelayModernStoreModule from '../RelayModernStore';
import typeof RelayReaderModule from '../RelayReader';
import typeof RelayRecordSourceModule from '../RelayRecordSource';
import type {SingularReaderSelector, Snapshot, Store} from '../RelayStoreTypes';

// The value of a field the product reads. No anchor may reach it.
const SECRET = 'a value of a product record';
const SECRET_VARIABLE = 'a value of a product variable';

const PRODUCT_FRAGMENT: ReaderFragment = {
  argumentDefinitions: [],
  kind: 'Fragment',
  metadata: null,
  name: 'ProductFragment',
  selections: [
    {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'secret',
      storageKey: null,
    },
  ],
  type: 'User',
  abstractKey: null,
};

const PRODUCT_REQUEST: ConcreteRequest = {
  fragment: PRODUCT_FRAGMENT,
  kind: 'Request',
  operation: {
    argumentDefinitions: [],
    kind: 'Operation',
    name: 'ProductQuery',
    selections: [],
  },
  params: {
    cacheID: 'ProductQuery',
    id: null,
    metadata: {},
    name: 'ProductQuery',
    operationKind: 'query',
    text: null,
  },
};

type Modules = {
  RelayFeatureFlags: RelayFeatureFlagsModule,
  RelayModernStore: RelayModernStoreModule,
  RelayReader: RelayReaderModule,
  RelayRecordSource: RelayRecordSourceModule,
  createReaderSelector: RelayModernSelectorModule['createReaderSelector'],
  createRequestDescriptor: RelayModernOperationDescriptorModule['createRequestDescriptor'],
};

// Fresh copies of the modules: the anchors live as long as RelayReader's.
function loadModules(): Modules {
  jest.resetModules();
  return {
    RelayFeatureFlags: require('../../util/RelayFeatureFlags'),
    RelayModernStore: require('../RelayModernStore'),
    RelayReader: require('../RelayReader'),
    RelayRecordSource: require('../RelayRecordSource'),
    createReaderSelector: require('../RelayModernSelector')
      .createReaderSelector,
    createRequestDescriptor: require('../RelayModernOperationDescriptor')
      .createRequestDescriptor,
  };
}

// The value the read with `perfReader` publishes.
function publishedSecret(perfReader: boolean): string {
  return `${SECRET} (${String(perfReader)})`;
}

// A lookup with one reader class, then a publish of a new value that the
// lookup's subscription reads again. Adds what the reads return to `reached`.
function readAndNotify(
  modules: Modules,
  store: Store,
  selector: SingularReaderSelector,
  perfReader: boolean,
  reached: Array<unknown>,
): void {
  modules.RelayFeatureFlags.ENABLE_PERF_READER = perfReader;
  const snapshot = store.lookup(selector);
  const updates: Array<Snapshot> = [];
  const subscription = store.subscribe(snapshot, update => {
    updates.push(update);
  });
  store.publish(
    modules.RelayRecordSource.create({
      '4': {__id: '4', __typename: 'User', secret: publishedSecret(perfReader)},
    }),
  );
  store.notify();
  subscription.dispose();
  expect(updates.length).toBe(1);
  reached.push(snapshot, snapshot.data, updates[0], updates[0].data);
}

type ProductReads = {
  readonly reached: ReadonlyArray<unknown>,
};

// A store with product records, read with both reader classes, through
// lookups and through a subscription that a publish notifies. Returns the
// objects of these reads that no anchor may reach.
function readProductData(modules: Modules): ProductReads {
  const {RelayFeatureFlags, RelayModernStore, RelayRecordSource} = modules;
  const source = RelayRecordSource.create({
    '4': {__id: '4', __typename: 'User', secret: SECRET},
  });
  const store = new RelayModernStore(source);
  const variables = {productVariable: SECRET_VARIABLE};
  const owner = modules.createRequestDescriptor(PRODUCT_REQUEST, variables);
  const selector = modules.createReaderSelector(
    PRODUCT_FRAGMENT,
    '4',
    variables,
    owner,
  );
  const reached: Array<unknown> = [store, source, selector, owner, variables];
  const previous = RelayFeatureFlags.ENABLE_PERF_READER;
  try {
    readAndNotify(modules, store, selector, false, reached);
    readAndNotify(modules, store, selector, true, reached);
  } finally {
    RelayFeatureFlags.ENABLE_PERF_READER = previous;
  }
  reached.push(source.get('4'));
  return {reached};
}

// Sets the anchor flag and the two flags the store also requires for it.
function setFlags(
  modules: Modules,
  anchor: boolean,
  reader: boolean,
  storageKeys: boolean,
): void {
  modules.RelayFeatureFlags.ENABLE_PERF_READER_MAP_ANCHOR = anchor;
  modules.RelayFeatureFlags.ENABLE_PERF_READER = reader;
  modules.RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS = storageKeys;
}

// Every value reachable from `roots` through own enumerable properties,
// array items and Map and Set entries. Readers keep their state in plain
// fields, so this reaches everything a reader holds.
function collectReachable(roots: ReadonlyArray<unknown>): Set<unknown> {
  const reachable: Set<unknown> = new Set();
  const pending: Array<unknown> = roots.slice();
  while (pending.length > 0) {
    const value = pending.pop();
    if (reachable.has(value)) {
      continue;
    }
    reachable.add(value);
    if (value instanceof Map) {
      pending.push(...Array.from(value.keys()), ...Array.from(value.values()));
    } else if (value instanceof Set) {
      pending.push(...Array.from(value.values()));
    } else if (Array.isArray(value)) {
      pending.push(...value);
    } else if (typeof value === 'object' && value != null) {
      pending.push(...Object.values(value));
    }
  }
  return reachable;
}

describe('ENABLE_PERF_READER_MAP_ANCHOR', () => {
  it('creates no anchor while the flag is off', () => {
    const modules = loadModules();
    setFlags(modules, false, true, true);
    readProductData(modules);
    expect(modules.RelayReader.getReaderMapAnchor()).toBe(null);
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
  ])(
    'creates no anchor with ENABLE_PERF_READER %s and ENABLE_PERF_STORAGE_KEYS %s',
    (reader, storageKeys) => {
      const modules = loadModules();
      setFlags(modules, true, reader, storageKeys);
      readProductData(modules);
      expect(modules.RelayReader.getReaderMapAnchor()).toBe(null);
    },
  );

  it('creates the anchor when the store is constructed, before any read', () => {
    const modules = loadModules();
    setFlags(modules, true, true, true);
    expect(modules.RelayReader.getReaderMapAnchor()).toBe(null);
    const source = modules.RelayRecordSource.create();
    const store = new modules.RelayModernStore(source);
    expect(store.getSource()).toBe(source);
    expect(modules.RelayReader.getReaderMapAnchor()).not.toBe(null);
  });

  it('keeps one RelayReaderOptimized alive from the first store on', () => {
    const modules = loadModules();
    setFlags(modules, true, true, true);
    expect(modules.RelayReader.getReaderMapAnchor()).toBe(null);
    readProductData(modules);
    const anchor = modules.RelayReader.getReaderMapAnchor();
    if (anchor == null) {
      throw new Error('Expected the anchor to exist.');
    }
    expect(anchor.constructor.name).toBe('RelayReaderOptimized');
    readProductData(modules);
    expect(modules.RelayReader.getReaderMapAnchor()).toBe(anchor);
  });

  it('holds no record, variables or request of any read', () => {
    const modules = loadModules();
    setFlags(modules, true, true, true);
    const {reached} = readProductData(modules);
    const anchor = modules.RelayReader.getReaderMapAnchor();
    if (anchor == null) {
      throw new Error('Expected the anchor to exist.');
    }
    const reachable = collectReachable([anchor]);
    const leaked: Array<unknown> = [];
    for (let i = 0; i < reached.length; i++) {
      if (reachable.has(reached[i])) {
        leaked.push(reached[i]);
      }
    }
    expect(leaked).toEqual([]);
    expect(reachable.has(SECRET)).toBe(false);
    expect(reachable.has(publishedSecret(false))).toBe(false);
    expect(reachable.has(publishedSecret(true))).toBe(false);
    expect(reachable.has(SECRET_VARIABLE)).toBe(false);
    const values = Array.from(reachable);
    let recordSources = 0;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (value instanceof modules.RelayRecordSource) {
        recordSources++;
        expect(value.getRecordIDs()).toEqual([]);
      }
    }
    expect(recordSources).toBe(1);
  });
});
