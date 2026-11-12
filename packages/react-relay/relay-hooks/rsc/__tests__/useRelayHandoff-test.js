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

import type {useRelayHandoffTestActors_user$key} from './__generated__/useRelayHandoffTestActors_user.graphql';
import type {useRelayHandoffTestCard_user$key} from './__generated__/useRelayHandoffTestCard_user.graphql';
import type {useRelayHandoffTestDeferChild_user$key} from './__generated__/useRelayHandoffTestDeferChild_user.graphql';
import type {useRelayHandoffTestDeferParent_user$key} from './__generated__/useRelayHandoffTestDeferParent_user.graphql';
import type {useRelayHandoffTestDeferred_user$key} from './__generated__/useRelayHandoffTestDeferred_user.graphql';
import type {useRelayHandoffTestFieldErrorCatch_user$key} from './__generated__/useRelayHandoffTestFieldErrorCatch_user.graphql';
import type {useRelayHandoffTestFieldErrorThrow_user$key} from './__generated__/useRelayHandoffTestFieldErrorThrow_user.graphql';
import type {useRelayHandoffTestFriends_user$key} from './__generated__/useRelayHandoffTestFriends_user.graphql';
import type {useRelayHandoffTestProvided_user$key} from './__generated__/useRelayHandoffTestProvided_user.graphql';
import type {useRelayHandoffTestQuery$variables} from './__generated__/useRelayHandoffTestQuery.graphql';
import type {useRelayHandoffTestScaled_user$key} from './__generated__/useRelayHandoffTestScaled_user.graphql';
import type {useRelayHandoffTestStream_user$key} from './__generated__/useRelayHandoffTestStream_user.graphql';
import type {useRelayHandoffTestStreamConnection_user$key} from './__generated__/useRelayHandoffTestStreamConnection_user.graphql';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {EnvironmentConfig} from 'relay-runtime/store/RelayModernEnvironment';

const {installRelayHandoff} = require('../../../rsc-client_EXPERIMENTAL');
const RelayEnvironmentProvider = require('../../RelayEnvironmentProvider');
const useFragment = require('../../useFragment');
const useLazyLoadQuery = require('../../useLazyLoadQuery');
const usePaginationFragment = require('../../usePaginationFragment');
const {getRelayHandoff} = require('../RelayHandoff');
const serverQuery = require('../serverQuery');
const {
  ADA,
  actorsPayload,
  createActorsServer,
  serveOverlappingActors,
} = require('./RelayHandoffTestOverlappingQueries');
const {
  ErrorBoundary,
  flush,
  providerState,
  render,
} = require('./RelayHandoffTestUtils');
const {getActivity} = require('./useRelayHandoffTestActivity');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const {
  Environment: RelayEnvironment,
  Network,
  Observable,
  Record: RelayModernRecord,
  RecordSource,
  RelayFeatureFlags,
  Store,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');

// Every Environment here reads the fragment references server components hand
// off, as one created by an app that installs the RSC client entry does.
class Environment extends RelayEnvironment {
  constructor(config: EnvironmentConfig) {
    super(config);
    installRelayHandoff(this);
  }
}

const Query = graphql`
  query useRelayHandoffTestQuery($size: [Int]) @server {
    me {
      name
      ...useRelayHandoffTestCard_user @alias(as: "card")
      ...useRelayHandoffTestDeferred_user
        @alias(as: "deferred")
        @defer(label: "deferred")
      ...useRelayHandoffTestFriends_user @alias(as: "friends")
    }
  }
`;

const CardFragment = graphql`
  fragment useRelayHandoffTestCard_user on User {
    lastName
    profilePicture(size: $size) {
      uri
    }
  }
`;

const DeferredFragment = graphql`
  fragment useRelayHandoffTestDeferred_user on User {
    emailAddresses
  }
`;

const DeferChildQuery = graphql`
  query useRelayHandoffTestDeferChildQuery @server {
    me {
      ...useRelayHandoffTestDeferParent_user @alias(as: "parent")
    }
  }
`;

const DeferParentFragment = graphql`
  fragment useRelayHandoffTestDeferParent_user on User {
    name
    ...useRelayHandoffTestDeferChild_user @defer(label: "child")
  }
`;

const DeferChildFragment = graphql`
  fragment useRelayHandoffTestDeferChild_user on User {
    lastName
  }
`;

const FriendsFragment = graphql`
  fragment useRelayHandoffTestFriends_user on User
  @argumentDefinitions(
    count: {type: "Int", defaultValue: 1}
    cursor: {type: "ID"}
  )
  @refetchable(queryName: "useRelayHandoffTestFriendsPaginationQuery") {
    friends(first: $count, after: $cursor)
      @connection(key: "useRelayHandoffTest_friends") {
      edges {
        node {
          name
        }
      }
    }
  }
`;

const StreamQuery = graphql`
  query useRelayHandoffTestStreamQuery @server {
    me {
      ...useRelayHandoffTestStream_user @alias(as: "list")
    }
  }
`;

const StreamFragment = graphql`
  fragment useRelayHandoffTestStream_user on User {
    friends(first: 10) {
      edges @stream(initial_count: 1, label: "edges") {
        node {
          name
        }
      }
    }
  }
`;

const StreamConnectionQuery = graphql`
  query useRelayHandoffTestStreamConnectionQuery @server {
    me {
      ...useRelayHandoffTestStreamConnection_user @alias(as: "people")
    }
  }
`;

const StreamConnectionFragment = graphql`
  fragment useRelayHandoffTestStreamConnection_user on User
  @argumentDefinitions(
    count: {type: "Int", defaultValue: 3}
    cursor: {type: "ID"}
  )
  @refetchable(
    queryName: "useRelayHandoffTestStreamConnectionPaginationQuery"
  ) {
    friends(first: $count, after: $cursor)
      @connection(key: "useRelayHandoffTestStreamConnection_friends") {
      edges @stream(initial_count: 1, label: "people") {
        node {
          name
        }
      }
    }
  }
`;

const ActorsQuery = graphql`
  query useRelayHandoffTestActorsQuery @server {
    me {
      ...useRelayHandoffTestActors_user @alias(as: "actors")
    }
  }
`;

const ActorsBQuery = graphql`
  query useRelayHandoffTestActorsBQuery @server {
    me {
      ...useRelayHandoffTestActors_user @alias(as: "actors")
    }
  }
`;

const ActorsFragment = graphql`
  fragment useRelayHandoffTestActors_user on User {
    actors @stream(initial_count: 1, label: "actors") {
      name
    }
  }
`;

const ProvidedQuery = graphql`
  query useRelayHandoffTestProvidedQuery @server {
    me {
      ...useRelayHandoffTestProvided_user @alias(as: "provided")
    }
  }
`;

const ProvidedFragment = graphql`
  fragment useRelayHandoffTestProvided_user on User
  @argumentDefinitions(
    includeName: {
      type: "Boolean!"
      provider: "../../__tests__/RelayProvider_returnsTrue.relayprovider"
    }
  ) {
    name @include(if: $includeName)
  }
`;

const ScaledQuery = graphql`
  query useRelayHandoffTestScaledQuery @server {
    me {
      ...useRelayHandoffTestScaled_user @alias(as: "friends")
    }
  }
`;

const ScaledClientQuery = graphql`
  query useRelayHandoffTestScaledClientQuery {
    me {
      ...useRelayHandoffTestScaled_user
    }
  }
`;

const ScaledFragment = graphql`
  fragment useRelayHandoffTestScaled_user on User
  @argumentDefinitions(
    count: {type: "Int", defaultValue: 1}
    cursor: {type: "ID"}
    scale: {type: "[Int]", provider: "./useRelayHandoffTestScale.relayprovider"}
  )
  @refetchable(queryName: "useRelayHandoffTestScaledPaginationQuery") {
    friends(first: $count, after: $cursor)
      @connection(key: "useRelayHandoffTestScaled_friends") {
      edges {
        node {
          name
          profilePicture(size: $scale) {
            uri
          }
        }
      }
    }
  }
`;

const FieldErrorQuery = graphql`
  query useRelayHandoffTestFieldErrorQuery @server {
    me {
      ...useRelayHandoffTestFieldErrorCatch_user @alias(as: "caught")
      ...useRelayHandoffTestFieldErrorThrow_user @alias(as: "thrown")
    }
  }
`;

const FieldErrorCatchFragment = graphql`
  fragment useRelayHandoffTestFieldErrorCatch_user on User {
    lastName @catch
  }
`;

const FieldErrorThrowFragment = graphql`
  fragment useRelayHandoffTestFieldErrorThrow_user on User @throwOnFieldError {
    lastName
  }
`;

// The same field, fetched by the client itself.
const FieldErrorClientQuery = graphql`
  query useRelayHandoffTestFieldErrorClientQuery {
    me {
      lastName @catch
    }
  }
`;

const LastNameQuery = graphql`
  query useRelayHandoffTestLastNameQuery {
    node(id: "4") {
      ... on User {
        lastName
      }
    }
  }
`;

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

async function serve(options?: {completeFirst?: boolean}) {
  const sinks: Array<Sink<GraphQLResponse>> = [];
  const environment = new Environment({
    isServer: true,
    network: Network.create(() =>
      Observable.create((sink: Sink<GraphQLResponse>) => {
        sinks.push(sink);
      }),
    ),
    store: new Store(new RecordSource()),
  });
  const variables: useRelayHandoffTestQuery$variables = {size: [32]};
  const result = serverQuery(environment, Query, variables);
  sinks[0].next({data: {me: ME}, extensions: {is_final: false}});
  if (options?.completeFirst === true) {
    sinks[0].complete();
  }
  const data = await result;
  const me = data.me;
  if (me == null) {
    throw new Error('Expected me.');
  }
  return {me, sink: sinks[0]};
}

function createClient() {
  const requests: Array<{name: string, variables: {...}}> = [];
  const responses: Array<Sink<GraphQLResponse>> = [];
  const source = new RecordSource();
  const store = new Store(source, {gcReleaseBufferSize: 0});
  const environment = new Environment({
    network: Network.create((params, variables) => {
      requests.push({name: params.name, variables});
      return Observable.create((sink: Sink<GraphQLResponse>) => {
        responses.push(sink);
      });
    }),
    store,
  });
  return {environment, requests, responses, source, store};
}

component ActorNames(user: useRelayHandoffTestActors_user$key) {
  const value = useFragment(ActorsFragment, user);
  return (value.actors ?? []).map(actor => actor?.name).join(',');
}

component Card(user: useRelayHandoffTestCard_user$key) {
  const data = useFragment(CardFragment, user);
  return `${data.lastName ?? ''} ${data.profilePicture?.uri ?? ''}`;
}

// Reads the client's own copy of the user's last name.
component LastName() {
  const data = useLazyLoadQuery(LastNameQuery, {}, {fetchPolicy: 'store-only'});
  return data.node?.lastName ?? '';
}

component ProvidedName(user: useRelayHandoffTestProvided_user$key) {
  const data = useFragment(ProvidedFragment, user);
  return data.name ?? 'no name';
}

component CaughtLastName(user: useRelayHandoffTestFieldErrorCatch_user$key) {
  const {lastName} = useFragment(FieldErrorCatchFragment, user);
  return lastName.ok
    ? (lastName.value ?? '')
    : `caught ${lastName.errors.length} error(s)`;
}

component ThrownLastName(user: useRelayHandoffTestFieldErrorThrow_user$key) {
  const data = useFragment(FieldErrorThrowFragment, user);
  return data.lastName ?? '';
}

component Deferred(user: useRelayHandoffTestDeferred_user$key) {
  const data = useFragment(DeferredFragment, user);
  return (data.emailAddresses ?? []).join(',');
}

describe('useFragment with a handed-off reference', () => {
  it('reads the handed-off records with no request and no suspension', async () => {
    const {me} = await serve();
    const client = createClient();
    const executeWithSource = jest.spyOn(
      client.environment,
      'executeWithSource',
    );
    const renderer = render(
      client.environment,
      <>
        <Card user={me.card} />
        <Card user={me.card} />
      </>,
    );
    expect(renderer.toJSON()).toEqual(['Zuckerberg 4.jpg', 'Zuckerberg 4.jpg']);
    expect(client.requests).toEqual([]);
    // Published once for both readers.
    expect(executeWithSource).toHaveBeenCalledTimes(1);
    // The fragment's owner carries exactly the variables it reads.
    const owner = client.environment.getStore().getSource().get('4');
    expect(owner).not.toBe(null);
  });

  it('keeps each record under its own ID when a record carries another `__id`', async () => {
    const {me} = await serve();
    const handoff = getRelayHandoff(me.card);
    if (handoff == null) {
      throw new Error('Expected a handed-off reference.');
    }
    // The record's key carries its ID; a server could still send `__id`.
    const records: $FlowFixMe = handoff.records;
    records['4'] = {...records['4'], __id: 'other'};
    const client = createClient();
    const renderer = render(client.environment, <Card user={me.card} />);
    expect(renderer.toJSON()).toBe('Zuckerberg 4.jpg');
    expect(client.source.get('4')).toEqual(
      expect.objectContaining({__id: '4'}),
    );
  });

  it('names installRelayHandoff(environment) when an Environment without it reads a handed-off reference', async () => {
    const {me} = await serve();
    const environment = new RelayEnvironment({
      network: Network.create(() => Observable.create(() => {})),
      store: new Store(new RecordSource()),
    });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        TestRenderer.act(() => {
          TestRenderer.create(
            <RelayEnvironmentProvider environment={environment}>
              <Card user={me.card} />
            </RelayEnvironmentProvider>,
          );
        }),
      ).toThrow(
        'Relay: A server component handed off this fragment reference, but ' +
          '`installRelayHandoff(environment)`',
      );
    } finally {
      error.mockRestore();
    }
  });

  it('publishes a new root without updating another reader during render', async () => {
    const {me} = await serve();
    const client = createClient();
    client.environment.commitPayload(
      createOperationDescriptor(LastNameQuery, {}),
      {node: {__typename: 'User', id: '4', lastName: 'Old'}},
    );
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const app = (withCard: boolean) => (
      <RelayEnvironmentProvider environment={client.environment}>
        <LastName />
        {withCard ? (
          <React.Suspense fallback="loading">
            <Card user={me.card} />
          </React.Suspense>
        ) : null}
      </RelayEnvironmentProvider>
    );
    let renderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(app(false));
    });
    expect(renderer?.toJSON()).toBe('Old');
    TestRenderer.act(() => {
      renderer?.update(app(true));
    });
    await TestRenderer.act(() => flush());
    expect(renderer?.toJSON()).toEqual(['Zuckerberg', 'Zuckerberg 4.jpg']);
    const updatesDuringRender = consoleError.mock.calls.filter(([message]) =>
      String(message).includes('Cannot update a component'),
    );
    consoleError.mockRestore();
    expect(updatesDuringRender).toEqual([]);
  });

  it.each([
    ['the Store', 'store'],
    ['a record the root reaches', 'record'],
  ])(
    'reads a root when %s was invalidated, with no suspension',
    async (_label, invalidated) => {
      const {me} = await serve();
      const invalidatedClient = () => {
        const client = createClient();
        client.environment.commitUpdate(store => {
          if (invalidated === 'store') {
            store.invalidateStore();
          } else {
            store.create('4', 'User').invalidateRecord();
          }
        });
        return client;
      };
      // React Flight decodes a `next` that has already settled as a chunk
      // whose `then` calls back synchronously.
      const user = {
        ...(me.card as $FlowFixMe),
        __handoff: {
          ...(me.card as $FlowFixMe).__handoff,
          next: {then: (resolve: (chunk: null) => void) => resolve(null)},
        },
      };
      const settled = render(
        invalidatedClient().environment,
        <Card user={user as $FlowFixMe} />,
      );
      expect(settled.toJSON()).toBe('Zuckerberg 4.jpg');
      // A handoff whose next chunk is still on its way.
      const pending = render(
        invalidatedClient().environment,
        <Card user={me.card} />,
      );
      expect(pending.toJSON()).toBe('Zuckerberg 4.jpg');
    },
  );

  it('notifies other readers when the render that published a root never commits', async () => {
    const {me} = await serve();
    const client = createClient();
    client.environment.commitPayload(
      createOperationDescriptor(LastNameQuery, {}),
      {node: {__typename: 'User', id: '4', lastName: 'Old'}},
    );
    const never = new Promise<void>(() => {});
    component Suspends() {
      throw never;
    }
    const app = (withCard: boolean) => (
      <RelayEnvironmentProvider environment={client.environment}>
        <LastName />
        {withCard ? (
          <React.Suspense fallback="loading">
            <Card user={me.card} />
            <Suspends />
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
    TestRenderer.act(() => {
      renderer?.update(app(true));
    });
    await TestRenderer.act(() => flush());
    TestRenderer.act(() => {
      jest.runAllTimers();
    });
    expect(renderer?.toJSON()).toEqual(['Zuckerberg', 'loading']);
  });

  it('publishes once under StrictMode', async () => {
    const {me} = await serve();
    const client = createClient();
    const executeWithSource = jest.spyOn(
      client.environment,
      'executeWithSource',
    );
    const renderer = render(
      client.environment,
      <React.StrictMode>
        <Card user={me.card} />
      </React.StrictMode>,
    );
    expect(renderer.toJSON()).toBe('Zuckerberg 4.jpg');
    expect(executeWithSource).toHaveBeenCalledTimes(1);
  });

  it('suspends until deferred records arrive', async () => {
    const {me, sink} = await serve();
    const client = createClient();
    const renderer = render(
      client.environment,
      <Deferred user={me.deferred} />,
    );
    expect(renderer.toJSON()).toBe('loading');
    await TestRenderer.act(async () => {
      sink.next({
        data: {emailAddresses: ['zuck@example.com'], id: '4'},
        label: 'useRelayHandoffTestQuery$defer$deferred',
        path: ['me'],
      });
      sink.complete();
      await flush();
    });
    expect(renderer.toJSON()).toBe('zuck@example.com');
  });

  it('renders a @defer child without its own Suspense boundary, in a concurrent root', async () => {
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
      throw new Error('Expected a reference.');
    }
    // The deferred payload arrives before the client renders.
    sinks[0].next({
      data: {__typename: 'User', id: '4', lastName: 'Zuckerberg'},
      label: 'useRelayHandoffTestDeferParent_user$defer$child',
      path: ['me'],
    });
    sinks[0].complete();
    await flush();
    component Child(user: useRelayHandoffTestDeferChild_user$key) {
      return ` ${useFragment(DeferChildFragment, user).lastName ?? ''}`;
    }
    component Parent(user: useRelayHandoffTestDeferParent_user$key) {
      const data = useFragment(DeferParentFragment, user);
      return (
        <>
          {data.name}
          <Child user={data} />
        </>
      );
    }
    const client = createClient();
    let renderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={client.environment}>
          <React.Suspense fallback="loading">
            <Parent user={parent} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
        {createNodeMock: () => null, unstable_isConcurrent: true},
      );
    });
    await TestRenderer.act(() => flush());
    expect(renderer?.toJSON()).toEqual(['Zuck', ' Zuckerberg']);
  });

  [true, false].forEach(activityCompatibility => {
    it(`reads a fragment a handed-off fragment spreads after the reader that spread it unmounted (Activity compatibility ${String(activityCompatibility)})`, async () => {
      const flag = RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY;
      RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = activityCompatibility;
      try {
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
          throw new Error('Expected a reference.');
        }
        sinks[0].next({
          data: {__typename: 'User', id: '4', lastName: 'Zuckerberg'},
          label: 'useRelayHandoffTestDeferParent_user$defer$child',
          path: ['me'],
        });
        sinks[0].complete();
        await flush();
        component Child(user: useRelayHandoffTestDeferChild_user$key) {
          return ` ${useFragment(DeferChildFragment, user).lastName ?? ''}`;
        }
        // The reference to the spread fragment outlives the reader.
        let spread: ?useRelayHandoffTestDeferChild_user$key = null;
        component Parent(user: useRelayHandoffTestDeferParent_user$key) {
          const data = useFragment(DeferParentFragment, user);
          spread = data;
          return data.name;
        }
        const client = createClient();
        const renderer = render(client.environment, <Parent user={parent} />);
        await TestRenderer.act(() => flush());
        expect(renderer.toJSON()).toBe('Zuck');
        TestRenderer.act(() => renderer.unmount());
        await TestRenderer.act(() => flush());
        // Nothing retains the root's records now.
        expect(client.source.has('4')).toBe(false);
        const kept = spread;
        if (kept == null) {
          throw new Error('Expected the spread reference.');
        }
        const later = render(client.environment, <Child user={kept} />);
        await TestRenderer.act(() => flush());
        expect(later.toJSON()).toBe(' Zuckerberg');
        // Once no reader holds a reference, nothing retains the records.
        TestRenderer.act(() => later.unmount());
        await TestRenderer.act(() => flush());
        expect(client.source.has('4')).toBe(false);
      } finally {
        RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = flag;
      }
    });
  });

  it('throws a failed server query to the nearest error boundary', async () => {
    const {me, sink} = await serve();
    const client = createClient();
    const renderer = render(
      client.environment,
      <Deferred user={me.deferred} />,
    );
    await TestRenderer.act(async () => {
      sink.error(new Error('stream failed'));
      await flush();
    });
    expect(renderer.toJSON()).toBe('error: stream failed');
  });

  it('throws to the error boundary when the handoff already failed before the first read', async () => {
    const {me} = await serve();
    const ref = me.deferred as $FlowFixMe;
    // React Flight decodes `next` as a chunk whose `then` calls back
    // synchronously once it has settled, here with the server's failure.
    const failed = {
      ...ref,
      __handoff: {
        ...ref.__handoff,
        next: {
          then(_: unknown, onRejected: (error: Error) => void) {
            onRejected(new Error('deferred payload failed'));
          },
        },
      },
    };
    const client = createClient();
    const renderer = render(
      client.environment,
      <Deferred user={failed as $FlowFixMe} />,
    );
    expect(renderer.toJSON()).toBe('error: deferred payload failed');
  });

  it('throws to the error boundary when publishing the handoff throws', async () => {
    const {me} = await serve();
    const client = createClient();
    jest.spyOn(client.store, 'publish').mockImplementation(() => {
      throw new Error('publish failed');
    });
    const renderer = render(client.environment, <Card user={me.card} />);
    expect(renderer.toJSON()).toBe('error: publish failed');
  });

  it('reads a fragment a handed-off fragment spreads in another Environment that has not read the handoff', async () => {
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
      throw new Error('Expected a reference.');
    }
    sinks[0].next({
      data: {__typename: 'User', id: '4', lastName: 'Zuckerberg'},
      label: 'useRelayHandoffTestDeferParent_user$defer$child',
      path: ['me'],
    });
    sinks[0].complete();
    await flush();
    component Child(user: useRelayHandoffTestDeferChild_user$key) {
      return ` ${useFragment(DeferChildFragment, user).lastName ?? ''}`;
    }
    let spread: ?useRelayHandoffTestDeferChild_user$key = null;
    component Parent(user: useRelayHandoffTestDeferParent_user$key) {
      const data = useFragment(DeferParentFragment, user);
      spread = data;
      return data.name;
    }
    const first = createClient();
    const renderer = render(first.environment, <Parent user={parent} />);
    await TestRenderer.act(() => flush());
    expect(renderer.toJSON()).toBe('Zuck');
    const kept = spread;
    if (kept == null) {
      throw new Error('Expected the spread reference.');
    }
    // An Environment that never read the handed-off reference reads the
    // spread one: it publishes and retains the root's records itself.
    const other = createClient();
    const later = render(other.environment, <Child user={kept} />);
    await TestRenderer.act(() => flush());
    expect(later.toJSON()).toBe(' Zuckerberg');
    TestRenderer.act(() => later.unmount());
    await TestRenderer.act(() => flush());
    expect(other.source.has('4')).toBe(false);
  });

  it('refills only missing fields when a collected root mounts again', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    const client = createClient();
    const lastName = createOperationDescriptor(LastNameQuery, {});
    const first = render(client.environment, <Card user={me.card} />);
    expect(first.toJSON()).toBe('Zuckerberg 4.jpg');
    await TestRenderer.act(() => flush());
    client.environment.commitPayload(lastName, {
      node: {__typename: 'User', id: '4', lastName: 'Z.'},
    });
    TestRenderer.act(() => first.unmount());
    // As if collected.
    client.source.remove('client:4:profilePicture(size:[32])');
    const second = render(client.environment, <Card user={me.card} />);
    expect(second.toJSON()).toBe('Z. 4.jpg');
    expect(client.requests).toEqual([]);
  });

  it('releases every retain on unmount, after any number of renders', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    const client = createClient();
    const renderer = render(client.environment, <Card user={me.card} />);
    await TestRenderer.act(() => flush());
    for (let ii = 0; ii < 3; ii++) {
      TestRenderer.act(() => {
        renderer.update(
          <RelayEnvironmentProvider environment={client.environment}>
            <ErrorBoundary>
              <React.Suspense fallback="loading">
                <Card user={me.card} />
              </React.Suspense>
            </ErrorBoundary>
          </RelayEnvironmentProvider>,
        );
      });
    }
    TestRenderer.act(() => renderer.unmount());
    await TestRenderer.act(() => flush());
    expect(client.source.has('client:4:profilePicture(size:[32])')).toBe(false);
  });

  it('releases its retains when a Store subscriber throws as its records notify', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    const client = createClient();
    const lastName = createOperationDescriptor(LastNameQuery, {});
    client.environment.commitPayload(lastName, {
      node: {__typename: 'User', id: '4', lastName: 'Older'},
    });
    client.environment.subscribe(
      client.environment.lookup(lastName.fragment),
      () => {
        throw new Error('subscriber failed');
      },
    );
    const renderer = render(client.environment, <Card user={me.card} />);
    await TestRenderer.act(() => flush());
    expect(renderer.toJSON()).toBe('error: subscriber failed');
    client.store.__gc();
    expect(client.source.has('client:4:profilePicture(size:[32])')).toBe(false);
  });

  it('keeps the roots of a hidden reader, with newer client data, across GC', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    const client = createClient();
    const Activity = getActivity();
    component Host(mode: 'hidden' | 'visible') {
      return (
        <Activity mode={mode}>
          <Card user={me.card} />
        </Activity>
      );
    }
    const wrap = (mode: 'hidden' | 'visible') => (
      <RelayEnvironmentProvider environment={client.environment}>
        <ErrorBoundary>
          <React.Suspense fallback="loading">
            <Host mode={mode} />
          </React.Suspense>
        </ErrorBoundary>
      </RelayEnvironmentProvider>
    );
    const renderer = render(client.environment, <Host mode="visible" />);
    await TestRenderer.act(() => flush());
    client.environment.commitPayload(
      createOperationDescriptor(LastNameQuery, {}),
      {node: {__typename: 'User', id: '4', lastName: 'Newer'}},
    );
    await TestRenderer.act(async () => {
      renderer.update(wrap('hidden'));
      await flush();
    });
    // Nothing else retains the card's records.
    client.store.__gc();
    expect(client.source.has('client:4:profilePicture(size:[32])')).toBe(true);
    await TestRenderer.act(async () => {
      renderer.update(wrap('visible'));
      await flush();
    });
    expect(renderer.toJSON()).toBe('Newer 4.jpg');
  });

  it('fails a reader whose handoff completed without its data', async () => {
    const {me, sink} = await serve();
    const client = createClient();
    const executeWithSource = jest.spyOn(
      client.environment,
      'executeWithSource',
    );
    const renderer = render(
      client.environment,
      <Deferred user={me.deferred} />,
    );
    expect(renderer.toJSON()).toBe('loading');
    // The deferred payload never arrives.
    await TestRenderer.act(async () => {
      sink.complete();
      await flush();
    });
    expect(renderer.toJSON()).toBe(
      'error: Relay: The server query completed without the data of `useRelayHandoffTestDeferred_user$normalization`.',
    );
    expect(executeWithSource.mock.calls.length).toBeLessThan(3);
  });

  it('fails a reader when the request completed without its data before it was read', async () => {
    const {me} = await serve({completeFirst: true});
    const renderer = render(
      createClient().environment,
      <Deferred user={me.deferred} />,
    );
    await TestRenderer.act(() => flush());
    expect(renderer.toJSON()).toBe(
      'error: Relay: The server query completed without the data of `useRelayHandoffTestDeferred_user$normalization`.',
    );
  });

  it('publishes again when records were collected before the first commit', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    const client = createClient();
    const Activity = getActivity();
    component Host(mode: 'hidden' | 'visible') {
      return (
        <Activity mode={mode}>
          <Card user={me.card} />
        </Activity>
      );
    }
    // A hidden Activity renders the reader but does not commit its effects.
    const renderer = render(client.environment, <Host mode="hidden" />);
    await TestRenderer.act(() => flush());
    client.source.remove('client:4:profilePicture(size:[32])');
    await TestRenderer.act(async () => {
      renderer.update(
        <RelayEnvironmentProvider environment={client.environment}>
          <ErrorBoundary>
            <React.Suspense fallback="loading">
              <Host mode="visible" />
            </React.Suspense>
          </ErrorBoundary>
        </RelayEnvironmentProvider>,
      );
      await flush();
    });
    expect(renderer.toJSON()).toBe('Zuckerberg 4.jpg');
  });

  it('publishes again at a later render when the replay its commit starts fails while its records are prepared', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    const client = createClient();
    const Activity = getActivity();
    component TickCard(user: useRelayHandoffTestCard_user$key, tick: number) {
      const data = useFragment(CardFragment, user);
      return `${tick}:${data.lastName ?? ''} ${data.profilePicture?.uri ?? ''}`;
    }
    const MemoCard = React.memo(TickCard);
    component Host(mode: 'hidden' | 'visible', tick: number) {
      return (
        <Activity mode={mode}>
          <MemoCard tick={tick} user={me.card} />
        </Activity>
      );
    }
    const wrap = (mode: 'hidden' | 'visible', tick: number) => (
      <RelayEnvironmentProvider environment={client.environment}>
        <ErrorBoundary>
          <React.Suspense fallback="loading">
            <Host mode={mode} tick={tick} />
          </React.Suspense>
        </ErrorBoundary>
      </RelayEnvironmentProvider>
    );
    let renderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(wrap('hidden', 0), {
        createNodeMock: () => null,
        unstable_isConcurrent: true,
      });
      await flush();
    });
    client.source.remove('client:4:profilePicture(size:[32])');
    // The replay the reveal's commit starts fails as it reads the client's
    // records, before anything is published.
    const hasValue = jest
      .spyOn(RelayModernRecord, 'hasValue')
      .mockImplementationOnce(() => {
        throw new Error('preparing the records failed');
      });
    await TestRenderer.act(async () => {
      renderer?.update(wrap('visible', 0));
      await flush();
    });
    expect(hasValue).toHaveBeenCalled();
    // As after a failure in the Environment's own handling of the replay, a
    // later render replays the root again.
    await TestRenderer.act(async () => {
      renderer?.update(wrap('visible', 1));
      await flush();
    });
    expect(renderer?.toJSON()).toBe('1:Zuckerberg 4.jpg');
  });

  it('keeps a record a list repeats when the server appends it again', async () => {
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
    const result = serverQuery(server, ActorsQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          actors: [{__typename: 'User', id: 'a1', name: 'Ada'}],
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const actors = (await result).me?.actors;
    if (actors == null) {
      throw new Error('Expected an actors reference.');
    }
    const client = createClient();
    component Actors(user: useRelayHandoffTestActors_user$key) {
      const value = useFragment(ActorsFragment, user);
      return (value.actors ?? []).map(actor => actor?.name).join(',');
    }
    const renderer = render(client.environment, <Actors user={actors} />);
    expect(renderer.toJSON()).toBe('Ada');
    await TestRenderer.act(async () => {
      sinks[0].next({
        data: {__typename: 'User', id: 'a1', name: 'Ada'},
        label: 'useRelayHandoffTestActors_user$stream$actors',
        path: ['me', 'actors', 1],
      });
      await flush();
    });
    expect(renderer.toJSON()).toBe('Ada,Ada');
  });

  it('appends a streamed item once when two queries hand off the same list', async () => {
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
    const resultA = serverQuery(server, ActorsQuery, {});
    const resultB = serverQuery(server, ActorsBQuery, {});
    const initial: GraphQLResponse = {
      data: {
        me: {
          __typename: 'User',
          actors: [{__typename: 'User', id: 'a1', name: 'Ada'}],
          id: '4',
        },
      },
      extensions: {is_final: false},
    };
    sinks[0].next(initial);
    sinks[1].next(initial);
    const a = (await resultA).me?.actors;
    const b = (await resultB).me?.actors;
    if (a == null || b == null) {
      throw new Error('Expected actors references.');
    }
    const client = createClient();
    component Actors(user: useRelayHandoffTestActors_user$key) {
      const value = useFragment(ActorsFragment, user);
      return (value.actors ?? []).map(actor => actor?.name).join(',');
    }
    const renderer = render(
      client.environment,
      <>
        <Actors user={a} />
        <Actors user={b} />
      </>,
    );
    expect(renderer.toJSON()).toEqual(['Ada', 'Ada']);
    const item = {
      data: {__typename: 'User', id: 'a2', name: 'Grace'},
      label: 'useRelayHandoffTestActors_user$stream$actors',
      path: ['me', 'actors', 1],
    };
    await TestRenderer.act(async () => {
      sinks[0].next(item);
      sinks[1].next(item);
      await flush();
    });
    expect(renderer.toJSON()).toEqual(['Ada,Grace', 'Ada,Grace']);
  });

  it('appends streamed items once when another request handed off the whole list first', async () => {
    const createServer = (sinks: Array<Sink<GraphQLResponse>>) =>
      new Environment({
        isServer: true,
        network: Network.create(() =>
          Observable.create((sink: Sink<GraphQLResponse>) => {
            sinks.push(sink);
          }),
        ),
        store: new Store(new RecordSource()),
      });
    const ada = {__typename: 'User', id: 'a1', name: 'Ada'};
    const grace = {__typename: 'User', id: 'a2', name: 'Grace'};
    const linus = {__typename: 'User', id: 'a3', name: 'Linus'};
    // One request's list streams; a later request (e.g. after a client
    // navigation) hands off the whole list before that stream ends.
    const sinksA: Array<Sink<GraphQLResponse>> = [];
    const resultA = serverQuery(createServer(sinksA), ActorsQuery, {});
    sinksA[0].next({
      data: {me: {__typename: 'User', actors: [ada], id: '4'}},
      extensions: {is_final: false},
    });
    const sinksB: Array<Sink<GraphQLResponse>> = [];
    const resultB = serverQuery(createServer(sinksB), ActorsQuery, {});
    sinksB[0].next({
      data: {me: {__typename: 'User', actors: [ada, grace, linus], id: '4'}},
    });
    sinksB[0].complete();
    const a = (await resultA).me?.actors;
    const b = (await resultB).me?.actors;
    if (a == null || b == null) {
      throw new Error('Expected actors references.');
    }
    const client = createClient();
    component Actors(user: useRelayHandoffTestActors_user$key) {
      const value = useFragment(ActorsFragment, user);
      return (value.actors ?? []).map(actor => actor?.name).join(',');
    }
    const renderer = render(
      client.environment,
      <>
        <Actors user={a} />
        <Actors user={b} />
      </>,
    );
    expect(renderer.toJSON()).toEqual(['Ada,Grace,Linus', 'Ada,Grace,Linus']);
    await TestRenderer.act(async () => {
      sinksA[0].next({
        data: grace,
        label: 'useRelayHandoffTestActors_user$stream$actors',
        path: ['me', 'actors', 1],
      });
      sinksA[0].next({
        data: linus,
        label: 'useRelayHandoffTestActors_user$stream$actors',
        path: ['me', 'actors', 2],
      });
      await flush();
    });
    expect(renderer.toJSON()).toEqual(['Ada,Grace,Linus', 'Ada,Grace,Linus']);
  });

  it('appends streamed items after another request handed off the list as null', async () => {
    const createServer = (sinks: Array<Sink<GraphQLResponse>>) =>
      new Environment({
        isServer: true,
        network: Network.create(() =>
          Observable.create((sink: Sink<GraphQLResponse>) => {
            sinks.push(sink);
          }),
        ),
        store: new Store(new RecordSource()),
      });
    const ada = {__typename: 'User', id: 'a1', name: 'Ada'};
    const grace = {__typename: 'User', id: 'a2', name: 'Grace'};
    const linus = {__typename: 'User', id: 'a3', name: 'Linus'};
    const handOff = async (
      sinks: Array<Sink<GraphQLResponse>>,
      actors: ?ReadonlyArray<{...}>,
      final: boolean,
    ) => {
      const result = serverQuery(createServer(sinks), ActorsQuery, {});
      sinks[0].next({
        data: {me: {__typename: 'User', actors, id: '4'}},
        extensions: {is_final: final},
      });
      if (final) {
        sinks[0].complete();
      }
      const reference = (await result).me?.actors;
      if (reference == null) {
        throw new Error('Expected an actors reference.');
      }
      return reference;
    };
    // A first request's list streams; a second request hands off the whole
    // list, then a third hands it off as null, before that stream ends.
    const sinksA: Array<Sink<GraphQLResponse>> = [];
    const a = await handOff(sinksA, [ada], false);
    const b = await handOff([], [ada, grace, linus], true);
    const c = await handOff([], null, true);
    const client = createClient();
    component Actors(user: useRelayHandoffTestActors_user$key) {
      const value = useFragment(ActorsFragment, user);
      return (value.actors ?? []).map(actor => actor?.name).join(',');
    }
    const renderer = render(
      client.environment,
      <>
        <Actors user={a} />
        <Actors user={b} />
        <Actors user={c} />
      </>,
    );
    await TestRenderer.act(async () => {
      sinksA[0].next({
        data: grace,
        label: 'useRelayHandoffTestActors_user$stream$actors',
        path: ['me', 'actors', 1],
      });
      sinksA[0].next({
        data: linus,
        label: 'useRelayHandoffTestActors_user$stream$actors',
        path: ['me', 'actors', 2],
      });
      await flush();
    });
    expect(renderer.toJSON()).toEqual([
      'Ada,Grace,Linus',
      'Ada,Grace,Linus',
      'Ada,Grace,Linus',
    ]);
  });

  it('appends streamed items to a list the client changed', async () => {
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
    const data = await result;
    const list = data.me?.list;
    if (list == null) {
      throw new Error('Expected a list reference.');
    }
    const client = createClient();
    component List(user: useRelayHandoffTestStream_user$key) {
      const value = useFragment(StreamFragment, user);
      return (value.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const renderer = render(client.environment, <List user={list} />);
    expect(renderer.toJSON()).toBe('f0');
    // The client puts an item of its own first.
    TestRenderer.act(() => {
      client.environment.commitUpdate(store => {
        const friends = store.get('4')?.getLinkedRecord('friends(first:10)');
        const node = store.create('local', 'User');
        node.setValue('Local', 'name');
        const edge = store.create('client:local:edge', 'FriendsEdge');
        edge.setLinkedRecord(node, 'node');
        friends?.setLinkedRecords(
          [edge, ...(friends.getLinkedRecords('edges') ?? [])],
          'edges',
        );
      });
    });
    expect(renderer.toJSON()).toBe('Local,f0');
    await TestRenderer.act(async () => {
      sinks[0].next({
        data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
        label: 'useRelayHandoffTestStream_user$stream$edges',
        path: ['me', 'friends', 'edges', 1],
      });
      await flush();
    });
    expect(renderer.toJSON()).toBe('Local,f0,f1');
  });

  it('publishes streamed items again when a collected root mounts again', async () => {
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
      throw new Error('Expected a list reference.');
    }
    sinks[0].next({
      data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
      label: 'useRelayHandoffTestStream_user$stream$edges',
      path: ['me', 'friends', 'edges', 1],
    });
    sinks[0].complete();
    const client = createClient();
    component List(user: useRelayHandoffTestStream_user$key) {
      const value = useFragment(StreamFragment, user);
      return (value.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const first = render(client.environment, <List user={list} />);
    await TestRenderer.act(() => flush());
    expect(first.toJSON()).toBe('f0,f1');
    TestRenderer.act(() => first.unmount());
    // Only the streamed item's node is collected: the list is not appended
    // to twice.
    client.source.remove('f1');
    const second = render(client.environment, <List user={list} />);
    await TestRenderer.act(() => flush());
    expect(second.toJSON()).toBe('f0,f1');
    TestRenderer.act(() => second.unmount());
    await TestRenderer.act(() => flush());
    expect(client.source.has('client:4:friends(first:10)')).toBe(false);
    // The list record is created again by the first chunk, and takes the
    // streamed item from the next one.
    const third = render(client.environment, <List user={list} />);
    await TestRenderer.act(() => flush());
    expect(third.toJSON()).toBe('f0,f1');
    // A record that was not collected keeps the client's newer data, while
    // the list record created again takes the streamed item.
    TestRenderer.act(() => {
      client.environment.commitUpdate(store => {
        store.get('f0')?.setValue('F0-new', 'name');
      });
    });
    TestRenderer.act(() => third.unmount());
    client.source.remove('client:4:friends(first:10)');
    const fourth = render(client.environment, <List user={list} />);
    await TestRenderer.act(() => flush());
    expect(fourth.toJSON()).toBe('F0-new,f1');
    expect(client.requests).toEqual([]);
  });

  it("ends a stream whose chunk fails to apply to the client's records, and releases its root", async () => {
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
      throw new Error('Expected a list reference.');
    }
    const client = createClient();
    component List(user: useRelayHandoffTestStream_user$key) {
      const value = useFragment(StreamFragment, user);
      return (value.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const renderer = render(client.environment, <List user={list} />);
    await TestRenderer.act(() => flush());
    expect(renderer.toJSON()).toBe('f0');
    // The stream keeps the root retained after its reader unmounts.
    TestRenderer.act(() => renderer.unmount());
    await TestRenderer.act(() => flush());
    // A client update leaves the list field as a scalar, so the streamed item
    // cannot be appended to it.
    client.environment.commitUpdate(proxies => {
      proxies.get('client:4:friends(first:10)')?.setValue('none', 'edges');
    });
    await TestRenderer.act(async () => {
      sinks[0].next({
        data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
        label: 'useRelayHandoffTestStream_user$stream$edges',
        path: ['me', 'friends', 'edges', 1],
      });
      await flush();
    });
    // The failed execution ended, so nothing retains the root any more.
    client.store.__gc();
    expect(client.source.has('client:4:friends(first:10)')).toBe(false);
  });

  it('keeps a value that is not an Error, thrown as a chunk is prepared, as the cause of the failure, and releases the root', async () => {
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
      throw new Error('Expected a list reference.');
    }
    const client = createClient();
    component List(user: useRelayHandoffTestStream_user$key) {
      const value = useFragment(StreamFragment, user);
      return (value.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const first = render(client.environment, <List user={list} />);
    await TestRenderer.act(() => flush());
    expect(first.toJSON()).toBe('f0');
    // The stream keeps the root retained after its reader unmounts.
    TestRenderer.act(() => first.unmount());
    await TestRenderer.act(() => flush());
    // Preparing the next chunk throws something that is not an Error.
    const thrown = {reason: 'reading the client records failed'};
    jest.spyOn(client.store, 'getSource').mockImplementationOnce(() => {
      throw thrown;
    });
    await TestRenderer.act(async () => {
      sinks[0].next({
        data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
        label: 'useRelayHandoffTestStream_user$stream$edges',
        path: ['me', 'friends', 'edges', 1],
      });
      await flush();
    });
    // The failed execution ended, so nothing retains the root any more.
    client.store.__gc();
    expect(client.source.has('client:4:friends(first:10)')).toBe(false);
    // A reader that mounts again throws the failure, with what was thrown as
    // its cause.
    const second = render(client.environment, <List user={list} />);
    expect(second.toJSON()).toBe('error: Relay: Publishing a handoff failed.');
    const boundary = second.root.findByType(ErrorBoundary).instance;
    if (!(boundary instanceof ErrorBoundary)) {
      throw new Error('Expected the error boundary.');
    }
    expect(boundary.state.error?.cause).toBe(thrown);
  });

  it('keeps a root while its handoff still streams after its reader unmounts', async () => {
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
      throw new Error('Expected a list reference.');
    }
    const client = createClient();
    component List(user: useRelayHandoffTestStream_user$key) {
      const value = useFragment(StreamFragment, user);
      return (value.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const first = render(client.environment, <List user={list} />);
    await TestRenderer.act(() => flush());
    expect(first.toJSON()).toBe('f0');
    TestRenderer.act(() => first.unmount());
    await TestRenderer.act(() => flush());
    // No reader retains the root while its handoff still streams.
    client.store.__gc();
    expect(client.source.has('client:4:friends(first:10)')).toBe(true);
    await TestRenderer.act(async () => {
      sinks[0].next({
        data: {node: {__typename: 'User', id: 'f1', name: 'f1'}},
        label: 'useRelayHandoffTestStream_user$stream$edges',
        path: ['me', 'friends', 'edges', 1],
      });
      await flush();
    });
    const second = render(client.environment, <List user={list} />);
    await TestRenderer.act(() => flush());
    expect(second.toJSON()).toBe('f0,f1');
    expect(client.requests).toEqual([]);
  });

  it('paginates a handed-off connection whose edges streamed', async () => {
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
            pageInfo: {endCursor: 'cursor:3', hasNextPage: true},
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const people = (await result).me?.people;
    if (people == null) {
      throw new Error('Expected a reference.');
    }
    const label = 'useRelayHandoffTestStreamConnection_user$stream$people';
    [2, 3].forEach(index => {
      sinks[0].next({
        data: person(index),
        label,
        path: ['me', 'friends', 'edges', index - 1],
      });
    });
    sinks[0].complete();
    const client = createClient();
    let loadNext = null;
    component People(user: useRelayHandoffTestStreamConnection_user$key) {
      const value = usePaginationFragment(StreamConnectionFragment, user);
      loadNext = value.loadNext;
      return (value.data.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const renderer = render(client.environment, <People user={people} />);
    await TestRenderer.act(() => flush());
    expect(renderer.toJSON()).toBe('P1,P2,P3');
    TestRenderer.act(() => {
      loadNext?.(2);
    });
    await TestRenderer.act(async () => {
      client.responses[0].next({
        data: {
          node: {
            __typename: 'User',
            friends: {
              edges: [person(4), person(5)],
              pageInfo: {endCursor: 'cursor:5', hasNextPage: false},
            },
            id: '4',
          },
        },
      });
      client.responses[0].complete();
      await flush();
    });
    expect(renderer.toJSON()).toBe('P1,P2,P3,P4,P5');
    // Another page's handoff, published during render (e.g. after a
    // navigation), into the same Store.
    const other = await serve();
    other.sink.complete();
    await TestRenderer.act(() => flush());
    TestRenderer.act(() => {
      renderer.update(
        <RelayEnvironmentProvider environment={client.environment}>
          <ErrorBoundary>
            <React.Suspense fallback="loading">
              <People user={people} />
              <Card user={other.me.card} />
            </React.Suspense>
          </ErrorBoundary>
        </RelayEnvironmentProvider>,
      );
    });
    expect(renderer.toJSON()).toEqual(['P1,P2,P3,P4,P5', 'Zuckerberg 4.jpg']);
  });

  it('does not overwrite edges the client created when a handoff arrives', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    const client = createClient();
    // An edge the client's own ConnectionHandler created, for another user.
    const nativeEdge =
      'client:4:__useRelayHandoffTest_friends_connection:edges:0';
    client.environment.commitUpdate(store => {
      const node = store.create('6', 'User');
      node.setValue('Grace', 'name');
      store.create(nativeEdge, 'FriendsEdge').setLinkedRecord(node, 'node');
    });
    const hold = client.store.holdGC();
    component Friends(user: useRelayHandoffTestFriends_user$key) {
      const result = usePaginationFragment(FriendsFragment, user);
      return (result.data.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const renderer = render(client.environment, <Friends user={me.friends} />);
    expect(renderer.toJSON()).toBe('Ada');
    const edge = client.source.get(nativeEdge);
    expect(
      edge == null ? null : RelayModernRecord.getLinkedRecordID(edge, 'node'),
    ).toBe('6');
    hold.dispose();
  });

  it('keeps the edges a client query wrote when the server gives a streamed edge the same ID', async () => {
    const PaginationQuery = require('./__generated__/useRelayHandoffTestStreamConnectionPaginationQuery.graphql');
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
    const person = (name: string) => ({
      cursor: `cursor:${name}`,
      node: {__typename: 'User', id: name, name},
    });
    const result = serverQuery(server, StreamConnectionQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {
            edges: [person('P1')],
            pageInfo: {endCursor: 'cursor:P1', hasNextPage: true},
          },
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const people = (await result).me?.people;
    if (people == null) {
      throw new Error('Expected a reference.');
    }
    const client = createClient();
    component People(user: useRelayHandoffTestStreamConnection_user$key) {
      const value = usePaginationFragment(StreamConnectionFragment, user);
      return (value.data.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const renderer = render(client.environment, <People user={people} />);
    await TestRenderer.act(() => flush());
    expect(renderer.toJSON()).toBe('P1');
    // The client's ConnectionHandler names the edges of this response after
    // the connection's next index (`edges:1`, `edges:2`), as the server's
    // names the edges of its next payload.
    TestRenderer.act(() => {
      client.environment.commitPayload(
        createOperationDescriptor(PaginationQuery, {id: '4'}),
        {
          node: {
            __typename: 'User',
            friends: {
              edges: [person('G1'), person('G2')],
              pageInfo: {endCursor: 'cursor:G2', hasNextPage: true},
            },
            id: '4',
          },
        },
      );
    });
    expect(renderer.toJSON()).toBe('G1,G2');
    await TestRenderer.act(async () => {
      sinks[0].next({
        data: person('P2'),
        label: 'useRelayHandoffTestStreamConnection_user$stream$people',
        path: ['me', 'friends', 'edges', 1],
      });
      sinks[0].complete();
      await flush();
    });
    expect(renderer.toJSON()).toBe('G1,G2,P2');
  });

  it('paginates a handed-off connection on the client', async () => {
    const {me, sink} = await serve();
    // Pagination waits for the page's own query, as with any parent query.
    sink.complete();
    await TestRenderer.act(() => flush());
    const client = createClient();
    let loadNext = null;
    component Friends(user: useRelayHandoffTestFriends_user$key) {
      const result = usePaginationFragment(FriendsFragment, user);
      loadNext = result.loadNext;
      return (result.data.friends?.edges ?? [])
        .map(edge => edge?.node?.name)
        .join(',');
    }
    const renderer = render(client.environment, <Friends user={me.friends} />);
    expect(renderer.toJSON()).toBe('Ada');
    await TestRenderer.act(() => flush());
    TestRenderer.act(() => {
      loadNext?.(1);
    });
    expect(client.requests).toEqual([
      {
        name: 'useRelayHandoffTestFriendsPaginationQuery',
        variables: {count: 1, cursor: 'cursor:5', id: '4'},
      },
    ]);
    await TestRenderer.act(async () => {
      client.responses[0].next({
        data: {
          node: {
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:6',
                  node: {__typename: 'User', id: '6', name: 'Grace'},
                },
              ],
              pageInfo: {endCursor: 'cursor:6', hasNextPage: false},
            },
            id: '4',
          },
        },
      });
      client.responses[0].complete();
    });
    expect(renderer.toJSON()).toBe('Ada,Grace');

    // A fresh handoff of the same connection (e.g. after a navigation) must
    // not move the client's edge counter back.
    const fresh = await serve();
    fresh.sink.complete();
    await TestRenderer.act(() => flush());
    TestRenderer.act(() => {
      renderer.update(
        <RelayEnvironmentProvider environment={client.environment}>
          <ErrorBoundary>
            <React.Suspense fallback="loading">
              <Friends user={fresh.me.friends} />
            </React.Suspense>
          </ErrorBoundary>
        </RelayEnvironmentProvider>,
      );
    });
    await TestRenderer.act(() => flush());
    TestRenderer.act(() => {
      loadNext?.(1);
    });
    expect(client.requests.length).toBe(2);
    await TestRenderer.act(async () => {
      client.responses[1].next({
        data: {
          node: {
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'cursor:7',
                  node: {__typename: 'User', id: '7', name: 'Linus'},
                },
              ],
              pageInfo: {endCursor: 'cursor:7', hasNextPage: false},
            },
            id: '4',
          },
        },
      });
      client.responses[1].complete();
    });
    // The fresh list replaced the client's, and the new edge did not collide
    // with the one the client created before.
    expect(renderer.toJSON()).toBe('Ada,Linus');
  });
  describe('with a provider whose value differs in the browser', () => {
    function getScale(variables: {...}): unknown {
      const name = Object.keys(variables).find(key =>
        key.startsWith('__relay_internal__pv__'),
      );
      return name == null ? undefined : variables[name];
    }

    function friend(id: string, name: string, scale: unknown) {
      return {
        cursor: `cursor:${id}`,
        node: {
          __typename: 'User',
          id,
          name,
          profilePicture: {uri: `${id}@${String(scale)}`},
        },
      };
    }

    let refetch = null;
    let loadNext = null;
    component Friends(user: useRelayHandoffTestScaled_user$key) {
      const result = usePaginationFragment(ScaledFragment, user);
      refetch = result.refetch;
      loadNext = result.loadNext;
      return (result.data.friends?.edges ?? [])
        .map(
          edge =>
            `${edge?.node?.name ?? ''}:${edge?.node?.profilePicture?.uri ?? ''}`,
        )
        .join(',');
    }

    afterEach(() => {
      providerState.scale = [1];
    });

    it.each([[[1]], [null]])(
      "paginates and refetches a handed-off reference with the server's value %j",
      async (serverScale: ?ReadonlyArray<number>) => {
        providerState.scale = serverScale;
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
        const result = serverQuery(server, ScaledQuery, {});
        sinks[0].next({
          data: {
            me: {
              __typename: 'User',
              friends: {
                edges: [friend('5', 'Ada', serverScale)],
                pageInfo: {endCursor: 'cursor:5', hasNextPage: true},
              },
              id: '4',
            },
          },
        });
        sinks[0].complete();
        const user = (await result).me?.friends;
        if (user == null) {
          throw new Error('Expected a reference.');
        }

        providerState.scale = [2];
        const client = createClient();
        const renderer = render(client.environment, <Friends user={user} />);
        await TestRenderer.act(() => flush());
        TestRenderer.act(() => {
          loadNext?.(1);
        });
        const scale = getScale(client.requests[0].variables);
        expect(scale).toEqual(serverScale);
        await TestRenderer.act(async () => {
          client.responses[0].next({
            data: {
              node: {
                __typename: 'User',
                friends: {
                  edges: [friend('6', 'Grace', scale)],
                  pageInfo: {endCursor: 'cursor:6', hasNextPage: false},
                },
                id: '4',
              },
            },
          });
          client.responses[0].complete();
        });
        expect(renderer.toJSON()).toBe(
          `Ada:5@${String(serverScale)},Grace:6@${String(serverScale)}`,
        );

        TestRenderer.act(() => {
          refetch?.({}, {fetchPolicy: 'network-only'});
        });
        expect(getScale(client.requests[1].variables)).toEqual(serverScale);
      },
    );

    it("refetches an ordinary reference with the browser's value", async () => {
      providerState.scale = [1];
      const client = createClient();
      const operation = createOperationDescriptor(ScaledClientQuery, {});
      client.environment.retain(operation);
      client.environment.commitPayload(operation, {
        me: {
          __typename: 'User',
          friends: {
            edges: [friend('5', 'Ada', [1])],
            pageInfo: {endCursor: 'cursor:5', hasNextPage: true},
          },
          id: '4',
        },
      });
      component Page() {
        const data = useLazyLoadQuery(
          ScaledClientQuery,
          {},
          {fetchPolicy: 'store-only'},
        );
        return data.me == null ? null : <Friends user={data.me} />;
      }
      const renderer = render(client.environment, <Page />);
      expect(renderer.toJSON()).toBe('Ada:5@1');

      providerState.scale = [2];
      TestRenderer.act(() => {
        loadNext?.(1);
      });
      expect(getScale(client.requests[0].variables)).toEqual([2]);
      TestRenderer.act(() => {
        refetch?.({}, {fetchPolicy: 'network-only'});
      });
      expect(getScale(client.requests[1].variables)).toEqual([2]);
    });
  });

  it('reads a fragment with a provided variable using the server value', async () => {
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
    const result = serverQuery(server, ProvidedQuery, {});
    sinks[0].next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
    sinks[0].complete();
    const user = (await result).me?.provided;
    if (user == null) {
      throw new Error('Expected a user.');
    }
    const client = createClient();
    const renderer = render(client.environment, <ProvidedName user={user} />);
    expect(renderer.toJSON()).toBe('Zuck');
    expect(client.requests).toEqual([]);
  });

  it('carries field errors to @catch and @throwOnFieldError readers', async () => {
    const payload: GraphQLResponse = {
      data: {me: {__typename: 'User', id: '4', lastName: null}},
      errors: [{message: 'Last name failed', path: ['me', 'lastName']}],
    };
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
    const result = serverQuery(server, FieldErrorQuery, {});
    sinks[0].next(payload);
    sinks[0].complete();
    const me = (await result).me;
    if (me == null) {
      throw new Error('Expected me.');
    }

    const client = createClient();
    const caught = render(
      client.environment,
      <CaughtLastName user={me.caught} />,
    );
    const thrown = render(
      client.environment,
      <ThrownLastName user={me.thrown} />,
    );
    expect(caught.toJSON()).toBe('caught 1 error(s)');
    expect(thrown.toJSON()).toMatch(/^error: .*Message: Last name failed$/);
    expect(client.requests).toEqual([]);

    // The client stores the error as it would had it fetched the field itself.
    const fetched = createClient();
    fetched.environment
      .execute({
        operation: createOperationDescriptor(FieldErrorClientQuery, {}),
      })
      .subscribe({});
    fetched.responses[0].next(payload);
    fetched.responses[0].complete();
    const handedOff = client.source.get('4');
    const own = fetched.source.get('4');
    if (handedOff == null || own == null) {
      throw new Error('Expected both records.');
    }
    expect(RelayModernRecord.getErrors(handedOff, 'lastName')).toEqual(
      RelayModernRecord.getErrors(own, 'lastName'),
    );
    expect(RelayModernRecord.getErrors(handedOff, 'lastName')).toEqual([
      expect.objectContaining({message: 'Last name failed'}),
    ]);
  });

  describe('with two server queries that hand off the same list', () => {
    const createServer = () =>
      createActorsServer(config => new Environment(config));

    it('keeps the newest list whatever order the roots apply their chunks in', async () => {
      const {second, twin} = await serveOverlappingActors(
        createServer(),
        'truncated',
      );
      const client = createClient();
      const renderer = render(
        client.environment,
        <>
          <ActorNames user={second} />
          <ActorNames user={twin} />
        </>,
      );
      await TestRenderer.act(() => flush());
      expect(renderer.toJSON()).toEqual(['Ada,Grace,Linus', 'Ada,Grace,Linus']);
    });

    it('keeps every item when a root appends to a list another root cut back meanwhile', async () => {
      // The twin's root sends the list cut back to Ada, then the second root
      // appends Margaret to the list it sent (Ada, Grace, Linus), then the
      // twin's root appends Grace, Linus and Margaret to Ada.
      // The readers render before the tick (the chunks then apply as they
      // arrive) or after it (all of them have arrived).
      for (const finishLater of [true, false]) {
        for (const order of ['twin first', 'second first']) {
          const {finish, second, twin} = await serveOverlappingActors(
            createServer(),
            'batched',
            finishLater,
          );
          const client = createClient();
          const readers =
            order === 'twin first'
              ? [
                  <ActorNames key="twin" user={twin} />,
                  <ActorNames key="second" user={second} />,
                ]
              : [
                  <ActorNames key="second" user={second} />,
                  <ActorNames key="twin" user={twin} />,
                ];
          const renderer = render(client.environment, <>{readers}</>);
          await TestRenderer.act(() => flush());
          await TestRenderer.act(async () => {
            finish();
            await flush();
          });
          expect([order, finishLater, renderer.toJSON()]).toEqual([
            order,
            finishLater,
            ['Ada,Grace,Linus,Margaret', 'Ada,Grace,Linus,Margaret'],
          ]);
        }
      }
    });

    it('applies every chunk of a lone root, including a list cut back', async () => {
      const {twin} = await serveOverlappingActors(createServer(), 'truncated');
      const client = createClient();
      const renderer = render(client.environment, <ActorNames user={twin} />);
      await TestRenderer.act(() => flush());
      expect(renderer.toJSON()).toEqual('Ada');
    });

    it('keeps the order of the writes of a request on its records, which go when the records do', async () => {
      const server = createServer();
      // Two roots whose records are older than all the others: Ada only.
      const early = server.start('A');
      early.next(actorsPayload([ADA]));
      early.complete();
      const earlyActors = await early.actors();
      // The Store has its data, so it reads it from there.
      const laterActors = await server.start('B').actors();
      const {second} = await serveOverlappingActors(server, 'truncated');
      const client = new Environment({
        network: Network.create(() => Observable.create(() => {})),
        store: new Store(new RecordSource(), {gcReleaseBufferSize: 0}),
      });
      const renderer = render(client, <ActorNames user={second} />);
      await TestRenderer.act(() => flush());
      expect(renderer.toJSON()).toEqual('Ada,Grace,Linus');
      // A root with older records renders once the newest are shown.
      TestRenderer.act(() => {
        renderer.update(
          <RelayEnvironmentProvider environment={client}>
            <ErrorBoundary>
              <React.Suspense fallback="loading">
                <ActorNames user={second} />
                <ActorNames user={earlyActors} />
              </React.Suspense>
            </ErrorBoundary>
          </RelayEnvironmentProvider>,
        );
      });
      await TestRenderer.act(() => flush());
      expect(renderer.toJSON()).toEqual(['Ada,Grace,Linus', 'Ada,Grace,Linus']);
      TestRenderer.act(() => renderer.unmount());
      await TestRenderer.act(() => flush());
      // Nothing of the request is left once its records are collected: a
      // root of it that renders now writes its records as a new one would.
      expect(client.getStore().getSource().has('4')).toBe(false);
      const next = render(client, <ActorNames user={laterActors} />);
      await TestRenderer.act(() => flush());
      expect(next.toJSON()).toEqual('Ada');
    });
  });
});
