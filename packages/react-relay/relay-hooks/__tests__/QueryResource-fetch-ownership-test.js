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
const {
  __internal: {fetchQuery},
  Observable,
  RecordSource,
  Store,
  createOperationDescriptor,
} = require('relay-runtime');
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

describe('QueryResource fetch ownership and GC recovery', () => {
  let environment;
  let resource;
  let operation;
  let store;
  let gcTasks: Array<() => void>;

  beforeEach(() => {
    // Exercise the normal release buffer, rather than forcing buffer size zero.
    gcTasks = [];
    store = new Store(new RecordSource(), {
      gcScheduler: task => {
        gcTasks.push(task);
      },
    });
    environment = createMockEnvironment({store});
    resource = getQueryResourceForEnvironment(environment);
    operation = createOperationDescriptor(gqlQuery, {id: 'target'});
  });

  it('refetches on revisit after a late payload and normal release-buffer churn', () => {
    const result = resource.prepare(
      operation,
      fetchQuery(environment, operation),
      'store-and-network',
      'partial',
    );
    const retained = resource.retain(result);
    retained.dispose();

    environment.mock.resolve(operation, {
      data: {
        node: {__typename: 'User', id: 'target', name: 'Before navigation'},
      },
    });
    expect(store.getSource().get('target')).toBeDefined();

    // Ten other releases evict the target operation from the default buffer.
    for (let index = 0; index < 10; index++) {
      const id = 'other-' + index;
      const other = createOperationDescriptor(gqlQuery, {id});
      const retain = environment.retain(other);
      environment.commitPayload(other, {
        node: {__typename: 'User', id, name: id},
      });
      retain.dispose();
    }
    while (gcTasks.length > 0) {
      nullthrows(gcTasks.shift())();
    }
    expect(store.getSource().get('target')).toBeUndefined();
    expect(environment.check(operation).status).toBe('missing');

    resource.prepare(
      operation,
      fetchQuery(environment, operation),
      'store-and-network',
      'partial',
    );
    expect(environment.mock.isLoading(gqlQuery, {id: 'target'})).toBe(true);

    environment.mock.resolve(operation, {
      data: {node: {__typename: 'User', id: 'target', name: 'After revisit'}},
    });
    expect(environment.lookup(operation.fragment).data).toMatchObject({
      node: {name: 'After revisit'},
    });
  });

  it.each(['next', 'error'])(
    'does not recreate a disposed entry after late %s',
    event => {
      let sink: ?Sink<GraphQLResponse>;
      const observable = Observable.create<GraphQLResponse>(value => {
        sink = value;
      });
      captureSuspense(() =>
        resource.prepare(operation, observable, 'network-only', 'full'),
      );
      jest.runAllTimers();
      expect(
        resource.TESTS_ONLY__getCacheEntry(operation, 'network-only', 'full'),
      ).toBeUndefined();

      if (event === 'next') {
        nullthrows(sink).next({data: {}});
      } else {
        nullthrows(sink).error(new Error('Late error from retired fetch'));
      }

      expect(
        resource.TESTS_ONLY__getCacheEntry(operation, 'network-only', 'full'),
      ).toBeUndefined();
    },
  );

  it('delivers a shared in-flight request to a separately retained entry', () => {
    const firstResult = resource.prepare(
      operation,
      fetchQuery(environment, operation),
      'store-and-network',
      'partial',
    );
    resource.retain(firstResult).dispose();
    const observer = {next: jest.fn(), complete: jest.fn()};
    const secondResult = resource.prepare(
      operation,
      fetchQuery(environment, operation),
      'store-and-network',
      'partial',
      observer,
      'replacement',
    );
    const retained = resource.retain(secondResult);
    expect(environment.mock.getAllOperations()).toHaveLength(1);
    expect(observer.next).not.toHaveBeenCalled();
    expect(observer.complete).not.toHaveBeenCalled();

    environment.mock.resolve(operation, {
      data: {node: {__typename: 'User', id: 'target', name: 'Shared result'}},
    });

    expect(
      resource.TESTS_ONLY__getCacheEntry(
        operation,
        'store-and-network',
        'partial',
      ),
    ).toBeUndefined();
    expect(
      nullthrows(
        resource.TESTS_ONLY__getCacheEntry(
          operation,
          'store-and-network',
          'partial',
          'replacement',
        ),
      ).getValue(),
    ).toEqual(secondResult);
    expect(observer.next).toHaveBeenCalledTimes(1);
    expect(observer.next.mock.calls[0][0]).toMatchObject({
      isMissingData: false,
      data: {node: {id: 'target', name: 'Shared result'}},
    });
    expect(observer.complete).toHaveBeenCalledTimes(1);
    expect(environment.lookup(operation.fragment).data).toMatchObject({
      node: {name: 'Shared result'},
    });
    retained.dispose();
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
