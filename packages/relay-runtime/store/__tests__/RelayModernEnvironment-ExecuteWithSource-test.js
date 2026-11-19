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
import type {Snapshot} from '../RelayStoreTypes';

const {
  MultiActorEnvironment,
  getActorIdentifier,
} = require('../../multi-actor-environment');
const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const {graphql} = require('../../query/GraphQLTag');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {ROOT_ID} = require('../RelayStoreUtils');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'executeWithSource() with Observable network',
  environmentType => {
    let callbacks;
    let complete;
    let environment;
    let error;
    let fetch;
    let fetchSource;
    let fetchSourceMock;
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
          query RelayModernEnvironmentExecuteWithSourceTestActorQuery(
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
        fetch = jest.fn((_query, _variables, _cacheConfig) =>
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
        fetchSourceMock = jest.fn(sink =>
          // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
          fetch(
            operation.request.node.params,
            operation.request.variables,
          ).subscribe(sink),
        );
        fetchSource = RelayObservable.create(fetchSourceMock);
      });

      it('subscribes to source', () => {
        environment
          .executeWithSource({operation, source: fetchSource})
          .subscribe(callbacks);
        expect(fetchSourceMock.mock.calls.length).toBe(1);
      });

      it('calls next() when payloads return', () => {
        environment
          .executeWithSource({operation, source: fetchSource})
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
      });

      it('calls complete() when the network request completes', () => {
        environment
          .executeWithSource({operation, source: fetchSource})
          .subscribe(callbacks);
        subject.complete();
        expect(complete.mock.calls.length).toBe(1);
        expect(error).not.toBeCalled();
        expect(next).not.toBeCalled();
      });

      it('calls error() when the network has an error', () => {
        environment
          .executeWithSource({operation, source: fetchSource})
          .subscribe(callbacks);
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

        environment
          .executeWithSource({operation, source: fetchSource})
          .subscribe(callbacks);
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

      it('calls next() and publishes normalized response to the store', () => {
        const selector = createReaderSelector(
          query.fragment,
          ROOT_ID,
          variables,
          operation.request,
        );
        const snapshot = environment.lookup(selector);
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(snapshot, callback);

        environment
          .executeWithSource({operation, source: fetchSource})
          .subscribe(callbacks);
        const payload = {
          data: {
            '842472': {
              __id: '842472',
              __typename: 'User',
              name: 'Joe',
              id: '842472',
            },
            'client:root': {
              __id: 'client:root',
              __typename: '__Root',
              me: {__ref: '842472'},
            },
          },
          extensions: {
            is_normalized: true,
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

      describe('Client only exec time queries', () => {
        let resolverOperation;
        beforeEach(() => {
          const resolverQuery = graphql`
            query RelayModernEnvironmentExecuteWithSourceTestResolverQuery
            @exec_time_resolvers {
              hello(world: "world")
            }
          `;
          resolverOperation = createOperationDescriptor(resolverQuery, {});
        });

        it('does not mark the query as complete until a final response is received', () => {
          environment
            .executeWithSource({
              operation: resolverOperation,
              source: fetchSource,
            })
            .subscribe(callbacks);
          subject.next({
            data: {
              hello: '',
            },
            extensions: {
              is_final: false,
              is_normalized: true,
            },
          });
          expect(complete).not.toBeCalled();
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(true);

          subject.next({
            data: {
              hello: 'world',
            },
            extensions: {
              is_final: true,
              is_normalized: true,
            },
          });
          expect(complete).not.toBeCalled();
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(false);
        });

        it('marks the query as complete until a final response with empty data is received', () => {
          environment
            .executeWithSource({
              operation: resolverOperation,
              source: fetchSource,
            })
            .subscribe(callbacks);

          subject.next({
            data: null,
            extensions: {
              is_final: false,
              is_normalized: true,
            },
          });

          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(true);

          subject.next({
            data: null,
            extensions: {
              is_final: true,
              is_normalized: true,
            },
          });
          expect(complete).not.toBeCalled();
          expect(
            environment.isRequestActive(resolverOperation.request.identifier),
          ).toBe(false);
        });
      });
    });
  },
);
