/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

'use strict';

// Runs recycleNodesInto-test with ENABLE_PERF_NOTIFY on.
// RelayFeatureFlags is mocked so that every copy of it has the flag on, also
// after jest.resetModules().
jest.mock('../RelayFeatureFlags', () => ({
  ...jest.requireActual('../RelayFeatureFlags'),
  ENABLE_PERF_NOTIFY: true,
}));

require('./recycleNodesInto-test');
