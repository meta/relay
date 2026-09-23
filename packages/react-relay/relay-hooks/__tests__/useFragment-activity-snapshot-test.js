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

import type {useFragmentActivitySnapshotTestQuery$data} from './__generated__/useFragmentActivitySnapshotTestQuery.graphql';

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useFragment = require('../useFragment');
const {act, cleanup, render} = require('@testing-library/react');
const React = require('react');
const {flushSync} = require('react-dom');
const {
  __internal: {fetchQuery},
  RecordSource,
  RelayFeatureFlags,
  Store,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');
const {disallowWarnings} = require('relay-test-utils-internal');

// $FlowFixMe[missing-export] Not yet available in the OSS Flow types.
const Activity = React.unstable_Activity;

disallowWarnings();

const Query = graphql`
  query useFragmentActivitySnapshotTestQuery {
    ...useFragmentActivitySnapshotTestRoot
    ...useFragmentActivitySnapshotTestList
    ...useFragmentActivitySnapshotTestPluralList
    ...useFragmentActivitySnapshotTestScalar
    ...useFragmentActivitySnapshotTestPluralScalar
    ...useFragmentActivitySnapshotTestCounter
  }
`;

const Root = graphql`
  fragment useFragmentActivitySnapshotTestRoot on Query {
    ...useFragmentActivitySnapshotTestList
  }
`;

const List = graphql`
  fragment useFragmentActivitySnapshotTestList on Query {
    node(id: "1") {
      ... on User {
        friends(first: 1) {
          edges {
            node {
              id
              ...useFragmentActivitySnapshotTestChild @alias(as: "child")
            }
          }
        }
      }
    }
  }
`;

const PluralList = graphql`
  fragment useFragmentActivitySnapshotTestPluralList on Query
  @relay(plural: true) {
    node(id: "1") {
      ... on User {
        friends(first: 1) {
          edges {
            node {
              id
              ...useFragmentActivitySnapshotTestChild @alias(as: "child")
            }
          }
        }
      }
    }
  }
`;

const Child = graphql`
  fragment useFragmentActivitySnapshotTestChild on User {
    name @required(action: THROW)
  }
`;

const Scalar = graphql`
  fragment useFragmentActivitySnapshotTestScalar on Query {
    node(id: "1") {
      name
    }
  }
`;

const PluralScalar = graphql`
  fragment useFragmentActivitySnapshotTestPluralScalar on Query
  @relay(plural: true) {
    node(id: "1") {
      name
    }
  }
`;

const Counter = graphql`
  fragment useFragmentActivitySnapshotTestCounter on Query {
    node(id: "1") {
      ... on User {
        username
      }
    }
  }
`;

let environment;
let operation;
let queryRef: useFragmentActivitySnapshotTestQuery$data;
let originalActivityCompatibility;
let gcSteps: Array<() => void>;

function publish(id: string, name: string) {
  environment.commitPayload(operation, {
    node: {
      __typename: 'User',
      id: '1',
      name: 'Parent',
      username: '0',
      friends: {
        edges: [{node: {__typename: 'User', id, name}}],
      },
    },
  });
}

beforeEach(() => {
  originalActivityCompatibility =
    RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY;
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = true;
  gcSteps = [];
  environment = createMockEnvironment({
    store: new Store(new RecordSource(), {
      gcReleaseBufferSize: 0,
      gcScheduler: step => {
        gcSteps.push(step);
      },
    }),
  });
  operation = createOperationDescriptor(Query, {});
  publish('A', 'Alice');
  queryRef = environment.lookup(operation.fragment).data as any;
});

afterEach(() => {
  cleanup();
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY =
    originalActivityCompatibility;
});

function renderActivity(Component: React.ComponentType<{tick: number}>) {
  let setMode;
  let setTick;
  function App() {
    const [mode, updateMode] = React.useState('visible');
    const [tick, updateTick] = React.useState(0);
    setMode = updateMode;
    setTick = updateTick;
    return (
      // $FlowFixMe[not-a-component]
      <Activity mode={mode}>
        <Component tick={tick} />
      </Activity>
    );
  }
  const instance = render(
    <RelayEnvironmentProvider environment={environment}>
      <App />
    </RelayEnvironmentProvider>,
  );
  return {
    ...instance,
    hide: () => act(() => setMode('hidden')),
    show: () => act(() => setMode('visible')),
    tick: () => act(() => setTick(tick => tick + 1)),
    forceRender: () => setTick(tick => tick + 1),
  };
}

const Name = React.memo(function Name({fragmentRef}: {fragmentRef: any}) {
  const data = useFragment(Child, fragmentRef);
  return <span>{data.name}</span>;
});

function renderNames(data: any) {
  return data.node.friends.edges.map(edge => (
    <Name key={edge.node.id} fragmentRef={edge.node.child} />
  ));
}

function Names({fragmentRef}: {fragmentRef: any}) {
  return renderNames(useFragment(List, fragmentRef));
}

it.each([false, true])(
  'refreshes nested, aliased fragment refs during hidden renders (plural: %s)',
  async plural => {
    const fragment = plural ? PluralList : List;
    const fragmentRef: any = plural ? [queryRef] : queryRef;
    const reads = [];
    function Reader({tick}: {tick: number}) {
      const result: any = useFragment(fragment, fragmentRef);
      const data = plural ? result[0] : result;
      reads.push(data);
      return <div data-tick={tick}>{renderNames(data)}</div>;
    }
    const instance = renderActivity(Reader);
    expect(instance.container.textContent).toBe('Alice');
    await instance.hide();
    const previous = reads[reads.length - 1];
    await act(() => publish('A', 'Bob'));
    await instance.tick();

    // Effects remain disconnected: a passive-effect repair is too late.
    expect(instance.container.textContent).toBe('Bob');
    const latest = reads[reads.length - 1];
    expect(latest.node.friends.edges[0].node.child).toEqual(
      previous.node.friends.edges[0].node.child,
    );
    expect(latest.node.friends.edges[0].node.child).not.toBe(
      previous.node.friends.edges[0].node.child,
    );

    environment.lookup.mockClear();
    await instance.tick();
    expect(environment.lookup).not.toHaveBeenCalled();
    expect(reads[reads.length - 1]).toBe(latest);
    await instance.show();
    expect(instance.container.textContent).toBe('Bob');
  },
);

it('passes a replacement list through a memoized parent after hidden GC', async () => {
  function Reader({tick}: {tick: number}) {
    const data = useFragment(Root, queryRef);
    const children = React.useMemo(() => <Names fragmentRef={data} />, [data]);
    React.useEffect(() => {
      const retain = environment.retain(operation);
      return () => retain.dispose();
    }, []);
    return <div data-tick={tick}>{children}</div>;
  }
  const instance = renderActivity(Reader);
  expect(instance.container.textContent).toBe('Alice');
  await instance.hide();
  expect(gcSteps.length).toBeGreaterThan(0);
  await act(() => {
    while (gcSteps.length > 0) {
      gcSteps.shift()?.();
    }
  });
  expect(environment.getStore().getSource().has('A')).toBe(false);
  await act(() => publish('C', 'Carol'));
  expect(environment.check(operation).status).toBe('available');
  expect(environment.getStore().getSource().has('A')).toBe(false);
  await instance.tick();
  expect(instance.container.textContent).toBe('Carol');
  await instance.show();
  expect(instance.container.textContent).toBe('Carol');
});

it.each([false, true])(
  'keeps active effect dependencies stable and reads queued updates in urgent renders (plural: %s)',
  async plural => {
    const fragment = plural ? PluralScalar : Scalar;
    const fragmentRef: any = plural ? [queryRef] : queryRef;
    const effects = jest.fn();
    function Reader({tick}: {tick: number}) {
      const result: any = useFragment(fragment, fragmentRef);
      const data = plural ? result[0] : result;
      const counter = useFragment(Counter, queryRef);
      React.useEffect(() => {
        effects();
        environment.commitUpdate(store => {
          const user = store.get('1');
          const value = Number(user?.getValue('username'));
          // Bound a regressed feedback loop so it fails deterministically.
          if (value < 5) {
            user?.setValue(String(value + 1), 'username');
          }
        });
      }, [result]);
      return (
        <div data-tick={tick}>
          <span data-testid="name">{data.node?.name}</span>
          <span data-testid="counter">{counter.node?.username}</span>
        </div>
      );
    }
    const instance = renderActivity(Reader);
    await act(async () => {});
    // An unrelated store write must not change the fragment result's identity.
    expect(effects).toHaveBeenCalledTimes(1);
    expect(instance.getByTestId('counter').textContent).toBe('1');
    expect(instance.getByTestId('name').textContent).toBe('Parent');
    await act(() => {
      React.startTransition(() => {
        environment.commitUpdate(store => {
          store.get('1')?.setValue('Updated Parent', 'name');
        });
      });
      flushSync(() => instance.forceRender());
      // Check before act flushes the transition. A connected subscription only
      // schedules a React update; it does not make this urgent render current.
      expect(instance.getByTestId('name').textContent).toBe('Updated Parent');
    });
    expect(instance.getByTestId('name').textContent).toBe('Updated Parent');
  },
);

it('suspends instead of reading data collected while hidden', async () => {
  const reads = [];
  function Reader({tick}: {tick: number}) {
    const data: any = useFragment(Scalar, queryRef);
    React.useEffect(() => {
      const retain = environment.retain(operation);
      return () => retain.dispose();
    }, []);
    reads.push(data.node?.name);
    return <div data-tick={tick}>{data.node?.name}</div>;
  }
  const instance = renderActivity(({tick}) => (
    <React.Suspense fallback="Fallback">
      <Reader tick={tick} />
    </React.Suspense>
  ));
  expect(instance.container.textContent).toBe('Parent');
  await instance.hide();
  await act(() => {
    while (gcSteps.length > 0) {
      gcSteps.shift()?.();
    }
  });
  expect(environment.getStore().getSource().has('1')).toBe(false);
  // A request for the owner is in flight and another write moves the epoch.
  fetchQuery(environment, operation).subscribe({});
  await act(() =>
    environment.commitUpdate(store => {
      store.create('unrelated', 'User');
    }),
  );
  reads.length = 0;

  await instance.tick();
  expect(reads).not.toContain(undefined);
  await act(() => publish('A', 'Alice'));
  await instance.show();
  expect(instance.container.textContent).toBe('Parent');
});
