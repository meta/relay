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

import type {Fragment, FragmentType, IEnvironment} from 'relay-runtime';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';

const {getRelayHandoff} = require('../RelayHandoff');
const RelayServerHandoff = require('../RelayServerHandoff');
const serverQuery = require('../serverQuery');
const {readServerFragment, useServerFragment} = require('../useServerFragment');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const {
  Environment,
  Network,
  Observable,
  RecordSource,
  RelayFeatureFlags,
  Store,
  graphql,
} = require('relay-runtime');

const Query = graphql`
  query serverQueryTestQuery @server {
    me {
      name
      ...serverQueryTestClient_user @alias(as: "client")
      ...serverQueryTestDeferred_user @defer(label: "deferred")
    }
  }
`;

const DeferredFragment = graphql`
  fragment serverQueryTestDeferred_user on User @server {
    lastName
  }
`;

const ClientFragment = graphql`
  fragment serverQueryTestClient_user on User {
    name
  }
`;

// A server fragment read as a promise.
function serverRead<TFragmentType extends FragmentType, TData>(
  environment: IEnvironment,
  fragment: Fragment<TFragmentType, TData>,
  fragmentRef: {readonly $fragmentSpreads: TFragmentType, ...},
): Promise<TData> {
  const read = readServerFragment(environment, fragment, fragmentRef);
  return new Promise((resolve, reject) => read.then(resolve, reject));
}

function createServer() {
  const sinks: Array<Sink<GraphQLResponse>> = [];
  const cancelled: Array<boolean> = [];
  const environment = new Environment({
    isServer: true,
    network: Network.create(() =>
      Observable.create((sink: Sink<GraphQLResponse>) => {
        const index = sinks.length;
        sinks.push(sink);
        cancelled.push(false);
        return () => {
          cancelled[index] = true;
        };
      }),
    ),
    store: new Store(new RecordSource()),
  });
  return {cancelled, environment, sinks};
}

// An `AbortController` (whose type not every Flow environment declares).
function createAbortController() {
  let listeners: Array<() => void> = [];
  const signal = {
    aborted: false,
    addEventListener(
      type: 'abort',
      listener: () => void,
      options: {once: boolean},
    ): void {
      listeners.push(listener);
    },
    removeEventListener(type: 'abort', listener: () => void): void {
      listeners = listeners.filter(item => item !== listener);
    },
  };
  return {
    abort(): void {
      signal.aborted = true;
      listeners.forEach(listener => listener());
    },
    listenerCount: (): number => listeners.length,
    signal,
  };
}

async function flush(): Promise<void> {
  for (let ii = 0; ii < 10; ii++) {
    await Promise.resolve();
  }
}

describe('serverQuery', () => {
  it('resolves after the first payload; reads wait for deferred data', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: false},
    });
    const data = await result;
    const me = data.me;
    if (me == null) {
      throw new Error('Expected me.');
    }
    expect(me.name).toBe('Zuck');

    let deferred = null;
    const read = serverRead(environment, DeferredFragment, me).then(value => {
      deferred = value;
    });
    await flush();
    expect(deferred).toBe(null);
    sinks[0].next({
      data: {id: '4', lastName: 'Berg'},
      label: 'serverQueryTestQuery$defer$deferred',
      path: ['me'],
    });
    sinks[0].complete();
    await read;
    expect(deferred).toEqual({lastName: 'Berg'});
  });

  it('executes a query with the same variables once per request', async () => {
    const {environment, sinks} = createServer();
    const first = serverQuery(environment, Query, {});
    const second = serverQuery(environment, Query, {});
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    sinks[0].next({
      data: {id: '4', lastName: 'Berg'},
      label: 'serverQueryTestQuery$defer$deferred',
      path: ['me'],
    });
    sinks[0].complete();
    expect((await first).me?.name).toBe('Zuck');
    expect((await second).me?.name).toBe('Zuck');
    // Once the request completed, the query's data is in the Store.
    expect((await serverQuery(environment, Query, {})).me?.name).toBe('Zuck');
    expect(sinks.length).toBe(1);
  });

  it('cancels only the caller whose signal aborts', async () => {
    const {cancelled, environment, sinks} = createServer();
    const first = createAbortController();
    const second = createAbortController();
    const firstResult = serverQuery(
      environment,
      Query,
      {},
      {
        signal: first.signal,
      },
    );
    const secondResult = serverQuery(
      environment,
      Query,
      {},
      {
        signal: second.signal,
      },
    );
    first.abort();
    await expect(firstResult).rejects.toThrow(
      'serverQuery: The request was cancelled.',
    );
    expect(cancelled).toEqual([false]);
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    expect((await secondResult).me?.name).toBe('Zuck');
  });

  it('cancels the request once every caller aborted, and executes it again later', async () => {
    const {cancelled, environment, sinks} = createServer();
    const first = createAbortController();
    const second = createAbortController();
    const firstResult = serverQuery(
      environment,
      Query,
      {},
      {
        signal: first.signal,
      },
    );
    const secondResult = serverQuery(
      environment,
      Query,
      {},
      {
        signal: second.signal,
      },
    );
    first.abort();
    second.abort();
    expect(cancelled).toEqual([true]);
    await expect(firstResult).rejects.toThrow('cancelled');
    await expect(secondResult).rejects.toThrow('cancelled');
    const later = serverQuery(environment, Query, {});
    expect(sinks.length).toBe(2);
    sinks[1].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    expect((await later).me?.name).toBe('Zuck');
  });

  it("reads each artifact's data when two artifacts share a request", async () => {
    // `Query` as another project compiles it: the same operation (so the
    // same request identifier), with the client reference under another
    // alias.
    const OtherQuery: typeof Query = JSON.parse(
      JSON.stringify(Query).replace(
        '"kind":"AliasedInlineFragmentSpread","name":"client"',
        '"kind":"AliasedInlineFragmentSpread","name":"other"',
      ),
    );
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    const otherResult = serverQuery(environment, OtherQuery, {});
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    const data = await result;
    const otherData = await otherResult;
    const other: {[key: string]: unknown} = {...otherData.me};
    expect(other.client).toBe(undefined);
    expect(getRelayHandoff(other.other)?.records).toEqual(
      getRelayHandoff(data.me?.client)?.records,
    );
    expect(sinks.length).toBe(1);
  });

  it('cancels the request when the signal aborts', async () => {
    const {cancelled, environment, sinks} = createServer();
    const controller = createAbortController();
    const result = serverQuery(
      environment,
      Query,
      {},
      {signal: controller.signal},
    );
    expect(sinks.length).toBe(1);
    controller.abort();
    expect(cancelled[0]).toBe(true);
    await expect(result).rejects.toThrow(
      'serverQuery: The request was cancelled.',
    );
  });

  it('removes its abort listener once the request completes or fails', async () => {
    const completed = createServer();
    const completedController = createAbortController();
    const result = serverQuery(
      completed.environment,
      Query,
      {},
      {signal: completedController.signal},
    );
    expect(completedController.listenerCount()).toBe(1);
    completed.sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
    });
    completed.sinks[0].complete();
    await result;
    expect(completedController.listenerCount()).toBe(0);

    const failed = createServer();
    const failedController = createAbortController();
    const failure = serverQuery(
      failed.environment,
      Query,
      {},
      {signal: failedController.signal},
    );
    failed.sinks[0].error(new Error('backend failed'));
    await expect(failure).rejects.toThrow('backend failed');
    expect(failedController.listenerCount()).toBe(0);
  });

  it('rejects when the request fails before the first payload', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    sinks[0].error(new Error('backend failed'));
    await expect(result).rejects.toThrow('backend failed');
  });

  it('requires explicit null fragment arguments', () => {
    const {environment} = createServer();
    RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS = false;
    try {
      expect(() => serverQuery(environment, Query, {})).toThrow(
        'serverQuery: Relay RSC requires `RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS` (on by default). Set `RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS = true`, with `RelayFeatureFlags` from `relay-runtime`.',
      );
    } finally {
      RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS = true;
    }
  });

  it('rejects with the GraphQL errors of a response without data', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    sinks[0].next({data: null, errors: [{message: 'Ledger unavailable'}]});
    await expect(result).rejects.toThrow(/^Ledger unavailable$/);
  });

  it('rejects with only the GraphQL error messages that are strings', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    // As parsed from a server that breaks the GraphQL spec.
    sinks[0].next(
      JSON.parse(
        '{"data": null, "errors": [{"message": "Ledger unavailable"}, {"message": null}]}',
      ),
    );
    await expect(result).rejects.toThrow(/^Ledger unavailable$/);
  });

  it('rejects with the request error when no GraphQL error has a message', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    sinks[0].next(JSON.parse('{"data": null, "errors": [{"message": null}]}'));
    await expect(result).rejects.toThrow(
      'No data returned for operation `serverQueryTestQuery`',
    );
  });

  it('rejects an empty response', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    sinks[0].complete();
    await expect(result).rejects.toThrow(
      'serverQuery: `serverQueryTestQuery` completed without data.',
    );
  });

  it('rejects a response whose payloads carry no data', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    sinks[0].next({data: null, extensions: {cost: 1}});
    sinks[0].next([]);
    sinks[0].complete();
    await expect(result).rejects.toThrow(
      'serverQuery: `serverQueryTestQuery` completed without data.',
    );
  });

  it('disposes the request when it is aborted while subscribing', async () => {
    const controller = createAbortController();
    let disposed = false;
    const environment = new Environment({
      isServer: true,
      network: Network.create(() =>
        Observable.create(() => {
          controller.abort();
          return () => {
            disposed = true;
          };
        }),
      ),
      store: new Store(new RecordSource()),
    });
    const result = serverQuery(
      environment,
      Query,
      {},
      {signal: controller.signal},
    );
    await expect(result).rejects.toThrow(
      'serverQuery: The request was cancelled.',
    );
    expect(disposed).toBe(true);
  });

  it('does not execute with an already aborted signal', async () => {
    const {environment, sinks} = createServer();
    const controller = createAbortController();
    controller.abort();
    const result = serverQuery(
      environment,
      Query,
      {},
      {signal: controller.signal},
    );
    expect(sinks.length).toBe(0);
    await expect(result).rejects.toThrow(
      'serverQuery: The request was cancelled.',
    );
  });
});

describe('server fragment reads', () => {
  async function startDeferred() {
    const server = createServer();
    const result = serverQuery(server.environment, Query, {});
    server.sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: false},
    });
    const data = await result;
    const me = data.me;
    if (me == null) {
      throw new Error('Expected me.');
    }
    return {...server, me};
  }

  it('returns present data synchronously (no suspension)', async () => {
    const {environment, me, sinks} = await startDeferred();
    sinks[0].next({
      data: {id: '4', lastName: 'Berg'},
      label: 'serverQueryTestQuery$defer$deferred',
      path: ['me'],
    });
    const thenable = readServerFragment(environment, DeferredFragment, me);
    expect(thenable).toEqual(
      expect.objectContaining({status: 'fulfilled', value: {lastName: 'Berg'}}),
    );

    let fallbacks = 0;
    function Fallback() {
      fallbacks++;
      return 'loading';
    }
    function Deferred() {
      const data = useServerFragment(environment, DeferredFragment, me);
      return data.lastName;
    }
    let renderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        <React.Suspense fallback={<Fallback />}>
          <Deferred />
        </React.Suspense>,
      );
    });
    expect(renderer?.toJSON()).toBe('Berg');
    expect(fallbacks).toBe(0);
  });

  it('rejects instead of hanging when the request ends without the data', async () => {
    const {environment, me, sinks} = await startDeferred();
    const read = serverRead(environment, DeferredFragment, me);
    sinks[0].complete();
    await expect(read).rejects.toThrow(
      'readServerFragment: The server query `serverQueryTestQuery` completed without the data of fragment `serverQueryTestDeferred_user`.',
    );
  });

  it('keeps rejecting reads after the request ended without the data', async () => {
    const {environment, me, sinks} = await startDeferred();
    sinks[0].complete();
    await flush();
    await expect(serverRead(environment, DeferredFragment, me)).rejects.toThrow(
      'completed without the data',
    );
    await expect(serverRead(environment, DeferredFragment, me)).rejects.toThrow(
      'completed without the data',
    );
  });

  it('treats a final payload as the end of the request', async () => {
    const {environment, me, sinks} = await startDeferred();
    const read = serverRead(environment, DeferredFragment, me);
    sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: true},
    });
    await expect(read).rejects.toThrow('completed without the data');
  });

  it('only reads @server fragments with useServerFragment', async () => {
    const {environment, me} = await startDeferred();
    const client = me.client;
    if (client == null) {
      throw new Error('Expected a client fragment reference.');
    }
    component Reader() {
      useServerFragment(environment, ClientFragment, client);
      return null;
    }
    expect(() =>
      TestRenderer.act(() => {
        TestRenderer.create(<Reader />);
      }),
    ).toThrow(
      'useServerFragment: Expected `serverQueryTestClient_user` to be a `@server` fragment.',
    );
  });

  it('rejects when the request fails later', async () => {
    const {environment, me, sinks} = await startDeferred();
    const read = serverRead(environment, DeferredFragment, me);
    sinks[0].error(new Error('stream failed'));
    await expect(read).rejects.toThrow('stream failed');
  });

  it('reads a reference through the Environment of its own request', async () => {
    const {me, sinks} = await startDeferred();
    // E.g. a component module that a hot reload left with another
    // `createServerEnvironment` instance.
    const other = createServer();
    const read = serverRead(other.environment, DeferredFragment, me);
    sinks[0].next({
      data: {id: '4', lastName: 'Berg'},
      label: 'serverQueryTestQuery$defer$deferred',
      path: ['me'],
    });
    await expect(read).resolves.toEqual({lastName: 'Berg'});
  });

  it('treats a @defer payload at a list index as changing lists in any way', async () => {
    const sync = jest.spyOn(RelayServerHandoff.prototype, 'sync');
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, Query, {});
    sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: false},
    });
    await result;
    sync.mockClear();
    // A @defer payload, even at a list index, may change lists in any way.
    sinks[0].next({
      data: {id: '4', lastName: 'Berg'},
      label: 'serverQueryTestQuery$defer$deferred',
      path: ['me', 'friends', 'edges', 0],
    });
    expect(sync.mock.calls).toEqual([[null]]);
    sync.mockRestore();
  });
});
