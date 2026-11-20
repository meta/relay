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

import type {GraphQLResponse} from 'relay-runtime';

const {getQueryResourceForEnvironment} = require('../QueryResource');
const gqlQuery = require('./__generated__/QueryResourceTest2Query.graphql');
const {Observable, createOperationDescriptor} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils-internal');

describe('QueryResource cache entry disposal', () => {
  let resource;
  let operation;

  beforeEach(() => {
    const environment = createMockEnvironment();
    resource = getQueryResourceForEnvironment(environment);
    operation = createOperationDescriptor(gqlQuery, {id: 'target'});
  });

  it('does not delete a replacement when an evicted retained entry releases', () => {
    const observable = Observable.create<GraphQLResponse>(() => {});
    const firstResult = resource.prepare(
      operation,
      observable,
      'store-only',
      'full',
    );
    const firstRetain = resource.retain(firstResult);

    // Keep the real 1000-entry cache capacity; an LRU eviction does not release
    // the first component's independent retain.
    for (let index = 0; index < 1000; index++) {
      resource.prepare(
        operation,
        observable,
        'store-only',
        'full',
        null,
        'other-' + index,
      );
    }
    const replacementResult = resource.prepare(
      operation,
      observable,
      'store-only',
      'full',
    );
    const replacementRetain = resource.retain(replacementResult);
    const replacement = resource.TESTS_ONLY__getCacheEntry(
      operation,
      'store-only',
      'full',
    );

    firstRetain.dispose();
    expect(
      resource.TESTS_ONLY__getCacheEntry(operation, 'store-only', 'full'),
    ).toBe(replacement);
    replacementRetain.dispose();
    expect(
      resource.TESTS_ONLY__getCacheEntry(operation, 'store-only', 'full'),
    ).toBeUndefined();
  });
});
