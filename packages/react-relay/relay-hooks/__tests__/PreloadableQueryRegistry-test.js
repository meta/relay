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

import type {ConcreteRequest} from 'relay-runtime';

const {PreloadableQueryRegistry} = require('relay-runtime');

// We don't actually make use of the internals of ConcreteRequest,
// so an empty object (that supports === equality) is enough.
const makeConcreteRequest = (): ConcreteRequest => ({}) as $FlowFixMe;

let count = 0;
const generateUniqueId = () => `id-${count++}`;

describe('PreloadableQueryRegistry', () => {
  describe('set and get', () => {
    it('should store preloadable concrete requests and return them', () => {
      const id1 = generateUniqueId();
      const c1 = makeConcreteRequest();
      expect(PreloadableQueryRegistry.get(id1)).not.toBeDefined();
      PreloadableQueryRegistry.set(id1, c1);
      expect(PreloadableQueryRegistry.get(id1)).toEqual(c1);

      const id2 = generateUniqueId();
      const c2 = makeConcreteRequest();
      expect(PreloadableQueryRegistry.get(id2)).not.toBeDefined();
      PreloadableQueryRegistry.set(id2, c2);
      expect(PreloadableQueryRegistry.get(id2)).toEqual(c2);
      expect(PreloadableQueryRegistry.get(id1)).toEqual(c1);
    });
  });

  describe('onLoad', () => {
    afterEach(() => {
      jest.resetModules();
    });
    it('should synchronously execute a callback when the ConcreteRequest given by the same key is loaded', () => {
      const callback = jest.fn<[ConcreteRequest], void>();
      const id1 = generateUniqueId();
      const c1 = makeConcreteRequest();
      PreloadableQueryRegistry.onLoad(id1, callback);
      expect(callback).not.toHaveBeenCalled();
      PreloadableQueryRegistry.set(id1, c1);
      expect(callback).toHaveBeenCalledTimes(1);

      const firstArgToCallback = callback.mock.calls[0][0];
      expect(firstArgToCallback).toEqual(c1);
    });

    it('dedupes callbacks passed to onLoad', () => {
      // the internal representation is a set.
      const callback = jest.fn<[ConcreteRequest], void>();
      const id1 = generateUniqueId();
      const c1 = makeConcreteRequest();
      PreloadableQueryRegistry.onLoad(id1, callback);
      PreloadableQueryRegistry.onLoad(id1, callback);
      PreloadableQueryRegistry.set(id1, c1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should execute the callback passed to onLoad callback many times', () => {
      const callback = jest.fn<[ConcreteRequest], void>();
      const id1 = generateUniqueId();
      const c1 = makeConcreteRequest();
      PreloadableQueryRegistry.onLoad(id1, callback);
      expect(callback).not.toHaveBeenCalled();
      PreloadableQueryRegistry.set(id1, c1);
      expect(callback).toHaveBeenCalledTimes(1);
      PreloadableQueryRegistry.set(id1, c1);
      expect(callback).toHaveBeenCalledTimes(2);
      PreloadableQueryRegistry.set(id1, c1);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should return a Disposable that, if executed, prevents the callback from being executed', () => {
      const callback = jest.fn<[ConcreteRequest], void>();
      const id1 = generateUniqueId();
      const c1 = makeConcreteRequest();
      const {dispose} = PreloadableQueryRegistry.onLoad(id1, callback);
      expect(callback).not.toHaveBeenCalled();
      /* $FlowFixMe[incompatible-type] Error exposed after fixing this typing
       * unsoundness in flow */
      dispose();
      PreloadableQueryRegistry.set(id1, c1);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple callbacks', () => {
      const cb1 = jest.fn<[ConcreteRequest], void>();
      const cb2 = jest.fn<[ConcreteRequest], void>();
      const id1 = generateUniqueId();
      const c1 = makeConcreteRequest();
      const {dispose} = PreloadableQueryRegistry.onLoad(id1, cb1);
      PreloadableQueryRegistry.onLoad(id1, cb2);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
      PreloadableQueryRegistry.set(id1, c1);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);

      /* $FlowFixMe[incompatible-type] Error exposed after fixing this typing
       * unsoundness in flow */
      dispose();
      PreloadableQueryRegistry.set(id1, c1);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(2);
    });

    it('should call a subsequent callback even if the previous threw an error', () => {
      const cb1 = jest.fn<[ConcreteRequest], empty>().mockImplementation(() => {
        throw new Error('error');
      });
      const cb2 = jest.fn<[ConcreteRequest], void>();
      const id1 = generateUniqueId();
      const c1 = makeConcreteRequest();
      PreloadableQueryRegistry.onLoad(id1, cb1);
      PreloadableQueryRegistry.onLoad(id1, cb2);
      PreloadableQueryRegistry.set(id1, c1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('should throw an error in the next tick after an uncaught error', () => {
      jest.useFakeTimers();
      const error = new Error('Not the droids you were looking for');
      const cb1 = jest.fn<[ConcreteRequest], empty>().mockImplementation(() => {
        throw error;
      });
      const id1 = generateUniqueId();
      const c1 = makeConcreteRequest();
      PreloadableQueryRegistry.onLoad(id1, cb1);
      expect(() => {
        PreloadableQueryRegistry.set(id1, c1);
      }).not.toThrow();
      expect(() => {
        jest.runAllTimers();
      }).toThrow(error);
    });
  });
});
