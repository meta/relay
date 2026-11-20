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

import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {Snapshot} from 'relay-runtime/store/RelayStoreTypes';
import type {RequestParameters} from 'relay-runtime/util/RelayConcreteNode';
import type {
  CacheConfig,
  Variables,
} from 'relay-runtime/util/RelayRuntimeTypes';

const {
  MultiActorEnvironment,
  getActorIdentifier,
} = require('relay-runtime/multi-actor-environment');
const RelayNetwork = require('relay-runtime/network/RelayNetwork');
const RelayObservable = require('relay-runtime/network/RelayObservable');
const {graphql} = require('relay-runtime/query/GraphQLTag');
const RelayModernEnvironment = require('relay-runtime/store/RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('relay-runtime/store/RelayModernOperationDescriptor');
const {
  createReaderSelector,
} = require('relay-runtime/store/RelayModernSelector');
const RelayModernStore = require('relay-runtime/store/RelayModernStore');
const RelayRecordSource = require('relay-runtime/store/RelayRecordSource');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'execute() a query with @defer + subPath',
  environmentType => {
    let callbacks;
    let complete;
    let dataSource;
    let environment;
    let error;
    let next;

    describe(environmentType, () => {
      beforeEach(() => {
        complete = jest.fn<[], unknown>();
        error = jest.fn<[Error], unknown>();
        next = jest.fn<[GraphQLResponse], unknown>();
        callbacks = {complete, error, next};
        const fetch = (
          _query: RequestParameters,
          _variables: Variables,
          _cacheConfig: CacheConfig,
        ): RelayObservable<GraphQLResponse> => {
          return RelayObservable.create<GraphQLResponse>(
            (sink: Sink<GraphQLResponse>) => {
              dataSource = sink;
            },
          );
        };
        const store = new RelayModernStore(RelayRecordSource.create());
        const multiActorEnvironment = new MultiActorEnvironment({
          createNetworkForActor: _actorID => RelayNetwork.create(fetch),
          createStoreForActor: _actorID => store,
        });
        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                network: RelayNetwork.create(fetch),
                store,
              });
      });

      it('processes a deferred payload whose subPath addresses a nested sub-record', () => {
        const query = graphql`
          query RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery(
            $id: ID!
          ) {
            node(id: $id) {
              ... on User {
                id
                ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment
                  @dangerously_unaliased_fixme
                  @defer(label: "AddressFragment")
              }
            }
          }
        `;
        const fragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressFragment on User {
            address {
              city
              country
            }
          }
        `;
        const operation = createOperationDescriptor(query, {id: '1'});
        const selector = createReaderSelector(
          fragment,
          '1',
          {},
          operation.request,
        );
        const callback = jest.fn<[Snapshot], void>();
        environment.subscribe(environment.lookup(selector), callback);

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
              address: {country: 'US'},
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();
        callback.mockClear();

        dataSource.next({
          data: {city: 'San Francisco', country: 'US'},
          label:
            'RelayModernEnvironmentExecuteWithDeferAndSubPathTestAddressQuery$defer$AddressFragment',
          path: ['node', 'address'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        expect(callback).toBeCalledTimes(1);
        const snapshot = callback.mock.calls[0][0];
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          address: {city: 'San Francisco', country: 'US'},
        });
      });

      it('processes deferred sub-record payloads addressed via numeric+string subPath', () => {
        const query = graphql`
          query RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery(
            $id: ID!
          ) {
            node(id: $id) {
              ... on User {
                id
                allPhones {
                  phoneNumber {
                    displayNumber
                  }
                }
                ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment
                  @dangerously_unaliased_fixme
                  @defer(label: "SubRecordFragment")
              }
            }
          }
        `;
        const fragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordFragment on User {
            allPhones {
              phoneNumber {
                countryCode
              }
            }
          }
        `;
        const operation = createOperationDescriptor(query, {id: '1'});
        const selector = createReaderSelector(
          fragment,
          '1',
          {},
          operation.request,
        );

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
              allPhones: [
                {phoneNumber: {displayNumber: '+1-555-0100'}},
                {phoneNumber: {displayNumber: '+1-555-0101'}},
              ],
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();

        dataSource.next({
          data: {countryCode: 'US'},
          label:
            'RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$defer$SubRecordFragment',
          path: ['node', 'allPhones', 0, 'phoneNumber'],
        });
        dataSource.next({
          data: {countryCode: 'CA'},
          label:
            'RelayModernEnvironmentExecuteWithDeferAndSubPathTestSubRecordQuery$defer$SubRecordFragment',
          path: ['node', 'allPhones', 1, 'phoneNumber'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        const snapshot = environment.lookup(selector);
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          allPhones: [
            {phoneNumber: {countryCode: 'US'}},
            {phoneNumber: {countryCode: 'CA'}},
          ],
        });
      });

      it('processes deferred per-item payloads addressed via numeric subPath', () => {
        const query = graphql`
          query RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery(
            $id: ID!
          ) {
            node(id: $id) {
              ... on User {
                id
                allPhones {
                  phoneNumber {
                    displayNumber
                  }
                }
                ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment
                  @dangerously_unaliased_fixme
                  @defer(label: "PhonesFragment")
              }
            }
          }
        `;
        const fragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesFragment on User {
            allPhones {
              isVerified
              phoneNumber {
                displayNumber
              }
            }
          }
        `;
        const operation = createOperationDescriptor(query, {id: '1'});
        const selector = createReaderSelector(
          fragment,
          '1',
          {},
          operation.request,
        );

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
              allPhones: [
                {phoneNumber: {displayNumber: '+1-555-0100'}},
                {phoneNumber: {displayNumber: '+1-555-0101'}},
              ],
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();

        dataSource.next({
          data: {
            isVerified: true,
            phoneNumber: {displayNumber: '+1-555-0100'},
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$defer$PhonesFragment',
          path: ['node', 'allPhones', 0],
        });
        dataSource.next({
          data: {
            isVerified: false,
            phoneNumber: {displayNumber: '+1-555-0101'},
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferAndSubPathTestPhonesQuery$defer$PhonesFragment',
          path: ['node', 'allPhones', 1],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        const snapshot = environment.lookup(selector);
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          allPhones: [
            {isVerified: true, phoneNumber: {displayNumber: '+1-555-0100'}},
            {isVerified: false, phoneNumber: {displayNumber: '+1-555-0101'}},
          ],
        });
      });

      it('processes a nested @defer chunk when the outer defer streams as sub-path chunks only', () => {
        const query = graphql`
          query RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery(
            $id: ID!
          ) {
            node(id: $id) {
              ... on User {
                id
                allPhones {
                  phoneNumber {
                    displayNumber
                  }
                }
                ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment
                  @dangerously_unaliased_fixme
                  @defer(label: "NestedOuterFragment")
              }
            }
          }
        `;
        graphql`
          fragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment on User {
            allPhones {
              isVerified
            }
            ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment
              @defer(label: "NestedInnerFragment")
          }
        `;
        const innerFragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment on User {
            name
          }
        `;
        const operation = createOperationDescriptor(query, {id: '1'});
        const innerSelector = createReaderSelector(
          innerFragment,
          '1',
          {},
          operation.request,
        );

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
              allPhones: [
                {phoneNumber: {displayNumber: '+1-555-0100'}},
              ],
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();

        // Outer @defer's data streams ONLY as sub-path chunks (per-item).
        // The outer fragment root at ['node'] never gets a chunk of its own,
        // so a direct normalisation of the outer fragment never happens.
        dataSource.next({
          data: {isVerified: true},
          label:
            'RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery$defer$NestedOuterFragment',
          path: ['node', 'allPhones', 0],
        });

        // Inner @defer chunk arrives at the outer's parent path, addressed
        // by the inner label. Without the eager inner-placeholder registration,
        // no placeholder exists for this label and the chunk is silently dropped.
        dataSource.next({
          data: {name: 'Alice'},
          label:
            'RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$defer$NestedInnerFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        const snapshot = environment.lookup(innerSelector);
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({name: 'Alice'});
      });

      it('processes a nested @defer chunk when the outer defer emits no chunk of its own', () => {
        const query = graphql`
          query RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedQuery(
            $id: ID!
          ) {
            node(id: $id) {
              ... on User {
                id
                allPhones {
                  phoneNumber {
                    displayNumber
                  }
                }
                ...RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment
                  @dangerously_unaliased_fixme
                  @defer(label: "NestedOuterFragment")
              }
            }
          }
        `;
        const innerFragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedInnerFragment on User {
            name
          }
        `;
        const operation = createOperationDescriptor(query, {id: '1'});
        const innerSelector = createReaderSelector(
          innerFragment,
          '1',
          {},
          operation.request,
        );

        environment.execute({operation}).subscribe(callbacks);
        dataSource.next({
          data: {
            node: {
              id: '1',
              __typename: 'User',
              allPhones: [
                {phoneNumber: {displayNumber: '+1-555-0100'}},
              ],
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();

        // No outer chunk arrives — mirrors the server-side optimisation of
        // skipping the parent label when its non-defer selections resolve
        // to nothing. Inner @defer chunk arrives directly at the parent
        // path. Without the eager placeholder registration triggered when
        // the outer placeholder itself is created, no inner placeholder
        // exists and the chunk is silently dropped.
        dataSource.next({
          data: {name: 'Alice'},
          label:
            'RelayModernEnvironmentExecuteWithDeferAndSubPathTestNestedOuterFragment$defer$NestedInnerFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        const snapshot = environment.lookup(innerSelector);
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({name: 'Alice'});
      });
    });
  },
);
