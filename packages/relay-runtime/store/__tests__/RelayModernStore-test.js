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
import type {Disposable} from '../../util/RelayRuntimeTypes';
import type {Snapshot} from '../RelayStoreTypes';
import type {
  RelayModernStoreTest2Fragment$data,
  RelayModernStoreTest2Fragment$fragmentType,
} from './__generated__/RelayModernStoreTest2Fragment.graphql';
import type {
  RelayModernStoreTest3Fragment$data,
  RelayModernStoreTest3Fragment$fragmentType,
} from './__generated__/RelayModernStoreTest3Fragment.graphql';
import type {
  RelayModernStoreTest5Fragment$data,
  RelayModernStoreTest5Fragment$fragmentType,
} from './__generated__/RelayModernStoreTest5Fragment.graphql';
import type {
  RelayModernStoreTest6Fragment$data,
  RelayModernStoreTest6Fragment$fragmentType,
} from './__generated__/RelayModernStoreTest6Fragment.graphql';
import type {SelectorData} from 'relay-runtime/store/RelayStoreTypes';
import type {LogEvent} from 'relay-runtime/store/RelayStoreTypes';
import type {Fragment} from 'relay-runtime/util/RelayRuntimeTypes';

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
const {
  INVALIDATED_AT_KEY,
  REF_KEY,
  ROOT_ID,
  ROOT_TYPE,
} = require('../RelayStoreUtils');
const {
  createMockEnvironment,
  injectPromisePolyfill__DEPRECATED,
  simpleClone,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();

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

    describe(`Relay Store with ${ImplementationName} Record Source${optimizeNotify ? ' , optimize notify' : ''}`, () => {
      describe('constructor', () => {
        it('creates the root record upon store initialization', () => {
          const source = getRecordSourceImplementation({});
          const store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
          });
          expect(store.getSource().get(ROOT_ID)).toEqual({
            __id: ROOT_ID,
            __typename: ROOT_TYPE,
          });
          expect(store.getSource().toJSON()).toEqual({
            [ROOT_ID]: {
              __id: ROOT_ID,
              __typename: ROOT_TYPE,
            },
          });
        });
      });

      describe('retain()', () => {
        let UserQuery;
        let data;
        let initialData;
        let source;
        let store;

        beforeEach(() => {
          data = {
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
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              'node(id:"4")': {__ref: '4'},
            },
          };
          initialData = simpleClone(data);
          source = getRecordSourceImplementation(data);
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            queryCacheExpirationTime: 0,
          });
          UserQuery = graphql`
            query RelayModernStoreTest1Query($id: ID!, $size: [Int]) {
              node(id: $id) {
                ...RelayModernStoreTest1Fragment @dangerously_unaliased_fixme
              }
            }
          `;
          graphql`
            fragment RelayModernStoreTest1Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
            }
          `;
        });

        it('prevents data from being collected', () => {
          store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);
        });

        it('frees data when disposed', () => {
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose} = store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          dispose();
          expect(data).toEqual(initialData);
          jest.runAllTimers();
          expect(source.toJSON()).toEqual({
            [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE},
          });
        });

        it('only collects unreferenced data', () => {
          const JoeQuery = graphql`
            query RelayModernStoreTestJoeQuery($id: ID!) {
              ...RelayModernStoreTestJoeFragment @arguments(id: $id)
            }
          `;
          graphql`
            fragment RelayModernStoreTestJoeFragment on Query
            @argumentDefinitions(id: {type: "ID"}) {
              node(id: $id) {
                ... on User {
                  name
                }
              }
            }
          `;
          const nextSource = getRecordSourceImplementation({
            '842472': {
              __id: '842472',
              __typename: 'User',
              name: 'Joe',
            },
            [ROOT_ID]: {
              __id: ROOT_ID,
              __typename: ROOT_TYPE,
              'node(id:"4")': {[REF_KEY]: '4'},
              'node(id:"842472")': {[REF_KEY]: '842472'},
            },
          });
          store.publish(nextSource);
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose} = store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );
          store.retain(createOperationDescriptor(JoeQuery, {id: '842472'}));

          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          dispose(); // release one of the holds but not the other
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(nextSource.toJSON());
        });
      });

      describe('lookup()', () => {
        let UserQuery;
        let UserFragment:
          | Fragment<
              RelayModernStoreTest2Fragment$fragmentType,
              RelayModernStoreTest2Fragment$data,
            >
          | Fragment<
              RelayModernStoreTest3Fragment$fragmentType,
              RelayModernStoreTest3Fragment$data,
            >;
        let data;
        let source;
        let store;

        beforeEach(() => {
          data = {
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
          source = getRecordSourceImplementation(data);
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
          });
          UserFragment = graphql`
            fragment RelayModernStoreTest2Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
            }
          `;
          UserQuery = graphql`
            query RelayModernStoreTest2Query($size: [Int]) {
              me {
                ...RelayModernStoreTest2Fragment
              }
            }
          `;
        });

        it('returns selector data', () => {
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          expect(snapshot).toEqual({
            data: {
              name: 'Zuck',
              profilePicture: {
                uri: 'https://photo1.jpg',
              },
            },
            fieldErrors: null,
            isMissingData: false,
            missingClientEdges: null,
            missingLiveResolverFields: [],
            seenRecords: new Set(Object.keys(data)),
            selector,
          });
        });

        it('includes fragment owner in selector data when owner is provided', () => {
          const CustomUserQuery = graphql`
            query RelayModernStoreTest3Query($size: [Int]) {
              me {
                ...RelayModernStoreTest3Fragment
              }
            }
          `;

          const CustomUserFragment = graphql`
            fragment RelayModernStoreTest3Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
              ...RelayModernStoreTest4Fragment
            }
          `;
          graphql`
            fragment RelayModernStoreTest4Fragment on User {
              username
            }
          `;

          const owner = createOperationDescriptor(CustomUserQuery, {size: 32});
          const selector = createReaderSelector(
            CustomUserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          expect(snapshot).toEqual({
            data: {
              __fragmentOwner: owner.request,
              __fragments: {RelayModernStoreTest4Fragment: {}},
              __id: '4',
              name: 'Zuck',
              profilePicture: {
                uri: 'https://photo1.jpg',
              },
            },
            fieldErrors: null,
            isMissingData: false,
            missingClientEdges: null,
            missingLiveResolverFields: [],
            seenRecords: new Set(Object.keys(data)),
            selector,
          });
          expect(snapshot.data?.__fragmentOwner).toBe(owner.request);
        });

        it('returns deeply-frozen objects', () => {
          const owner = createOperationDescriptor(UserQuery, {});
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          expect(Object.isFrozen(snapshot)).toBe(true);
          assertIsDeeplyFrozen(snapshot.data);
          assertIsDeeplyFrozen(snapshot.selector.variables);
        });

        it('returns updated data after a publish', () => {
          const nextData = {
            '4': {
              __id: '4',
              __typename: 'User',
              'profilePicture(size:32)': {[REF_KEY]: 'client:2'},
            },
            'client:2': {
              __id: 'client:2',
              __typename: 'Image',
              uri: 'https://photo1.jpg',
            },
          };
          const nextSource = getRecordSourceImplementation(nextData);
          store.publish(nextSource); // takes effect w/o calling notify()

          const owner = createOperationDescriptor(UserQuery, {
            size: 32,
          });
          const selector = createReaderSelector(
            UserFragment,
            '4',
            {size: 32},
            owner.request,
          );
          const snapshot = store.lookup(selector);
          expect(snapshot).toEqual({
            data: {
              name: 'Zuck',
              profilePicture: {
                uri: 'https://photo1.jpg',
              },
            },
            fieldErrors: null,
            isMissingData: false,
            missingClientEdges: null,
            missingLiveResolverFields: [],
            seenRecords: new Set(['client:2', '4']),
            selector,
          });
        });
      });

      describe('notify/publish/subscribe', () => {
        let UserQuery;
        let UserFragment:
          | Fragment<
              RelayModernStoreTest5Fragment$fragmentType,
              RelayModernStoreTest5Fragment$data,
            >
          | Fragment<
              RelayModernStoreTest6Fragment$fragmentType,
              RelayModernStoreTest6Fragment$data,
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
            shouldRetainWithinTTL_EXPERIMENTAL: true,
          });
          UserFragment = graphql`
            fragment RelayModernStoreTest5Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
              emailAddresses
            }
          `;

          UserQuery = graphql`
            query RelayModernStoreTest4Query($size: [Int]) {
              me {
                ...RelayModernStoreTest5Fragment
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
          const CustomUserQuery = graphql`
            query RelayModernStoreTest5Query($size: [Int]) {
              me {
                ...RelayModernStoreTest6Fragment
              }
            }
          `;
          const CustomUserFragment = graphql`
            fragment RelayModernStoreTest6Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
              emailAddresses
            }
          `;
          const owner = createOperationDescriptor(CustomUserQuery, {size: 32});
          const selector = createReaderSelector(
            CustomUserFragment,
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
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            shouldRetainWithinTTL_EXPERIMENTAL: true,
          });
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
            missingClientEdges: null,
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
                owner: 'RelayModernStoreTest5Fragment',
              },
              {
                fieldPath: 'emailAddresses',
                kind: 'missing_expected_data.log',
                owner: 'RelayModernStoreTest5Fragment',
              },
            ],
            isMissingData: true,
            missingClientEdges: null,
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
                owner: 'RelayModernStoreTest5Fragment',
              },
              {
                fieldPath: 'emailAddresses',
                kind: 'missing_expected_data.log',
                owner: 'RelayModernStoreTest5Fragment',
              },
            ],
            isMissingData: true,
            missingClientEdges: null,
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
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
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

      describe('check()', () => {
        let UserQuery;
        let data;
        let source;
        let store;
        let environment;

        beforeEach(() => {
          data = {
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
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              'node(id:"4")': {__ref: '4'},
            },
          };
          source = getRecordSourceImplementation(data);
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            shouldRetainWithinTTL_EXPERIMENTAL: true,
          });
          UserQuery = graphql`
            query RelayModernStoreTest6Query($id: ID!, $size: [Int]) {
              node(id: $id) {
                ...RelayModernStoreTest7Fragment @dangerously_unaliased_fixme
              }
            }
          `;
          graphql`
            fragment RelayModernStoreTest7Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
            }
          `;
          environment = createMockEnvironment({store});
        });

        it('returns available if all data exists in the cache', () => {
          const operation = createOperationDescriptor(UserQuery, {
            id: '4',
            size: 32,
          });
          expect(store.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });
        });

        it('returns missing if a scalar field is missing', () => {
          const operation = createOperationDescriptor(UserQuery, {
            id: '4',
            size: 32,
          });
          store.publish(
            getRecordSourceImplementation({
              'client:1': {
                __id: 'client:1',
                uri: undefined, // unpublish the field
              },
            }),
          );
          expect(store.check(operation)).toEqual({status: 'missing'});
        });

        it('returns missing if a linked field is missing', () => {
          const operation = createOperationDescriptor(UserQuery, {
            id: '4',
            size: 64,
          });
          expect(store.check(operation)).toEqual({status: 'missing'});
        });

        it('returns missing if a linked record is missing', () => {
          // $FlowFixMe[incompatible-type] found deploying v0.109.0
          delete data['client:1']; // profile picture
          source = getRecordSourceImplementation(data);
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            shouldRetainWithinTTL_EXPERIMENTAL: true,
          });
          const operation = createOperationDescriptor(UserQuery, {
            id: '4',
            size: 32,
          });
          expect(store.check(operation)).toEqual({status: 'missing'});
        });

        it('returns missing if the root record is missing', () => {
          const operation = createOperationDescriptor(UserQuery, {
            id: '842472',
            size: 32,
          });
          expect(store.check(operation)).toEqual({status: 'missing'});
        });

        describe('with queryCacheExpirationTime', () => {
          it('returns available until query cache expiration time has passed', () => {
            const QUERY_CACHE_EXPIRATION_TIME = 1000;
            let currentTime = Date.now();
            jest
              .spyOn(global.Date, 'now')
              .mockImplementation(() => currentTime);

            store = new RelayModernStore(source, {
              gcReleaseBufferSize: 0,
              queryCacheExpirationTime: QUERY_CACHE_EXPIRATION_TIME,
              shouldRetainWithinTTL_EXPERIMENTAL: true,
            });
            const operation = createOperationDescriptor(UserQuery, {
              id: '4',
              size: 32,
            });
            store.retain(operation);
            store.publish(source);
            store.notify(operation);

            const fetchTime = currentTime;
            currentTime += QUERY_CACHE_EXPIRATION_TIME - 1;

            expect(store.check(operation)).toEqual({
              fetchTime,
              status: 'available',
            });

            currentTime += 1;
            expect(store.check(operation)).toEqual({
              status: 'stale',
            });
          });
        });

        describe('with infinite queryCacheExpirationTime', () => {
          it('always returns available', () => {
            let currentTime = Date.now();
            jest
              .spyOn(global.Date, 'now')
              .mockImplementation(() => currentTime);

            store = new RelayModernStore(source, {
              gcReleaseBufferSize: 0,
              queryCacheExpirationTime: null,
              shouldRetainWithinTTL_EXPERIMENTAL: true,
            });
            const operation = createOperationDescriptor(UserQuery, {
              id: '4',
              size: 32,
            });
            store.retain(operation);
            store.publish(source);
            store.notify(operation);

            expect(store.check(operation)).toEqual({
              fetchTime: currentTime,
              status: 'available',
            });

            const fetchTime = currentTime;
            currentTime += 10000; // arbitrary number

            expect(store.check(operation)).toEqual({
              fetchTime,
              status: 'available',
            });
          });
        });

        describe('with global store invalidation', () => {
          describe("when query hasn't been written to the store before", () => {
            it('returns stale if data is cached and store has been invalidated', () => {
              environment.commitUpdate(storeProxy => {
                storeProxy.invalidateStore();
              });
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });
              expect(store.check(operation)).toEqual({status: 'stale'});
            });

            it('returns stale if data is not cached and store has been invalidated', () => {
              environment.commitUpdate(storeProxy => {
                storeProxy.invalidateStore();
              });
              const operation = createOperationDescriptor(UserQuery, {
                id: '842472',
                size: 32,
              });
              expect(store.check(operation)).toEqual({status: 'stale'});
            });
          });

          describe('when query has been written to the store', () => {
            it('returns stale even if data is cached but store was invalidated after query was written', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              // Write query data and record operation write
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              environment.commitUpdate(storeProxy => {
                storeProxy.invalidateStore();
              });
              expect(store.check(operation)).toEqual({status: 'stale'});
            });

            it('returns available if data is cached and store was invalidated before query was written', () => {
              environment.commitUpdate(storeProxy => {
                storeProxy.invalidateStore();
              });
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              // Write query data and record operation write
              const fetchTime = Date.now();
              jest
                .spyOn(global.Date, 'now')
                .mockImplementation(() => fetchTime);
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              expect(store.check(operation)).toEqual({
                fetchTime,
                status: 'available',
              });
            });

            it('returns the most recent fetchTime when the query is written multiple times to the store', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              // Write query data and record operation write
              let fetchTime = Date.now();
              jest
                .spyOn(global.Date, 'now')
                .mockImplementation(() => fetchTime);
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              // Do it again
              store.retain(operation);
              store.publish(source);
              fetchTime += 1000;
              store.notify(operation);

              expect(store.check(operation)).toEqual({
                fetchTime,
                status: 'available',
              });
            });

            it('returns available if data is cached and store was invalidated before query was written (query not retained)', () => {
              store = new RelayModernStore(source, {
                gcReleaseBufferSize: 1,
                shouldRetainWithinTTL_EXPERIMENTAL: true,
              });
              environment = createMockEnvironment({store});
              environment.commitUpdate(storeProxy => {
                storeProxy.invalidateStore();
              });
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              // Write query data and record operation write
              const fetchTime = Date.now();
              jest
                .spyOn(global.Date, 'now')
                .mockImplementation(() => fetchTime);
              store.publish(source);
              store.notify(operation);

              expect(store.check(operation)).toEqual({
                fetchTime,
                status: 'available',
              });
            });

            it('returns stale if data is not cached and store was invalidated after query was written', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '842472',
                size: 32,
              });

              // Write query data and record operation write
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              environment.commitUpdate(storeProxy => {
                storeProxy.invalidateStore();
              });
              expect(store.check(operation)).toEqual({status: 'stale'});
            });

            it('returns missing if data is not cached and store was invalidated before query was written', () => {
              environment.commitUpdate(storeProxy => {
                storeProxy.invalidateStore();
              });
              const operation = createOperationDescriptor(UserQuery, {
                id: '842472',
                size: 32,
              });

              // Write query data and record operation write
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              expect(store.check(operation)).toEqual({status: 'missing'});
            });
          });
        });

        describe('when individual records are invalidated', () => {
          describe('when data is cached in the store', () => {
            it('returns stale if operation has not been written before', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              environment.commitUpdate(storeProxy => {
                const user = storeProxy.get('4');
                if (!user) {
                  throw new Error('Expected to find record with id "4"');
                }
                user.invalidateRecord();
              });
              expect(store.check(operation)).toEqual({status: 'stale'});
            });

            it('returns stale if operation was written before record was invalidated', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              // Write query data and record operation write
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              environment.commitUpdate(storeProxy => {
                const user = storeProxy.get('4');
                if (!user) {
                  throw new Error('Expected to find record with id "4"');
                }
                user.invalidateRecord();
              });
              expect(store.check(operation)).toEqual({status: 'stale'});
            });

            it('returns available if operation was written after record was invalidated', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              environment.commitUpdate(storeProxy => {
                const user = storeProxy.get('4');
                if (!user) {
                  throw new Error('Expected to find record with id "4"');
                }
                user.invalidateRecord();
              });

              // Write query data and record operation write
              const fetchTime = Date.now();
              jest
                .spyOn(global.Date, 'now')
                .mockImplementation(() => fetchTime);
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              expect(store.check(operation)).toEqual({
                fetchTime,
                status: 'available',
              });
            });
          });

          describe('when data is missing', () => {
            beforeEach(() => {
              store.publish(
                getRecordSourceImplementation({
                  'client:1': {
                    __id: 'client:1',
                    uri: undefined, // missing uri
                  },
                }),
              );
            });

            it('returns stale if operation has not been written before', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              environment.commitUpdate(storeProxy => {
                const user = storeProxy.get('4');
                if (!user) {
                  throw new Error('Expected to find record with id "4"');
                }
                user.invalidateRecord();
              });
              expect(store.check(operation)).toEqual({status: 'stale'});
            });

            it('returns stale if operation was written before record was invalidated', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              // Write query data and record operation write
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              environment.commitUpdate(storeProxy => {
                const user = storeProxy.get('4');
                if (!user) {
                  throw new Error('Expected to find record with id "4"');
                }
                user.invalidateRecord();
              });
              expect(store.check(operation)).toEqual({status: 'stale'});
            });

            it('returns missing if stale record is unreachable', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '842472',
                size: 32,
              });
              // Write query data and record operation write
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              environment.commitUpdate(storeProxy => {
                const user = storeProxy.get('4');
                if (!user) {
                  throw new Error('Expected to find record with id "4"');
                }
                user.invalidateRecord();
              });
              expect(store.check(operation)).toEqual({status: 'missing'});
            });

            it('returns missing if operation was written after record was invalidated', () => {
              const operation = createOperationDescriptor(UserQuery, {
                id: '4',
                size: 32,
              });

              environment.commitUpdate(storeProxy => {
                const user = storeProxy.get('4');
                if (!user) {
                  throw new Error('Expected to find record with id "4"');
                }
                user.invalidateRecord();
              });

              // Write query data and record operation write
              store.retain(operation);
              store.publish(source);
              store.notify(operation);

              expect(store.check(operation)).toEqual({status: 'missing'});
            });
          });
        });
      });

      describe('invalidation state', () => {
        let data;
        let source;
        let store;
        let environment;

        beforeEach(() => {
          data = {
            '4': {
              __id: '4',
              __typename: 'User',
              id: '4',
              name: 'Zuck',
              'profilePicture(size:32)': {[REF_KEY]: 'client:1'},
            },
            '5': {
              __id: '5',
              __typename: 'User',
              id: '5',
              name: 'Someone',
              'profilePicture(size:32)': {[REF_KEY]: 'client:2'},
            },
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo1.jpg',
            },
            'client:2': {
              __id: 'client:2',
              uri: 'https://photo2.jpg',
            },
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              'node(id:"4")': {__ref: '4'},
            },
          };
          source = getRecordSourceImplementation(data);
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            shouldRetainWithinTTL_EXPERIMENTAL: true,
          });
          environment = createMockEnvironment({store});
        });

        describe('lookupInvalidationState() / checkInvalidationState()', () => {
          const dataIDs = ['4', 'client:1'];

          it('returns false if the provided ids have not been invalidated', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            expect(store.checkInvalidationState(invalidationState)).toBe(false);
          });

          it('returns false if the provided ids have not been invalidated regardless of order of ids', () => {
            const invalidationState1 = store.lookupInvalidationState(dataIDs);
            const invalidationState2 = store.lookupInvalidationState(
              dataIDs.reverse(),
            );
            expect(store.checkInvalidationState(invalidationState1)).toBe(
              false,
            );
            expect(store.checkInvalidationState(invalidationState2)).toBe(
              false,
            );
          });

          it('returns true if the store was globally invalidated', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              storeProxy.invalidateStore();
            });
            expect(store.checkInvalidationState(invalidationState)).toBe(true);
          });

          it('returns true if some of the provided ids were invalidated', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
            });
            expect(store.checkInvalidationState(invalidationState)).toBe(true);
          });

          it('returns true if some of the provided ids were invalidated regardless of order of ids', () => {
            const invalidationState1 = store.lookupInvalidationState(dataIDs);
            const invalidationState2 = store.lookupInvalidationState(
              dataIDs.reverse(),
            );
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
            });
            expect(store.checkInvalidationState(invalidationState1)).toBe(true);
            expect(store.checkInvalidationState(invalidationState2)).toBe(true);
          });

          it('returns true if multiple ids were invalidated in separate updates', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
            });
            expect(store.checkInvalidationState(invalidationState)).toBe(true);

            const nextInvalidationState =
              store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const record = storeProxy.get('client:1');
              if (!record) {
                throw new Error('Expected to find record with id "client:1"');
              }
              record.invalidateRecord();
            });
            expect(store.checkInvalidationState(nextInvalidationState)).toBe(
              true,
            );
          });

          it('returns true if multiple ids were invalidated in the same update', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();

              const record = storeProxy.get('client:1');
              if (!record) {
                throw new Error('Expected to find record with id "client:1"');
              }
              record.invalidateRecord();
            });

            expect(store.checkInvalidationState(invalidationState)).toBe(true);
          });

          it('returns true if both store and individual records were invalidated in separate updates', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              storeProxy.invalidateStore();
            });
            expect(store.checkInvalidationState(invalidationState)).toBe(true);

            let nextInvalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
            });
            expect(store.checkInvalidationState(nextInvalidationState)).toBe(
              true,
            );

            nextInvalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const record = storeProxy.get('client:1');
              if (!record) {
                throw new Error('Expected to find record with id "client:1"');
              }
              record.invalidateRecord();
            });
            expect(store.checkInvalidationState(nextInvalidationState)).toBe(
              true,
            );
          });

          it('returns true if both store and individual records were invalidated in the same update', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              storeProxy.invalidateStore();

              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();

              const record = storeProxy.get('client:1');
              if (!record) {
                throw new Error('Expected to find record with id "client:1"');
              }
              record.invalidateRecord();
            });
            expect(store.checkInvalidationState(invalidationState)).toBe(true);
          });
        });

        describe('lookupInvalidationState() / subscribeToInvalidationState()', () => {
          let callback;
          const dataIDs = ['4', 'client:1'];

          beforeEach(() => {
            callback = jest.fn<[], void>();
          });

          it('notifies when invalidation state changes due to global invalidation', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);

            environment.commitUpdate(storeProxy => {
              storeProxy.invalidateStore();
            });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );
          });

          it('notifies when invalidation state changes due to invalidating one of the provided ids', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);

            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
            });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );
          });

          it('notifies once when invalidating multiple affected records in the same update', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();

              const record = storeProxy.get('client:1');
              if (!record) {
                throw new Error('Expected to find record with id "client:1"');
              }
              record.invalidateRecord();
            });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );
          });

          it('notifies once per update when multiple affected records invalidated', () => {
            let invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
            });
            expect(callback).toHaveBeenCalledTimes(1);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );

            invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const record = storeProxy.get('client:1');
              if (!record) {
                throw new Error('Expected to find record with id "client:1"');
              }
              record.invalidateRecord();
            });

            expect(callback).toHaveBeenCalledTimes(2);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );
          });

          it('notifies once when invalidation state changes due to both global and local invalidation in a single update', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);
            environment.commitUpdate(storeProxy => {
              storeProxy.invalidateStore();

              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();

              const record = storeProxy.get('client:1');
              if (!record) {
                throw new Error('Expected to find record with id "client:1"');
              }
              record.invalidateRecord();
            });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );
          });

          it('notifies once per update when invalidation state changes due to both global and local invalidation in multiple', () => {
            let invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);
            environment.commitUpdate(storeProxy => {
              storeProxy.invalidateStore();
            });
            expect(callback).toHaveBeenCalledTimes(1);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );

            invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
            });
            expect(callback).toHaveBeenCalledTimes(2);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );

            invalidationState = store.lookupInvalidationState(dataIDs);
            environment.commitUpdate(storeProxy => {
              const record = storeProxy.get('client:1');
              if (!record) {
                throw new Error('Expected to find record with id "client:1"');
              }
              record.invalidateRecord();
            });

            expect(callback).toHaveBeenCalledTimes(3);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );
          });

          it('does not notify if invalidated ids do not affect subscription', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);
            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('5');
              if (!user) {
                throw new Error('Expected to find record with id "5"');
              }
              user.invalidateRecord();
            });
            expect(callback).toHaveBeenCalledTimes(0);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              false,
            );
          });

          it('does not notify if subscription has been disposed of', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            const disposable = store.subscribeToInvalidationState(
              invalidationState,
              callback,
            );

            disposable.dispose();
            environment.commitUpdate(storeProxy => {
              storeProxy.invalidateStore();
            });
            expect(callback).toHaveBeenCalledTimes(0);

            // Even though subscription wasn't notified, the record is
            // now invalid
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              true,
            );
          });

          it('does not notify if record was deleted', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);

            environment.commitUpdate(storeProxy => {
              storeProxy.delete('4');
            });
            expect(callback).toHaveBeenCalledTimes(0);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              false,
            );
          });

          it('notifes correctly if record was deleted and then re-added', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);

            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
            });
            expect(callback).toHaveBeenCalledTimes(1);

            callback.mockClear();
            environment.commitUpdate(storeProxy => {
              storeProxy.delete('4');
            });
            expect(callback).toHaveBeenCalledTimes(0);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              false,
            );

            environment.commitUpdate(storeProxy => {
              const user = storeProxy.create('4', 'User');
              user.invalidateRecord();
            });
            expect(callback).toHaveBeenCalledTimes(1);
          });

          it('does not notify if record was invalidated and deleted in same update', () => {
            const invalidationState = store.lookupInvalidationState(dataIDs);
            store.subscribeToInvalidationState(invalidationState, callback);

            environment.commitUpdate(storeProxy => {
              const user = storeProxy.get('4');
              if (!user) {
                throw new Error('Expected to find record with id "4"');
              }
              user.invalidateRecord();
              storeProxy.delete('4');
            });
            expect(callback).toHaveBeenCalledTimes(0);
            expect(store.checkInvalidationState(invalidationState)).toEqual(
              false,
            );
          });
        });
      });

      describe('GC with a release buffer', () => {
        let UserQuery;
        let data;
        let initialData;
        let source;
        let store;
        const QUERY_CACHE_EXPIRATION_TIME = 1000;

        beforeEach(() => {
          data = {
            '4': {
              __id: '4',
              __typename: 'User',
              id: '4',
              name: 'Zuck',
              'profilePicture(size:32)': {[REF_KEY]: 'client:1'},
            },
            '5': {
              __id: '5',
              __typename: 'User',
              id: '5',
              name: 'Other',
              'profilePicture(size:32)': {[REF_KEY]: 'client:2'},
            },
            'client:1': {
              __id: 'client:1',
              uri: 'https://photo1.jpg',
            },
            'client:2': {
              __id: 'client:2',
              uri: 'https://photo2.jpg',
            },
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              'node(id:"4")': {__ref: '4'},
              'node(id:"5")': {__ref: '5'},
            },
          };
          initialData = simpleClone(data);
          source = getRecordSourceImplementation(data);
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 1,
            queryCacheExpirationTime: QUERY_CACHE_EXPIRATION_TIME,
            shouldRetainWithinTTL_EXPERIMENTAL: true,
          });
          UserQuery = graphql`
            query RelayModernStoreTest7Query($id: ID!, $size: [Int]) {
              node(id: $id) {
                ...RelayModernStoreTest8Fragment @dangerously_unaliased_fixme
              }
            }
          `;
          graphql`
            fragment RelayModernStoreTest8Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
            }
          `;
        });

        it('keeps the data retained in the release buffer after released by caller', () => {
          const disposable = store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );

          jest.runAllTimers();
          // Assert data is not collected
          expect(source.toJSON()).toEqual(initialData);

          // Assert data is still not collected since it's still
          // retained in the release buffer
          disposable.dispose();
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);
        });

        it('immediately releases disposed items that are stale', () => {
          let fetchTime = Date.now();
          jest.spyOn(global.Date, 'now').mockImplementation(() => fetchTime);

          const operation = createOperationDescriptor(UserQuery, {
            id: '4',
            size: 32,
          });
          const disposable = store.retain(operation);
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          store.publish(source);
          store.notify(operation);

          // Disposing will cause the operation to be immediately
          // released and garbage collection scheduled, as the operation is stale.
          fetchTime += QUERY_CACHE_EXPIRATION_TIME;
          disposable.dispose();
          jest.runAllTimers();

          // After gc and immediate removal, only an empty root record is left.
          expect(source.toJSON()).toEqual({
            [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE},
          });
        });

        it('keeps published data retained in the release buffer if the data is not stale', () => {
          let fetchTime = Date.now();
          jest.spyOn(global.Date, 'now').mockImplementation(() => fetchTime);

          const operation = createOperationDescriptor(UserQuery, {
            id: '4',
            size: 32,
          });
          const disposable = store.retain(operation);
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          store.publish(source);
          store.notify(operation);

          // The operation is not stale, therefore it will not be disposed when released.
          fetchTime += QUERY_CACHE_EXPIRATION_TIME - 1;
          disposable.dispose();
          jest.runAllTimers();

          // The item is retained in the release buffer, and not released from the source.
          expect(source.toJSON()).toEqual(initialData);
        });

        it('keeps the data retained in the release buffer after double-released by caller', () => {
          const disposable = store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );

          jest.runAllTimers();
          // Assert data is not collected
          expect(source.toJSON()).toEqual(initialData);

          // Assert data is still not collected since it's still
          // retained in the release buffer
          disposable.dispose();
          disposable.dispose(); // <-- Dispose should be idempotent
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);
        });

        it('releases the operation and collects data after release buffer reaches capacity', () => {
          let fetchTime = Date.now();
          jest.spyOn(global.Date, 'now').mockImplementation(() => fetchTime);

          const disposable = store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );
          jest.runAllTimers();
          // Assert data is not collected
          expect(source.toJSON()).toEqual(initialData);

          // Assert data is still not collected since it's still
          // retained in the release buffer
          disposable.dispose();
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          const disposable2 = store.retain(
            createOperationDescriptor(UserQuery, {id: '5', size: 32}),
          );
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          // Releasing second operation should cause release buffer to
          // go over capacity
          disposable2.dispose();

          // TTL for all operations has passed
          fetchTime += QUERY_CACHE_EXPIRATION_TIME;

          jest.runAllTimers();
          // Assert that the data for the first operation is collected, while
          // data for second operation is still retained via the release buffer
          expect(source.toJSON()).toEqual({
            '5': {
              __id: '5',
              __typename: 'User',
              id: '5',
              name: 'Other',
              'profilePicture(size:32)': {[REF_KEY]: 'client:2'},
            },
            'client:2': {
              __id: 'client:2',
              uri: 'https://photo2.jpg',
            },
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              'node(id:"4")': {__ref: '4'},
              'node(id:"5")': {__ref: '5'},
            },
          });
        });

        it('when same operation retained multiple times, data is only collected until fully released from buffer', () => {
          let fetchTime = Date.now();
          jest.spyOn(global.Date, 'now').mockImplementation(() => fetchTime);

          const disposable = store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          // Retain the same operation again
          const disposable2 = store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          // Retain different operation
          const disposable3 = store.retain(
            createOperationDescriptor(UserQuery, {id: '5', size: 32}),
          );
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          // Assert data is still not collected since it's still
          // retained in the release buffer
          disposable.dispose();
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          // Assert data is still not collected since it's still
          // retained in the release buffer via the equivalent operation
          disposable2.dispose();
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);

          // Releasing different operation should cause release buffer to
          // go over capacity
          disposable3.dispose();

          // TTL for all operations has passed
          fetchTime += QUERY_CACHE_EXPIRATION_TIME;

          jest.runAllTimers();
          // Assert that the data for the first operation is collected, while
          // data for secont operation is still retained via the release buffer
          expect(source.toJSON()).toEqual({
            '5': {
              __id: '5',
              __typename: 'User',
              id: '5',
              name: 'Other',
              'profilePicture(size:32)': {[REF_KEY]: 'client:2'},
            },
            'client:2': {
              __id: 'client:2',
              uri: 'https://photo2.jpg',
            },
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              'node(id:"4")': {__ref: '4'},
              'node(id:"5")': {__ref: '5'},
            },
          });
        });

        it('does not free data if previously disposed query is retained again', () => {
          // Disposing and re-retaining an operation should cause that query to *not* count
          // toward the release buffer capacity.
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 2,
            shouldRetainWithinTTL_EXPERIMENTAL: true,
          });
          const operation1 = createOperationDescriptor(UserQuery, {
            id: '1',
            size: 32,
          });
          const operation2 = createOperationDescriptor(UserQuery, {
            id: '2',
            size: 32,
          });
          const operation3 = createOperationDescriptor(UserQuery, {
            id: '3',
            size: 32,
          });

          // Retain and immediately release: this will be the first item in the release buffer
          const disposable = store.retain(operation1);
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);
          disposable.dispose();

          // Retain a second operation
          const disposable2 = store.retain(operation2);
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);
          disposable2.dispose();

          // Re-retain the second operation: this should remove it from the release buffer
          store.retain(operation2);

          // Retain and release a third operation
          const disposable3 = store.retain(operation3);
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);
          disposable3.dispose();

          // One of the disposed operations was retained again before the buffer size
          // was exceeded, so no data needs to be freed.
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);
        });
      });

      describe('GC Scheduler', () => {
        let source;
        let store;
        let schedulerQueue;

        const NodeQuery = graphql`
          query RelayModernStoreTest8Query($id: ID!) {
            node(id: $id) {
              __typename
            }
          }
        `;

        function runNextScheduledJob() {
          const job = schedulerQueue.shift();
          expect(job).toBeDefined();
          // $FlowFixMe[not-a-function]
          job();
        }

        function mockScheduler(job: () => void) {
          schedulerQueue.push(job);
        }

        function getStoreRecordIDs(): ReadonlyArray<string> {
          const ids = Object.keys(source.toJSON());
          ids.sort();
          return ids;
        }

        function writeAndRetainNode(nodeID: string): Disposable {
          const nextSource = getRecordSourceImplementation({
            [nodeID]: {
              __id: nodeID,
              __typename: 'User',
            },
            [ROOT_ID]: {
              __id: ROOT_ID,
              __typename: ROOT_TYPE,
              // $FlowFixMe[invalid-computed-prop]
              [`node(id:"${nodeID}")`]: {__ref: nodeID},
            },
          });
          store.publish(nextSource);
          store.notify();

          return store.retain(
            createOperationDescriptor(NodeQuery, {id: nodeID}),
          );
        }

        beforeEach(() => {
          schedulerQueue = [] as Array<$FlowFixMe | (() => void)>;
          source = getRecordSourceImplementation({});
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            gcScheduler: mockScheduler,
            queryCacheExpirationTime: 0,
          });
        });

        afterEach(() => {
          // There should be no unexpected jobs left in the scheduler queue.
          expect(schedulerQueue).toEqual([]);
        });

        it('calls the gc scheduler function when GC should run', () => {
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose} = writeAndRetainNode('a');
          expect(schedulerQueue.length).toBe(0);
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          dispose();
          expect(schedulerQueue.length).toBe(1);
          schedulerQueue.length = 0;
        });

        it('runs GC with full cleanup mode when no retains left', () => {
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose: disposeA} = writeAndRetainNode('a');
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose: disposeB} = writeAndRetainNode('b');
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          disposeA();
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          disposeB();
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'client:root']);
          // nothing retained, prunes the store in one scheduler job
          runNextScheduledJob();
          expect(getStoreRecordIDs()).toEqual([ROOT_ID]);
        });

        it('runs GC with partial cleanup when some retain is left', () => {
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose: disposeA} = writeAndRetainNode('a');
          writeAndRetainNode('b');
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          disposeA();
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'client:root']);
          // mark first operation
          runNextScheduledJob();
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'client:root']);
          // sweep
          runNextScheduledJob();
          expect(getStoreRecordIDs()).toEqual(['b', 'client:root']);
        });

        it('GC pauses during optimistic updates.', () => {
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose: disposeA} = writeAndRetainNode('a');
          writeAndRetainNode('b');
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'client:root']);
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          disposeA();
          // mark first operation
          runNextScheduledJob();
          store.snapshot();
          // noop
          runNextScheduledJob();
          expect(schedulerQueue.length).toBe(0);

          store.restore();
          runNextScheduledJob(); // mark operation one
          // still nothing collected
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'client:root']);
          runNextScheduledJob(); // sweep
          expect(getStoreRecordIDs()).toEqual(['b', 'client:root']);
        });

        it('GC pauses after holdGC', () => {
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose: disposeA} = writeAndRetainNode('a');
          writeAndRetainNode('b');
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'client:root']);
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          disposeA();
          // mark first operation
          runNextScheduledJob();
          const gcHold = store.holdGC();
          // noop
          runNextScheduledJob();
          expect(schedulerQueue.length).toBe(0);

          gcHold.dispose();
          runNextScheduledJob(); // mark operation one
          // still nothing collected
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'client:root']);
          runNextScheduledJob(); // sweep
          expect(getStoreRecordIDs()).toEqual(['b', 'client:root']);
        });

        it('restarts GC when data is written halfway through', () => {
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose: disposeA} = writeAndRetainNode('a');
          writeAndRetainNode('b');
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          disposeA();
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'client:root']);
          // mark first operation
          runNextScheduledJob();
          writeAndRetainNode('c');
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'c', 'client:root']);
          // restart, mark first operation
          runNextScheduledJob();
          // mark second operation
          runNextScheduledJob();
          expect(getStoreRecordIDs()).toEqual(['a', 'b', 'c', 'client:root']);
          // sweep
          runNextScheduledJob();
          expect(getStoreRecordIDs()).toEqual(['b', 'c', 'client:root']);
        });

        describe('shouldScheduleGCAfterPublish_EXPERIMENTAL', () => {
          let shouldScheduleGC;

          function publishUnretainedNode(nodeID: string) {
            store.publish(
              getRecordSourceImplementation({
                [nodeID]: {__id: nodeID, __typename: 'User'},
              }),
            );
            store.notify();
          }

          beforeEach(() => {
            shouldScheduleGC = jest.fn(() => false);
            store = new RelayModernStore(source, {
              gcReleaseBufferSize: 0,
              gcScheduler: mockScheduler,
              queryCacheExpirationTime: 0,
              shouldScheduleGCAfterPublish_EXPERIMENTAL: shouldScheduleGC,
            });
          });

          it('is called once per publish', () => {
            publishUnretainedNode('a');
            expect(shouldScheduleGC).toHaveBeenCalledTimes(1);
            publishUnretainedNode('b');
            expect(shouldScheduleGC).toHaveBeenCalledTimes(2);
          });

          it('does not schedule GC when it returns false', () => {
            publishUnretainedNode('a');
            expect(schedulerQueue.length).toBe(0);
            expect(getStoreRecordIDs()).toEqual(['a', 'client:root']);
          });

          it('schedules a GC that keeps retained data when it returns true', () => {
            writeAndRetainNode('a');
            shouldScheduleGC.mockReturnValue(true);
            publishUnretainedNode('b');
            expect(schedulerQueue.length).toBe(1);
            runNextScheduledJob(); // mark operation one
            runNextScheduledJob(); // sweep
            expect(getStoreRecordIDs()).toEqual(['a', 'client:root']);
          });

          it('waits for holdGC to be released', () => {
            const gcHold = store.holdGC();
            shouldScheduleGC.mockReturnValue(true);
            publishUnretainedNode('a');
            expect(schedulerQueue.length).toBe(0);
            gcHold.dispose();
            runNextScheduledJob();
            expect(getStoreRecordIDs()).toEqual([ROOT_ID]);
          });
        });
      });

      describe('holdGC()', () => {
        let UserQuery;
        let data;
        let initialData;
        let source;
        let store;

        beforeEach(() => {
          data = {
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
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              'node(id:"4")': {__ref: '4'},
            },
          };
          initialData = simpleClone(data);
          source = getRecordSourceImplementation(data);
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            queryCacheExpirationTime: 0,
          });
          UserQuery = graphql`
            query RelayModernStoreTest9Query($id: ID!, $size: [Int]) {
              node(id: $id) {
                ...RelayModernStoreTest9Fragment @dangerously_unaliased_fixme
              }
            }
          `;
          graphql`
            fragment RelayModernStoreTest9Fragment on User {
              name
              profilePicture(size: $size) {
                uri
              }
            }
          `;
        });

        it('prevents data from being collected with disabled GC, and reruns GC when it is enabled', () => {
          const gcHold = store.holdGC();
          // $FlowFixMe[method-unbinding] added when improving typing for this parameters
          const {dispose} = store.retain(
            createOperationDescriptor(UserQuery, {id: '4', size: 32}),
          );
          /* $FlowFixMe[incompatible-type] Error exposed after fixing this
           * typing unsoundness in flow */
          dispose();
          expect(data).toEqual(initialData);
          jest.runAllTimers();
          expect(source.toJSON()).toEqual(initialData);
          gcHold.dispose();
          jest.runAllTimers();
          expect(source.toJSON()).toEqual({
            [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE},
          });
        });
      });
    });
  },
);
