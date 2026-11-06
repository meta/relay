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

// Runs RelayReader-test with ENABLE_PERF_READER on.
// RelayFeatureFlags is mocked so that every copy of it has the flag on, also
// after jest.resetModules().
jest.mock('../../util/RelayFeatureFlags', () => ({
  ...jest.requireActual('../../util/RelayFeatureFlags'),
  ENABLE_PERF_READER: true,
}));

require('./RelayReader-test');

import type {ReaderFragment, ReaderSelection} from '../../util/ReaderNode';
import type {ConcreteRequest} from '../../util/RelayConcreteNode';
import type {RecordJSON} from '../RelayModernRecord';

const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const {read} = require('../RelayReader');
const RelayRecordSource = require('../RelayRecordSource');

describe('data of fragments with many fields', () => {
  const FIELD_COUNT = 20;
  const ALWAYS_READ = 12;
  const fieldName = (ii: number) => `field${ii}`;
  const field = (ii: number): ReaderSelection => ({
    alias: null,
    args: null,
    kind: 'ScalarField',
    name: fieldName(ii),
    storageKey: null,
  });
  // Fields 0 to 11 are always read, 12 to 19 only when `$showMore` is true,
  // each in its own condition: the node has 20 selections (data shapes are
  // kept for nodes with more than 16) and its data 12 or 20 keys.
  const selections: Array<ReaderSelection> = [];
  for (let ii = 0; ii < FIELD_COUNT; ii++) {
    selections.push(
      ii < ALWAYS_READ
        ? field(ii)
        : {
            condition: 'showMore',
            kind: 'Condition',
            passingValue: true,
            selections: [field(ii)],
          },
    );
  }
  // A new node per test: shapes are kept per node.
  const makeFragment = (): ReaderFragment => ({
    abstractKey: null,
    argumentDefinitions: [
      {defaultValue: false, kind: 'LocalArgument', name: 'showMore'},
    ],
    kind: 'Fragment',
    metadata: null,
    name: 'RelayReaderWideDataTestFragment',
    selections: [...selections],
    type: 'User',
  });
  const query: ConcreteRequest = {
    fragment: {...makeFragment(), name: 'RelayReaderWideDataTestQuery'},
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name: 'RelayReaderWideDataTestQuery',
      selections: [],
    },
    params: {
      cacheID: 'RelayReaderWideDataTestQuery',
      id: null,
      metadata: {},
      name: 'RelayReaderWideDataTestQuery',
      operationKind: 'query',
      text: null,
    },
  };
  const record: RecordJSON = {__id: '1', __typename: 'User'};
  const expected: {[key: string]: unknown} = {};
  const narrow: {[key: string]: unknown} = {};
  for (let ii = 0; ii < FIELD_COUNT; ii++) {
    record[fieldName(ii)] = `value ${ii}`;
    expected[fieldName(ii)] = `value ${ii}`;
    if (ii < ALWAYS_READ) {
      narrow[fieldName(ii)] = `value ${ii}`;
    }
  }
  const expectRead = (
    fragment: ReaderFragment,
    showMore: boolean,
    data: {[key: string]: unknown},
  ) => {
    const read_ = read(
      RelayRecordSource.create({'1': record}),
      createReaderSelector(
        fragment,
        '1',
        {showMore},
        createOperationDescriptor(query, {}).request,
      ),
    ).data;
    expect(read_).toEqual(data);
    expect(Object.keys(read_ ?? {})).toEqual(Object.keys(data));
  };

  it('reads every field when the first read has up to 16 keys', () => {
    // The first read of the node has 12 keys: no shape to keep.
    const fragment = makeFragment();
    expectRead(fragment, false, narrow);
    expectRead(fragment, true, expected);
    expectRead(fragment, false, narrow);
  });

  it('reads every field when the first read has more than 16 keys', () => {
    // The first read of the node has 20 keys and keeps their shape; reads
    // with fewer keys don't use all of it.
    const fragment = makeFragment();
    expectRead(fragment, true, expected);
    expectRead(fragment, true, expected);
    expectRead(fragment, false, narrow);
  });
});

describe('shapes kept for data of 17 to 64 keys', () => {
  const wideFragment = (fieldCount: number): ReaderFragment => {
    const fields: Array<ReaderSelection> = [];
    for (let ii = 0; ii < fieldCount; ii++) {
      fields.push({
        alias: null,
        args: null,
        kind: 'ScalarField',
        name: `wide${ii}`,
        storageKey: null,
      });
    }
    return {
      abstractKey: null,
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: null,
      name: 'RelayReaderShapeTestFragment',
      selections: fields,
      type: 'User',
    };
  };
  const query: ConcreteRequest = {
    fragment: {...wideFragment(0), name: 'RelayReaderShapeTestQuery'},
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name: 'RelayReaderShapeTestQuery',
      selections: [],
    },
    params: {
      cacheID: 'RelayReaderShapeTestQuery',
      id: null,
      metadata: {},
      name: 'RelayReaderShapeTestQuery',
      operationKind: 'query',
      text: null,
    },
  };
  // Reads the fragment twice and returns how many properties named after its
  // fields Object.defineProperty created during each read (the shape kept for
  // the node is built with it).
  const readTwice = (fieldCount: number): Array<number> => {
    const fragment = wideFragment(fieldCount);
    const record: RecordJSON = {__id: '1', __typename: 'User'};
    const expected: {[key: string]: unknown} = {};
    for (let ii = 0; ii < fieldCount; ii++) {
      record[`wide${ii}`] = ii;
      expected[`wide${ii}`] = ii;
    }
    const source = RelayRecordSource.create({'1': record});
    const owner = createOperationDescriptor(query, {}).request;
    const counts = [];
    for (let read_ = 0; read_ < 2; read_++) {
      const defineProperty = jest.spyOn(Object, 'defineProperty');
      const {data} = read(
        source,
        createReaderSelector(fragment, '1', {}, owner),
      );
      counts.push(
        defineProperty.mock.calls.filter(
          ([, key]) => typeof key === 'string' && key.startsWith('wide'),
        ).length,
      );
      defineProperty.mockRestore();
      expect(data).toEqual(expected);
      expect(Object.keys(data ?? {})).toEqual(Object.keys(expected));
    }
    return counts;
  };

  it('keeps the shape of data with 40 keys after its first read', () => {
    expect(readTwice(40)).toEqual([40, 0]);
  });

  it('keeps no shape for data with more than 64 keys', () => {
    expect(readTwice(70)).toEqual([0, 0]);
  });
});
