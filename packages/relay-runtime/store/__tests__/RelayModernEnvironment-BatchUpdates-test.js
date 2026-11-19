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

import type {LogEvent, Snapshot} from '../RelayStoreTypes';

const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const {fetchQuery} = require('../../query/fetchQueryInternal');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {ROOT_ID} = require('../RelayStoreUtils');
const {getPendingOperationsForFragment, graphql} = require('relay-runtime');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe('experimental_batchUpdates()', () => {
  it('notifies subscribers only once when multiple queries resolve in a batch', () => {
    const queryA = graphql`
      query RelayModernEnvironmentBatchUpdatesTestQuery1 {
        me {
          name
        }
      }
    `;
    const queryB = graphql`
      query RelayModernEnvironmentBatchUpdatesTestQuery2 {
        me {
          name
          emailAddresses
        }
      }
    `;

    const operationA = createOperationDescriptor(queryA, {});
    const operationB = createOperationDescriptor(queryB, {});

    const subjects: Array<$FlowFixMe> = [];
    const fetch = jest.fn((_query, _variables, _cacheConfig) =>
      RelayObservable.create(sink => {
        subjects.push(sink);
      }),
    );

    const logEvents: Array<LogEvent> = [];
    const log = (event: LogEvent) => {
      logEvents.push(event);
    };
    const source = RelayRecordSource.create();
    const store = new RelayModernStore(source, {log});
    const environment = new RelayModernEnvironment({
      // $FlowFixMe[invalid-tuple-arity]
      network: RelayNetwork.create(fetch),
      store,
      log,
    });

    // Subscribe to queryA's fragment to observe store updates
    const selector = createReaderSelector(
      queryA.fragment,
      ROOT_ID,
      {},
      operationA.request,
    );
    const snapshot = environment.lookup(selector);
    const callback = jest.fn<[Snapshot], void>();
    environment.subscribe(snapshot, callback);

    // Start executing both queries
    environment.execute({operation: operationA}).subscribe({});
    environment.execute({operation: operationB}).subscribe({});

    logEvents.length = 0;

    // Resolve both queries inside a batch
    environment.experimental_batchUpdates(() => {
      subjects[0].next({
        data: {
          me: {
            id: '842472',
            __typename: 'User',
            name: 'Alice',
          },
        },
      });
      subjects[1].next({
        data: {
          me: {
            id: '842472',
            __typename: 'User',
            name: 'Bob',
            emailAddresses: ['bob@example.com'],
          },
        },
      });
    });

    // The subscriber should have been notified exactly once,
    // with the final merged state from both queries.
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].data).toEqual({
      me: {
        name: 'Bob',
      },
    });

    // Verify batch wraps a single notify pass
    const storeEvents = logEvents
      .filter(e => e.name.startsWith('store.'))
      .map(e => e.name);
    expect(storeEvents).toEqual([
      'store.batch.start',
      // Two publishes occur during the batch, but notify is deferred
      'store.publish',
      'store.publish',
      // A single notify pass after the batch callback completes
      'store.notify.start',
      'store.notify.complete',
      'store.batch.complete',
    ]);

    // batch.complete includes the source operations and invalidateStore flag
    expect(logEvents.find(e => e.name === 'store.batch.complete')).toEqual({
      name: 'store.batch.complete',
      sourceOperations: [operationA, operationB],
      invalidateStore: false,
    });
  });

  it('records source operation epochs so check() returns available after global invalidation', () => {
    const query = graphql`
      query RelayModernEnvironmentBatchUpdatesTestQuery3 {
        me {
          name
        }
      }
    `;
    const operation = createOperationDescriptor(query, {});

    const subjects: Array<$FlowFixMe> = [];
    const fetch = jest.fn((_query, _variables, _cacheConfig) =>
      RelayObservable.create(sink => {
        subjects.push(sink);
      }),
    );

    const source = RelayRecordSource.create();
    const store = new RelayModernStore(source);
    const environment = new RelayModernEnvironment({
      // $FlowFixMe[invalid-tuple-arity]
      network: RelayNetwork.create(fetch),
      store,
    });

    // Invalidate the store globally
    environment.commitUpdate(storeProxy => {
      storeProxy.invalidateStore();
    });

    // Retain the operation, then fetch it inside a batch
    environment.retain(operation);
    environment.execute({operation}).subscribe({});

    const fetchTime = Date.now();
    jest.spyOn(global.Date, 'now').mockImplementation(() => fetchTime);

    environment.experimental_batchUpdates(() => {
      subjects[0].next({
        data: {
          me: {
            id: '842472',
            __typename: 'User',
            name: 'Alice',
          },
        },
      });
    });

    // check() should see the operation as available because its epoch
    // was recorded after the global invalidation.
    expect(environment.check(operation)).toEqual({
      status: 'available',
      fetchTime,
    });
  });

  it('a fragment still suspends on its own parent query during a batch', () => {
    const query = graphql`
      query RelayModernEnvironmentBatchUpdatesTestQuery4 {
        me {
          ...RelayModernEnvironmentBatchUpdatesTestFragment
        }
      }
    `;
    const fragment = graphql`
      fragment RelayModernEnvironmentBatchUpdatesTestFragment on User {
        name
      }
    `;
    const operation = createOperationDescriptor(query, {});

    const subjects: Array<$FlowFixMe> = [];
    const fetch = jest.fn((_query, _variables, _cacheConfig) =>
      RelayObservable.create(sink => {
        subjects.push(sink);
      }),
    );

    const source = RelayRecordSource.create();
    const store = new RelayModernStore(source);
    const environment = new RelayModernEnvironment({
      // $FlowFixMe[invalid-tuple-arity]
      network: RelayNetwork.create(fetch),
      store,
    });

    // Start the query via fetchQuery so it registers as an active request.
    // The fetch is in-flight but not yet resolved.
    environment.retain(operation);
    fetchQuery(environment, operation).subscribe({});

    // Inside a batch, the fragment should still report a pending operation
    // for its own parent query. This is the mechanism useFragment uses to
    // Suspend, and it works via getPromiseForActiveRequest — independent
    // of the OperationTracker.
    environment.experimental_batchUpdates(() => {
      const pending = getPendingOperationsForFragment(
        environment,
        fragment,
        operation.request,
      );
      expect(pending).not.toBeNull();
      expect(pending?.pendingOperations).toEqual([operation.request]);
    });
  });
});
