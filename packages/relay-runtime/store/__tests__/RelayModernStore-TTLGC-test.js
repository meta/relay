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

const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayModernRecord = require('../RelayModernRecord');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {ROOT_ID, ROOT_TYPE} = require('../RelayStoreUtils');
const NodeQuery = require('./__generated__/RelayModernStoreTest8Query.graphql');

const QUERY_CACHE_EXPIRATION_TIME = 1000;

describe.each([0, undefined])(
  'TTL garbage collection with release buffer size %s',
  gcReleaseBufferSize => {
    let currentTime: number;
    let schedulerQueue: Array<() => void>;
    let source;
    let store;

    function runNextScheduledJob(): void {
      const job = schedulerQueue.shift();
      expect(job).toBeDefined();
      if (job == null) {
        throw new Error('Expected a scheduled GC job');
      }
      job();
    }

    function runScheduledJobs(): void {
      let jobs = 0;
      while (schedulerQueue.length > 0) {
        runNextScheduledJob();
        if (++jobs > 1000) {
          throw new Error('GC did not finish in 1000 scheduler jobs');
        }
      }
    }

    function writeAndRetainNode(nodeID: string) {
      const operation = createOperationDescriptor(NodeQuery, {id: nodeID});
      const disposable = store.retain(operation);
      const rootRecord = RelayModernRecord.create(ROOT_ID, ROOT_TYPE);
      RelayModernRecord.setLinkedRecordID(
        rootRecord,
        `node(id:"${nodeID}")`,
        nodeID,
      );
      const nextSource = RelayRecordSource.create({
        [nodeID]: {__id: nodeID, __typename: 'User', id: nodeID},
      });
      nextSource.set(ROOT_ID, rootRecord);
      store.publish(nextSource);
      store.notify(operation);
      return {operation, disposable};
    }

    function evictFirstReleasedOperation(): void {
      // Omitting the option exercises the default ten-entry release buffer.
      // A zero-sized buffer has already evicted the first released operation.
      if (gcReleaseBufferSize == null) {
        for (let ii = 0; ii < 10; ii++) {
          writeAndRetainNode(`buffered-${ii}`).disposable.dispose();
        }
      }
    }

    beforeEach(() => {
      currentTime = 10000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
      schedulerQueue = [];
      source = RelayRecordSource.create();
      store = new RelayModernStore(source, {
        gcReleaseBufferSize,
        gcScheduler: job => {
          schedulerQueue.push(job);
        },
        queryCacheExpirationTime: QUERY_CACHE_EXPIRATION_TIME,
        shouldRetainWithinTTL_EXPERIMENTAL: true,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('preserves an expired operation retained after GC skipped it', () => {
      const {operation, disposable} = writeAndRetainNode('a');
      writeAndRetainNode('b');
      disposable.dispose();
      evictFirstReleasedOperation();
      currentTime += QUERY_CACHE_EXPIRATION_TIME;

      // GC skips expired A, marks retained B, and yields before sweeping.
      runNextScheduledJob();
      expect(source.has('a')).toBe(true);
      expect(store.lookup(operation.fragment).isMissingData).toBe(false);
      expect(store.check(operation).status).toBe('stale');
      const epoch = store.getEpoch();

      // Re-retaining without publishing must protect A in this same GC run.
      const retained = store.retain(operation);
      runScheduledJobs();

      expect(source.has('a')).toBe(true);
      expect(store.lookup(operation.fragment).isMissingData).toBe(false);
      expect(store.check(operation).status).toBe('stale');
      expect(store.getEpoch()).toBe(epoch);
      expect(source.has('b')).toBe(true);

      // A subsequent real release must still make A eligible for collection.
      retained.dispose();
      runScheduledJobs();
      expect(source.has('a')).toBe(false);
      expect(source.has('b')).toBe(true);
    });

    it('preserves released operations until their TTL expires', () => {
      const {operation, disposable} = writeAndRetainNode('a');
      writeAndRetainNode('b');
      disposable.dispose();
      evictFirstReleasedOperation();
      currentTime += QUERY_CACHE_EXPIRATION_TIME - 1;

      runScheduledJobs();

      expect(source.has('a')).toBe(true);
      expect(store.check(operation).status).toBe('available');
    });

    if (gcReleaseBufferSize == null) {
      it('preserves expired operations that remain in the release buffer', () => {
        const {operation, disposable} = writeAndRetainNode('a');
        const {disposable: disposableB} = writeAndRetainNode('b');
        disposable.dispose();
        currentTime += QUERY_CACHE_EXPIRATION_TIME;

        // Disposing stale B schedules GC without evicting A from the buffer.
        disposableB.dispose();
        runScheduledJobs();

        expect(source.has('a')).toBe(true);
        expect(store.lookup(operation.fragment).isMissingData).toBe(false);
        expect(source.has('b')).toBe(false);
      });
    }

    it('preserves data retained after a stale operation was disposed', () => {
      const {operation, disposable} = writeAndRetainNode('a');
      writeAndRetainNode('b');
      currentTime += QUERY_CACHE_EXPIRATION_TIME;
      // A stale release bypasses even the default release buffer.
      disposable.dispose();

      runNextScheduledJob();
      store.retain(operation);
      runScheduledJobs();

      expect(source.has('a')).toBe(true);
      expect(store.lookup(operation.fragment).isMissingData).toBe(false);
      expect(store.check(operation).status).toBe('stale');
    });
  },
);
