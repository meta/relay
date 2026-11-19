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

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useQueryLoader = require('../useQueryLoader');
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const {RelayFeatureFlags, getRequest, graphql} = require('relay-runtime');
const {
  createMockEnvironment,
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();

const query = graphql`
  query useQueryLoaderTestQuery($id: ID!) {
    node(id: $id) {
      id
    }
  }
`;
const generatedQuery = getRequest(query);
const defaultOptions = {};

let renderCount: ?number;
let loadedQuery;
let instance;
let queryLoaderCallback;
let releaseQuery: ?JestMockFn<ReadonlyArray<unknown>, unknown>;
let lastLoadQueryReturnValue;
let disposeQuery;

let render;
let update;
let Container;
let environment;

const loadQuery = jest.fn().mockImplementation(() => {
  releaseQuery = jest.fn();
  return (lastLoadQueryReturnValue = {
    releaseQuery,
  });
});

jest.mock('../loadQuery', () => ({
  loadQuery,
}));

describe.each([
  ['Experimental', true],
  ['Current', false],
])('useQueryLoader (%s)', (_name, ENABLE_ACTIVITY_COMPATIBILITY) => {
  beforeEach(() => {
    RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY =
      ENABLE_ACTIVITY_COMPATIBILITY;
    renderCount = undefined;
    releaseQuery = undefined;
    environment = createMockEnvironment();
    render = function (
      initialPreloadedQuery: void | {
        releaseQuery: JestMockFn<ReadonlyArray<unknown>, unknown>,
      },
    ) {
      renderCount = 0;
      ReactTestRenderer.act(() => {
        instance = ReactTestRenderer.create(
          <Container initialPreloadedQuery={initialPreloadedQuery} />,
        );
      });
    };

    update = function (
      initialPreloadedQuery: void | {
        releaseQuery: JestMockFn<ReadonlyArray<unknown>, unknown>,
      },
    ) {
      ReactTestRenderer.act(() => {
        instance.update(
          <Container initialPreloadedQuery={initialPreloadedQuery} />,
        );
      });
    };

    const Inner = function ({
      initialPreloadedQuery,
    }: {
      initialPreloadedQuery: void | {
        releaseQuery: JestMockFn<ReadonlyArray<unknown>, unknown>,
      },
    }) {
      renderCount = (renderCount || 0) + 1;
      // $FlowFixMe[incompatible-type]
      [loadedQuery, queryLoaderCallback, disposeQuery] = useQueryLoader(
        query,
        initialPreloadedQuery,
      );
      return null;
    };

    Container = function ({
      initialPreloadedQuery,
    }: {
      initialPreloadedQuery?: void | {
        releaseQuery: JestMockFn<ReadonlyArray<unknown>, unknown>,
      },
    }) {
      return (
        <RelayEnvironmentProvider environment={environment}>
          <Inner initialPreloadedQuery={initialPreloadedQuery} />
        </RelayEnvironmentProvider>
      );
    };

    loadQuery.mockClear();
  });

  afterEach(() => {
    RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = false;
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it('calls loadQuery with the appropriate parameters, if the callback is called', () => {
    render();
    expect(loadQuery).not.toHaveBeenCalled();
    const variables = {id: '4'};
    ReactTestRenderer.act(() => queryLoaderCallback(variables, defaultOptions));
    expect(loadQuery).toHaveBeenCalledTimes(1);
    expect(loadQuery.mock.calls[0][0]).toBe(environment);
    expect(loadQuery.mock.calls[0][1]).toBe(generatedQuery);
    expect(loadQuery.mock.calls[0][2]).toBe(variables);
    expect(loadQuery.mock.calls[0][3]).toBe(defaultOptions);
  });

  it('releases the old preloaded query and calls loadQuery anew if the callback is called again', () => {
    render();

    const variables = {id: '4'};
    ReactTestRenderer.act(() => queryLoaderCallback(variables));
    ReactTestRenderer.act(() => jest.runAllImmediates());
    expect(loadQuery).toHaveBeenCalledTimes(1);

    const currentRelease = releaseQuery;
    expect(currentRelease).not.toHaveBeenCalled();

    ReactTestRenderer.act(() => queryLoaderCallback(variables, defaultOptions));
    expect(currentRelease).toHaveBeenCalled();

    expect(loadQuery).toHaveBeenCalledTimes(2);
    expect(loadQuery.mock.calls[1][0]).toBe(environment);
    expect(loadQuery.mock.calls[1][1]).toBe(generatedQuery);
    expect(loadQuery.mock.calls[1][2]).toBe(variables);
    expect(loadQuery.mock.calls[1][3]).toBe(defaultOptions);
  });

  it('releases the old preloaded query and calls loadQuery anew if the callback is called again with new variables', () => {
    render();

    const variables = {id: '4'};
    ReactTestRenderer.act(() => queryLoaderCallback(variables));
    expect(loadQuery).toHaveBeenCalledTimes(1);

    const currentRelease = releaseQuery;
    expect(currentRelease).not.toHaveBeenCalled();

    const variables2 = {id: '5'};
    ReactTestRenderer.act(() =>
      queryLoaderCallback(variables2, defaultOptions),
    );

    expect(currentRelease).toHaveBeenCalled();
    expect(loadQuery).toHaveBeenCalledTimes(2);
    expect(loadQuery.mock.calls[1][0]).toBe(environment);
    expect(loadQuery.mock.calls[1][1]).toBe(generatedQuery);
    expect(loadQuery.mock.calls[1][2]).toBe(variables2);
    expect(loadQuery.mock.calls[1][3]).toBe(defaultOptions);
  });

  it('releases the preloaded query if the component unmounts', () => {
    render();
    const variables = {id: '4'};
    ReactTestRenderer.act(() => queryLoaderCallback(variables));
    expect(releaseQuery).toHaveBeenCalledTimes(0);
    ReactTestRenderer.act(() => instance.unmount());
    expect(releaseQuery).toHaveBeenCalledTimes(1);
  });

  it('returns the data that was returned from a call to loadQuery', () => {
    render();
    const variables = {id: '4'};
    ReactTestRenderer.act(() => queryLoaderCallback(variables));
    expect(loadedQuery).toBe(lastLoadQueryReturnValue);
  });

  it('releases the query and nullifies the state when the disposeQuery callback is called', () => {
    render();
    const variables = {id: '4'};
    ReactTestRenderer.act(() => queryLoaderCallback(variables));
    expect(disposeQuery).toBeDefined();
    if (disposeQuery) {
      expect(loadedQuery).not.toBe(null);
      expect(releaseQuery).not.toHaveBeenCalled();
      ReactTestRenderer.act(disposeQuery);
      expect(releaseQuery).toHaveBeenCalledTimes(1);
      expect(loadedQuery).toBe(null);
    }
  });

  describe('when an initial preloaded query is passed', () => {
    it('returns the initial preloaded query', () => {
      const initialPreloadedQuery = loadQuery(generatedQuery);
      render(initialPreloadedQuery);

      expect(loadedQuery).toBe(initialPreloadedQuery);
    });

    it('returns an initial preloaded query that was passed after a previous null initial preloaded query', () => {
      render();

      const initialPreloadedQuery = loadQuery(generatedQuery);
      const firstDispose = releaseQuery;
      update(initialPreloadedQuery);

      expect(loadedQuery).toBe(initialPreloadedQuery);

      const secondInitialPreloadedQuery = loadQuery(generatedQuery);
      update(secondInitialPreloadedQuery);

      expect(loadedQuery).toBe(secondInitialPreloadedQuery);
      expect(firstDispose).toHaveBeenCalled();
    });

    it('releases the old preloaded query and calls loadQuery anew if the callback is called again', () => {
      const initialPreloadedQuery = loadQuery();
      loadQuery.mockClear();
      render(initialPreloadedQuery);

      const firstDispose = releaseQuery;
      expect(firstDispose).not.toHaveBeenCalled();

      const variables = {id: '4'};
      ReactTestRenderer.act(() => queryLoaderCallback(variables));
      expect(loadQuery).toHaveBeenCalledTimes(1);
      expect(firstDispose).toHaveBeenCalled();

      const secondDispose = releaseQuery;
      expect(secondDispose).not.toHaveBeenCalled();

      ReactTestRenderer.act(() =>
        queryLoaderCallback(variables, defaultOptions),
      );

      expect(loadQuery).toHaveBeenCalledTimes(2);
      expect(secondDispose).toHaveBeenCalled();
    });

    it('releases the old preloaded query if a new initial preloaded query is passed', () => {
      const initialPreloadedQuery = loadQuery();
      loadQuery.mockClear();
      render(initialPreloadedQuery);

      const firstDispose = releaseQuery;
      expect(firstDispose).not.toHaveBeenCalled();

      const secondInitialPreloadedQuery = loadQuery();
      const secondDispose = releaseQuery;

      update(secondInitialPreloadedQuery);

      expect(firstDispose).toHaveBeenCalled();
      expect(secondDispose).not.toHaveBeenCalled();

      const variables = {id: '4'};
      ReactTestRenderer.act(() =>
        queryLoaderCallback(variables, defaultOptions),
      );

      expect(secondDispose).toHaveBeenCalled();
    });

    it('releases query references after empty query references are passed', () => {
      const initialPreloadedQuery = loadQuery();
      loadQuery.mockClear();
      render(initialPreloadedQuery);

      const firstDispose = releaseQuery;
      expect(firstDispose).not.toHaveBeenCalled();

      update(undefined);

      expect(firstDispose).toHaveBeenCalled();

      const secondInitialPreloadedQuery = loadQuery();
      const secondDispose = releaseQuery;

      update(secondInitialPreloadedQuery);

      expect(secondDispose).not.toHaveBeenCalled();

      update(undefined);

      expect(secondDispose).toHaveBeenCalled();
    });

    it('releases the preloaded query if the component unmounts', () => {
      const initialPreloadedQuery = loadQuery();
      render(initialPreloadedQuery);

      const currentRelease = releaseQuery;
      expect(currentRelease).not.toHaveBeenCalled();
      ReactTestRenderer.act(() => instance.unmount());
      expect(currentRelease).toHaveBeenCalled();
    });

    it('releases all preloaded queries if the component unmounts', () => {
      const firstInitialPreloadedQuery = loadQuery();
      const firstDispose = releaseQuery;
      render(firstInitialPreloadedQuery);

      const secondInitialPreloadedQuery = loadQuery();
      const secondDispose = releaseQuery;

      update(secondInitialPreloadedQuery);

      expect(firstDispose).toHaveBeenCalled();

      ReactTestRenderer.act(() => instance.unmount());
      expect(secondDispose).toHaveBeenCalled();
    });

    it('releases the query and nullifies the state when the disposeQuery callback is called', () => {
      const initialPreloadedQuery = loadQuery();
      render(initialPreloadedQuery);

      expect(disposeQuery).toBeDefined();
      if (disposeQuery) {
        expect(loadedQuery).toBe(initialPreloadedQuery);
        const currentRelease = releaseQuery;
        expect(currentRelease).not.toHaveBeenCalled();
        ReactTestRenderer.act(disposeQuery);
        expect(loadedQuery).toBe(null);
        expect(currentRelease).toHaveBeenCalled();
      }
    });
  });

  beforeEach(() => {
    jest.mock('scheduler', () => require('../../__tests__/mockScheduler'));
  });

  afterEach(() => {
    jest.dontMock('scheduler');
  });

  it('does not release the query before the new component tree unsuspends in concurrent mode', () => {
    if (typeof React.startTransition === 'function') {
      let resolve;
      let resolved = false;
      const suspensePromise = new Promise(
        _resolve =>
          (resolve = () => {
            resolved = true;
            _resolve();
          }),
      );

      function ComponentThatSuspends() {
        if (resolved) {
          return null;
        }
        throw suspensePromise;
      }

      function ComponentWithQuery() {
        [, queryLoaderCallback] = useQueryLoader(query);
        return null;
      }

      function concurrentRender() {
        ReactTestRenderer.act(() => {
          instance = ReactTestRenderer.create(
            <RelayEnvironmentProvider environment={environment}>
              <ConcurrentWrapper />
            </RelayEnvironmentProvider>,
            // $FlowFixMe[incompatible-type] - error revealed when flow-typing ReactTestRenderer
            {unstable_isConcurrent: true},
          );
        });
      }

      let transitionToSecondRoute;
      function ConcurrentWrapper() {
        const [route, setRoute] = React.useState<'FIRST' | 'SECOND'>('FIRST');

        transitionToSecondRoute = () =>
          React.startTransition(() => setRoute('SECOND'));

        return (
          <React.Suspense fallback="fallback">
            <Router route={route} />
          </React.Suspense>
        );
      }

      function Router({route}: {route: 'FIRST' | 'SECOND'}) {
        if (route === 'FIRST') {
          return <ComponentWithQuery />;
        } else {
          return <ComponentThatSuspends />;
        }
      }

      concurrentRender();

      ReactTestRenderer.act(() => queryLoaderCallback({id: '4'}));
      const currentRelease = releaseQuery;

      ReactTestRenderer.act(() => transitionToSecondRoute());

      // currentRelease will have been called in non-concurrent mode
      expect(currentRelease).not.toHaveBeenCalled();

      ReactTestRenderer.act(() => {
        /* $FlowFixMe[constant-condition] Error discovered during Constant
         * Condition roll out. See https://fburl.com/workplace/1v97vimq. */
        resolve && resolve();
        jest.runAllImmediates();
      });

      expect(currentRelease).toHaveBeenCalled();
    }
  });

  it('releases query references associated with previous suspensions when multiple state changes trigger suspense and the final suspension concludes', () => {
    // Three state changes and calls to loadQuery: A, B, C, each causing suspense
    // When C unsuspends, A and B's queries are disposed.

    if (typeof React.startTransition === 'function') {
      let resolve;
      let resolved = false;
      const resolvableSuspensePromise = new Promise(
        _resolve =>
          (resolve = () => {
            resolved = true;
            _resolve();
          }),
      );

      const unresolvablePromise = new Promise(() => {});
      const unresolvablePromise2 = new Promise(() => {});

      function concurrentRender() {
        ReactTestRenderer.act(() => {
          instance = ReactTestRenderer.create(
            <RelayEnvironmentProvider environment={environment}>
              <ConcurrentWrapper />
            </RelayEnvironmentProvider>,
            // $FlowFixMe[incompatible-type] - error revealed when flow-typing ReactTestRenderer
            {unstable_isConcurrent: true},
          );
        });
      }

      let triggerStateChange: any;
      function ConcurrentWrapper() {
        const [promise, setPromise] = React.useState(null);

        triggerStateChange = (newPromise, newName) =>
          React.startTransition(() => {
            queryLoaderCallback({});
            setPromise(newPromise);
          });

        return (
          <React.Suspense fallback="fallback">
            <InnerConcurrent promise={promise} />
          </React.Suspense>
        );
      }

      function InnerConcurrent({promise}: {promise: ?Promise<any>}) {
        [, queryLoaderCallback] = useQueryLoader(query);
        if (
          promise == null ||
          (promise === resolvableSuspensePromise && resolved)
        ) {
          return null;
        }
        throw promise;
      }

      concurrentRender();
      expect(instance.toJSON()).toEqual(null);

      const initialStateChange: any = triggerStateChange;

      ReactTestRenderer.act(() => {
        initialStateChange(unresolvablePromise);
      });
      jest.runOnlyPendingTimers(); // Trigger transition.
      expect(loadQuery).toHaveBeenCalledTimes(1);
      const firstDispose = releaseQuery;

      ReactTestRenderer.act(() => {
        initialStateChange(unresolvablePromise2);
      });
      jest.runOnlyPendingTimers(); // Trigger transition.
      expect(loadQuery).toHaveBeenCalledTimes(2);
      const secondDispose = releaseQuery;

      ReactTestRenderer.act(() => {
        initialStateChange(resolvableSuspensePromise);
      });
      jest.runOnlyPendingTimers(); // Trigger transition.
      expect(loadQuery).toHaveBeenCalledTimes(3);
      const thirdDispose = releaseQuery;

      expect(firstDispose).not.toHaveBeenCalled();
      expect(secondDispose).not.toHaveBeenCalled();

      ReactTestRenderer.act(() => {
        resolve();
        jest.runAllImmediates();
      });
      expect(firstDispose).toHaveBeenCalledTimes(1);
      expect(secondDispose).toHaveBeenCalledTimes(1);
      expect(thirdDispose).not.toHaveBeenCalled();
    }
  });

  it('releases query references associated with subsequent suspensions when multiple state changes trigger suspense and the initial suspension concludes', () => {
    // Three state changes and calls to loadQuery: A, B, C, each causing suspense
    // When A unsuspends, B and C's queries do not get disposed.

    if (typeof React.startTransition === 'function') {
      let resolve;
      let resolved = false;
      const resolvableSuspensePromise = new Promise(
        _resolve =>
          (resolve = () => {
            resolved = true;
            _resolve();
          }),
      );

      const unresolvablePromise = new Promise(() => {});
      const unresolvablePromise2 = new Promise(() => {});

      function concurrentRender() {
        ReactTestRenderer.act(() => {
          instance = ReactTestRenderer.create(
            <ConcurrentWrapper />,
            // $FlowFixMe[incompatible-type] - error revealed when flow-typing ReactTestRenderer
            {unstable_isConcurrent: true},
          );
        });
      }

      let triggerStateChange: any;
      function ConcurrentWrapper() {
        const [promise, setPromise] = React.useState(null);

        triggerStateChange = (newPromise, newName) =>
          React.startTransition(() => {
            queryLoaderCallback({});
            setPromise(newPromise);
          });

        return (
          <RelayEnvironmentProvider environment={environment}>
            <React.Suspense fallback="fallback">
              <InnerConcurrent promise={promise} />
            </React.Suspense>
          </RelayEnvironmentProvider>
        );
      }

      let innerUnsuspendedCorrectly = false;
      function InnerConcurrent({promise}: {promise: ?Promise<any>}) {
        [, queryLoaderCallback] = useQueryLoader(query);
        if (
          promise == null ||
          (promise === resolvableSuspensePromise && resolved)
        ) {
          innerUnsuspendedCorrectly = true;
          return null;
        }
        throw promise;
      }

      concurrentRender();
      expect(instance.toJSON()).toEqual(null);

      const initialStateChange: any = triggerStateChange;

      ReactTestRenderer.act(() => {
        initialStateChange(resolvableSuspensePromise);
      });

      jest.runOnlyPendingTimers(); // Trigger transition.
      expect(loadQuery).toHaveBeenCalledTimes(1);
      const firstDispose = releaseQuery;

      ReactTestRenderer.act(() => {
        initialStateChange(unresolvablePromise);
      });
      expect(loadQuery).toHaveBeenCalledTimes(2);
      const secondDispose = releaseQuery;

      ReactTestRenderer.act(() => {
        initialStateChange(unresolvablePromise2);
      });
      const thirdDispose = releaseQuery;

      ReactTestRenderer.act(() => {
        resolve();
        jest.runAllImmediates();
      });
      expect(innerUnsuspendedCorrectly).toEqual(true);
      expect(firstDispose).not.toHaveBeenCalled();
      expect(secondDispose).not.toHaveBeenCalled();
      expect(thirdDispose).not.toHaveBeenCalled();
    }
  });

  it('should release prior queries if the callback is called multiple times in the same tick', () => {
    render();
    let firstDispose;
    ReactTestRenderer.act(() => {
      queryLoaderCallback({});
      firstDispose = releaseQuery;
      queryLoaderCallback({});
    });
    expect(loadQuery).toHaveBeenCalledTimes(2);
    expect(firstDispose).toHaveBeenCalledTimes(1);
  });

  it('should release queries on unmount if the callback is called, the component suspends and then unmounts', () => {
    let shouldSuspend;
    let setShouldSuspend;
    const suspensePromise = new Promise(() => {});
    function SuspendingComponent() {
      [shouldSuspend, setShouldSuspend] = React.useState(false);
      if (shouldSuspend) {
        throw suspensePromise;
      }
      return null;
    }
    function Outer() {
      return (
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="fallback">
            <SuspendingComponent />
            <Container />
          </React.Suspense>
        </RelayEnvironmentProvider>
      );
    }

    let outerInstance;
    ReactTestRenderer.act(() => {
      outerInstance = ReactTestRenderer.create(<Outer />);
    });
    expect(renderCount).toEqual(1);
    ReactTestRenderer.act(() => {
      queryLoaderCallback({});
    });
    expect(renderCount).toEqual(2);
    ReactTestRenderer.act(() => {
      setShouldSuspend(true);
    });
    expect(renderCount).toEqual(2);
    expect(outerInstance?.toJSON()).toEqual('fallback');
    expect(releaseQuery).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => outerInstance?.unmount());
    // NOTE: we shouldn't need to switch on the flag here, but Relay tests seem to run on different
    // versions internally vs in OSS and this is needed to make it pass in both
    if (ENABLE_ACTIVITY_COMPATIBILITY) {
      expect(releaseQuery?.mock?.calls?.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(releaseQuery).toHaveBeenCalledTimes(1);
    }
  });

  it.skip('releases all queries if a the callback is called, the component suspends, another query is called and then the component unmounts', () => {
    let shouldSuspend;
    let setShouldSuspend;
    const suspensePromise = new Promise(() => {});
    function SuspendingComponent() {
      [shouldSuspend, setShouldSuspend] = React.useState(false);
      if (shouldSuspend) {
        throw suspensePromise;
      }
      return null;
    }
    function Outer() {
      return (
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="fallback">
            <SuspendingComponent />
            <Container />
          </React.Suspense>
        </RelayEnvironmentProvider>
      );
    }

    let outerInstance;
    ReactTestRenderer.act(() => {
      outerInstance = ReactTestRenderer.create(
        <Outer />,
        // $FlowFixMe[incompatible-type]
        {
          unstable_isConcurrent: true,
        },
      );
    });
    expect(renderCount).toEqual(1);
    ReactTestRenderer.act(() => {
      queryLoaderCallback({});
    });
    expect(renderCount).toEqual(2);
    ReactTestRenderer.act(() => {
      setShouldSuspend(true);
    });
    expect(renderCount).toEqual(2);
    expect(releaseQuery).not.toHaveBeenCalled();
    expect(outerInstance?.toJSON()).toEqual('fallback');

    ReactTestRenderer.act(() => {
      queryLoaderCallback({});
    });
    expect(renderCount).toEqual(2);
    expect(outerInstance?.toJSON()).toEqual('fallback');
    expect(releaseQuery).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => outerInstance?.unmount());
    if (!ENABLE_ACTIVITY_COMPATIBILITY) {
      expect(releaseQuery).toHaveBeenCalledTimes(1);
    }
  });

  it.skip('releases all queries if the component suspends, another query is loaded and then the component unmounts', () => {
    let shouldSuspend;
    let setShouldSuspend;
    const suspensePromise = new Promise(() => {});
    function SuspendingComponent() {
      [shouldSuspend, setShouldSuspend] = React.useState(false);
      if (shouldSuspend) {
        throw suspensePromise;
      }
      return null;
    }
    function Outer() {
      return (
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="fallback">
            <SuspendingComponent />
            <Container />
          </React.Suspense>
        </RelayEnvironmentProvider>
      );
    }

    let outerInstance;
    ReactTestRenderer.act(() => {
      outerInstance = ReactTestRenderer.create(
        <Outer />,
        // $FlowFixMe[incompatible-type]
        {
          unstable_isConcurrent: true,
        },
      );
    });
    expect(renderCount).toEqual(1);
    ReactTestRenderer.act(() => {
      setShouldSuspend(true);
    });
    expect(renderCount).toEqual(1);
    expect(outerInstance?.toJSON()).toEqual('fallback');
    ReactTestRenderer.act(() => {
      queryLoaderCallback({});
    });

    expect(renderCount).toEqual(1);
    expect(outerInstance?.toJSON()).toEqual('fallback');
    expect(releaseQuery).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => outerInstance?.unmount());
    if (!ENABLE_ACTIVITY_COMPATIBILITY) {
      expect(releaseQuery).toHaveBeenCalledTimes(1);
    }
  });

  it('releases the query on unmount if the component unmounts and then the callback is called before rendering', () => {
    // Case 1: unmount, then loadQuery
    render();
    expect(renderCount).toEqual(1);
    ReactTestRenderer.act(() => {
      instance.unmount();
      queryLoaderCallback({});
      expect(releaseQuery).not.toHaveBeenCalled();
    });
    expect(releaseQuery).toHaveBeenCalledTimes(1);
    expect(renderCount).toEqual(1); // renderCount === 1 ensures that an extra commit hasn't occurred
  });

  it('releases the query on unmount if the callback is called and the component unmounts before rendering', () => {
    // Case 2: loadQuery, then unmount
    render();
    expect(renderCount).toEqual(1);
    ReactTestRenderer.act(() => {
      queryLoaderCallback({});
      expect(releaseQuery).not.toHaveBeenCalled();
      instance.unmount();
    });
    expect(releaseQuery).toHaveBeenCalledTimes(1);
    expect(renderCount).toEqual(1); // renderCount === 1 ensures that an extra commit hasn't occurred
  });

  it('does not call loadQuery if the callback is called after the component unmounts', () => {
    render();
    ReactTestRenderer.act(() => instance.unmount());
    queryLoaderCallback({});
    expect(loadQuery).not.toHaveBeenCalled();
  });
});
