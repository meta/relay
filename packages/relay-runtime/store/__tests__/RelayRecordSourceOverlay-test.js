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

const RelayModernRecord = require('../RelayModernRecord');
const RelayRecordSource = require('../RelayRecordSource');
const RelayRecordSourceOverlay = require('../RelayRecordSourceOverlay');

describe('RelayRecordSourceOverlay', () => {
  it('returns the base record when no layer has it', () => {
    const base = RelayRecordSource.create({
      '4': {__id: '4', __typename: 'User', name: 'Zuck'},
    });
    const overlay = new RelayRecordSourceOverlay(base, [
      RelayRecordSource.create(),
    ]);
    expect(overlay.get('4')).toBe(base.get('4'));
    expect(overlay.get('5')).toBe(undefined);
  });

  it('merges each layer into the record below it, newest last', () => {
    const base = RelayRecordSource.create({
      '4': {__id: '4', __typename: 'User', name: 'Zuck', username: 'zuck'},
    });
    const baseRecord = base.get('4');
    const overlay = new RelayRecordSourceOverlay(base, [
      RelayRecordSource.create({
        '4': {__id: '4', __typename: 'User', name: 'Mark', url: 'a'},
      }),
      RelayRecordSource.create({
        '4': {__id: '4', __typename: 'User', url: 'b'},
      }),
    ]);
    expect(RelayModernRecord.toJSON(overlay.get('4'))).toEqual({
      __id: '4',
      __typename: 'User',
      name: 'Mark',
      url: 'b',
      username: 'zuck',
    });
    expect(base.get('4')).toBe(baseRecord);
    expect(RelayModernRecord.toJSON(base.get('4'))).toEqual({
      __id: '4',
      __typename: 'User',
      name: 'Zuck',
      username: 'zuck',
    });
  });

  it('deletes a record a layer holds as null, and recreates it from a later layer alone', () => {
    const base = RelayRecordSource.create({
      '4': {__id: '4', __typename: 'User', name: 'Zuck'},
    });
    const deleted = RelayRecordSource.create();
    deleted.delete('4');
    expect(new RelayRecordSourceOverlay(base, [deleted]).get('4')).toBe(null);

    const overlay = new RelayRecordSourceOverlay(base, [
      deleted,
      RelayRecordSource.create({
        '4': {__id: '4', __typename: 'User', url: 'b'},
      }),
    ]);
    expect(RelayModernRecord.toJSON(overlay.get('4'))).toEqual({
      __id: '4',
      __typename: 'User',
      url: 'b',
    });
  });

  it('merges a record once', () => {
    const overlay = new RelayRecordSourceOverlay(
      RelayRecordSource.create({
        '4': {__id: '4', __typename: 'User', name: 'Zuck'},
      }),
      [
        RelayRecordSource.create({
          '4': {__id: '4', __typename: 'User', url: 'b'},
        }),
      ],
    );
    const update = jest.spyOn(RelayModernRecord, 'update');
    const record = overlay.get('4');
    expect(overlay.get('4')).toBe(record);
    expect(update).toHaveBeenCalledTimes(1);
    update.mockRestore();
  });

  it('reads any number of layers', () => {
    const layers = [];
    for (let ii = 0; ii < 20000; ii++) {
      layers.push(
        RelayRecordSource.create({
          '4': {__id: '4', __typename: 'User', count: ii},
        }),
      );
    }
    const overlay = new RelayRecordSourceOverlay(
      RelayRecordSource.create(),
      layers,
    );
    expect(RelayModernRecord.toJSON(overlay.get('4'))).toEqual({
      __id: '4',
      __typename: 'User',
      count: 19999,
    });
  });

  it('reports the ids, status and contents of the base and its layers', () => {
    const base = RelayRecordSource.create({
      '4': {__id: '4', __typename: 'User', name: 'Zuck'},
      '5': {__id: '5', __typename: 'User', name: 'Chris'},
    });
    const layer = RelayRecordSource.create({
      '6': {__id: '6', __typename: 'User', name: 'Sheryl'},
    });
    layer.delete('5');
    const overlay = new RelayRecordSourceOverlay(base, [layer]);

    expect(overlay.getRecordIDs().sort()).toEqual(['4', '5', '6']);
    expect(overlay.size()).toBe(3);
    expect(overlay.has('5')).toBe(true);
    expect(overlay.has('7')).toBe(false);
    expect(overlay.getStatus('4')).toBe('EXISTENT');
    expect(overlay.getStatus('5')).toBe('NONEXISTENT');
    expect(overlay.getStatus('6')).toBe('EXISTENT');
    expect(overlay.getStatus('7')).toBe('UNKNOWN');
    expect(overlay.toJSON()).toEqual({
      '4': {__id: '4', __typename: 'User', name: 'Zuck'},
      '5': null,
      '6': {__id: '6', __typename: 'User', name: 'Sheryl'},
    });
  });
});
