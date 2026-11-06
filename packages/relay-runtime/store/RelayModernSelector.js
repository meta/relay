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

import type {NormalizationSelectableNode} from '../util/NormalizationNode';
import type {ReaderFragment} from '../util/ReaderNode';
import type {DataID, Variables} from '../util/RelayRuntimeTypes';
import type {
  ClientEdgeTraversalInfo,
  NormalizationSelector,
  PluralReaderSelector,
  ReaderSelector,
  RequestDescriptor,
  SingularReaderSelector,
} from './RelayStoreTypes';

const {getFragmentVariables} = require('./RelayConcreteVariables');
const {
  FRAGMENT_OWNER_KEY,
  FRAGMENT_POINTER_IS_WITHIN_UNMATCHED_TYPE_REFINEMENT,
  FRAGMENTS_KEY,
  ID_KEY,
  PARENT_CLIENT_EDGE,
} = require('./RelayStoreUtils');
const areEqual = require('areEqual');
const invariant = require('invariant');
const warning = require('warning');

/**
 * @public
 *
 * Given the result `item` from a parent that fetched `fragment`, creates a
 * selector that can be used to read the results of that fragment for that item.
 *
 * Example:
 *
 * Given two fragments as follows:
 *
 * ```
 * fragment Parent on User {
 *   id
 *   ...Child
 * }
 * fragment Child on User {
 *   name
 * }
 * ```
 *
 * And given some object `parent` that is the results of `Parent` for id "4",
 * the results of `Child` can be accessed by first getting a selector and then
 * using that selector to `lookup()` the results against the environment:
 *
 * ```
 * const childSelector = getSingularSelector(queryVariables, Child, parent);
 * const childData = environment.lookup(childSelector).data;
 * ```
 */
function getSingularSelector(
  fragment: ReaderFragment,
  item: unknown,
): ?SingularReaderSelector {
  // The check is kept out of the `invariant()` call so that `JSON.stringify()`
  // only runs when it actually fails: arguments are evaluated eagerly, and
  // relying on a build transform to strip them would make this hot path slow
  // wherever that transform is not applied.
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    invariant(
      false,
      'RelayModernSelector: Expected value for fragment `%s` to be an object, got ' +
        '`%s`.',
      fragment.name,
      JSON.stringify(item),
    );
  }
  const dataID = item[ID_KEY];
  const fragments = item[FRAGMENTS_KEY];
  const mixedOwner = item[FRAGMENT_OWNER_KEY];
  const mixedParentClientEdge = item[PARENT_CLIENT_EDGE];
  if (
    typeof dataID === 'string' &&
    typeof fragments === 'object' &&
    fragments !== null &&
    typeof fragments[fragment.name] === 'object' &&
    fragments[fragment.name] !== null &&
    typeof mixedOwner === 'object' &&
    mixedOwner !== null &&
    (mixedParentClientEdge == null || typeof mixedParentClientEdge === 'object')
  ) {
    const owner: RequestDescriptor = mixedOwner as $FlowFixMe;
    const parentClientEdge: ?ClientEdgeTraversalInfo =
      mixedParentClientEdge as $FlowFixMe;

    const argumentVariables = fragments[fragment.name];
    const fragmentVariables = getFragmentVariables(
      fragment,
      owner.variables,
      argumentVariables,
    );

    const isWithinUnmatchedTypeRefinement =
      argumentVariables[
        FRAGMENT_POINTER_IS_WITHIN_UNMATCHED_TYPE_REFINEMENT
      ] === true;

    return createReaderSelector(
      fragment,
      dataID,
      fragmentVariables,
      owner,
      isWithinUnmatchedTypeRefinement,
      parentClientEdge,
    );
  }

  if (__DEV__) {
    let stringifiedItem = JSON.stringify(item);
    if (stringifiedItem.length > 499) {
      stringifiedItem = stringifiedItem.substr(0, 498) + '\u2026';
    }

    warning(
      false,
      'RelayModernSelector: Expected object to contain data for fragment `%s`, got ' +
        '`%s`. Make sure that the parent operation/fragment included fragment ' +
        '`...%s` without `@relay(mask: false)`.',
      fragment.name,
      stringifiedItem,
      fragment.name,
    );
  }

  return null;
}

/**
 * @public
 *
 * Given the result `items` from a parent that fetched `fragment`, creates a
 * selector that can be used to read the results of that fragment on those
 * items. This is similar to `getSingularSelector` but for "plural" fragments that
 * expect an array of results and therefore return an array of selectors.
 */
function getPluralSelector(
  fragment: ReaderFragment,
  items: ReadonlyArray<unknown>,
): ?PluralReaderSelector {
  let selectors: null | Array<SingularReaderSelector> = null;
  items.forEach((item, ii) => {
    const selector = item != null ? getSingularSelector(fragment, item) : null;
    if (selector != null) {
      selectors = selectors || [];
      selectors.push(selector);
    }
  });
  if (selectors == null) {
    return null;
  } else {
    return {
      kind: 'PluralReaderSelector',
      selectors,
    };
  }
}

function getSelector(
  fragment: ReaderFragment,
  item: unknown | Array<unknown>,
): ?ReaderSelector {
  if (item == null) {
    return item;
  } else if (fragment.metadata && fragment.metadata.plural === true) {
    // As in `getSingularSelector()`, the checks stay outside of `invariant()` so
    // that valid inputs never pay for `JSON.stringify()`.
    if (!Array.isArray(item)) {
      invariant(
        false,
        'RelayModernSelector: Expected value for fragment `%s` to be an array, got `%s`. ' +
          'Remove `@relay(plural: true)` from fragment `%s` to allow the prop to be an object.',
        fragment.name,
        JSON.stringify(item),
        fragment.name,
      );
    }
    return getPluralSelector(fragment, item);
  } else {
    if (Array.isArray(item)) {
      invariant(
        false,
        'RelayModernSelector: Expected value for fragment `%s` to be an object, got `%s`. ' +
          'Add `@relay(plural: true)` to fragment `%s` to allow the prop to be an array of items.',
        fragment.name,
        JSON.stringify(item),
        fragment.name,
      );
    }
    return getSingularSelector(fragment, item);
  }
}

/**
 * @public
 *
 * Given a mapping of keys -> results and a mapping of keys -> fragments,
 * extracts the selectors for those fragments from the results.
 *
 * The canonical use-case for this function is ReactRelayFragmentContainer, which
 * uses this function to convert (props, fragments) into selectors so that it
 * can read the results to pass to the inner component.
 */
function getSelectorsFromObject(
  fragments: {[key: string]: ReaderFragment, ...},
  object: {[key: string]: unknown, ...},
): {[key: string]: ?ReaderSelector, ...} {
  const selectors: {[key: string]: ?ReaderSelector} = {};
  for (const key in fragments) {
    if (fragments.hasOwnProperty(key)) {
      const fragment = fragments[key];
      const item = object[key];
      selectors[key] = getSelector(fragment, item);
    }
  }
  return selectors;
}

/**
 * @public
 *
 * Given a mapping of keys -> results and a mapping of keys -> fragments,
 * extracts a mapping of keys -> id(s) of the results.
 *
 * Similar to `getSelectorsFromObject()`, this function can be useful in
 * determining the "identity" of the props passed to a component.
 */
function getDataIDsFromObject(
  fragments: {[key: string]: ReaderFragment, ...},
  object: {[key: string]: unknown, ...},
): {[key: string]: ?(DataID | Array<DataID>), ...} {
  const ids: {[key: string]: ?(DataID | Array<DataID>)} = {};
  for (const key in fragments) {
    if (fragments.hasOwnProperty(key)) {
      const fragment = fragments[key];
      const item = object[key];
      ids[key] = getDataIDsFromFragment(fragment, item);
    }
  }
  return ids;
}

function getDataIDsFromFragment(
  fragment: ReaderFragment,
  item: unknown | Array<unknown>,
): ?DataID | ?Array<DataID> {
  if (item == null) {
    return item;
  } else if (fragment.metadata && fragment.metadata.plural === true) {
    invariant(
      Array.isArray(item),
      'RelayModernSelector: Expected value for fragment `%s` to be an array, got `%s`. ' +
        'Remove `@relay(plural: true)` from fragment `%s` to allow the prop to be an object.',
      fragment.name,
      JSON.stringify(item),
      fragment.name,
    );
    return getDataIDs(fragment, item);
  } else {
    invariant(
      !Array.isArray(item),
      'RelayModernFragmentSpecResolver: Expected value for fragment `%s` to be an object, got `%s`. ' +
        'Add `@relay(plural: true)` to fragment `%s` to allow the prop to be an array of items.',
      fragment.name,
      JSON.stringify(item),
      fragment.name,
    );
    return getDataID(fragment, item);
  }
}

/**
 * @internal
 */
function getDataIDs(
  fragment: ReaderFragment,
  items: ReadonlyArray<unknown>,
): ?Array<DataID> {
  let ids: null | Array<DataID> = null;
  items.forEach(item => {
    const id = item != null ? getDataID(fragment, item) : null;
    if (id != null) {
      ids = ids || [];
      ids.push(id);
    }
  });
  return ids;
}

/**
 * @internal
 */
function getDataID(fragment: ReaderFragment, item: unknown): ?DataID {
  invariant(
    typeof item === 'object' && item !== null && !Array.isArray(item),
    'RelayModernSelector: Expected value for fragment `%s` to be an object, got ' +
      '`%s`.',
    fragment.name,
    JSON.stringify(item),
  );
  const dataID = item[ID_KEY];
  if (typeof dataID === 'string') {
    return dataID;
  }
  warning(
    false,
    'RelayModernSelector: Expected object to contain data for fragment `%s`, got ' +
      '`%s`. Make sure that the parent operation/fragment included fragment ' +
      '`...%s` without `@relay(mask: false)`, or `null` is passed as the fragment ' +
      "reference for `%s` if it's conditonally included and the condition isn't met.",
    fragment.name,
    JSON.stringify(item),
    fragment.name,
    fragment.name,
  );
  return null;
}

/**
 * @public
 *
 * Given a mapping of keys -> results and a mapping of keys -> fragments,
 * extracts the merged variables that would be in scope for those
 * fragments/results.
 *
 * This can be useful in determing what varaibles were used to fetch the data
 * for a Relay container, for example.
 */
function getVariablesFromObject(
  fragments: {[key: string]: ReaderFragment, ...},
  object: {[key: string]: unknown, ...},
): Variables {
  const variables = {};
  for (const key in fragments) {
    if (fragments.hasOwnProperty(key)) {
      const fragment = fragments[key];
      const item = object[key];
      const itemVariables = getVariablesFromFragment(fragment, item);
      // $FlowFixMe[unsafe-object-assign]
      Object.assign(variables, itemVariables);
    }
  }
  return variables;
}

function getVariablesFromFragment(
  fragment: ReaderFragment,
  item: unknown | ReadonlyArray<unknown>,
): Variables {
  if (item == null) {
    return {};
  } else if (fragment.metadata?.plural === true) {
    invariant(
      Array.isArray(item),
      'RelayModernSelector: Expected value for fragment `%s` to be an array, got `%s`. ' +
        'Remove `@relay(plural: true)` from fragment `%s` to allow the prop to be an object.',
      fragment.name,
      JSON.stringify(item),
      fragment.name,
    );

    return getVariablesFromPluralFragment(fragment, item);
  } else {
    invariant(
      !Array.isArray(item),
      'RelayModernFragmentSpecResolver: Expected value for fragment `%s` to be an object, got `%s`. ' +
        'Add `@relay(plural: true)` to fragment `%s` to allow the prop to be an array of items.',
      fragment.name,
      JSON.stringify(item),
      fragment.name,
    );

    return getVariablesFromSingularFragment(fragment, item) || {};
  }
}

function getVariablesFromSingularFragment(
  fragment: ReaderFragment,
  item: unknown,
): ?Variables {
  const selector = getSingularSelector(fragment, item);
  if (!selector) {
    return null;
  }
  return selector.variables;
}

function getVariablesFromPluralFragment(
  fragment: ReaderFragment,
  items: ReadonlyArray<unknown>,
): Variables {
  const variables = {};
  items.forEach((value, ii) => {
    if (value != null) {
      const itemVariables = getVariablesFromSingularFragment(fragment, value);
      if (itemVariables != null) {
        // $FlowFixMe[unsafe-object-assign]
        Object.assign(variables, itemVariables);
      }
    }
  });
  return variables;
}

function areEqualSingularSelectors(
  thisSelector: SingularReaderSelector,
  thatSelector: SingularReaderSelector,
): boolean {
  return (
    thisSelector.dataID === thatSelector.dataID &&
    thisSelector.node === thatSelector.node &&
    areEqual(thisSelector.variables, thatSelector.variables) &&
    areEqualOwners(thisSelector.owner, thatSelector.owner) &&
    thisSelector.isWithinUnmatchedTypeRefinement ===
      thatSelector.isWithinUnmatchedTypeRefinement &&
    areEqualParentClientEdges(
      thisSelector.parentClientEdge,
      thatSelector.parentClientEdge,
    )
  );
}

function areEqualOwners(
  thisOwner: RequestDescriptor,
  thatOwner: RequestDescriptor,
): boolean {
  if (thisOwner === thatOwner) {
    return true;
  } else {
    return (
      // The `identifier` should already include serilized variables, so we
      // don't need to compare them here.
      // And the RequestDescriptor `node` should have the same reference
      // as it should come from the generated artifact.
      thisOwner.identifier === thatOwner.identifier &&
      areEqual(thisOwner.cacheConfig, thatOwner.cacheConfig)
    );
  }
}

function areEqualParentClientEdges(
  thisEdge: ClientEdgeTraversalInfo | null,
  thatEdge: ClientEdgeTraversalInfo | null,
): boolean {
  if (thisEdge === thatEdge) {
    return true;
  }
  if (thisEdge == null || thatEdge == null) {
    return false;
  }
  return (
    thisEdge.clientEdgeDestinationID === thatEdge.clientEdgeDestinationID &&
    thisEdge.readerClientEdge === thatEdge.readerClientEdge
  );
}

/**
 * @public
 *
 * Determine if two selectors are equal (represent the same selection). Note
 * that this function returns `false` when the two queries/fragments are
 * different objects, even if they select the same fields.
 */
function areEqualSelectors(
  a: ?(SingularReaderSelector | PluralReaderSelector),
  b: ?(SingularReaderSelector | PluralReaderSelector),
): boolean {
  if (a === b) {
    return true;
  } else if (a == null) {
    return b == null;
  } else if (b == null) {
    return a == null;
  } else if (
    a.kind === 'SingularReaderSelector' &&
    b.kind === 'SingularReaderSelector'
  ) {
    return areEqualSingularSelectors(a, b);
  } else if (
    a.kind === 'PluralReaderSelector' &&
    b.kind === 'PluralReaderSelector'
  ) {
    return (
      a.selectors.length === b.selectors.length &&
      a.selectors.every((s, i) => areEqualSingularSelectors(s, b.selectors[i]))
    );
  } else {
    return false;
  }
}

function createReaderSelector(
  fragment: ReaderFragment,
  dataID: DataID,
  variables: Variables,
  request: RequestDescriptor,
  isWithinUnmatchedTypeRefinement: boolean = false,
  parentClientEdge: ?ClientEdgeTraversalInfo,
): SingularReaderSelector {
  return {
    parentClientEdge: parentClientEdge ?? null,
    dataID,
    isWithinUnmatchedTypeRefinement,
    kind: 'SingularReaderSelector',
    node: fragment,
    owner: request,
    variables,
  };
}

function createNormalizationSelector(
  node: NormalizationSelectableNode,
  dataID: DataID,
  variables: Variables,
): NormalizationSelector {
  return {dataID, node, variables};
}

module.exports = {
  areEqualSelectors,
  createNormalizationSelector,
  createReaderSelector,
  getDataIDsFromFragment,
  getDataIDsFromObject,
  getPluralSelector,
  getSelector,
  getSelectorsFromObject,
  getSingularSelector,
  getVariablesFromFragment,
  getVariablesFromObject,
  getVariablesFromPluralFragment,
  getVariablesFromSingularFragment,
};
