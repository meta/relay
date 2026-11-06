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

import type {ReactRelayQueryRendererContext as ReactRelayQueryRendererContextType} from './ReactRelayQueryRendererContext';
import type {
  CacheConfig,
  GraphQLTaggedNode,
  IEnvironment,
  RelayContext,
  RequestParameters,
  Snapshot,
  Variables,
} from 'relay-runtime';

const ReactRelayContext = require('./ReactRelayContext');
const ReactRelayQueryFetcher = require('./ReactRelayQueryFetcher');
const ReactRelayQueryRendererContext = require('./ReactRelayQueryRendererContext');
const areEqual = require('areEqual');
const React = require('react');
const {
  createOperationDescriptor,
  deepFreeze,
  getRequest,
} = require('relay-runtime');

type RetryCallbacks = {
  handleDataChange:
    null | ((v: {error?: Error, snapshot?: Snapshot, ...}) => void),
  handleRetryAfterError: null | ((error: Error) => void),
};

export type RenderProps<T> = {
  error: ?Error,
  props: ?T,
  retry: ?(cacheConfigOverride?: CacheConfig) => void,
};
/**
 * React may double-fire the constructor, and we call 'fetch' in the
 * constructor. If a request is already in flight from a previous call to the
 * constructor, just reuse the query fetcher and wait for the response.
 */
const requestCache: {
  [key: string]: void | {
    queryFetcher: ReactRelayQueryFetcher,
    snapshot: ?Snapshot,
  },
} = {};

const queryRendererContext: ReactRelayQueryRendererContextType = {
  rootIsQueryRenderer: true,
};

export type Props = Readonly<{
  cacheConfig?: ?CacheConfig,
  fetchPolicy?: 'store-and-network' | 'network-only',
  environment: IEnvironment,
  query: ?GraphQLTaggedNode,
  render: (renderProps: RenderProps<any>) => React.Node,
  variables: Variables,
}>;

type State = {
  error: Error | null,
  prevPropsEnvironment: IEnvironment,
  prevPropsVariables: Variables,
  prevQuery: ?GraphQLTaggedNode,
  queryFetcher: ReactRelayQueryFetcher,
  relayContext: RelayContext,
  renderProps: RenderProps<any>,
  retryCallbacks: RetryCallbacks,
  requestCacheKey: ?string,
  snapshot: Snapshot | null,
};

/**
 * @public
 *
 * Orchestrates fetching and rendering data for a single view or view hierarchy:
 * - Fetches the query/variables using the given network implementation.
 * - Normalizes the response(s) to that query, publishing them to the given
 *   store.
 * - Renders the pending/fail/success states with the provided render function.
 * - Subscribes for updates to the root data and re-renders with any changes.
 */
class ReactRelayQueryRenderer extends React.Component<Props, State> {
  _maybeHiddenOrFastRefresh: boolean;

  constructor(props: Props) {
    super(props);

    // Callbacks are attached to the current instance and shared with static
    // lifecyles by bundling with state. This is okay to do because the
    // callbacks don't change in reaction to props. However we should not
    // "leak" them before mounting (since we would be unable to clean up). For
    // that reason, we define them as null initially and fill them in after
    // mounting to avoid leaking memory.
    const retryCallbacks: RetryCallbacks = {
      handleDataChange: null,
      handleRetryAfterError: null,
    };

    let queryFetcher;
    let requestCacheKey;
    if (props.query) {
      const {query} = props;

      const request = getRequest(query);
      requestCacheKey = getRequestCacheKey(request.params, props.variables);
      queryFetcher = requestCache[requestCacheKey]
        ? requestCache[requestCacheKey].queryFetcher
        : new ReactRelayQueryFetcher();
    } else {
      queryFetcher = new ReactRelayQueryFetcher();
    }

    this._maybeHiddenOrFastRefresh = false;

    // $FlowFixMe[incompatible-type]
    this.state = {
      prevPropsEnvironment: props.environment,
      prevPropsVariables: props.variables,
      prevQuery: props.query,
      queryFetcher,
      retryCallbacks,
      ...fetchQueryAndComputeStateFromProps(
        props,
        queryFetcher,
        retryCallbacks,
        requestCacheKey,
      ),
    };
  }

  static getDerivedStateFromProps(
    nextProps: Props,
    prevState: State,
  ): Partial<State> | null {
    if (
      prevState.prevQuery !== nextProps.query ||
      prevState.prevPropsEnvironment !== nextProps.environment ||
      !areEqual(prevState.prevPropsVariables, nextProps.variables)
    ) {
      return resetQueryStateForUpdate(nextProps, prevState);
    }
    return null;
  }

  componentDidMount() {
    if (this._maybeHiddenOrFastRefresh === true) {
      // This block only runs if the component has previously "unmounted"
      // due to it being hidden by the Offscreen API, or during fast refresh.
      // At this point, the current cached resource will have been disposed
      // by the previous cleanup, so instead of attempting to
      // do our regular commit setup, so that the query is re-evaluated
      // (and potentially cause a refetch).
      this._maybeHiddenOrFastRefresh = false;
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState(prevState => {
        const newState = resetQueryStateForUpdate(this.props, prevState);
        const {requestCacheKey, queryFetcher} = newState;
        if (requestCacheKey != null && requestCache[requestCacheKey] != null) {
          // $FlowFixMe[incompatible-use]
          queryFetcher.setOnDataChange(this._handleDataChange);
        }
        return newState;
      });
      return;
    }

    const {retryCallbacks, queryFetcher, requestCacheKey} = this.state;
    // We don't need to cache the request after the component commits
    if (requestCacheKey) {
      delete requestCache[requestCacheKey];
    }

    retryCallbacks.handleDataChange = this._handleDataChange;

    retryCallbacks.handleRetryAfterError = (error: Error) =>
      this.setState(prevState => {
        const {requestCacheKey: prevRequestCacheKey} = prevState;
        if (prevRequestCacheKey) {
          delete requestCache[prevRequestCacheKey];
        }

        return {
          renderProps: getLoadingRenderProps(),
          requestCacheKey: null,
        };
      });

    // Re-initialize the ReactRelayQueryFetcher with callbacks.
    // If data has changed since constructions, this will re-render.
    if (this.props.query) {
      queryFetcher.setOnDataChange(this._handleDataChange);
    }
  }

  componentDidUpdate(_prevProps: Props, prevState: State): void {
    // We don't need to cache the request after the component commits
    const {queryFetcher, requestCacheKey} = this.state;
    if (requestCacheKey) {
      delete requestCache[requestCacheKey];
      // HACK
      delete this.state.requestCacheKey;
    }

    if (this.props.query && queryFetcher !== prevState.queryFetcher) {
      queryFetcher.setOnDataChange(this._handleDataChange);
    }
  }

  componentWillUnmount(): void {
    this.state.queryFetcher.dispose();
    this._maybeHiddenOrFastRefresh = true;
  }

  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    return (
      nextProps.render !== this.props.render ||
      nextState.renderProps !== this.state.renderProps
    );
  }

  _handleDataChange = (params: {
    error?: Error,
    snapshot?: Snapshot,
    ...
  }): void => {
    const error = params.error == null ? null : params.error;
    const snapshot = params.snapshot == null ? null : params.snapshot;

    this.setState(prevState => {
      const {requestCacheKey: prevRequestCacheKey} = prevState;
      if (prevRequestCacheKey) {
        delete requestCache[prevRequestCacheKey];
      }

      // Don't update state if nothing has changed.
      if (snapshot === prevState.snapshot && error === prevState.error) {
        return null;
      }
      return {
        renderProps: getRenderProps(
          error,
          snapshot,
          prevState.queryFetcher,
          prevState.retryCallbacks,
        ),
        snapshot,
        requestCacheKey: null,
      };
    });
  };

  render(): React.MixedElement {
    const {renderProps, relayContext} = this.state;
    // Note that the root fragment results in `renderProps.props` is already
    // frozen by the store; this call is to freeze the renderProps object and
    // error property if set.
    if (__DEV__) {
      deepFreeze(renderProps);
    }

    return (
      <ReactRelayContext.Provider value={relayContext}>
        <ReactRelayQueryRendererContext.Provider value={queryRendererContext}>
          {this.props.render(renderProps)}
        </ReactRelayQueryRendererContext.Provider>
      </ReactRelayContext.Provider>
    );
  }
}

function getLoadingRenderProps(): RenderProps<any> {
  return {
    error: null,
    props: null, // `props: null` indicates that the data is being fetched (i.e. loading)
    retry: null,
  };
}

function getEmptyRenderProps(): RenderProps<any> {
  return {
    error: null,
    props: {}, // `props: {}` indicates no data available
    retry: null,
  };
}

function getRenderProps(
  error: ?Error,
  snapshot: ?Snapshot,
  queryFetcher: ReactRelayQueryFetcher,
  retryCallbacks: RetryCallbacks,
): RenderProps<any> {
  return {
    error: error ? error : null,
    props: snapshot ? snapshot.data : null,
    retry: (cacheConfigOverride?: CacheConfig) => {
      const syncSnapshot = queryFetcher.retry(cacheConfigOverride);
      if (
        syncSnapshot &&
        typeof retryCallbacks.handleDataChange === 'function'
      ) {
        retryCallbacks.handleDataChange({snapshot: syncSnapshot});
      } else if (
        error &&
        typeof retryCallbacks.handleRetryAfterError === 'function'
      ) {
        // If retrying after an error and no synchronous result available,
        // reset the render props
        retryCallbacks.handleRetryAfterError(error);
      }
    },
  };
}

function getRequestCacheKey(
  request: RequestParameters,
  variables: Variables,
): string {
  return JSON.stringify({
    id: request.cacheID ? request.cacheID : request.id,
    variables,
  });
}

function resetQueryStateForUpdate(
  props: Props,
  prevState: State,
): Partial<State> {
  const {query} = props;

  const prevSelectionReferences =
    prevState.queryFetcher.getSelectionReferences();
  prevState.queryFetcher.disposeRequest();

  let queryFetcher;
  if (query) {
    const request = getRequest(query);
    const requestCacheKey = getRequestCacheKey(request.params, props.variables);
    queryFetcher = requestCache[requestCacheKey]
      ? requestCache[requestCacheKey].queryFetcher
      : new ReactRelayQueryFetcher(prevSelectionReferences);
  } else {
    queryFetcher = new ReactRelayQueryFetcher(prevSelectionReferences);
  }
  return {
    prevQuery: props.query,
    prevPropsEnvironment: props.environment,
    prevPropsVariables: props.variables,
    queryFetcher: queryFetcher,
    ...fetchQueryAndComputeStateFromProps(
      props,
      queryFetcher,
      prevState.retryCallbacks,
      // passing no requestCacheKey will cause it to be recalculated internally
      // and we want the updated requestCacheKey, since variables may have changed
    ),
  };
}

function fetchQueryAndComputeStateFromProps(
  props: Props,
  queryFetcher: ReactRelayQueryFetcher,
  retryCallbacks: RetryCallbacks,
  requestCacheKey: ?string,
): Partial<State> {
  const {environment, query, variables, cacheConfig} = props;
  const genericEnvironment: IEnvironment = environment;
  if (query) {
    const request = getRequest(query);
    const operation = createOperationDescriptor(
      request,
      variables,
      cacheConfig,
    );
    const relayContext: RelayContext = {
      environment: genericEnvironment,
    };
    if (typeof requestCacheKey === 'string' && requestCache[requestCacheKey]) {
      // This same request is already in flight.

      const {snapshot} = requestCache[requestCacheKey];
      if (snapshot) {
        // Use the cached response
        return {
          error: null,
          relayContext,
          renderProps: getRenderProps(
            null,
            snapshot,
            queryFetcher,
            retryCallbacks,
          ),
          snapshot,
          requestCacheKey,
        };
      } else {
        // Render loading state
        return {
          error: null,
          relayContext,
          renderProps: getLoadingRenderProps(),
          snapshot: null,
          requestCacheKey,
        };
      }
    }

    try {
      const storeSnapshot = queryFetcher.lookupInStore(
        genericEnvironment,
        operation,
        props.fetchPolicy,
      );
      const querySnapshot = queryFetcher.fetch({
        environment: genericEnvironment,
        onDataChange: null,
        operation,
      });

      // Use network data first, since it may be fresher
      const snapshot = querySnapshot || storeSnapshot;

      // cache the request to avoid duplicate requests
      requestCacheKey =
        requestCacheKey || getRequestCacheKey(request.params, props.variables);
      requestCache[requestCacheKey] = {queryFetcher, snapshot};

      if (!snapshot) {
        return {
          error: null,
          relayContext,
          renderProps: getLoadingRenderProps(),
          snapshot: null,
          requestCacheKey,
        };
      }

      return {
        error: null,
        relayContext,

        renderProps: getRenderProps(
          null,
          snapshot,
          queryFetcher,
          retryCallbacks,
        ),
        snapshot,
        requestCacheKey,
      };
    } catch (error) {
      return {
        error,
        relayContext,
        renderProps: getRenderProps(error, null, queryFetcher, retryCallbacks),
        snapshot: null,
        requestCacheKey,
      };
    }
  } else {
    queryFetcher.dispose();
    const relayContext: RelayContext = {
      environment: genericEnvironment,
    };
    return {
      error: null,
      relayContext,
      renderProps: getEmptyRenderProps(),
      requestCacheKey: null, // if there is an error, don't cache request
    };
  }
}

module.exports = ReactRelayQueryRenderer;
