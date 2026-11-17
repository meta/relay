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

// Runs stableCopy-test with ENABLE_PERF_QUERY on.
// RelayFeatureFlags is mocked so that every copy of it has the flag on, also
// after jest.resetModules().
jest.mock('../RelayFeatureFlags', () => ({
  ...jest.requireActual('../RelayFeatureFlags'),
  ENABLE_PERF_QUERY: true,
}));

require('./stableCopy-test');
