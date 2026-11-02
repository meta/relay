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
import type {EntryPointComponent} from '../EntryPointTypes.flow';
import type {EnvironmentProviderOptions} from '../EntryPointTypes.flow';
import type {IEnvironment} from 'relay-runtime/store/RelayStoreTypes';

const useEntryPointLoader = require('../useEntryPointLoader');
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const {
  createMockEnvironment,
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();

let loadedEntryPoint;
let instance;
let entryPointLoaderCallback: (params: {...}) => void;
let dispose: ?JestMockFn<ReadonlyArray<unknown>, unknown>;
let loadEntryPointLastReturnValue;
let disposeEntryPoint;

let renderCount: ?number;
let environment: IEnvironment;
let defaultEnvironmentProvider: Readonly<{
  getEnvironment: (options: ?EnvironmentProviderOptions) => IEnvironment,
}>;
let render;
let Container;
let defaultEntryPoint: any;

const loadEntryPoint = jest
  /* $FlowFixMe[underconstrained-implicit-instantiation] error found when
   * enabling Flow LTI mode */
  .fn<_, {dispose: JestMockFn<ReadonlyArray<unknown>, unknown>}>()
  .mockImplementation(() => {
    dispose = jest.fn();
    return (loadEntryPointLastReturnValue = {
      dispose,
    });
  });
jest.mock('../loadEntryPoint', () => loadEntryPoint);

beforeEach(() => {
  renderCount = undefined;
  dispose = undefined;
  environment = createMockEnvironment();
  defaultEnvironmentProvider = {
    getEnvironment: () => environment,
  };
  // We don't care about the contents of entryPoints
  defaultEntryPoint = {};

  render = function () {
    renderCount = 0;
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <Container
          environmentProvider={defaultEnvironmentProvider}
          entryPoint={defaultEntryPoint}
        />,
      );
    });
  };

  component TestContainer(
    entryPoint: any,
    environmentProvider: Readonly<{
      getEnvironment: (options: ?EnvironmentProviderOptions) => IEnvironment,
    }>,
  ) {
    renderCount = (renderCount || 0) + 1;
    [loadedEntryPoint, entryPointLoaderCallback, disposeEntryPoint] =
      useEntryPointLoader<{...}, any, any, any, any, any, any>(
        environmentProvider,
        entryPoint,
      );
    return null;
  }
  Container = TestContainer;
  loadEntryPoint.mockClear();
});

afterAll(() => {
  jest.clearAllMocks();
});

it('calls loadEntryPoint with the appropriate parameters, if the callback is called', () => {
  render();
  expect(loadEntryPoint).not.toHaveBeenCalled();
  const params = {};
  ReactTestRenderer.act(() => entryPointLoaderCallback(params));
  expect(loadEntryPoint).toHaveBeenCalledTimes(1);
  expect(loadEntryPoint.mock.calls[0][0]).toBe(defaultEnvironmentProvider);
  expect(loadEntryPoint.mock.calls[0][1]).toBe(defaultEntryPoint);
  expect(loadEntryPoint.mock.calls[0][2]).toBe(params);
});

it('disposes the old preloaded entry point and calls loadEntryPoint anew if the callback is called again', () => {
  render();

  const params = {};
  ReactTestRenderer.act(() => entryPointLoaderCallback(params));
  expect(loadEntryPoint).toHaveBeenCalledTimes(1);

  const currentDispose = dispose;
  expect(currentDispose).not.toHaveBeenCalled();

  const params2 = {};
  ReactTestRenderer.act(() => entryPointLoaderCallback(params2));

  expect(currentDispose).toHaveBeenCalled();
  expect(loadEntryPoint).toHaveBeenCalledTimes(2);
  expect(loadEntryPoint.mock.calls[1][0]).toBe(defaultEnvironmentProvider);
  expect(loadEntryPoint.mock.calls[1][1]).toBe(defaultEntryPoint);
  expect(loadEntryPoint.mock.calls[1][2]).toBe(params2);
});

it('disposes the preloaded entry point if the component unmounts', () => {
  render();
  const params = {};
  ReactTestRenderer.act(() => entryPointLoaderCallback(params));
  expect(dispose).toHaveBeenCalledTimes(0);
  ReactTestRenderer.act(() => instance.unmount());
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('returns the value of loadEntryPoint as the first item of the return value', () => {
  render();
  const params = {};
  ReactTestRenderer.act(() => entryPointLoaderCallback(params));
  expect(loadedEntryPoint).toBe(loadEntryPointLastReturnValue);
});

it('disposes the entry point and nullifies the state when the disposeEntryPoint callback is called', () => {
  render();
  const params = {};
  ReactTestRenderer.act(() => entryPointLoaderCallback(params));
  expect(disposeEntryPoint).toBeDefined();
  /* $FlowFixMe[constant-condition] Error discovered during Constant Condition
   * roll out. See https://fburl.com/workplace/1v97vimq. */
  if (disposeEntryPoint) {
    expect(loadedEntryPoint).not.toBe(null);
    expect(dispose).not.toHaveBeenCalled();
    ReactTestRenderer.act(disposeEntryPoint);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(loadedEntryPoint).toBe(null);
  }
});

beforeEach(() => {
  jest.mock('scheduler', () => require('../../__tests__/mockScheduler'));
});

afterEach(() => {
  jest.dontMock('scheduler');
});

it('does not dispose the entry point before the new component tree unsuspends in concurrent mode', () => {
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

    function ComponentWithHook() {
      [, entryPointLoaderCallback] = useEntryPointLoader<
        {...},
        {},
        {...},
        {...},
        unknown,
        EntryPointComponent<{}, {...}, {...}, unknown>,
        _,
      >(defaultEnvironmentProvider, defaultEntryPoint);
      return null;
    }

    function concurrentRender() {
      ReactTestRenderer.act(() => {
        instance = ReactTestRenderer.create(
          <ConcurrentWrapper />,
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
        return <ComponentWithHook />;
      } else {
        return <ComponentThatSuspends />;
      }
    }

    concurrentRender();

    ReactTestRenderer.act(() => entryPointLoaderCallback({}));
    const currentDispose = dispose;

    ReactTestRenderer.act(() => transitionToSecondRoute());

    // currentDispose will have been called in non-concurrent mode
    expect(currentDispose).not.toHaveBeenCalled();

    ReactTestRenderer.act(() => {
      /* $FlowFixMe[constant-condition] Error discovered during Constant
       * Condition roll out. See https://fburl.com/workplace/1v97vimq. */
      resolve && resolve();
      jest.runAllImmediates();
    });

    expect(currentDispose).toHaveBeenCalled();
  }
});

it('disposes entry point references associated with previous suspensions when multiple state changes trigger suspense and the final suspension concludes', () => {
  // Three state changes and calls to loadEntryPoint: A, B, C, each causing suspense
  // When C unsuspends, A and B's entry points are disposed.

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
          entryPointLoaderCallback({});
          setPromise(newPromise);
        });

      return (
        <React.Suspense fallback="fallback">
          <Inner promise={promise} />
        </React.Suspense>
      );
    }

    function Inner({promise}: {promise: ?Promise<any>}) {
      [, entryPointLoaderCallback] = useEntryPointLoader<
        {...},
        {},
        {...},
        {...},
        unknown,
        EntryPointComponent<{}, {...}, {...}, unknown>,
        _,
      >(defaultEnvironmentProvider, defaultEntryPoint);
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
    expect(loadEntryPoint).toHaveBeenCalledTimes(1);
    const firstDispose = dispose;

    ReactTestRenderer.act(() => {
      initialStateChange(unresolvablePromise2);
    });
    jest.runOnlyPendingTimers(); // Trigger transition.
    expect(loadEntryPoint).toHaveBeenCalledTimes(2);
    const secondDispose = dispose;

    ReactTestRenderer.act(() => {
      initialStateChange(resolvableSuspensePromise);
    });
    jest.runOnlyPendingTimers(); // Trigger transition.
    expect(loadEntryPoint).toHaveBeenCalledTimes(3);
    const thirdDispose = dispose;

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

it('disposes entry point references associated with subsequent suspensions when multiple state changes trigger suspense and the initial suspension concludes', () => {
  // Three state changes and calls to loadEntryPoint: A, B, C, each causing suspense
  // When A unsuspends, B and C's entry points do not get disposed.

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
          entryPointLoaderCallback({});
          setPromise(newPromise);
        });

      return (
        <React.Suspense fallback="fallback">
          <Inner promise={promise} />
        </React.Suspense>
      );
    }

    let innerUnsuspendedCorrectly = false;
    function Inner({promise}: {promise: ?Promise<any>}) {
      [, entryPointLoaderCallback] = useEntryPointLoader<
        {...},
        {},
        {...},
        {...},
        unknown,
        EntryPointComponent<{}, {...}, {...}, unknown>,
        _,
      >(defaultEnvironmentProvider, defaultEntryPoint);
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
    jest.runOnlyPendingTimers();
    expect(loadEntryPoint).toHaveBeenCalledTimes(1);
    const firstDispose = dispose;

    ReactTestRenderer.act(() => {
      initialStateChange(unresolvablePromise);
    });
    jest.runOnlyPendingTimers();
    expect(loadEntryPoint).toHaveBeenCalledTimes(2);
    const secondDispose = dispose;

    ReactTestRenderer.act(() => {
      initialStateChange(unresolvablePromise2);
    });
    const thirdDispose = dispose;

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

it('should dispose of prior entry points if the callback is called multiple times in the same tick', () => {
  render();
  let firstDispose;
  ReactTestRenderer.act(() => {
    entryPointLoaderCallback({});
    firstDispose = dispose;
    entryPointLoaderCallback({});
  });
  expect(loadEntryPoint).toHaveBeenCalledTimes(2);
  expect(firstDispose).toHaveBeenCalledTimes(1);
});

it('should dispose of entry points on unmount if the callback is called, the component suspends and then unmounts', () => {
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
      <React.Suspense fallback="fallback">
        <SuspendingComponent />
        <Container
          entryPoint={defaultEntryPoint}
          environmentProvider={defaultEnvironmentProvider}
        />
      </React.Suspense>
    );
  }

  let outerInstance;
  ReactTestRenderer.act(() => {
    outerInstance = ReactTestRenderer.create(<Outer />);
  });
  ReactTestRenderer.act(() => jest.runAllImmediates());
  expect(renderCount).toEqual(1);
  ReactTestRenderer.act(() => {
    entryPointLoaderCallback({});
  });
  expect(renderCount).toEqual(2);
  ReactTestRenderer.act(() => {
    setShouldSuspend(true);
  });
  expect(renderCount).toEqual(2);
  expect(outerInstance?.toJSON()).toEqual('fallback');
  expect(dispose).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => outerInstance.unmount());
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('disposes all entry points if the callback is called, the component suspends, another entry point is loaded and then the component unmounts', () => {
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
      <React.Suspense fallback="fallback">
        <SuspendingComponent />
        <Container
          entryPoint={defaultEntryPoint}
          environmentProvider={defaultEnvironmentProvider}
        />
      </React.Suspense>
    );
  }

  let outerInstance;
  ReactTestRenderer.act(() => {
    outerInstance = ReactTestRenderer.create(<Outer />);
  });
  expect(renderCount).toEqual(1);
  ReactTestRenderer.act(() => {
    entryPointLoaderCallback({});
  });
  expect(renderCount).toEqual(2);
  const firstDispose = dispose;
  ReactTestRenderer.act(() => {
    setShouldSuspend(true);
  });
  expect(renderCount).toEqual(2);
  expect(firstDispose).not.toHaveBeenCalled();
  expect(outerInstance?.toJSON()).toEqual('fallback');

  // For some reason, calling the entryPointLoaderCallback here causes a re-render,
  // *even though the component is in a suspended state.* As such, it commits and
  // the entry point is disposed.
  //
  // If we did not initially call `entryPointLoaderCallback`, there may not be a
  // re-render, depending on the React version (See the following test.)
  ReactTestRenderer.act(() => {
    entryPointLoaderCallback({});
  });
  const secondDispose = dispose;
  // $FlowFixMe[incompatible-use]
  expect(outerInstance.toJSON()).toEqual('fallback');

  // TODO(T19754110): This fails in OSS where we have concurrent mode, but might
  // be important. Need to validate.
  // expect(firstDispose).toHaveBeenCalledTimes(1);
  expect(secondDispose).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => outerInstance.unmount());
  expect(secondDispose).toHaveBeenCalledTimes(1);
});

it('disposes all entry points if the component suspends, another entry point is loaded and then the component unmounts', () => {
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
      <React.Suspense fallback="fallback">
        <SuspendingComponent />
        <Container
          entryPoint={defaultEntryPoint}
          environmentProvider={defaultEnvironmentProvider}
        />
      </React.Suspense>
    );
  }

  let outerInstance;
  ReactTestRenderer.act(() => {
    outerInstance = ReactTestRenderer.create(<Outer />);
  });
  expect(renderCount).toEqual(1);
  ReactTestRenderer.act(() => {
    setShouldSuspend(true);
  });
  expect(renderCount).toEqual(1);
  expect(outerInstance?.toJSON()).toEqual('fallback');
  ReactTestRenderer.act(() => {
    entryPointLoaderCallback({});
  });

  // Depending on the React version, calling the entryPointLoaderCallback here causes a re-render
  // *even though the component is in a suspended state.* As such, it commits and
  // the entry point is disposed.
  expect(renderCount).toBeLessThanOrEqual(2);
  // $FlowFixMe[incompatible-use]
  expect(outerInstance.toJSON()).toEqual('fallback');
  expect(dispose).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => outerInstance.unmount());
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('disposes the entry point on unmount if the callback is called and the component unmounts before rendering', () => {
  // Case 1: unmount, then loadEntryPoint
  render();
  expect(renderCount).toEqual(1);
  ReactTestRenderer.act(() => {
    instance.unmount();
    entryPointLoaderCallback({});
    expect(dispose).not.toHaveBeenCalled();
  });
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(renderCount).toEqual(1); // renderCount === 1 ensures that an extra commit hasn't occurred
});

it('disposes the entry point on unmount if the component unmounts and then the callback is called before rendering', () => {
  // Case 2: loadEntryPoint, then unmount
  render();
  expect(renderCount).toEqual(1);
  ReactTestRenderer.act(() => {
    entryPointLoaderCallback({});
    expect(dispose).not.toHaveBeenCalled();
    instance.unmount();
  });
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(renderCount).toEqual(1); // renderCount === 1 ensures that an extra commit hasn't occurred
});

it('does not call loadEntryPoint if the callback is called after the component unmounts', () => {
  render();
  ReactTestRenderer.act(() => instance.unmount());
  entryPointLoaderCallback({});
  expect(loadEntryPoint).not.toHaveBeenCalled();
});
