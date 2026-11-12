/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 * @jest-environment jsdom
 */

'use strict';

import type {RelayHandoffChunk} from '../RelayHandoff';
import type {RelayHandoff} from '../RelayHandoff';
import type {useRelayHandoffHydrationTestClientObject_query$key} from './__generated__/useRelayHandoffHydrationTestClientObject_query.graphql';
import type {useRelayHandoffHydrationTestGreeting_user$key} from './__generated__/useRelayHandoffHydrationTestGreeting_user.graphql';
import type {useRelayHandoffHydrationTestLiveName_user$key} from './__generated__/useRelayHandoffHydrationTestLiveName_user.graphql';
import type {useRelayHandoffHydrationTestNameLength_user$key} from './__generated__/useRelayHandoffHydrationTestNameLength_user.graphql';
import type {useRelayHandoffTestActors_user$key} from './__generated__/useRelayHandoffTestActors_user.graphql';
import type {useRelayHandoffTestDeferChild_user$key} from './__generated__/useRelayHandoffTestDeferChild_user.graphql';
import type {useRelayHandoffTestDeferParent_user$key} from './__generated__/useRelayHandoffTestDeferParent_user.graphql';
import type {useRelayHandoffTestStream_user$key} from './__generated__/useRelayHandoffTestStream_user.graphql';
import type {useRelayHandoffTestStreamConnection_user$key} from './__generated__/useRelayHandoffTestStreamConnection_user.graphql';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {EnvironmentConfig} from 'relay-runtime/store/RelayModernEnvironment';

const {installRelayHandoff} = require('../../../rsc-client_EXPERIMENTAL');
const RelayEnvironmentProvider = require('../../RelayEnvironmentProvider');
const useFragment = require('../../useFragment');
const {getRelayHandoff} = require('../RelayHandoff');
const serverQuery = require('../serverQuery');
const ActorsFragment = require('./__generated__/useRelayHandoffTestActors_user.graphql');
const DeferChildFragment = require('./__generated__/useRelayHandoffTestDeferChild_user.graphql');
const DeferChildQuery = require('./__generated__/useRelayHandoffTestDeferChildQuery.graphql');
const DeferParentFragment = require('./__generated__/useRelayHandoffTestDeferParent_user.graphql');
const StreamFragment = require('./__generated__/useRelayHandoffTestStream_user.graphql');
const StreamConnectionFragment = require('./__generated__/useRelayHandoffTestStreamConnection_user.graphql');
const StreamConnectionQuery = require('./__generated__/useRelayHandoffTestStreamConnectionQuery.graphql');
const StreamQuery = require('./__generated__/useRelayHandoffTestStreamQuery.graphql');
const {
  relayHandoffTestLiveSubscriptions,
  setRelayHandoffTestLiveSuffix,
} = require('./RelayHandoffTestLiveNameResolver');
const {
  ADA,
  GRACE,
  actorsPayload,
  createActorsServer,
  handedOffActors,
  serveOverlappingActors,
} = require('./RelayHandoffTestOverlappingQueries');
const React = require('react');
const {act, startTransition, use, useLayoutEffect} = require('react');
const {
  Environment: RelayEnvironment,
  Network,
  Observable,
  Record,
  RecordSource,
  RelayFeatureFlags,
  Store,
  graphql,
} = require('relay-runtime');

// www, where this test also syncs, has no `react-dom/client`; Flow resolves
// a literal module name even in `jest.requireActual`.
const ReactDOMClient = jest.requireActual<any>(
  ['react-dom', 'client'].join('/'),
);

const NameLengthAQuery = graphql`
  query useRelayHandoffHydrationTestNameLengthAQuery @server {
    me {
      ...useRelayHandoffHydrationTestNameLength_user @alias(as: "client")
    }
  }
`;

const NameLengthBQuery = graphql`
  query useRelayHandoffHydrationTestNameLengthBQuery @server {
    me {
      lastName
      ...useRelayHandoffHydrationTestNameLength_user @alias(as: "client")
    }
  }
`;

// Reads a Relay Resolver field derived from the name.
const NameLengthFragment = graphql`
  fragment useRelayHandoffHydrationTestNameLength_user on User {
    name
    relayHandoffTestNameLength
  }
`;

// A second server query that hands off the same `@defer` fragment.
const DeferTwinQuery = graphql`
  query useRelayHandoffHydrationTestDeferTwinQuery @server {
    me {
      ...useRelayHandoffTestDeferParent_user @alias(as: "parent")
    }
  }
`;

const ClientObjectQuery = graphql`
  query useRelayHandoffHydrationTestClientObjectQuery @server {
    ...useRelayHandoffHydrationTestClientObject_query @alias(as: "client")
  }
`;

// Reads a Relay Resolver field that returns a client object.
const ClientObjectFragment = graphql`
  fragment useRelayHandoffHydrationTestClientObject_query on Query {
    me {
      name
    }
    example_client_object {
      description
    }
  }
`;

const LiveNameQuery = graphql`
  query useRelayHandoffHydrationTestLiveNameQuery @server {
    me {
      ...useRelayHandoffHydrationTestLiveName_user @alias(as: "client")
    }
  }
`;

// Reads a Live Relay Resolver field.
const LiveNameFragment = graphql`
  fragment useRelayHandoffHydrationTestLiveName_user on User {
    relayHandoffTestLiveName
  }
`;

const GreetingQuery = graphql`
  query useRelayHandoffHydrationTestGreetingQuery @server {
    me {
      ...useRelayHandoffHydrationTestGreeting_user @alias(as: "client")
    }
  }
`;

// Reads a Relay Resolver field that reads the resolver context.
const GreetingFragment = graphql`
  fragment useRelayHandoffHydrationTestGreeting_user on User {
    relayHandoffTestGreeting
  }
`;

// OSS Flow (`builtin_lib=core-only`) has no DOM globals.
const {document} = global;

class Environment extends RelayEnvironment {
  constructor(config: EnvironmentConfig) {
    super(config);
    installRelayHandoff(this);
  }
}

global.IS_REACT_ACT_ENVIRONMENT = true;
// React Flight decodes a chunk that has arrived as a thenable that calls back
// synchronously.
async function settleArrivedChunks(
  next: Promise<?RelayHandoffChunk>,
  holder: {...},
): Promise<void> {
  const chunk = await next;
  const property: string = 'next';
  Object.defineProperty(holder, property, {
    value: {
      then: (resolve: (next: ?RelayHandoffChunk) => void) => resolve(chunk),
    },
  });
  if (chunk != null) {
    await settleArrivedChunks(chunk.next, chunk);
  }
}

component List(user: useRelayHandoffTestStream_user$key) {
  const data = useFragment(StreamFragment, user);
  return (
    <ul>
      {(data.friends?.edges ?? []).map(edge => (
        <li key={edge?.node?.name}>{edge?.node?.name}</li>
      ))}
    </ul>
  );
}

component DeferChild(user: useRelayHandoffTestDeferChild_user$key) {
  return ` ${useFragment(DeferChildFragment, user).lastName ?? ''}`;
}

component DeferParent(user: useRelayHandoffTestDeferParent_user$key) {
  const data = useFragment(DeferParentFragment, user);
  return (
    <>
      {data.name}
      <DeferChild user={data} />
    </>
  );
}

component People(user: useRelayHandoffTestStreamConnection_user$key) {
  const data = useFragment(StreamConnectionFragment, user);
  return (
    <ul>
      {(data.friends?.edges ?? []).map(edge => (
        <li key={edge?.node?.name}>{edge?.node?.name}</li>
      ))}
    </ul>
  );
}

component Actors(user: useRelayHandoffTestActors_user$key) {
  const data = useFragment(ActorsFragment, user);
  return <span>{(data.actors ?? []).map(actor => actor?.name).join(',')}</span>;
}

async function settleHandoff(ref: unknown): Promise<void> {
  const handoff = getRelayHandoff(ref);
  if (handoff == null) {
    throw new Error('Expected a handoff.');
  }
  await settleArrivedChunks(handoff.next, handoff);
}

component NameLength(user: useRelayHandoffHydrationTestNameLength_user$key) {
  const data = useFragment(NameLengthFragment, user);
  return (
    <span>
      {data.name} {data.relayHandoffTestNameLength}
    </span>
  );
}

component ClientObject(
  query: useRelayHandoffHydrationTestClientObject_query$key,
) {
  const data = useFragment(ClientObjectFragment, query);
  return (
    <span>
      {data.me?.name}: {data.example_client_object?.description}
    </span>
  );
}

component LiveName(user: useRelayHandoffHydrationTestLiveName_user$key) {
  const data = useFragment(LiveNameFragment, user);
  return <span>{data.relayHandoffTestLiveName}</span>;
}

component Greeting(user: useRelayHandoffHydrationTestGreeting_user$key) {
  const data = useFragment(GreetingFragment, user);
  return <span>{data.relayHandoffTestGreeting}</span>;
}

function createClient(): Environment {
  return new Environment({
    network: Network.create(() => Observable.create(() => {})),
    store: new Store(new RecordSource()),
  });
}

describe('hydrating a handed-off reference', () => {
  it('renders what the server rendered, then the chunks that arrived since', async () => {
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
    const result = serverQuery(server, StreamQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {
            edges: [{node: {__typename: 'User', id: 'f0', name: 'f0'}}],
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const list = (await result).me?.list;
    const handoff = getRelayHandoff(list);
    if (list == null || handoff == null) {
      throw new Error('Expected a handed-off reference.');
    }
    // The server rendered the list before its next item arrived; the item
    // arrives before the browser hydrates.
    const container = document.createElement('div');
    container.innerHTML = '<ul><li>f0</li></ul>';
    sinks[0].next({
      data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
      label: 'useRelayHandoffTestStream_user$stream$edges',
      path: ['me', 'friends', 'edges', 1],
    });
    sinks[0].complete();
    await settleArrivedChunks(handoff.next, handoff);

    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    const errors: Array<string> = [];
    await act(async () => {
      ReactDOMClient.hydrateRoot(
        container,
        <RelayEnvironmentProvider environment={client}>
          <List user={list} />
        </RelayEnvironmentProvider>,
        {
          onRecoverableError: error => {
            errors.push(String(error));
          },
        },
      );
    });
    expect(errors).toEqual([]);
    expect(container.innerHTML).toBe('<ul><li>f0</li><li>f1</li></ul>');
  });

  it('renders what the server rendered for a connection, then the edges that streamed since', async () => {
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
    const person = (index: number) => ({
      cursor: `cursor:${index}`,
      node: {__typename: 'User', id: `p${index}`, name: `P${index}`},
    });
    const result = serverQuery(server, StreamConnectionQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {
            edges: [person(1)],
            pageInfo: {endCursor: 'cursor:2', hasNextPage: false},
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const people = (await result).me?.people;
    const handoff = getRelayHandoff(people);
    if (people == null || handoff == null) {
      throw new Error('Expected a handed-off reference.');
    }
    // The server rendered the first edge; the next one streams in before the
    // browser hydrates. The handoff carries the connection only through its
    // handle, and its chunk must still wait for the hydration to commit.
    const container = document.createElement('div');
    container.innerHTML = '<ul><li>P1</li></ul>';
    sinks[0].next({
      data: person(2),
      label: 'useRelayHandoffTestStreamConnection_user$stream$people',
      path: ['me', 'friends', 'edges', 1],
    });
    sinks[0].complete();
    await settleArrivedChunks(handoff.next, handoff);

    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    const errors: Array<string> = [];
    await act(async () => {
      ReactDOMClient.hydrateRoot(
        container,
        <RelayEnvironmentProvider environment={client}>
          <People user={people} />
        </RelayEnvironmentProvider>,
        {
          onRecoverableError: error => {
            errors.push(String(error));
          },
        },
      );
    });
    expect(errors).toEqual([]);
    expect(container.innerHTML).toBe('<ul><li>P1</li><li>P2</li></ul>');
  });

  it('renders and commits a hydrating reader once when nothing was held', async () => {
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
    const result = serverQuery(server, StreamQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {
            edges: [{node: {__typename: 'User', id: 'f0', name: 'f0'}}],
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const list = (await result).me?.list;
    const handoff = getRelayHandoff(list);
    if (list == null || handoff == null) {
      throw new Error('Expected a handed-off reference.');
    }
    sinks[0].complete();
    await settleArrivedChunks(handoff.next, handoff);

    const container = document.createElement('div');
    container.innerHTML = '<ul><li>f0</li></ul>';
    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    let renders = 0;
    let commits = 0;
    component CountedList(user: useRelayHandoffTestStream_user$key) {
      renders++;
      const data = useFragment(StreamFragment, user);
      useLayoutEffect(() => {
        commits++;
      });
      return (
        <ul>
          {(data.friends?.edges ?? []).map(edge => (
            <li key={edge?.node?.name}>{edge?.node?.name}</li>
          ))}
        </ul>
      );
    }
    const errors: Array<string> = [];
    await act(async () => {
      ReactDOMClient.hydrateRoot(
        container,
        <RelayEnvironmentProvider environment={client}>
          <CountedList user={list} />
        </RelayEnvironmentProvider>,
        {
          onRecoverableError: error => {
            errors.push(String(error));
          },
        },
      );
    });
    expect(errors).toEqual([]);
    expect({commits, renders}).toEqual({commits: 1, renders: 1});
  });

  it('commits the chunks that already arrived in a render that is not hydrating', async () => {
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
    const result = serverQuery(server, StreamQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {
            edges: [{node: {__typename: 'User', id: 'f0', name: 'f0'}}],
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const list = (await result).me?.list;
    const handoff = getRelayHandoff(list);
    if (list == null || handoff == null) {
      throw new Error('Expected a handed-off reference.');
    }
    // A client navigation: the next item arrives with the page, before React
    // renders it.
    sinks[0].next({
      data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
      label: 'useRelayHandoffTestStream_user$stream$edges',
      path: ['me', 'friends', 'edges', 1],
    });
    sinks[0].complete();
    await settleArrivedChunks(handoff.next, handoff);

    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    const committed: Array<number> = [];
    component CountedList(user: useRelayHandoffTestStream_user$key) {
      const count = useFragment(StreamFragment, user).friends?.edges?.length;
      useLayoutEffect(() => {
        committed.push(count ?? 0);
      });
      return count;
    }
    await act(async () => {
      ReactDOMClient.createRoot(document.createElement('div')).render(
        <RelayEnvironmentProvider environment={client}>
          <CountedList user={list} />
        </RelayEnvironmentProvider>,
      );
    });
    expect(committed).toEqual([2]);
  });

  it('does not suspend for a `@defer` chunk that already arrived in a render that is not hydrating', async () => {
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
    const result = serverQuery(server, DeferChildQuery, {});
    sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: false},
    });
    const parent = (await result).me?.parent;
    const handoff = getRelayHandoff(parent);
    if (parent == null || handoff == null) {
      throw new Error('Expected a handed-off reference.');
    }
    // A client navigation: the `@defer` payload arrives with the page, before
    // React renders it.
    sinks[0].next({
      data: {__typename: 'User', id: '4', lastName: 'Zuckerberg'},
      label: 'useRelayHandoffTestDeferParent_user$defer$child',
      path: ['me'],
    });
    sinks[0].complete();
    await settleArrivedChunks(handoff.next, handoff);

    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    const fallbacks: Array<string> = [];
    component Fallback() {
      useLayoutEffect(() => {
        fallbacks.push('loading');
      });
      return 'loading';
    }
    const container = document.createElement('div');
    await act(async () => {
      ReactDOMClient.createRoot(container).render(
        <RelayEnvironmentProvider environment={client}>
          <React.Suspense fallback={<Fallback />}>
            <DeferParent user={parent} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    expect(fallbacks).toEqual([]);
    expect(container.textContent).toBe('Zuck Zuckerberg');
  });

  it('hydrates what the server rendered with a `@defer` chunk the root needs that arrives during hydration', async () => {
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
    const result = serverQuery(server, DeferChildQuery, {});
    sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: false},
    });
    const parent = (await result).me?.parent;
    if (parent == null) {
      throw new Error('Expected a handed-off reference.');
    }
    // The server rendered the reader once the `@defer` payload arrived.
    const container = document.createElement('div');
    container.innerHTML = '<!--$-->Zuck<!-- --> Zuckerberg<!--/$-->';
    const errors: Array<string> = [];
    await act(async () => {
      ReactDOMClient.hydrateRoot(
        container,
        <RelayEnvironmentProvider environment={createClient()}>
          <React.Suspense fallback="loading">
            <DeferParent user={parent} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
        {onRecoverableError: error => errors.push(String(error))},
      );
    });
    await act(async () => {
      sinks[0].next({
        data: {__typename: 'User', id: '4', lastName: 'Zuckerberg'},
        label: 'useRelayHandoffTestDeferParent_user$defer$child',
        path: ['me'],
      });
      sinks[0].complete();
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe('Zuck Zuckerberg');
  });

  it('hydrates a fragment spread inside a handed-off fragment from the root records too', async () => {
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
    const start = async (
      query: typeof DeferChildQuery,
    ): Promise<{
      parent: useRelayHandoffTestDeferParent_user$key,
      handoff: RelayHandoff,
    }> => {
      const result = serverQuery(server, query, {});
      sinks[sinks.length - 1].next({
        data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
        extensions: {is_final: false},
      });
      const parent = (await result).me?.parent;
      const handoff = getRelayHandoff(parent);
      if (parent == null || handoff == null) {
        throw new Error('Expected a handed-off reference.');
      }
      return {handoff, parent};
    };
    // Two server queries of one request; the second's spread data is newer.
    const older = await start(DeferChildQuery);
    const newer = await start(DeferTwinQuery);
    sinks.forEach((sink, index) => {
      sink.next({
        data: {
          __typename: 'User',
          id: '4',
          lastName: index === 0 ? 'Zuckerberg' : 'Zuckerberg (edited)',
        },
        label: 'useRelayHandoffTestDeferParent_user$defer$child',
        path: ['me'],
      });
      sink.complete();
    });
    await settleArrivedChunks(older.handoff.next, older.handoff);
    await settleArrivedChunks(newer.handoff.next, newer.handoff);
    const client = createClient();
    const shown = document.createElement('div');
    await act(async () => {
      ReactDOMClient.createRoot(shown).render(
        <RelayEnvironmentProvider environment={client}>
          <React.Suspense fallback="loading">
            <DeferParent user={newer.parent} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    expect(shown.textContent).toBe('Zuck Zuckerberg (edited)');
    const container = document.createElement('div');
    container.innerHTML = '<!--$-->Zuck<!-- --> Zuckerberg<!--/$-->';
    const errors: Array<string> = [];
    await act(async () => {
      ReactDOMClient.hydrateRoot(
        container,
        <RelayEnvironmentProvider environment={client}>
          <React.Suspense fallback="loading">
            <DeferParent user={older.parent} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
        {onRecoverableError: error => errors.push(String(error))},
      );
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe('Zuck Zuckerberg (edited)');
  });

  it('gets a `@defer` chunk in a navigation that cannot commit until it arrives', async () => {
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
    const result = serverQuery(server, DeferChildQuery, {});
    sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: false},
    });
    const parent = (await result).me?.parent;
    if (parent == null) {
      throw new Error('Expected a handed-off reference.');
    }

    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    const fallbacks: Array<string> = [];
    component Fallback() {
      useLayoutEffect(() => {
        fallbacks.push('loading');
      });
      return 'loading';
    }
    const page = (content: React.Node) => (
      <RelayEnvironmentProvider environment={client}>
        <React.Suspense fallback={<Fallback />}>{content}</React.Suspense>
      </RelayEnvironmentProvider>
    );
    const container = document.createElement('div');
    const root = ReactDOMClient.createRoot(container);
    await act(async () => {
      root.render(page('old page'));
    });
    // The navigation keeps the old page until the new one can commit, which
    // needs the `@defer` payload: nothing commits before it arrives.
    await act(async () => {
      startTransition(() => {
        root.render(page(<DeferParent user={parent} />));
      });
    });
    expect(container.textContent).toBe('old page');
    await act(async () => {
      sinks[0].next({
        data: {__typename: 'User', id: '4', lastName: 'Zuckerberg'},
        label: 'useRelayHandoffTestDeferParent_user$defer$child',
        path: ['me'],
      });
      sinks[0].complete();
    });
    expect(container.textContent).toBe('Zuck Zuckerberg');
    expect(fallbacks).toEqual([]);
  });

  it('hydrates what the server rendered when a chunk arrives while the first hydration is suspended', async () => {
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
    const result = serverQuery(server, StreamQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {
            edges: [{node: {__typename: 'User', id: 'f0', name: 'f0'}}],
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const list = (await result).me?.list;
    if (list == null) {
      throw new Error('Expected a handed-off reference.');
    }
    let releaseReady: ?() => void = null;
    const ready = new Promise<void>(resolve => {
      releaseReady = resolve;
    });
    component Gate() {
      use(ready);
      return null;
    }
    const container = document.createElement('div');
    container.innerHTML = '<!--$--><ul><li>f0</li></ul><!--/$-->';
    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    const errors: Array<string> = [];
    await act(async () => {
      ReactDOMClient.hydrateRoot(
        container,
        <RelayEnvironmentProvider environment={client}>
          <React.Suspense fallback="loading">
            <List user={list} />
            <Gate />
          </React.Suspense>
        </RelayEnvironmentProvider>,
        {
          onRecoverableError: error => {
            errors.push(String(error));
          },
        },
      );
    });
    expect(client.getStore().getSource().has('f0')).toBe(true);
    await act(async () => {
      sinks[0].next({
        data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
        label: 'useRelayHandoffTestStream_user$stream$edges',
        path: ['me', 'friends', 'edges', 1],
      });
      sinks[0].complete();
    });
    // The chunk is in the Store at once; the suspended reader still
    // hydrates against what the server rendered.
    expect(container.textContent).toBe('f0');
    expect(client.getStore().getSource().has('f1')).toBe(true);
    await act(async () => {
      releaseReady?.();
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe('f0f1');
  });

  // Two readers of one root, both rendered by the server before the stream
  // went on: the second hydrates after the first committed and after the
  // next chunk arrived.
  it('hydrates a reader of a root that hydrates after another reader of the root committed against what the server rendered', async () => {
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
    const result = serverQuery(server, StreamQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {
            edges: [{node: {__typename: 'User', id: 'f0', name: 'f0'}}],
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const list = (await result).me?.list;
    if (list == null) {
      throw new Error('Expected a handed-off reference.');
    }
    let releaseReady: ?() => void = null;
    const ready = new Promise<void>(resolve => {
      releaseReady = resolve;
    });
    component Gate() {
      use(ready);
      return null;
    }
    const container = document.createElement('div');
    container.innerHTML =
      '<!--$--><ul><li>f0</li></ul><!--/$-->' +
      '<!--$--><ul><li>f0</li></ul><!--/$-->';
    const errors: Array<string> = [];
    await act(async () => {
      ReactDOMClient.hydrateRoot(
        container,
        <RelayEnvironmentProvider environment={createClient()}>
          <React.Suspense fallback="loading">
            <List user={list} />
          </React.Suspense>
          <React.Suspense fallback="loading">
            <Gate />
            <List user={list} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
        {onRecoverableError: error => errors.push(String(error))},
      );
    });
    await act(async () => {
      sinks[0].next({
        data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
        label: 'useRelayHandoffTestStream_user$stream$edges',
        path: ['me', 'friends', 'edges', 1],
      });
      sinks[0].complete();
    });
    expect(container.textContent).toBe('f0f1f0');
    await act(async () => {
      releaseReady?.();
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe('f0f1f0f1');
  });

  it('shows a root whose stream ended while a hydration of it was suspended, once that hydration is dropped', async () => {
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
    const result = serverQuery(server, StreamQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {
            edges: [{node: {__typename: 'User', id: 'f0', name: 'f0'}}],
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const list = (await result).me?.list;
    if (list == null) {
      throw new Error('Expected a handed-off reference.');
    }
    const never = new Promise<void>(() => {});
    component Gate() {
      use(never);
      return null;
    }
    const clientStore = new Store(new RecordSource(), {gcReleaseBufferSize: 0});
    const client = new Environment({
      network: Network.create(() => Observable.create(() => {})),
      store: clientStore,
    });
    const abandoned = document.createElement('div');
    abandoned.innerHTML = '<!--$--><ul><li>f0</li></ul><!--/$-->';
    // `act` would wait for the gate, so React schedules this render itself.
    global.IS_REACT_ACT_ENVIRONMENT = false;
    const abandonedRoot = ReactDOMClient.hydrateRoot(
      abandoned,
      <RelayEnvironmentProvider environment={client}>
        <React.Suspense fallback="loading">
          <List user={list} />
          <Gate />
        </React.Suspense>
      </RelayEnvironmentProvider>,
    );
    for (let ii = 0; ii < 10; ii++) {
      jest.advanceTimersByTime(10);
      await Promise.resolve();
    }
    sinks[0].next({
      data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
      label: 'useRelayHandoffTestStream_user$stream$edges',
      path: ['me', 'friends', 'edges', 1],
    });
    sinks[0].complete();
    for (let ii = 0; ii < 10; ii++) {
      jest.advanceTimersByTime(10);
      await Promise.resolve();
    }
    abandonedRoot.unmount();
    // Nothing retains the records now.
    clientStore.scheduleGC();
    for (let ii = 0; ii < 10; ii++) {
      jest.advanceTimersByTime(10);
      await Promise.resolve();
    }
    expect(client.getStore().getSource().has('f0')).toBe(false);
    global.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    const root = ReactDOMClient.createRoot(container);
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={client}>
          <React.Suspense fallback="loading">
            <List user={list} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    expect(container.textContent).toBe('f0f1');
  });

  // Each of these runs with both `useFragment` implementations, and with and
  // without notifications that skip unchanged records.
  describe.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])(
    'two server queries that hand off the same list (Activity compatibility %s, optimized notify %s)',
    (activityCompatibility: boolean, optimizeNotify: boolean) => {
      const flags = {
        activity: RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY,
        notify: RelayFeatureFlags.OPTIMIZE_NOTIFY,
      };
      beforeEach(() => {
        RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = activityCompatibility;
        RelayFeatureFlags.OPTIMIZE_NOTIFY = optimizeNotify;
      });
      afterEach(() => {
        RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = flags.activity;
        RelayFeatureFlags.OPTIMIZE_NOTIFY = flags.notify;
      });

      const createServer = () =>
        createActorsServer(config => new Environment(config));

      it('keeps the newest list when an older root flushes a truncated one last', async () => {
        const {second, twin} = await serveOverlappingActors(
          createServer(),
          'truncated',
        );
        expect(await handedOffActors(twin)).toEqual([
          {__refs: ['a1']},
          {__refsAppend: ['a2'], __refsAppendFrom: 1},
          {__refs: ['a1']},
        ]);
        await settleHandoff(second);
        await settleHandoff(twin);
        const container = document.createElement('div');
        container.innerHTML = '<span>Ada</span><span>Ada</span>';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={createClient()}>
              <Actors user={second} />
              <Actors user={twin} />
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(container.innerHTML).toBe(
          '<span>Ada,Grace,Linus</span><span>Ada,Grace,Linus</span>',
        );
      });

      it('keeps the newest list when an older root renders its first records after a newer root', async () => {
        const {second, twin} = await serveOverlappingActors(
          createServer(),
          'snapshot',
        );
        expect((await handedOffActors(second))[0]).toEqual({
          __refs: ['a1', 'a2'],
        });
        expect((await handedOffActors(twin))[0]).toEqual({__refs: ['a1']});
        await settleHandoff(second);
        await settleHandoff(twin);
        const container = document.createElement('div');
        // The server rendered each reader from its own root's records.
        container.innerHTML = '<span>Ada,Grace</span><span>Ada</span>';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={createClient()}>
              <Actors user={second} />
              <Actors user={twin} />
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(container.innerHTML).toBe(
          '<span>Ada,Grace,Linus</span><span>Ada,Grace,Linus</span>',
        );
      });

      it('keeps the newest list when the older root hydrates in a later Suspense commit', async () => {
        const {second, twin} = await serveOverlappingActors(
          createServer(),
          'truncated',
        );
        await settleHandoff(second);
        await settleHandoff(twin);
        let releaseReady: ?() => void = null;
        const ready = new Promise<void>(resolve => {
          releaseReady = resolve;
        });
        component Gate() {
          use(ready);
          return null;
        }
        const container = document.createElement('div');
        container.innerHTML =
          '<!--$--><span>Ada</span><!--/$-->' +
          '<!--$--><span>Ada</span><!--/$-->';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={createClient()}>
              <React.Suspense fallback="loading">
                <Actors user={second} />
              </React.Suspense>
              <React.Suspense fallback="loading">
                <Gate />
                <Actors user={twin} />
              </React.Suspense>
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(container.textContent).toBe('Ada,Grace,LinusAda');
        await act(async () => {
          releaseReady?.();
        });
        expect(errors).toEqual([]);
        expect(container.innerHTML).toBe(
          '<!--$--><span>Ada,Grace,Linus</span><!--/$-->' +
            '<!--$--><span>Ada,Grace,Linus</span><!--/$-->',
        );
      });

      it('keeps the newest list when an older root with no later chunks hydrates in a later Suspense commit', async () => {
        const server = createServer();
        // A query that completed before the others started: Ada only.
        const early = server.start('A');
        early.next(actorsPayload([ADA]));
        early.complete();
        const earlyActors = await early.actors();
        const {second} = await serveOverlappingActors(server, 'truncated');
        await settleHandoff(earlyActors);
        await settleHandoff(second);
        let releaseReady: ?() => void = null;
        const ready = new Promise<void>(resolve => {
          releaseReady = resolve;
        });
        component Gate() {
          use(ready);
          return null;
        }
        const container = document.createElement('div');
        container.innerHTML =
          '<!--$--><span>Ada</span><!--/$-->' +
          '<!--$--><span>Ada</span><!--/$-->';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={createClient()}>
              <React.Suspense fallback="loading">
                <Actors user={second} />
              </React.Suspense>
              <React.Suspense fallback="loading">
                <Gate />
                <Actors user={earlyActors} />
              </React.Suspense>
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        await act(async () => {
          releaseReady?.();
        });
        expect(errors).toEqual([]);
        expect(container.innerHTML).toBe(
          '<!--$--><span>Ada,Grace,Linus</span><!--/$-->' +
            '<!--$--><span>Ada,Grace,Linus</span><!--/$-->',
        );
      });

      it('updates an older root that hydrates while the newest list is on screen once it commits', async () => {
        const server = createServer();
        // A root whose records are older than all the others: Ada only.
        const early = server.start('A');
        early.next(actorsPayload([ADA]));
        early.complete();
        const earlyActors = await early.actors();
        const {second} = await serveOverlappingActors(server, 'truncated');
        await settleHandoff(earlyActors);
        await settleHandoff(second);
        const client = createClient();
        const shown = document.createElement('div');
        const shownRoot = ReactDOMClient.createRoot(shown);
        await act(async () => {
          shownRoot.render(
            <RelayEnvironmentProvider environment={client}>
              <Actors user={second} />
            </RelayEnvironmentProvider>,
          );
        });
        expect(shown.textContent).toBe('Ada,Grace,Linus');
        // Nothing the older root has is newer than the Store's: hydrating it
        // writes nothing to the Store.
        const container = document.createElement('div');
        container.innerHTML = '<span>Ada</span>';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={client}>
              <Actors user={earlyActors} />
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(container.innerHTML).toBe('<span>Ada,Grace,Linus</span>');
        expect(shown.textContent).toBe('Ada,Grace,Linus');
      });

      it('updates an older root that hydrates again after an abandoned hydration once it commits', async () => {
        const server = createServer();
        const early = server.start('A');
        early.next(actorsPayload([ADA]));
        early.complete();
        const earlyActors = await early.actors();
        const {second} = await serveOverlappingActors(server, 'truncated');
        await settleHandoff(earlyActors);
        await settleHandoff(second);
        const client = createClient();
        const shown = document.createElement('div');
        const shownRoot = ReactDOMClient.createRoot(shown);
        await act(async () => {
          shownRoot.render(
            <RelayEnvironmentProvider environment={client}>
              <Actors user={second} />
            </RelayEnvironmentProvider>,
          );
        });
        // The older root hydrates behind a gate that never opens, and the page
        // drops that render.
        const never = new Promise<void>(() => {});
        component Gate() {
          use(never);
          return null;
        }
        const abandoned = document.createElement('div');
        abandoned.innerHTML = '<!--$--><span>Ada</span><!--/$-->';
        // `act` would wait for the gate, so React schedules this render itself.
        global.IS_REACT_ACT_ENVIRONMENT = false;
        const abandonedRoot = ReactDOMClient.hydrateRoot(
          abandoned,
          <RelayEnvironmentProvider environment={client}>
            <React.Suspense fallback="loading">
              <Actors user={earlyActors} />
              <Gate />
            </React.Suspense>
          </RelayEnvironmentProvider>,
        );
        for (let ii = 0; ii < 20; ii++) {
          jest.advanceTimersByTime(10);
          await Promise.resolve();
        }
        abandonedRoot.unmount();
        global.IS_REACT_ACT_ENVIRONMENT = true;
        // The same root hydrates again, from the same server HTML, and
        // commits.
        const container = document.createElement('div');
        container.innerHTML = '<span>Ada</span>';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={client}>
              <Actors user={earlyActors} />
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(container.innerHTML).toBe('<span>Ada,Grace,Linus</span>');
        expect(shown.textContent).toBe('Ada,Grace,Linus');
        await act(async () => {
          shownRoot.unmount();
        });
      });

      it('reads a Relay Resolver field with the resolver context while hydrating', async () => {
        const sinks: Array<Sink<GraphQLResponse>> = [];
        const serverEnvironment = new Environment({
          isServer: true,
          network: Network.create(() =>
            Observable.create((sink: Sink<GraphQLResponse>) => {
              sinks.push(sink);
            }),
          ),
          store: new Store(new RecordSource()),
        });
        const result = serverQuery(serverEnvironment, GreetingQuery, {});
        sinks[0].next({
          data: {me: {__typename: 'User', id: '4', name: 'Ada'}},
          extensions: {is_final: false},
        });
        const user = (await result).me?.client;
        sinks[0].complete();
        if (user == null) {
          throw new Error('Expected a handed-off reference.');
        }
        await settleHandoff(user);
        const client = new Environment({
          network: Network.create(() => Observable.create(() => {})),
          store: new Store(new RecordSource(), {
            resolverContext: {
              counter: Observable.create(() => {}),
              greeting: {myHello: 'Hello'},
            },
          }),
        });
        const container = document.createElement('div');
        container.innerHTML = '<span>Hello, Ada</span>';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={client}>
              <Greeting user={user} />
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(container.innerHTML).toBe('<span>Hello, Ada</span>');
      });

      it('reads a Live Relay Resolver field while hydrating, then follows its live state', async () => {
        const sinks: Array<Sink<GraphQLResponse>> = [];
        const serverEnvironment = new Environment({
          isServer: true,
          network: Network.create(() =>
            Observable.create((sink: Sink<GraphQLResponse>) => {
              sinks.push(sink);
            }),
          ),
          store: new Store(new RecordSource()),
        });
        const result = serverQuery(serverEnvironment, LiveNameQuery, {});
        sinks[0].next({
          data: {me: {__typename: 'User', id: '4', name: 'Ada'}},
          extensions: {is_final: false},
        });
        const user = (await result).me?.client;
        sinks[0].complete();
        if (user == null) {
          throw new Error('Expected a handed-off reference.');
        }
        await settleHandoff(user);
        const container = document.createElement('div');
        container.innerHTML =
          '<span>Ada (online)</span><span>Ada (online)</span>';
        const errors: Array<string> = [];
        const subscriptions = relayHandoffTestLiveSubscriptions();
        let root = null;
        await act(async () => {
          root = ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={createClient()}>
              <LiveName user={user} />
              <LiveName user={user} />
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(container.innerHTML).toBe(
          '<span>Ada (online)</span><span>Ada (online)</span>',
        );
        // Only the page's Store follows the live state; the subscription the
        // hydrating reads made was ended once, though two readers read it.
        expect(relayHandoffTestLiveSubscriptions()).toEqual({
          ended: subscriptions.ended + 1,
          open: subscriptions.open + 1,
        });
        await act(async () => {
          setRelayHandoffTestLiveSuffix('away');
        });
        expect(container.innerHTML).toBe(
          '<span>Ada (away)</span><span>Ada (away)</span>',
        );
        await act(async () => {
          root?.unmount();
        });
        setRelayHandoffTestLiveSuffix('online');
      });

      it('keeps a mounted reader on screen while what the chunks a hydrating root published need loads', async () => {
        const server = createServer();
        const shownQuery = server.start('A');
        const newerQuery = server.start('B');
        shownQuery.next(actorsPayload([ADA]));
        shownQuery.complete();
        const shownActors = await shownQuery.actors();
        await settleHandoff(shownActors);
        // A newer root whose next chunk, already arrived (a settled Flight
        // chunk), adds Grace.
        newerQuery.next(actorsPayload([ADA]));
        const newerActors = await newerQuery.actors();
        newerQuery.next(actorsPayload([ADA, GRACE]));
        newerQuery.complete();
        await settleHandoff(newerActors);
        // Showing Grace needs something that is still loading (e.g. an RSC
        // field's value).
        let releaseGrace: ?() => void = null;
        const graceReady = new Promise<void>(resolve => {
          releaseGrace = resolve;
        });
        component SlowActors(user: useRelayHandoffTestActors_user$key) {
          const data = useFragment(ActorsFragment, user);
          const names = (data.actors ?? []).map(actor => actor?.name);
          if (names.includes('Grace')) {
            use(graceReady);
          }
          return <span>{names.join(',')}</span>;
        }
        const client = createClient();
        const shown = document.createElement('div');
        const shownRoot = ReactDOMClient.createRoot(shown);
        await act(async () => {
          shownRoot.render(
            <RelayEnvironmentProvider environment={client}>
              <React.Suspense fallback="loading">
                <SlowActors user={shownActors} />
              </React.Suspense>
            </RelayEnvironmentProvider>,
          );
        });
        expect(shown.textContent).toBe('Ada');
        const container = document.createElement('div');
        container.innerHTML = '<!--$--><span>Ada</span><!--/$-->';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={client}>
              <React.Suspense fallback="loading">
                <SlowActors user={newerActors} />
              </React.Suspense>
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(shown.textContent).toBe('Ada');
        expect(container.textContent).toBe('Ada');
        await act(async () => {
          releaseGrace?.();
        });
        expect(shown.textContent).toBe('Ada,Grace');
        expect(container.textContent).toBe('Ada,Grace');
        await act(async () => {
          shownRoot.unmount();
        });
      });

      it('keeps a mounted reader on screen while what the chunks a hydration that never commits published need loads', async () => {
        const server = createServer();
        const shownQuery = server.start('A');
        const newerQuery = server.start('B');
        shownQuery.next(actorsPayload([ADA]));
        shownQuery.complete();
        const shownActors = await shownQuery.actors();
        await settleHandoff(shownActors);
        newerQuery.next(actorsPayload([ADA]));
        const newerActors = await newerQuery.actors();
        newerQuery.next(actorsPayload([ADA, GRACE]));
        newerQuery.complete();
        await settleHandoff(newerActors);
        let releaseGrace: ?() => void = null;
        const graceReady = new Promise<void>(resolve => {
          releaseGrace = resolve;
        });
        component SlowActors(user: useRelayHandoffTestActors_user$key) {
          const data = useFragment(ActorsFragment, user);
          const names = (data.actors ?? []).map(actor => actor?.name);
          if (names.includes('Grace')) {
            use(graceReady);
          }
          return <span>{names.join(',')}</span>;
        }
        const client = createClient();
        const shown = document.createElement('div');
        const shownRoot = ReactDOMClient.createRoot(shown);
        await act(async () => {
          shownRoot.render(
            <RelayEnvironmentProvider environment={client}>
              <React.Suspense fallback="loading">
                <SlowActors user={shownActors} />
              </React.Suspense>
            </RelayEnvironmentProvider>,
          );
        });
        // The newer root hydrates behind a gate that never opens: no reader
        // of it commits, so what it published notifies on a timer.
        const never = new Promise<void>(() => {});
        component Gate() {
          use(never);
          return null;
        }
        const abandoned = document.createElement('div');
        abandoned.innerHTML = '<!--$--><span>Ada</span><!--/$-->';
        // `act` would wait for the gate, so React schedules this render itself.
        global.IS_REACT_ACT_ENVIRONMENT = false;
        const abandonedRoot = ReactDOMClient.hydrateRoot(
          abandoned,
          <RelayEnvironmentProvider environment={client}>
            <React.Suspense fallback="loading">
              <SlowActors user={newerActors} />
              <Gate />
            </React.Suspense>
          </RelayEnvironmentProvider>,
        );
        for (let ii = 0; ii < 20; ii++) {
          jest.advanceTimersByTime(10);
          await Promise.resolve();
        }
        expect(shown.textContent).toBe('Ada');
        releaseGrace?.();
        for (let ii = 0; ii < 20; ii++) {
          jest.advanceTimersByTime(10);
          await Promise.resolve();
        }
        expect(shown.textContent).toBe('Ada,Grace');
        abandonedRoot.unmount();
        shownRoot.unmount();
        global.IS_REACT_ACT_ENVIRONMENT = true;
      });

      it('reads a Relay Resolver field that returns a client object while hydrating', async () => {
        const sinks: Array<Sink<GraphQLResponse>> = [];
        const serverEnvironment = new Environment({
          isServer: true,
          network: Network.create(() =>
            Observable.create((sink: Sink<GraphQLResponse>) => {
              sinks.push(sink);
            }),
          ),
          store: new Store(new RecordSource()),
        });
        const result = serverQuery(serverEnvironment, ClientObjectQuery, {});
        sinks[0].next({
          data: {me: {__typename: 'User', id: '4', name: 'Ada'}},
          extensions: {is_final: false},
        });
        const query = (await result).client;
        sinks[0].complete();
        await settleHandoff(query);
        const container = document.createElement('div');
        container.innerHTML = '<span>Ada<!-- -->: <!-- -->Hello world</span>';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={createClient()}>
              <ClientObject query={query} />
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(container.textContent).toBe('Ada: Hello world');
      });

      it('leaves the Store at the newest list when an older root hydrates and never commits', async () => {
        const server = createServer();
        // Two roots whose records are older than all the others: Ada only. The
        // second reads its data from the Store and never renders before the end.
        const early = server.start('A');
        early.next(actorsPayload([ADA]));
        early.complete();
        const earlyActors = await early.actors();
        const laterActors = await server.start('B').actors();
        const {second} = await serveOverlappingActors(server, 'truncated');
        await settleHandoff(earlyActors);
        await settleHandoff(second);
        const client = createClient();
        // The newest root's reader is on screen.
        const shown = document.createElement('div');
        const shownRoot = ReactDOMClient.createRoot(shown);
        await act(async () => {
          shownRoot.render(
            <RelayEnvironmentProvider environment={client}>
              <Actors user={second} />
            </RelayEnvironmentProvider>,
          );
        });
        expect(shown.textContent).toBe('Ada,Grace,Linus');
        // The older root hydrates in a boundary that never commits.
        const never = new Promise<void>(() => {});
        component Gate() {
          use(never);
          return null;
        }
        const container = document.createElement('div');
        container.innerHTML = '<!--$--><span>Ada</span><!--/$-->';
        const errors: Array<string> = [];
        // `act` would wait for the gate, so React schedules this render itself.
        global.IS_REACT_ACT_ENVIRONMENT = false;
        const hydrated = ReactDOMClient.hydrateRoot(
          container,
          <RelayEnvironmentProvider environment={client}>
            <React.Suspense fallback="loading">
              <Actors user={earlyActors} />
              <Gate />
            </React.Suspense>
          </RelayEnvironmentProvider>,
          {onRecoverableError: error => errors.push(String(error))},
        );
        // React renders, suspends on the gate, and the handoff's timers run.
        for (let ii = 0; ii < 20; ii++) {
          jest.advanceTimersByTime(10);
          await Promise.resolve();
        }
        expect(container.innerHTML).toBe('<!--$--><span>Ada</span><!--/$-->');
        hydrated.unmount();
        global.IS_REACT_ACT_ENVIRONMENT = true;
        expect(shown.textContent).toBe('Ada,Grace,Linus');
        const user = client.getStore().getSource().get('4');
        expect(
          user != null ? Record.getLinkedRecordIDs(user, 'actors') : null,
        ).toEqual(['a1', 'a2', 'a3']);
        await act(async () => {
          shownRoot.unmount();
        });
        expect(errors).toEqual([]);
        // The order of the request's writes lives on the records: a root of it
        // with older records that renders now still does not move them back.
        const later = document.createElement('div');
        const laterRoot = ReactDOMClient.createRoot(later);
        await act(async () => {
          laterRoot.render(
            <RelayEnvironmentProvider environment={client}>
              <Actors user={laterActors} />
            </RelayEnvironmentProvider>,
          );
        });
        expect(later.textContent).toBe('Ada,Grace,Linus');
      });

      it('reads a Relay Resolver field from the own records of a hydrating root', async () => {
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
        const resultA = serverQuery(server, NameLengthAQuery, {});
        sinks[0].next({
          data: {me: {__typename: 'User', id: '4', name: 'Ada'}},
          extensions: {is_final: false},
        });
        const older = (await resultA).me?.client;
        // A second query renames the user: the first root's handoff sends the new
        // name in a chunk, which the browser holds while it hydrates.
        const resultB = serverQuery(server, NameLengthBQuery, {});
        sinks[1].next({
          data: {
            me: {__typename: 'User', id: '4', lastName: 'L', name: 'Grace'},
          },
          extensions: {is_final: false},
        });
        const newer = (await resultB).me?.client;
        sinks[0].complete();
        sinks[1].complete();
        if (older == null || newer == null) {
          throw new Error('Expected handed-off references.');
        }
        await settleHandoff(older);
        await settleHandoff(newer);
        const container = document.createElement('div');
        container.innerHTML =
          '<!--$--><span>Grace<!-- --> <!-- -->5</span><!--/$-->' +
          '<!--$--><span>Ada<!-- --> <!-- -->3</span><!--/$-->';
        const errors: Array<string> = [];
        await act(async () => {
          ReactDOMClient.hydrateRoot(
            container,
            <RelayEnvironmentProvider environment={createClient()}>
              <React.Suspense fallback="loading">
                <NameLength user={newer} />
              </React.Suspense>
              <React.Suspense fallback="loading">
                <NameLength user={older} />
              </React.Suspense>
            </RelayEnvironmentProvider>,
            {onRecoverableError: error => errors.push(String(error))},
          );
        });
        expect(errors).toEqual([]);
        expect(container.textContent).toBe('Grace 5Grace 5');
      });
    },
  );
});
