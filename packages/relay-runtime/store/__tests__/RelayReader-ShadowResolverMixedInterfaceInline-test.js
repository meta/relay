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

// `read()` returns a loosely-typed `SelectorData`. These helpers walk into
// `data.me.thing.<field>` with runtime checks so the test can assert without an
// `any` cast or a `$FlowFixMe` suppression.
function getThing(
  data: ?{readonly [key: string]: unknown},
): ?{readonly [key: string]: unknown} {
  const me = data?.me;
  if (me == null || typeof me !== 'object') {
    return undefined;
  }
  const thing = me.thing;
  if (thing == null || typeof thing !== 'object') {
    return undefined;
  }
  return thing;
}

describe('RelayReader shadow resolver mixed weak+value interface (read-in-place dispatch)', () => {
  // A shadow (`@returnFragment`) resolver whose return INTERFACE has BOTH an
  // `@weak` model implementor (`WeakThing`) AND a non-Node server VALUE
  // implementor (`PageStats`). The compiler emits a first-class
  // `normalizationInfo.kind: 'AbstractInline'` carrying a per-`__typename`
  // `inlineKinds` map. At runtime LiveResolverCache/RelayReader dispatch per
  // concrete `__typename`:
  //  * `PageStats` (`inlineKinds.PageStats === 'ServerWeak'`) -> read IN PLACE off
  //    the transplanted `__id`; NO second normalization (no resolver-path record).
  //  * `WeakThing` (`inlineKinds.WeakThing === 'WeakModel'`) -> normalize via
  //    `__relay_model_instance`.
  //
  // The runtime test schema has no shadow resolver, so we hand-build the reader
  // AST mirroring the artifact shape the compiler emits for the fixture
  // `shadow_resolver_magic_fragment_weak_value_interface`.

  const TRANSPLANT_ID = 'client:1:stats';

  const buildMixedFragment = (
    pointer:
      | {readonly __typename: 'PageStats', readonly __id: string}
      | {
          readonly __typename: 'WeakThing',
          readonly __relay_model_instance: unknown,
        },
  ): ReaderFragment => ({
    argumentDefinitions: [],
    kind: 'Fragment',
    metadata: {hasClientEdges: true},
    name: 'RelayReaderShadowResolverMixedInterfaceInlineTestFragment',
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
              name: 'thing',
              resolverModule: () => pointer,
              path: 'me.thing',
              normalizationInfo: {
                kind: 'AbstractInline',
                concreteType: null,
                plural: false,
                inlineKinds: {PageStats: 'ServerWeak', WeakThing: 'WeakModel'},
              },
            },
            linkedField: {
              alias: null,
              args: null,
              concreteType: null,
              kind: 'LinkedField',
              name: 'thing',
              plural: false,
              selections: [
                {
                  kind: 'InlineFragment',
                  type: 'PageStats',
                  abstractKey: null,
                  selections: [
                    {
                      alias: null,
                      args: null,
                      kind: 'ScalarField',
                      name: 'label',
                      storageKey: null,
                    },
                  ],
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

  it('reads the VALUE arm (ServerWeak member of inlineKinds) in place off the transplanted `__id` with no second normalization', () => {
    const source = RelayRecordSource.create({
      '1': {
        __id: '1',
        __typename: 'User',
        id: '1',
      },
      [TRANSPLANT_ID]: {
        __id: TRANSPLANT_ID,
        __typename: 'PageStats',
        label: 'in place',
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
      buildMixedFragment({__typename: 'PageStats', __id: TRANSPLANT_ID}),
      ROOT_ID,
      {},
      ownerOperation.request,
    );
    const {data, seenRecords} = read(source, selector, null, resolverCache);
    const thing = getThing(data);
    expect(thing?.label).toEqual('in place');
    // The transplanted record was read directly off its `__id` DataID.
    expect(seenRecords.has(TRANSPLANT_ID)).toBe(true);
    // There is NO second, re-normalized copy under a resolver-path id
    // (`client:PageStats:<resolverRecordID>`): the VALUE arm of a mixed
    // interface must skip normalization (dispatched to ServerWeak).
    expect(
      Array.from(seenRecords).some(id =>
        id.startsWith(generateClientObjectClientID('PageStats', '1')),
      ),
    ).toBe(false);
  });

  it('normalizes the WEAK arm (WeakModel member of inlineKinds) via __relay_model_instance', () => {
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
      buildMixedFragment({
        __typename: 'WeakThing',
        __relay_model_instance: {label: 'weak'},
      }),
      ROOT_ID,
      {},
      ownerOperation.request,
    );
    read(source, selector, null, resolverCache);
    // The WEAK arm's `inlineKinds` entry is 'WeakModel', so LiveResolverCache
    // NORMALIZES the model-instance value into a new
    // `client:WeakThing:<resolverRecordID>` record in the store — unlike the
    // in-place VALUE arm above, which skips normalization entirely. (The reader's
    // `seenRecords` never includes it because the hand-built linkedField has no
    // WeakThing consumer arm, so we assert on the source.)
    expect(
      source.getRecordIDs().some(id => id.startsWith('client:WeakThing:')),
    ).toBe(true);
  });
});
