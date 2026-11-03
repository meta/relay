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

const {ENABLE_ACTIVITY_COMPATIBILITY, ENABLE_FRAGMENT_SUBSCRIPTION_UPDATE_FIX} =
  RelayFeatureFlags;

function setUp(flag: boolean): void {
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY = true;
  RelayFeatureFlags.ENABLE_FRAGMENT_SUBSCRIPTION_UPDATE_FIX = flag;
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
}

afterEach(() => {
  ReactTestingLibrary.cleanup();
  RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY =
    ENABLE_ACTIVITY_COMPATIBILITY;
  RelayFeatureFlags.ENABLE_FRAGMENT_SUBSCRIPTION_UPDATE_FIX =
    ENABLE_FRAGMENT_SUBSCRIPTION_UPDATE_FIX;
});

describe.each([
  ['off', false],
  ['on', true],
])('ENABLE_FRAGMENT_SUBSCRIPTION_UPDATE_FIX %s', (_name, flag) => {
  beforeEach(() => {
    setUp(flag);
  });

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
    expect(app.content()).toBe(flag ? 'Alison' : 'Alicia2');
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
    expect(app.content()).toBe(flag ? 'Alison,Bob' : 'Alicia2,Bob');
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
    expect(app.content()).toBe(flag ? 'Alison' : 'Alicia2');
  });

  it('shows the latest data when revealed after the first update since mount', () => {
    // React computes the first state update after the mount when it is
    // delivered, so the epoch it records is right with the flag off too.
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

describe('ENABLE_FRAGMENT_SUBSCRIPTION_UPDATE_FIX on behaves as off', () => {
  // Runs `scenario` with the flag off and on: the reading components render
  // the same names, in the same order, and read the store as often.
  function expectSameRenders(
    scenario: (v: ReturnType<typeof renderApp>) => void,
    options?: Options,
  ): void {
    const results = [false, true].map(flag => {
      setUp(flag);
      const lookup = jest.spyOn(environment, 'lookup');
      const app = renderApp(options);
      scenario(app);
      const result = {
        content: app.content(),
        lookups: lookup.mock.calls.length,
        renders,
      };
      ReactTestingLibrary.cleanup();
      return result;
    });
    expect(results[1]).toEqual(results[0]);
  }

  it('for updates while visible', () => {
    expectSameRenders(app => {
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
    });
  });

  it('for updates of a plural fragment while visible', () => {
    expectSameRenders(
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
    );
  });

  it('for a reveal with no update while hidden', () => {
    expectSameRenders(app => {
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
  });

  it('for a reveal with no store write since the last update', () => {
    expectSameRenders(
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
  });

  it('for a reveal after an update while hidden with no update queued', () => {
    expectSameRenders(app => {
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
  });

  it('for an update delivered together with a new fragment reference', () => {
    expectSameRenders(app => {
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
  });

  it('under StrictMode (double render, double effects)', () => {
    expectSameRenders(
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
    );
  });
});
