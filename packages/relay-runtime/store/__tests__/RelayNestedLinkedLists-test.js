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

import type {ConcreteRequest} from '../../util/RelayConcreteNode';

const RelayNetwork = require('../../network/RelayNetwork');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

// Generated linked fields currently carry a plural flag, not their list depth.
function createRequest(
  concreteType: ?string,
  includeID: boolean = true,
): ConcreteRequest {
  const field = {
    alias: null,
    args: null,
    concreteType,
    kind: 'LinkedField' as const,
    name: 'entries',
    plural: true,
    selections: (includeID
      ? ['__typename', 'id', 'title']
      : ['__typename', 'title']
    ).map(name => ({
      alias: null,
      args: null,
      kind: 'ScalarField' as const,
      name,
      storageKey: null,
    })),
    storageKey: null,
  };
  return {
    fragment: {
      abstractKey: null,
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: null,
      name: 'NestedLibraryQuery',
      selections: [field],
      type: 'Query',
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name: 'NestedLibraryQuery',
      selections: [field],
    },
    params: {
      cacheID: 'nested-library-query',
      id: null,
      metadata: {},
      name: 'NestedLibraryQuery',
      operationKind: 'query',
      text: 'query NestedLibraryQuery { entries { __typename id title } }',
    },
  };
}

function createEnvironment(
  store: RelayModernStore = new RelayModernStore(new RelayRecordSource(), {
    gcReleaseBufferSize: 0,
  }),
) {
  return new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store,
  });
}

const first = {__typename: 'LibraryEntry', id: 'entry:1', title: 'Atlas'};
const second = {__typename: 'LibraryEntry', id: 'entry:2', title: 'Gazetteer'};

describe('nested linked lists', () => {
  it.each([null, 'LibraryEntry'])(
    'normalizes and reads nested entries with concreteType %s',
    concreteType => {
      const environment = createEnvironment();
      const operation = createOperationDescriptor(
        createRequest(concreteType),
        {},
      );
      const payload = {entries: [[first, null, second], null, []]};
      environment.commitPayload(operation, payload);
      const snapshot = environment.lookup(operation.fragment);
      expect(snapshot.data).toEqual(payload);
      expect(snapshot.isMissingData).toBe(false);
      expect(environment.check(operation).status).toBe('available');
    },
  );

  it('preserves additional list levels and empty lists', () => {
    const environment = createEnvironment();
    const operation = createOperationDescriptor(createRequest(null), {});
    const payload = {entries: [[[first], [], null], null, [[second]]]};
    environment.commitPayload(operation, payload);
    expect(environment.lookup(operation.fragment).data).toEqual(payload);
  });

  it('keeps reachable leaf records through garbage collection', () => {
    const store = new RelayModernStore(new RelayRecordSource(), {
      gcReleaseBufferSize: 0,
    });
    const environment = createEnvironment(store);
    const operation = createOperationDescriptor(createRequest(null), {});
    const payload = {entries: [[first], [second]]};
    const retained = environment.retain(operation);
    environment.commitPayload(operation, payload);
    store.__gc();
    expect(environment.lookup(operation.fragment).data).toEqual(payload);
    expect(environment.getStore().getSource().get(first.id)).toBeDefined();
    expect(environment.getStore().getSource().get(second.id)).toBeDefined();
    retained.dispose();
    store.__gc();
    expect(environment.getStore().getSource().get(first.id)).toBeUndefined();
  });

  it('notifies subscribers when only the grouping changes', () => {
    const environment = createEnvironment();
    const operation = createOperationDescriptor(
      createRequest('LibraryEntry'),
      {},
    );
    environment.commitPayload(operation, {entries: [[first, second], []]});
    const callback = jest.fn();
    environment.subscribe(environment.lookup(operation.fragment), callback);
    const payload = {entries: [[first], [second]]};
    environment.commitPayload(operation, payload);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].data).toEqual(payload);
  });

  it('preserves nested positions when a leaf record is deleted', () => {
    const environment = createEnvironment();
    const operation = createOperationDescriptor(createRequest(null), {});
    environment.commitPayload(operation, {entries: [[first, second]]});
    environment.commitUpdate(store => store.delete(second.id));
    expect(environment.lookup(operation.fragment).isMissingData).toBe(false);
    expect(environment.lookup(operation.fragment).data).toEqual({
      entries: [[first, null]],
    });
  });

  it('allocates stable positional IDs for leaves without server IDs', () => {
    const environment = createEnvironment();
    const descriptor = createOperationDescriptor(
      createRequest('LibraryEntry', false),
      {},
    );
    const payload = {
      entries: [
        [{__typename: 'LibraryEntry', title: 'Atlas'}],
        [{__typename: 'LibraryEntry', title: 'Gazetteer'}],
      ],
    };
    environment.commitPayload(descriptor, payload);
    const before = environment.getStore().getSource().getRecordIDs();
    expect(environment.lookup(descriptor.fragment).data).toEqual(payload);
    environment.commitPayload(descriptor, payload);
    expect(environment.getStore().getSource().getRecordIDs()).toEqual(before);
    expect(before).toContain('client:root:entries:0:0');
    expect(before).toContain('client:root:entries:1:0');
  });

  it('preserves nested shape after serializing and restoring the record source', () => {
    const environment = createEnvironment();
    const operation = createOperationDescriptor(createRequest(null), {});
    const payload = {entries: [[first], null, [], [first, second]]};
    environment.commitPayload(operation, payload);
    const json = JSON.parse(
      JSON.stringify(environment.getStore().getSource().toJSON()),
    );
    const restored = createEnvironment(
      new RelayModernStore(new RelayRecordSource(json)),
    );
    expect(restored.lookup(operation.fragment).data).toEqual(payload);
    expect(restored.check(operation).status).toBe('available');
  });
});
