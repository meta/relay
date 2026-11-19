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

import type {RelayHandoffChunk} from '../../RelayHandoff';
import type {RelayHandoffUseClientProvidersHydrationTest_user$key} from './__generated__/RelayHandoffUseClientProvidersHydrationTest_user.graphql';
import type {OperationLoader} from 'relay-runtime';
import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {EnvironmentConfig} from 'relay-runtime/store/RelayModernEnvironment';

const {installRelayHandoff} = require('../../../../rsc-client_EXPERIMENTAL');
const RelayEnvironmentProvider = require('../../../RelayEnvironmentProvider');
const useFragment = require('../../../useFragment');
const {getRelayHandoff} = require('../../RelayHandoff');
const serverQuery = require('../../serverQuery');
const {providerLoader} = require('../RelayHandoffModuleProviders');
const React = require('react');
const {act} = require('react');
const {
  Environment: RelayEnvironment,
  Network,
  Observable,
  RecordSource,
  Store,
  graphql,
} = require('relay-runtime');

const Query = graphql`
  query RelayHandoffUseClientProvidersHydrationTestQuery @server {
    me {
      ...RelayHandoffUseClientProvidersHydrationTest_user @alias(as: "card")
    }
  }
`;

const Fragment = graphql`
  fragment RelayHandoffUseClientProvidersHydrationTest_user on User {
    name
    nameRenderer @match {
      ...RelayHandoffUseClientProvidersTestPlain_name
        @module(name: "../RelayHandoffTestPlainRenderer.react")
    }
  }
`;

// OSS Flow (`builtin_lib=core-only`) has no DOM globals.
const {document} = global;
// Not a module literal: www, which these tests sync to, has no
// `react-dom/client`, and its Flow resolves literal module names.
const ReactDOMClient = jest.requireActual<{
  hydrateRoot: (
    container: unknown,
    children: React.Node,
    options: {onRecoverableError: (error: unknown) => void},
  ) => unknown,
}>(['react-dom', 'client'].join('/'));

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

component Name(user: RelayHandoffUseClientProvidersHydrationTest_user$key) {
  return useFragment(Fragment, user).name ?? '';
}

// Serves a root with provider-backed `@module` data whose name changed after
// the server rendered "Ada"; the change has arrived before the browser
// hydrates. The handoff does not send the module: its records name it by a
// provider the client fills in.
async function hydrate(operationLoader: OperationLoader) {
  const sinks: Array<Sink<GraphQLResponse>> = [];
  const server = new Environment({
    isServer: true,
    network: Network.create(() =>
      Observable.create((sink: Sink<GraphQLResponse>) => {
        sinks.push(sink);
      }),
    ),
    operationLoader: providerLoader,
    store: new Store(new RecordSource()),
  });
  const result = serverQuery(server, Query, {});
  sinks[0].next({
    data: {
      me: {
        __typename: 'User',
        id: '4',
        name: 'Ada',
        nameRenderer: {
          __typename: 'PlainUserNameRenderer',
          data: {id: 'data', text: 'Zuck'},
          plaintext: 'Zuck',
        },
      },
    },
    extensions: {is_final: false},
  });
  const card = (await result).me?.card;
  const handoff = getRelayHandoff(card);
  if (card == null || handoff == null) {
    throw new Error('Expected a handed-off reference.');
  }
  // The server rendered the name before it changed; the change arrives
  // before the browser hydrates.
  const container = document.createElement('div');
  container.innerHTML = 'Ada';
  server.commitUpdate(store => {
    store.get('4')?.setValue('Grace', 'name');
  });
  sinks[0].complete();
  await settleArrivedChunks(handoff.next, handoff);

  const client = new Environment({
    network: Network.create(() => Observable.create(() => {})),
    operationLoader,
    store: new Store(new RecordSource(), {operationLoader}),
  });
  const errors: Array<string> = [];
  await act(async () => {
    ReactDOMClient.hydrateRoot(
      container,
      <RelayEnvironmentProvider environment={client}>
        <Name user={card} />
      </RelayEnvironmentProvider>,
      {
        onRecoverableError: error => {
          errors.push(String(error));
        },
      },
    );
  });
  return {container, errors};
}

describe('hydrating a handed-off reference with provider-backed @module data', () => {
  it('renders what the server rendered when the client has the module', async () => {
    const {container, errors} = await hydrate(providerLoader);
    expect(errors).toEqual([]);
    expect(container.innerHTML).toBe('Grace');
  });

  it('applies the arrived change in the first render before the client has loaded the module', async () => {
    // Until its loader has the module, the client cannot tell whether it has
    // the module's data, so it does not hold the change back.
    const {container, errors} = await hydrate({
      get: () => null,
      load: () => new Promise(() => {}),
    });
    // React's wording differs between versions ("text" or "HTML").
    expect(errors).toEqual([
      expect.stringContaining('Hydration failed because the server rendered'),
    ]);
    expect(container.innerHTML).toBe('Grace');
  });
});
