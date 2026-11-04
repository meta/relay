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
import type {$RelayProps, GeneratedNodeMap, RelayProp} from './ReactRelayTypes';
import type {
  FragmentMap,
  FragmentSpecResolver,
  IEnvironment,
  RelayContext,
} from 'relay-runtime';

const buildReactRelayContainer = require('./buildReactRelayContainer');
const {getContainerName} = require('./ReactRelayContainerUtils');
const {assertRelayContext} = require('./RelayContext');
const areEqual = require('areEqual');
const React = require('react');
const {
  createFragmentSpecResolver,
  getDataIDsFromObject,
  isScalarAndEqual,
} = require('relay-runtime');

type ContainerProps = $FlowFixMe;
type ContainerState = {
  data: {[key: string]: unknown, ...},
  prevProps: ContainerProps,
  prevPropsContext: RelayContext,
  relayProp: RelayProp,
  resolver: FragmentSpecResolver,
  ...
};

/**
 * Composes a React component class, returning a new class that intercepts
 * props, resolving them with the provided fragments and subscribing for
 * updates.
 */
function createContainerWithFragments<
  Props extends {...},
  TComponent extends component(...Props),
>(
  Component: TComponent,
  fragments: FragmentMap,
): component(...$RelayProps<Props, RelayProp>) {
  const containerName = getContainerName(Component);

  return class extends React.Component<ContainerProps, ContainerState> {
    static displayName: ?string = containerName;
    constructor(props: $FlowFixMe) {
      super(props);
      const relayContext = assertRelayContext(props.__relayContext);
      const rootIsQueryRenderer = props.__rootIsQueryRenderer ?? false;
      // Do not provide a subscription/callback here.
      // It is possible for this render to be interrupted or aborted,
      // In which case the subscription would cause a leak.
      // We will add the subscription in componentDidMount().
      const resolver = createFragmentSpecResolver(
        relayContext,
        containerName,
        fragments,
        props,
        rootIsQueryRenderer,
      );
      this.state = {
        data: resolver.resolve(),
        prevProps: props,
        prevPropsContext: relayContext,
        relayProp: getRelayProp(relayContext.environment),
        resolver,
      };
    }

    /**
     * When new props are received, read data for the new props and subscribe
     * for updates. Props may be the same in which case previous data and
     * subscriptions can be reused.
     */
    static getDerivedStateFromProps(
      nextProps: ContainerProps,
      prevState: ContainerState,
    ): Partial<ContainerState> | null {
      // Any props change could impact the query, so we mirror props in state.
      // This is an unusual pattern, but necessary for this container usecase.
      const {prevProps} = prevState;
      const relayContext = assertRelayContext(nextProps.__relayContext);
      const rootIsQueryRenderer = nextProps.__rootIsQueryRenderer ?? false;
      const prevIDs = getDataIDsFromObject(fragments, prevProps);
      const nextIDs = getDataIDsFromObject(fragments, nextProps);
      let resolver: FragmentSpecResolver = prevState.resolver;

      // If the environment has changed or props point to new records then
      // previously fetched data and any pending fetches no longer apply:
      // - Existing references are on the old environment.
      // - Existing references are based on old variables.
      // - Pending fetches are for the previous records.
      if (
        prevState.prevPropsContext.environment !== relayContext.environment ||
        !areEqual(prevIDs, nextIDs)
      ) {
        // Do not provide a subscription/callback here.
        // It is possible for this render to be interrupted or aborted,
        // In which case the subscription would cause a leak.
        // We will add the subscription in componentDidUpdate().
        resolver = createFragmentSpecResolver(
          relayContext,
          containerName,
          fragments,
          nextProps,
          rootIsQueryRenderer,
        );

        return {
          data: resolver.resolve(),
          prevProps: nextProps,
          prevPropsContext: relayContext,
          relayProp: getRelayProp(relayContext.environment),
          resolver,
        };
      } else {
        resolver.setProps(nextProps);

        const data = resolver.resolve();
        if (data !== prevState.data) {
          return {
            data,
            prevProps: nextProps,
            prevPropsContext: relayContext,
            relayProp: getRelayProp(relayContext.environment),
          };
        }
      }

      return null;
    }

    componentDidMount() {
      this._subscribeToNewResolverAndRerenderIfStoreHasChanged();
    }

    componentDidUpdate(prevProps: ContainerProps, prevState: ContainerState) {
      if (this.state.resolver !== prevState.resolver) {
        prevState.resolver.dispose();

        this._subscribeToNewResolverAndRerenderIfStoreHasChanged();
      } else {
        this._rerenderIfStoreHasChanged();
      }
    }

    componentWillUnmount() {
      this.state.resolver.dispose();
    }

    shouldComponentUpdate(
      nextProps: ContainerProps,
      nextState: ContainerState,
    ): boolean {
      // Short-circuit if any Relay-related data has changed
      if (nextState.data !== this.state.data) {
        return true;
      }
      // Otherwise, for convenience short-circuit if all non-Relay props
      // are scalar and equal
      const keys = Object.keys(nextProps);
      for (let ii = 0; ii < keys.length; ii++) {
        const key = keys[ii];
        if (key === '__relayContext') {
          if (
            nextState.prevPropsContext.environment !==
            this.state.prevPropsContext.environment
          ) {
            return true;
          }
        } else {
          if (
            !fragments.hasOwnProperty(key) &&
            !isScalarAndEqual(nextProps[key], this.props[key])
          ) {
            return true;
          }
        }
      }
      return false;
    }

    /**
     * Render new data for the existing props/context.
     */
    _handleFragmentDataUpdate = () => {
      const resolverFromThisUpdate = this.state.resolver;
      this.setState(updatedState =>
        // If this event belongs to the current data source, update.
        // Otherwise we should ignore it.
        resolverFromThisUpdate === updatedState.resolver
          ? {
              data: updatedState.resolver.resolve(),
              relayProp: getRelayProp(updatedState.relayProp.environment),
            }
          : null,
      );
    };

    _rerenderIfStoreHasChanged() {
      const {data, resolver} = this.state;
      // External values could change between render and commit.
      // Check for this case, even though it requires an extra store read.
      const maybeNewData = resolver.resolve();
      if (data !== maybeNewData) {
        this.setState({data: maybeNewData});
      }
    }

    _subscribeToNewResolverAndRerenderIfStoreHasChanged() {
      const {data, resolver} = this.state;
      const maybeNewData = resolver.resolve();

      // Event listeners are only safe to add during the commit phase,
      // So they won't leak if render is interrupted or errors.
      resolver.setCallback(this.props, this._handleFragmentDataUpdate);

      // External values could change between render and commit.
      // Check for this case, even though it requires an extra store read.
      if (data !== maybeNewData) {
        this.setState({data: maybeNewData});
      }
    }

    render(): React.Node {
      // eslint-disable-next-line no-unused-vars
      const {componentRef, __relayContext, __rootIsQueryRenderer, ...props} =
        this.props;
      return (
        <Component
          {...props}
          {...this.state.data}
          ref={componentRef}
          relay={this.state.relayProp}
        />
      );
    }
  };
}

function getRelayProp(environment: IEnvironment) {
  return {
    environment,
  };
}

/**
 * Wrap the basic `createContainer()` function with logic to adapt to the
 * `context.relay.environment` in which it is rendered. Specifically, the
 * extraction of the environment-specific version of fragments in the
 * `fragmentSpec` is memoized once per environment, rather than once per
 * instance of the container constructed/rendered.
 */
function createContainer<
  Props extends {...},
  TComponent extends component(...Props),
>(
  Component: TComponent,
  fragmentSpec: GeneratedNodeMap,
): component(...$RelayProps<Props, RelayProp>) {
  // $FlowFixMe[incompatible-type]
  return buildReactRelayContainer(
    Component,
    fragmentSpec,
    createContainerWithFragments,
  );
}

module.exports = {
  createContainer,
};
