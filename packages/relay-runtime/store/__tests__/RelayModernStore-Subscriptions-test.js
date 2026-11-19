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
import type {Snapshot} from '../RelayStoreTypes';
import type {
  RelayModernStoreSubscriptionsTest1Fragment$data,
  RelayModernStoreSubscriptionsTest1Fragment$fragmentType,
} from './__generated__/RelayModernStoreSubscriptionsTest1Fragment.graphql';
import type {
  RelayModernStoreSubscriptionsTest1Query$data,
  RelayModernStoreSubscriptionsTest1Query$variables,
} from './__generated__/RelayModernStoreSubscriptionsTest1Query.graphql';
import type {
  RelayModernStoreSubscriptionsTest2Fragment$data,
  RelayModernStoreSubscriptionsTest2Fragment$fragmentType,
} from './__generated__/RelayModernStoreSubscriptionsTest2Fragment.graphql';
import type {
  RelayModernStoreSubscriptionsTest2Query$data,
  RelayModernStoreSubscriptionsTest2Query$variables,
} from './__generated__/RelayModernStoreSubscriptionsTest2Query.graphql';
import type {SelectorData} from 'relay-runtime/store/RelayStoreTypes';
import type {LogEvent} from 'relay-runtime/store/RelayStoreTypes';
import type {Fragment, Query} from 'relay-runtime/util/RelayRuntimeTypes';

const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayModernRecord = require('../RelayModernRecord');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayOptimisticRecordSource = require('../RelayOptimisticRecordSource');
const RelayRecordSource = require('../RelayRecordSource');
const {INVALIDATED_AT_KEY, REF_KEY} = require('../RelayStoreUtils');

function assertIsDeeplyFrozen(value: ?{...} | ?ReadonlyArray<{...}>): void {
  if (!value) {
    throw new Error(
      'Expected value to be a non-null object or array of objects',
    );
  }
  expect(Object.isFrozen(value)).toBe(true);
  if (Array.isArray(value)) {
    value.forEach(item => assertIsDeeplyFrozen(item));
    /* $FlowFixMe[invalid-compare] Error discovered during Constant Condition
     * roll out. See https://fburl.com/workplace/5whu3i34. */
  } else if (typeof value === 'object' && value !== null) {
    for (const key in value) {
      // $FlowFixMe[invalid-computed-prop]
      assertIsDeeplyFrozen(value[key]);
    }
  }
}

function cloneEventWithSets(event: LogEvent) {
  const nextEvent = {};
  for (const key in event) {
    if (event.hasOwnProperty(key)) {
      // $FlowFixMe[invalid-computed-prop]
      const val = event[key];
      if (val instanceof Set) {
        // $FlowFixMe[prop-missing]
        nextEvent[key] = new Set(val);
      } else {
        // $FlowFixMe[prop-missing]
        nextEvent[key] = val;
      }
    }
  }
  return nextEvent;
}

[
  [(data: $FlowFixMe) => new RelayRecordSource(data), 'Map', true],
  [(data: $FlowFixMe) => new RelayRecordSource(data), 'Map', false],
  [
    (data: $FlowFixMe) =>
      RelayOptimisticRecordSource.create(new RelayRecordSource(data)),
    'Optimistic',
    true,
  ],
  [
    (data: $FlowFixMe) =>
      RelayOptimisticRecordSource.create(new RelayRecordSource(data)),
    'Optimistic',
    false,
  ],
].forEach(
  ([getRecordSourceImplementation, ImplementationName, optimizeNotify]) => {
    const defaultOptimizeNotify = RelayFeatureFlags.OPTIMIZE_NOTIFY;
    beforeEach(() => {
      RelayFeatureFlags.OPTIMIZE_NOTIFY = optimizeNotify;
      RelayFeatureFlags.ENABLE_READER_FRAGMENTS_LOGGING = true;
    });

    afterEach(() => {
      RelayFeatureFlags.OPTIMIZE_NOTIFY = defaultOptimizeNotify;
      RelayFeatureFlags.ENABLE_READER_FRAGMENTS_LOGGING = false;
    });
    describe(`Relay Store with ${ImplementationName} Record Source`, () => {
      describe('notify/publish/subscribe', () => {
        let UserQuery:
          | Query<
              RelayModernStoreSubscriptionsTest1Query$variables,
              RelayModernStoreSubscriptionsTest1Query$data,
            >
          | Query<
              RelayModernStoreSubscriptionsTest2Query$variables,
              RelayModernStoreSubscriptionsTest2Query$data,
            >;
        let UserFragment:
          | Fragment<
              RelayModernStoreSubscriptionsTest1Fragment$fragmentType,
              RelayModernStoreSubscriptionsTest1Fragment$data,
            >
          | Fragment<
              RelayModernStoreSubscriptionsTest2Fragment$fragmentType,
              RelayModernStoreSubscriptionsTest2Fragment$data,
            >;
        let data;
        let source;
        let store;
        let logEvents;

        beforeEach(() => {
          data = {
            '4': {
              __id: '4',
              __typename: 'User',
              emailAddresses: ['a@b.com'],
              id: '4',
              name: 'Zuck',
              'profilePicture(size:32)': {[REF_KEY]: 'client:1'},
            },
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo1.jpg',
            },
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              me: {__ref: '4'},
              'node(id:"4")': {__ref: '4'},
            },
          };
          logEvents = [] as Array<
            $FlowFixMe | {...} | {data: ?SelectorData, kind: string},
          >;
          source = getRecordSourceImplementation(data);
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            log: event => {
              logEvents.push(cloneEventWithSets(event));
            },
          });
          UserFragment = graphql`
            fragment RelayModernStoreSubscriptionsTest1Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
              emailAddresses
            }
          `;
          UserQuery = graphql`
            query RelayModernStoreSubscriptionsTest1Query($size: [Int]) {
              me {
                ...RelayModernStoreSubscriptionsTest1Fragment
              }
            }
          `;
        });

        it('calls subscribers whose data has changed since previous notify', () => {
          // subscribe(), publish(), notify() -> subscriber called
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          store.subscribe(snapshot, callback);
          // Publish a change to profilePicture.uri
          const nextSource = getRecordSourceImplementation({
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo2.jpg',
            },
          });
          store.publish(nextSource);
          expect(callback).not.toBeCalled();
          store.notify();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0]).toEqual({
            ...snapshot,
            data: {
              emailAddresses: ['a@b.com'],
              name: 'Zuck',
              profilePicture: {
                uri: 'https://photo2.jpg', // new uri
              },
            },
            seenRecords: new Set(['client:1', '4']),
          });
        });

        it('calls subscribers and reads data with fragment owner if one is available in subscription snapshot', () => {
          // subscribe(), publish(), notify() -> subscriber called
          UserQuery = graphql`
            query RelayModernStoreSubscriptionsTest2Query($size: [Int]!) {
              me {
                ...RelayModernStoreSubscriptionsTest2Fragment
              }
            }
          `;
          UserFragment = graphql`
            fragment RelayModernStoreSubscriptionsTest2Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
              emailAddresses
            }
          `;

          const owner = createOperationDescriptor(UserQuery, {size: 32});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          expect(snapshot.selector).toBe(selector);

          const callback = jest.fn<[Snapshot], void>();
          store.subscribe(snapshot, callback);
          // Publish a change to profilePicture.uri
          const nextSource = getRecordSourceImplementation({
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo2.jpg',
            },
          });
          store.publish(nextSource);
          expect(callback).not.toBeCalled();
          store.notify();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0]).toEqual({
            ...snapshot,
            data: {
              emailAddresses: ['a@b.com'],
              name: 'Zuck',
              profilePicture: {
                uri: 'https://photo2.jpg', // new uri
              },
            },
            seenRecords: new Set(['client:1', '4']),
          });
          expect(callback.mock.calls[0][0].selector).toBe(selector);
        });

        it('vends deeply-frozen objects', () => {
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          store.subscribe(snapshot, callback);
          // Publish a change to profilePicture.uri
          const nextSource = getRecordSourceImplementation({
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo2.jpg',
            },
          });
          store.publish(nextSource);
          store.notify();
          expect(callback.mock.calls.length).toBe(1);
          const nextSnapshot = callback.mock.calls[0][0];
          expect(Object.isFrozen(nextSnapshot)).toBe(true);
          assertIsDeeplyFrozen(nextSnapshot.data);
          assertIsDeeplyFrozen(nextSnapshot.selector.variables);
        });

        it('calls affected subscribers only once', () => {
          // subscribe(), publish(), publish(), notify() -> subscriber called once
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          store.subscribe(snapshot, callback);
          // Publish a change to profilePicture.uri
          let nextSource = getRecordSourceImplementation({
            '4': {
              __id: '4',
              __typename: 'User',
              emailAddresses: ['a@b.com', 'c@d.net'],
              name: 'Mark',
            },
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo2.jpg',
            },
          });
          store.publish(nextSource);
          nextSource = getRecordSourceImplementation({
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo3.jpg',
            },
          });
          store.publish(nextSource);
          expect(callback).not.toBeCalled();
          store.notify();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0]).toEqual({
            ...snapshot,
            data: {
              emailAddresses: ['a@b.com', 'c@d.net'],
              name: 'Mark',
              profilePicture: {
                uri: 'https://photo3.jpg', // most recent uri
              },
            },
            seenRecords: new Set(['client:1', '4']),
          });
        });

        it('notifies subscribers and sets updated value for isMissingData', () => {
          const dataObj = {
            '4': {
              __id: '4',
              __typename: 'User',
              id: '4',
              name: 'Zuck',
              'profilePicture(size:32)': {[REF_KEY]: 'client:1'},
            },
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo1.jpg',
            },
          };
          source = getRecordSourceImplementation(dataObj);
          store = new RelayModernStore(source);
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          expect(snapshot.isMissingData).toEqual(true);

          const callback = jest.fn<[Snapshot], void>();
          // Record does not exist when subscribed
          store.subscribe(snapshot, callback);
          const nextSource = getRecordSourceImplementation({
            '4': {
              __id: '4',
              __typename: 'User',
              emailAddresses: ['a@b.com'],
            },
          });
          store.publish(nextSource);
          store.notify();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0]).toEqual({
            ...snapshot,
            data: {
              emailAddresses: ['a@b.com'],
              name: 'Zuck',
              profilePicture: {
                uri: 'https://photo1.jpg',
              },
            },
            fieldErrors: null,
            isMissingData: false,
            missingLiveResolverFields: [],
            seenRecords: new Set(['client:1', '4']),
          });
        });

        it('notifies subscribers of changes to unfetched records', () => {
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '842472',
            {
              size: 32,
            },
            owner.request,
          );
          const snapshot = store.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          // Record does not exist when subscribed
          store.subscribe(snapshot, callback);
          const nextSource = getRecordSourceImplementation({
            '842472': {
              __id: '842472',
              __typename: 'User',
              name: 'Joe',
            },
          });
          store.publish(nextSource);
          store.notify();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0]).toEqual({
            ...snapshot,
            data: {
              name: 'Joe',
              profilePicture: undefined,
            },
            fieldErrors: [
              {
                fieldPath: 'profilePicture',
                kind: 'missing_expected_data.log',
                owner: 'RelayModernStoreSubscriptionsTest1Fragment',
              },
              {
                fieldPath: 'emailAddresses',
                kind: 'missing_expected_data.log',
                owner: 'RelayModernStoreSubscriptionsTest1Fragment',
              },
            ],
            isMissingData: true,
            missingLiveResolverFields: [],
            seenRecords: new Set(Object.keys(nextSource.toJSON())),
          });
        });

        it('notifies subscribers of changes to deleted records', () => {
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '842472',
            {
              size: 32,
            },
            owner.request,
          );
          // Initially delete the record
          source.delete('842472');
          const snapshot = store.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          // Record does not exist when subscribed
          store.subscribe(snapshot, callback);
          // Create it again
          const nextSource = getRecordSourceImplementation({
            '842472': {
              __id: '842472',
              __typename: 'User',
              name: 'Joe',
            },
          });
          store.publish(nextSource);
          store.notify();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0]).toEqual({
            ...snapshot,
            data: {
              name: 'Joe',
              profilePicture: undefined,
            },
            fieldErrors: [
              {
                fieldPath: 'profilePicture',
                kind: 'missing_expected_data.log',
                owner: 'RelayModernStoreSubscriptionsTest1Fragment',
              },
              {
                fieldPath: 'emailAddresses',
                kind: 'missing_expected_data.log',
                owner: 'RelayModernStoreSubscriptionsTest1Fragment',
              },
            ],
            isMissingData: true,
            missingLiveResolverFields: [],
            seenRecords: new Set(['842472']),
          });
        });

        it('does not call subscribers whose data has not changed', () => {
          // subscribe(), publish() -> subscriber *not* called
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          store.subscribe(snapshot, callback);
          // Publish a change to profilePicture.uri
          const nextSource = getRecordSourceImplementation({
            '842472': {
              __id: '842472',
              __typename: 'User',
              name: 'Joe',
            },
          });
          store.publish(nextSource);
          store.notify();
          expect(callback).not.toBeCalled();
        });

        it('does not notify disposed subscribers', () => {
          // subscribe(), publish(), dispose(), notify() -> subscriber *not* called
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          const callback = jest.fn<[Snapshot], void>();
          const {dispose} = store.subscribe(snapshot, callback);
          // Publish a change to profilePicture.uri
          const nextSource = getRecordSourceImplementation({
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo2.jpg',
            },
          });
          store.publish(nextSource);
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          dispose();
          store.notify();
          expect(callback).not.toBeCalled();
        });

        it('throws if source records are modified', () => {
          const zuck = source.get('4');
          expect(zuck).toBeTruthy();
          expect(() => {
            // $FlowFixMe[incompatible-type]
            RelayModernRecord.setValue(zuck, 'pet', 'Beast');
          }).toThrow(TypeError);
        });

        it('throws if published records are modified', () => {
          // Create and publish a source with a new record
          const nextSource = getRecordSourceImplementation();
          const beast = RelayModernRecord.create('beast', 'Pet');
          nextSource.set('beast', beast);
          store.publish(nextSource);
          expect(() => {
            RelayModernRecord.setValue(beast, 'name', 'Beast');
          }).toThrow(TypeError);
        });

        it('throws if updated records are modified', () => {
          // Create and publish a source with a record of the same id
          const nextSource = getRecordSourceImplementation();
          const beast = RelayModernRecord.create('beast', 'Pet');
          nextSource.set('beast', beast);
          const zuck = RelayModernRecord.create('4', 'User');
          RelayModernRecord.setLinkedRecordID(zuck, 'pet', 'beast');
          nextSource.set('4', zuck);
          store.publish(nextSource);

          // Cannot modify merged record
          expect(() => {
            const mergedRecord = source.get('4');
            expect(mergedRecord).toBeTruthy();
            // $FlowFixMe[incompatible-type]
            RelayModernRecord.setValue(mergedRecord, 'pet', null);
          }).toThrow(TypeError);
          // Cannot modify the published record, even though it isn't in the store
          // This is for consistency because it is non-deterinistic if published
          // records will be merged into a new object or used as-is.
          expect(() => {
            RelayModernRecord.setValue(zuck, 'pet', null);
          }).toThrow(TypeError);
        });

        describe('with data invalidation', () => {
          it('correctly invalidates store when store is globally invalidated', () => {
            const owner = createOperationDescriptor(UserQuery, {
              id: '4',
              size: 32,
            });
            const selector = createReaderSelector(
              UserFragment,
              '4',
              {size: 32},
              owner.request,
            );
            const snapshot = store.lookup(selector);
            const callback = jest.fn<[Snapshot], void>();
            store.subscribe(snapshot, callback);
            // Publish a change to profilePicture.uri
            const nextSource = getRecordSourceImplementation({
              'client:1': {
                __id: 'client:1',
                uri: 'https://photo2.jpg',
              },
            });
            store.publish(
              nextSource,
              new Set(), // indicate that no individual ids were invalidated
            );
            store.notify(
              owner,
              true, // indicate that store should be globally invalidated
            );
            // Results are asserted in earlier tests

            expect(store.check(owner)).toEqual({status: 'stale'});
          });

          it('correctly invalidates individual records', () => {
            const owner = createOperationDescriptor(UserQuery, {
              id: '4',
              size: 32,
            });
            const selector = createReaderSelector(
              UserFragment,
              '4',
              {size: 32},
              owner.request,
            );
            const snapshot = store.lookup(selector);
            const callback = jest.fn<[Snapshot], void>();
            store.subscribe(snapshot, callback);
            // Publish a change to profilePicture.uri
            const nextSource = getRecordSourceImplementation({
              'client:1': {
                __id: 'client:1',
                uri: 'https://photo2.jpg',
              },
            });
            store.publish(
              nextSource,
              new Set(['client:1']), // indicate that this id was invalidated
            );
            store.notify(owner, false);
            // Results are asserted in earlier tests

            const record = store.getSource().get('client:1');
            if (!record) {
              throw new Error('Expected to find record with id client:1');
            }
            expect(
              RelayModernRecord.getValue(record, INVALIDATED_AT_KEY),
            ).toEqual(1);
            expect(store.check(owner)).toEqual({status: 'stale'});
          });

          it("correctly invalidates records even when they weren't modified in the source being published", () => {
            const owner = createOperationDescriptor(UserQuery, {
              id: '4',
              size: 32,
            });
            const selector = createReaderSelector(
              UserFragment,
              '4',
              {size: 32},
              owner.request,
            );
            const snapshot = store.lookup(selector);
            const callback = jest.fn<[Snapshot], void>();
            store.subscribe(snapshot, callback);
            // Publish a change to profilePicture.uri
            const nextSource = getRecordSourceImplementation({
              'client:1': {
                __id: 'client:1',
                uri: 'https://photo2.jpg',
              },
            });
            store.publish(
              nextSource,
              new Set(['4']), // indicate that this id was invalidated
            );
            store.notify(owner, false);
            // Results are asserted in earlier tests

            const record = store.getSource().get('4');
            if (!record) {
              throw new Error('Expected to find record with id "4"');
            }
            expect(
              RelayModernRecord.getValue(record, INVALIDATED_AT_KEY),
            ).toEqual(1);
            expect(store.check(owner)).toEqual({status: 'stale'});
          });
        });

        it('emits log events for publish and notify', () => {
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          expect(logEvents).toMatchObject([
            {name: 'store.lookup.start'},
            {name: 'reader.read'},
            {name: 'store.lookup.end'},
          ]);
          logEvents.length = 0;
          const callback = jest.fn((nextSnapshot: Snapshot) => {
            logEvents.push({
              data: nextSnapshot.data,
              kind: 'test_only_callback',
            });
          });
          store.subscribe(snapshot, callback);

          const nextSource = getRecordSourceImplementation({
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo2.jpg',
            },
          });
          store.publish(nextSource);
          expect(logEvents).toEqual([
            {name: 'store.publish', optimistic: false, source: nextSource},
          ]);
          expect(callback).toBeCalledTimes(0);
          logEvents.length = 0;
          store.notify();
          expect(logEvents).toEqual([
            {
              name: 'store.notify.start',
              sourceOperation: undefined,
            },
            // callbacks occur after notify.start...
            {
              name: 'reader.read',
              selector,
            },
            {
              data: {
                emailAddresses: ['a@b.com'],
                name: 'Zuck',
                profilePicture: {uri: 'https://photo2.jpg'},
              },
              // not a real LogEvent, this is for testing only
              kind: 'test_only_callback',
            },
            // ...and before notify.complete
            {
              invalidatedRecordIDs: new Set(),
              name: 'store.notify.complete',
              sourceOperation: undefined,
              subscriptionsSize: 1,
              updatedOwners: [owner.request],
              updatedRecordIDs: new Set(['client:1']),
            },
          ]);
          expect(callback).toBeCalledTimes(1);
        });

        describe('with subscription notifications enabled', () => {
          beforeAll(() => {
            RelayFeatureFlags.ENABLE_NOTIFY_SUBSCRIPTION = true;
          });

          afterAll(() => {
            RelayFeatureFlags.ENABLE_NOTIFY_SUBSCRIPTION = false;
          });

          it('emits log events for publish and notify', () => {
            const owner = createOperationDescriptor(UserQuery, {});
            const selector = createReaderSelector(
              UserFragment,
              '4',
              {size: 32},
              owner.request,
            );
            const snapshot = store.lookup(selector);
            expect(logEvents).toMatchObject([
              {name: 'store.lookup.start'},
              {name: 'reader.read'},
              {name: 'store.lookup.end'},
            ]);
            logEvents.length = 0;
            const callback = jest.fn((nextSnapshot: Snapshot) => {
              logEvents.push({
                data: nextSnapshot.data,
                kind: 'test_only_callback',
              });
            });
            store.subscribe(snapshot, callback);

            const nextSource = getRecordSourceImplementation({
              'client:1': {
                __id: 'client:1',
                uri: 'https://photo2.jpg',
              },
            });
            store.publish(nextSource);
            expect(logEvents).toEqual([
              {name: 'store.publish', optimistic: false, source: nextSource},
            ]);
            expect(callback).toBeCalledTimes(0);
            logEvents.length = 0;
            store.notify(owner);
            expect(logEvents).toEqual([
              {
                name: 'store.notify.start',
                sourceOperation: owner,
              },
              // callbacks occur after notify.start...
              {
                name: 'reader.read',
                selector,
              },
              {
                name: 'store.notify.subscription',
                nextSnapshot: expect.objectContaining({
                  data: {
                    emailAddresses: ['a@b.com'],
                    name: 'Zuck',
                    profilePicture: {uri: 'https://photo2.jpg'},
                  },
                  selector,
                }),
                snapshot: expect.objectContaining({
                  data: {
                    emailAddresses: ['a@b.com'],
                    name: 'Zuck',
                    profilePicture: {uri: 'https://photo1.jpg'},
                  },
                  selector,
                }),
                sourceOperation: owner,
              },
              {
                data: {
                  emailAddresses: ['a@b.com'],
                  name: 'Zuck',
                  profilePicture: {uri: 'https://photo2.jpg'},
                },
                // not a real LogEvent, this is for testing only
                kind: 'test_only_callback',
              },
              // ...and before notify.complete
              {
                invalidatedRecordIDs: new Set(),
                name: 'store.notify.complete',
                sourceOperation: owner,
                subscriptionsSize: 1,
                updatedOwners: [owner.request],
                updatedRecordIDs: new Set(['client:1']),
              },
            ]);
            expect(callback).toBeCalledTimes(1);
          });
        });
      });
    });
  },
);
