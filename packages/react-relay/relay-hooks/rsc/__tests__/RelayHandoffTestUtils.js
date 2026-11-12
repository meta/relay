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

import type {IEnvironment} from 'relay-runtime';

const RelayEnvironmentProvider = require('../../RelayEnvironmentProvider');
const React = require('react');
const TestRenderer = require('react-test-renderer');

class ErrorBoundary extends React.Component<
  {children: React.Node},
  {error: ?Error},
> {
  state: {error: ?Error} = {error: null};
  static getDerivedStateFromError(error: Error): {error: ?Error} {
    return {error};
  }
  render(): React.Node {
    return this.state.error != null
      ? `error: ${this.state.error.message}`
      : this.props.children;
  }
}

function render(
  environment: IEnvironment,
  children: React.Node,
): ReturnType<typeof TestRenderer.create> {
  let renderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <RelayEnvironmentProvider environment={environment}>
        <ErrorBoundary>
          <React.Suspense fallback="loading">{children}</React.Suspense>
        </ErrorBoundary>
      </RelayEnvironmentProvider>,
    );
  });
  if (renderer == null) {
    throw new Error('Expected a renderer.');
  }
  return renderer;
}

async function flush(): Promise<void> {
  for (let ii = 0; ii < 20; ii++) {
    await Promise.resolve();
  }
}

// The value of a provider that differs between the server and the browser,
// such as the device pixel ratio.
const providerState: {scale: ?ReadonlyArray<number>} = {scale: [1]};

module.exports = {ErrorBoundary, flush, providerState, render};
