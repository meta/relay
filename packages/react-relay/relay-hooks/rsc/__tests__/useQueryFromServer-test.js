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

import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';

const RelayEnvironmentProvider = require('../../RelayEnvironmentProvider');
const useLazyLoadQuery = require('../../useLazyLoadQuery');
const serverPreloadQuery = require('../serverPreloadQuery');
const useQueryFromServer = require('../useQueryFromServer');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  commitLocalUpdate,
  createOperationDescriptor,
  getRequest,
  graphql,
} = require('relay-runtime');
const {
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();

// `@connection` compiles to a LinkedHandle, and normalization turns a handle
// into a field payload rather than a record. A client that only publishes the
// normalized source never creates the record the handle stands for, so the
// store cannot satisfy this query.
const ConnectionQuery = graphql`
  query useQueryFromServerTestConnectionQuery($id: ID!) {
    node(id: $id) {
      ... on Feedback {
        id
        comments(first: 2)
          @connection(key: "useQueryFromServerTestConnectionQuery_comments") {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  }
`;

// No `@connection`, for the cases that are about publishing rather than about
// handle payloads. With one, they would fail for the wrong reason.
const PlainQuery = graphql`
  query useQueryFromServerTestPlainQuery {
    me {
      id
      name
    }
  }
`;

describe('useQueryFromServer with a @connection', () => {
  it('renders the connection from the server payload', async () => {
    // Preload on a *server* environment, exactly as an RSC render does. Only
    // the returned ref crosses to the client — the store this populated, handle
    // records and all, does not.
    const serverEnviornment = new Environment({
      network: Network.create(() =>
        Observable.from({
          data: {
            node: {
              __typename: 'Feedback',
              id: '<feedbackid>',
              comments: {
                edges: [
                  {
                    cursor: 'cursor-1',
                    node: {__typename: 'Comment', id: 'node-1'},
                  },
                ],
                pageInfo: {hasNextPage: false, endCursor: 'cursor-1'},
              },
            },
          },
        }),
      ),
      store: new Store(new RecordSource()),
      isServer: true,
    });
    const queryRef = serverPreloadQuery(serverEnviornment, ConnectionQuery, {
      id: '<feedbackid>',
    });

    const environment = new Environment({
      // Never emits, so a fetch would leave the tree suspended forever.
      network: Network.create(() =>
        Observable.create<GraphQLResponse>(() => {}),
      ),
      store: new Store(new RecordSource()),
    });

    function Comments(): React.Node {
      const data = useQueryFromServer(ConnectionQuery, queryRef);
      return (data.node?.comments?.edges ?? [])
        .map(edge => edge?.node?.id)
        .join(',');
    }

    let renderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Loading">
            <Comments />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    // Let `use(queryRef._response)` settle and the tree re-render.
    await TestRenderer.act(async () => {});

    expect(renderer?.toJSON()).toEqual('node-1');
  });

  it('issues no network request, the response having already been supplied', async () => {
    const serverEnvironment = new Environment({
      network: Network.create(() =>
        Observable.from({
          data: {
            node: {
              __typename: 'Feedback',
              id: '<feedbackid>',
              comments: {
                edges: [
                  {
                    cursor: 'cursor-1',
                    node: {__typename: 'Comment', id: 'node-1'},
                  },
                ],
                pageInfo: {hasNextPage: false, endCursor: 'cursor-1'},
              },
            },
          },
        }),
      ),
      store: new Store(new RecordSource()),
      isServer: true,
    });
    const queryRef = serverPreloadQuery(serverEnvironment, ConnectionQuery, {
      id: '<feedbackid>',
    });

    // A fetch here would mean the hook did not leave the store able to answer
    // the query it was handed.
    const fetch = jest.fn(() => Observable.create<GraphQLResponse>(() => {}));
    const environment = new Environment({
      // $FlowFixMe[invalid-tuple-arity]
      network: Network.create(fetch),
      store: new Store(new RecordSource()),
    });

    function Comments(): React.Node {
      const data = useQueryFromServer(ConnectionQuery, queryRef);
      return (data.node?.comments?.edges ?? [])
        .map(edge => edge?.node?.id)
        .join(',');
    }

    await TestRenderer.act(async () => {
      TestRenderer.create(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Loading">
            <Comments />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    await TestRenderer.act(async () => {});

    expect(fetch).toBeCalledTimes(0);
  });

  it('flushes the deferred notify once the render has committed', async () => {
    const queryRef = serverPreloadQuery(
      new Environment({
        network: Network.create(() =>
          Observable.from({
            data: {
              node: {
                __typename: 'Feedback',
                id: '<feedbackid>',
                comments: {
                  edges: [
                    {
                      cursor: 'cursor-1',
                      node: {__typename: 'Comment', id: 'node-1'},
                    },
                  ],
                  pageInfo: {hasNextPage: false, endCursor: 'cursor-1'},
                },
              },
            },
          }),
        ),
        store: new Store(new RecordSource()),
        isServer: true,
      }),
      ConnectionQuery,
      {id: '<feedbackid>'},
    );

    const environment = new Environment({
      network: Network.create(() =>
        Observable.create<GraphQLResponse>(() => {}),
      ),
      store: new Store(new RecordSource()),
    });
    const notify = jest.spyOn(environment.getStore(), 'notify');

    function Comments(): React.Node {
      const data = useQueryFromServer(ConnectionQuery, queryRef);
      return (data.node?.comments?.edges ?? [])
        .map(edge => edge?.node?.id)
        .join(',');
    }

    await TestRenderer.act(async () => {
      TestRenderer.create(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Loading">
            <Comments />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    await TestRenderer.act(async () => {});

    // Nothing else drives this environment -- no fetch, no mutation -- so the
    // notify can only be the hook's layout effect. Without it the count is 0.
    expect(notify).toBeCalledTimes(1);
  });

  it('flushes when the attempt that published is not the attempt that commits', async () => {
    const queryRef = serverPreloadQuery(
      new Environment({
        network: Network.create(() =>
          Observable.from({
            data: {
              node: {
                __typename: 'Feedback',
                id: '<feedbackid>',
                comments: {
                  edges: [
                    {
                      cursor: 'cursor-1',
                      node: {__typename: 'Comment', id: 'node-1'},
                    },
                  ],
                  pageInfo: {hasNextPage: false, endCursor: 'cursor-1'},
                },
              },
            },
          }),
        ),
        store: new Store(new RecordSource()),
        isServer: true,
      }),
      ConnectionQuery,
      {id: '<feedbackid>'},
    );

    const environment = new Environment({
      network: Network.create(() =>
        Observable.create<GraphQLResponse>(() => {}),
      ),
      store: new Store(new RecordSource()),
    });
    const notify = jest.spyOn(environment.getStore(), 'notify');

    function Comments(): React.Node {
      const data = useQueryFromServer(ConnectionQuery, queryRef);
      return (data.node?.comments?.edges ?? [])
        .map(edge => edge?.node?.id)
        .join(',');
    }

    // StrictMode renders twice and commits the second, which takes the
    // already-published path and produces no continuation of its own. One
    // carried from render to effect would be lost; one keyed on the ref is not.
    await TestRenderer.act(async () => {
      TestRenderer.create(
        <React.StrictMode>
          <RelayEnvironmentProvider environment={environment}>
            <React.Suspense fallback="Loading">
              <Comments />
            </React.Suspense>
          </RelayEnvironmentProvider>
        </React.StrictMode>,
      );
    });
    await TestRenderer.act(async () => {});

    expect(notify).toBeCalledTimes(1);
  });
});

describe('useQueryFromServer publishing into a live store', () => {
  it('keeps the payload when an optimistic update is reverted', async () => {
    const serverEnvironment = new Environment({
      network: Network.create(() =>
        Observable.from({
          data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
        }),
      ),
      store: new Store(new RecordSource()),
      isServer: true,
    });
    const queryRef = serverPreloadQuery(serverEnvironment, PlainQuery, {});

    const environment = new Environment({
      network: Network.create(() =>
        Observable.create<GraphQLResponse>(() => {}),
      ),
      store: new Store(new RecordSource()),
    });

    // An unrelated mutation is in flight, so the store is carrying an
    // optimistic layer when the hook publishes.
    const optimistic = environment.applyUpdate({
      storeUpdater: storeProxy => {
        storeProxy.create('client:unrelated', 'Comment');
      },
    });

    function Name(): React.Node {
      const data = useQueryFromServer(PlainQuery, queryRef);
      return data.me?.name ?? 'no name';
    }

    let renderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Loading">
            <Name />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    await TestRenderer.act(async () => {});

    expect(renderer?.toJSON()).toEqual('Zuck');

    // The mutation settles and its optimistic layer is thrown away.
    await TestRenderer.act(async () => {
      optimistic.dispose();
    });

    // Publishing through the queue put this in the base store, underneath the
    // optimistic layer rather than inside it, so the revert leaves it behind.
    const operation = createOperationDescriptor(getRequest(PlainQuery), {});
    expect(environment.check(operation).status).toEqual('available');
  });

  it('satisfies its own render even when the store has been invalidated', async () => {
    const serverEnvironment = new Environment({
      network: Network.create(() =>
        Observable.from({
          data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
        }),
      ),
      store: new Store(new RecordSource()),
      isServer: true,
    });
    const queryRef = serverPreloadQuery(serverEnvironment, PlainQuery, {});

    let fetchCount = 0;
    const environment = new Environment({
      network: Network.create(() => {
        fetchCount++;
        // Never emits, so a fetch would leave the tree suspended forever.
        return Observable.create<GraphQLResponse>(() => {});
      }),
      store: new Store(new RecordSource()),
    });

    // Any app that has ever reached for the invalidateStore sledgehammer.
    commitLocalUpdate(environment, store => store.invalidateStore());

    function Name(): React.Node {
      const data = useQueryFromServer(PlainQuery, queryRef);
      return data.me?.name ?? 'no name';
    }

    let renderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Loading">
            <Name />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    await TestRenderer.act(async () => {});

    // `usePreloadedQuery` checks the store later in the same render, before any
    // notify. An operation the store has no record of reads as stale once the
    // store has been invalidated, so recording it at publish rather than at the
    // notify is what keeps this from suspending on a fetch for data it just
    // published.
    expect(renderer?.toJSON()).toEqual('Zuck');
    expect(fetchCount).toBe(0);
  });

  it('publishes into each environment a ref is rendered under', async () => {
    const serverEnvironment = new Environment({
      network: Network.create(() =>
        Observable.from({
          data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
        }),
      ),
      store: new Store(new RecordSource()),
      isServer: true,
    });
    // One ref, rendered under two environments -- a second Relay root on the
    // page, or a test reusing a ref across cases.
    const queryRef = serverPreloadQuery(serverEnvironment, PlainQuery, {});

    function makeEnvironment() {
      return new Environment({
        network: Network.create(() =>
          Observable.create<GraphQLResponse>(() => {}),
        ),
        store: new Store(new RecordSource()),
      });
    }

    function Name(): React.Node {
      const data = useQueryFromServer(PlainQuery, queryRef);
      return data.me?.name ?? 'no name';
    }

    async function renderUnder(environment: Environment) {
      let renderer;
      await TestRenderer.act(async () => {
        renderer = TestRenderer.create(
          <RelayEnvironmentProvider environment={environment}>
            <React.Suspense fallback="Loading">
              <Name />
            </React.Suspense>
          </RelayEnvironmentProvider>,
        );
      });
      await TestRenderer.act(async () => {});
      await TestRenderer.act(async () => renderer?.unmount());
    }

    const first = makeEnvironment();
    const second = makeEnvironment();
    await renderUnder(first);
    await renderUnder(second);

    // Tracked globally, the second environment is told the ref was already
    // published, never publishes, and is left with an empty store -- while the
    // fetch policy reads store-or-network on the strength of the first.
    const operation = createOperationDescriptor(getRequest(PlainQuery), {});
    expect(first.check(operation).status).toEqual('available');
    expect(second.check(operation).status).toEqual('available');
  });

  it('a mounted subscriber sees the data the hook published', async () => {
    const serverEnvironment = new Environment({
      network: Network.create(() =>
        Observable.from({
          data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
        }),
      ),
      store: new Store(new RecordSource()),
      isServer: true,
    });
    const queryRef = serverPreloadQuery(serverEnvironment, PlainQuery, {});

    const environment = new Environment({
      network: Network.create(() =>
        Observable.create<GraphQLResponse>(() => {}),
      ),
      store: new Store(new RecordSource()),
    });

    // Someone is already reading `me` and holding a subscription, at the value
    // the store had before the server payload arrived.
    environment.commitPayload(
      createOperationDescriptor(getRequest(PlainQuery), {}),
      {me: {id: '4', __typename: 'User', name: 'Mark'}},
    );

    function Subscriber(): React.Node {
      const data = useLazyLoadQuery<{}, $FlowFixMe>(
        PlainQuery,
        {},
        {fetchPolicy: 'store-only'},
      );
      return data.me?.name ?? 'no name';
    }

    function Name(): React.Node {
      const data = useQueryFromServer(PlainQuery, queryRef);
      return data.me?.name ?? 'no name';
    }

    let renderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Loading">
            <Subscriber />
            <Name />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    await TestRenderer.act(async () => {});

    // The layout effect discharges the deferred notify once the commit lands,
    // so the subscriber re-reads and the two components agree.
    expect(renderer?.toJSON()).toEqual(['Zuck', 'Zuck']);
  });
});
