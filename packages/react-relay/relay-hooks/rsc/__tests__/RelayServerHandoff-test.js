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

import type {RelayHandoff, RelayHandoffChunk} from '../RelayHandoff';
import type {RelayServerHandoffTestQuery$variables} from './__generated__/RelayServerHandoffTestQuery.graphql';
import type {Fragment, FragmentType, IEnvironment} from 'relay-runtime';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';

const {getRelayHandoff} = require('../RelayHandoff');
const RelayServerHandoff = require('../RelayServerHandoff');
const serverQuery = require('../serverQuery');
const {readServerFragment} = require('../useServerFragment');
const {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  createOperationDescriptor,
  graphql,
  readInlineData,
} = require('relay-runtime');

const Query = graphql`
  query RelayServerHandoffTestQuery($size: [Int], $secret: Boolean!) @server {
    me {
      name
      username @include(if: $secret)
      ...RelayServerHandoffTestClient_user @alias(as: "client")
      ...RelayServerHandoffTestArgs_user
        @alias(as: "args")
        @arguments(scale: [2])
      ...RelayServerHandoffTestServer_user
      ...RelayServerHandoffTestDeferred_user
        @alias(as: "deferred")
        @defer(label: "deferred")
      friends(first: 3) {
        edges {
          node {
            ...RelayServerHandoffTestClient_user @alias(as: "client")
          }
        }
      }
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestClient_user on User {
    lastName
    profilePicture(size: $size) {
      uri
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestArgs_user on User
  @argumentDefinitions(scale: {type: "[Int]", defaultValue: [1]}) {
    scaled: profilePicture(size: $scale) {
      uri
    }
  }
`;

const ShadowingArgsQuery = graphql`
  query RelayServerHandoffTestShadowingArgsQuery @server {
    me {
      ...RelayServerHandoffTestShadowingArgs_user
        @alias(as: "client")
        @arguments(hasOwnProperty: [2])
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestShadowingArgs_user on User
  @argumentDefinitions(hasOwnProperty: {type: "[Int]", defaultValue: [1]}) {
    scaled: profilePicture(size: $hasOwnProperty) {
      uri
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestDeferred_user on User {
    emailAddresses
  }
`;

const ServerFragment = graphql`
  fragment RelayServerHandoffTestServer_user on User @server {
    alternate_name
    ...RelayServerHandoffTestInline_user
    ...RelayServerHandoffTestClient_user @alias(as: "nested")
  }
`;

const InlineFragment = graphql`
  fragment RelayServerHandoffTestInline_user on User @inline {
    firstName
  }
`;

const ResolverQuery = graphql`
  query RelayServerHandoffTestResolverQuery @server {
    me {
      relayServerHandoffTestJoined
      ...RelayServerHandoffTestResolverServer_user
    }
  }
`;

const ResolverServerFragment = graphql`
  fragment RelayServerHandoffTestResolverServer_user on User @server {
    relayServerHandoffTestJoined
    ...RelayServerHandoffTestDeferred_user @alias(as: "client")
  }
`;

const AbstractQuery = graphql`
  query RelayServerHandoffTestAbstractQuery @server {
    me {
      ...RelayServerHandoffTestAbstract_user @alias(as: "client")
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestAbstract_user on User {
    name
    ...RelayServerHandoffTestAbstractDeferred_user @defer(label: "abstract")
  }
`;

graphql`
  fragment RelayServerHandoffTestAbstractDeferred_user on User {
    ... on Named {
      name
    }
  }
`;

const UnionQuery = graphql`
  query RelayServerHandoffTestUnionQuery @server {
    me {
      nameRenderer {
        ...RelayServerHandoffTestPlainName_name @alias(as: "plain")
        ... on MarkdownUserNameRenderer {
          data {
            markup
          }
        }
      }
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestPlainName_name on PlainUserNameRenderer {
    data {
      text
    }
  }
`;

const StreamQuery = graphql`
  query RelayServerHandoffTestStreamQuery @server {
    me {
      ...RelayServerHandoffTestStream_user @alias(as: "client")
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestStream_user on User {
    friends(first: 100) {
      edges @stream(initial_count: 1, label: "edges") {
        node {
          name
        }
      }
    }
  }
`;

const StreamConnectionQuery = graphql`
  query RelayServerHandoffTestStreamConnectionQuery @server {
    me {
      ...RelayServerHandoffTestStreamConnection_user @alias(as: "client")
      ...RelayServerHandoffTestDeferred_user
        @alias(as: "deferred")
        @defer(label: "connectionDeferred")
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestStreamConnection_user on User {
    friends(first: 100)
      @connection(key: "RelayServerHandoffTestStreamConnection_friends") {
      edges @stream(initial_count: 1, label: "edges") {
        node {
          name
        }
      }
    }
  }
`;

const StreamTargetQuery = graphql`
  query RelayServerHandoffTestStreamTargetQuery @server {
    me {
      ...RelayServerHandoffTestStreamTarget_user @alias(as: "client")
    }
  }
`;

graphql`
  fragment RelayServerHandoffTestStreamTarget_user on User {
    friends(first: 10) {
      edges @stream(initial_count: 1, label: "edges") {
        node {
          name
          friends(first: 3) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    }
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
  const environment = new Environment({
    isServer: true,
    network: Network.create(() =>
      Observable.create((sink: Sink<GraphQLResponse>) => {
        sinks.push(sink);
      }),
    ),
    store: new Store(new RecordSource()),
  });
  return {environment, sinks};
}

function friend(id: string, lastName: string) {
  return {
    cursor: `cursor:${id}`,
    node: {
      __typename: 'User',
      id,
      lastName,
      profilePicture: {uri: `${id}.jpg`},
    },
  };
}

const ME = {
  __typename: 'User',
  alternate_name: 'SECRET_ALTERNATE_NAME',
  firstName: 'Mark',
  friends: {edges: [friend('5', 'Lovelace'), friend('6', 'Hopper')]},
  id: '4',
  lastName: 'Zuckerberg',
  name: 'SECRET_SERVER_NAME',
  profilePicture: {uri: '4.jpg'},
  scaled: {uri: '4@2x.jpg'},
  username: 'SECRET_USERNAME',
};

function getHandoff(ref: unknown): RelayHandoff {
  const handoff = getRelayHandoff(ref);
  if (handoff == null) {
    throw new Error('Expected a handed-off fragment reference.');
  }
  return handoff;
}

async function start() {
  const server = createServer();
  const variables: RelayServerHandoffTestQuery$variables = {
    secret: true,
    size: [32],
  };
  const result = serverQuery(server.environment, Query, variables);
  server.sinks[0].next({data: {me: ME}, extensions: {is_final: false}});
  const data = await result;
  const me = data.me;
  if (me == null) {
    throw new Error('Expected me.');
  }
  return {...server, me};
}

describe('RelayServerHandoff', () => {
  it('rejects a handoff without the fields this version of Relay reads', () => {
    const handoff = {dataID: 'user', fragment: {}, id: 'h', records: {}};
    expect(() => getRelayHandoff({__handoff: handoff})).toThrow(
      'Relay: A fragment reference carries a handoff this version of Relay ' +
        'cannot read.',
    );
  });

  it("hands off only a client fragment's records, with the variables it reads", async () => {
    const {me} = await start();
    const handoff = getHandoff(me.client);
    expect(handoff.dataID).toBe('4');
    expect(handoff.variables).toEqual({size: [32]});
    expect(handoff.records).toEqual({
      '4': {
        __typename: 'User',
        lastName: 'Zuckerberg',
        'profilePicture(size:[32])': {
          __ref: 'client:4:profilePicture(size:[32])',
        },
      },
      'client:4:profilePicture(size:[32])': {
        __typename: 'Image',
        uri: '4.jpg',
      },
    });
    // The reference crosses as its ID, fragment arguments and handoff.
    expect(Object.keys(me.client).sort()).toEqual([
      '__fragments',
      '__handoff',
      '__id',
    ]);
    const serialized = JSON.stringify(me.client);
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('RelayServerHandoffTestQuery');
    expect(serialized).not.toContain('"secret"');
    // A server fragment reference keeps its owner and fragments, but
    // serializing it sends neither.
    expect(Object.getOwnPropertyDescriptor(me, '__fragments')).toEqual(
      expect.objectContaining({enumerable: false}),
    );
    expect(Object.getOwnPropertyDescriptor(me, '__fragmentOwner')).toEqual(
      expect.objectContaining({enumerable: false}),
    );
  });

  it('returns values that are not plain objects as they are', async () => {
    const server = createServer();
    const result = serverQuery(server.environment, ResolverQuery, {});
    server.sinks[0].next({data: {me: {__typename: 'User', id: '4'}}});
    server.sinks[0].complete();
    const me = (await result).me;
    if (me == null) {
      throw new Error('Expected me.');
    }
    // The Resolver returns a `Date`.
    expect(me.relayServerHandoffTestJoined).toEqual(new Date(0));
    const data = await serverRead(
      server.environment,
      ResolverServerFragment,
      me,
    );
    expect(data.relayServerHandoffTestJoined).toEqual(new Date(0));
    expect(getHandoff(data.client).dataID).toBe('4');
  });

  it('sends a type record change that only a refinement reads', async () => {
    const server = createServer();
    const result = serverQuery(server.environment, AbstractQuery, {});
    server.sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Ada'}},
      extensions: {is_final: false},
    });
    const handoff = getHandoff((await result).me?.client);
    // The deferred payload only learns that `User` implements `Named`.
    server.sinks[0].next({
      data: {__isNamed: 'User', __typename: 'User', id: '4', name: 'Ada'},
      label: 'RelayServerHandoffTestAbstract_user$defer$abstract',
      path: ['me'],
    });
    server.sinks[0].complete();
    const chunk = await handoff.next;
    expect(chunk?.records).toEqual({
      'client:__type:User': {
        __isNamed: true,
        __typename: '__TypeSchema',
      },
    });
  });

  it('normalizes a client fragment on a union member only for that member', async () => {
    const server = createServer();
    const result = serverQuery(server.environment, UnionQuery, {});
    server.sinks[0].next({
      data: {
        me: {
          id: '4',
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            data: {id: 'data', markup: 'markup'},
          },
        },
      },
    });
    expect((await result).me?.nameRenderer?.plain).toBe(null);
    expect(server.environment.getStore().getSource().get('data')).toEqual({
      __id: 'data',
      __typename: 'MarkdownUserNameData',
      id: 'data',
      markup: 'markup',
    });
  });

  it("maps a client fragment's arguments to its normalization's variables", async () => {
    const {me} = await start();
    // `@no_inline` normalization operations prefix their arguments with the
    // fragment name.
    expect(getHandoff(me.args).variables).toEqual({
      RelayServerHandoffTestArgs_user$scale: [2],
    });
    expect(getHandoff(me.args).records['4']).toEqual({
      __typename: 'User',
      'profilePicture(size:[2])': {__ref: 'client:4:profilePicture(size:[2])'},
    });
  });

  it('maps a client fragment argument named like an `Object` method', async () => {
    const server = createServer();
    const result = serverQuery(server.environment, ShadowingArgsQuery, {});
    server.sinks[0].next({data: {me: ME}, extensions: {is_final: false}});
    const me = (await result).me;
    expect(getHandoff(me?.client).variables).toEqual({
      RelayServerHandoffTestShadowingArgs_user$hasOwnProperty: [2],
    });
  });

  it('hands off each reference in a list, one handoff per root', async () => {
    const {environment, me} = await start();
    const edges = me.friends?.edges ?? [];
    expect(edges.map(edge => getHandoff(edge?.node?.client).dataID)).toEqual([
      '5',
      '6',
    ]);
    expect(getHandoff(edges[0]?.node?.client).records['5']).toEqual({
      __typename: 'User',
      lastName: 'Lovelace',
      'profilePicture(size:[32])': {
        __ref: 'client:5:profilePicture(size:[32])',
      },
    });

    // A server fragment read hands off the client references in its data,
    // sharing the handoff of a root that was already handed off.
    const server = await serverRead(environment, ServerFragment, me);
    expect(getHandoff(server.nested)).toBe(getHandoff(me.client));
    expect(server.alternate_name).toBe('SECRET_ALTERNATE_NAME');
    // `@inline` data stays readable on the server.
    expect(readInlineData(InlineFragment, server)).toEqual({firstName: 'Mark'});
    expect(JSON.stringify(server.nested)).not.toContain('SECRET');
  });

  it('sends deferred records in a later chunk and ends with null', async () => {
    const {me, sinks} = await start();
    const handoff = getHandoff(me.deferred);
    expect(handoff.records['4']).toEqual({__typename: 'User'});
    sinks[0].next({
      data: {emailAddresses: ['zuck@example.com'], id: '4'},
      label: 'RelayServerHandoffTestQuery$defer$deferred',
      path: ['me'],
    });
    const chunk = await handoff.next;
    expect(chunk?.records).toEqual({
      '4': {
        __typename: 'User',
        emailAddresses: ['zuck@example.com'],
      },
    });
    sinks[0].complete();
    expect(await chunk?.next).toBe(null);
  });

  it('sends a whole list again when it changed other than by appending', async () => {
    const sinks: Array<Sink<GraphQLResponse>> = [];
    const environment = new Environment({
      // Edges named after their node, so a replaced item changes the list.
      getDataID: (value, typeName) => {
        const node = typeName === 'FriendsEdge' ? value.node : null;
        return node != null && typeof node === 'object'
          ? `edge:${String(node.id)}`
          : value.id;
      },
      isServer: true,
      network: Network.create(() =>
        Observable.create((sink: Sink<GraphQLResponse>) => {
          sinks.push(sink);
        }),
      ),
      store: new Store(new RecordSource()),
    });
    const edge = (id: string) => ({
      cursor: id,
      node: {__typename: 'User', id, name: id},
    });
    const result = serverQuery(environment, StreamQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {edges: [edge('f0'), edge('f1'), edge('f2')]},
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const data = await result;
    const handoff = getHandoff(data.me?.client);
    // The middle item is replaced and an item appended, in one write.
    environment.commitPayload(createOperationDescriptor(StreamQuery, {}), {
      me: {
        __typename: 'User',
        friends: {edges: [edge('f0'), edge('fx'), edge('f2'), edge('f3')]},
        id: '4',
      },
    });
    sinks[0].complete();
    const chunk = await handoff.next;
    const records = chunk?.records;
    if (records == null) {
      throw new Error('Expected a chunk.');
    }
    const lists = Object.keys(records)
      .map(dataID => records[dataID].edges)
      .filter(Boolean);
    expect(lists).toEqual([
      {__refs: ['edge:f0', 'edge:fx', 'edge:f2', 'edge:f3']},
    ]);
    expect(records.fx).toEqual(expect.objectContaining({name: 'fx'}));
  });

  it("fails a root's chunks when the request completes without its data", async () => {
    const {me, sinks} = await start();
    const handoff = getHandoff(me.deferred);
    // The deferred payload never arrives.
    sinks[0].complete();
    await expect(handoff.next).rejects.toThrow(
      'Relay: The server query completed without the data of',
    );
  });

  it('fails a root created after the request completed without its data', async () => {
    const {environment, sinks} = createServer();
    const variables: RelayServerHandoffTestQuery$variables = {
      secret: true,
      size: [32],
    };
    const result = serverQuery(environment, Query, variables);
    // The request completes, without the deferred payload, before the
    // query's data (and so any root) is read.
    sinks[0].next({data: {me: ME}, extensions: {is_final: false}});
    sinks[0].complete();
    const data = await result;
    await expect(getHandoff(data.me?.deferred).next).rejects.toThrow(
      'Relay: The server query completed without the data of',
    );
    expect(await getHandoff(data.me?.client).next).toBe(null);
  });

  it('sends a field again when only its error changed', async () => {
    const {environment, me, sinks} = await start();
    const handoff = getHandoff(me.client);
    const store = environment.getStore();
    store.publish(
      RecordSource.create({
        '4': {
          __errors: {lastName: [{message: 'Last name failed'}]},
          __id: '4',
          __typename: 'User',
          lastName: null,
        },
      }),
    );
    store.notify();
    sinks[0].next({
      data: {emailAddresses: ['zuck@example.com'], id: '4'},
      label: 'RelayServerHandoffTestQuery$defer$deferred',
      path: ['me'],
    });
    const failed = await handoff.next;
    expect(failed?.records['4']).toEqual({
      __errors: {lastName: [{message: 'Last name failed'}]},
      __typename: 'User',
      lastName: null,
    });
    // The same value, now without the error.
    store.publish(
      RecordSource.create({
        '4': {__id: '4', __typename: 'User', lastName: null},
      }),
    );
    store.notify();
    sinks[0].complete();
    const cleared = await failed?.next;
    expect(cleared?.records['4']).toEqual({
      __typename: 'User',
      lastName: null,
    });
  });

  it('does not send a field again when only the key order of its value changed', async () => {
    const {environment, me, sinks} = await start();
    const handoff = getHandoff(me.client);
    const store = environment.getStore();
    // An object value, as a JSON custom scalar has.
    store.publish(
      RecordSource.create({
        '4': {
          __id: '4',
          __typename: 'User',
          lastName: {first: 'Mark', last: 'Zuckerberg'},
        },
      }),
    );
    store.notify();
    sinks[0].next({
      data: {emailAddresses: ['zuck@example.com'], id: '4'},
      label: 'RelayServerHandoffTestQuery$defer$deferred',
      path: ['me'],
    });
    const changed = await handoff.next;
    expect(changed?.records['4']).toEqual({
      __typename: 'User',
      lastName: {first: 'Mark', last: 'Zuckerberg'},
    });
    // The same value with its keys in another order. A field that the client
    // fragment doesn't read changes in the same write, so the Store takes the
    // new object.
    store.publish(
      RecordSource.create({
        '4': {
          __id: '4',
          __typename: 'User',
          firstName: 'Marcus',
          lastName: {last: 'Zuckerberg', first: 'Mark'},
        },
      }),
    );
    store.notify();
    sinks[0].complete();
    expect(await changed?.next).toBe(null);
  });

  it('sends a field again when only its Date value changed', async () => {
    const {environment, me, sinks} = await start();
    const handoff = getHandoff(me.client);
    const store = environment.getStore();
    // A `Date`, as a custom scalar can hold.
    store.publish(
      RecordSource.create({
        '4': {__id: '4', __typename: 'User', lastName: new Date(0)},
      }),
    );
    store.notify();
    sinks[0].next({
      data: {emailAddresses: ['zuck@example.com'], id: '4'},
      label: 'RelayServerHandoffTestQuery$defer$deferred',
      path: ['me'],
    });
    const first = await handoff.next;
    expect(first?.records['4']).toEqual({
      __typename: 'User',
      lastName: new Date(0),
    });
    store.publish(
      RecordSource.create({
        '4': {__id: '4', __typename: 'User', lastName: new Date(1000)},
      }),
    );
    store.notify();
    sinks[0].complete();
    const changed = await first?.next;
    expect(changed?.records['4']).toEqual({
      __typename: 'User',
      lastName: new Date(1000),
    });
  });

  it('fails only the roots whose data a failed request did not deliver', async () => {
    const {me, sinks} = await start();
    sinks[0].error(new Error('stream failed'));
    await expect(getHandoff(me.deferred).next).rejects.toThrow('stream failed');
    // Complete roots end normally.
    expect(await getHandoff(me.client).next).toBe(null);
    expect(await getHandoff(me.args).next).toBe(null);
  });

  it('fails only the incomplete roots created after the request failed', async () => {
    const {environment, sinks} = createServer();
    const variables: RelayServerHandoffTestQuery$variables = {
      secret: true,
      size: [32],
    };
    const result = serverQuery(environment, Query, variables);
    sinks[0].next({data: {me: ME}, extensions: {is_final: false}});
    sinks[0].error(new Error('stream failed'));
    const data = await result;
    await expect(getHandoff(data.me?.deferred).next).rejects.toThrow(
      'stream failed',
    );
    expect(await getHandoff(data.me?.client).next).toBe(null);
  });

  it('copies only what a client fragment reads, whatever else is in the Store', async () => {
    const server = createServer();
    server.environment.commitUpdate(store => {
      for (let ii = 0; ii < 400; ii++) {
        store.create(`other:${ii}`, 'User').setValue(`other ${ii}`, 'name');
      }
    });
    const variables: RelayServerHandoffTestQuery$variables = {
      secret: false,
      size: [32],
    };
    const result = serverQuery(server.environment, Query, variables);
    server.sinks[0].next({data: {me: ME}});
    server.sinks[0].complete();
    const data = await result;
    const records = getHandoff(data.me?.client).records;
    expect(Object.keys(records).length).toBeLessThan(8);
  });

  it('sends a streamed list in work and bytes linear in its length', async () => {
    async function stream(count: number) {
      const {environment, sinks} = createServer();
      const result = serverQuery(environment, StreamQuery, {});
      sinks[0].next({
        data: {
          me: {
            __typename: 'User',
            friends: {
              edges: [
                {
                  cursor: 'c0',
                  node: {__typename: 'User', id: 'f0', name: 'f0'},
                },
              ],
            },
            id: '4',
          },
        },
        extensions: {is_final: false},
      });
      const data = await result;
      const handoff = getHandoff(data.me?.client);
      for (let ii = 1; ii < count; ii++) {
        sinks[0].next({
          data: {
            cursor: `c${ii}`,
            node: {__typename: 'User', id: `f${ii}`, name: `f${ii}`},
          },
          label: 'RelayServerHandoffTestStream_user$stream$edges',
          path: ['me', 'friends', 'edges', ii],
        });
      }
      sinks[0].complete();
      let bytes = JSON.stringify(handoff.records).length;
      let largest = 0;
      let next: ?RelayHandoffChunk = await handoff.next;
      while (next != null) {
        const size = JSON.stringify(next.records).length;
        bytes += size;
        largest = Math.max(largest, size);
        next = await next.next;
      }
      return {bytes, largest};
    }
    let visits = RelayServerHandoff.visitCount;
    let compares = RelayServerHandoff.compareCount;
    const small = await stream(50);
    const smallVisits = RelayServerHandoff.visitCount - visits;
    const smallCompares = RelayServerHandoff.compareCount - compares;
    visits = RelayServerHandoff.visitCount;
    compares = RelayServerHandoff.compareCount;
    const large = await stream(100);
    const largeVisits = RelayServerHandoff.visitCount - visits;
    const largeCompares = RelayServerHandoff.compareCount - compares;
    // Each payload sends its new edge and node plus the appended edge ID,
    // and traverses and compares only those: the stream label in the client
    // fragment marks each payload as appending.
    expect(large.largest).toBeLessThan(400);
    expect(large.bytes / small.bytes).toBeLessThan(2.2);
    expect(largeVisits / smallVisits).toBeLessThan(2.2);
    expect(largeCompares / smallCompares).toBeLessThan(2.2);
  });

  it('sends a streamed connection in bytes linear in its length', async () => {
    async function stream(count: number) {
      const {environment, sinks} = createServer();
      const edge = (index: number) => ({
        cursor: `c${index}`,
        node: {__typename: 'User', id: `f${index}`, name: `f${index}`},
      });
      const result = serverQuery(environment, StreamConnectionQuery, {});
      sinks[0].next({
        data: {
          me: {
            __typename: 'User',
            friends: {
              edges: [edge(0)],
              pageInfo: {endCursor: 'c0', hasNextPage: false},
            },
            id: '4',
          },
        },
        extensions: {is_final: false},
      });
      const data = await result;
      const handoff = getHandoff(data.me?.client);
      for (let ii = 1; ii < count; ii++) {
        sinks[0].next({
          data: edge(ii),
          label: 'RelayServerHandoffTestStreamConnection_user$stream$edges',
          path: ['me', 'friends', 'edges', ii],
        });
      }
      // A `@defer` payload on the connection's record makes ConnectionHandler
      // create every edge again, with the same data.
      sinks[0].next({
        data: {emailAddresses: ['zuck@example.com'], id: '4'},
        label:
          'RelayServerHandoffTestStreamConnectionQuery$defer$connectionDeferred',
        path: ['me'],
      });
      sinks[0].complete();
      let bytes = JSON.stringify(handoff.records).length;
      let largest = 0;
      let edgeRecords = 0;
      let serverFieldRecords = 0;
      let next: ?RelayHandoffChunk = await handoff.next;
      while (next != null) {
        const size = JSON.stringify(next.records).length;
        bytes += size;
        largest = Math.max(largest, size);
        // The edges ConnectionHandler created.
        edgeRecords += Object.keys(next.records).filter(id =>
          id.includes('_connection:edges:'),
        ).length;
        serverFieldRecords += Object.keys(next.records).filter(id =>
          id.startsWith('client:4:friends('),
        ).length;
        next = await next.next;
      }
      return {bytes, edgeRecords, largest, serverFieldRecords};
    }
    const small = await stream(50);
    const large = await stream(100);
    // ConnectionHandler creates every edge again for each streamed edge and
    // for the `@defer` payload; each payload still sends only its new edge,
    // node and edge ID, and nothing of the server's field.
    expect(large.edgeRecords).toBe(99);
    expect(large.serverFieldRecords).toBe(0);
    expect(large.largest).toBeLessThan(450);
    expect(large.bytes / small.bytes).toBeLessThan(2.2);
  });

  it('appends a stream item only to the list it targets', async () => {
    const sinks: Array<Sink<GraphQLResponse>> = [];
    const environment = new Environment({
      // The nested lists' edges are named after their node, so that a
      // replaced item changes the list.
      getDataID: (value, typeName) => {
        const node = typeName === 'FriendsEdge' ? value.node : null;
        const nodeID =
          node != null && typeof node === 'object' ? node.id : null;
        return typeof nodeID === 'string' && nodeID.startsWith('f')
          ? `edge:${nodeID}`
          : value.id;
      },
      isServer: true,
      network: Network.create(() =>
        Observable.create((sink: Sink<GraphQLResponse>) => {
          sinks.push(sink);
        }),
      ),
      store: new Store(new RecordSource()),
    });
    const user = (friends: ReadonlyArray<string>) => ({
      __typename: 'User',
      friends: {
        edges: friends.map(id => ({node: {__typename: 'User', id, name: id}})),
      },
      id: 'a',
      name: 'a',
    });
    const result = serverQuery(environment, StreamTargetQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          friends: {edges: [{node: user(['f0', 'f1', 'f2'])}]},
          id: '4',
        },
      },
      extensions: {is_final: false},
    });
    const data = await result;
    const handoff = getHandoff(data.me?.client);
    // A stream item whose node is the same user, with that user's own list
    // changed in the middle and grown.
    sinks[0].next({
      data: {node: user(['f0', 'fx', 'f2', 'f3'])},
      label: 'RelayServerHandoffTestStreamTarget_user$stream$edges',
      path: ['me', 'friends', 'edges', 1],
    });
    const chunk = await handoff.next;
    const records = chunk?.records;
    if (records == null) {
      throw new Error('Expected a chunk.');
    }
    // The streamed list is sent as an append; the nested list whole, with
    // its new item.
    expect(records['client:4:friends(first:10)']?.edges).toEqual({
      __refsAppend: [expect.any(String)],
      __refsAppendFrom: 1,
    });
    expect(records['client:a:friends(first:3)']?.edges).toEqual({
      __refs: ['edge:f0', 'edge:fx', 'edge:f2', 'edge:f3'],
    });
    expect(records.fx).toEqual(expect.objectContaining({name: 'fx'}));
  });

  it('fails the request and its handoffs when projecting throws', async () => {
    const {environment, me, sinks} = await start();
    const handoff = getHandoff(me.deferred);
    const read = serverRead(environment, ServerFragment, me);
    jest.spyOn(RecordSource.prototype, 'toJSON').mockImplementation(() => {
      throw new Error('projection failed');
    });
    sinks[0].next({
      data: {emailAddresses: ['zuck@example.com'], id: '4'},
      label: 'RelayServerHandoffTestQuery$defer$deferred',
      path: ['me'],
    });
    await expect(handoff.next).rejects.toThrow('projection failed');
    // The request was cancelled: later payloads are ignored.
    expect(sinks[0].closed).toBe(true);
    await read;
  });
});
