/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall relay
 */

'use strict';

const {act: actInternal} = require('../jest-react');
const ReactRelayContext = require('../ReactRelayContext');
const ReactRelayFragmentContainer = require('../ReactRelayFragmentContainer');
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const {
  createOperationDescriptor,
  createReaderSelector,
  graphql,
} = require('relay-runtime');
const {
  createMockEnvironment,
  disallowWarnings,
  expectToWarn,
  unwrapContainer,
} = require('relay-test-utils-internal');

disallowWarnings();
//disallowConsoleErrors();

describe('ReactRelayFragmentContainer', () => {
  let TestComponent;
  let TestContainer;
  let UserFragment;
  let UserQuery;
  let UserQueryWithCond;

  let environment;
  let ownerUser1;
  let ownerUser1WithCondVar;
  let ownerUser2;
  let render;
  let spec;

  class ContextSetter extends React.Component {
    constructor(props) {
      super();
      this.__relayContext = {
        environment: props.environment,
      };
      this.state = {props: null};
    }
    UNSAFE_componentWillReceiveProps(nextProps) {
      // eslint-disable-next-line no-shadow
      const {environment} = nextProps;
      if (environment !== this.__relayContext.environment) {
        this.__relayContext = {environment};
      }
    }
    setProps(props) {
      this.setState({props});
    }
    setContext(env) {
      this.__relayContext = {
        environment: env,
      };
      this.setProps({});
    }
    render() {
      let child = React.Children.only(this.props.children);
      if (this.state.props) {
        child = React.cloneElement(child, this.state.props);
      }
      return (
        <ReactRelayContext.Provider value={this.__relayContext}>
          {child}
        </ReactRelayContext.Provider>
      );
    }
  }

  beforeEach(() => {
    jest.mock('scheduler', () => require('./mockScheduler'));
    environment = createMockEnvironment();
    UserQuery = graphql`
      query ReactRelayFragmentContainerTestUserQuery($id: ID!) {
        node(id: $id) {
          ...ReactRelayFragmentContainerTestUserFragment
            @dangerously_unaliased_fixme
        }
      }
    `;

    UserQueryWithCond = graphql`
      query ReactRelayFragmentContainerTestUserWithCondQuery(
        $id: ID!
        $condGlobal: Boolean!
      ) {
        node(id: $id) {
          ...ReactRelayFragmentContainerTestUserFragment
            @dangerously_unaliased_fixme
            @arguments(cond: $condGlobal)
        }
      }
    `;

    UserFragment = graphql`
      fragment ReactRelayFragmentContainerTestUserFragment on User
      @argumentDefinitions(cond: {type: "Boolean!", defaultValue: true}) {
        id
        name @include(if: $cond)
      }
    `;

    render = jest.fn(() => <div />);
    spec = {
      user: UserFragment,
    };

    TestComponent = ({ref, ...props}) => {
      // Omit `ref` for forward-compatibility with `enableRefAsProp`.
      return render(props);
    };
    TestComponent.displayName = 'TestComponent';
    TestContainer = ReactRelayFragmentContainer.createContainer(
      TestComponent,
      spec,
    );

    // Pre-populate the store with data
    ownerUser1 = createOperationDescriptor(UserQuery, {id: '4'});
    environment.commitPayload(ownerUser1, {
      node: {
        id: '4',
        __typename: 'User',
        name: 'Zuck',
      },
    });
    ownerUser1WithCondVar = createOperationDescriptor(UserQueryWithCond, {
      id: '4',
      condGlobal: false,
    });
    expectToWarn(
      'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
      () => {
        environment.commitPayload(ownerUser1, {
          node: {
            id: '4',
            __typename: 'User',
          },
        });
      },
    );
    ownerUser2 = createOperationDescriptor(UserQuery, {id: '842472'});
    environment.commitPayload(ownerUser2, {
      node: {
        id: '842472',
        __typename: 'User',
        name: 'Joe',
      },
    });
  });

  it('generates a name for containers', () => {
    expect(TestContainer.$$typeof).toBe(Symbol.for('react.forward_ref'));
    expect(TestContainer.render.displayName).toBe('Relay(TestComponent)');
  });

  it('throws for invalid fragment set', () => {
    expect(() => {
      ReactRelayFragmentContainer.createContainer(TestComponent, 'a string');
    }).toThrowError(
      'Could not create Relay Container for `TestComponent`. ' +
        'Expected a set of GraphQL fragments, got `a string` instead.',
    );
  });

  it('throws for invalid fragments', () => {
    expect(() => {
      ReactRelayFragmentContainer.createContainer(TestComponent, {
        foo: null,
      });
    }).toThrowError(
      'Could not create Relay Container for `TestComponent`. ' +
        'The value of fragment `foo` was expected to be a fragment, ' +
        'got `null` instead.',
    );
  });

  it('does not throw when fragments are in modern mode', () => {
    expect(() => {
      ReactRelayFragmentContainer.createContainer(TestComponent, {
        foo: {kind: 'Fragment'},
      });
    }).not.toThrow();
  });

  it('passes non-fragment props to the component', () => {
    expectToWarn(
      'createFragmentSpecResolver: Expected prop `user` to be supplied to `Relay(TestComponent)`, but got `undefined`. Pass an explicit `null` if this is intentional.',
      () => {
        ReactTestRenderer.act(() =>
          ReactTestRenderer.create(
            <ContextSetter environment={environment}>
              <TestContainer bar={1} foo="foo" />
            </ContextSetter>,
          ),
        );
      },
    );
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      bar: 1,
      foo: 'foo',
      relay: {
        environment: environment,
      },
      user: null,
    });
    expect(environment.lookup.mock.calls.length).toBe(0);
    expect(environment.subscribe.mock.calls.length).toBe(0);
  });

  it('passes through null props', () => {
    ReactTestRenderer.act(() =>
      ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={null} />
        </ContextSetter>,
      ),
    );
    // Data & Variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      relay: {
        environment: environment,
      },
      user: null,
    });
    // Does not subscribe to updates (id is unknown)
    expect(environment.subscribe.mock.calls.length).toBe(0);
  });

  it('resolves & subscribes fragment props', () => {
    const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;

    ReactTestRenderer.act(() =>
      ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={userPointer} />
        </ContextSetter>,
      ),
    );
    // Data & Variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      relay: {
        environment: environment,
      },
      user: {
        id: '4',
        name: 'Zuck',
      },
    });
    // Subscribes for updates
    expect(environment.subscribe.mock.calls.length).toBe(1);
    expect(environment.subscribe.mock.calls[0][0]).toEqual({
      data: {
        id: '4',
        name: 'Zuck',
      },
      fieldErrors: null,
      missingLiveResolverFields: [],
      missingClientEdges: null,
      isMissingData: false,
      seenRecords: expect.any(Object),
      selector: createReaderSelector(
        UserFragment,
        '4',
        {cond: true},
        ownerUser1.request,
      ),
    });
  });

  it('re-renders on subscription callback', () => {
    const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;

    ReactTestRenderer.act(() =>
      ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={userPointer} />
        </ContextSetter>,
      ),
    );
    const callback = environment.subscribe.mock.calls[0][1];
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    ReactTestRenderer.act(() =>
      callback({
        dataID: '4',
        node: UserFragment,
        variables: {cond: true},
        data: {
          id: '4',
          name: 'Mark', // !== 'Zuck'
        },
        seenRecords: {},
      }),
    );

    // No need to resolve props or resubscribe
    expect(environment.lookup).not.toBeCalled();
    expect(environment.subscribe).not.toBeCalled();
    // Data & Variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      relay: {
        environment: environment,
      },
      user: {
        id: '4',
        name: 'Mark',
      },
    });
  });

  it('resolves new props', () => {
    let userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    let instance;
    ReactTestRenderer.act(
      () =>
        (instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainer user={userPointer} />
          </ContextSetter>,
        )),
    );
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    userPointer = environment.lookup(ownerUser2.fragment, ownerUser2).data.node;
    ReactTestRenderer.act(() =>
      instance.getInstance().setProps({
        user: userPointer,
      }),
    );

    // New data & variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      relay: {
        environment: environment,
      },
      user: {
        id: '842472',
        name: 'Joe',
      },
    });
    // Container subscribes for updates on new props
    expect(environment.subscribe.mock.calls.length).toBe(1);
    expect(environment.subscribe.mock.calls[0][0]).toEqual({
      data: {
        id: '842472',
        name: 'Joe',
      },
      isMissingData: false,
      fieldErrors: null,
      missingLiveResolverFields: [],
      missingClientEdges: null,
      seenRecords: expect.any(Object),
      selector: createReaderSelector(
        UserFragment,
        '842472',
        {cond: true},
        ownerUser2.request,
      ),
    });
  });

  it('resolves new props when ids dont change', () => {
    let userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    let instance;
    ReactTestRenderer.act(
      () =>
        (instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainer user={userPointer} />
          </ContextSetter>,
        )),
    );
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    userPointer = environment.lookup(
      ownerUser1WithCondVar.fragment,
      ownerUser1WithCondVar,
    ).data.node;
    ReactTestRenderer.act(() =>
      instance.getInstance().setProps({
        user: userPointer,
      }),
    );

    // New data & variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      relay: {
        environment: environment,
      },
      user: {
        id: '4',
        // Name is excluded since value of cond is now false
      },
    });
    // Container subscribes for updates on new props
    expect(environment.subscribe.mock.calls.length).toBe(1);
    expect(environment.subscribe.mock.calls[0][0]).toEqual({
      data: {
        id: '4',
        // Name is excluded since value of cond is now false
      },
      isMissingData: false,
      fieldErrors: null,
      missingLiveResolverFields: [],
      missingClientEdges: null,
      seenRecords: expect.any(Object),
      selector: createReaderSelector(
        UserFragment,
        '4',
        {cond: false},
        ownerUser1WithCondVar.request,
      ),
    });
  });

  it('does not update for same props/data', () => {
    const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    let instance;
    ReactTestRenderer.act(
      () =>
        (instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainer user={userPointer} />
          </ContextSetter>,
        )),
    );
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    ReactTestRenderer.act(() =>
      instance.getInstance().setProps({
        user: userPointer,
      }),
    );

    expect(render).not.toBeCalled();
    expect(environment.lookup).not.toBeCalled();
    expect(environment.subscribe).not.toBeCalled();
  });

  it('does not update for equal scalar props', () => {
    const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    const scalar = 42;
    const fn = () => null;
    let instance;
    ReactTestRenderer.act(
      () =>
        (instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainer
              fn={fn}
              nil={null}
              scalar={scalar}
              user={userPointer}
            />
          </ContextSetter>,
        )),
    );
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    ReactTestRenderer.act(() =>
      instance.getInstance().setProps({
        fn,
        nil: null,
        scalar,
        user: userPointer,
      }),
    );

    expect(render).not.toBeCalled();
    expect(environment.lookup).not.toBeCalled();
    expect(environment.subscribe).not.toBeCalled();
  });

  it('updates for unequal function props', () => {
    const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    const scalar = 42;
    const fn = () => null;
    let instance;
    ReactTestRenderer.act(
      () =>
        (instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainer fn={fn} scalar={scalar} user={userPointer} />
          </ContextSetter>,
        )),
    );
    const initialProps = render.mock.calls[0][0];
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    const nextFn = () => null;

    ReactTestRenderer.act(() =>
      instance.getInstance().setProps({
        fn: nextFn,
        scalar,
        user: userPointer,
      }),
    );

    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      ...initialProps,
      fn: nextFn,
    });
    expect(environment.lookup).not.toBeCalled();
    expect(environment.subscribe).not.toBeCalled();
  });

  it('updates for unequal scalar props', () => {
    const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    const scalar = 42;
    const fn = () => null;
    let instance;
    ReactTestRenderer.act(
      () =>
        (instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainer fn={fn} scalar={scalar} user={userPointer} />
          </ContextSetter>,
        )),
    );
    const initialProps = render.mock.calls[0][0];
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    ReactTestRenderer.act(() =>
      instance.getInstance().setProps({
        fn,
        scalar: 43,
        user: userPointer,
      }),
    );

    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      ...initialProps,
      scalar: 43,
    });
    expect(environment.lookup).not.toBeCalled();
    expect(environment.subscribe).not.toBeCalled();
  });

  it('always updates for non-scalar props', () => {
    const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    let instance;
    ReactTestRenderer.act(
      () =>
        (instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainer arr={[]} obj={{}} user={userPointer} />
          </ContextSetter>,
        )),
    );
    const initialProps = render.mock.calls[0][0];
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    const nextArr = [];
    const nextObj = {};
    ReactTestRenderer.act(() =>
      instance.getInstance().setProps({
        arr: nextArr,
        obj: nextObj,
        user: userPointer,
      }),
    );

    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual(initialProps);
    expect(render.mock.calls[0][0].arr).toBe(nextArr);
    expect(render.mock.calls[0][0].obj).toBe(nextObj);
    expect(environment.lookup).not.toBeCalled();
    expect(environment.subscribe).not.toBeCalled();
  });
  test('throw for @inline fragments', () => {
    const InlineUserFragment = graphql`
      fragment ReactRelayFragmentContainerTestInlineUserFragment on User
      @inline {
        id
      }
    `;
    expect(() => {
      ReactRelayFragmentContainer.createContainer(() => <div />, {
        user: InlineUserFragment,
      });
    }).toThrowError(
      /"kind":"InlineDataFragment","name":"ReactRelayFragmentContainerTestInlineUserFragment/,
    );
  });

  it('does not proxy instance methods', () => {
    class TestNoProxy extends React.Component {
      render() {
        return <div />;
      }

      instanceMethod(arg) {
        return arg + arg;
      }
    }

    const TestNoProxyContainer = ReactRelayFragmentContainer.createContainer(
      TestNoProxy,
      {
        user: UserFragment,
      },
    );

    let containerRef;
    let componentRef;

    ReactTestRenderer.act(() =>
      ReactTestRenderer.create(
        <ContextSetter environment={environment} variables={{}}>
          <TestNoProxyContainer
            user={null}
            ref={ref => {
              containerRef = ref;
            }}
            componentRef={ref => {
              componentRef = ref;
            }}
          />
        </ContextSetter>,
      ),
    );

    expect(componentRef.instanceMethod('foo')).toEqual('foofoo');

    expect(() => containerRef.instanceMethod('foo')).toThrow();
  });

  it('can be unwrapped in tests', () => {
    class TestUnwrapping extends React.Component {
      render() {
        return <div>Unwrapped</div>;
      }
    }

    const TestUnwrappingContainer = ReactRelayFragmentContainer.createContainer(
      TestUnwrapping,
      {
        user: UserFragment,
      },
    );

    const UnwrappedComponent = unwrapContainer(TestUnwrappingContainer);

    let renderer;
    ReactTestRenderer.act(
      () =>
        (renderer = ReactTestRenderer.create(
          <UnwrappedComponent user={{id: '4', name: 'Mark'}} />,
        )),
    );

    expect(renderer.toJSON()).toMatchSnapshot();
  });

  describe('concurrent mode', () => {
    function assertYieldsWereCleared(_scheduler) {
      const actualYields = _scheduler.unstable_clearLog();
      if (actualYields.length !== 0) {
        throw new Error(
          'Log of yielded values is not empty. ' +
            'Call expect(Scheduler).toHaveYielded(...) first.',
        );
      }
    }

    function expectSchedulerToFlushAndYield(expectedYields) {
      const Scheduler = require('scheduler');
      assertYieldsWereCleared(Scheduler);
      Scheduler.unstable_flushAllWithoutAsserting();
      const actualYields = Scheduler.unstable_clearLog();
      expect(actualYields).toEqual(expectedYields);
    }

    function expectSchedulerToFlushAndYieldThrough(expectedYields) {
      const Scheduler = require('scheduler');
      assertYieldsWereCleared(Scheduler);
      Scheduler.unstable_flushNumberOfYields(expectedYields.length);
      const actualYields = Scheduler.unstable_clearLog();
      expect(actualYields).toEqual(expectedYields);
    }

    it('upon commit, it should pick up changes in data that happened before comitting', () => {
      const Scheduler = require('scheduler');
      const YieldChild = props => {
        Scheduler.log(props.children);
        return props.children;
      };
      const YieldyUserComponent = ({user}) => {
        render({user});
        return (
          <>
            <YieldChild>Hey user,</YieldChild>
            <YieldChild>{user?.name ?? 'no name'}</YieldChild>
            <YieldChild>with id {user?.id ?? 'no id'}!</YieldChild>
          </>
        );
      };

      // Assert initial render
      const TestYieldyContainer = ReactRelayFragmentContainer.createContainer(
        YieldyUserComponent,
        {
          user: UserFragment,
        },
      );

      const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1)
        .data.node;

      actInternal(() => {
        ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestYieldyContainer user={userPointer} />
          </ContextSetter>,
          // $FlowFixMe[prop-missing] - error revealed when flow-typing ReactTestRenderer
          {
            unstable_isConcurrent: true,
          },
        );
        // Flush some of the changes, but don't commit
        expectSchedulerToFlushAndYieldThrough([
          'Hey user,',
          'Zuck',
          ['with id ', '4', '!'],
        ]);

        // In Concurrent mode component gets rendered even if not committed
        // so we reset our mock here
        render.mockClear();

        // Trigger an update while render is in progress
        environment.commitPayload(ownerUser1, {
          node: {
            __typename: 'User',
            id: '4',
            // Update name
            name: 'Zuck mid-render update',
          },
        });

        // Assert the component renders the updated data
        expectSchedulerToFlushAndYield([
          'Hey user,',
          'Zuck mid-render update',
          ['with id ', '4', '!'],
        ]);
        expect(render.mock.calls.length).toBe(1);
        expect(render.mock.calls[0][0]).toEqual({
          user: {
            id: '4',
            name: 'Zuck mid-render update',
          },
        });
        render.mockClear();

        // Update latest rendered data
        environment.commitPayload(ownerUser1, {
          node: {
            __typename: 'User',
            id: '4',
            // Update name
            name: 'Zuck latest update',
          },
        });
        expectSchedulerToFlushAndYield([
          'Hey user,',
          'Zuck latest update',
          ['with id ', '4', '!'],
        ]);
        expect(render.mock.calls.length).toBe(1);
        expect(render.mock.calls[0][0]).toEqual({
          user: {
            id: '4',
            name: 'Zuck latest update',
          },
        });
        render.mockClear();
      });
    });
  });
});
