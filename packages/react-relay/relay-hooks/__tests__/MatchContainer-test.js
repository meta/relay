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

import type {MatchPointer} from '../MatchContainer';

const MatchContainer = require('../MatchContainer');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const {FRAGMENT_OWNER_KEY, FRAGMENTS_KEY, ID_KEY} = require('relay-runtime');

function createMatchPointer({
  id,
  fragment,
  variables,
  propName,
  module,
}: {
  fragment: {name: string},
  id: string,
  module: string,
  propName: string,
  variables: any,
}): MatchPointer {
  const pointer = {
    __fragmentPropName: propName,
    __module_component: module,
    $fragmentSpreads: {},
    [FRAGMENT_OWNER_KEY]: null,
    [FRAGMENTS_KEY]: {} as {[key: string]: {...}},
    [ID_KEY]: id,
  };
  if (fragment != null && variables != null) {
    pointer[FRAGMENTS_KEY][fragment.name] = variables;
  }
  return pointer;
}

describe('MatchContainer', () => {
  let ActorComponent;
  let UserComponent;
  let loader;

  beforeEach(() => {
    jest.resetModules();

    loader = jest.fn<[unknown], component(...any)>();
    // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
    UserComponent = jest.fn(props => (
      <div>
        <h1>User</h1>
        <pre>{JSON.stringify(props, null, 2)}</pre>
      </div>
    ));
    // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
    ActorComponent = jest.fn(props => (
      <div>
        <h1>Actor</h1>
        <pre>{JSON.stringify(props, null, 2)}</pre>
      </div>
    ));
  });

  it('throws when match prop is null', async () => {
    // This prevents console.error output in the test, which is expected
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    await expect(async () => {
      await act(() => {
        ReactTestingLibrary.render(
          <MatchContainer loader={loader} match={42 as $FlowFixMe} />,
        );
      });
    }).rejects.toThrow(
      'MatchContainer: Expected `match` value to be an object or null/undefined.',
    );
  });

  it('loads and renders dynamic components', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const match = createMatchPointer({
      fragment: {name: 'UserFragment'},
      id: '4',
      module: 'UserContainer.react',
      propName: 'user',
      variables: {},
    });
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={match}
          props={{otherProp: 'hello!'}}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(1);
    expect(UserComponent).toBeCalledTimes(1);
  });

  it('reloads if new props have a different component', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const match = createMatchPointer({
      fragment: {name: 'UserFragment'},
      id: '4',
      module: 'UserContainer.react',
      propName: 'user',
      variables: {},
    });
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={match}
          props={{otherProp: 'hello!'}}
        />,
      );
    });
    loader.mockReturnValue(React.memo(ActorComponent as $FlowFixMe));
    const match2 = createMatchPointer({
      fragment: {name: 'ActorFragment'},
      id: '4',
      module: 'ActorContainer.react',
      propName: 'actor',
      variables: {},
    });
    await act(() => {
      renderer.rerender(
        <MatchContainer
          loader={loader}
          match={match2}
          props={{otherProp: 'hello!'}}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(2);
    expect(UserComponent).toBeCalledTimes(1);
    expect(ActorComponent).toBeCalledTimes(1);
  });

  it('calls load again when re-rendered, even with the same component', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const match = createMatchPointer({
      fragment: {name: 'UserFragment'},
      id: '4',
      module: 'UserContainer.react',
      propName: 'user',
      variables: {},
    });
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={match}
          props={{otherProp: 'hello!'}}
        />,
      );
    });
    const match2 = {...match, __id: '0'};
    await act(() => {
      renderer.rerender(
        <MatchContainer
          loader={loader}
          match={match2}
          props={{otherProp: 'hello!'}}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    // We expect loader to already be caching module results
    expect(loader).toBeCalledTimes(2);
    expect(UserComponent).toBeCalledTimes(2);
    expect(ActorComponent).toBeCalledTimes(0);
  });

  it('passes the same child props when the match values does not change', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const match = createMatchPointer({
      fragment: {name: 'UserFragment'},
      id: '4',
      module: 'UserContainer.react',
      propName: 'user',
      variables: {},
    });
    const otherProps = {otherProp: 'hello!'};
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer loader={loader} match={match} props={otherProps} />,
      );
    });
    const match2 = {...match};
    await act(() => {
      renderer.rerender(
        <MatchContainer loader={loader} match={match2} props={otherProps} />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(2);
    expect(UserComponent).toBeCalledTimes(1);
  });

  it('renders the fallback if the match object is empty', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={{} as $FlowFixMe} // intentionally empty
          props={otherProps}
          fallback={(<Fallback />) as $FlowFixMe}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(0);
    expect(UserComponent).toBeCalledTimes(0);
    expect(ActorComponent).toBeCalledTimes(0);
    expect(Fallback).toBeCalledTimes(1);
  });

  it('renders the fallback if the match object is missing expected fields', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={
            {
              __fragmentOwner: null,
              __fragmentPropName: null,
              __fragments: null,
              __id: null,
              __module_component: null,
            } as $FlowFixMe
          } // intentionally all null
          props={otherProps}
          fallback={(<Fallback />) as $FlowFixMe}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(0);
    expect(UserComponent).toBeCalledTimes(0);
    expect(ActorComponent).toBeCalledTimes(0);
    expect(Fallback).toBeCalledTimes(1);
  });

  it('throws if the match object is invalid (__id)', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    await expect(async () => {
      await act(() => {
        ReactTestingLibrary.render(
          <MatchContainer
            loader={loader}
            match={
              {
                __fragmentOwner: null,
                __fragmentPropName: null,
                __fragments: null,
                __id: 42, // not a string
                __module_component: null,
              } as $FlowFixMe
            } // intentionally all null
            props={otherProps}
            fallback={(<Fallback />) as $FlowFixMe}
          />,
        );
      });
    }).rejects.toThrow(
      "MatchContainer: Invalid 'match' value, expected an object that has a '...SomeFragment' spread.",
    );
  });

  it('throws if the match object is invalid (__fragments)', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    await expect(async () => {
      await act(() => {
        ReactTestingLibrary.render(
          <MatchContainer
            loader={loader}
            match={
              {
                __fragmentOwner: null,
                __fragmentPropName: null,
                __fragments: 42, // not an object
                __id: null,
                __module_component: null,
              } as $FlowFixMe
            } // intentionally all null
            props={otherProps}
            fallback={(<Fallback />) as $FlowFixMe}
          />,
        );
      });
    }).rejects.toThrow(
      "MatchContainer: Invalid 'match' value, expected an object that has a '...SomeFragment' spread.",
    );
  });

  it('throws if the match object is invalid (__fragmentOwner)', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    await expect(async () => {
      await act(() => {
        ReactTestingLibrary.render(
          <MatchContainer
            loader={loader}
            match={
              {
                __fragmentOwner: 42, // not an object
                __fragmentPropName: null,
                __fragments: null,
                __id: null,
                __module_component: null,
              } as $FlowFixMe
            } // intentionally all null
            props={otherProps}
            fallback={(<Fallback />) as $FlowFixMe}
          />,
        );
      });
    }).rejects.toThrow(
      "MatchContainer: Invalid 'match' value, expected an object that has a '...SomeFragment' spread.",
    );
  });

  it('throws if the match object is invalid (__fragmentPropName)', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    await expect(async () => {
      await act(() => {
        ReactTestingLibrary.render(
          <MatchContainer
            loader={loader}
            match={
              {
                __fragmentOwner: null,
                __fragmentPropName: 42, // not a string
                __fragments: null,
                __id: null,
                __module_component: null,
              } as $FlowFixMe
            } // intentionally all null
            props={otherProps}
            fallback={(<Fallback />) as $FlowFixMe}
          />,
        );
      });
    }).rejects.toThrow(
      "MatchContainer: Invalid 'match' value, expected an object that has a '...SomeFragment' spread.",
    );
  });

  it('renders the fallback if the match value is null', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={null}
          props={otherProps}
          fallback={(<Fallback />) as $FlowFixMe}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(0);
    expect(UserComponent).toBeCalledTimes(0);
    expect(ActorComponent).toBeCalledTimes(0);
    expect(Fallback).toBeCalledTimes(1);
  });

  it('renders null if the match value is null and no fallback is provided', () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const renderer = ReactTestingLibrary.render(
      <MatchContainer loader={loader} match={null} props={otherProps} />,
    );
    expect(renderer.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(0);
    expect(UserComponent).toBeCalledTimes(0);
    expect(ActorComponent).toBeCalledTimes(0);
  });

  it('renders the fallback if the match value is undefined', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const otherProps = {otherProp: 'hello!'};
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={undefined}
          props={otherProps}
          fallback={(<Fallback />) as $FlowFixMe}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(0);
    expect(UserComponent).toBeCalledTimes(0);
    expect(ActorComponent).toBeCalledTimes(0);
    expect(Fallback).toBeCalledTimes(1);
  });

  it('transitions from fallback when new props have a component', async () => {
    loader.mockReturnValue(React.memo(UserComponent as $FlowFixMe));
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={{} as $FlowFixMe} // intentionally empty
          props={{otherProp: 'hello!'}}
          fallback={<Fallback />}
        />,
      );
    });
    expect(Fallback).toBeCalledTimes(1);
    loader.mockReturnValue(React.memo(ActorComponent as $FlowFixMe));
    const match2 = createMatchPointer({
      fragment: {name: 'ActorFragment'},
      id: '4',
      module: 'ActorContainer.react',
      propName: 'actor',
      variables: {},
    });

    await act(() => {
      renderer.rerender(
        <MatchContainer
          loader={loader}
          match={match2}
          props={{otherProp: 'hello!'}}
          fallback={<Fallback />}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(1);
    expect(UserComponent).toBeCalledTimes(0);
    expect(ActorComponent).toBeCalledTimes(1);
  });

  it('transitions to fallback when new props have a null component', async () => {
    loader.mockReturnValue(React.memo(ActorComponent as $FlowFixMe));
    const match = createMatchPointer({
      fragment: {name: 'ActorFragment'},
      id: '4',
      module: 'ActorContainer.react',
      propName: 'actor',
      variables: {},
    });
    const Fallback: $FlowFixMe = jest.fn(() => <div>fallback</div>);
    let renderer;
    await act(() => {
      renderer = ReactTestingLibrary.render(
        <MatchContainer
          loader={loader}
          match={match}
          props={{otherProp: 'hello!'}}
          fallback={<Fallback />}
        />,
      );
    });
    expect(ActorComponent).toBeCalledTimes(1);
    await act(() => {
      renderer.rerender(
        <MatchContainer
          loader={loader}
          match={{} as $FlowFixMe} // intentionally empty
          props={{otherProp: 'hello!'}}
          fallback={<Fallback />}
        />,
      );
    });
    expect(renderer?.container).toMatchSnapshot();
    expect(loader).toBeCalledTimes(1);
    expect(Fallback).toBeCalledTimes(1);
    expect(UserComponent).toBeCalledTimes(0);
  });
});
