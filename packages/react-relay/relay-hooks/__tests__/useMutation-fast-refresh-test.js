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

import type {useMutationFastRefreshTestCommentCreateMutation$variables} from './__generated__/useMutationFastRefreshTestCommentCreateMutation.graphql';

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useMutation = require('../useMutation');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {act} = require('react');
const {graphql} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');

describe('useLazyLoadQueryNode', () => {
  let environment;
  let isInFlightFn;
  let CommentCreateMutation;

  const data = {
    data: {
      commentCreate: {
        feedbackCommentEdge: {
          __typename: 'CommentsEdge',
          cursor: '<cursor>',
          node: {
            id: '<id>',
            body: {
              text: '<text>',
            },
          },
        },
      },
    },
  };

  const variables: useMutationFastRefreshTestCommentCreateMutation$variables = {
    input: {
      feedbackId: '<id>',
    },
  };
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'warn').mockImplementationOnce(() => {});

    environment = createMockEnvironment();

    CommentCreateMutation = graphql`
      mutation useMutationFastRefreshTestCommentCreateMutation(
        $input: CommentCreateInput
      ) {
        commentCreate(input: $input) {
          feedbackCommentEdge {
            cursor
            node {
              id
              body {
                text
              }
            }
          }
        }
      }
    `;
    isInFlightFn = jest.fn((val: boolean) => val);
  });

  afterEach(() => {
    environment.mockClear();
    jest.clearAllTimers();
  });

  it('force a refetch in fast refresh', async () => {
    // $FlowFixMe[cannot-resolve-module] (site=www)
    const ReactRefreshRuntime = require('react-refresh/runtime');
    ReactRefreshRuntime.injectIntoGlobalHook(global);
    let commit;
    const V1 = function (props: {}) {
      const [commitFn, isMutationInFlight] = useMutation(CommentCreateMutation);
      commit = commitFn;
      return isInFlightFn(isMutationInFlight);
    };
    ReactRefreshRuntime.register(V1, 'Renderer');

    await act(() => {
      ReactTestingLibrary.render(
        <RelayEnvironmentProvider environment={environment}>
          <React.Suspense fallback="Fallback">
            <V1 />
          </React.Suspense>
        </RelayEnvironmentProvider>,
      );
    });
    expect(isInFlightFn).toBeCalledTimes(1);
    expect(isInFlightFn).toBeCalledWith(false);

    isInFlightFn.mockClear();
    await act(() => {
      commit({variables});
    });
    expect(isInFlightFn).toBeCalledTimes(1);
    expect(isInFlightFn).toBeCalledWith(true);

    isInFlightFn.mockClear();
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    await act(() => environment.mock.resolve(operation, data));
    expect(isInFlightFn).toBeCalledTimes(1);
    expect(isInFlightFn).toBeCalledWith(false);

    isInFlightFn.mockClear();

    // Trigger a fast fresh
    function V2(props: any) {
      const [commitFn, isMutationInFlight] = useMutation(CommentCreateMutation);
      commit = commitFn;
      return isInFlightFn(isMutationInFlight);
    }
    ReactRefreshRuntime.register(V2, 'Renderer');
    await act(() => {
      ReactRefreshRuntime.performReactRefresh();
    });

    expect(isInFlightFn).toBeCalledTimes(1);
    expect(isInFlightFn).toBeCalledWith(false);

    isInFlightFn.mockClear();
    await act(() => {
      commit({variables});
    });
    expect(isInFlightFn).toBeCalledTimes(1);
    expect(isInFlightFn).toBeCalledWith(true);
  });
});
