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
  'execute() a query with @defer on a fragment-nested spread that uses @connection',
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

      it('populates the connection edges from the deferred payload', () => {
        const query = graphql`
          query RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestQuery(
            $id: ID!
          ) {
            node(id: $id) {
              ... on User {
                ...RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper
                  @dangerously_unaliased_fixme
              }
            }
          }
        `;
        const wrapper = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper on User {
            id
            ...RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection
              @dangerously_unaliased_fixme
              @defer(label: "ConnectionFragment")
          }
        `;
        const connectionFragment = graphql`
          fragment RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestConnection on User {
            friends(first: 2)
              @connection(
                key: "RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTest_friends"
              ) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        `;
        const operation = createOperationDescriptor(query, {id: '1'});
        const selector = createReaderSelector(
          connectionFragment,
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
            },
          },
        });
        jest.runAllTimers();
        next.mockClear();

        dataSource.next({
          data: {
            friends: {
              edges: [
                {
                  cursor: 'cursor-1',
                  node: {id: 'u2', name: 'Alice', __typename: 'User'},
                },
                {
                  cursor: 'cursor-2',
                  node: {id: 'u3', name: 'Bob', __typename: 'User'},
                },
              ],
              pageInfo: {
                endCursor: 'cursor-2',
                hasNextPage: false,
                startCursor: 'cursor-1',
                hasPreviousPage: false,
              },
            },
          },
          label:
            'RelayModernEnvironmentExecuteWithDeferInFragmentAndConnectionTestWrapper$defer$ConnectionFragment',
          path: ['node'],
        });

        expect(complete).toBeCalledTimes(0);
        expect(error).toBeCalledTimes(0);
        const snapshot = environment.lookup(selector);
        expect(snapshot.isMissingData).toBe(false);
        expect(snapshot.data).toEqual({
          friends: {
            edges: [
              {
                cursor: 'cursor-1',
                node: {__typename: 'User', id: 'u2', name: 'Alice'},
              },
              {
                cursor: 'cursor-2',
                node: {__typename: 'User', id: 'u3', name: 'Bob'},
              },
            ],
            pageInfo: {
              endCursor: 'cursor-2',
              hasNextPage: false,
            },
          },
        });
      });
    });
  },
);
