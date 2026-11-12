/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

'use strict';

import type {RelayHandoffSeamTest_user$key} from './__generated__/RelayHandoffSeamTest_user.graphql';
import type {RelayHandoffSeamTestQuery$data} from './__generated__/RelayHandoffSeamTestQuery.graphql';

const RelayEnvironmentProvider = require('../../../relay-hooks/RelayEnvironmentProvider');
const useFragment = require('../../useFragment');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const {
  RelayFeatureFlags,
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils-internal');

const mockUseRelayHandoffLoaded = jest.fn();
jest.mock('../useRelayHandoff', () => {
  mockUseRelayHandoffLoaded();
  return jest.requireActual('../useRelayHandoff');
});

const Query = graphql`
  query RelayHandoffSeamTestQuery {
    me {
      ...RelayHandoffSeamTest_user
    }
  }
`;

const UserFragment = graphql`
  fragment RelayHandoffSeamTest_user on User {
    name
  }
`;

// The Store's snapshot data for the query.
declare function asQueryData(data: unknown): RelayHandoffSeamTestQuery$data;
function asQueryData(data: unknown): unknown {
  return data;
}

component Name(user: RelayHandoffSeamTest_user$key) {
  const data = useFragment(UserFragment, user);
  return data.name;
}

// A reader of an ordinary reference that carries a malformed `__handoff`,
// which the handoff hook would reject.
function renderReader(
  environment: ReturnType<
    typeof createMockEnvironment,
  > = createMockEnvironment(),
) {
  const operation = createOperationDescriptor(Query, {});
  environment.commitPayload(operation, {
    me: {__typename: 'User', id: '4', name: 'Zuck'},
  });
  const me = asQueryData(environment.lookup(operation.fragment).data).me;
  if (me == null) {
    throw new Error('Expected a reference.');
  }
  const user = {...me, __handoff: {version: 0}};
  const element = (
    <RelayEnvironmentProvider environment={environment}>
      <Name user={user} />
    </RelayEnvironmentProvider>
  );
  let renderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });
  if (renderer == null) {
    throw new Error('Expected a renderer.');
  }
  return {element, environment, renderer};
}

// The tests share module state, in order: a fragment is read before the RSC
// client entry is imported, then before `installRelayHandoff()` is called.
describe('useFragment without installRelayHandoff(environment)', () => {
  it('neither loads nor runs the handoff hook', () => {
    const {renderer} = renderReader();
    expect(renderer.toJSON()).toBe('Zuck');
    expect(mockUseRelayHandoffLoaded).not.toHaveBeenCalled();
  });

  it('is unchanged by importing the RSC client entry', () => {
    const {element, renderer} = renderReader();
    require('../../../rsc-client_EXPERIMENTAL');
    TestRenderer.act(() => renderer.update(element));
    expect(renderer.toJSON()).toBe('Zuck');
    expect(renderReader().renderer.toJSON()).toBe('Zuck');
    expect(mockUseRelayHandoffLoaded).not.toHaveBeenCalled();
  });

  it('requires explicit null fragment arguments', () => {
    const {installRelayHandoff} = require('../../../rsc-client_EXPERIMENTAL');
    RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS = false;
    try {
      expect(() => installRelayHandoff(createMockEnvironment())).toThrow(
        /ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS/,
      );
    } finally {
      RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS = true;
    }
  });

  it('rejects installRelayHandoff(environment) after a fragment was read from it', () => {
    const {element, environment, renderer} = renderReader();
    const {installRelayHandoff} = require('../../../rsc-client_EXPERIMENTAL');
    expect(() => installRelayHandoff(environment)).toThrow(
      'Relay: installRelayHandoff(environment) must be called before the ' +
        'Environment is first provided or read from',
    );
    // The reader renders again with the same hooks.
    TestRenderer.act(() => renderer.update(element));
    expect(renderer.toJSON()).toBe('Zuck');
  });

  it('leaves other Environments ordinary when one installs it', () => {
    const {installRelayHandoff} = require('../../../rsc-client_EXPERIMENTAL');
    const installed = createMockEnvironment();
    installRelayHandoff(installed);
    // An Environment without it reads the malformed handoff as an ordinary
    // reference; the one with it rejects the handoff.
    expect(renderReader().renderer.toJSON()).toBe('Zuck');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderReader(installed)).toThrow(
      'Relay: A fragment reference carries a handoff this version of Relay ' +
        'cannot read.',
    );
  });
});

describe('RelayEnvironmentProvider', () => {
  component Reader(user: RelayHandoffSeamTest_user$key) {
    const data = useFragment(UserFragment, user);
    return data.name;
  }

  // A reference without a handoff, which both kinds of Environment read.
  function environmentWithReader(installed: boolean) {
    const environment = createMockEnvironment();
    if (installed) {
      require('../../../rsc-client_EXPERIMENTAL').installRelayHandoff(
        environment,
      );
    }
    const operation = createOperationDescriptor(Query, {});
    environment.commitPayload(operation, {
      me: {__typename: 'User', id: '4', name: 'Zuck'},
    });
    const me = asQueryData(environment.lookup(operation.fragment).data).me;
    if (me == null) {
      throw new Error('Expected a reference.');
    }
    return {environment, me};
  }

  it('rejects changing to an Environment with another handoff hook while mounted', () => {
    const installed = environmentWithReader(true);
    const ordinary = environmentWithReader(false);
    let renderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={installed.environment}>
          <Reader user={installed.me} />
        </RelayEnvironmentProvider>,
      );
    });
    expect(renderer?.toJSON()).toBe('Zuck');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      TestRenderer.act(() =>
        renderer?.update(
          <RelayEnvironmentProvider environment={ordinary.environment}>
            <Reader user={ordinary.me} />
          </RelayEnvironmentProvider>,
        ),
      ),
    ).toThrow(
      'RelayEnvironmentProvider: The Environment changed to one that reads ' +
        'handed-off fragment references differently',
    );
  });

  it('reads without a handoff when there is no Environment yet, as before', () => {
    const {getHandoffHook} = require('../RelayHandoffSeam');
    expect(getHandoffHook(undefined)).toBe(
      getHandoffHook(createMockEnvironment()),
    );
  });

  it('switches between them when remounted with a new key', () => {
    const installed = environmentWithReader(true);
    const ordinary = environmentWithReader(false);
    let renderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={installed.environment} key="a">
          <Reader user={installed.me} />
        </RelayEnvironmentProvider>,
      );
    });
    TestRenderer.act(() =>
      renderer?.update(
        <RelayEnvironmentProvider environment={ordinary.environment} key="b">
          <Reader user={ordinary.me} />
        </RelayEnvironmentProvider>,
      ),
    );
    expect(renderer?.toJSON()).toBe('Zuck');
  });
});

describe('installRelayHandoff', () => {
  it('installs from its own module without loading useQueryFromServer', () => {
    jest.isolateModules(() => {
      jest.doMock('../useQueryFromServer', () => {
        throw new Error('useQueryFromServer was loaded.');
      });
      const installRelayHandoff = require('../installRelayHandoff');
      const environment = createMockEnvironment();
      installRelayHandoff(environment);
      const {getHandoffHook} = require('../RelayHandoffSeam');
      expect(getHandoffHook(environment)).toBe(require('../useRelayHandoff'));
    });
  });
});
