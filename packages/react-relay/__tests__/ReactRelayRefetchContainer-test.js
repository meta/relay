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
const ReactRelayRefetchContainer = require('../ReactRelayRefetchContainer');
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

const {useContext} = React;

disallowWarnings();

describe('ReactRelayRefetchContainer', () => {
  let TestComponent;
  let TestContainer;
  let UserFragment;
  let UserQuery;
  let UserQueryWithCond;

  let environment;
  let ownerUser1;
  let ownerUser1WithCondVar;
  let ownerUser2;
  let refetch;
  let render;
  let variables;
  let relayContext;

  class ContextSetter extends React.Component {
    constructor(props) {
      super();

      this.__relayContext = {
        environment: props.environment,
      };

      this.state = {
        props: null,
      };
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
    UserFragment = graphql`
      fragment ReactRelayRefetchContainerTestUserFragment on User
      @argumentDefinitions(cond: {type: "Boolean!", defaultValue: true}) {
        id
        name @include(if: $cond)
      }
    `;
    UserQueryWithCond = graphql`
      query ReactRelayRefetchContainerTestUserWithCondQuery(
        $id: ID!
        $condGlobal: Boolean!
      ) {
        node(id: $id) {
          ...ReactRelayRefetchContainerTestUserFragment
            @dangerously_unaliased_fixme
            @arguments(cond: $condGlobal)
        }
      }
    `;
    UserQuery = graphql`
      query ReactRelayRefetchContainerTestUserQuery($id: ID!) {
        node(id: $id) {
          ...ReactRelayRefetchContainerTestUserFragment
            @dangerously_unaliased_fixme
        }
      }
    `;

    function ContextGetter() {
      relayContext = useContext(ReactRelayContext);
      return null;
    }

    render = jest.fn(props => {
      refetch = props.relay.refetch;
      return <ContextGetter />;
    });
    variables = {};
    TestComponent = ({ref, ...props}) => {
      // Omit `ref` for forward-compatibility with `enableRefAsProp`.
      return render(props);
    };
    TestComponent.displayName = 'TestComponent';
    TestContainer = ReactRelayRefetchContainer.createContainer(
      TestComponent,
      {
        user: UserFragment,
      },
      UserQuery,
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

  it('throws for invalid fragments', () => {
    expect(() => {
      ReactRelayRefetchContainer.createContainer(TestComponent, {
        foo: null,
      });
    }).toThrowError(
      'Could not create Relay Container for `TestComponent`. ' +
        'The value of fragment `foo` was expected to be a fragment, ' +
        'got `null` instead.',
    );
  });

  it('passes non-fragment props to the component', () => {
    expectToWarn(
      'createFragmentSpecResolver: Expected prop `user` to be supplied to `Relay(TestComponent)`, but got `undefined`. Pass an explicit `null` if this is intentional.',
      () => {
        ReactTestRenderer.act(() => {
          ReactTestRenderer.create(
            <ContextSetter environment={environment}>
              <TestContainer bar={1} foo="foo" />
            </ContextSetter>,
          );
        });
      },
    );
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      bar: 1,
      foo: 'foo',
      relay: {
        environment: expect.any(Object),
        refetch: expect.any(Function),
      },
      user: null,
    });
    expect(environment.lookup.mock.calls.length).toBe(0);
    expect(environment.subscribe.mock.calls.length).toBe(0);
  });

  it('passes through null props', () => {
    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={null} />
        </ContextSetter>,
      );
    });
    // Data & Variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      relay: {
        environment: expect.any(Object),
        refetch: expect.any(Function),
      },
      user: null,
    });
    // Does not subscribe to updates (id is unknown)
    expect(environment.subscribe.mock.calls.length).toBe(0);
  });

  it('passes through context', () => {
    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={null} />
        </ContextSetter>,
      );
    });
    expect(relayContext.environment).toBe(environment);
  });

  it('resolves & subscribes fragment props', () => {
    const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={userPointer} />
        </ContextSetter>,
      );
    });
    // Data & Variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      user: {
        id: '4',
        name: 'Zuck',
      },
      relay: {
        environment: expect.any(Object),
        refetch: expect.any(Function),
      },
    });
    // Subscribes for updates
    expect(environment.subscribe.mock.calls.length).toBe(1);
    expect(environment.subscribe.mock.calls[0][0]).toEqual({
      data: {
        id: '4',
        name: 'Zuck',
      },
      isMissingData: false,
      fieldErrors: null,
      missingLiveResolverFields: [],
      missingClientEdges: null,
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
    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={userPointer} />
        </ContextSetter>,
      );
    });
    const callback = environment.subscribe.mock.calls[0][1];
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    ReactTestRenderer.act(() => {
      callback({
        dataID: '4',
        node: UserFragment,
        variables: {cond: true},
        data: {
          id: '4',
          name: 'Mark', // !== 'Zuck'
        },
        seenRecords: {},
      });
    });

    // No need to resolve props or resubscribe
    expect(environment.lookup).not.toBeCalled();
    expect(environment.subscribe).not.toBeCalled();
    // Data & Variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      user: {
        id: '4',
        name: 'Mark',
      },
      relay: {
        environment: expect.any(Object),
        refetch: expect.any(Function),
      },
    });
  });

  it('resolves new props', () => {
    let userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    let instance;
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={userPointer} />
        </ContextSetter>,
      );
    });
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    userPointer = environment.lookup(ownerUser2.fragment, ownerUser2).data.node;
    ReactTestRenderer.act(() => {
      instance.getInstance().setProps({
        user: userPointer,
      });
    });

    // New data & variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      user: {
        id: '842472',
        name: 'Joe',
      },
      relay: {
        environment: expect.any(Object),
        refetch: expect.any(Function),
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
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={userPointer} />
        </ContextSetter>,
      );
    });
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    userPointer = environment.lookup(
      ownerUser1WithCondVar.fragment,
      ownerUser1WithCondVar,
    ).data.node;
    ReactTestRenderer.act(() => {
      instance.getInstance().setProps({
        user: userPointer,
      });
    });

    // New data & variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      user: {
        id: '4',
        // Name is excluded since value of cond is now false
      },
      relay: {
        environment: expect.any(Object),
        refetch: expect.any(Function),
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

  it('resolves new props when ids dont change even after it has refetched', () => {
    let userPointer = environment.lookup(ownerUser1.fragment, ownerUser1).data
      .node;
    let instance;
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={userPointer} />
        </ContextSetter>,
      );
    });
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    // Call refetch first
    const refetchVariables = {
      cond: false,
      id: '4',
    };
    const fetchedVariables = {id: '4'};
    ReactTestRenderer.act(() => {
      refetch(refetchVariables, null, jest.fn());
    });
    expect(environment.mock.isLoading(UserQuery, fetchedVariables)).toBe(true);
    expectToWarn(
      'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
      () => {
        ReactTestRenderer.act(() => {
          environment.mock.resolve(UserQuery, {
            data: {
              node: {
                id: '4',
                __typename: 'User',
              },
            },
          });
        });
      },
    );
    render.mockClear();
    environment.subscribe.mockClear();

    // Pass an updated user pointer that references different variables
    userPointer = environment.lookup(
      ownerUser1WithCondVar.fragment,
      ownerUser1WithCondVar,
    ).data.node;
    ReactTestRenderer.act(() => {
      instance.getInstance().setProps({
        user: userPointer,
      });
    });

    // New data & variables are passed to component
    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual({
      user: {
        id: '4',
        // Name is excluded since value of cond is now false
      },
      relay: {
        environment: expect.any(Object),
        refetch: expect.any(Function),
      },
    });
    // Container subscribes for updates on new props
    expect(environment.subscribe.mock.calls.length).toBe(1);
    expect(environment.subscribe.mock.calls[0][0]).toEqual({
      data: {
        id: '4',
        // Name is excluded since value of cond is now false
      },
      fieldErrors: null,
      missingLiveResolverFields: [],
      missingClientEdges: null,
      isMissingData: false,
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
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer user={userPointer} />
        </ContextSetter>,
      );
    });
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    ReactTestRenderer.act(() => {
      instance.getInstance().setProps({
        user: userPointer,
      });
    });

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
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer
            fn={fn}
            nil={null}
            scalar={scalar}
            user={userPointer}
          />
        </ContextSetter>,
      );
    });
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    ReactTestRenderer.act(() => {
      instance.getInstance().setProps({
        fn,
        nil: null,
        scalar,
        user: userPointer,
      });
    });

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
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer fn={fn} scalar={scalar} user={userPointer} />
        </ContextSetter>,
      );
    });
    const initialProps = render.mock.calls[0][0];
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    const nextFn = () => null;
    ReactTestRenderer.act(() => {
      instance.getInstance().setProps({
        fn: nextFn,
        scalar,
        user: userPointer,
      });
    });

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
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer fn={fn} scalar={scalar} user={userPointer} />
        </ContextSetter>,
      );
    });
    const initialProps = render.mock.calls[0][0];
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    ReactTestRenderer.act(() => {
      instance.getInstance().setProps({
        fn,
        scalar: 43,
        user: userPointer,
      });
    });

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
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <ContextSetter environment={environment}>
          <TestContainer arr={[]} obj={{}} user={userPointer} />
        </ContextSetter>,
      );
    });
    const initialProps = render.mock.calls[0][0];
    render.mockClear();
    environment.lookup.mockClear();
    environment.subscribe.mockClear();

    const nextArr = [];
    const nextObj = {};
    ReactTestRenderer.act(() => {
      instance.getInstance().setProps({
        arr: nextArr,
        obj: nextObj,
        user: userPointer,
      });
    });

    expect(render.mock.calls.length).toBe(1);
    expect(render.mock.calls[0][0]).toEqual(initialProps);
    expect(render.mock.calls[0][0].arr).toBe(nextArr);
    expect(render.mock.calls[0][0].obj).toBe(nextObj);
    expect(environment.lookup).not.toBeCalled();
    expect(environment.subscribe).not.toBeCalled();
  });

  describe('refetch()', () => {
    let instance;
    let references;

    beforeEach(() => {
      references = [];
      environment.retain = () => {
        const dispose = jest.fn();
        const ref = {dispose};
        references.push(ref);
        return ref;
      };
      const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1)
        .data.node;
      environment.mock.clearCache();
      ReactTestRenderer.act(() => {
        instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainer user={userPointer} />
          </ContextSetter>,
        );
      });
    });

    it('fetches the new variables', () => {
      const refetchVariables = {
        cond: false,
        id: '4',
      };
      const fetchedVariables = {id: '4'};
      ReactTestRenderer.act(() => {
        refetch(refetchVariables, null, jest.fn());
      });
      expect(environment.mock.isLoading(UserQuery, fetchedVariables)).toBe(
        true,
      );
      expectToWarn(
        'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
        () => {
          ReactTestRenderer.act(() => {
            environment.mock.resolve(UserQuery, {
              data: {
                node: {
                  id: '4',
                  __typename: 'User',
                },
              },
            });
          });
        },
      );
    });

    it('reads data from the store without sending a network request when data is available in store and using store-or-network', () => {
      expect.assertions(3);
      const refetchVariables = {
        cond: false,
        id: '4',
      };
      const refetchOptions = {
        fetchPolicy: 'store-or-network',
      };
      ReactTestRenderer.act(() => {
        refetch(refetchVariables, null, jest.fn(), refetchOptions);
      });
      expect(render.mock.calls.length).toBe(2);
      expect(environment.mock.isLoading(UserQuery, refetchVariables)).toBe(
        false,
      );
      expect(environment.execute).toBeCalledTimes(0);
    });

    it('calls the callback when the fetch succeeds', () => {
      expect.assertions(2);
      const callback = jest.fn();
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, callback);
      });
      expectToWarn(
        'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
        () => {
          ReactTestRenderer.act(() => {
            environment.mock.resolve(UserQuery, {
              data: {
                node: {
                  id: '4',
                  __typename: 'User',
                },
              },
            });
          });
        },
      );
      expect(callback.mock.calls.length).toBe(1);
      expect(callback).toBeCalledWith(undefined);
    });

    it('calls the callback when the fetch succeeds after every update', () => {
      const callback = jest.fn();
      variables = {
        cond: false,
        id: '4',
      };
      refetch(variables, null, callback);
      expectToWarn(
        'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
        () => {
          ReactTestRenderer.act(() => {
            environment.mock.nextValue(UserQuery, {
              data: {
                node: {
                  id: '4',
                  __typename: 'User',
                },
              },
            });
          });
        },
      );
      expect(callback.mock.calls.length).toBe(1);
      expect(callback).toBeCalledWith(undefined);

      expectToWarn(
        'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
        () => {
          ReactTestRenderer.act(() => {
            environment.mock.nextValue(UserQuery, {
              data: {
                node: {
                  id: '4',
                  __typename: 'User',
                },
              },
            });
          });
        },
      );
      expect(callback.mock.calls.length).toBe(2);
      expect(callback).toBeCalledWith(undefined);

      environment.mock.complete(UserQuery);
      expect(callback.mock.calls.length).toBe(2);
    });

    it('calls the callback when the fetch fails', () => {
      expect.assertions(2);
      const callback = jest.fn();
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, callback);
      });
      const error = new Error('oops');
      environment.mock.reject(UserQuery, error);
      expect(callback.mock.calls.length).toBe(1);
      expect(callback).toBeCalledWith(error);
    });

    it('calls the callback even if the response is cached', () => {
      const refetchVariables = {
        cond: false,
        id: '4',
      };
      const fetchedVariables = {id: '4'};
      environment.mock.cachePayload(UserQuery, fetchedVariables, {
        data: {
          node: {
            id: '4',
            __typename: 'User',
            name: 'Zuck',
          },
        },
      });
      const callback = jest.fn();
      ReactTestRenderer.act(() => {
        refetch(refetchVariables, null, callback);
      });
      expect(callback).toHaveBeenCalled();
    });

    it('returns false for isLoading if the response comes from cache', () => {
      const refetchVariables = {
        cond: false,
        id: '4',
      };
      const fetchedVariables = {id: '4'};
      environment.mock.cachePayload(UserQuery, fetchedVariables, {
        data: {
          node: {
            id: '4',
            __typename: 'User',
            name: 'Zuck',
          },
        },
      });
      ReactTestRenderer.act(() => {
        refetch(refetchVariables, null, jest.fn());
      });
      expect(environment.mock.isLoading(UserQuery, fetchedVariables)).toBe(
        false,
      );
    });

    it('renders with the results of the new variables on success', () => {
      expect.assertions(5);
      expect(render.mock.calls.length).toBe(1);
      expect(render.mock.calls[0][0].user.name).toBe('Zuck');
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, jest.fn());
      });
      expect(render.mock.calls.length).toBe(1);
      ReactTestRenderer.act(() => {
        environment.mock.resolve(UserQuery, {
          data: {
            node: {
              id: '4',
              __typename: 'User',
              name: 'Zuck',
            },
          },
        });
      });
      expect(render.mock.calls.length).toBe(2);
      expect(render.mock.calls[1][0].user.name).toBe(undefined);
    });

    it('does not update variables on failure', () => {
      expect.assertions(4);
      expect(render.mock.calls.length).toBe(1);
      expect(render.mock.calls[0][0].user.name).toBe('Zuck');
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, jest.fn());
      });
      expect(render.mock.calls.length).toBe(1);
      ReactTestRenderer.act(() => {
        environment.mock.reject(UserQuery, new Error('oops'));
      });
      expect(render.mock.calls.length).toBe(1);
    });

    it('continues the fetch if new props refer to the same records', () => {
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, jest.fn());
      });
      const subscription = environment.execute.mock.subscriptions[0];
      const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1)
        .data.node;
      ReactTestRenderer.act(() => {
        instance.getInstance().setProps({user: userPointer});
      });
      expect(subscription.closed).toBe(false);
    });

    it('cancels the fetch if new props refer to different records', () => {
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, jest.fn());
      });
      const subscription = environment.execute.mock.subscriptions[0];
      const userPointer = environment.lookup(ownerUser2.fragment, ownerUser2)
        .data.node;
      ReactTestRenderer.act(() => {
        instance.getInstance().setProps({user: userPointer});
      });
      expect(subscription.closed).toBe(true);
    });

    it('holds refetch results if new props refer to the same records', () => {
      expect.assertions(2);
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, jest.fn());
      });
      expectToWarn(
        'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
        () => {
          ReactTestRenderer.act(() => {
            environment.mock.resolve(UserQuery, {
              data: {
                node: {
                  id: '4',
                  __typename: 'User',
                },
              },
            });
          });
        },
      );
      const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1)
        .data.node;
      ReactTestRenderer.act(() => {
        instance.getInstance().setProps({user: userPointer});
      });
      expect(references.length).toBe(1);
      expect(references[0].dispose).not.toBeCalled();
    });

    it('releases refetch results if new props refer to different records', () => {
      expect.assertions(2);
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, jest.fn());
      });

      expectToWarn(
        'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
        () => {
          ReactTestRenderer.act(() => {
            environment.mock.resolve(UserQuery, {
              data: {
                node: {
                  id: '4',
                  __typename: 'User',
                },
              },
            });
          });
        },
      );
      const userPointer = environment.lookup(ownerUser2.fragment, ownerUser2)
        .data.node;
      ReactTestRenderer.act(() => {
        instance.getInstance().setProps({user: userPointer});
      });
      expect(references.length).toBe(1);
      expect(references[0].dispose).toBeCalled();
    });

    it('releases refetch results if unmounted', () => {
      expect.assertions(2);
      variables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(variables, null, jest.fn());
      });
      expectToWarn(
        'RelayResponseNormalizer: Payload did not contain a value for field `name: name`. Check that you are parsing with the same query that was used to fetch the payload.',
        () => {
          ReactTestRenderer.act(() => {
            environment.mock.resolve(UserQuery, {
              data: {
                node: {
                  id: '4',
                  __typename: 'User',
                },
              },
            });
          });
        },
      );
      ReactTestRenderer.act(() => {
        instance.unmount();
      });
      expect(references.length).toBe(1);
      expect(references[0].dispose).toBeCalled();
    });

    it('cancels previous request when a new refetch occurs first', () => {
      const refetchVariables = {
        cond: false,
        id: '4',
      };
      ReactTestRenderer.act(() => {
        refetch(refetchVariables, null, jest.fn());
      });
      const subscription1 = environment.execute.mock.subscriptions[0];

      const refetchVariables2 = {
        cond: false,
        id: '11',
      };
      ReactTestRenderer.act(() => {
        refetch(refetchVariables2, null, jest.fn());
      });
      const subscription2 = environment.execute.mock.subscriptions[1];

      expect(subscription1.closed).toBe(true);
      expect(subscription2.closed).toBe(false);
    });

    it('does not cancel current request if previous request is disposed', () => {
      const refetchVariables = {
        cond: false,
        id: '4',
      };
      let disposable1;
      ReactTestRenderer.act(() => {
        disposable1 = refetch(refetchVariables, null, jest.fn());
      });
      const subscription1 = environment.execute.mock.subscriptions[0];
      expect(subscription1.closed).toBe(false);

      const refetchVariables2 = {
        cond: false,
        id: '11',
      };
      let disposable2;
      ReactTestRenderer.act(() => {
        disposable2 = refetch(refetchVariables2, null, jest.fn());
      });
      const subscription2 = environment.execute.mock.subscriptions[1];
      expect(subscription1.closed).toBe(true);
      expect(subscription2.closed).toBe(false);

      ReactTestRenderer.act(() => {
        disposable1.dispose();
      });
      expect(subscription1.closed).toBe(true);
      expect(subscription2.closed).toBe(false);

      ReactTestRenderer.act(() => {
        disposable2.dispose();
      });
      expect(subscription1.closed).toBe(true);
      expect(subscription2.closed).toBe(true);
    });

    it('should not refetch data is container unmounted', () => {
      const userPointer = environment.lookup(ownerUser1.fragment, ownerUser1)
        .data.node;

      class TestContainerWrapper extends React.Component {
        state = {
          mounted: true,
        };
        componentDidMount() {
          setTimeout(() => {
            this.setState({mounted: false});
          }, 1);
        }
        render() {
          return this.state.mounted ? (
            <TestContainer user={userPointer} />
          ) : null;
        }
      }

      ReactTestRenderer.act(() => {
        instance = ReactTestRenderer.create(
          <ContextSetter environment={environment}>
            <TestContainerWrapper />
          </ContextSetter>,
        );
      });

      ReactTestRenderer.act(() => {
        jest.runOnlyPendingTimers();
      });

      const callback = jest.fn();
      expectToWarn(
        'ReactRelayRefetchContainer: Unexpected call of `refetch` on unmounted container `Relay(TestComponent)`. It looks like some instances of your container still trying to refetch the data but they already unmounted. Please make sure you clear all timers, intervals, async calls, etc that may trigger `refetch`.',
        () => {
          ReactTestRenderer.act(() => {
            refetch({}, null, callback);
          });
        },
      );
      expect(callback).not.toBeCalled();
    });
  });

  it('can be unwrapped in tests', () => {
    class TestUnwrapping extends React.Component {
      render() {
        return <div>Unwrapped</div>;
      }
    }

    const TestUnwrappingContainer = ReactRelayRefetchContainer.createContainer(
      TestUnwrapping,
      {
        user: UserFragment,
      },
    );

    const UnwrappedComponent = unwrapContainer(TestUnwrappingContainer);

    let renderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <UnwrappedComponent user={{id: '4', name: 'Mark'}} />,
      );
    });

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

    it('upon commit, it should pick up changes in data that happened before committing', () => {
      const Scheduler = require('scheduler');
      const YieldChild = props => {
        Scheduler.log(props.children);
        return props.children;
      };
      const YieldyUserComponent = ({user, relay}) => {
        render({user, relay});
        return (
          <>
            <YieldChild>Hey user,</YieldChild>
            <YieldChild>{user?.name ?? 'no name'}</YieldChild>
            <YieldChild>with id {user?.id ?? 'no id'}!</YieldChild>
          </>
        );
      };

      // Assert initial render
      const TestYieldyContainer = ReactRelayRefetchContainer.createContainer(
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
        expect(render.mock.calls[0][0]).toMatchObject({
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
        expect(render.mock.calls[0][0]).toMatchObject({
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
