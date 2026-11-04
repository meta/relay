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

import type {DataID} from '../../util/RelayRuntimeTypes';

import RelayNetwork from '../../network/RelayNetwork';
import {graphql} from '../../query/GraphQLTag';
import RelayModernEnvironment from '../RelayModernEnvironment';
import {createOperationDescriptor} from '../RelayModernOperationDescriptor';
import RelayModernStore from '../RelayModernStore';
import RelayRecordSource from '../RelayRecordSource';

const Query = graphql`
  query RelayModernStoreObserveUpdatedRecordIDsTestQuery {
    me {
      name
    }
  }
`;

const FriendsQuery = graphql`
  query RelayModernStoreObserveUpdatedRecordIDsTestFriendsQuery {
    me {
      friends(first: 1)
        @connection(
          key: "RelayModernStoreObserveUpdatedRecordIDsTest_friends"
        ) {
        edges {
          node {
            name
          }
        }
      }
    }
  }
`;

function createEnvironment(): {
  environment: RelayModernEnvironment,
  store: RelayModernStore,
  updates: Array<Array<DataID>>,
} {
  const store = new RelayModernStore(RelayRecordSource.create());
  const environment = new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store,
  });
  const updates: Array<Array<DataID>> = [];
  store.observeUpdatedRecordIDs(updatedRecordIDs => {
    updates.push(Array.from(updatedRecordIDs).sort());
  });
  return {environment, store, updates};
}

describe('RelayModernStore.observeUpdatedRecordIDs()', () => {
  it('reports the records each notification updated', () => {
    const store = new RelayModernStore(RelayRecordSource.create());
    const updates: Array<Array<DataID>> = [];
    const disposable = store.observeUpdatedRecordIDs(updatedRecordIDs => {
      updates.push(Array.from(updatedRecordIDs).sort());
    });
    store.publish(
      RelayRecordSource.create({
        '4': {__id: '4', __typename: 'User', name: 'Zuck'},
        '5': {__id: '5', __typename: 'User', name: 'Ada'},
      }),
    );
    store.notify();
    store.publish(
      RelayRecordSource.create({
        '4': {__id: '4', __typename: 'User', name: 'Zuck'},
        '5': {__id: '5', __typename: 'User', name: 'Ada Lovelace'},
      }),
    );
    store.notify();
    store.notify();
    expect(updates).toEqual([['4', '5'], ['5'], []]);

    disposable.dispose();
    store.publish(
      RelayRecordSource.create({
        '4': {__id: '4', __typename: 'User', name: 'Mark'},
      }),
    );
    store.notify();
    expect(updates.length).toBe(3);
  });

  it('reports the records a response and a local update wrote', () => {
    const {environment, updates} = createEnvironment();
    environment.commitPayload(createOperationDescriptor(Query, {}), {
      me: {__typename: 'User', id: '4', name: 'Zuck'},
    });
    environment.commitUpdate(store => {
      store.create('5', 'User').setValue('Ada', 'name');
    });
    expect(updates).toEqual([['4', 'client:root'], ['5']]);
  });

  it('does not report an invalidated record as updated', () => {
    const {environment, updates} = createEnvironment();
    environment.commitUpdate(store => {
      store.create('4', 'User').setValue('Zuck', 'name');
    });
    environment.commitUpdate(store => {
      store.get('4')?.invalidateRecord();
    });
    environment.commitUpdate(store => {
      store.invalidateStore();
    });
    expect(updates).toEqual([['4'], [], []]);
  });

  it('reports what an optimistic update wrote, and no records for its rollback', () => {
    const {environment, updates} = createEnvironment();
    const optimistic = environment.applyUpdate({
      storeUpdater: store => {
        store.create('5', 'User').setValue('Ada (optimistic)', 'name');
      },
    });
    expect(updates).toEqual([['5']]);
    updates.length = 0;

    // A response that arrives while the optimistic update is applied.
    environment.commitPayload(createOperationDescriptor(Query, {}), {
      me: {__typename: 'User', id: '4', name: 'Zuck'},
    });
    expect(updates).toEqual([['4', '5', 'client:root']]);
    updates.length = 0;

    // Rolling it back restores the subscriptions' snapshots; no record is
    // written, so none is reported.
    optimistic.dispose();
    expect(updates).toEqual([[]]);
  });

  it('starts each notification fresh even if an observer throws', () => {
    const store = new RelayModernStore(RelayRecordSource.create());
    const disposable = store.observeUpdatedRecordIDs(() => {
      throw new Error('observer failed');
    });
    store.publish(
      RelayRecordSource.create({
        '4': {__id: '4', __typename: 'User', name: 'Zuck'},
      }),
    );
    expect(() => store.notify()).toThrow('observer failed');
    disposable.dispose();

    const updates: Array<Array<DataID>> = [];
    store.observeUpdatedRecordIDs(updatedRecordIDs => {
      updates.push(Array.from(updatedRecordIDs));
    });
    store.publish(
      RelayRecordSource.create({
        '5': {__id: '5', __typename: 'User', name: 'Ada'},
      }),
    );
    store.notify();
    expect(updates).toEqual([['5']]);
  });

  it('includes records a handler wrote', () => {
    const {environment, updates} = createEnvironment();
    environment.commitPayload(createOperationDescriptor(FriendsQuery, {}), {
      me: {
        __typename: 'User',
        friends: {
          edges: [
            {
              __typename: 'FriendsEdge',
              cursor: 'cursor:1',
              node: {__typename: 'User', id: '5', name: 'Ada'},
            },
          ],
          pageInfo: {endCursor: 'cursor:1', hasNextPage: true},
        },
        id: '4',
      },
    });
    const updated = updates.flat();
    expect(
      updated.filter(id =>
        id.includes('__RelayModernStoreObserveUpdatedRecordIDsTest_friends'),
      ).length,
    ).toBeGreaterThan(0);
    expect(updated).toContain('4');
    expect(updated).toContain('5');
  });
});
