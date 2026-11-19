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

import type {NormalizationRootNode} from 'relay-runtime';

// The operation module providers of the artifacts compiled for the module
// provider tests (`config.tests.json`): each module's own provider, unless a
// test aliased the module to another one, as a provider registry with
// aliases could. Aliased modules then share one provider function.
const providers: Map<string, () => NormalizationRootNode> = new Map();
const aliases: Map<string, string> = new Map();

function operation(
  module: string,
  provider: () => NormalizationRootNode,
): () => NormalizationRootNode {
  const name = aliases.get(module) ?? module;
  const registered = providers.get(name) ?? provider;
  providers.set(name, registered);
  return registered;
}

function alias(module: string, target: string): void {
  aliases.set(module, target);
}

// What an app's operation loader does with a provider: call it.
const providerLoader = {
  get(reference: unknown): ?NormalizationRootNode {
    return Array.from(providers.values())
      .find(provider => provider === reference)
      ?.call();
  },
  load(reference: unknown): Promise<?NormalizationRootNode> {
    return Promise.resolve(providerLoader.get(reference));
  },
};

module.exports = {alias, operation, providerLoader};
