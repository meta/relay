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

import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';

const {getRelayHandoff} = require('../RelayHandoff');
const {startServerExecution} = require('../RelayServerExecution');
const serverQuery = require('../serverQuery');
const {readServerFragment} = require('../useServerFragment');
const ModuleQuery = require('./__generated__/RelayServerHandoffTestModuleQuery.graphql');
const Plain = require('./__generated__/RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql');
const Deferred = require('./__generated__/serverQueryTestDeferred_user.graphql');
const Query = require('./__generated__/serverQueryTestQuery.graphql');
const {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  createOperationDescriptor,
} = require('relay-runtime');
const {
  fetchQuery,
  getObservableForActiveRequest,
  getPromiseForActiveRequest,
} = require('relay-runtime/query/fetchQueryInternal');

const MODULE_REF =
  'RelayServerHandoffTestPlainUserNameRenderer_name$normalization.graphql';
const MODULE_DATA = {
  me: {
    __typename: 'User',
    id: '4',
    nameRenderer: {
      __module_component_RelayServerHandoffTestModule_user:
        'PlainUserNameRenderer.react',
      __module_operation_RelayServerHandoffTestModule_user: MODULE_REF,
      __typename: 'PlainUserNameRenderer',
      data: {id: 'data', text: 'Zuck'},
      plaintext: 'Zuck',
    },
  },
};

async function flush(): Promise<void> {
  for (let ii = 0; ii < 20; ii++) {
    await Promise.resolve();
  }
}

function network() {
  const sinks: Array<Sink<GraphQLResponse>> = [];
  let disposals = 0;
  return {
    sinks,
    disposals: () => disposals,
    network: Network.create(() =>
      Observable.create((sink: Sink<GraphQLResponse>) => {
        sinks.push(sink);
        return () => {
          disposals++;
        };
      }),
    ),
  };
}

function pendingModule() {
  let resolveLoad = () => {};
  let rejectLoad = (_error: Error) => {};
  let loaded = false;
  const promise = new Promise<typeof Plain>((resolve, reject) => {
    resolveLoad = () => {
      loaded = true;
      resolve(Plain);
    };
    rejectLoad = reject;
  });
  const transport = network();
  const environment = new Environment({
    isServer: true,
    network: transport.network,
    operationLoader: {get: () => (loaded ? Plain : null), load: () => promise},
    store: new Store(new RecordSource()),
  });
  return {...transport, environment, resolveLoad, rejectLoad};
}

function handoff(ref: unknown) {
  const result = getRelayHandoff(ref);
  if (result == null) {
    throw new Error('Expected handoff');
  }
  return result;
}

function abortController() {
  let listeners: Array<() => void> = [];
  return {
    signal: {
      aborted: false,
      addEventListener(
        _type: 'abort',
        listener: () => void,
        _options: {once: boolean},
      ) {
        listeners.push(listener);
      },
      removeEventListener(_type: 'abort', listener: () => void) {
        listeners = listeners.filter(item => item !== listener);
      },
    },
    abort() {
      listeners.forEach(listener => listener());
    },
  };
}

describe('serverQuery ends with the request', () => {
  it('cancels the request when a payload delivered while subscribing fails it', async () => {
    let disposals = 0;
    const environment = new Environment({
      isServer: true,
      network: Network.create(() =>
        Observable.create((sink: Sink<GraphQLResponse>) => {
          sink.next({data: {me: {__typename: 'User', id: '4', name: 'Zuck'}}});
          return () => {
            disposals++;
          };
        }),
      ),
      store: new Store(new RecordSource()),
    });
    const operation = createOperationDescriptor(Query, {});
    const ends: Array<?string> = [];
    const {first} = startServerExecution(environment, operation, null, {
      caller: 'test',
      dedupe: false,
      execute: () => environment.execute({operation}),
      onEnd: error => {
        ends.push(error?.message);
      },
      onPayload: () => {
        throw new Error('The payload failed.');
      },
    });
    const failure = first.then(
      () => null,
      (error: Error) => error.message,
    );
    expect(disposals).toBe(1);
    expect(ends).toEqual(['The payload failed.']);
    expect(await failure).toBe('The payload failed.');
  });

  it('in plain Relay, a final payload ends the active request before the network completes', async () => {
    const transport = network();
    const environment = new Environment({
      isServer: true,
      network: transport.network,
      store: new Store(new RecordSource()),
    });
    const operation = createOperationDescriptor(Query, {});
    let completed = false;
    const subscription = fetchQuery(environment, operation).subscribe({
      complete: () => {
        completed = true;
      },
    });
    transport.sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: false},
    });
    const activePromise = getPromiseForActiveRequest(
      environment,
      operation.request,
    );
    let activeComplete = false;
    getObservableForActiveRequest(environment, operation.request)?.subscribe({
      complete: () => {
        activeComplete = true;
      },
    });
    transport.sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: true},
    });
    await activePromise;
    expect(activeComplete).toBe(true);
    expect(environment.isRequestActive(operation.request.identifier)).toBe(
      false,
    );
    expect(completed).toBe(false);
    expect(transport.disposals()).toBe(0);
    transport.sinks[0].complete();
    expect(completed).toBe(true);
    expect(transport.disposals()).toBe(1);
    subscription.unsubscribe();
  });

  it('rejects a read of data that a final payload without network EOF did not deliver', async () => {
    const transport = network();
    const environment = new Environment({
      isServer: true,
      network: transport.network,
      store: new Store(new RecordSource()),
    });
    const result = serverQuery(environment, Query, {});
    transport.sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: false},
    });
    const data = await result;
    if (data.me == null) {
      throw new Error('Expected me');
    }
    const thenable = readServerFragment(environment, Deferred, data.me);
    const read = new Promise((resolve, reject) =>
      thenable.then(resolve, reject),
    );
    let settled = false;
    read.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await flush();
    expect(settled).toBe(false);
    transport.sinks[0].next({
      data: {me: {__typename: 'User', id: '4', name: 'Zuck'}},
      extensions: {is_final: true},
    });
    await expect(read).rejects.toThrow('completed without the data');
    transport.sinks[0].complete();
  });

  for (const endBeforeLoad of [false, true]) {
    it(`delivers @module data that loads after a final payload (network ends ${endBeforeLoad ? 'before' : 'after'} the load)`, async () => {
      const server = pendingModule();
      const result = serverQuery(server.environment, ModuleQuery, {});
      server.sinks[0].next({data: MODULE_DATA, extensions: {is_final: true}});
      const root = handoff((await result).me?.client);
      if (endBeforeLoad) {
        server.sinks[0].complete();
      }
      server.resolveLoad();
      const chunk = await root.next;
      expect(Object.values(chunk?.records ?? {})).toContainEqual(
        expect.objectContaining({plaintext: 'Zuck'}),
      );
      expect(chunk?.modules?.[MODULE_REF]).toBe(Plain);
      if (!endBeforeLoad) {
        server.sinks[0].complete();
      }
      expect(await chunk?.next).toBe(null);
      expect(server.disposals()).toBe(1);
    });
  }

  it('keeps the request open after a final payload until the network ends', async () => {
    const server = pendingModule();
    const result = serverQuery(server.environment, ModuleQuery, {});
    server.sinks[0].next({data: MODULE_DATA, extensions: {is_final: true}});
    const root = handoff((await result).me?.client);
    server.resolveLoad();
    const chunk = await root.next;
    expect(Object.values(chunk?.records ?? {})).toContainEqual(
      expect.objectContaining({plaintext: 'Zuck'}),
    );
    let terminal = false;
    chunk?.next.then(
      () => {
        terminal = true;
      },
      () => {
        terminal = true;
      },
    );
    await flush();
    expect(terminal).toBe(false);
    expect(server.disposals()).toBe(0);
    server.sinks[0].error(new Error('late network failure'));
    // The root's data was all delivered, so a late failure ends it normally.
    expect(await chunk?.next).toBe(null);
    expect(server.disposals()).toBe(1);
  });

  it('fails the request and cancels it once when a module load rejects after a final payload', async () => {
    const server = pendingModule();
    const result = serverQuery(server.environment, ModuleQuery, {});
    server.sinks[0].next({data: MODULE_DATA, extensions: {is_final: true}});
    const root = handoff((await result).me?.client);
    server.rejectLoad(new Error('loader rejected'));
    await expect(root.next).rejects.toThrow('loader rejected');
    expect(server.disposals()).toBe(1);
  });

  it('rejects the roots and cancels once on abort while a module loads after a final payload', async () => {
    const server = pendingModule();
    const controller = abortController();
    const result = serverQuery(
      server.environment,
      ModuleQuery,
      {},
      {signal: controller.signal},
    );
    server.sinks[0].next({data: MODULE_DATA, extensions: {is_final: true}});
    const root = handoff((await result).me?.client);
    controller.abort();
    await expect(root.next).rejects.toThrow('cancelled');
    server.resolveLoad();
    await flush();
    expect(server.disposals()).toBe(1);
  });

  it('waits for a module an earlier payload is loading when a final payload has no data', async () => {
    const server = pendingModule();
    const result = serverQuery(server.environment, ModuleQuery, {});
    server.sinks[0].next({data: MODULE_DATA, extensions: {is_final: false}});
    const root = handoff((await result).me?.client);
    let terminal = false;
    root.next.then(
      () => {
        terminal = true;
      },
      () => {
        terminal = true;
      },
    );
    server.sinks[0].next({data: null, extensions: {is_final: true}});
    await flush();
    expect(terminal).toBe(false);
    server.resolveLoad();
    const chunk = await root.next;
    expect(Object.values(chunk?.records ?? {})).toContainEqual(
      expect.objectContaining({plaintext: 'Zuck'}),
    );
    server.sinks[0].complete();
    expect(await chunk?.next).toBe(null);
    expect(server.disposals()).toBe(1);
  });
});
