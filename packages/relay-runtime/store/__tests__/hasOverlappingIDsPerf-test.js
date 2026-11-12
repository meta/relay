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

const hasOverlappingIDs = require('../hasOverlappingIDs');
const hasOverlappingIDsPerf = require('../hasOverlappingIDsPerf');

describe('hasOverlappingIDsPerf', () => {
  it.each([
    ['both sets empty', [], [], false],
    ['no seen records', [], ['a'], false],
    ['no updated records', ['a', 'b'], [], false],
    ['equal sets', ['a', 'b', 'c'], ['c', 'b', 'a'], true],
    ['equal sizes, one shared', ['a', 'b'], ['b', 'c'], true],
    ['equal sizes, none shared', ['a', 'b'], ['c', 'd'], false],
    ['fewer updated records, overlap', ['a', 'b', 'c', 'd'], ['x', 'c'], true],
    ['fewer updated records, none shared', ['a', 'b', 'c'], ['x', 'y'], false],
    ['fewer seen records, overlap', ['c', 'd'], ['a', 'b', 'c', 'x'], true],
    ['fewer seen records, none shared', ['c', 'd'], ['a', 'b', 'x'], false],
    ['shared only by the first ID walked', ['a', 'b', 'c'], ['a', 'x'], true],
    [
      'shared only by the last ID walked',
      ['a', 'b', 'c', 'd', 'e'],
      ['y', 'e'],
      true,
    ],
  ])('answers as hasOverlappingIDs: %s', (_name, seen, updated, expected) => {
    const seenRecords = new Set<string>(seen);
    const updatedRecordIDs = new Set<string>(updated);
    expect(hasOverlappingIDs(seenRecords, updatedRecordIDs)).toBe(expected);
    expect(hasOverlappingIDsPerf(seenRecords, updatedRecordIDs)).toBe(expected);
    expect(hasOverlappingIDsPerf(updatedRecordIDs, seenRecords)).toBe(expected);
  });

  it.each([
    ['fewer updated records', ['a', 'b', 'c'], ['x']],
    ['fewer seen records', ['x'], ['a', 'b', 'c']],
  ])('walks only the smaller set: %s', (_name, seen, updated) => {
    const seenRecords = new Set<string>(seen);
    const updatedRecordIDs = new Set<string>(updated);
    const larger =
      seenRecords.size > updatedRecordIDs.size ? seenRecords : updatedRecordIDs;
    const walkLarger = jest.spyOn(larger, 'values');
    expect(hasOverlappingIDsPerf(seenRecords, updatedRecordIDs)).toBe(false);
    expect(walkLarger).not.toHaveBeenCalled();
  });
});
