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
import type {Sink} from 'relay-runtime/network/RelayObservable';

const RelayObservable = require('relay-runtime/network/RelayObservable');
const {
  runScenario,
  scenarios,
} = require('relay-runtime/store/__tests__/RelayIncrementalDeliveryTestScenarios');
const {disallowWarnings, expectToWarn} = require('relay-test-utils-internal');

disallowWarnings();

// As a fetch function reads responses from the wire: untyped.
function fromWire(responses: ReadonlyArray<unknown>): Array<GraphQLResponse> {
  return responses.map(response =>
    JSON.parse(String(JSON.stringify(response))),
  );
}

function fetch(server: (sink: Sink<GraphQLResponse>) => void) {
  return () => RelayObservable.create<GraphQLResponse>(server);
}

it.each(scenarios.map(scenario => [scenario.name, scenario]))(
  'leaves the store as label/path payloads do: %s',
  (_name, scenario) => {
    const expected = runScenario(scenario, scenario.labelPath, fetch);
    const actual = runScenario(scenario, fromWire(scenario.incremental), fetch);
    expect(actual.error).toEqual(expected.error);
    expect(actual.completed).toEqual(expected.completed);
    expect(actual.steps.at(-1)?.records).toEqual(
      expected.steps.at(-1)?.records,
    );
    if (scenario.labelPath.length === scenario.incremental.length) {
      expect(actual.steps).toEqual(expected.steps);
    }
  },
);

it('reads the 2022 draft format, whose first response has `hasNext`, as label/path', () => {
  const [initial, deferred] = JSON.parse(
    JSON.stringify(scenarios[0].labelPath),
  );
  // Each result of that draft is whole, so a missing field still warns.
  delete deferred.data.name;
  const outcome = expectToWarn(
    'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
    () =>
      runScenario(scenarios[0], [{...initial, hasNext: true}, deferred], fetch),
  );
  expect(outcome.error).toBe(null);
});
