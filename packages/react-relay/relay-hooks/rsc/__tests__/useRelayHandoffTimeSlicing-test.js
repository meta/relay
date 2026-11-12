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

import type {useRelayHandoffTestCard_user$key} from './__generated__/useRelayHandoffTestCard_user.graphql';
import type {useRelayHandoffTestQuery$variables} from './__generated__/useRelayHandoffTestQuery.graphql';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';

// The module instance React uses here (see `jest.mock` below).
const Scheduler = require('../../../__tests__/mockScheduler');
const {installRelayHandoff} = require('../../../rsc-client_EXPERIMENTAL');
const RelayEnvironmentProvider = require('../../RelayEnvironmentProvider');
const useFragment = require('../../useFragment');
const useLazyLoadQuery = require('../../useLazyLoadQuery');
const serverQuery = require('../serverQuery');
const CardFragment = require('./__generated__/useRelayHandoffTestCard_user.graphql');
const LastNameQuery = require('./__generated__/useRelayHandoffTestLastNameQuery.graphql');
const Query = require('./__generated__/useRelayHandoffTestQuery.graphql');
const React = require('react');
const {startTransition} = require('react');
const TestRenderer = require('react-test-renderer');
const {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  createOperationDescriptor,
} = require('relay-runtime');

jest.mock('scheduler', () => require('../../../__tests__/mockScheduler'));

const ME = {
  __typename: 'User',
  friends: {
    edges: [
      {
        cursor: 'cursor:5',
        node: {__typename: 'User', id: '5', name: 'Ada'},
      },
    ],
    pageInfo: {endCursor: 'cursor:5', hasNextPage: true},
  },
  id: '4',
  lastName: 'Zuckerberg',
  name: 'SECRET_SERVER_NAME',
  profilePicture: {uri: '4.jpg'},
};

component LastName() {
  const data = useLazyLoadQuery(LastNameQuery, {}, {fetchPolicy: 'store-only'});
  const lastName = data.node?.lastName ?? '';
  Scheduler.log(`LastName ${lastName}`);
  return lastName;
}

component Card(user: useRelayHandoffTestCard_user$key) {
  const data = useFragment(CardFragment, user);
  Scheduler.log('Card');
  return `${data.lastName ?? ''} ${data.profilePicture?.uri ?? ''}`;
}

component After() {
  Scheduler.log('After');
  return null;
}

describe('useRelayHandoff in a render React time-slices', () => {
  it('updates other readers when its deferred notification runs while React yields', async () => {
    const sinks: Array<Sink<GraphQLResponse>> = [];
    const server = new Environment({
      isServer: true,
      network: Network.create(() =>
        Observable.create((sink: Sink<GraphQLResponse>) => {
          sinks.push(sink);
        }),
      ),
      store: new Store(new RecordSource()),
    });
    const variables: useRelayHandoffTestQuery$variables = {size: [32]};
    const result = serverQuery(server, Query, variables);
    sinks[0].next({data: {me: ME}, extensions: {is_final: false}});
    sinks[0].complete();
    const user = (await result).me?.card;
    if (user == null) {
      throw new Error('Expected a reference.');
    }

    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    installRelayHandoff(client);
    client.commitPayload(createOperationDescriptor(LastNameQuery, {}), {
      node: {__typename: 'User', id: '4', lastName: 'Old'},
    });
    const errors: Array<string> = [];
    jest.spyOn(console, 'error').mockImplementation((message: unknown) => {
      // This test drives React's scheduler itself rather than `act`.
      if (typeof message === 'string' && message.includes('act(')) {
        return;
      }
      errors.push(String(message));
    });
    const app = (withCard: boolean) => (
      <RelayEnvironmentProvider environment={client}>
        <LastName />
        {withCard ? (
          <React.Suspense fallback="loading">
            <Card user={user} />
            <After />
          </React.Suspense>
        ) : null}
      </RelayEnvironmentProvider>
    );
    let renderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(app(false), {
        createNodeMock: () => null,
        unstable_isConcurrent: true,
      });
    });
    expect(Scheduler.unstable_clearLog()).toEqual(['LastName Old']);

    const notify = jest.spyOn(client.getStore(), 'notify');
    startTransition(() => {
      renderer?.update(app(true));
    });
    // React renders the reader, which publishes its root, then yields before
    // it commits.
    Scheduler.unstable_flushNumberOfYields(2);
    expect(Scheduler.unstable_clearLog()).toEqual(['LastName Old', 'Card']);
    expect(renderer?.toJSON()).toBe('Old');
    expect(notify).not.toHaveBeenCalled();
    // The timer that notifies the Store's subscribers runs while React is
    // between slices of that render.
    jest.runOnlyPendingTimers();
    expect(notify).toHaveBeenCalledTimes(1);
    Scheduler.unstable_flushAllWithoutAsserting();
    TestRenderer.act(() => {
      jest.runAllTimers();
    });
    expect(renderer?.toJSON()).toEqual(['Zuckerberg', 'Zuckerberg 4.jpg']);
    expect(errors).toEqual([]);
  });
});
