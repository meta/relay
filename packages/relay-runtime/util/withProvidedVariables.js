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

import type {ProvidedVariablesType} from './RelayConcreteNode';
import type {Variables} from './RelayRuntimeTypes';

const areEqual = require('areEqual');
const warning = require('warning');

function withProvidedVariables(
  userSuppliedVariables: Variables,
  providedVariables: ?ProvidedVariablesType,
  cache: Map<() => unknown, unknown>,
): Variables {
  if (providedVariables != null) {
    const operationVariables: {[key: string]: unknown} = {};
    // $FlowFixMe[unsafe-object-assign]
    Object.assign(operationVariables, userSuppliedVariables);
    Object.keys(providedVariables).forEach((varName: string) => {
      const providerFunction = providedVariables[varName].get;

      if (!cache.has(providerFunction)) {
        const providerResult = providerFunction();
        cache.set(providerFunction, providerResult);
        operationVariables[varName] = providerResult;
      } else {
        const cachedResult = cache.get(providerFunction);

        if (__DEV__) {
          // people like to ignore these warnings, so recompute on every call
          // to detect if the provider has become impure
          const providerResult = providerFunction();
          warning(
            areEqual(providerResult, cachedResult),
            'Relay: Expected function `%s` for provider `%s` to be a pure function, ' +
              'but got conflicting return values `%s` and `%s`',
            providerFunction.name,
            varName,
            providerResult,
            cachedResult,
          );
        }
        operationVariables[varName] = cachedResult;
      }
    });
    return operationVariables;
  } else {
    return userSuppliedVariables;
  }
}

module.exports = withProvidedVariables;
