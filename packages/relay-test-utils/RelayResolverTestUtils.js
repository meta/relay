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

const {
  __internal: {ResolverFragments},
} = require('relay-runtime');

/**
 * Utility function for testing Relay Resolvers. Pass the resolver function and
 * the data that will be returned from `readFragment` and it will return the
 * value that the resolver would derive.
 *
 * *Note:* Relay fragment data includes a special `$fragmentType` key which is
 * impossible for non-Relay code to construct. In tests you can work around
 * this by passing `null` with a Flow suppression:
 *
 * ```
 * const fragmentData = {
 *   // Other fields here...
 *   $fragmentType: (null: any)
 * };
 *
 * const actual = testResolver(resolverFunc, fragmentData);
 * expect(actual).toEqual(expectedValue)
 * ```
 **/
function testResolver<D extends ?{readonly $fragmentType?: unknown, ...}, Ret>(
  resolver: (v: {$data?: D, $fragmentRefs: any, $fragmentSpreads: any}) => Ret,
  // indexed_access is not yet enabled for this code base. Once it is, this can
  // become: `Key['$data']`
  fragmentData: NoInfer<Omit<NonNullable<D>, '$fragmentType'>>,
): Ret {
  const readFragment = ResolverFragments.readFragment;
  // $FlowFixMe[incompatible-type]: a test utility, so... YOLO!!
  ResolverFragments.readFragment = () => fragmentData;
  const result = resolver(
    // This will be ignored since we mock the function it gets passed to.
    // $FlowFixMe[incompatible-type]
    null,
  );
  ResolverFragments.readFragment = readFragment;
  return result;
}

module.exports = {testResolver};
