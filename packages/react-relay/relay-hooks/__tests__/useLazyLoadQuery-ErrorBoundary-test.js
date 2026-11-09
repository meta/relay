/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall relay
 */

'use strict';

jest.mock('scheduler', () => require('scheduler/unstable_mock'));

import type {IEnvironment} from 'relay-runtime';
import type {useLazyLoadQueryErrorBoundaryTestFragment$key} from './__generated__/useLazyLoadQueryErrorBoundaryTestFragment.graphql';

const React = require('react');
const {
  Network,
  Environment,
  RecordSource,
  Store,
  graphql,
  Observable,
} = require('relay-runtime');
const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useLazyLoadQuery = require('../useLazyLoadQuery');
const useFragment = require('../useFragment');

const TestRenderer = require('react-test-renderer');

type ErrorBoundaryState = {
  error: Error | null,
};

class ErrorBoundary extends React.Component<
  {
    children: React.Node,
  },
  ErrorBoundaryState,
> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): {error: Error} {
    return {error};
  }

  render(): React.Node {
    const {error} = this.state;

    if (error) {
      return (
        <div>
          {error.name}: {error.message}
        </div>
      );
    }

    return this.props.children;
  }
}

function Boundary({children}: {children: React.Node}) {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={'Loading...'}>{children}</React.Suspense>
    </ErrorBoundary>
  );
}

function Parent({renderPolicy}: {renderPolicy: string}): React.Node {
  const query = useLazyLoadQuery(
    graphql`
      query useLazyLoadQueryErrorBoundaryTestQuery {
        ...useLazyLoadQueryErrorBoundaryTestFragment
      }
    `,
    {},
    // The issue happens with `store-and-network` and `store-or-network`
    // but not with `network-only`, that mode correctly bubbles the error
    {fetchPolicy: 'store-and-network', UNSTABLE_renderPolicy: renderPolicy},
  );

  return <Inner query={query} />;
}

function Inner(props: {
  query: useLazyLoadQueryErrorBoundaryTestFragment$key,
}): React.Node {
  const query = useFragment(
    graphql`
      fragment useLazyLoadQueryErrorBoundaryTestFragment on Query {
        viewer {
          actor {
            name
          }
        }
      }
    `,
    props.query,
  );

  // Attempting to access `query.product.name` here will cause an JS error because the component
  // is rendered and the data is unavailable. It should never make it to this point because the
  // network error should have halted rendering.
  return <div>{query.viewer?.actor?.name}</div>;
}

function RelayProvider(props: {
  children: React.Node,
  environment: IEnvironment,
}) {
  return (
    <RelayEnvironmentProvider environment={props.environment}>
      {props.children}
    </RelayEnvironmentProvider>
  );
}

function App({
  environment,
  renderPolicy,
}: {
  environment: IEnvironment,
  renderPolicy: string,
}) {
  const [load, setLoad] = React.useState(true);

  return (
    <RelayProvider environment={environment}>
      <Boundary>
        {load ? (
          <Parent renderPolicy={renderPolicy} />
        ) : (
          <button onClick={() => setLoad(true)}>Mount Query component</button>
        )}
      </Boundary>
    </RelayProvider>
  );
}

describe.each([
  ['full', true],
  ['partial', true],
  ['full', false],
  ['partial', false],
])(
  'useLazyLoadQueryNode with ErrorBoundary with (renderPolicy = %s, unstable_isConcurrent = %s)',
  (renderPolicy, unstable_isConcurrent) => {
    let environment;
    beforeEach(() => {
      environment = new Environment({
        network: Network.create(() => {
          return Observable.from(Promise.reject(new Error('Test')));
        }),
        store: new Store(new RecordSource()),
      });
    });

    it('should throw an error when the query fails', () => {
      let renderer;
      TestRenderer.act(() => {
        renderer = TestRenderer.create(
          <App environment={environment} renderPolicy={renderPolicy} />,
          ({
            unstable_isConcurrent,
          }: $FlowFixMe),
        );
      });
      expect(renderer?.toJSON()).toMatchSnapshot('[Initial Render]');
      TestRenderer.act(() => {
        jest.runAllImmediates();
      });
      expect(renderer?.toJSON()).toMatchSnapshot('[Render after request]');
    });
  },
);
