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

import type {
  NormalizationArgument,
  NormalizationLocalArgumentDefinition,
  NormalizationOperation,
} from '../util/NormalizationNode';
import type {
  ReaderFragment,
  ReaderInlineDataFragmentSpread,
} from '../util/ReaderNode';
import type {ProvidedVariablesType} from '../util/RelayConcreteNode';
import type {Variables} from '../util/RelayRuntimeTypes';

const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const {getArgumentValues} = require('./RelayStoreUtils');
const invariant = require('invariant');

/**
 * Determines the variables that are in scope for a fragment given the variables
 * in scope at the root query as well as any arguments applied at the fragment
 * spread via `@arguments`.
 *
 * Note that this is analagous to determining function arguments given a function call.
 */
function getFragmentVariables(
  fragment: ReaderFragment | ReaderInlineDataFragmentSpread,
  rootVariables: Variables,
  argumentVariables: Variables,
): Variables {
  // TODO: Support for legacy ReaderInlineDataFragmentSpread nodes.
  // Remove this once all we've updated the ReaderInlineDataFragmentSpread
  // type to indicate that all compiled artifacts have been updated.
  if (fragment.argumentDefinitions == null) {
    return argumentVariables;
  }
  let variables: {[string]: $FlowFixMe};
  fragment.argumentDefinitions.forEach(definition => {
    if (argumentVariables.hasOwnProperty(definition.name)) {
      return;
    }
    variables = variables || {...argumentVariables};
    switch (definition.kind) {
      case 'LocalArgument':
        variables[definition.name] = definition.defaultValue;
        break;
      case 'RootArgument':
        if (!rootVariables.hasOwnProperty(definition.name)) {
          /*
           * Global variables passed as values of @arguments are not required to
           * be declared unless they are used by the callee fragment or a
           * descendant. In this case, the root variable may not be defined when
           * resolving the callee's variables. The value is explicitly set to
           * undefined to conform to the check in
           * RelayStoreUtils.getStableVariableValue() that variable keys are all
           * present.
           */
          variables[definition.name] = undefined;
          break;
        }
        variables[definition.name] = rootVariables[definition.name];
        break;
      default:
        definition as empty;
        invariant(
          false,
          'RelayConcreteVariables: Unexpected node kind `%s` in fragment `%s`.',
          definition.kind,
          fragment.name,
        );
    }
  });
  return variables || argumentVariables;
}

/**
 * Determines the variables that are in scope for a given operation given values
 * for some/all of its arguments.
 * - extraneous input variables are filtered from the output
 * - missing variables are set to default values (if given in the
 * operation's definition).
 * - variables with provider modules are added
 */
function getOperationVariables(
  operation: NormalizationOperation,
  providedVariables: ?ProvidedVariablesType,
  variables: Variables,
): Variables {
  const operationVariables: {[string]: unknown} = {};
  operation.argumentDefinitions.forEach(def => {
    let value = def.defaultValue;
    if (variables[def.name] != null) {
      value = variables[def.name];
    }
    operationVariables[def.name] = value;
  });

  if (providedVariables != null) {
    Object.keys(providedVariables).forEach((varName: string) => {
      operationVariables[varName] = providedVariables[varName].get();
    });
  }
  return operationVariables;
}

function getLocalVariables(
  currentVariables: Variables,
  argumentDefinitions: ?ReadonlyArray<NormalizationLocalArgumentDefinition>,
  args: ?ReadonlyArray<NormalizationArgument>,
): Variables {
  if (argumentDefinitions == null) {
    return currentVariables;
  }
  const nextVariables = {...currentVariables};
  const nextArgs = args ? getArgumentValues(args, currentVariables) : {};
  argumentDefinitions.forEach(def => {
    // An explicit null is a value, as in `getFragmentVariables`.
    // $FlowFixMe[invalid-computed-prop]
    const value = nextArgs[def.name];
    nextVariables[def.name] =
      value !== undefined &&
      (value !== null ||
        RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS)
        ? value
        : def.defaultValue;
  });
  return nextVariables;
}

module.exports = {
  getFragmentVariables,
  getLocalVariables,
  getOperationVariables,
};
