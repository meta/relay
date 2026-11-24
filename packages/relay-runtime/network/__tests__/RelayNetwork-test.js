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

import type {RequestParameters} from '../../util/RelayConcreteNode';
import type {CacheConfig, Variables} from '../../util/RelayRuntimeTypes';
import type {
  GraphQLResponse,
  LogRequestInfoFunction,
  UploadableMap,
} from '../RelayNetworkTypes';

const RelayNetwork = require('../RelayNetwork');
const {disallowWarnings, expectToWarn} = require('relay-test-utils-internal');

disallowWarnings();

const PROVIDED_VARIABLE_NAME = '__relay_internal__pv__provideRequestValue';

function createRequestParameters(get: () => unknown): RequestParameters {
  return {
    cacheID: 'RelayNetworkTestQuery',
    id: null,
    metadata: {},
    name: 'RelayNetworkTestQuery',
    operationKind: 'query',
    providedVariables: {[PROVIDED_VARIABLE_NAME]: {get}},
    text: 'query RelayNetworkTestQuery { me { id } }',
  };
}

describe('RelayNetwork', () => {
  describe('provided variables', () => {
    let fetch;
    let params;

    beforeEach(() => {
      let nextValue = 0;
      const get = () => nextValue++;
      params = createRequestParameters(get);
      fetch = jest.fn(
        (
          _params: RequestParameters,
          _variables: Variables,
          _cacheConfig: CacheConfig,
          _uploadables: ?UploadableMap,
          _logRequestInfo: ?LogRequestInfoFunction,
        ): GraphQLResponse => ({data: {}}),
      );
    });

    it('reuses the value a provider returned on the first execute', () => {
      const network = RelayNetwork.create(fetch);

      network.execute(params, {}, {}).subscribe({});
      expectToWarn(
        'Relay: Expected function `get` for provider ' +
          `\`${PROVIDED_VARIABLE_NAME}\`` +
          ' to be a pure function, but got conflicting return values `1` and `0`',
        () => {
          network.execute(params, {}, {}).subscribe({});
        },
      );

      expect(fetch.mock.calls.length).toBe(2);
      expect(fetch.mock.calls[0][1]).toEqual({[PROVIDED_VARIABLE_NAME]: 0});
      expect(fetch.mock.calls[1][1]).toEqual({[PROVIDED_VARIABLE_NAME]: 0});
    });

    it('resolves providers independently for each network', () => {
      // disallowWarnings() also asserts that resolving the provider again for
      // a second network does not report it as impure
      RelayNetwork.create(fetch).execute(params, {}, {}).subscribe({});
      RelayNetwork.create(fetch).execute(params, {}, {}).subscribe({});

      expect(fetch.mock.calls.length).toBe(2);
      expect(fetch.mock.calls[0][1]).toEqual({[PROVIDED_VARIABLE_NAME]: 0});
      expect(fetch.mock.calls[1][1]).toEqual({[PROVIDED_VARIABLE_NAME]: 1});
    });
  });

  describe('polling', () => {
    it('passes the cache config metadata to the fetch function', () => {
      const fetch = jest.fn(
        (
          _params: RequestParameters,
          _variables: Variables,
          _cacheConfig: CacheConfig,
        ): GraphQLResponse => ({data: {}}),
      );
      const params = createRequestParameters(() => 0);

      const subscription = RelayNetwork.create(fetch)
        .execute(params, {}, {poll: 1000, metadata: {background: true}})
        .subscribe({});
      subscription.unsubscribe();

      expect(fetch.mock.calls.length).toBe(1);
      expect(fetch.mock.calls[0][2]).toEqual({
        force: true,
        metadata: {background: true},
      });
    });
  });
});
