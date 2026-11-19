/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 * @jest-environment jsdom
 */

'use strict';

import type {GraphQLResponse} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {RequestParameters} from 'relay-runtime/util/RelayConcreteNode';
import type {
  CacheConfig,
  Variables,
} from 'relay-runtime/util/RelayRuntimeTypes';

const useFragment = require('../useFragment');
const useLazyLoadQuery = require('../useLazyLoadQuery');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const ReactRelayContext = require('react-relay/ReactRelayContext');
const {
  Environment,
  Network,
  RecordSource,
  Store,
  graphql,
} = require('relay-runtime');
const RelayObservable = require('relay-runtime/network/RelayObservable');
const RelayFeatureFlags = require('relay-runtime/util/RelayFeatureFlags');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

const FragmentArtifact = graphql`
  fragment useFragmentWithDeferAndLiveUpdateTestFragment on User
  @throwOnFieldError {
    name
  }
`;

const QueryArtifact = graphql`
  query useFragmentWithDeferAndLiveUpdateTestQuery($id: ID!) {
    node(id: $id) {
      __typename
      id
      ...useFragmentWithDeferAndLiveUpdateTestFragment
        @defer
        @dangerously_unaliased_fixme
    }
  }
`;

const DEFER_LABEL =
  'useFragmentWithDeferAndLiveUpdateTestQuery$defer$useFragmentWithDeferAndLiveUpdateTestFragment';

// Documents how useFragment behaves when reading a `@defer` fragment whose
// query was initiated through the standard React data-fetching path
// (useLazyLoadQuery → fetchQuery), including across a live update on the same
// observable that switches `node` to a new entity. In this path the request
// cache is populated and stays alive for the lifetime of the subscription, so
// `getPendingOperationsForFragment`'s first branch (`getPromiseForActiveRequest`)
// finds a Promise during every @defer gap — useFragment suspends through both
// the initial gap and the live-update gap. The fragment carries
// `@throwOnFieldError` so the assertion "no error caught" meaningfully proves
// suspension occurred (without it a missing field would just yield null).
// Behavior is invariant across both useFragment implementations.
describe.each([
  ['useFragmentInternal_EXPERIMENTAL', true],
  ['useFragmentInternal_CURRENT', false],
])(
  'useFragment reading a @defer fragment via useLazyLoadQuery (initial + live update) [%s]',
  (_label, activityCompat) => {
    let dataSource: Sink<GraphQLResponse>;
    let environment;
    let caughtErrors: Array<Error>;

    // ErrorBoundary catches synchronous errors so the test runner sees a
    // structured assertion failure rather than a crash.
    class ErrorBoundary extends React.Component<
      {children: React.Node},
      {error: Error | null},
    > {
      state: {error: Error | null} = {error: null};
      static getDerivedStateFromError(error: Error): {error: Error} {
        return {error};
      }
      componentDidCatch(error: Error) {
        caughtErrors.push(error);
      }
      render(): React.Node {
        if (this.state.error) {
          return `Error: ${this.state.error.message}`;
        }
        return this.props.children;
      }
    }

    function FragmentReader(props: {
      userRef: $FlowFixMe,
    }): React.MixedElement | string | null {
      const data = useFragment(FragmentArtifact, props.userRef);
      return data == null ? null : (data.name ?? 'no name');
    }

    function App(): React.Node {
      const data = useLazyLoadQuery(QueryArtifact, {id: '1'});
      if (data?.node == null) {
        return null;
      }
      return <FragmentReader userRef={data.node} />;
    }

    function renderApp() {
      return ReactTestingLibrary.render(
        <ReactRelayContext.Provider value={{environment}}>
          <ErrorBoundary>
            <React.Suspense fallback="Loading…">
              <App />
            </React.Suspense>
          </ErrorBoundary>
        </ReactRelayContext.Provider>,
      );
    }

    let originalActivityCompat: boolean;
    beforeEach(() => {
      originalActivityCompat = RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY;
      RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = activityCompat;
      caughtErrors = [];

      const fetch = (
        _query: RequestParameters,
        _variables: Variables,
        _cacheConfig: CacheConfig,
      ): RelayObservable<GraphQLResponse> => {
        return RelayObservable.create<GraphQLResponse>(
          (sink: Sink<GraphQLResponse>) => {
            dataSource = sink;
          },
        );
      };

      environment = new Environment({
        network: Network.create(fetch),
        store: new Store(new RecordSource()),
      });
    });

    afterEach(() => {
      RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = originalActivityCompat;
    });

    it('suspends during the initial @defer gap, then renders when the deferred payload arrives', async () => {
      // useLazyLoadQuery starts the query → fetchQuery populates the
      // request cache → useLazyLoadQuery suspends until the query has
      // produced data.
      let renderer;
      await act(() => {
        renderer = renderApp();
      });
      expect(renderer?.container.textContent).toBe('Loading…');

      // Initial non-final payload — `node` is now present but the deferred
      // fragment data is still pending. useLazyLoadQuery resumes; useFragment
      // reads the fragment, sees missing data, and finds the operation via
      // the request cache (first branch of getPendingOperationsForFragment)
      // → suspends.
      await act(async () => {
        dataSource.next({
          data: {node: {id: '1', __typename: 'User'}},
        });
      });
      expect(caughtErrors).toEqual([]);
      expect(renderer?.container.textContent).toBe('Loading…');

      // Deferred final arrives → fragment data is complete → renders.
      await act(async () => {
        dataSource.next({
          data: {id: '1', __typename: 'User', name: 'Alice'},
          label: DEFER_LABEL,
          path: ['node'],
          extensions: {is_final: true},
        });
      });
      expect(caughtErrors).toEqual([]);
      expect(renderer?.container.textContent).toBe('Alice');
    });

    it('suspends during the @defer gap of a live update on a new entity, then renders when its deferred payload arrives', async () => {
      // Phase 1: complete the initial round.
      let renderer;
      await act(() => {
        renderer = renderApp();
      });
      await act(async () => {
        dataSource.next({
          data: {node: {id: '1', __typename: 'User'}},
        });
        dataSource.next({
          data: {id: '1', __typename: 'User', name: 'Alice'},
          label: DEFER_LABEL,
          path: ['node'],
          extensions: {is_final: true},
        });
      });
      expect(renderer?.container.textContent).toBe('Alice');

      // Phase 2: live update on the same observable — the server pushes a
      // payload that switches `node` to a new entity. The OperationExecutor
      // re-enters loading_incremental because the new payload is non-final
      // and has @defer placeholders. useLazyLoadQuery re-renders with the
      // new fragment ref pointing to User:2 (no name yet). useFragment
      // finds the operation via the request cache (the cache entry persists
      // for the live observable) and suspends.
      await act(async () => {
        dataSource.next({
          data: {node: {id: '2', __typename: 'User'}},
        });
      });
      expect(caughtErrors).toEqual([]);
      expect(renderer?.container.textContent).toBe('Loading…');

      // Phase 3: deferred final for User:2 arrives → renders.
      await act(async () => {
        dataSource.next({
          data: {id: '2', __typename: 'User', name: 'Bob'},
          label: DEFER_LABEL,
          path: ['node'],
          extensions: {is_final: true},
        });
      });
      expect(caughtErrors).toEqual([]);
      expect(renderer?.container.textContent).toBe('Bob');
    });
  },
);
