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

// `read()` returns a loosely-typed `SelectorData`. This helper walks
// `data.me.page_stats.likeCount` with runtime checks so the test can assert on
// it without an `any` cast or a `$FlowFixMe` suppression.
function getPageStatsLikeCount(
  data: ?{readonly [key: string]: unknown},
): unknown {
  const me = data?.me;
  if (me == null || typeof me !== 'object') {
    return undefined;
  }
  const pageStats = me.page_stats;
  if (pageStats == null || typeof pageStats !== 'object') {
    return pageStats;
  }
  return pageStats.likeCount;
}

describe('RelayReader shadow resolver server-value read-in-place', () => {
  // A shadow (`@returnFragment`) resolver returning a non-Node SERVER VALUE type
  // (`PageStats`) compiles to a singular `ClientEdgeToClientObject` whose backing
  // resolver carries `normalizationInfo.kind: 'ServerWeak'` (NOT 'OutputType' —
  // no `normalizationNode`). The backing resolver surfaces the shadowed record's
  // `__id` (its exact DataID). At read time the reader takes the
  // `normalizationInfo != null` inline branch: `storeID` is sourced from the
  // returned `__id` via `extractStoreIDFromResponse`, `traversalPathSegment` is
  // null (no refetch), and the consumer's `likeCount` is read off the
  // transplanted `client:<parentid>:<field>` record in place — with NO second
  // normalization (LiveResolverCache skips `ServerWeak`).
  //
  // The runtime test schema has no shadow resolver, so we hand-build the reader
  // AST mirroring the artifact shape the compiler emits (fixture
  // `shadow_resolver_magic_fragment_server_value`) and feed it to `read()`. The
  // backing resolver has no root fragment, so it is invoked as a plain function
  // returning the `{__typename, __id}` pointer.

  const TRANSPLANT_ID = 'client:1:stats';

  const buildServerWeakFragment = (pointer: {
    readonly __typename: string,
    readonly __id: string,
  }): ReaderFragment => ({
    argumentDefinitions: [],
    kind: 'Fragment',
    metadata: {hasClientEdges: true},
    name: 'RelayReaderShadowResolverServerValueInlineTestFragment',
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
            concreteType: 'PageStats',
            modelResolvers: null,
            serverObjectOperations: null,
            backingField: {
              kind: 'RelayResolver',
              name: 'page_stats',
              resolverModule: () => pointer,
              path: 'me.page_stats',
              normalizationInfo: {
                kind: 'ServerWeak',
                concreteType: 'PageStats',
                plural: false,
              },
            },
            linkedField: {
              alias: null,
              args: null,
              concreteType: 'PageStats',
              kind: 'LinkedField',
              name: 'page_stats',
              plural: false,
              selections: [
                {
                  alias: null,
                  args: null,
                  kind: 'ScalarField',
                  name: 'likeCount',
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

  it('reads the consumer selection off the transplanted `__id` record in place (no refetch, no second normalization)', () => {
    // The shadowed server value is normalized ONCE under its
    // `client:<parentid>:<field>` DataID by the magic-fragment transplant.
    const source = RelayRecordSource.create({
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
      },
      [TRANSPLANT_ID]: {
        __id: TRANSPLANT_ID,
        __typename: 'PageStats',
        likeCount: 42,
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
      buildServerWeakFragment({__typename: 'PageStats', __id: TRANSPLANT_ID}),
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
    // `likeCount` resolves to the value normalized in place under the `__id`.
    expect(getPageStatsLikeCount(data)).toEqual(42);
    // The transplanted record was read directly off its `__id` DataID.
    expect(seenRecords.has(TRANSPLANT_ID)).toBe(true);
    // There is NO second, re-normalized copy under a resolver-path id
    // (`client:PageStats:<resolverRecordID>`): LiveResolverCache must skip
    // normalization for `ServerWeak`, so no such record exists.
    expect(
      Array.from(seenRecords).some(id =>
        id.startsWith(generateClientObjectClientID('PageStats', '1')),
      ),
    ).toBe(false);
    // A `ServerWeak` inline arm pushes a null traversal segment, so a present
    // record never enqueues a waterfall.
    expect(missingClientEdges?.length ?? 0).toEqual(0);
  });

  it('fires the __DEV__ invariant when the `__id` record is absent (mis-wired/empty store)', () => {
    // The store has NO record at the `__id` the resolver surfaced. In production
    // this would silently read an empty record (the prod-silent miscompile this
    // guard supersedes); in dev the read-in-place invariant must fire loudly.
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
    const store = new RelayStore(source);
    const resolverCache = new LiveResolverCache(() => source, store);
    const selector = createReaderSelector(
      buildServerWeakFragment({
        __typename: 'PageStats',
        __id: 'client:1:stats-missing',
      }),
      ROOT_ID,
      {},
      ownerOperation.request,
    );
    expect(() => read(source, selector, null, resolverCache)).toThrow(
      /Expected the in-place shadow record .* to exist in the store/,
    );
  });
});
