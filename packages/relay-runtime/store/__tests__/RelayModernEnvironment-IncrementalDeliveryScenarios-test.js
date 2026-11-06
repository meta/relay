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

import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';

const RelayObservable = require('relay-runtime/network/RelayObservable');
const {
  runScenario,
  scenarios,
} = require('relay-runtime/store/__tests__/RelayIncrementalDeliveryTestScenarios');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe('the incremental delivery scenarios', () => {
  it.each(scenarios.map(scenario => [scenario.name, scenario]))(
    'apply as label/path payloads: %s',
    (name, scenario) => {
      const outcome = runScenario(
        scenario,
        scenario.labelPath,
        server => () => RelayObservable.create<GraphQLResponse>(server),
      );
      if (name === 'a deferred fragment that fails as a whole') {
        expect(outcome.error).toContain('nearest_neighbor failed');
        return;
      }
      expect(outcome.error).toBe(null);
      expect(outcome.completed).toBe(true);
      // The last payload is final: the request is no longer active.
      expect(outcome.steps.at(-1)?.active).toBe(false);
    },
  );
});
