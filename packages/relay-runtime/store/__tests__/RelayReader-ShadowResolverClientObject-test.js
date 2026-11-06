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

import type {ReaderFragment} from 'relay-runtime/util/ReaderNode';
import type {ConcreteRequest} from 'relay-runtime/util/RelayConcreteNode';

// Any already-compiled query gives us a valid RequestDescriptor owner; the
// reader only reads `owner.node.operation.use_exec_time_resolvers` off it. We
// require an existing generated artifact directly so this test needs no Relay
// codegen of its own.
const OWNER_QUERY: ConcreteRequest = require('./__generated__/RelayReaderClientEdgesTest1Query.graphql');
const {generateClientObjectClientID} = require('relay-runtime/store/ClientID');
const {
  LiveResolverCache,
} = require('relay-runtime/store/live-resolvers/LiveResolverCache');
const {
  createOperationDescriptor,
} = require('relay-runtime/store/RelayModernOperationDescriptor');
const RelayModernRecord = require('relay-runtime/store/RelayModernRecord');
const {
  createReaderSelector,
} = require('relay-runtime/store/RelayModernSelector');
const RelayStore = require('relay-runtime/store/RelayModernStore');
const {read} = require('relay-runtime/store/RelayReader');
const RelayRecordSource = require('relay-runtime/store/RelayRecordSource');
const {ROOT_ID} = require('relay-runtime/store/RelayStoreUtils');
const {
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowConsoleErrors();
disallowWarnings();
// `read()` returns a loosely-typed `SelectorData` (an index map of `unknown`).
// This helper walks `data.me.combined_page.title` with runtime checks so the
// test can assert on it without an `any` cast or a `$FlowFixMe` suppression.
function getCombinedPageTitle(
  data: ?{readonly [key: string]: unknown},
): unknown {
  const me = data?.me;
  if (me == null || typeof me !== 'object') {
    return undefined;
  }
  const combinedPage = me.combined_page;
  if (combinedPage == null || typeof combinedPage !== 'object') {
    return combinedPage;
  }
  return combinedPage.title;
}

describe('RelayReader shadow resolver via ClientObject (unified path)', () => {
  // In the unified shadow-resolver design there is NO `isStoreRefEdge`. A shadow
  // resolver compiles to a plain singular `ClientEdgeToClientObject` whose
  // backing resolver returns a pointer `{__typename, id}`. At read time the
  // reader dispatches on whether that returned `__typename` has an entry in
  // `modelResolvers`:
  //
  //   * SERVER type (NOT in `modelResolvers`): `storeID = id` (the raw,
  //     un-namespaced server DataID). The consumer's selections are read
  //     directly off the record already normalized into the main store under
  //     that id by the transplanted server selections -- no fetch.
  //
  //   * CLIENT model type (IS in `modelResolvers`): the id is namespaced via
  //     `ensureClientRecord(id, __typename)` and the value is produced by that
  //     client type's model resolver; the consumer's selections are read off
  //     the namespaced client record.
  //
  // The runtime test schema has no shadow resolver, so we hand-build the reader
  // AST for the ClientObject edge (mirroring the artifact shape the compiler
  // emits, e.g. fixture `shadow_resolver_magic_fragment_mixed_interface`) and
  // feed it to `read()` directly. The backing resolver has no root fragment, so
  // it is invoked as a plain function returning the pointer.

  // The CLIENT model type under test. Its model resolver returns a non-null
  // sentinel so the edge resolves; the actual consumer selections are then read
  // off the namespaced client record.
  const CLIENT_MODEL_TYPE = 'ClientPage';

  const clientPageModelResolver = {
    kind: 'RelayResolver' as 'RelayResolver',
    name: '__relay_model_instance',
    resolverModule: () => ({__relay_model_instance: {}}),
    path: 'me.combined_page.__relay_model_instance',
  };

  // Builds a ClientObject shadow edge whose backing resolver returns the given
  // pointer. `modelResolvers` always contains the client model type, so a
  // returned server `__typename` falls through to the raw-store-record branch
  // while the client `__typename` routes through the model resolver.
  const buildShadowEdgeFragment = (
    pointer: {
      readonly __typename: string,
      readonly id: string,
    },
    serverObjectOperations: {[key: string]: ConcreteRequest} | null = null,
  ): ReaderFragment => ({
    argumentDefinitions: [],
    kind: 'Fragment',
    metadata: {hasClientEdges: true},
    name: 'RelayReaderShadowResolverClientObjectTestFragment',
    selections: [
      {
        alias: null,
        args: null,
        concreteType: 'User',
        kind: 'LinkedField',
        name: 'me',
        plural: false,
        selections: [
          {
            kind: 'ClientEdgeToClientObject',
            // Abstract return type: concrete type comes from the resolver's
            // returned `__typename`, exactly as in the mixed-interface fixture.
            concreteType: null,
            modelResolvers: {
              ClientPage: clientPageModelResolver,
            },
            serverObjectOperations,
            backingField: {
              kind: 'RelayResolver',
              name: 'combined_page',
              resolverModule: () => pointer,
              path: 'me.combined_page',
            },
            linkedField: {
              alias: null,
              args: null,
              concreteType: null,
              kind: 'LinkedField',
              name: 'combined_page',
              plural: false,
              selections: [
                {
                  alias: null,
                  args: null,
                  kind: 'ScalarField',
                  name: 'title',
                  storageKey: null,
                },
              ],
              storageKey: null,
            },
          },
        ],
        storageKey: null,
      },
    ],
    type: 'Query',
    abstractKey: null,
  });

  const ownerOperation = createOperationDescriptor(OWNER_QUERY, {});

  it('reads a SERVER-type pointer off the raw normalized store record (no namespacing, no fetch)', () => {
    // The shadow resolver returns a pointer to a SERVER `Page` record. Because
    // `Page` is NOT in `modelResolvers`, the reader uses the raw id `100`
    // directly -- it reads the consumer selection (`title`) off the record the
    // transplant already normalized under `100`.
    const source = RelayRecordSource.create({
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
      },
      // The pointed-to server record, normalized under its RAW server DataID.
      '100': {
        __id: '100',
        __typename: 'Page',
        id: '100',
        title: 'Server Page Title',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
    });
    const store = new RelayStore(source);
    const resolverCache = new LiveResolverCache(() => source, store);
    const selector = createReaderSelector(
      buildShadowEdgeFragment({__typename: 'Page', id: '100'}),
      ROOT_ID,
      {},
      ownerOperation.request,
    );
    const {data, seenRecords, missingClientEdges} = read(
      source,
      selector,
      null,
      resolverCache,
    );
    // `title` resolves to the value normalized under the raw server id `100`.
    expect(getCombinedPageTitle(data)).toEqual('Server Page Title');
    // The raw server record `100` was read directly.
    expect(seenRecords.has('100')).toBe(true);
    // There is NO namespaced `client:Page:100` record: the server arm does not
    // go through `ensureClientRecord`.
    expect(
      Array.from(seenRecords).some(id =>
        id.startsWith(generateClientObjectClientID('Page', '100')),
      ),
    ).toBe(false);
    // A server-arm ClientObject edge with no `serverObjectOperations` pushes a
    // null traversal segment, so a present record never enqueues a waterfall.
    expect(missingClientEdges?.length ?? 0).toEqual(0);
  });

  it('reads a CLIENT model-type pointer through the model resolver and the namespaced client record', () => {
    // The shadow resolver returns a pointer to a CLIENT `ClientPage` record.
    // Because `ClientPage` IS in `modelResolvers`, the reader namespaces the id
    // via `ensureClientRecord('99', 'ClientPage')`, evaluates the model
    // resolver, and reads the consumer selection (`title`) off the namespaced
    // client record.
    const namespacedId = generateClientObjectClientID(CLIENT_MODEL_TYPE, '99');
    const source = RelayRecordSource.create({
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
    });
    // The client model record lives under the NAMESPACED client DataID. Build
    // it as a real Record and set it separately: the id is computed, so it
    // cannot be a literal key alongside the explicit keys above without tripping
    // Flow's invalid-computed-prop.
    const clientRecord = RelayModernRecord.create(
      namespacedId,
      CLIENT_MODEL_TYPE,
    );
    RelayModernRecord.setValue(clientRecord, 'id', '99');
    RelayModernRecord.setValue(clientRecord, 'title', 'Client Page Title');
    source.set(namespacedId, clientRecord);
    const store = new RelayStore(source);
    const resolverCache = new LiveResolverCache(() => source, store);
    const selector = createReaderSelector(
      buildShadowEdgeFragment({__typename: CLIENT_MODEL_TYPE, id: '99'}),
      ROOT_ID,
      {},
      ownerOperation.request,
    );
    const {data, seenRecords, missingClientEdges} = read(
      source,
      selector,
      null,
      resolverCache,
    );
    // `title` resolves to the value stored on the NAMESPACED client record.
    expect(getCombinedPageTitle(data)).toEqual('Client Page Title');
    // The selections were read off the namespaced client record, NOT the raw
    // id `99`.
    expect(seenRecords.has(namespacedId)).toBe(true);
    expect(seenRecords.has('99')).toBe(false);
    // The model-resolver arm also pushes a null traversal segment: a resolved
    // client model never enqueues a waterfall.
    expect(missingClientEdges?.length ?? 0).toEqual(0);
  });

  it('reads a PURE-SERVER edge (empty modelResolvers map) off the raw record (no namespacing, no fetch)', () => {
    // A pure-server shadow edge -- an interface implemented ONLY by a server
    // type, with no client implementor -- compiles to an abstract
    // `ClientEdgeToClientObject` (`concreteType: null`) carrying an EMPTY but
    // NON-NULL `modelResolvers: {}` map (the shape the codegen fix produces).
    // The empty map sends the read down the `modelResolvers != null` dispatch:
    // the returned server `__typename` is absent from the empty map, so
    // `storeID = id` (raw) and the consumer selection is read off the record the
    // transplant normalized under that raw id. This is the regression case --
    // before the fix the map was `null`, which mis-routed to `ensureClientRecord`
    // and read an empty namespaced record.
    const fragment: ReaderFragment = {
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: {hasClientEdges: true},
      name: 'RelayReaderShadowResolverClientObjectTestFragment',
      selections: [
        {
          alias: null,
          args: null,
          concreteType: 'User',
          kind: 'LinkedField',
          name: 'me',
          plural: false,
          selections: [
            {
              kind: 'ClientEdgeToClientObject',
              // Abstract return type: concrete type comes from the resolver's
              // returned `__typename`.
              concreteType: null,
              // EMPTY but non-null: a pure-server interface has no client
              // implementor, so the dispatch map carries no entries.
              modelResolvers: {},
              serverObjectOperations: null,
              backingField: {
                kind: 'RelayResolver',
                name: 'combined_page',
                resolverModule: () => ({__typename: 'Page', id: '100'}),
                path: 'me.combined_page',
              },
              linkedField: {
                alias: null,
                args: null,
                concreteType: null,
                kind: 'LinkedField',
                name: 'combined_page',
                plural: false,
                selections: [
                  {
                    alias: null,
                    args: null,
                    kind: 'ScalarField',
                    name: 'title',
                    storageKey: null,
                  },
                ],
                storageKey: null,
              },
            },
          ],
          storageKey: null,
        },
      ],
      type: 'Query',
      abstractKey: null,
    };
    const source = RelayRecordSource.create({
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
      },
      // The pointed-to server record, normalized under its RAW server DataID.
      '100': {
        __id: '100',
        __typename: 'Page',
        id: '100',
        title: 'Server Page Title',
      },
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
    });
    const store = new RelayStore(source);
    const resolverCache = new LiveResolverCache(() => source, store);
    const selector = createReaderSelector(
      fragment,
      ROOT_ID,
      {},
      ownerOperation.request,
    );
    const {data, seenRecords, missingClientEdges} = read(
      source,
      selector,
      null,
      resolverCache,
    );
    // `title` resolves to the value normalized under the raw server id `100`.
    expect(getCombinedPageTitle(data)).toEqual('Server Page Title');
    // The raw server record `100` was read directly.
    expect(seenRecords.has('100')).toBe(true);
    // There is NO namespaced `client:Page:100` record: an empty `modelResolvers`
    // map keeps the server pointer on the raw store id.
    expect(
      Array.from(seenRecords).some(id =>
        id.startsWith(generateClientObjectClientID('Page', '100')),
      ),
    ).toBe(false);
    // No `serverObjectOperations`, present record -> null traversal segment, so
    // nothing is enqueued for a waterfall.
    expect(missingClientEdges?.length ?? 0).toEqual(0);
  });

  // `@waterfall` on a shadow server arm keeps BOTH the main-operation transplant
  // AND a generated `ClientEdgeQuery` refetch backstop (`serverObjectOperations`
  // populated). The two are complementary, not mutually exclusive: the transplant
  // serves the COMMON case (the resolver's pointer targets the same record the
  // shadowed field already normalized) entirely from the store, while the backstop
  // refetches only the DRAFT case (the pointer targets a DIFFERENT server object
  // absent from the store). The reader selects between them per read -- a present
  // record never enqueues a waterfall even though the backstop exists; a missing
  // one does. These two tests guard the runtime half of removing the transplant
  // skip-guard under `@waterfall`.
  describe('@waterfall server arm: transplant + ClientEdgeQuery backstop', () => {
    // Any ConcreteRequest serves as the refetch operation reference; the reader
    // only stashes it on the traversal path and surfaces it in
    // `missingClientEdges` when (and only when) the pointed-to record's
    // selections are missing.
    const REFETCH_OPERATION = OWNER_QUERY;

    it('serves the COMMON case from the store with no waterfall when the pointer targets the transplanted record', () => {
      // The resolver returns a pointer to server `Page` `100` -- the same record
      // the transplant already normalized `title` onto. Even though the
      // `@waterfall` backstop is present, the in-store read satisfies `title`, so
      // NO refetch is enqueued.
      const source = RelayRecordSource.create({
        '1': {__id: '1', __typename: 'User', id: '1'},
        '100': {
          __id: '100',
          __typename: 'Page',
          id: '100',
          title: 'Server Page Title',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          me: {__ref: '1'},
        },
      });
      const store = new RelayStore(source);
      const resolverCache = new LiveResolverCache(() => source, store);
      const selector = createReaderSelector(
        buildShadowEdgeFragment(
          {__typename: 'Page', id: '100'},
          {Page: REFETCH_OPERATION},
        ),
        ROOT_ID,
        {},
        ownerOperation.request,
      );
      const {data, missingClientEdges} = read(
        source,
        selector,
        null,
        resolverCache,
      );
      expect(getCombinedPageTitle(data)).toEqual('Server Page Title');
      // The transplant populated the common case, so the backstop never fires.
      expect(missingClientEdges?.length ?? 0).toEqual(0);
    });

    it('fires the ClientEdgeQuery backstop for the DRAFT case when the pointer targets a different, absent server object', () => {
      // The resolver returns a pointer to server `Page` `200` -- a DIFFERENT
      // record than the transplant populated (`100`). `200` is absent from the
      // store, so the read enqueues a single missing client edge carrying the
      // backstop refetch operation, keyed by the pointed-to id.
      const source = RelayRecordSource.create({
        '1': {__id: '1', __typename: 'User', id: '1'},
        // Only the transplanted record `100` is present; the resolver points
        // elsewhere (`200`), which the store does not have.
        '100': {
          __id: '100',
          __typename: 'Page',
          id: '100',
          title: 'Server Page Title',
        },
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          me: {__ref: '1'},
        },
      });
      const store = new RelayStore(source);
      const resolverCache = new LiveResolverCache(() => source, store);
      const selector = createReaderSelector(
        buildShadowEdgeFragment(
          {__typename: 'Page', id: '200'},
          {Page: REFETCH_OPERATION},
        ),
        ROOT_ID,
        {},
        ownerOperation.request,
      );
      const {missingClientEdges} = read(source, selector, null, resolverCache);
      // Exactly one waterfall is enqueued, targeting the pointed-to record and
      // carrying the generated backstop operation.
      expect(missingClientEdges?.length ?? 0).toEqual(1);
      expect(missingClientEdges?.[0]?.clientEdgeDestinationID).toEqual('200');
      expect(missingClientEdges?.[0]?.request).toBe(REFETCH_OPERATION);
    });
  });
});
