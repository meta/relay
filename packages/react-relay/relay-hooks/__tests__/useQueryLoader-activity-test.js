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

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const usePreloadedQuery = require('../usePreloadedQuery');
const useQueryLoader = require('../useQueryLoader');
const gqlQuery = require('./__generated__/usePreloadedQueryTestQuery.graphql');
const {act, cleanup, render} = require('@testing-library/react');
const React = require('react');
const {
  RecordSource,
  RelayFeatureFlags,
  Store,
  createOperationDescriptor,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');
const {
  disallowWarnings,
  expectWarningWillFire,
} = require('relay-test-utils-internal');

// $FlowFixMe[missing-export] Not yet available in the OSS Flow types.
const Activity = React.unstable_Activity;

const CLEANUP_TIMEOUT = 5 * 60 * 1000;
const DISPOSED_WARNING =
  'usePreloadedQuery(): Expected preloadedQuery to not be disposed yet. ' +
  'This is because disposing the query marks it for future garbage ' +
  'collection, and as such query results may no longer be present in the ' +
  'Relay store. In the future, this will become a hard error.';

disallowWarnings();

let environment;
let gcSteps: Array<() => void>;
let originalActivityCompatibility;
let setMode;
let queryRef: any;
let loadQuery;
let renders: Array<string>;

function Page({preloadedQuery}: {preloadedQuery: any}) {
  const data: any = usePreloadedQuery(gqlQuery, preloadedQuery);
  const name = data.node?.name ?? 'missing';
  renders.push(name);
  return name;
}

function Route() {
  const [ref, load] = useQueryLoader(gqlQuery);
  queryRef = ref;
  loadQuery = load;
  return ref == null ? null : <Page preloadedQuery={ref} />;
}

function App() {
  const [mode, updateMode] = React.useState('visible');
  setMode = updateMode;
  return (
    // $FlowFixMe[incompatible-type]
    // $FlowFixMe[not-a-component]
    <Activity mode={mode}>
      <Route />
    </Activity>
  );
}

function resolve(id: string, name: string) {
  environment.mock.resolveMostRecentOperation({
    data: {node: {__typename: 'User', id, name}},
  });
}

beforeEach(() => {
  originalActivityCompatibility =
    RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY;
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = true;
  gcSteps = [];
  renders = [];
  environment = createMockEnvironment({
    store: new Store(new RecordSource(), {
      gcReleaseBufferSize: 0,
      gcScheduler: step => {
        gcSteps.push(step);
      },
    }),
  });
});

afterEach(() => {
  cleanup();
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY =
    originalActivityCompatibility;
});

async function renderApp() {
  const instance = render(
    <RelayEnvironmentProvider environment={environment}>
      <React.Suspense fallback="Fallback">
        <App />
      </React.Suspense>
    </RelayEnvironmentProvider>,
  );
  await act(() => loadQuery({id: '1'}));
  await act(() => resolve('1', 'Alice'));
  expect(instance.container.textContent).toBe('Alice');
  return instance;
}

it('reloads a query released while hidden past the cleanup timeout', async () => {
  const instance = await renderApp();
  const operation = createOperationDescriptor(gqlQuery, {id: '1'});
  const hiddenRef = queryRef;

  await act(() => setMode('hidden'));
  await act(() => jest.advanceTimersByTime(CLEANUP_TIMEOUT));
  await act(() => {
    while (gcSteps.length > 0) {
      gcSteps.shift()?.();
    }
  });
  expect(environment.check(operation).status).toBe('missing');
  renders = [];

  // The revealed tree renders once with the released reference before the
  // loader's effect replaces it.
  expectWarningWillFire(DISPOSED_WARNING);
  await act(() => setMode('visible'));
  expect(queryRef).not.toBe(hiddenRef);
  expect(queryRef?.isDisposed).toBe(false);
  expect(environment.mock.getAllOperations()).toHaveLength(1);

  await act(() => resolve('1', 'Bob'));
  expect(instance.container.textContent).toBe('Bob');
  expect(environment.check(operation).status).toBe('available');
  expect(renders).not.toContain('missing');
});

it('keeps the query reference when revealed before the cleanup timeout', async () => {
  const instance = await renderApp();
  const hiddenRef = queryRef;

  await act(() => setMode('hidden'));
  await act(() => jest.advanceTimersByTime(CLEANUP_TIMEOUT - 1));
  await act(() => setMode('visible'));

  expect(queryRef).toBe(hiddenRef);
  expect(queryRef?.isDisposed).toBe(false);
  expect(environment.mock.getAllOperations()).toHaveLength(0);
  expect(instance.container.textContent).toBe('Alice');
});

it('releases each replaced query reference once', async () => {
  await renderApp();
  const firstRef = queryRef;
  const releaseQuery = jest.spyOn(firstRef, 'releaseQuery');

  await act(() => loadQuery({id: '2'}));
  await act(() => resolve('2', 'Bob'));
  await act(() => loadQuery({id: '3'}));
  await act(() => resolve('3', 'Carol'));

  expect(releaseQuery).toHaveBeenCalledTimes(1);
});

it('does not render missing data from a released query reference', async () => {
  await renderApp();
  const operation = createOperationDescriptor(gqlQuery, {id: '1'});
  const releasedRef = queryRef;
  cleanup();
  releasedRef.releaseQuery();
  while (gcSteps.length > 0) {
    gcSteps.shift()?.();
  }
  expect(environment.check(operation).status).toBe('missing');
  renders = [];

  expectWarningWillFire(DISPOSED_WARNING, {count: 2});
  const instance = render(
    <RelayEnvironmentProvider environment={environment}>
      <React.Suspense fallback="Fallback">
        <Page preloadedQuery={releasedRef} />
      </React.Suspense>
    </RelayEnvironmentProvider>,
  );
  expect(instance.container.textContent).toBe('Fallback');
  expect(renders).toEqual([]);
  expect(environment.mock.getAllOperations()).toHaveLength(1);
});
