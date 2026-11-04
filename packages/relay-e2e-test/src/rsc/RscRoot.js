/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

/**
 * The root both client realms render: the page's decoded Flight tree inside
 * the realm's Relay Environment. The SSR process renders it to HTML and the
 * browser hydrates the same tree, so the two must stay identical.
 */

const React = require('react');
const {RelayEnvironmentProvider} = require('react-relay');

// Reset by a navigation, so a failed page does not outlive it.
class RscErrorBoundary extends React.Component {
  state = {error: null, response: this.props.response};
  static getDerivedStateFromError(error) {
    return {error};
  }
  static getDerivedStateFromProps(props, state) {
    return props.response === state.response
      ? null
      : {error: null, response: props.response};
  }
  render() {
    return this.state.error == null
      ? this.props.children
      : React.createElement(
          'div',
          {role: 'alert'},
          `Uncaught error: ${String(this.state.error.message)}`,
        );
  }
}

function FlightTree({response}) {
  return React.use(response);
}

/**
 * `router.navigate(response)` swaps in the Flight tree of another page in a
 * transition, like an App Router navigation, keeping the Environment.
 */
function RscRoot({environment, initialResponse, router}) {
  const [response, setResponse] = React.useState(initialResponse);
  React.useEffect(() => {
    if (router != null) {
      router.navigate = next => React.startTransition(() => setResponse(next));
    }
  }, [router]);
  return React.createElement(
    RelayEnvironmentProvider,
    {environment},
    React.createElement(
      RscErrorBoundary,
      {response},
      React.createElement(FlightTree, {response}),
    ),
  );
}

module.exports = {RscRoot};
