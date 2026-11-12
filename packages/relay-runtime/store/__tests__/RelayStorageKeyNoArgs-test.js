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
  NormalizationLinkedHandle,
  NormalizationScalarHandle,
  NormalizationSelection,
} from '../../util/NormalizationNode';
import type {ConcreteRequest} from '../../util/RelayConcreteNode';

const getRelayHandleKey = require('../../util/getRelayHandleKey');
const {LINKED_FIELD, SCALAR_FIELD} = require('../../util/RelayConcreteNode');
const cloneRelayHandleSourceField = require('../cloneRelayHandleSourceField');
const cloneRelayScalarHandleSourceField = require('../cloneRelayScalarHandleSourceField');
const LinkedHandleQuery: ConcreteRequest = require('./__generated__/cloneRelayHandleSourceFieldTestTestQuery.graphql');
const ScalarHandleQuery: ConcreteRequest = require('./__generated__/cloneRelayScalarHandleSourceFieldTestQuery.graphql');
// Through Jest: the open source Flow configuration has no Node library
// definitions.
const fs = jest.requireActual<{
  readdirSync(dir: string): ReadonlyArray<string>,
  readFileSync(file: string, encoding: 'utf8'): string,
}>('fs');
const path = jest.requireActual<{
  dirname(file: string): string,
  join(...parts: ReadonlyArray<string>): string,
}>('path');

// RelayReader with ENABLE_PERF_READER and RelayResponseNormalizer with
// ENABLE_PERF_STORAGE_KEYS take a field's name as its storage key when the
// field has no arguments, without calling getStorageKey. That is right only
// while every field with a static `storageKey` has arguments (the compiler's
// build_ast.rs emits one only then). DataChecker or RelayReferenceMarker doing
// the same would also rely on the handle fields cloned for checks and GC
// keeping `name === storageKey` with `args: null`.

type FieldKeys = {
  readonly args: unknown,
  readonly name: unknown,
  readonly storageKey: unknown,
};

function collectFields(node: unknown, out: Array<FieldKeys>): void {
  if (Array.isArray(node)) {
    node.forEach(child => collectFields(child, out));
    return;
  }
  if (node == null || typeof node !== 'object') {
    return;
  }
  const props = new Map(Object.entries(node));
  const kind = props.get('kind');
  if (kind === SCALAR_FIELD || kind === LINKED_FIELD) {
    out.push({
      args: props.get('args'),
      name: props.get('name'),
      storageKey: props.get('storageKey'),
    });
  }
  props.forEach(value => collectFields(value, out));
}

function selectionsOf(
  node: NormalizationSelection,
): ReadonlyArray<NormalizationSelection> {
  if (node.kind !== 'LinkedField') {
    throw new Error('Expected a linked field.');
  }
  return node.selections;
}

function findLinkedHandle(
  selections: ReadonlyArray<NormalizationSelection>,
): NormalizationLinkedHandle {
  for (let ii = 0; ii < selections.length; ii++) {
    const selection = selections[ii];
    if (selection.kind === 'LinkedHandle') {
      return selection;
    }
  }
  throw new Error('Expected a linked handle.');
}

function findScalarHandle(
  selections: ReadonlyArray<NormalizationSelection>,
): NormalizationScalarHandle {
  for (let ii = 0; ii < selections.length; ii++) {
    const selection = selections[ii];
    if (selection.kind === 'ScalarHandle') {
      return selection;
    }
  }
  throw new Error('Expected a scalar handle.');
}

describe('storage keys of fields without arguments', () => {
  it('the compiler emits a static storageKey only for fields with arguments', () => {
    // Artifacts are required to read their ASTs; the ones that require
    // non-artifact modules (resolvers, providers, test files defining tests)
    // are skipped, with every artifact they reach.
    const dir = path.join(path.dirname(module.filename), '__generated__');
    const sources = new Map<string, string>();
    fs.readdirSync(dir)
      .filter(file => file.endsWith('.graphql.js'))
      .forEach(file => {
        sources.set(file, fs.readFileSync(path.join(dir, file), 'utf8'));
      });
    const pure = new Map<string, boolean>();
    const isPure = (file: string, visiting: Set<string>): boolean => {
      const known = pure.get(file);
      if (known != null) {
        return known;
      }
      const source = sources.get(file);
      if (source == null) {
        return false;
      }
      if (visiting.has(file)) {
        return true;
      }
      visiting.add(file);
      const targets = Array.from(
        source.matchAll(/require\('([^']+)'\)/g),
        match => match[1],
      );
      const result = targets.every(
        target =>
          target.startsWith('./') &&
          target.endsWith('.graphql') &&
          isPure(target.slice(2) + '.js', visiting),
      );
      pure.set(file, result);
      return result;
    };
    const fields: Array<FieldKeys> = [];
    let required = 0;
    sources.forEach((_source, file) => {
      if (isPure(file, new Set())) {
        required++;
        collectFields(jest.requireActual(path.join(dir, file)), fields);
      }
    });
    expect(required).toBeGreaterThan(sources.size / 2);
    const withStorageKey = fields.filter(field => field.storageKey != null);
    expect(withStorageKey.length).toBeGreaterThan(0);
    expect(
      withStorageKey.filter(
        field => !Array.isArray(field.args) || field.args.length === 0,
      ),
    ).toEqual([]);
  });

  it('handle source fields are cloned without arguments and with their name as storage key', () => {
    // `me { address @__clientField(handle: "test") { street } }`
    const linkedSelections = selectionsOf(
      LinkedHandleQuery.operation.selections[0],
    );
    const linkedHandle = findLinkedHandle(linkedSelections);
    const linked = cloneRelayHandleSourceField(
      linkedHandle,
      linkedSelections,
      {},
    );
    expect(linked.args).toBe(null);
    expect(linked.storageKey).toBe(linked.name);
    expect(linked.name).toBe(
      getRelayHandleKey(
        linkedHandle.handle,
        linkedHandle.key,
        linkedHandle.name,
      ),
    );

    // `me { address { street @__clientField(handle: "test") } }`
    const addressSelections = selectionsOf(
      selectionsOf(ScalarHandleQuery.operation.selections[0])[0],
    );
    const scalarHandle = findScalarHandle(addressSelections);
    const scalar = cloneRelayScalarHandleSourceField(
      scalarHandle,
      addressSelections,
      {},
    );
    expect(scalar.args).toBe(null);
    expect(scalar.storageKey).toBe(scalar.name);
    expect(scalar.name).toBe(
      getRelayHandleKey(
        scalarHandle.handle,
        scalarHandle.key,
        scalarHandle.name,
      ),
    );
  });
});
