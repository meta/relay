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

const RelayFeatureFlags = require('../RelayFeatureFlags');
const {hasCycle, stableCopy} = require('../stableCopy');

describe('stableCopy', () => {
  it('returns non-objects', () => {
    expect(stableCopy('foo')).toBe('foo');
    expect(stableCopy(1)).toBe(1);
    expect(stableCopy(-1)).toBe(-1);
    expect(stableCopy(true)).toBe(true);
    expect(stableCopy(false)).toBe(false);
    expect(stableCopy(null)).toBe(null);
    expect(stableCopy(undefined)).toBe(undefined);
  });

  it('copies empty objects', () => {
    expect(stableCopy({})).toEqual({});
  });

  it('copies empty arrays', () => {
    expect(stableCopy([])).toEqual([]);
  });

  it('copies shallow objects', () => {
    const object: {a?: number, b?: number} = {};
    object.a = 1;
    object.b = 2;
    expect(stableCopy(object)).toEqual(object);
    expect(JSON.stringify(stableCopy(object))).toEqual('{"a":1,"b":2}');
  });

  it('copies stably, despite opposite key insertion order', () => {
    const object: {a?: number, b?: number} = {};
    object.b = 2;
    object.a = 1;
    expect(stableCopy(object)).toEqual(object);
    expect(JSON.stringify(stableCopy(object))).toEqual('{"a":1,"b":2}');
  });

  it('copies shallow arrays', () => {
    const array = ['foo', 'bar', 'baz'];
    expect(stableCopy(array)).toEqual(array);
    expect(JSON.stringify(stableCopy(array))).toEqual('["foo","bar","baz"]');
  });

  it('copies sparse arrays', () => {
    const array = [];
    array[1] = 'foo';
    expect(stableCopy(array)).toEqual([undefined, 'foo']);
  });

  it('stable copies nested structures', () => {
    const object = {
      top2: {
        middle: {
          other: false,
          inner: [1, 'foo', ['bar', 2]],
        },
      },
      top1: [{first: true}, {first: false}, 'random'],
      misc: true,
      extra: null,
    };

    expect(stableCopy(object)).toEqual(object);

    expect(JSON.stringify(stableCopy(object))).toEqual(
      '{' +
        '"extra":null,' +
        '"misc":true,' +
        '"top1":[{"first":true},{"first":false},"random"],' +
        '"top2":{"middle":{"inner":[1,"foo",["bar",2]],"other":false}}' +
        '}',
    );
  });

  it('copies values that contain the same array twice (but not in a cycle', () => {
    const someArray = [1, 2];
    const object = {
      a: someArray,
      b: someArray,
    };
    expect(stableCopy(object)).toEqual(object);
  });

  it('copies values that contain the same object twice (but not in a cycle', () => {
    const someObj = {x: 1};
    const object = {
      a: someObj,
      b: someObj,
    };
    expect(stableCopy(object)).toEqual(object);
  });
});

describe('hasCycle', () => {
  it('detects no cycles in primitives', () => {
    expect(hasCycle('foo')).toBe(false);
    expect(hasCycle('')).toBe(false);
    expect(hasCycle(null)).toBe(false);
    expect(hasCycle(undefined)).toBe(false);
    expect(hasCycle(10)).toBe(false);
    expect(hasCycle(Infinity)).toBe(false);
  });

  it('reads ENABLE_PERF_QUERY once per call, not once per nested value', () => {
    const enabled = RelayFeatureFlags.ENABLE_PERF_QUERY;
    let reads = 0;
    Reflect.defineProperty(RelayFeatureFlags, 'ENABLE_PERF_QUERY', {
      configurable: true,
      enumerable: true,
      get() {
        reads++;
        return enabled;
      },
    });
    try {
      expect(hasCycle({a: {b: [1, {c: 2}]}, d: [3]})).toBe(false);
      expect(reads).toBe(1);
    } finally {
      Reflect.defineProperty(RelayFeatureFlags, 'ENABLE_PERF_QUERY', {
        configurable: true,
        enumerable: true,
        value: enabled,
        writable: true,
      });
    }
  });

  it('detects a cycle in a value that other values follow', () => {
    const value: {self?: unknown} = {};
    value.self = value;
    expect(hasCycle({x: value, y: 1})).toBe(true);
  });

  it("calls an array's own some() as the check without the flag does", () => {
    const array = [1];
    Reflect.defineProperty(array, 'some', {value: () => true});
    expect(hasCycle({a: array})).toBe(true);
  });

  it('does not detect multiple null or NaN as a cycle', () => {
    expect(hasCycle([null, null])).toBe(false);
    expect(hasCycle([NaN, NaN])).toBe(false);
  });

  it('does not detect multiple empty objects or arrays as a cycle', () => {
    expect(hasCycle([{}, {}])).toBe(false);
    expect(hasCycle([[], []])).toBe(false);
  });

  it('detects an object that is a child of itself as a cycle', () => {
    const a: $FlowFixMe = {};
    a.self = a;
    expect(hasCycle(a)).toBe(true);
  });
  it('detects an object that is an indireect child of itself as a cycle', () => {
    const a: $FlowFixMe = {};
    a.indirectSelf = {aAgain: a};
    expect(hasCycle(a)).toBe(true);
  });
  it('detects an array that contains itself as a cycle', () => {
    const a: $FlowFixMe = [];
    a.push(a);
    expect(hasCycle(a)).toBe(true);
  });
  it('detects an object that contains itself indirectly as a cycle', () => {
    const a: $FlowFixMe = [];
    a.push({indirectSelf: a});
    expect(hasCycle(a)).toBe(true);
  });
  it('does not try to detect cycles in complex objects like Maps or Sets', () => {
    const a: $FlowFixMe = new Set();
    a.add(a);
    expect(hasCycle(a)).toBe(false);

    const b: $FlowFixMe = new Map();
    b.set(b, b);
    expect(hasCycle(b)).toBe(false);
  });
  it('does not try to detect function with itself as a property as a cycle (what are you even doing!?)', () => {
    const a: $FlowFixMe = function noop() {};
    a.self = a;
    expect(hasCycle(a)).toBe(false);
  });
  it('does not detect cyle in values that contain the same array twice (but not in a cyle', () => {
    const someArray = [1, 2];
    const object = {
      a: someArray,
      b: someArray,
    };
    expect(hasCycle(object)).toBe(false);
  });

  it('does not detect cyle in value that contain the same object twice (but not in a cyle', () => {
    const someObj = {x: 1};
    const object = {
      a: someObj,
      b: someObj,
    };
    expect(hasCycle(object)).toBe(false);
  });
});

describe('hasCycle with parents', () => {
  it('treats the given parents as ancestors and leaves them unchanged', () => {
    const parent = {a: 1};
    const parents = new Set<unknown>([parent]);
    expect(hasCycle({child: parent}, parents)).toBe(true);
    expect(hasCycle({child: [{a: 1}]}, parents)).toBe(false);
    expect(Array.from(parents)).toEqual([parent]);
  });

  it('keeps the given parents for an array with its own some()', () => {
    const parent = {a: 1};
    const array = [parent];
    Reflect.defineProperty(array, 'some', {
      value: (callback: (item: unknown) => boolean) => [parent].some(callback),
    });
    expect(hasCycle({a: array}, new Set<unknown>([parent]))).toBe(true);
  });

  it('visits only the items an array had when its check started', () => {
    const array: Array<unknown> = [1];
    Reflect.defineProperty(array, '0', {
      enumerable: true,
      get() {
        array.push(array);
        return 1;
      },
    });
    expect(hasCycle({a: array})).toBe(false);
  });

  it('detects a cycle through arrays and objects below the root', () => {
    const inner: {self?: unknown} = {};
    const value = {list: [1, 'a', {inner}]};
    expect(hasCycle(value)).toBe(false);
    inner.self = value.list;
    expect(hasCycle(value)).toBe(true);
  });
});
