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

const ReactRelayContext = require('../ReactRelayContext');
const ReactRelayLocalQueryRenderer = require('../ReactRelayLocalQueryRenderer');
const ReactRelayQueryRendererContext = require('../ReactRelayQueryRendererContext');
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const {
  RecordSource,
  ROOT_ID,
  ROOT_TYPE,
  Store,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {
  createMockEnvironment,
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();

const {useContext} = React;

describe('ReactRelayLocalQueryRenderer', () => {
  graphql`
    fragment ReactRelayLocalQueryRendererTestUserFragment on User {
      name
    }
  `;
  const UserQuery = graphql`
    query ReactRelayLocalQueryRendererTestUserQuery($id: ID = "<default>") {
      node(id: $id) {
        id
        ... on User {
          lastName
        }
        ...ReactRelayLocalQueryRendererTestUserFragment
          @dangerously_unaliased_fixme
      }
    }
  `;

  let environment;
  let variables;
  let render;
  let operation;
  let setProps;

  const renderer = (env, query, renderFn, vars, opts) => {
    let instance;
    ReactTestRenderer.act(() => {
      instance = ReactTestRenderer.create(
        <PropsSetter>
          <ReactRelayLocalQueryRenderer
            environment={env}
            query={query}
            render={renderFn}
            variables={vars}
          />
        </PropsSetter>,
        opts,
      );
    });
    return instance;
  };

  class PropsSetter extends React.Component {
    constructor() {
      super();
      this.state = {
        props: null,
      };
      setProps = this.setProps.bind(this);
    }
    setProps(props) {
      this.setState({props});
    }
    render() {
      const child = React.Children.only(this.props.children);
      if (this.state.props) {
        return React.cloneElement(child, this.state.props);
      }
      return child;
    }
  }

  beforeEach(() => {
    environment = createMockEnvironment({
      store: new Store(new RecordSource(), {gcReleaseBufferSize: 0}),
    });

    variables = {id: '4'};
    operation = createOperationDescriptor(UserQuery, variables);
    render = jest.fn(({props}) => props?.node?.lastName);
  });

  describe('when initialized', () => {
    it('sets context correctly', () => {
      let relayContext;
      function ContextGetter() {
        relayContext = useContext(ReactRelayContext);
        return null;
      }
      render = jest.fn(() => <ContextGetter />);
      ReactTestRenderer.act(() => {
        renderer(environment, UserQuery, render, variables);
      });
      expect(relayContext).toEqual({
        environment,
      });
    });

    it('renders with the query data if the data exists in the store', () => {
      const payload = {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Zuck',
          lastName: 'Mark',
        },
      };
      environment.commitPayload(operation, payload);
      const instance = renderer(environment, UserQuery, render, variables);
      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(environment.retain).toBeCalledTimes(1);
      expect(environment.check).toBeCalledTimes(1);
      expect(environment.subscribe).toBeCalledTimes(1);
      expect(render).toBeCalledTimes(1);
      expect(render.mock.calls[0][0]).toEqual({
        props: environment.lookup(operation.fragment, operation).data,
      });
      expect(instance.toJSON()).toEqual('Mark');
    });

    it('renders with undefined if query data does not exist in store', () => {
      ReactTestRenderer.act(() => {
        renderer(environment, UserQuery, render, variables);
      });
      expect(render).toBeCalledTimes(1);
      expect(render.mock.calls[0][0].props).toEqual({node: undefined});
      expect(environment.execute).not.toBeCalled();
    });

    it('renders with partial query data if the data partially exist in store', () => {
      const payload = {
        node: {
          __typename: 'User',
          id: '4',
          lastName: 'Mark',
        },
      };
      environment.commitPayload(operation, payload);
      const instance = renderer(environment, UserQuery, render, variables);
      expect(environment.getStore().getSource().get('4')).toEqual({
        __id: '4',
        __typename: 'User',
        id: '4',
        lastName: 'Mark',
      });
      expect(instance.toJSON()).toEqual('Mark');
    });

    it('retains data correctly', () => {
      const payload = {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Zuck',
          lastName: 'Mark',
        },
      };
      environment.commitPayload(operation, payload);
      const instance = renderer(environment, UserQuery, render, variables);
      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(environment.retain).toBeCalledTimes(1);
      const snapshot = environment.lookup(operation.fragment, operation);
      ReactTestRenderer.act(() => jest.runAllTimers());
      environment.getStore().__gc();
      // Data should not change
      expect(environment.getStore().getSource().toJSON()).not.toEqual({});
      expect(environment.lookup(operation.fragment, operation)).toEqual(
        snapshot,
      );
      expect(instance.toJSON()).toBe('Mark');
    });
  });

  describe('when store data updates', () => {
    it('renders with new data', () => {
      const payload = {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Zuck',
          lastName: 'Mark',
        },
      };
      environment.commitPayload(operation, payload);

      const instance = renderer(environment, UserQuery, render, variables);
      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(render).toBeCalledTimes(1);
      render.mockClear();

      ReactTestRenderer.act(() => {
        environment.commitPayload(operation, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Bob',
            lastName: 'Alice',
          },
        });
      });

      expect(render).toBeCalledTimes(1);
      const snapshot = environment.lookup(operation.fragment, operation);
      expect(render.mock.calls[0][0]).toEqual({props: snapshot.data});

      expect(instance.toJSON()).toEqual('Alice');
    });

    it('subscribes to changes if initial data is undefined', () => {
      const instance = renderer(environment, UserQuery, render, variables);
      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(render).toBeCalledTimes(1);
      expect(instance.toJSON()).toEqual(null);
      render.mockClear();

      ReactTestRenderer.act(() => {
        environment.commitPayload(operation, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Zurk',
            lastName: 'Mark',
          },
        });
      });

      expect(render).toBeCalledTimes(1);
      const snapshot = environment.lookup(operation.fragment, operation);
      expect(render.mock.calls[0][0]).toEqual({props: snapshot.data});
      expect(instance.toJSON()).toEqual('Mark');
    });
  });

  describe('when variables or environment change', () => {
    const payload = {
      node: {
        __typename: 'User',
        id: '4',
        name: 'Zurk',
        lastName: 'Mark',
      },
    };

    it('renders new data if the variables change', () => {
      const secondVariables = {id: '5'};
      const secondOperation = createOperationDescriptor(
        UserQuery,
        secondVariables,
      );
      const secondPayload = {
        node: {
          __typename: 'User',
          id: '5',
          name: 'Kcuz',
          lastName: 'Kram',
        },
      };
      environment.commitPayload(operation, payload);
      const instance = renderer(environment, UserQuery, render, variables);
      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(render).toBeCalledTimes(1);
      expect(instance.toJSON()).toEqual('Mark');
      render.mockClear();

      environment.commitPayload(secondOperation, secondPayload);
      ReactTestRenderer.act(() => {
        setProps({variables: secondVariables});
      });
      ReactTestRenderer.act(() => {
        jest.runAllImmediates();
      });

      expect(environment.retain).toBeCalledTimes(2);
      expect(environment.check).toBeCalledTimes(2);
      expect(environment.subscribe).toBeCalledTimes(2);

      expect(render).toBeCalledTimes(1);

      const snapshot = environment.lookup(
        secondOperation.fragment,
        secondOperation,
      );
      expect(render.mock.calls[0][0]).toEqual({props: snapshot.data});

      expect(instance.toJSON()).toEqual('Kram');

      ReactTestRenderer.act(() => {
        setProps({variables: {id: '6'}});
      });
      ReactTestRenderer.act(() => {
        jest.runAllImmediates();
      });
      expect(render).toBeCalledTimes(2);
      expect(instance.toJSON()).toEqual(null);
    });

    it('renders new data if the environment changes', () => {
      const newEnvironment = createMockEnvironment({
        store: new Store(new RecordSource(), {gcReleaseBufferSize: 0}),
      });
      environment.commitPayload(operation, payload);
      const instance = renderer(environment, UserQuery, render, variables);
      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(render).toBeCalledTimes(1);
      expect(instance.toJSON()).toEqual('Mark');
      render.mockClear();

      newEnvironment.commitPayload(operation, {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Kcuz',
          lastName: 'Kram',
        },
      });
      ReactTestRenderer.act(() => {
        setProps({environment: newEnvironment});
      });
      expect(render).toBeCalledTimes(1);
      expect(instance.toJSON()).toEqual('Kram');
    });

    it('renders new data if the query changes', () => {
      environment.commitPayload(operation, payload);
      const instance = renderer(environment, UserQuery, render, variables);

      expect(render).toBeCalledTimes(1);
      expect(instance.toJSON()).toEqual('Mark');
      render.mockClear();

      const SecondUserQuery = graphql`
        query ReactRelayLocalQueryRendererTestSecondUserQuery(
          $id: ID = "<default>"
        ) {
          node(id: $id) {
            id
            ... on User {
              lastName
            }
          }
        }
      `;

      ReactTestRenderer.act(() => {
        setProps({query: SecondUserQuery});
      });
      const secondOperation = createOperationDescriptor(
        SecondUserQuery,
        variables,
      );
      const snapshot = environment.lookup(
        secondOperation.fragment,
        secondOperation,
      );
      expect(render).toBeCalledTimes(1);
      expect(render.mock.calls[0][0]).toEqual({props: snapshot.data});

      expect(instance.toJSON()).toEqual('Mark');

      ReactTestRenderer.act(() => {
        environment.commitPayload(secondOperation, {
          node: {
            __typename: 'User',
            id: '4',
            lastName: 'Kram',
          },
        });
      });
      expect(instance.toJSON()).toEqual('Kram');
    });

    it('disposes old observers when the varaibles change', () => {
      environment.commitPayload(operation, payload);
      const instance = renderer(environment, UserQuery, render, variables);
      expect(instance.toJSON()).toEqual('Mark');
      ReactTestRenderer.act(() => {
        setProps({variables: {id: '5'}});
      });

      expect(instance.toJSON()).toEqual(null);
      render.mockClear();

      // old data should be collected by GC
      environment.getStore().__gc();
      jest.runAllImmediates();
      expect(
        environment.lookup(operation.fragment, operation).data.node,
      ).toBeUndefined();
      // update on old id shouldn't trigger render
      ReactTestRenderer.act(() => {
        environment.commitPayload(operation, payload);
      });
      expect(render).not.toBeCalled();
    });
  });

  describe('when unmounts', () => {
    const payload = {
      node: {
        __typename: 'User',
        id: '4',
        name: 'Zurk',
        lastName: 'Mark',
      },
    };

    it('disposes old observers', () => {
      environment.commitPayload(operation, payload);
      const instance = renderer(environment, UserQuery, render, variables);
      expect(instance.toJSON()).toEqual('Mark');
      render.mockClear();
      instance.unmount();
      // make sure GC runs
      environment.getStore().__gc();
      jest.runAllImmediates();
      expect(environment.lookup(operation.fragment, operation).data).toEqual({
        node: undefined,
      });
      environment.commitPayload(operation, payload);
      expect(render).not.toBeCalled();
    });
  });

  describe('useEffect', () => {
    let instance;

    beforeEach(() => {
      const payload = {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Zuck',
          lastName: 'Mark',
        },
      };
      environment.commitPayload(operation, payload);
      instance = renderer(environment, UserQuery, render, variables);
    });

    it('runs after GC, data should not be collected by GC', () => {
      const snapshot = environment.lookup(operation.fragment, operation);
      expect(snapshot.data).toBeDefined();
      // Data should not be collected by GC
      environment.getStore().__gc();
      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(environment.getStore().getSource().toJSON()).not.toEqual({});

      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(environment.lookup(operation.fragment, operation)).toEqual(
        snapshot,
      );
      expect(instance.toJSON()).toBe('Mark');
    });

    it('runs after commiting another payload, latest data should be rendered', () => {
      ReactTestRenderer.act(() => {
        environment.commitPayload(operation, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Zuck',
            lastName: 'Alice',
          },
        });
      });

      ReactTestRenderer.act(() => jest.runAllImmediates());
      expect(instance.toJSON()).toBe('Alice');
    });

    it('never runs before unmount, data retain should be released', () => {
      ReactTestRenderer.act(() => instance.unmount());
      jest.runAllTimers();
      expect(environment.getStore().getSource().toJSON()).toEqual({
        [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE},
      });
    });
  });

  describe('QueryRenderer context', () => {
    let queryRendererContext;
    let ContextGetter;

    beforeEach(() => {
      ContextGetter = () => {
        queryRendererContext = useContext(ReactRelayQueryRendererContext);
        return null;
      };

      render = jest.fn(() => <ContextGetter />);
    });

    it('sets QueryRenderer context', () => {
      expect.assertions(1);
      ReactTestRenderer.act(() => {
        renderer(environment, UserQuery, render, variables);
      });

      expect(queryRendererContext.rootIsQueryRenderer).toBe(true);
    });

    it('default context', () => {
      expect.assertions(1);
      ReactTestRenderer.act(() => {
        ReactTestRenderer.create(<ContextGetter />);
      });
      expect(queryRendererContext.rootIsQueryRenderer).toBe(false);
    });
  });
});
