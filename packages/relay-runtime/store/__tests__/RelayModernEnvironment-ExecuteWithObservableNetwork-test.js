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
import type {GraphQLResponse} from '../../network/RelayNetworkTypes';
import type {
  RecordSourceJSON,
  RecordSourceProxy,
  RecordSourceSelectorProxy,
  RelayResponsePayload,
  Snapshot,
} from '../RelayStoreTypes';

const {
  MultiActorEnvironment,
  getActorIdentifier,
} = require('../../multi-actor-environment');
const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {ROOT_ID} = require('../RelayStoreUtils');
const {graphql} = require('relay-runtime');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'execute() with Observable network',
  environmentType => {
    let callbacks;
    let complete;
    let environment;
    let error;
    let fetch;
    let next;
    let operation;
    let query;
    let source;
    let store;
    let subject;
    let variables;

    describe(environmentType, () => {
      beforeEach(() => {
        query = graphql`
          query RelayModernEnvironmentExecuteWithObservableNetworkTestQuery(
            $fetchSize: Boolean!
          ) {
            me {
              name
              profilePicture(size: 42) @include(if: $fetchSize) {
                uri
              }
            }
          }
        `;
        variables = {fetchSize: false};
        operation = createOperationDescriptor(query, {
          ...variables,
          foo: 'bar', // should be filtered from network fetch
        });

        complete = jest.fn<[], unknown>();
        error = jest.fn<[Error], unknown>();
        next = jest.fn<[GraphQLResponse], unknown>();
        callbacks = {complete, error, next};
        // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
        fetch = jest.fn((_query, _variables, _cacheConfig) =>
          // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
          RelayObservable.create(sink => {
            subject = sink;
          }),
        );
        source = RelayRecordSource.create();
        store = new RelayModernStore(source);
        const multiActorEnvironment = new MultiActorEnvironment({
          // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
          createNetworkForActor: _actorID => RelayNetwork.create(fetch),
          createStoreForActor: _actorID => store,
        });
        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
                network: RelayNetwork.create(fetch),
                store,
              });
      });

      it('fetches queries', () => {
        environment.execute({operation}).subscribe(callbacks);
        expect(fetch.mock.calls.length).toBe(1);
        expect(fetch.mock.calls[0][0]).toEqual(query.params);
        expect(fetch.mock.calls[0][1]).toEqual({fetchSize: false});
        expect(fetch.mock.calls[0][2]).toEqual({});
      });

      it('fetches queries with force:true', () => {
        const cacheConfig = {force: true};
        operation = createOperationDescriptor(
          query,
          {
            ...variables,
            foo: 'bar', // should be filtered from network fetch
          },
          cacheConfig,
        );
        environment.execute({operation}).subscribe(callbacks);
        expect(fetch.mock.calls.length).toBe(1);
        expect(fetch.mock.calls[0][0]).toEqual(query.params);
        expect(fetch.mock.calls[0][1]).toEqual({fetchSize: false});
        expect(fetch.mock.calls[0][2]).toBe(cacheConfig);
      });

      it('calls next() when payloads return', () => {
        environment.execute({operation}).subscribe(callbacks);
        subject.next({
          data: {
            me: {
              id: '842472',
              __typename: 'User',
              name: 'Joe',
            },
          },
        });
        jest.runAllTimers();
        expect(next.mock.calls.length).toBe(1);
        subject.next({
          data: {
            me: {
              id: '842472',
              __typename: 'User',
              name: 'Joseph',
            },
          },
        });
        jest.runAllTimers();
        expect(next.mock.calls.length).toBe(2);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
      });

      it('calls next() and runs updater when payloads return', () => {
        const updater = jest.fn<[RecordSourceSelectorProxy, ?{...}], void>();
        environment
          .executeSubscription({operation, updater})
          .subscribe(callbacks);
        subject.next({
          data: {
            me: {
              id: '842472',
              __typename: 'User',
              name: 'Joe',
            },
          },
        });
        jest.runAllTimers();
        expect(next.mock.calls.length).toBe(1);
        subject.next({
          data: {
            me: {
              id: '842472',
              __typename: 'User',
              name: 'Joseph',
            },
          },
        });
        jest.runAllTimers();
        expect(next.mock.calls.length).toBe(2);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(updater).toBeCalled();
      });

      it('calls complete() when the network request completes', () => {
        environment.execute({operation}).subscribe(callbacks);
        subject.complete();
        expect(complete.mock.calls.length).toBe(1);
        expect(error).not.toBeCalled();
        expect(next).not.toBeCalled();
      });

      it('calls error() when the batch has an error', () => {
        environment.execute({operation}).subscribe(callbacks);
        const e = new Error('wtf');
        subject.error(e);
        jest.runAllTimers();

        expect(error).toBeCalledWith(e);
        expect(complete).not.toBeCalled();
        expect(next.mock.calls.length).toBe(0);
      });

      it('calls next() and publishes payloads to the store', () => {
        const selector = createReaderSelector(
          query.fragment,
          ROOT_ID,
          variables,
          operation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        environment.execute({operation}).subscribe(callbacks);
        const payload = {
          data: {
            me: {
              id: '842472',
              __typename: 'User',
              name: 'Joe',
            },
          },
        };
        subject.next(payload);
        jest.runAllTimers();

        expect(next.mock.calls.length).toBe(1);
        expect(next).toBeCalledWith(payload);
        expect(complete).not.toBeCalled();
        expect(error).not.toBeCalled();
        expect(callback.mock.calls.length).toBe(1);
        expect(callback.mock.calls[0][0].data).toEqual({
          me: {
            name: 'Joe',
          },
        });
      });

      it('calls next() with extensions-only payloads', () => {
        environment.execute({operation}).subscribe(callbacks);
        const payload1 = {data: null, extensions: {}};
        const payload2 = {data: null, extensions: {is_final: true}};
        subject.next(payload1);
        jest.runAllTimers();
        expect(error).not.toBeCalled();
        expect(complete).not.toBeCalled();
        expect(next.mock.calls.length).toBe(1);
        const response = next.mock.calls[0][0];
        expect(response).toBe(payload1);
        next.mockClear();

        subject.next(payload2);
        jest.runAllTimers();
        expect(error).not.toBeCalled();
        expect(complete).not.toBeCalled();
        expect(next.mock.calls.length).toBe(1);
        const response2 = next.mock.calls[0][0];
        expect(response2).toBe(payload2);
      });

      describe('with pre-normalized payloads sent together', () => {
        function preNormalized(
          records: RecordSourceJSON,
          isFinal: boolean,
          storeUpdater?: (store: RecordSourceProxy) => void,
        ): RelayResponsePayload {
          return {
            errors: null,
            fieldPayloads: null,
            followupPayloads: null,
            incrementalPlaceholders: null,
            isFinal,
            isPreNormalized: true,
            source: RelayRecordSource.create(records),
            storeUpdater,
          };
        }
        const me: RecordSourceJSON = {
          [ROOT_ID]: {
            __id: ROOT_ID,
            __typename: '__Root',
            me: {__ref: '842472'},
          },
          '842472': {
            __id: '842472',
            __typename: 'User',
            id: '842472',
            name: 'Joe',
          },
        };

        it('publishes them in order with one store notification', () => {
          const selector = createReaderSelector(
            query.fragment,
            ROOT_ID,
            variables,
            operation.request,
          );
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(environment.lookup(selector), callback);
          environment.execute({operation}).subscribe(callbacks);
          subject.next([
            preNormalized(me, false),
            preNormalized(
              {'842472': {__id: '842472', __typename: 'User', name: 'Zuck'}},
              false,
            ),
          ]);
          jest.runAllTimers();
          expect(error).not.toBeCalled();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0].data).toEqual({me: {name: 'Zuck'}});
        });

        it('runs each store updater over the payloads before it', () => {
          let seen;
          environment.execute({operation}).subscribe(callbacks);
          subject.next([
            preNormalized(me, false),
            preNormalized({}, false, store => {
              seen = store.get('842472')?.getValue('name');
            }),
          ]);
          jest.runAllTimers();
          expect(error).not.toBeCalled();
          expect(seen).toBe('Joe');
        });

        it('publishes the network response sent after them in the same store update', () => {
          const selector = createReaderSelector(
            query.fragment,
            ROOT_ID,
            variables,
            operation.request,
          );
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(environment.lookup(selector), callback);
          environment.execute({operation}).subscribe(callbacks);
          const response = {
            data: {
              '842472': {__id: '842472', __typename: 'User', name: 'Zuck'},
            },
            extensions: {is_final: true, is_normalized: true},
          };
          subject.next([preNormalized(me, false), response]);
          jest.runAllTimers();
          expect(error).not.toBeCalled();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0].data).toEqual({me: {name: 'Zuck'}});
          expect(next.mock.calls).toEqual([[response]]);
        });

        it('publishes them before a network response without data', () => {
          const selector = createReaderSelector(
            query.fragment,
            ROOT_ID,
            variables,
            operation.request,
          );
          const callback = jest.fn<[Snapshot], void>();
          environment.subscribe(environment.lookup(selector), callback);
          environment.execute({operation}).subscribe(callbacks);
          const response = {data: null, extensions: {is_final: true}};
          subject.next([preNormalized(me, true), response]);
          jest.runAllTimers();
          expect(error).not.toBeCalled();
          expect(callback.mock.calls.length).toBe(1);
          expect(callback.mock.calls[0][0].data).toEqual({me: {name: 'Joe'}});
          expect(next).toBeCalledWith(response);
        });

        it('publishes them beneath an optimistic update in flight', () => {
          const selector = createReaderSelector(
            query.fragment,
            ROOT_ID,
            variables,
            operation.request,
          );
          const optimistic = environment.applyUpdate({
            storeUpdater: store => {
              const user =
                store.get('842472') ?? store.create('842472', 'User');
              user.setValue('Optimistic', 'name');
              store.getRoot().setLinkedRecord(user, 'me');
            },
          });
          environment.execute({operation}).subscribe(callbacks);
          subject.next([
            preNormalized(me, false),
            {
              data: {
                '842472': {__id: '842472', __typename: 'User', name: 'Zuck'},
              },
              extensions: {is_final: true, is_normalized: true},
            },
          ]);
          jest.runAllTimers();
          expect(error).not.toBeCalled();
          // The optimistic update stays on top of what they publish...
          expect(environment.lookup(selector).data).toEqual({
            me: {name: 'Optimistic'},
          });
          optimistic.dispose();
          // ...which is in the store beneath it.
          expect(environment.lookup(selector).data).toEqual({
            me: {name: 'Zuck'},
          });
        });

        it('ends the request when any of them is final', () => {
          environment.execute({operation}).subscribe(callbacks);
          expect(
            environment.isRequestActive(operation.request.identifier),
          ).toBe(true);
          subject.next([preNormalized(me, true), preNormalized({}, false)]);
          jest.runAllTimers();
          expect(error).not.toBeCalled();
          expect(
            environment.isRequestActive(operation.request.identifier),
          ).toBe(false);
        });
      });
    });
  },
);
