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

import type {RecordSourceJSON} from 'relay-runtime/store/RelayStoreTypes';
import type {ReaderFragment} from 'relay-runtime/util/ReaderNode';
import type {ConcreteRequest} from 'relay-runtime/util/RelayConcreteNode';

// Any already-compiled query gives us a valid RequestDescriptor owner; the
// reader only reads `owner.node.operation.use_exec_time_resolvers` off it. We
// require an existing generated artifact directly so this test needs no Relay
// codegen of its own.
const OWNER_QUERY: ConcreteRequest = require('./__generated__/RelayReaderClientEdgesTest1Query.graphql');
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
// `data.me.combined_pages` (a list) with runtime checks so the test can assert
// on it without an `any` cast or a `$FlowFixMe` suppression.
function getCombinedPages(
  data: ?{readonly [key: string]: unknown},
): ReadonlyArray<unknown> | void {
  const me = data?.me;
  if (me == null || typeof me !== 'object') {
    return undefined;
  }
  const pages = me.combined_pages;
  if (!Array.isArray(pages)) {
    return undefined;
  }
  return pages;
}

function titleOf(item: unknown): unknown {
  if (item == null || typeof item !== 'object') {
    return item;
  }
  return item.title;
}

describe('RelayReader strong plural magic fragment', () => {
  // A STRONG (Node) PLURAL magic fragment (`@returnFragment`, return type
  // `[IPage]` whose sole implementor is the server Node `Page`) compiles to a
  // plural `ClientEdgeToClientObject` with `modelResolvers: {}`,
  // `serverObjectOperations: null`, and a backing resolver with NO
  // `normalizationInfo` (the EdgeTo pointer arm). The consumer's selections were
  // transplanted onto the shadowed server LIST field in the main operation
  // (normalized as N records); the resolver returns a list of `{__typename, id}`
  // pointers, and the reader reads each `Page` record in place (no refetch).
  //
  // The runtime test schema has no shadow resolver, so we hand-build the reader
  // AST mirroring the compiler artifact (fixture
  // `shadow_resolver_magic_fragment_plural`) and feed it to `read()`. The backing
  // resolver has no root fragment, so it is invoked as a plain function returning
  // the list of pointers.

  const buildStrongPluralFragment = (
    pointers: ReadonlyArray<?{
      readonly __typename: string,
      readonly id: string,
    }>,
  ): ReaderFragment => ({
    argumentDefinitions: [],
    kind: 'Fragment',
    metadata: {hasClientEdges: true},
    name: 'RelayReaderShadowResolverStrongPluralTestFragment',
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
            concreteType: null,
            modelResolvers: {},
            serverObjectOperations: null,
            backingField: {
              kind: 'RelayResolver',
              name: 'combined_pages',
              resolverModule: () => pointers,
              path: 'me.combined_pages',
            },
            linkedField: {
              alias: null,
              args: null,
              concreteType: null,
              kind: 'LinkedField',
              name: 'combined_pages',
              plural: true,
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

  // The N shadowed Page records normalized in place by the magic-fragment
  // transplant (under their own server ids).
  const baseRecords: RecordSourceJSON = {
    '1': {
      __id: '1',
      __typename: 'User',
      id: '1',
    },
    'page-1': {
      __id: 'page-1',
      __typename: 'Page',
      id: 'page-1',
      title: 'First',
    },
    'page-2': {
      __id: 'page-2',
      __typename: 'Page',
      id: 'page-2',
      title: 'Second',
    },
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
      me: {__ref: '1'},
    },
  };

  it('reads each transplanted Page record in place, index-aligned, with no refetch', () => {
    const source = RelayRecordSource.create({...baseRecords});
    const store = new RelayStore(source);
    const resolverCache = new LiveResolverCache(() => source, store);
    const selector = createReaderSelector(
      buildStrongPluralFragment([
        {__typename: 'Page', id: 'page-1'},
        {__typename: 'Page', id: 'page-2'},
      ]),
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
    const pages = getCombinedPages(data);
    expect(pages?.map(titleOf)).toEqual(['First', 'Second']);
    // Each record was read directly off its server id (no namespaced second copy).
    expect(seenRecords.has('page-1')).toBe(true);
    expect(seenRecords.has('page-2')).toBe(true);
    // Strong plural without `@waterfall` enqueues no per-item refetch.
    expect(missingClientEdges?.length ?? 0).toEqual(0);
  });

  it('reads a nullish list item through as a null edge (no throw)', () => {
    const source = RelayRecordSource.create({...baseRecords});
    const store = new RelayStore(source);
    const resolverCache = new LiveResolverCache(() => source, store);
    const selector = createReaderSelector(
      buildStrongPluralFragment([{__typename: 'Page', id: 'page-1'}, null]),
      ROOT_ID,
      {},
      ownerOperation.request,
    );
    const {data} = read(source, selector, null, resolverCache);
    const pages = getCombinedPages(data);
    // The null pointer becomes a null edge in the same slot; the present one reads.
    expect(pages?.map(titleOf)).toEqual(['First', null]);
  });
});
