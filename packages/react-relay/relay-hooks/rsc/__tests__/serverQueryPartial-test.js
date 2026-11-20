/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

'use strict';

import type {RelayHandoffChunk, RelayHandoffRecords} from '../RelayHandoff';
import type {ServerFragmentThenable} from '../useServerFragment';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';

const {getRelayHandoff} = require('../RelayHandoff');
const serverQuery = require('../serverQuery');
const {readServerFragment} = require('../useServerFragment');
const {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  commitLocalUpdate,
  graphql,
} = require('relay-runtime');

const SpreadsQuery = graphql`
  query serverQueryPartialTestSpreadsQuery @server {
    ...serverQueryPartialTestOuter_query
    ...serverQueryPartialTestClient_query @alias(as: "client")
  }
`;

const OuterFragment = graphql`
  fragment serverQueryPartialTestOuter_query on Query @server {
    ...serverQueryPartialTestInner_query
  }
`;

const InnerFragment = graphql`
  fragment serverQueryPartialTestInner_query on Query @server {
    me {
      lastName
    }
  }
`;

graphql`
  fragment serverQueryPartialTestClient_query on Query {
    me {
      username
    }
  }
`;

const NameQuery = graphql`
  query serverQueryPartialTestNameQuery @server {
    me {
      name
    }
  }
`;

const StoreQuery = graphql`
  query serverQueryPartialTestStoreQuery @server {
    me {
      name
      ...serverQueryPartialTestServer_user
      ...serverQueryPartialTestClient_user @alias(as: "client")
    }
  }
`;

const ServerUserFragment = graphql`
  fragment serverQueryPartialTestServer_user on User @server {
    lastName
  }
`;

graphql`
  fragment serverQueryPartialTestClient_user on User {
    username
  }
`;

const ParentQuery = graphql`
  query serverQueryPartialTestParentQuery @server {
    me {
      ...serverQueryPartialTestParent_user
    }
  }
`;

const ParentFragment = graphql`
  fragment serverQueryPartialTestParent_user on User @server {
    name
    ...serverQueryPartialTestServer_user
  }
`;

const ChainQuery = graphql`
  query serverQueryPartialTestChainQuery @server {
    ...serverQueryPartialTestChainParent_query
  }
`;

const ChainParentFragment = graphql`
  fragment serverQueryPartialTestChainParent_query on Query @server {
    me {
      ...serverQueryPartialTestChainMiddle_user
    }
  }
`;

const ChainMiddleFragment = graphql`
  fragment serverQueryPartialTestChainMiddle_user on User @server {
    ...serverQueryPartialTestServer_user
  }
`;

const ChainDeferQuery = graphql`
  query serverQueryPartialTestChainDeferQuery @server {
    ...serverQueryPartialTestChainDeferParent_query
  }
`;

const ChainDeferParentFragment = graphql`
  fragment serverQueryPartialTestChainDeferParent_query on Query @server {
    me {
      ...serverQueryPartialTestChainDeferMiddle_user
    }
  }
`;

const ChainDeferMiddleFragment = graphql`
  fragment serverQueryPartialTestChainDeferMiddle_user on User @server {
    ...serverQueryPartialTestServer_user @defer(label: "child")
  }
`;

const ME = {
  __typename: 'User',
  id: '4',
  lastName: 'Berg',
  name: 'Zuck',
  username: 'zuck',
};

type Tracked<T> = {
  status: 'pending' | 'fulfilled' | 'rejected',
  value: ?T,
  error: unknown,
};

function track<T>(thenable: ServerFragmentThenable<T>): Tracked<T> {
  const tracked: Tracked<T> = {error: null, status: 'pending', value: null};
  thenable.then(
    value => {
      tracked.status = 'fulfilled';
      tracked.value = value;
    },
    error => {
      tracked.status = 'rejected';
      tracked.error = error;
    },
  );
  return tracked;
}

function valueOf<T>(tracked: Tracked<T>): T {
  const value = tracked.value;
  if (tracked.status !== 'fulfilled' || value == null) {
    throw new Error(`Expected a value, the read is ${tracked.status}.`);
  }
  return value;
}

function describeRecords(records: RelayHandoffRecords): string {
  return Object.keys(records)
    .sort()
    .map(id => `${id}{${Object.keys(records[id]).sort().join(',')}}`)
    .join(' ');
}

// The records of a handed-off root, then of each chunk as it arrives.
function followHandoff(ref: unknown): Array<string> {
  const handoff = getRelayHandoff(ref);
  if (handoff == null) {
    throw new Error('Expected a handoff.');
  }
  const chunks = [describeRecords(handoff.records)];
  const follow = (next: Promise<?RelayHandoffChunk>): void => {
    next.then(
      chunk => {
        if (chunk == null) {
          chunks.push('end');
        } else {
          chunks.push(describeRecords(chunk.records));
          follow(chunk.next);
        }
      },
      () => {
        chunks.push('failed');
      },
    );
  };
  follow(handoff.next);
  return chunks;
}

function createServer() {
  const sinks: Array<Sink<GraphQLResponse>> = [];
  const store = new Store(new RecordSource());
  // As in `createServerEnvironment`: a request's Store keeps every record.
  store.holdGC();
  const environment = new Environment({
    isServer: true,
    network: Network.create(() =>
      Observable.create((sink: Sink<GraphQLResponse>) => {
        sinks.push(sink);
      }),
    ),
    store,
  });
  return {environment, sinks};
}

async function flush(): Promise<void> {
  for (let ii = 0; ii < 10; ii++) {
    await Promise.resolve();
  }
}

describe('serverQuery with partial availability', () => {
  it('resolves a query that only spreads fragments before its response arrives', async () => {
    const {environment, sinks} = createServer();
    const query = track(serverQuery(environment, SpreadsQuery, {}));
    await flush();
    const data = valueOf(query);
    // A fragment that only spreads another reads at once.
    const outer = track(readServerFragment(environment, OuterFragment, data));
    const inner = track(
      readServerFragment(environment, InnerFragment, valueOf(outer)),
    );
    const client = followHandoff(data.client);
    await flush();
    expect(inner.status).toBe('pending');
    expect(client).toEqual(['client:root{__typename}']);

    sinks[0].next({data: {me: ME}});
    sinks[0].complete();
    await flush();
    expect(inner.value).toEqual({me: {lastName: 'Berg'}});
    expect(client).toEqual([
      'client:root{__typename}',
      '4{__typename,id,username} client:root{__typename,me}',
      'end',
    ]);
  });

  it('resolves a query whose own data an earlier query of the request wrote; its fragments wait for its response', async () => {
    const {environment, sinks} = createServer();
    const first = serverQuery(environment, NameQuery, {});
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    sinks[0].complete();
    await first;

    const query = track(serverQuery(environment, StoreQuery, {}));
    await flush();
    const me = valueOf(query).me;
    if (me == null) {
      throw new Error('Expected me.');
    }
    expect(me.name).toBe('Zuck');
    const server = track(
      readServerFragment(environment, ServerUserFragment, me),
    );
    const client = followHandoff(me.client);
    await flush();
    expect(server.status).toBe('pending');
    expect(client).toEqual(['4{__typename}']);

    sinks[1].next({data: {me: ME}});
    sinks[1].complete();
    await flush();
    expect(server.value).toEqual({lastName: 'Berg'});
    expect(client).toEqual(['4{__typename}', '4{__typename,username}', 'end']);
  });

  it('resolves a query once a concurrent query of the request writes its own data', async () => {
    const {environment, sinks} = createServer();
    const first = track(serverQuery(environment, NameQuery, {}));
    const second = track(serverQuery(environment, StoreQuery, {}));
    await flush();
    expect(second.status).toBe('pending');

    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    sinks[0].complete();
    await flush();
    expect(first.status).toBe('fulfilled');
    expect(valueOf(second).me?.name).toBe('Zuck');
  });

  it('reads a fragment whose own data the Store has at once; the fragment it spreads waits', async () => {
    const {environment, sinks} = createServer();
    const first = serverQuery(environment, NameQuery, {});
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    sinks[0].complete();
    await first;

    const query = track(serverQuery(environment, ParentQuery, {}));
    await flush();
    const me = valueOf(query).me;
    if (me == null) {
      throw new Error('Expected me.');
    }
    const parent = valueOf(
      track(readServerFragment(environment, ParentFragment, me)),
    );
    expect(parent.name).toBe('Zuck');
    const child = track(
      readServerFragment(environment, ServerUserFragment, parent),
    );
    await flush();
    expect(child.status).toBe('pending');

    sinks[1].next({data: {me: ME}});
    sinks[1].complete();
    await flush();
    expect(child.value).toEqual({lastName: 'Berg'});
  });

  it("reads a fragment that only spreads another at once on an object a parent fragment's field reached from the Store", async () => {
    const {environment, sinks} = createServer();
    const first = serverQuery(environment, NameQuery, {});
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    sinks[0].complete();
    await first;

    const query = track(serverQuery(environment, ChainQuery, {}));
    await flush();
    const me = valueOf(
      track(
        readServerFragment(environment, ChainParentFragment, valueOf(query)),
      ),
    ).me;
    if (me == null) {
      throw new Error('Expected me.');
    }
    const middle = valueOf(
      track(readServerFragment(environment, ChainMiddleFragment, me)),
    );
    const child = track(
      readServerFragment(environment, ServerUserFragment, middle),
    );
    await flush();
    expect(child.status).toBe('pending');

    sinks[1].next({data: {me: ME}});
    sinks[1].complete();
    await flush();
    expect(child.value).toEqual({lastName: 'Berg'});
  });

  it("reads a fragment that only spreads another at once on an object a parent fragment's field reached from the first payload", async () => {
    const {environment, sinks} = createServer();
    const query = track(serverQuery(environment, ChainDeferQuery, {}));
    await flush();
    // The parent reads `me`, which the first payload brings.
    const parent = track(
      readServerFragment(environment, ChainDeferParentFragment, valueOf(query)),
    );
    sinks[0].next({
      data: {me: {__typename: 'User', id: '4'}},
      extensions: {is_final: false},
    });
    await flush();
    const me = valueOf(parent).me;
    if (me == null) {
      throw new Error('Expected me.');
    }
    const middle = valueOf(
      track(readServerFragment(environment, ChainDeferMiddleFragment, me)),
    );
    const child = track(
      readServerFragment(environment, ServerUserFragment, middle),
    );
    await flush();
    expect(child.status).toBe('pending');

    sinks[0].next({
      data: {id: '4', lastName: 'Berg'},
      label: 'serverQueryPartialTestChainDeferMiddle_user$defer$child',
      path: ['me'],
    });
    sinks[0].complete();
    await flush();
    expect(child.value).toEqual({lastName: 'Berg'});
  });

  it('fails the reads still waiting, not the query, when the request fails after the query resolved', async () => {
    const {environment, sinks} = createServer();
    const query = track(serverQuery(environment, SpreadsQuery, {}));
    await flush();
    const data = valueOf(query);
    const inner = track(
      readServerFragment(
        environment,
        InnerFragment,
        valueOf(track(readServerFragment(environment, OuterFragment, data))),
      ),
    );
    const client = followHandoff(data.client);
    sinks[0].error(new Error('backend failed'));
    await flush();
    expect(inner.status).toBe('rejected');
    expect(String(inner.error)).toContain('backend failed');
    expect(client).toEqual(['client:root{__typename}', 'failed']);
  });

  it('rejects when its signal was already aborted, although the Store has its data', async () => {
    const {environment, sinks} = createServer();
    const first = serverQuery(environment, NameQuery, {});
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    sinks[0].complete();
    await first;

    const signal = {
      aborted: true,
      addEventListener(): void {},
    };
    await expect(
      serverQuery(environment, StoreQuery, {}, {signal}),
    ).rejects.toThrow('serverQuery: The request was cancelled.');
  });

  it('waits for its response when the data it reads was invalidated', async () => {
    const {environment, sinks} = createServer();
    const first = serverQuery(environment, NameQuery, {});
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    sinks[0].complete();
    await first;
    commitLocalUpdate(environment, store => {
      store.invalidateStore();
    });

    const query = track(serverQuery(environment, NameQuery, {}));
    await flush();
    expect(query.status).toBe('pending');

    sinks[1].next({data: {me: {__typename: 'User', id: '4', name: 'Mark'}}});
    sinks[1].complete();
    await flush();
    expect(valueOf(query).me?.name).toBe('Mark');
  });
});
