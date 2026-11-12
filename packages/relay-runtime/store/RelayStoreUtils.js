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

import type {
  NormalizationArgument,
  NormalizationField,
  NormalizationHandle,
  NormalizationLiveResolverField,
  NormalizationResolverField,
} from '../util/NormalizationNode';
import type {
  ReaderActorChange,
  ReaderArgument,
  ReaderField,
  ReaderFragmentSpread,
  ReaderRelayLiveResolver,
  ReaderRelayResolver,
} from '../util/ReaderNode';
import type {Variables} from '../util/RelayRuntimeTypes';

const getRelayHandleKey = require('../util/getRelayHandleKey');
const RelayConcreteNode = require('../util/RelayConcreteNode');
const RelayFeatureFlags = require('../util/RelayFeatureFlags');
const {stableCopy} = require('../util/stableCopy');
const invariant = require('invariant');

export type Arguments = {
  readonly FRAGMENT_POINTER_IS_WITHIN_UNMATCHED_TYPE_REFINEMENT?: boolean,
  readonly [key: string]: unknown,
};

const {VARIABLE, LITERAL, OBJECT_VALUE, LIST_VALUE} = RelayConcreteNode;

const ERRORS_KEY: '__errors' = '__errors';
const FIELD_GRANULAR_NOTIFICATIONS_KEY = '__fieldGranularNotifications';
const MODULE_COMPONENT_KEY_PREFIX = '__module_component_';
const MODULE_OPERATION_KEY_PREFIX = '__module_operation_';

const RELAY_READ_TIME_RESOLVER_KEY_PREFIX = '$r:';

function getArgumentValue(
  arg: NormalizationArgument | ReaderArgument,
  variables: Variables,
): unknown {
  if (arg.kind === VARIABLE) {
    // Variables are provided at runtime and are not guaranteed to be stable.
    return getStableVariableValue(arg.variableName, variables);
  } else if (arg.kind === LITERAL) {
    // The Relay compiler generates stable ConcreteArgument values.
    return arg.value;
  } else if (arg.kind === OBJECT_VALUE) {
    const value: {[key: string]: unknown} = {};
    arg.fields.forEach(field => {
      value[field.name] = getArgumentValue(field, variables);
    });
    return value;
  } else if (arg.kind === LIST_VALUE) {
    const value = [];
    arg.items.forEach(item => {
      item != null ? value.push(getArgumentValue(item, variables)) : null;
    });
    return value;
  }
}

/**
 * Returns the values of field/fragment arguments as an object keyed by argument
 * names. Guaranteed to return a result with stable ordered nested values.
 */
function getArgumentValues(
  args?: ?ReadonlyArray<NormalizationArgument | ReaderArgument>,
  variables: Variables,
  isWithinUnmatchedTypeRefinement?: boolean,
): Arguments {
  const values: {
    FRAGMENT_POINTER_IS_WITHIN_UNMATCHED_TYPE_REFINEMENT?: boolean,
    [key: string]: unknown,
  } = {};
  if (isWithinUnmatchedTypeRefinement) {
    values[
      RelayStoreUtils.FRAGMENT_POINTER_IS_WITHIN_UNMATCHED_TYPE_REFINEMENT
    ] = true;
  }
  if (args) {
    args.forEach(arg => {
      values[arg.name] = getArgumentValue(arg, variables);
    });
  }
  return values;
}

/**
 * Given a handle field and variable values, returns a key that can be used to
 * uniquely identify the combination of the handle name and argument values.
 *
 * Note: the word "storage" here refers to the fact this key is primarily used
 * when writing the results of a key in a normalized graph or "store". This
 * name was used in previous implementations of Relay internals and is also
 * used here for consistency.
 */
function getHandleStorageKey(
  handleField: NormalizationHandle,
  variables: Variables,
): string {
  const {dynamicKey, handle, key, name, args, filters} = handleField;
  const handleName = getRelayHandleKey(handle, key, name);
  let filterArgs = null;
  if (args && filters && args.length !== 0 && filters.length !== 0) {
    filterArgs = args.filter(arg => filters.indexOf(arg.name) > -1);
  }
  if (dynamicKey) {
    // "Sort" the arguments by argument name: this is done by the compiler for
    // user-supplied arguments but the dynamic argument must also be in sorted
    // order.  Note that dynamic key argument name is double-underscore-
    // -prefixed, and a double-underscore prefix is disallowed for user-supplied
    // argument names, so there's no need to actually sort.
    filterArgs =
      filterArgs != null ? [dynamicKey, ...filterArgs] : [dynamicKey];
  }
  if (filterArgs === null) {
    return handleName;
  } else {
    return formatStorageKey(
      handleName,
      getArgumentValues(filterArgs, variables),
    );
  }
}

/**
 * Given a field and variable values, returns a key that can be used to
 * uniquely identify the combination of the field name and argument values.
 *
 * Note: the word "storage" here refers to the fact this key is primarily used
 * when writing the results of a key in a normalized graph or "store". This
 * name was used in previous implementations of Relay internals and is also
 * used here for consistency.
 */
function getStorageKey(
  field:
    | ReaderRelayResolver
    | ReaderRelayLiveResolver
    | ReaderFragmentSpread
    | NormalizationField
    | NormalizationHandle
    | ReaderField
    | ReaderActorChange,
  variables: Variables,
): string {
  if (field.storageKey) {
    // TODO T23663664: Handle nodes do not yet define a static storageKey.
    return field.storageKey;
  }

  const args = getArguments(field);
  const name = field.name;
  if (!args || args.length === 0) {
    return name;
  }
  return formatStorageKey(name, getArgumentValues(args, variables));
}

/**
 * This is a special case of getStorageKey that should be used when dealing with
 * read time resolver fields. A resolver may be used at both exec time and at read
 * time within the same project. However, the value of the read time resolver is
 * wrapped while the value of the exec time resolver is a standard Relay object. To
 * disambiguate in the case that both types may exist on the same record, the read
 * time resolver storage keys are prefixed.
 */
function getReadTimeResolverStorageKey(
  field:
    | ReaderRelayResolver
    | ReaderRelayLiveResolver
    | NormalizationResolverField
    | NormalizationLiveResolverField,
  variables: Variables,
): string {
  if (RelayFeatureFlags.ENABLE_PERF_STORAGE_KEYS) {
    return getReadTimeResolverStorageKeyPerf(field, variables);
  }
  const storageKey = getStorageKey(field, variables);
  return '$r:' + storageKey;
}

/**
 * Given a field the method returns an array of arguments.
 * For Relay resolver fields, we store arguments on the field and fragment
 * and this method return combined list of arguments.
 */
function getArguments(
  field:
    | ReaderRelayResolver
    | ReaderRelayLiveResolver
    | ReaderFragmentSpread
    | NormalizationField
    | NormalizationHandle
    | ReaderField
    | ReaderActorChange,
): ?ReadonlyArray<NormalizationArgument | ReaderArgument> {
  if (field.kind === 'RelayResolver' || field.kind === 'RelayLiveResolver') {
    if (field.args == null) {
      return field.fragment?.args;
    }
    if (field.fragment?.args == null) {
      return field.args;
    }
    return field.args.concat(field.fragment.args);
  }
  const args = typeof field.args === 'undefined' ? undefined : field.args;
  return args;
}

/**
 * Given a `name` (eg. "foo") and an object representing argument values
 * (eg. `{orberBy: "name", first: 10}`) returns a unique storage key
 * (ie. `foo{"first":10,"orderBy":"name"}`).
 *
 * This differs from getStorageKey which requires a ConcreteNode where arguments
 * are assumed to already be sorted into a stable order.
 */
function getStableStorageKey(name: string, args: ?Arguments): string {
  return formatStorageKey(name, stableCopy(args));
}

/**
 * Given a name and argument values, format a storage key.
 *
 * Arguments and the values within them are expected to be ordered in a stable
 * alphabetical ordering.
 */
function formatStorageKey(name: string, argValues: ?Arguments): string {
  if (!argValues) {
    return name;
  }
  const values = [];
  const argNames = Object.keys(argValues);
  for (let i = 0; i < argNames.length; i++) {
    const argName = argNames[i];
    const value = argValues[argName];
    if (value != null) {
      values.push(argName + ':' + (JSON.stringify(value) ?? 'undefined'));
    }
  }
  return values.length === 0 ? name : name + `(${values.join(',')})`;
}

/**
 * Given Variables and a variable name, return a variable value with
 * all values in a stable order.
 */
function getStableVariableValue(name: string, variables: Variables): unknown {
  invariant(
    /* $FlowFixMe[invalid-this-arg] Error exposed after fixing this typing
     * unsoundness in flow */
    Object.prototype.hasOwnProperty.call(variables, name),
    'getVariableValue(): Undefined variable `%s`.',
    name,
  );
  return stableCopy(variables[name]);
}

function getModuleComponentKey(documentName: string): string {
  return `${MODULE_COMPONENT_KEY_PREFIX}${documentName}`;
}

function getModuleOperationKey(documentName: string): string {
  return `${MODULE_OPERATION_KEY_PREFIX}${documentName}`;
}

function getFieldNotificationKey(dataID: string, storageKey: string): string {
  return `__fn:${dataID}:${storageKey}`;
}

/**
 * Constants shared by all implementations of RecordSource/MutableRecordSource/etc.
 */
const RelayStoreUtils = {
  ACTOR_IDENTIFIER_KEY: '__actorIdentifier',
  PARENT_CLIENT_EDGE: '__parentClientEdge',
  FRAGMENTS_KEY: '__fragments',
  FRAGMENT_OWNER_KEY: '__fragmentOwner',
  FRAGMENT_POINTER_IS_WITHIN_UNMATCHED_TYPE_REFINEMENT:
    '$isWithinUnmatchedTypeRefinement',
  FRAGMENT_PROP_NAME_KEY: '__fragmentPropName',
  MODULE_COMPONENT_KEY: '__module_component', // alias returned by Reader
  ERRORS_KEY,
  FIELD_GRANULAR_NOTIFICATIONS_KEY,
  ID_KEY: '__id',
  REF_KEY: '__ref',
  REFS_KEY: '__refs',
  ROOT_ID: 'client:root',
  ROOT_TYPE: '__Root',
  TYPENAME_KEY: '__typename',
  INVALIDATED_AT_KEY: '__invalidated_at',
  RELAY_RESOLVER_VALUE_KEY: '__resolverValue',
  RELAY_RESOLVER_INVALIDATION_KEY: '__resolverValueMayBeInvalid',
  RELAY_RESOLVER_SNAPSHOT_KEY: '__resolverSnapshot',
  RELAY_RESOLVER_ERROR_KEY: '__resolverError',
  RELAY_RESOLVER_OUTPUT_TYPE_RECORD_IDS: '__resolverOutputTypeRecordIDs',
  RELAY_RESOLVER_RECORD_TYPENAME: '__RELAY_RESOLVER__',
  RELAY_READ_TIME_RESOLVER_KEY_PREFIX,

  formatStorageKey,
  getArgumentValue,
  getArgumentValues,
  getHandleStorageKey,
  getStorageKey,
  getReadTimeResolverStorageKey,
  getStableStorageKey,
  getModuleComponentKey,
  getModuleOperationKey,
  getFieldNotificationKey,
} as const;

// ----------------------------------------------------------------------
// Optimized variants (`*Perf`) of the functions above.
// Used only when ENABLE_PERF_STORAGE_KEYS is on; with it off the code above runs
// unchanged.

function getReadTimeResolverStorageKeyPerf(
  field:
    | ReaderRelayResolver
    | ReaderRelayLiveResolver
    | NormalizationResolverField
    | NormalizationLiveResolverField,
  variables: Variables,
): string {
  const cached = staticReadTimeResolverStorageKeys.get(field);
  if (cached != null) {
    return cached;
  }
  const storageKey = '$r:' + getStorageKey(field, variables); // Using inlined string to test the performance impact
  if (cached === undefined) {
    staticReadTimeResolverStorageKeys.set(
      field,
      argumentsReferenceVariables(getArguments(field)) ? null : storageKey,
    );
  }
  return storageKey;
}

// Resolver fields are read on every render and notify, and their prefixed
// storage key used to be rebuilt each time. When no argument references a
// variable the key depends only on the field node, so it is built once per
// node. `null` marks nodes whose key depends on variables.
const staticReadTimeResolverStorageKeys: WeakMap<
  | ReaderRelayResolver
  | ReaderRelayLiveResolver
  | NormalizationResolverField
  | NormalizationLiveResolverField,
  string | null,
> = new WeakMap();

function argumentsReferenceVariables(
  args: ?ReadonlyArray<?(NormalizationArgument | ReaderArgument)>,
): boolean {
  if (args == null) {
    return false;
  }
  for (let ii = 0; ii < args.length; ii++) {
    if (argumentReferencesVariables(args[ii])) {
      return true;
    }
  }
  return false;
}

function argumentReferencesVariables(
  arg: ?(NormalizationArgument | ReaderArgument),
): boolean {
  if (arg == null || arg.kind === LITERAL) {
    return false;
  }
  if (arg.kind === OBJECT_VALUE) {
    return argumentsReferenceVariables(arg.fields);
  }
  if (arg.kind === LIST_VALUE) {
    return argumentsReferenceVariables(arg.items);
  }
  // Variables, and any argument kind added later.
  return true;
}

module.exports = RelayStoreUtils;
