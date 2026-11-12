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

// Runs RelayReader-test with ENABLE_PERF_READER on.
// RelayFeatureFlags is mocked so that every copy of it has the flag on, also
// after jest.resetModules().
jest.mock('../../util/RelayFeatureFlags', () => ({
  ...jest.requireActual('../../util/RelayFeatureFlags'),
  ENABLE_PERF_READER: true,
}));

require('./RelayReader-test');
