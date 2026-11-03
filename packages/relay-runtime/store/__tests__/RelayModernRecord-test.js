/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall relay
 */

'use strict';

const {
  getActorIdentifier,
} = require('../../multi-actor-environment/ActorIdentifier');
const deepFreeze = require('../../util/deepFreeze');
const RelayModernRecord = require('../RelayModernRecord');
const RelayStoreUtils = require('../RelayStoreUtils');
const areEqual = require('areEqual');
const RelayModernTestUtils = require('relay-test-utils-internal');

const {ERRORS_KEY, ID_KEY, REF_KEY, REFS_KEY, TYPENAME_KEY} = RelayStoreUtils;

describe('RelayModernRecord', () => {
  beforeEach(() => {
    expect.extend(RelayModernTestUtils.matchers);
  });

  describe('clone', () => {
    it('returns a shallow copy of the record', () => {
      const record = {
        [ID_KEY]: '4',
        name: 'Mark',
        pet: {[REF_KEY]: 'beast'},
      };
      const clone = RelayModernRecord.clone(record);
      expect(clone).toEqual(record);
      expect(clone).not.toBe(record);
      expect(clone.pet).toBe(record.pet);
    });
  });

  describe('copyFields()', () => {
    it('copies fields', () => {
      const sink = {
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
      };
      const source = {
        [ID_KEY]: '__4',
        [TYPENAME_KEY]: '__User',
        name: 'Zuck',
        pet: {[REF_KEY]: 'beast'},
        pets: {[REFS_KEY]: ['beast']},
      };
      deepFreeze(source);
      RelayModernRecord.copyFields(source, sink);
      expect(sink).toEqual({
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: 'Zuck',
        pet: {[REF_KEY]: 'beast'},
        pets: {[REFS_KEY]: ['beast']},
      });
      // values are copied by reference not value
      expect(sink.pet).toBe(source.pet);
      expect(sink.pets).toBe(source.pets);
    });
  });

  describe('fromObject()', () => {
    it('returns the given JSON object', () => {
      const object = {};
      const record = RelayModernRecord.fromObject(object);
      expect(record).toBe(object);
    });
  });

  describe('getLinkedRecordIDs()', () => {
    let record;

    beforeEach(() => {
      record = {
        [ERRORS_KEY]: {
          fieldWithError: [
            {
              message: 'Something bad happened!',
            },
          ],
        },
        [ID_KEY]: 4,
        name: 'Mark',
        enemies: null,
        hometown: {
          [REF_KEY]: 'mpk',
        },
        'friends{"first":10}': {
          [REFS_KEY]: ['beast', 'greg', null],
        },
        fieldWithError: null,
      };
    });

    it('returns undefined when the link is unknown', () => {
      expect(RelayModernRecord.getLinkedRecordIDs(record, 'colors')).toBe(
        undefined,
      );
    });

    it('returns null when the link is non-existent', () => {
      expect(RelayModernRecord.getLinkedRecordIDs(record, 'enemies')).toBe(
        null,
      );
    });

    it('returns null when the link has an error', () => {
      expect(
        RelayModernRecord.getLinkedRecordIDs(record, 'fieldWithError'),
      ).toBeNull();
    });

    it('returns the linked record IDs when they exist', () => {
      expect(
        RelayModernRecord.getLinkedRecordIDs(record, 'friends{"first":10}'),
      ).toEqual(['beast', 'greg', null]);
    });

    it('throws if the field is actually a scalar', () => {
      expect(() =>
        RelayModernRecord.getLinkedRecordIDs(record, 'name'),
      ).toThrowError(
        'RelayModernRecord.getLinkedRecordIDs(): Expected `4.name` to contain ' +
          'an array of linked IDs, got `"Mark"`.',
      );
    });

    it('throws if the field is a singular link', () => {
      expect(() =>
        RelayModernRecord.getLinkedRecordIDs(record, 'hometown'),
      ).toThrowError(
        'RelayModernRecord.getLinkedRecordIDs(): Expected `4.hometown` to contain ' +
          'an array of linked IDs, got `{"__ref":"mpk"}`.',
      );
    });
  });

  describe('setLinkedRecordID()', () => {
    it('sets a link', () => {
      const record = {
        [ID_KEY]: '4',
      };
      RelayModernRecord.setLinkedRecordID(record, 'pet', 'beast');
      expect(RelayModernRecord.getLinkedRecordID(record, 'pet')).toBe('beast');
    });
  });

  describe('setLinkedRecordIDs()', () => {
    it('sets an array of links', () => {
      const record = {
        [ID_KEY]: '4',
      };
      const storageKey = 'friends{"first":10}';
      RelayModernRecord.setLinkedRecordIDs(record, storageKey, [
        'beast',
        'greg',
        null,
      ]);
      expect(RelayModernRecord.getLinkedRecordIDs(record, storageKey)).toEqual([
        'beast',
        'greg',
        null,
      ]);
    });
  });

  describe('getFields()', () => {
    it('returns an array with all the keys', () => {
      const fields = RelayModernRecord.getFields({
        [ERRORS_KEY]: {
          fieldWithError: [
            {
              message: 'Something bad happened!',
              path: ['fieldWithError'],
            },
          ],
        },
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: 'Zuck',
        pets: {[REFS_KEY]: ['beast']},
        fieldWithError: null,
      });
      expect(fields).toEqual([
        ID_KEY,
        TYPENAME_KEY,
        'name',
        'pets',
        'fieldWithError',
      ]);
    });
  });

  describe('getValue()', () => {
    let record;

    beforeEach(() => {
      record = {
        [ERRORS_KEY]: {
          fieldWithError: [
            {
              message: 'Something bad happened!',
            },
          ],
        },
        [ID_KEY]: 4,
        name: 'Mark',
        blockbusterMembership: null,
        hometown: {
          [REF_KEY]: 'mpk',
        },
        'friends{"first":10}': {
          [REFS_KEY]: ['beast', 'greg'],
        },
        favoriteColors: ['red', 'green', 'blue'],
        other: {
          customScalar: true,
        },
        fieldWithError: null,
      };
    });

    it('returns a scalar value', () => {
      expect(RelayModernRecord.getValue(record, 'name')).toBe('Mark');
    });

    it('returns null when field has errors', () => {
      expect(RelayModernRecord.getValue(record, 'fieldWithError')).toBeNull();
    });

    it('returns a (list) scalar value', () => {
      // Note that lists can be scalars too. The definition of scalar value is
      // "not a singular or plural link", and means that no query can traverse
      // into it.
      expect(RelayModernRecord.getValue(record, 'favoriteColors')).toEqual([
        'red',
        'green',
        'blue',
      ]);
    });

    it('returns a (custom object) scalar value', () => {
      // Objects can be scalars too. The definition of scalar value is
      // "not a singular or plural link", and means that no query can traverse
      // into it.
      expect(RelayModernRecord.getValue(record, 'other')).toEqual({
        customScalar: true,
      });
    });

    it('returns null when the field is non-existent', () => {
      expect(RelayModernRecord.getValue(record, 'blockbusterMembership')).toBe(
        null,
      );
    });

    it('returns undefined when the field is unknown', () => {
      expect(RelayModernRecord.getValue(record, 'horoscope')).toBe(undefined);
    });

    it('throws on encountering a linked record', () => {
      expect(() => RelayModernRecord.getValue(record, 'hometown')).toThrowError(
        'RelayModernRecord.getValue(): Expected a scalar (non-link) value for ' +
          '`4.hometown` but found a linked record.',
      );
    });

    it('throws on encountering a plural linked record', () => {
      expect(() =>
        RelayModernRecord.getValue(record, 'friends{"first":10}'),
      ).toThrowError(
        'RelayModernRecord.getValue(): Expected a scalar (non-link) value for ' +
          '`4.friends{"first":10}` but found plural linked records.',
      );
    });
  });

  describe('freeze()', () => {
    it('prevents modification of records', () => {
      const record = RelayModernRecord.create('4', 'User');
      RelayModernRecord.freeze(record);
      expect(() => {
        RelayModernRecord.setValue(record, 'pet', 'Beast');
      }).toThrow(TypeError);
    });
  });

  describe('setErrors()', () => {
    it('warns if the field is undefined', () => {
      jest.mock('warning');
      const record = RelayModernRecord.create('4', 'User');
      expect(() =>
        RelayModernRecord.setErrors(record, 'pet', [
          {
            message: 'There was an error on the pet field!',
          },
          {
            message: 'There was another error on the pet field!',
          },
        ]),
      ).toWarn([
        'RelayModernRecord: Invalid error update, `%s` should not be undefined.',
        'pet',
      ]);
    });

    it('adds and removes errors', () => {
      const record = RelayModernRecord.create('4', 'User');
      expect(RelayModernRecord.getErrors(record, 'pet')).toBeUndefined();
      const petErrors = [
        {
          message: 'There was an error on the pet field!',
        },
        {
          message: 'There was another error on the pet field!',
        },
      ];
      RelayModernRecord.setValue(record, 'pet', null);
      RelayModernRecord.setErrors(record, 'pet', petErrors);
      expect(RelayModernRecord.getErrors(record, 'pet')).toBe(petErrors);
      const nameErrors = [
        {
          message: 'There was an error on the name field!',
        },
      ];
      RelayModernRecord.setValue(record, 'name', null);
      RelayModernRecord.setErrors(record, 'name', nameErrors);
      expect(RelayModernRecord.getErrors(record, 'name')).toBe(nameErrors);
      expect(RelayModernRecord.getErrors(record, 'pet')).toBe(petErrors);
      const newPetErrors = [
        {
          message: 'There was a different error on the pet field!',
        },
      ];
      RelayModernRecord.setErrors(record, 'pet', newPetErrors);
      expect(RelayModernRecord.getErrors(record, 'pet')).toBe(newPetErrors);
      expect(RelayModernRecord.getErrors(record, 'name')).toBe(nameErrors);
      const noErrors = [];
      RelayModernRecord.setErrors(record, 'pet', noErrors);
      expect(RelayModernRecord.getErrors(record, 'pet')).toBeUndefined();
      expect(RelayModernRecord.getErrors(record, 'name')).toBe(nameErrors);
      RelayModernRecord.setErrors(record, 'name', noErrors);
      expect(RelayModernRecord.getErrors(record, 'name')).toBeUndefined();
      expect(record).toEqual({
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: null,
        pet: null,
      });
    });
  });

  describe('hasValue()', () => {
    let record;

    beforeEach(() => {
      record = {
        [ERRORS_KEY]: {
          fieldWithError: [
            {
              message: 'Something bad happened!',
              path: ['fieldWithError'],
            },
          ],
        },
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        fieldThatIsString: 'applesauce',
        fieldThatIsNull: null,
        fieldThatIsUndefined: undefined,
        fieldWithError: null,
      };
    });

    it('has no special treatment for the id field', () => {
      expect(RelayModernRecord.hasValue(record, ID_KEY)).toBe(true);
    });

    it('has no special treatment for the typename field', () => {
      expect(RelayModernRecord.hasValue(record, TYPENAME_KEY)).toBe(true);
    });

    it('returns true when the value is a string', () => {
      expect(RelayModernRecord.hasValue(record, 'fieldThatIsString')).toBe(
        true,
      );
    });

    it('returns true when the value is null', () => {
      expect(RelayModernRecord.hasValue(record, 'fieldThatIsNull')).toBe(true);
    });

    it('returns true when the value is explicitly undefined', () => {
      expect(RelayModernRecord.hasValue(record, 'fieldThatIsUndefined')).toBe(
        true,
      );
    });

    it('returns true when the value is an error', () => {
      expect(RelayModernRecord.hasValue(record, 'fieldWithError')).toBe(true);
    });

    it('returns false when the value is missing', () => {
      expect(RelayModernRecord.hasValue(record, 'fieldThatIsMissing')).toBe(
        false,
      );
    });
  });

  describe('update()', () => {
    it('returns the first record if there are no changes', () => {
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'name', 'Zuck');
      const next = RelayModernRecord.clone(prev);
      const updated = RelayModernRecord.update(prev, next);
      expect(updated).toBe(prev);
      expect(updated).not.toBe(next);
      expect(updated).toEqual({
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: 'Zuck',
      });
    });

    it('returns a new record if there are changes', () => {
      const prev = RelayModernRecord.create('4', 'User');
      const next = RelayModernRecord.clone(prev);
      RelayModernRecord.setValue(next, 'name', 'Zuck');
      const updated = RelayModernRecord.update(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      expect(updated).toEqual({
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: 'Zuck',
      });
    });

    it('compares field values the way areEqual does', () => {
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'zero', 0);
      RelayModernRecord.setValue(prev, 'tags', ['a', 'b']);
      RelayModernRecord.setValue(prev, 'config', {nested: {enabled: true}});
      RelayModernRecord.setLinkedRecordID(prev, 'friend', '5');

      const same = RelayModernRecord.clone(prev);
      RelayModernRecord.setValue(same, 'tags', ['a', 'b']);
      RelayModernRecord.setValue(same, 'config', {nested: {enabled: true}});
      RelayModernRecord.setLinkedRecordID(same, 'friend', '5');
      expect(RelayModernRecord.update(prev, same)).toBe(prev);

      const negativeZero = RelayModernRecord.clone(prev);
      RelayModernRecord.setValue(negativeZero, 'zero', -0);
      expect(RelayModernRecord.update(prev, negativeZero)).not.toBe(prev);

      const changedTags = RelayModernRecord.clone(prev);
      RelayModernRecord.setValue(changedTags, 'tags', ['a', 'c']);
      expect(RelayModernRecord.update(prev, changedTags)).not.toBe(prev);

      const changedLink = RelayModernRecord.clone(prev);
      RelayModernRecord.setLinkedRecordID(changedLink, 'friend', '6');
      expect(RelayModernRecord.update(prev, changedLink)).not.toBe(prev);
    });

    it('compares links the way areEqual does', () => {
      const pairs = [
        [{__ref: '5'}, {__ref: '5'}],
        [{__ref: '5'}, {__ref: '6'}],
        [{__ref: '5'}, {__refs: ['5']}],
        [{__refs: ['5']}, {__ref: '5'}],
        [{__refs: ['5', '6']}, {__refs: ['5', '6']}],
        [{__refs: ['5', '6']}, {__refs: ['5']}],
        [{__refs: ['5', null]}, {__refs: ['5', null]}],
        [{__refs: ['5', null]}, {__refs: ['5', '6']}],
        [{__refs: []}, {__refs: []}],
        // Other objects with these keys are compared deeply.
        [
          {__ref: '5', extra: 1},
          {__ref: '5', extra: 1},
        ],
        [
          {__ref: '5', extra: 1},
          {__ref: '5', extra: 2},
        ],
        [{__ref: '5'}, {__ref: '5', extra: 1}],
        [{__ref: 5}, {__ref: 5}],
        [{__refs: [{id: '5'}]}, {__refs: [{id: '5'}]}],
        [{__refs: [{id: '5'}]}, {__refs: [{id: '6'}]}],
        [{__refs: ['5']}, {__refs: ['5'], extra: 1}],
      ];
      for (const [prevValue, nextValue] of pairs) {
        const prev = RelayModernRecord.create('4', 'User');
        RelayModernRecord.setValue(prev, 'friend', prevValue);
        const next = RelayModernRecord.create('4', 'User');
        RelayModernRecord.setValue(next, 'friend', nextValue);
        expect([
          prevValue,
          nextValue,
          RelayModernRecord.update(prev, next) === prev,
        ]).toEqual([prevValue, nextValue, areEqual(prevValue, nextValue)]);
        expect(RelayModernRecord.hasFieldChanged(prev, next, 'friend')).toBe(
          !areEqual(prevValue, nextValue),
        );
      }
    });

    it('treats NaN as changed, like areEqual', () => {
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'score', NaN);
      const next = RelayModernRecord.clone(prev);
      expect(RelayModernRecord.update(prev, next)).not.toBe(prev);
    });

    it('discards errors from first argument where applicable', () => {
      const errors = [
        {
          message: 'There was an error!',
          path: ['name'],
        },
        {
          message: 'There was another error!',
          path: ['name'],
        },
      ];
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'name', null);
      RelayModernRecord.setErrors(prev, 'name', errors);
      const next = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(next, 'name', 'Alice');
      const updated = RelayModernRecord.update(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      expect(RelayModernRecord.getErrors(updated, 'name')).toBeUndefined();
    });

    it('preserves errors from the first argument where applicable', () => {
      const prev = RelayModernRecord.create('4', 'User');
      const prevErrors = [
        {
          message: 'There was an error on the "name" field!',
        },
        {
          message: 'There was another error on the "name" field!',
        },
      ];
      RelayModernRecord.setValue(prev, 'name', null);
      RelayModernRecord.setErrors(prev, 'name', prevErrors);
      const next = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(next, 'age', 42);
      const updated = RelayModernRecord.update(prev, next);
      expect(RelayModernRecord.getValue(updated, 'name')).toBeNull();
      expect(RelayModernRecord.getErrors(updated, 'name')).toBe(prevErrors);
    });

    it('copies the errors from second argument where applicable', () => {
      const errors = [
        {
          message: 'There was an error!',
          path: ['name'],
        },
        {
          message: 'There was another error!',
          path: ['name'],
        },
      ];
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'age', 42);
      const next = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(next, 'name', null);
      RelayModernRecord.setErrors(next, 'name', errors);
      const updated = RelayModernRecord.update(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      expect(RelayModernRecord.getValue(updated, 'name')).toBeNull();
      expect(RelayModernRecord.getErrors(updated, 'name')).toBe(errors);
    });

    it('warns if __id does not match', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('4', 'User');
      const next = RelayModernRecord.create('5', 'User');
      expect(() => RelayModernRecord.update(prev, next)).toWarn([
        'RelayModernRecord: Invalid record update, expected both versions ' +
          'of the record to have the same id, got `%s` and `%s`.',
        '4',
        '5',
      ]);
    });

    it('warns if __typename does not match', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('42', 'Number');
      const next = RelayModernRecord.create('42', 'MeaningOfLife');
      expect(() => RelayModernRecord.update(prev, next)).toWarn([
        'RelayModernRecord: Invalid record update, expected both versions ' +
          'of record `%s` to have the same `%s` but got conflicting types ' +
          '`%s` and `%s`. The GraphQL server likely violated the globally ' +
          'unique id requirement by returning the same id for different objects.',
        '42',
        '__typename',
        'Number',
        'MeaningOfLife',
      ]);
    });

    it('does not warn if __typename does not match on client record', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('client:42', 'Number');
      const next = RelayModernRecord.create('client:42', 'MeaningOfLife');
      expect(() => RelayModernRecord.update(prev, next)).not.toWarn();
    });
  });

  describe('merge()', () => {
    it('returns a new record even if there are no changes', () => {
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'name', 'Zuck');
      const next = RelayModernRecord.clone(prev);
      const updated = RelayModernRecord.merge(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      expect(updated).toEqual({
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: 'Zuck',
      });
    });

    it('returns a new record if there are changes', () => {
      const prev = RelayModernRecord.create('4', 'User');
      const next = RelayModernRecord.clone(prev);
      RelayModernRecord.setValue(next, 'name', 'Zuck');
      const updated = RelayModernRecord.merge(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      expect(updated).toEqual({
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: 'Zuck',
      });
    });

    it('discards errors from first argument where applicable', () => {
      const errors = [
        {
          message: 'There was an error!',
          path: ['name'],
        },
        {
          message: 'There was another error!',
          path: ['name'],
        },
      ];
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'name', null);
      RelayModernRecord.setErrors(prev, 'name', errors);
      const next = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(next, 'name', 'Alice');
      const updated = RelayModernRecord.merge(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      expect(RelayModernRecord.getErrors(updated, 'name')).toBeUndefined();
    });

    it('preserves errors from the first argument where applicable', () => {
      const prev = RelayModernRecord.create('4', 'User');
      const prevErrors = [
        {
          message: 'There was an error on the "name" field!',
        },
        {
          message: 'There was another error on the "name" field!',
        },
      ];
      RelayModernRecord.setValue(prev, 'name', null);
      RelayModernRecord.setErrors(prev, 'name', prevErrors);
      const next = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(next, 'age', 42);
      const updated = RelayModernRecord.merge(prev, next);
      expect(RelayModernRecord.getValue(updated, 'name')).toBeNull();
      expect(RelayModernRecord.getErrors(updated, 'name')).toBe(prevErrors);
    });

    it('copies the errors from second argument where applicable', () => {
      const errors = [
        {
          message: 'There was an error!',
          path: ['name'],
        },
        {
          message: 'There was another error!',
          path: ['name'],
        },
      ];
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'age', 42);
      const next = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(next, 'name', null);
      RelayModernRecord.setErrors(next, 'name', errors);
      const updated = RelayModernRecord.merge(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      expect(RelayModernRecord.getValue(updated, 'name')).toBeNull();
      expect(RelayModernRecord.getErrors(updated, 'name')).toBe(errors);
    });

    it('warns if __id does not match', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('4', 'User');
      const next = RelayModernRecord.create('5', 'User');
      expect(() => RelayModernRecord.merge(prev, next)).toWarn([
        'RelayModernRecord: Invalid record merge, expected both versions of ' +
          'the record to have the same id, got `%s` and `%s`.',
        '4',
        '5',
      ]);
    });

    it('warns if __typename does not match', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('42', 'Number');
      const next = RelayModernRecord.create('42', 'MeaningOfLife');
      expect(() => RelayModernRecord.merge(prev, next)).toWarn([
        'RelayModernRecord: Invalid record merge, expected both versions of ' +
          'record `%s` to have the same `%s` but got conflicting types `%s` ' +
          'and `%s`. The GraphQL server likely violated the globally unique ' +
          'id requirement by returning the same id for different objects.',
        '42',
        '__typename',
        'Number',
        'MeaningOfLife',
      ]);
    });

    it('does not warn if __typename does not match on client record', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('client:42', 'Number');
      const next = RelayModernRecord.create('client:42', 'MeaningOfLife');
      expect(() => RelayModernRecord.merge(prev, next)).not.toWarn();
    });
  });

  describe('setValue()', () => {
    it('warns if updating to a different __id', () => {
      jest.mock('warning');
      const record = RelayModernRecord.create('4', 'User');
      expect(() => RelayModernRecord.setValue(record, ID_KEY, 'not-4')).toWarn([
        'RelayModernRecord: Invalid field update, expected both versions of ' +
          'the record to have the same id, got `%s` and `%s`.',
        '4',
        'not-4',
      ]);
    });

    it('warns if updating to a different __typename', () => {
      jest.mock('warning');
      const record = RelayModernRecord.create('4', 'User');
      expect(() =>
        RelayModernRecord.setValue(record, TYPENAME_KEY, 'not-User'),
      ).toWarn([
        'RelayModernRecord: Invalid field update, expected both versions of ' +
          'record `%s` to have the same `%s` but got conflicting types `%s` ' +
          'and `%s`. The GraphQL server likely violated the globally unique ' +
          'id requirement by returning the same id for different objects.',
        '4',
        '__typename',
        'User',
        'not-User',
      ]);
    });

    it('does not warn if updating the __typename of a client record', () => {
      jest.mock('warning');
      const record = RelayModernRecord.create('client:4', 'User');
      expect(() =>
        RelayModernRecord.setValue(record, TYPENAME_KEY, 'not-User'),
      ).not.toWarn();
    });
  });

  describe('ActorChange Records', () => {
    it('should set/get value for the multi actor record', () => {
      const record = RelayModernRecord.create('1234', 'User');
      const actorID = getActorIdentifier('actor-1234');
      RelayModernRecord.setActorLinkedRecordID(
        record,
        'name',
        getActorIdentifier('actor-1234'),
        'Antonio',
      );
      expect(RelayModernRecord.getActorLinkedRecordID(record, 'name')).toEqual([
        actorID,
        'Antonio',
      ]);
    });

    it('should throw if unable to get actorID for the record', () => {
      const record = RelayModernRecord.create('1234', 'User');
      RelayModernRecord.setLinkedRecordID(record, 'name', 'ref-1');

      expect(() =>
        RelayModernRecord.getActorLinkedRecordID(record, 'name'),
      ).toThrowError(
        'RelayModernRecord.getActorLinkedRecordID(): Expected `1234.name`' +
          ' to be an actor specific linked ID, was `{"__ref":"ref-1"}`',
      );
    });
  });
});
