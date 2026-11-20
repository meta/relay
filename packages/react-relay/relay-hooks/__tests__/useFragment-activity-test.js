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

import type {RelayMockEnvironment} from '../../../relay-test-utils/RelayModernMockEnvironment';
import type {useFragmentTestUserFragment$key} from './__generated__/useFragmentTestUserFragment.graphql';
import type {useFragmentTestUsersFragment$key} from './__generated__/useFragmentTestUsersFragment.graphql';

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useFragment = require('../useFragment');
const useLazyLoadQuery = require('../useLazyLoadQuery');
const userFragment = require('./__generated__/useFragmentTestUserFragment.graphql');
const userQuery = require('./__generated__/useFragmentTestUserQuery.graphql');
const usersFragment = require('./__generated__/useFragmentTestUsersFragment.graphql');
const usersQuery = require('./__generated__/useFragmentTestUsersQuery.graphql');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {useEffect, useState} = require('react');
const {RelayFeatureFlags, createOperationDescriptor} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');

// The open source build's React types don't declare `unstable_Activity` yet.
const {unstable_Activity: Activity} = jest.requireActual<{
  unstable_Activity: React.ComponentType<{
    children: React.Node,
    mode: 'hidden' | 'visible',
  }>,
}>('react');

const {act} = ReactTestingLibrary;

let environment: RelayMockEnvironment;
// The names each render of a reading component showed.
let renders: Array<string>;

function setName(id: string, name: string): void {
  environment.commitUpdate(store => {
    store.get(id)?.setValue(name, 'name');
  });
}

component UserName(user: ?useFragmentTestUserFragment$key) {
  const name = useFragment(userFragment, user)?.name ?? '';
  renders.push(name);
  return name;
}

component UserNames(users: ?useFragmentTestUsersFragment$key) {
  const names = (useFragment(usersFragment, users) ?? [])
    .map(user => user.name)
    .join(',');
  renders.push(names);
  return names;
}

component User(id: string) {
  const data = useLazyLoadQuery(userQuery, {id}, {fetchPolicy: 'store-only'});
  return <UserName user={data.node} />;
}

component Users() {
  const data = useLazyLoadQuery(
    usersQuery,
    {ids: ['1', '2']},
    {fetchPolicy: 'store-only'},
  );
  return <UserNames users={data.nodes?.filter(Boolean)} />;
}

// User 1 (or both users) in an <Activity> that a click on "hide" hides. A
// passive effect of the commit that hides it writes "Alison" to the store
// (after React disposed of the hidden component's store subscription), unless
// `writeOnHide` is false.
component App(plural: boolean, writeOnHide: boolean) {
  const [hidden, setHidden] = useState(false);
  const [id, setId] = useState('1');
  useEffect(() => {
    if (hidden && writeOnHide) {
      setName('1', 'Alison');
    }
  }, [hidden, writeOnHide]);
  return (
    <>
      <button onClick={() => setHidden(true)}>hide</button>
      <button onClick={() => setHidden(false)}>show</button>
      <button onClick={() => setId('2')}>user 2</button>
      <Activity mode={hidden ? 'hidden' : 'visible'}>
        <div data-testid="content">{plural ? <Users /> : <User id={id} />}</div>
      </Activity>
    </>
  );
}

type Options = {plural?: boolean, strict?: boolean, writeOnHide?: boolean};

function renderApp(options?: Options): {
  click: (button: 'hide' | 'show' | 'user 2') => void,
  content: () => ?string,
} {
  const app = (
    <RelayEnvironmentProvider environment={environment}>
      <App
        plural={options?.plural === true}
        writeOnHide={options?.writeOnHide !== false}
      />
    </RelayEnvironmentProvider>
  );
  const {getByTestId, getByText} = ReactTestingLibrary.render(
    options?.strict === true ? <React.StrictMode>{app}</React.StrictMode> : app,
  );
  return {
    click: button => {
      ReactTestingLibrary.fireEvent.click(getByText(button));
    },
    content: () => getByTestId('content').textContent,
  };
}

const {ENABLE_ACTIVITY_COMPATIBILITY} = RelayFeatureFlags;

beforeEach(() => {
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = true;
  renders = [];
  environment = createMockEnvironment();
  environment.commitPayload(
    createOperationDescriptor(usersQuery, {ids: ['1', '2']}),
    {
      nodes: [
        {__typename: 'User', id: '1', name: 'Alice', username: 'alice'},
        {__typename: 'User', id: '2', name: 'Bob', username: 'bob'},
      ],
    },
  );
  environment.commitPayload(createOperationDescriptor(userQuery, {id: '1'}), {
    node: {__typename: 'User', id: '1', name: 'Alice', username: 'alice'},
  });
  environment.commitPayload(createOperationDescriptor(userQuery, {id: '2'}), {
    node: {__typename: 'User', id: '2', name: 'Bob', username: 'bob'},
  });
});

afterEach(() => {
  ReactTestingLibrary.cleanup();
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY =
    ENABLE_ACTIVITY_COMPATIBILITY;
});

describe('useFragment revealed by an <Activity>', () => {
  it('shows the latest data when revealed after an update queued before the hide', () => {
    const app = renderApp();
    expect(app.content()).toBe('Alice');
    act(() => {
      // The subscription delivers both updates. React computes the first
      // state update right away; the second waits for the next render of the
      // component, which happens after the click below has hidden it.
      setName('1', 'Alicia');
      setName('1', 'Alicia2');
      // Hides the component (a discrete update, committed first). The effect
      // of that commit writes "Alison", which the component doesn't receive:
      // it is no longer subscribed.
      app.click('hide');
    });
    act(() => {
      app.click('show');
    });
    expect(app.content()).toBe('Alison');
  });

  it('shows the latest data of a plural fragment when revealed after an update queued before the hide', () => {
    const app = renderApp({plural: true});
    expect(app.content()).toBe('Alice,Bob');
    act(() => {
      setName('1', 'Alicia');
      setName('1', 'Alicia2');
      app.click('hide');
    });
    act(() => {
      app.click('show');
    });
    expect(app.content()).toBe('Alison,Bob');
  });

  it('shows the latest data when revealed after one update queued before the hide', () => {
    const app = renderApp();
    act(() => {
      setName('1', 'Alicia');
    });
    // Once the component has rendered an update, React no longer computes
    // the next state update when it is delivered: one update is enough.
    act(() => {
      setName('1', 'Alicia2');
      app.click('hide');
    });
    act(() => {
      app.click('show');
    });
    expect(app.content()).toBe('Alison');
  });

  it('shows the latest data when revealed after the first update since mount', () => {
    // React computes the first state update after the mount when it is
    // delivered, so this case read the right epoch even before the fix.
    const app = renderApp();
    act(() => {
      setName('1', 'Alicia');
      app.click('hide');
    });
    act(() => {
      app.click('show');
    });
    expect(app.content()).toBe('Alison');
  });
});

type Result = {content: ?string, lookups: number, renders: Array<string>};

// Runs `scenario` and returns what the reading components showed: the DOM,
// each render's names, in order, and how often they read the store.
function run(
  scenario: (v: ReturnType<typeof renderApp>) => void,
  options?: Options,
): Result {
  const lookup = jest.spyOn(environment, 'lookup');
  const app = renderApp(options);
  scenario(app);
  return {
    content: app.content(),
    lookups: lookup.mock.calls.length,
    renders,
  };
}

// `result` with consecutive renders of the same names counted once: the data
// the components showed, in order, however often React rendered it (React
// renders a subtree again when an <Activity> hides or reveals it, and twice
// under StrictMode).
function withoutRepeatedRenders(result: Result): Result {
  const renders: Array<string> = [];
  for (let i = 0; i < result.renders.length; i++) {
    if (i === 0 || result.renders[i] !== result.renders[i - 1]) {
      renders.push(result.renders[i]);
    }
  }
  return {...result, renders};
}

// What the reading components did before the fix too, with and without it: a
// change to any of these is a change of behavior.
describe('useFragment renders and store reads', () => {
  it('for updates while visible', () => {
    expect(
      run(app => {
        act(() => {
          setName('1', 'Alicia');
        });
        act(() => {
          setName('1', 'Alicia2');
          setName('1', 'Alicia3');
        });
        act(() => {
          React.startTransition(() => {
            setName('1', 'Alicia4');
          });
        });
      }),
    ).toEqual({
      content: 'Alicia4',
      lookups: 2,
      renders: ['Alice', 'Alicia', 'Alicia3', 'Alicia4'],
    });
  });

  it('for updates of a plural fragment while visible', () => {
    expect(
      run(
        app => {
          act(() => {
            setName('1', 'Alicia');
            setName('2', 'Bobby');
          });
          act(() => {
            setName('2', 'Bobby2');
          });
        },
        {plural: true},
      ),
    ).toEqual({
      content: 'Alicia,Bobby2',
      lookups: 3,
      renders: ['Alice,Bob', 'Alicia,Bobby', 'Alicia,Bobby2'],
    });
  });

  it('for a reveal with no update while hidden', () => {
    const result = run(app => {
      act(() => {
        setName('1', 'Alicia');
      });
      act(() => {
        setName('2', 'Bobby');
        app.click('hide');
      });
      act(() => {
        app.click('show');
      });
    });
    expect(withoutRepeatedRenders(result)).toEqual({
      content: 'Alison',
      lookups: 4,
      renders: ['Alice', 'Alicia', 'Alison'],
    });
  });

  it('for a reveal with no store write since the last update', () => {
    const result = run(
      app => {
        act(() => {
          setName('1', 'Alicia');
        });
        act(() => {
          setName('1', 'Alicia2');
        });
        act(() => {
          app.click('hide');
        });
        act(() => {
          app.click('show');
        });
      },
      {writeOnHide: false},
    );
    expect(withoutRepeatedRenders(result)).toEqual({
      content: 'Alicia2',
      lookups: 3,
      renders: ['Alice', 'Alicia', 'Alicia2'],
    });
  });

  it('for a reveal after an update while hidden with no update queued', () => {
    const result = run(app => {
      act(() => {
        setName('1', 'Alicia');
      });
      act(() => {
        app.click('hide');
      });
      act(() => {
        setName('1', 'Alicia2');
      });
      act(() => {
        app.click('show');
      });
    });
    // The hidden render after the hide reads the store, which the hide's
    // effect wrote "Alison" to, instead of showing the stale "Alicia".
    expect(withoutRepeatedRenders(result)).toEqual({
      content: 'Alicia2',
      lookups: 6,
      renders: ['Alice', 'Alicia', 'Alison', 'Alicia2'],
    });
  });

  it('for an update delivered together with a new fragment reference', () => {
    const result = run(app => {
      act(() => {
        setName('1', 'Alicia');
      });
      act(() => {
        setName('1', 'Alicia2');
        app.click('user 2');
        setName('2', 'Bobby');
      });
      act(() => {
        setName('1', 'Alicia3');
        setName('2', 'Bobby2');
      });
    });
    expect(withoutRepeatedRenders(result)).toEqual({
      content: 'Bobby2',
      lookups: 4,
      renders: ['Alice', 'Alicia', 'Bobby', 'Bobby2'],
    });
  });

  it('under StrictMode (double render, double effects)', () => {
    // StrictMode also reads the store twice where React runs a render or an
    // effect twice, so this compares only what the component showed.
    const {content, renders} = withoutRepeatedRenders(
      run(
        app => {
          act(() => {
            setName('1', 'Alicia');
          });
          act(() => {
            app.click('hide');
          });
          act(() => {
            app.click('show');
          });
          act(() => {
            setName('1', 'Alicia2');
          });
        },
        {strict: true},
      ),
    );
    expect({content, renders}).toEqual({
      content: 'Alicia2',
      renders: ['Alice', 'Alicia', 'Alison', 'Alicia2'],
    });
  });
});
