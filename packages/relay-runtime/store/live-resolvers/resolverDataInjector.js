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

import type {Fragment} from '../../util/RelayRuntimeTypes';
import type {FragmentType, ResolverContext} from '../RelayStoreTypes';

const {readFragment} = require('../ResolverFragments');
const invariant = require('invariant');

type ResolverFn = (
  v0: $FlowFixMe,
  v1: ?$FlowFixMe,
  v2: ResolverContext,
) => unknown;

/**
 *
 * This a higher order function that returns a relay resolver that can read the data for
 * the fragment`.
 *
 * - fragment: contains fragment Reader AST with resolver's data dependencies.
 * - resolverFn: original resolver function that expects a data from the fragment
 * - (optional) fieldName: individual field that needs to be read out of the fragment.
 *
 * This will not call the `resolverFn` if the fragment data for it is null/undefined.
 * The compiler generates calls to this function, ensuring the correct set of arguments.
 */
function resolverDataInjector<
  TFragmentType extends FragmentType,
  TData extends ?{...},
>(
  fragment: Fragment<TFragmentType, TData>,
  // Resolvers have their own type assertions, we don't want to confuse users
  // with a type error in their generated code at this point.
  _resolverFn: $FlowFixMe,
  fieldName?: string,
  isRequiredField?: boolean,
): (fragmentKey: TFragmentType, args: unknown) => unknown {
  const resolverFn: ResolverFn = _resolverFn;
  return (
    fragmentKey: TFragmentType,
    args: unknown,
    resolverContext: ResolverContext,
  ): unknown => {
    const data = readFragment(fragment, fragmentKey);
    if (fieldName != null) {
      if (data == null) {
        if (isRequiredField === true) {
          invariant(
            false,
            'Expected required resolver field `%s` in fragment `%s` to be present. But resolvers fragment data is null/undefined.',
            fieldName,
            fragment.name,
          );
        } else {
          return resolverFn(null, args, resolverContext); // TODO: This statement does not seem to be covered by a test?
        }
      }

      // If `fieldName` is defined, the resolver expects only
      // the data for this field.
      if (fieldName in data) {
        if (isRequiredField === true) {
          invariant(
            // $FlowFixMe[invalid-computed-prop]
            data[fieldName] != null,
            'Expected required resolver field `%s` in fragment `%s` to be non-null.',
            fieldName,
            fragment.name,
          );
        }

        // $FlowFixMe[invalid-computed-prop]
        return resolverFn(data[fieldName], args, resolverContext);
      } else {
        // If both `data` and `fieldName` is available, we expect the
        // `fieldName` field in the `data` object.
        invariant(
          false,
          'Missing field `%s` in fragment `%s` in resolver response.',
          fieldName,
          fragment.name,
        );
      }
    } else {
      // By default we will pass the full set of the fragment data to the resolver
      return resolverFn(null, args, resolverContext); // TODO: This statement does not seem to be covered by a test?
    }
  };
}

module.exports = resolverDataInjector;
