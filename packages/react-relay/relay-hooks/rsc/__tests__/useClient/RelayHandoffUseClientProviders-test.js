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

import type {RelayHandoffUseClientProvidersTestCard_user$key} from './__generated__/RelayHandoffUseClientProvidersTestCard_user.graphql';
import type {RelayHandoffUseClientProvidersTestPlain_name$key} from './__generated__/RelayHandoffUseClientProvidersTestPlain_name.graphql';
import type {RelayHandoffUseClientProvidersTestResolver_user$key} from './__generated__/RelayHandoffUseClientProvidersTestResolver_user.graphql';
import type {RelayHandoffUseClientProvidersTestShared_user$key} from './__generated__/RelayHandoffUseClientProvidersTestShared_user.graphql';
import type {RelayHandoffUseClientProvidersTestTwoMatches_user$key} from './__generated__/RelayHandoffUseClientProvidersTestTwoMatches_user.graphql';
import type {OperationLoader} from 'relay-runtime';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {EnvironmentConfig} from 'relay-runtime/store/RelayModernEnvironment';

const {installRelayHandoff} = require('../../../../rsc-client_EXPERIMENTAL');
const useFragment = require('../../../useFragment');
const {getRelayHandoff} = require('../../RelayHandoff');
const serverQuery = require('../../serverQuery');
const {providerLoader} = require('../RelayHandoffModuleProviders');
const {flush, render} = require('../RelayHandoffTestUtils');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const {
  Environment: RelayEnvironment,
  Network,
  Observable,
  Record: RelayModernRecord,
  RecordSource,
  Store,
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

// Two branches whose distinct statements return one operation provider.
require('../RelayHandoffModuleProviders').alias(
  './RelayHandoffUseClientProvidersTestAmbiguousPlain_name$normalization.graphql',
  './RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name$normalization.graphql',
);

const Query = graphql`
  query RelayHandoffUseClientProvidersTestQuery @server {
    me {
      ...RelayHandoffUseClientProvidersTestCard_user @alias(as: "card")
      ...RelayHandoffUseClientProvidersTestShared_user @alias(as: "shared")
    }
    friend: node(id: "5") {
      ... on User {
        ...RelayHandoffUseClientProvidersTestCard_user
          @alias(as: "card")
          @defer(label: "friend")
      }
    }
  }
`;

// Two branches with their own components.
const CardFragment = graphql`
  fragment RelayHandoffUseClientProvidersTestCard_user on User {
    nameRenderer @match {
      ...RelayHandoffUseClientProvidersTestPlain_name
        @module(name: "../RelayHandoffTestPlainRenderer.react")
      ...RelayHandoffUseClientProvidersTestMarkdown_name
        @module(name: "../RelayHandoffTestMarkdownRenderer.react")
    }
  }
`;

const PlainFragment = graphql`
  fragment RelayHandoffUseClientProvidersTestPlain_name on PlainUserNameRenderer {
    plaintext
    data {
      text
    }
  }
`;

graphql`
  fragment RelayHandoffUseClientProvidersTestMarkdown_name on MarkdownUserNameRenderer {
    markdown
  }
`;

// Two branches that share one component.
const SharedFragment = graphql`
  fragment RelayHandoffUseClientProvidersTestShared_user on User {
    nameRenderer @match {
      ...RelayHandoffUseClientProvidersTestSharedPlain_name
        @module(name: "../RelayHandoffTestPlainRenderer.react")
      ...RelayHandoffUseClientProvidersTestSharedMarkdown_name
        @module(name: "../RelayHandoffTestPlainRenderer.react")
    }
  }
`;

graphql`
  fragment RelayHandoffUseClientProvidersTestSharedPlain_name on PlainUserNameRenderer {
    plaintext
  }
`;

graphql`
  fragment RelayHandoffUseClientProvidersTestSharedMarkdown_name on MarkdownUserNameRenderer {
    markdown
  }
`;

const TwoMatchesQuery = graphql`
  query RelayHandoffUseClientProvidersTestTwoMatchesQuery @server {
    me {
      ...RelayHandoffUseClientProvidersTestTwoMatches_user @alias(as: "card")
    }
  }
`;

// Two `@match` fields that spread one fragment with different components.
const TwoMatchesFragment = graphql`
  fragment RelayHandoffUseClientProvidersTestTwoMatches_user on User {
    nameRenderer
      @match(key: "RelayHandoffUseClientProvidersTestTwoMatches_user_plain") {
      ...RelayHandoffUseClientProvidersTestPlain_name
        @module(name: "../RelayHandoffTestPlainRenderer.react")
    }
    markdownRenderer: nameRenderer
      @match(
        key: "RelayHandoffUseClientProvidersTestTwoMatches_user_markdown"
      ) {
      ...RelayHandoffUseClientProvidersTestPlain_name
        @module(name: "../RelayHandoffTestMarkdownRenderer.react")
    }
  }
`;

const ResolverQuery = graphql`
  query RelayHandoffUseClientProvidersTestResolverQuery @server {
    me {
      ...RelayHandoffUseClientProvidersTestResolver_user
        @alias(as: "resolverCard")
    }
  }
`;

// Reads an ordinary Relay Resolver whose root fragment selects `@module`.
const ResolverFragment = graphql`
  fragment RelayHandoffUseClientProvidersTestResolver_user on User {
    handoffRendererProp
  }
`;

const AmbiguousQuery = graphql`
  query RelayHandoffUseClientProvidersTestAmbiguousQuery @server {
    me {
      ...RelayHandoffUseClientProvidersTestAmbiguous_user @alias(as: "card")
    }
  }
`;

graphql`
  fragment RelayHandoffUseClientProvidersTestAmbiguous_user on User {
    nameRenderer @match {
      ...RelayHandoffUseClientProvidersTestAmbiguousPlain_name
        @module(name: "../RelayHandoffTestPlainRenderer.react")
      ...RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name
        @module(name: "../RelayHandoffTestMarkdownRenderer.react")
    }
  }
`;

graphql`
  fragment RelayHandoffUseClientProvidersTestAmbiguousPlain_name on PlainUserNameRenderer {
    plaintext
  }
`;

graphql`
  fragment RelayHandoffUseClientProvidersTestAmbiguousMarkdown_name on MarkdownUserNameRenderer {
    markdown
  }
`;

const CARD = 'RelayHandoffUseClientProvidersTestCard_user';
const SHARED = 'RelayHandoffUseClientProvidersTestShared_user';
const PLAIN = 'RelayHandoffUseClientProvidersTestPlain_name';
const RENDERER = 'client:4:nameRenderer(supported:"34hjiS")';

// The generated `'use client'` modules with the providers of the client
// fragments' `@module` branches. Without a bundler, importing one gives its
// providers themselves.
const PROVIDER_MODULES: ReadonlyArray<{readonly [name: string]: unknown}> = [
  require('./__generated__/RelayHandoffUseClientProvidersTestCard_user$moduleProviders.client'),
  require('./__generated__/RelayHandoffUseClientProvidersTestShared_user$moduleProviders.client'),
  require('./__generated__/RelayHandoffUseClientProvidersTestResolver_user$moduleProviders.client'),
  require('./__generated__/RelayHandoffUseClientProvidersTestAmbiguous_user$moduleProviders.client'),
  require('./__generated__/RelayHandoffUseClientProvidersTestTwoMatches_user$moduleProviders.client'),
];
const PROVIDERS: ReadonlySet<unknown> = new Set(
  PROVIDER_MODULES.flatMap(module => Object.values(module)),
);

// A `@module` branch's providers, as its providers module exports them.
function getBranch(
  documentName: string,
  fragmentName: string,
): {
  component: unknown,
  operation: unknown,
} {
  const branch = `${documentName}$${fragmentName}`;
  const module = PROVIDER_MODULES.find(
    item => item[`component$${branch}`] != null,
  );
  if (module == null) {
    throw new Error(`Expected providers for ${branch}.`);
  }
  return {
    component: module[`component$${branch}`],
    operation: module[`operation$${branch}`],
  };
}

function getField(source: RecordSource, id: string, key: string): unknown {
  const record = source.get(id);
  if (record == null) {
    throw new Error(`Expected record ${id}.`);
  }
  return RelayModernRecord.getValue(record, key);
}

// The functions in `value` that no providers module exports.
function findFunctions(value: unknown, path: string = ''): Array<string> {
  if (typeof value === 'function') {
    return PROVIDERS.has(value) ? [] : [path];
  }
  if (value == null || typeof value !== 'object') {
    return [];
  }
  return Object.keys(value).flatMap(key =>
    findFunctions(value[key], `${path}.${key}`),
  );
}

function createServer(operationLoader: OperationLoader = providerLoader) {
  const sinks: Array<Sink<GraphQLResponse>> = [];
  const environment = new Environment({
    isServer: true,
    network: Network.create(() =>
      Observable.create((sink: Sink<GraphQLResponse>) => {
        sinks.push(sink);
      }),
    ),
    operationLoader,
    store: new Store(new RecordSource()),
  });
  return {environment, sinks};
}

const PLAIN_RENDERER = {
  __typename: 'PlainUserNameRenderer',
  data: {id: 'data', text: 'Zuck'},
  plaintext: 'Zuck',
};

async function serve(operationLoader?: OperationLoader) {
  const {environment, sinks} = createServer(operationLoader);
  const result = serverQuery(environment, Query, {});
  sinks[0].next({
    data: {
      friend: {__typename: 'User', id: '5'},
      me: {__typename: 'User', id: '4', nameRenderer: PLAIN_RENDERER},
    },
    extensions: {is_final: false},
  });
  const {friend, me} = await result;
  if (me == null || friend?.card == null) {
    throw new Error('Expected data.');
  }
  return {friendCard: friend.card, me, sink: sinks[0]};
}

function createClient(operationLoader?: OperationLoader) {
  const source = new RecordSource();
  const store = new Store(source, {gcReleaseBufferSize: 0, operationLoader});
  const environment = new Environment({
    network: Network.create(() => Observable.create(() => {})),
    operationLoader,
    store,
  });
  return {environment, source, store};
}

component Plain(name: RelayHandoffUseClientProvidersTestPlain_name$key) {
  const data = useFragment(PlainFragment, name);
  return `${data.plaintext ?? ''} ${data.data?.text ?? ''}`;
}

component Card(user: RelayHandoffUseClientProvidersTestCard_user$key) {
  const renderer = useFragment(CardFragment, user).nameRenderer;
  if (renderer == null) {
    return 'none';
  }
  return renderer.__module_component === getBranch(CARD, PLAIN).component ? (
    <Plain name={renderer} />
  ) : (
    'other'
  );
}

component Shared(user: RelayHandoffUseClientProvidersTestShared_user$key) {
  const renderer = useFragment(SharedFragment, user).nameRenderer;
  return renderer?.__module_component != null ? 'shared' : 'none';
}

describe('@module with module providers', () => {
  it('hands off branch names, and the client writes its own providers', async () => {
    const {me} = await serve();
    const card = getRelayHandoff(me.card);
    const shared = getRelayHandoff(me.shared);
    // Both fields hold the branch's providers from its providers module.
    expect(card?.records[RENDERER]).toEqual({
      __module_component_RelayHandoffUseClientProvidersTestCard_user: getBranch(
        CARD,
        PLAIN,
      ).component,
      __module_operation_RelayHandoffUseClientProvidersTestCard_user: getBranch(
        CARD,
        PLAIN,
      ).operation,
      __typename: 'PlainUserNameRenderer',
      data: {__ref: 'data'},
      plaintext: 'Zuck',
    });
    expect(
      shared?.records[RENDERER]
        .__module_component_RelayHandoffUseClientProvidersTestShared_user,
    ).toBe(
      getBranch(SHARED, 'RelayHandoffUseClientProvidersTestSharedPlain_name')
        .component,
    );
    // The records and the inline split operations hold no function but a
    // providers module's, which a bundler makes a client reference.
    expect(
      findFunctions([
        card?.records,
        card?.modules,
        card?.fragment,
        shared?.records,
        shared?.fragment,
      ]),
    ).toEqual([]);

    const client = createClient(providerLoader);
    const renderer = render(
      client.environment,
      <>
        <Card user={me.card} />
        <Shared user={me.shared} />
      </>,
    );
    expect(renderer.toJSON()).toEqual(['Zuck Zuck', 'shared']);
    const field = (key: string) => getField(client.source, RENDERER, key);
    const branch = getBranch(CARD, PLAIN);
    expect(field(`__module_component_${CARD}`)).toBe(branch.component);
    expect(field(`__module_operation_${CARD}`)).toBe(branch.operation);
    const sharedBranch = getBranch(
      SHARED,
      'RelayHandoffUseClientProvidersTestSharedPlain_name',
    );
    expect(field(`__module_component_${SHARED}`)).toBe(sharedBranch.component);
    expect(field(`__module_operation_${SHARED}`)).toBe(sharedBranch.operation);
  });

  it('hands off a document used twice, and module data in a deferred payload', async () => {
    const {friendCard, sink} = await serve();
    const friend = getRelayHandoff(friendCard);
    expect(friend?.records['5']).toEqual({__typename: 'User'});
    const client = createClient(providerLoader);
    const renderer = render(client.environment, <Card user={friendCard} />);
    expect(renderer.toJSON()).toBe('loading');
    const next = friend?.next;
    await TestRenderer.act(async () => {
      sink.next({
        data: {
          __typename: 'User',
          id: '5',
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            markdown: '**Ada**',
          },
        },
        label: 'RelayHandoffUseClientProvidersTestQuery$defer$friend',
        path: ['friend'],
      });
      sink.complete();
      await flush();
    });
    const markdown = 'RelayHandoffUseClientProvidersTestMarkdown_name';
    const renderer5 = 'client:5:nameRenderer(supported:"34hjiS")';
    expect((await next)?.records[renderer5]).toMatchObject({
      [`__module_component_${CARD}`]: getBranch(CARD, markdown).component,
      [`__module_operation_${CARD}`]: getBranch(CARD, markdown).operation,
      markdown: '**Ada**',
    });
    expect(renderer.toJSON()).toBe('other');
    expect(
      getField(client.source, renderer5, `__module_operation_${CARD}`),
    ).toBe(getBranch(CARD, markdown).operation);
  });

  it('fills in providers again when a collected root mounts again', async () => {
    const {friendCard, sink} = await serve();
    sink.next({
      data: {
        __typename: 'User',
        id: '5',
        nameRenderer: {
          __typename: 'MarkdownUserNameRenderer',
          markdown: '**Ada**',
        },
      },
      label: 'RelayHandoffUseClientProvidersTestQuery$defer$friend',
      path: ['friend'],
    });
    sink.complete();
    await TestRenderer.act(() => flush());
    const markdown = getBranch(
      CARD,
      'RelayHandoffUseClientProvidersTestMarkdown_name',
    );
    const renderer5 = 'client:5:nameRenderer(supported:"34hjiS")';
    const client = createClient(providerLoader);
    const first = render(client.environment, <Card user={friendCard} />);
    await TestRenderer.act(() => flush());
    expect(first.toJSON()).toBe('other');
    // Released with a buffer of 0, its records are collected.
    TestRenderer.act(() => first.unmount());
    await TestRenderer.act(() => flush());
    expect(client.source.has(renderer5)).toBe(false);
    // Mounted again, the root replays its chunks, the deferred one included,
    // and the client fills in its own providers again.
    const second = render(client.environment, <Card user={friendCard} />);
    await TestRenderer.act(() => flush());
    expect(second.toJSON()).toBe('other');
    const field = (key: string) => getField(client.source, renderer5, key);
    expect(field(`__module_operation_${CARD}`)).toBe(markdown.operation);
    expect(field(`__module_component_${CARD}`)).toBe(markdown.component);
  });

  it('hands off module data once the server loads its normalization', async () => {
    let loaded = false;
    let finishLoad: () => void = () => {};
    const loading = new Promise<void>(resolve => {
      finishLoad = resolve;
    });
    const {me} = await serve({
      get: reference => (loaded ? providerLoader.get(reference) : null),
      load: reference =>
        loading.then(() => {
          loaded = true;
          return providerLoader.get(reference);
        }),
    });
    const card = getRelayHandoff(me.card);
    // The providers are known before the normalization is.
    expect(card?.records[RENDERER]).toEqual({
      [`__module_component_${CARD}`]: getBranch(CARD, PLAIN).component,
      [`__module_operation_${CARD}`]: getBranch(CARD, PLAIN).operation,
      __typename: 'PlainUserNameRenderer',
    });
    finishLoad();
    expect((await card?.next)?.records[RENDERER]).toMatchObject({
      data: {__ref: 'data'},
      plaintext: 'Zuck',
    });
  });

  it('hands off @module data that a Relay Resolver root selects', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, ResolverQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          id: '4',
          resolverRenderer: {
            __typename: 'PlainUserNameRenderer',
            plaintext: 'Zuck',
          },
        },
      },
    });
    sinks[0].complete();
    const user = (await result).me?.resolverCard;
    if (user == null) {
      throw new Error('Expected a reference.');
    }
    const inline = 'RelayHandoffUseClientProvidersResolverInline_user';
    const plain = 'RelayHandoffUseClientProvidersResolverPlain_name';
    const handoff = getRelayHandoff(user);
    if (handoff == null) {
      throw new Error('Expected a handoff.');
    }
    const records = handoff.records;
    const renderer = Object.keys(records).find(id =>
      id.startsWith('client:4:nameRenderer'),
    );
    expect(renderer).not.toBe(undefined);
    expect(records[renderer ?? '']).toMatchObject({
      [`__module_component_${inline}`]: getBranch(inline, plain).component,
      [`__module_operation_${inline}`]: getBranch(inline, plain).operation,
    });
    expect(findFunctions(records)).toEqual([]);

    component ResolverCard(
      user: RelayHandoffUseClientProvidersTestResolver_user$key,
    ) {
      return useFragment(ResolverFragment, user).handoffRendererProp ?? '';
    }
    const client = createClient(providerLoader);
    expect(
      render(client.environment, <ResolverCard user={user} />).toJSON(),
    ).toBe('name');
    expect(
      getField(client.source, renderer ?? '', `__module_operation_${inline}`),
    ).toBe(getBranch(inline, plain).operation);
  });

  it('hands off the component of each @match field that spreads one fragment', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, TwoMatchesQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          id: '4',
          markdownRenderer: PLAIN_RENDERER,
          nameRenderer: PLAIN_RENDERER,
        },
      },
    });
    sinks[0].complete();
    const card = (await result).me?.card;
    if (card == null) {
      throw new Error('Expected a reference.');
    }
    const client = createClient(providerLoader);
    component Reader(
      user: RelayHandoffUseClientProvidersTestTwoMatches_user$key,
    ) {
      useFragment(TwoMatchesFragment, user);
      return 'read';
    }
    expect(render(client.environment, <Reader user={card} />).toJSON()).toBe(
      'read',
    );
    // One record holds both fields' `@module` data, each with its own
    // component.
    const renderer =
      client.source
        .getRecordIDs()
        .find(id => id.startsWith('client:4:nameRenderer')) ?? '';
    const document = 'RelayHandoffUseClientProvidersTestTwoMatches_user';
    const plain = getBranch(`${document}_plain`, PLAIN);
    const markdown = getBranch(`${document}_markdown`, PLAIN);
    expect(plain.component).not.toBe(markdown.component);
    expect(
      getField(client.source, renderer, `__module_component_${document}_plain`),
    ).toBe(plain.component);
    expect(
      getField(
        client.source,
        renderer,
        `__module_component_${document}_markdown`,
      ),
    ).toBe(markdown.component);
  });

  it('hands off branches that share an operation provider', async () => {
    const {environment, sinks} = createServer();
    const result = serverQuery(environment, AmbiguousQuery, {});
    sinks[0].next({
      data: {
        me: {
          __typename: 'User',
          id: '4',
          nameRenderer: {
            __typename: 'PlainUserNameRenderer',
            plaintext: 'Zuck',
          },
        },
      },
    });
    sinks[0].complete();
    // Aliased modules share one provider function, on the client too.
    const handoff = getRelayHandoff((await result).me?.card);
    if (handoff == null) {
      throw new Error('Expected a handoff.');
    }
    const records = handoff.records;
    const key =
      '__module_operation_RelayHandoffUseClientProvidersTestAmbiguous_user';
    expect(
      Object.keys(records)
        .map(id => records[id][key])
        .filter(value => value != null),
    ).toEqual([
      getBranch(
        'RelayHandoffUseClientProvidersTestAmbiguous_user',
        'RelayHandoffUseClientProvidersTestAmbiguousPlain_name',
      ).operation,
    ]);
  });

  it('holds garbage collection until the client has the module, for every root', async () => {
    const first = await serve();
    first.sink.complete();
    const second = await serve();
    second.sink.complete();
    await TestRenderer.act(() => flush());
    let loaded = false;
    const loads: Array<() => void> = [];
    const later: OperationLoader = {
      get: reference => (loaded ? providerLoader.get(reference) : null),
      load: reference =>
        new Promise(resolve => {
          loads.push(() => resolve(providerLoader.get(reference)));
        }),
    };
    const finishLoad = () => {
      loaded = true;
      loads.forEach(resolve => resolve());
    };
    const client = createClient(later);
    // Two roots, from two server queries, share the module's records.
    const a = render(client.environment, <Card user={first.me.card} />);
    const b = render(client.environment, <Card user={second.me.card} />);
    expect(a.toJSON()).toBe('Zuck Zuck');
    // A collection while the module loads keeps the records it selects,
    // which the Store cannot see without the module.
    client.store.scheduleGC();
    await TestRenderer.act(() => flush());
    expect(client.source.has('data')).toBe(true);
    await TestRenderer.act(async () => {
      finishLoad();
      await flush();
    });
    expect(a.toJSON()).toBe('Zuck Zuck');
    TestRenderer.act(() => a.unmount());
    await TestRenderer.act(() => flush());
    expect(client.source.has('data')).toBe(true);
    TestRenderer.act(() => b.unmount());
    await TestRenderer.act(() => flush());
    expect(client.source.has('data')).toBe(false);
  });

  it('releases the hold once a load fails, also after the root is gone', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    let failLoad: () => void = () => {};
    const failing: OperationLoader = {
      get: () => null,
      load: () =>
        new Promise((resolve, reject) => {
          failLoad = () => reject(new Error('Load failed'));
        }),
    };
    const client = createClient(failing);
    const renderer = render(client.environment, <Card user={me.card} />);
    expect(renderer.toJSON()).toBe('Zuck Zuck');
    TestRenderer.act(() => renderer.unmount());
    await TestRenderer.act(() => flush());
    expect(client.source.has('data')).toBe(true);
    await TestRenderer.act(async () => {
      failLoad();
      await flush();
    });
    expect(client.source.has('4')).toBe(false);
    expect(client.source.has('data')).toBe(false);
  });

  it('reads with a client loader that loads later, and retains once loaded', async () => {
    const {me, sink} = await serve();
    sink.complete();
    await TestRenderer.act(() => flush());
    let loaded = false;
    let finishLoad: () => void = () => {};
    const later: OperationLoader = {
      get: reference => (loaded ? providerLoader.get(reference) : null),
      load: reference =>
        new Promise(resolve => {
          finishLoad = () => {
            loaded = true;
            resolve(providerLoader.get(reference));
          };
        }),
    };
    const client = createClient(later);
    const renderer = render(client.environment, <Card user={me.card} />);
    expect(renderer.toJSON()).toBe('Zuck Zuck');
    // The module's data, including the record it links to, is retained
    // once the client's loader has the module.
    await TestRenderer.act(async () => {
      finishLoad();
      await flush();
    });
    client.store.__gc();
    expect(client.source.has('data')).toBe(true);
    expect(renderer.toJSON()).toBe('Zuck Zuck');
  });
});
