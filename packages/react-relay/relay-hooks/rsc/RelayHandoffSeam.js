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
  IEnvironment,
  SingularReaderSelector,
  Snapshot,
} from 'relay-runtime';

type HandoffHook = hook (
  environment: IEnvironment,
  fragmentRef: unknown,
) => unknown;

hook useNoHandoff(_environment: IEnvironment, fragmentRef: unknown): unknown {
  if (__DEV__) {
    // A handed-off reference has no owner until the hook gives it one:
    // without the hook, Relay would report a missing spread.
    (Array.isArray(fragmentRef) ? fragmentRef : [fragmentRef]).forEach(ref => {
      if (
        ref != null &&
        typeof ref === 'object' &&
        ref.__handoff != null &&
        ref.__fragmentOwner == null
      ) {
        throw new Error(
          'Relay: A server component handed off this fragment reference, ' +
            'but `installRelayHandoff(environment)` ' +
            '(`react-relay/rsc-client_EXPERIMENTAL`) was not called for the ' +
            'Environment that reads it. Call it where the Environment is ' +
            'created.',
        );
      }
    });
  }
  return fragmentRef;
}

// Per Environment: the hook its readers call. The first read (by a reader or
// the RelayEnvironmentProvider that provides it) fixes it: a hook installed
// after that would change how many hooks a rendered reader calls.
const hooks: WeakMap<IEnvironment, HandoffHook> = new WeakMap();

/**
 * The hook `useFragment` passes each fragment reference through before
 * reading it from `environment`. By default it returns the reference
 * unchanged and uses no React hooks; `installRelayHandoff(environment)`
 * (`react-relay/rsc-client_EXPERIMENTAL`) installs `useRelayHandoff` for that
 * Environment, before it is first read.
 */
function getHandoffHook(environment: ?IEnvironment): HandoffHook {
  // Not every RelayEnvironmentProvider has an Environment yet (e.g. a test
  // that creates its mock later).
  if (environment == null) {
    return useNoHandoff;
  }
  let hook = hooks.get(environment);
  if (hook == null) {
    hook = useNoHandoff;
    hooks.set(environment, hook);
  }
  return hook;
}

function installHandoffHook(
  environment: IEnvironment,
  hook: HandoffHook,
): void {
  const current = hooks.get(environment);
  if (current === hook) {
    return;
  }
  if (current != null) {
    throw new Error(
      __DEV__
        ? 'Relay: installRelayHandoff(environment) must be called before the ' +
            'Environment is first provided or read from, for example where it ' +
            'is created: components that have already read from it would ' +
            'call a different number of hooks.'
        : 'Relay: Call installRelayHandoff(environment) before the ' +
            'Environment is first used.',
    );
  }
  hooks.set(environment, hook);
}

// The reads a hydrating render makes of handed-off references: a reference
// `useRelayHandoff` returned in that render maps to a lookup that reads its
// roots' own records instead of the Environment's Store.
type HydrationLookup = (selector: SingularReaderSelector) => ?Snapshot;
const hydrationLookups: WeakMap<{...}, HydrationLookup> = new WeakMap();

function setHandoffHydrationLookup(
  fragmentRef: {...},
  lookup: HydrationLookup,
): void {
  hydrationLookups.set(fragmentRef, lookup);
}

/**
 * How `useFragment` reads a reference in this render: the lookup a hydrating
 * render of handed-off references uses, or null to read the Environment's
 * Store.
 */
function getHandoffHydrationLookup(fragmentRef: unknown): ?HydrationLookup {
  return fragmentRef != null && typeof fragmentRef === 'object'
    ? hydrationLookups.get(fragmentRef)
    : null;
}

module.exports = {
  getHandoffHook,
  getHandoffHydrationLookup,
  installHandoffHook,
  setHandoffHydrationLookup,
};
