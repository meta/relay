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

import type {GeneratedNodeMap} from './ReactRelayTypes';
import type {FragmentMap, ReaderFragment} from 'relay-runtime';

const assertFragmentMap = require('./assertFragmentMap');
const {
  getComponentName,
  getContainerName,
} = require('./ReactRelayContainerUtils');
const ReactRelayContext = require('./ReactRelayContext');
const ReactRelayQueryRendererContext = require('./ReactRelayQueryRendererContext');
const invariant = require('invariant');
const React = require('react');
const {getFragment} = require('relay-runtime');

const {useContext} = React;

type ContainerCreator = (
  Component: component(...any),
  fragments: FragmentMap,
) => component(...any);

/**
 * Helper to create the Relay HOCs with ref forwarding, setting the displayName
 * and reading the React context.
 */
function buildReactRelayContainer<TBase extends component(...empty)>(
  ComponentClass: TBase,
  fragmentSpec: GeneratedNodeMap,
  createContainerWithFragments: ContainerCreator,
): TBase {
  // Sanity-check user-defined fragment input
  const containerName = getContainerName(ComponentClass);
  assertFragmentMap(getComponentName(ComponentClass), fragmentSpec);

  const fragments: {[string]: ReaderFragment} = {};
  for (const key in fragmentSpec) {
    fragments[key] = getFragment(fragmentSpec[key]);
  }
  const Container = createContainerWithFragments(ComponentClass, fragments);
  Container.displayName = containerName;

  function ForwardRef(
    props: any,
    ref:
      | ((v: null | React.ElementRef<TBase>) => unknown)
      | {writeonly current: null | React.ElementRef<TBase>, ...},
  ) {
    // $FlowFixMe[react-rule-hook]
    const context = useContext(ReactRelayContext);
    invariant(
      context != null,
      '`%s` tried to render a context that was not valid this means that ' +
        '`%s` was rendered outside of a query renderer.',
      containerName,
      containerName,
    );
    // $FlowFixMe[react-rule-hook]
    const queryRendererContext = useContext(ReactRelayQueryRendererContext);

    return (
      <Container
        {...props}
        __relayContext={context}
        __rootIsQueryRenderer={
          queryRendererContext?.rootIsQueryRenderer ?? false
        }
        componentRef={props.componentRef || ref}
      />
    );
  }
  ForwardRef.displayName = containerName;
  const ForwardContainer = (React as $FlowFixMe).forwardRef(ForwardRef);

  if (__DEV__) {
    // Used by RelayModernTestUtils
    (ForwardContainer as any).__ComponentClass = ComponentClass;
    ForwardContainer.displayName = containerName;
  }

  // $FlowFixMe[incompatible-type]
  return ForwardContainer;
}

module.exports = buildReactRelayContainer;
