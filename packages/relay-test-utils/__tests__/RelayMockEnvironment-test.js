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

import type {MockResolvers} from '../RelayMockPayloadGenerator';
import type {RelayMockEnvironmentTestWithDeferFragment_user$key} from './__generated__/RelayMockEnvironmentTestWithDeferFragment_user.graphql';

const preloadQuery = require('../../react-relay/relay-hooks/preloadQuery_DEPRECATED');
const RelayEnvironmentProvider = require('../../react-relay/relay-hooks/RelayEnvironmentProvider');
const useFragment = require('../../react-relay/relay-hooks/useFragment');
const useLazyLoadQuery = require('../../react-relay/relay-hooks/useLazyLoadQuery');
const usePreloadedQuery = require('../../react-relay/relay-hooks/usePreloadedQuery');
const invariant = require('invariant');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const {act} = require('react-test-renderer');
const {graphql} = require('relay-runtime');
const {
  MockPayloadGenerator,
  createMockEnvironment,
} = require('relay-test-utils');
const {
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();

describe('when using queuePendingOperation, queueOperationResolver and preloadQuery in tests', () => {
  const query = graphql`
    query RelayMockEnvironmentTestQuery($id: ID!) {
      node(id: $id) {
        id
        ... on User {
          name
        }
      }
    }
  `;
  let prefetched;
  let mockEnvironment;

  const variables = {id: 4};

  beforeEach(() => {
    mockEnvironment = createMockEnvironment();
    prefetched = undefined;
  });

  const callPreloadQuery = () => {
    // $FlowFixMe[incompatible-type]
    prefetched = preloadQuery(mockEnvironment, query, variables);
  };
  const callQueueOperationResolver = () =>
    mockEnvironment.mock.queueOperationResolver(operation => {
      return MockPayloadGenerator.generate(operation, {
        String() {
          return 'Zuck';
        },
      });
    });
  const callRegisterOperation = () =>
    mockEnvironment.mock.queuePendingOperation(query, variables);

  const SUSPENDED = false;
  const RENDERED = true;
  type ConditionToAssert = true | false;

  const renderAndAssert = (condition: ConditionToAssert) => {
    let data;
    function Component(props: $FlowFixMe) {
      data = usePreloadedQuery(query, props.prefetched);
      return data.node?.name;
    }
    let renderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={mockEnvironment}>
          <React.Suspense fallback="Fallback">
            <Component prefetched={prefetched} />
          </React.Suspense>
        </RelayEnvironmentProvider>,
        // $FlowFixMe[incompatible-type]
        {
          unstable_isConcurrent: true,
        },
      );
    });
    invariant(renderer != null, 'should have been rendered');

    if (condition === SUSPENDED) {
      expect(renderer.toJSON()).toEqual('Fallback');
      expect(data).toBeUndefined();
    } else if (condition === RENDERED) {
      expect(renderer.toJSON()).toEqual('Zuck');
      expect(data?.node?.name).toEqual('Zuck');
    }
  };

  // Test various combinations of calling queueOperationResolvers, queuePendingOperation
  // and preloadQuery, in various orders.
  it('renders synchronously if queueOperationResolver, queuePendingOperation and preloadQuery have been called', () => {
    callQueueOperationResolver();
    callRegisterOperation();
    callPreloadQuery();
    renderAndAssert(RENDERED);
  });

  it('suspends if only queuePendingOperation and preloadQuery have been called', () => {
    callRegisterOperation();
    callPreloadQuery();
    renderAndAssert(SUSPENDED);
  });

  it('renders synchronously when queueOperationResolver is called before preloadQuery', () => {
    callQueueOperationResolver();
    callPreloadQuery();
    renderAndAssert(RENDERED);
  });

  it('suspends if only preloadQuery have been called', () => {
    callPreloadQuery();
    renderAndAssert(SUSPENDED);
  });

  describe('if preloadQuery has been called first', () => {
    it('suspends if queueOperationResolver and queuePendingOperation are called', () => {
      callPreloadQuery();
      callQueueOperationResolver();
      callRegisterOperation();
      renderAndAssert(SUSPENDED);
    });
    it('suspends if queueOperationResolver is called', () => {
      callPreloadQuery();
      callQueueOperationResolver();
      renderAndAssert(SUSPENDED);
    });
    it('suspends if queuePendingOperation is called', () => {
      callPreloadQuery();
      callRegisterOperation();
      renderAndAssert(SUSPENDED);
    });
  });
});

describe('when generating multiple payloads for deferred data', () => {
  const query = graphql`
    query RelayMockEnvironmentTestWithDeferQuery($id: ID!) {
      node(id: $id) {
        id
        ... on User {
          ...RelayMockEnvironmentTestWithDeferFragment_user
            @dangerously_unaliased_fixme
            @defer
        }
      }
    }
  `;

  const fragment = graphql`
    fragment RelayMockEnvironmentTestWithDeferFragment_user on User {
      name
    }
  `;

  const render = () => {
    const mockEnvironment = createMockEnvironment();
    const variables = {id: '4'};

    function Component(props: {}) {
      const data = useLazyLoadQuery(query, variables);
      return (
        <>
          {data.node?.id}
          {data.node && <DeferredComponent user={data.node} />}
        </>
      );
    }
    function DeferredComponent(props: {
      user: RelayMockEnvironmentTestWithDeferFragment_user$key,
    }) {
      const data = useFragment(fragment, props.user);
      return data?.name;
    }
    let renderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        <RelayEnvironmentProvider environment={mockEnvironment}>
          <React.Suspense fallback="Fallback">
            <Component />
          </React.Suspense>
        </RelayEnvironmentProvider>,
        // $FlowFixMe[incompatible-type]
        {
          unstable_isConcurrent: true,
        },
      );
    });
    invariant(renderer != null, 'should have been rendered');

    /* $FlowFixMe[invalid-compare] Error discovered during Constant Condition
     * roll out. See https://fburl.com/workplace/4oq3zi07. */
    const isSuspended = () => renderer.toJSON() === 'Fallback';

    const generateData = (resolvers: MockResolvers) => {
      const operation = mockEnvironment.mock.getMostRecentOperation();
      const mockData = MockPayloadGenerator.generateWithDefer(
        operation,
        resolvers,
        {generateDeferredPayload: true},
      );
      mockEnvironment.mock.resolve(operation, mockData);

      act(() => jest.runAllTimers());
    };

    return {
      generateData,
      renderer,
      isSuspended,
    };
  };

  it('renders the initial and deferred payloads', () => {
    const {renderer, isSuspended, generateData} = render();

    expect(isSuspended()).toEqual(true);

    generateData({
      ID() {
        return '4';
      },
      String() {
        return 'Zuck';
      },
    });

    expect(isSuspended()).toEqual(false);
    expect(renderer.toJSON()).toEqual(['4', 'Zuck']);
  });
});
