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

import type {IEnvironment} from 'relay-runtime';
import type {
  ActorIdentifier,
  IActorEnvironment,
} from 'relay-runtime/multi-actor-environment';

const ReactRelayContext = require('./../ReactRelayContext');
const {getHandoffHook} = require('./rsc/RelayHandoffSeam');
const invariant = require('invariant');
const React = require('react');

const {useMemo, useState} = React;

type Props<TChildren> = Readonly<{
  children: TChildren,
  environment: IEnvironment,
  getEnvironmentForActor?: ?(
    actorIdentifier: ActorIdentifier,
  ) => IActorEnvironment,
}>;

component RelayEnvironmentProvider<TChildren extends React.Node>(
  ...props: Props<TChildren>
) renders TChildren {
  const {children, environment, getEnvironmentForActor} = props;
  const context = useMemo(
    () => ({environment, getEnvironmentForActor}),
    [environment, getEnvironmentForActor],
  );
  // Mounted readers call their Environment's handoff hook (see
  // `installRelayHandoff`), so the Environment may change only to one with
  // the same hook: otherwise they would call a different number of hooks.
  const handoffHook = getHandoffHook(environment);
  const [initialHandoffHook] = useState(() => handoffHook);
  invariant(
    initialHandoffHook === handoffHook,
    'RelayEnvironmentProvider: The Environment changed to one that reads ' +
      'handed-off fragment references differently (`installRelayHandoff`). ' +
      'Give RelayEnvironmentProvider a new `key` to switch between them.',
  );
  return (
    <ReactRelayContext.Provider value={context}>
      {children}
    </ReactRelayContext.Provider>
  );
}

module.exports = RelayEnvironmentProvider;
