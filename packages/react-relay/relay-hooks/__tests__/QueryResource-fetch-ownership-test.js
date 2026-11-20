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

import type {GraphQLResponse, Sink} from 'relay-runtime';

const {getQueryResourceForEnvironment} = require('../QueryResource');
const gqlQuery = require('./__generated__/QueryResourceTest2Query.graphql');
const invariant = require('invariant');
const nullthrows = require('nullthrows');
const {Observable, createOperationDescriptor} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils-internal');

function captureSuspense(callback: () => unknown): Promise<unknown> {
  try {
    callback();
  } catch (value) {
    invariant(value instanceof Promise, 'Expected the query to suspend');
    return value;
  }
  throw new Error('Expected the query to suspend');
}

describe('QueryResource fetch ownership', () => {
  let environment;
  let resource;
  let operation;

  beforeEach(() => {
    environment = createMockEnvironment();
    resource = getQueryResourceForEnvironment(environment);
    operation = createOperationDescriptor(gqlQuery, {id: 'target'});
  });

  it.each(['next', 'error'])(
    'does not overwrite a replacement entry with an older fetch %s',
    async event => {
      let firstSink: ?Sink<GraphQLResponse>;
      const first = Observable.create<GraphQLResponse>(value => {
        firstSink = value;
      });
      const oldPending = captureSuspense(() =>
        resource.prepare(operation, first, 'network-only', 'full'),
      );
      const oldSettled = jest.fn();
      oldPending.then(oldSettled);
      jest.runAllTimers();

      let secondSink: ?Sink<GraphQLResponse>;
      const second = Observable.create<GraphQLResponse>(value => {
        secondSink = value;
      });
      const pending = captureSuspense(() =>
        resource.prepare(operation, second, 'network-only', 'full'),
      );
      const replacement = nullthrows(
        resource.TESTS_ONLY__getCacheEntry(operation, 'network-only', 'full'),
      );
      const replacementSettled = jest.fn();
      pending.then(replacementSettled);
      await Promise.resolve();
      expect(oldSettled).not.toHaveBeenCalled();
      expect(replacementSettled).not.toHaveBeenCalled();

      if (event === 'next') {
        nullthrows(firstSink).next({data: {}});
      } else {
        nullthrows(firstSink).error(new Error('Old fetch failed'));
      }

      await Promise.resolve();
      expect(oldSettled).toHaveBeenCalledTimes(1);
      expect(replacementSettled).not.toHaveBeenCalled();
      expect(replacement.getValue()).toBe(pending);

      const replacementError = new Error('Replacement fetch failed');
      if (event === 'next') {
        nullthrows(secondSink).next({data: {}});
      } else {
        nullthrows(secondSink).error(replacementError);
      }
      await Promise.resolve();
      expect(replacementSettled).toHaveBeenCalledTimes(1);
      if (event === 'next') {
        expect(replacement.getValue()).toMatchObject({
          operation,
          fragmentNode: operation.fragment.node,
        });
        expect(
          resource.prepare(operation, second, 'network-only', 'full'),
        ).toBe(replacement.getValue());
      } else {
        expect(replacement.getValue()).toBe(replacementError);
        expect(() =>
          resource.prepare(operation, second, 'network-only', 'full'),
        ).toThrow(replacementError);
      }
    },
  );

  it.each(['next', 'error'])(
    'settles the suspended render promise of a disposed entry after a late %s',
    async event => {
      let sink: ?Sink<GraphQLResponse>;
      const observable = Observable.create<GraphQLResponse>(value => {
        sink = value;
      });
      const pending = captureSuspense(() =>
        resource.prepare(operation, observable, 'network-only', 'full'),
      );
      const settled = jest.fn();
      pending.then(settled);
      // The temporary retain expires and disposes the entry.
      jest.runAllTimers();
      expect(
        resource.TESTS_ONLY__getCacheEntry(operation, 'network-only', 'full'),
      ).toBeUndefined();

      if (event === 'next') {
        nullthrows(sink).next({data: {}});
      } else {
        nullthrows(sink).error(new Error('Late error from disposed fetch'));
      }

      await Promise.resolve();
      expect(settled).toHaveBeenCalledTimes(1);
      expect(
        resource.TESTS_ONLY__getCacheEntry(operation, 'network-only', 'full'),
      ).toBeUndefined();
    },
  );

  it('settles the suspended render promise when a request completes without data', async () => {
    let sink: ?Sink<GraphQLResponse>;
    const observable = Observable.create<GraphQLResponse>(value => {
      sink = value;
    });
    const pending = captureSuspense(() =>
      resource.prepare(operation, observable, 'network-only', 'full'),
    );
    const settled = jest.fn();
    pending.then(settled);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();

    nullthrows(sink).complete();

    // A completion without a payload cannot rely on next to wake the render.
    await Promise.resolve();
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith(undefined);
  });
});
