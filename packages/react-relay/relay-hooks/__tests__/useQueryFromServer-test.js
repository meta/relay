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
const serverPreloadQuery = require('../rsc/serverPreloadQuery');
const useQueryFromServer = require('../rsc/useQueryFromServer');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const {Environment, Network, RecordSource, Store} = require('relay-runtime');

function createTestConcreteRequest(name: string, fields: Array<string>): any {
  const selections = fields.map(f => ({
    alias: null,
    args: null,
    kind: 'ScalarField',
    name: f,
    storageKey: null,
  }));

  return {
    fragment: {
      argumentDefinitions: [],
      kind: 'Fragment',
      metadata: null,
      name,
      selections,
      type: 'Query',
      abstractKey: null,
    },
    kind: 'Request',
    operation: {
      argumentDefinitions: [],
      kind: 'Operation',
      name,
      selections,
    },
    params: {
      cacheID: `${name}-cache-id`,
      id: `${name}-persisted-id`,
      metadata: {},
      name,
      operationKind: 'query',
      text: null,
    },
  };
}

function createTestEnvironment(baseFetch?: any): Environment {
  const fetch = baseFetch ?? (() => Promise.resolve({data: {}}));
  return new Environment({
    network: Network.create(fetch),
    store: new Store(new RecordSource()),
  });
}

function createQueryRef(
  data: any,
  variables?: {...},
  queryId?: string,
  fetchedAt?: number,
): any {
  return {
    kind: 'PreloadedQueryRef',
    queryId: queryId ?? 'test-query-id',
    variables: variables ?? {},
    _response: Promise.resolve({data}),
    fetchedAt: fetchedAt ?? Date.now(),
  };
}

describe('useQueryFromServer', () => {
  const testQuery = createTestConcreteRequest('TestQuery', ['id', 'name']);
  let environment: Environment;

  afterEach(() => {
    ReactTestingLibrary.cleanup();
  });

  beforeEach(() => {
    environment = createTestEnvironment();
  });

  function Wrapper({children}: {children: React.Node}) {
    return (
      <React.Suspense fallback={null}>
        <RelayEnvironmentProvider environment={environment}>
          {children}
        </RelayEnvironmentProvider>
      </React.Suspense>
    );
  }

  it('reads data on first render', async () => {
    const queryRef = createQueryRef({id: '1', name: 'Alice'});

    function TestComponent() {
      const data = useQueryFromServer(testQuery, queryRef);
      return <div data-testid="result">{data.name}</div>;
    }

    await act(async () => {
      ReactTestingLibrary.render(
        <Wrapper>
          <TestComponent />
        </Wrapper>,
      );
    });

    expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
      'Alice',
    );
  });

  it('does not re-fetch on re-render', async () => {
    const baseFetch = jest.fn(() => Promise.resolve({data: {}}));
    environment = createTestEnvironment(baseFetch);
    const queryRef = createQueryRef({id: '1', name: 'Alice'});

    function TestComponent() {
      const data = useQueryFromServer(testQuery, queryRef);
      const [, setCount] = React.useState(0);
      return (
        <div>
          <div data-testid="result">{data.name}</div>
          <button
            data-testid="rerender-btn"
            onClick={() => setCount(c => c + 1)}
          />
        </div>
      );
    }

    await act(async () => {
      ReactTestingLibrary.render(
        <Wrapper>
          <TestComponent />
        </Wrapper>,
      );
    });

    await act(async () => {
      ReactTestingLibrary.fireEvent.click(
        ReactTestingLibrary.screen.getByTestId('rerender-btn'),
      );
    });
    await act(async () => {
      ReactTestingLibrary.fireEvent.click(
        ReactTestingLibrary.screen.getByTestId('rerender-btn'),
      );
    });

    expect(baseFetch).not.toHaveBeenCalled();
    expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
      'Alice',
    );
  });

  it('fetches from network when response.data is null', async () => {
    const baseFetch = jest.fn(() =>
      Promise.resolve({data: {id: '1', name: 'Fetched'}}),
    );
    environment = createTestEnvironment(baseFetch);
    const queryRef = createQueryRef(null);

    function TestComponent() {
      const data = useQueryFromServer(testQuery, queryRef);
      return <div data-testid="result">{data.name}</div>;
    }

    await act(async () => {
      ReactTestingLibrary.render(
        <Wrapper>
          <TestComponent />
        </Wrapper>,
      );
    });

    expect(baseFetch).toHaveBeenCalled();
    expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
      'Fetched',
    );
  });

  it('reads fresh data from a new queryRef object', async () => {
    const now = Date.now();
    const queryRef1 = createQueryRef(
      {id: '1', name: 'Alice'},
      {},
      'test-query-id',
      now,
    );
    const queryRef2 = createQueryRef(
      {id: '2', name: 'Bob'},
      {},
      'test-query-id',
      now + 1,
    );

    function TestComponent({queryRef}: any) {
      const data = useQueryFromServer(testQuery, queryRef);
      return <div data-testid="result">{data.name}</div>;
    }

    await act(async () => {
      ReactTestingLibrary.render(
        <Wrapper>
          <TestComponent queryRef={queryRef1} />
        </Wrapper>,
      );
    });
    expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
      'Alice',
    );

    ReactTestingLibrary.cleanup();

    await act(async () => {
      ReactTestingLibrary.render(
        <Wrapper>
          <TestComponent queryRef={queryRef2} />
        </Wrapper>,
      );
    });
    expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
      'Bob',
    );
  });

  it('deduplicates across multiple component instances with same queryRef', async () => {
    const baseFetch = jest.fn(() => Promise.resolve({data: {}}));
    environment = createTestEnvironment(baseFetch);
    const queryRef = createQueryRef({id: '1', name: 'Alice'});

    function TestComponent({testId}: {testId: string}) {
      const data = useQueryFromServer(testQuery, queryRef);
      return <div data-testid={testId}>{data.name}</div>;
    }

    await act(async () => {
      ReactTestingLibrary.render(
        <Wrapper>
          <div>
            <TestComponent testId="instance-a" />
            <TestComponent testId="instance-b" />
          </div>
        </Wrapper>,
      );
    });

    expect(baseFetch).not.toHaveBeenCalled();
    expect(
      ReactTestingLibrary.screen.getByTestId('instance-a').textContent,
    ).toBe('Alice');
    expect(
      ReactTestingLibrary.screen.getByTestId('instance-b').textContent,
    ).toBe('Alice');
  });

  it('retains query data in the store', async () => {
    const retainSpy = jest.spyOn(environment, 'retain');
    const queryRef = createQueryRef({id: '1', name: 'Alice'});

    function TestComponent() {
      useQueryFromServer(testQuery, queryRef);
      return null;
    }

    await act(async () => {
      ReactTestingLibrary.render(
        <Wrapper>
          <TestComponent />
        </Wrapper>,
      );
    });

    expect(retainSpy).toHaveBeenCalled();
  });

  it('does not overwrite store mutations when a second component mounts with the same queryRef', async () => {
    const queryRef = createQueryRef({id: '1', name: 'Alice'});

    function TestComponent({testId}: {testId: string}) {
      const data = useQueryFromServer(testQuery, queryRef);
      return <div data-testid={testId}>{data.name}</div>;
    }

    function Parent() {
      const [showB, setShowB] = React.useState(false);
      return (
        <div>
          <TestComponent testId="card-a" />
          {showB ? <TestComponent testId="card-b" /> : null}
          <button data-testid="show-b" onClick={() => setShowB(true)} />
        </div>
      );
    }

    const ref: any = {current: null};
    await act(async () => {
      ref.current = ReactTestingLibrary.render(
        <React.StrictMode>
          <React.Suspense fallback={null}>
            <RelayEnvironmentProvider environment={environment}>
              <Parent />
            </RelayEnvironmentProvider>
          </React.Suspense>
        </React.StrictMode>,
      );
    });
    const {getByTestId} = ref.current;

    expect(getByTestId('card-a').textContent).toBe('Alice');

    act(() => {
      environment.commitUpdate(store => {
        const root = store.getRoot();
        root.setValue('Mutated', 'name');
      });
    });

    expect(getByTestId('card-a').textContent).toBe('Mutated');

    await act(async () => {
      ReactTestingLibrary.fireEvent.click(getByTestId('show-b'));
    });

    expect(getByTestId('card-b').textContent).toBe('Mutated');
    expect(getByTestId('card-a').textContent).toBe('Mutated');
  });

  it('does not refetch when Card B mounts after staleness threshold with same queryRef', async () => {
    const networkFetch = jest.fn(() =>
      Promise.resolve({data: {id: '1', name: 'NetworkData'}}),
    );
    environment = createTestEnvironment(networkFetch);

    const serverTime = Date.now();
    const queryRef = createQueryRef(
      {id: '1', name: 'Alice'},
      {},
      'test-query-id',
      serverTime,
    );

    function TestComponent({testId}: {testId: string}) {
      const data = useQueryFromServer(testQuery, queryRef);
      return <div data-testid={testId}>{data.name}</div>;
    }

    function Parent() {
      const [showB, setShowB] = React.useState(false);
      return (
        <div>
          <TestComponent testId="card-a" />
          {showB ? <TestComponent testId="card-b" /> : null}
          <button data-testid="show-b" onClick={() => setShowB(true)} />
        </div>
      );
    }

    const ref: any = {current: null};
    await act(async () => {
      ref.current = ReactTestingLibrary.render(
        <React.StrictMode>
          <React.Suspense fallback={null}>
            <RelayEnvironmentProvider environment={environment}>
              <Parent />
            </RelayEnvironmentProvider>
          </React.Suspense>
        </React.StrictMode>,
      );
    });
    const {getByTestId} = ref.current;

    expect(getByTestId('card-a').textContent).toBe('Alice');
    expect(networkFetch).not.toHaveBeenCalled();

    act(() => {
      environment.commitUpdate(store => {
        const root = store.getRoot();
        root.setValue('Mutated', 'name');
      });
    });
    expect(getByTestId('card-a').textContent).toBe('Mutated');

    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(serverTime + 60_000);

    await act(async () => {
      ReactTestingLibrary.fireEvent.click(getByTestId('show-b'));
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(getByTestId('card-b').textContent).toBe('Mutated');
    expect(getByTestId('card-a').textContent).toBe('Mutated');

    dateNowSpy.mockRestore();
  });

  it('publishes during render but defers the notify to commit', async () => {
    const notifySpy = jest.spyOn(environment.getStore(), 'notify');
    const queryRef = createQueryRef({id: '1', name: 'Alice'});

    let notifyCallsAtFirstRender = null;

    function TestComponent() {
      const data = useQueryFromServer(testQuery, queryRef);
      if (notifyCallsAtFirstRender == null) {
        notifyCallsAtFirstRender = notifySpy.mock.calls.length;
      }
      return <div data-testid="result">{data.name}</div>;
    }

    await act(async () => {
      ReactTestingLibrary.render(
        <React.Suspense fallback={null}>
          <RelayEnvironmentProvider environment={environment}>
            <TestComponent />
          </RelayEnvironmentProvider>
        </React.Suspense>,
      );
    });

    // Notifying during render would be a setState during render, so the hook
    // holds the continuation and flushes it from a layout effect instead --
    // late enough to be out of render, early enough to be before paint.
    expect(notifyCallsAtFirstRender).toBe(0);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
      'Alice',
    );

    notifySpy.mockRestore();
  });

  describe('staleness', () => {
    it('triggers client refetch when data is stale', async () => {
      const networkFetch = jest.fn(() =>
        Promise.resolve({data: {id: '1', name: 'Refreshed'}}),
      );
      environment = createTestEnvironment(networkFetch);
      const staleRef = createQueryRef(
        {id: '1', name: 'Alice'},
        {},
        'test-query-id',
        Date.now() - 60_000,
      );

      function TestComponent() {
        const data = useQueryFromServer(testQuery, staleRef);
        return <div data-testid="result">{data.name}</div>;
      }

      await act(async () => {
        ReactTestingLibrary.render(
          <Wrapper>
            <TestComponent />
          </Wrapper>,
        );
      });

      expect(networkFetch).toHaveBeenCalled();
      expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
        'Refreshed',
      );
    });

    it('respects custom staleThresholdMs', async () => {
      const networkFetch = jest.fn(() =>
        Promise.resolve({data: {id: '1', name: 'Refreshed'}}),
      );
      environment = createTestEnvironment(networkFetch);
      const staleRef = createQueryRef(
        {id: '1', name: 'Alice'},
        {},
        'test-query-id',
        Date.now() - 10_000,
      );

      function TestComponent() {
        const data = useQueryFromServer(testQuery, staleRef, {
          staleThresholdMs: 5_000,
        });
        return <div data-testid="result">{data.name}</div>;
      }

      await act(async () => {
        ReactTestingLibrary.render(
          <Wrapper>
            <TestComponent />
          </Wrapper>,
        );
      });

      expect(networkFetch).toHaveBeenCalled();
    });

    it('refetches stale data even when the store already has data from a fresh queryRef', async () => {
      const networkFetch = jest.fn(() =>
        Promise.resolve({data: {id: '1', name: 'NetworkRefreshed'}}),
      );
      environment = createTestEnvironment(networkFetch);

      const freshRef = createQueryRef(
        {id: '1', name: 'Fresh'},
        {},
        'test-query-id',
        Date.now(),
      );

      function FreshComponent() {
        useQueryFromServer(testQuery, freshRef);
        return null;
      }

      await act(async () => {
        ReactTestingLibrary.render(
          <Wrapper>
            <FreshComponent />
          </Wrapper>,
        );
      });
      expect(networkFetch).not.toHaveBeenCalled();

      ReactTestingLibrary.cleanup();

      const staleRef = createQueryRef(
        {id: '1', name: 'Stale'},
        {},
        'test-query-id',
        Date.now() - 60_000,
      );

      function StaleComponent() {
        const data = useQueryFromServer(testQuery, staleRef, {
          staleThresholdMs: 0,
        });
        return <div data-testid="result">{data.name}</div>;
      }

      await act(async () => {
        ReactTestingLibrary.render(
          <Wrapper>
            <StaleComponent />
          </Wrapper>,
        );
      });

      expect(networkFetch).toHaveBeenCalled();
      expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
        'NetworkRefreshed',
      );
    });
  });

  describe('server-to-client roundtrip', () => {
    it('renders data preloaded via serverPreloadQuery', async () => {
      const serverEnv = createTestEnvironment(() =>
        Promise.resolve({data: {id: '1', name: 'ServerAlice'}}),
      );

      const query = createTestConcreteRequest('RoundtripQuery', ['id', 'name']);
      const queryRef = serverPreloadQuery(serverEnv, query, {});

      expect(queryRef.kind).toBe('PreloadedQueryRef');
      const response = await queryRef._response;
      expect(response.data).toEqual({id: '1', name: 'ServerAlice'});

      const clientFetch = jest.fn(() => Promise.resolve({data: {}}));
      const clientEnv = createTestEnvironment(clientFetch);

      function TestComponent() {
        const data = useQueryFromServer(query, queryRef);
        return <div data-testid="result">{data.name}</div>;
      }

      await act(async () => {
        ReactTestingLibrary.render(
          <React.Suspense fallback={null}>
            <RelayEnvironmentProvider environment={clientEnv}>
              <TestComponent />
            </RelayEnvironmentProvider>
          </React.Suspense>,
        );
      });

      expect(clientFetch).not.toHaveBeenCalled();
      expect(ReactTestingLibrary.screen.getByTestId('result').textContent).toBe(
        'ServerAlice',
      );
    });
  });
});
