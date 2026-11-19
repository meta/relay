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

import type {RelayMockEnvironment} from '../../../relay-test-utils/RelayModernMockEnvironment';
import type {
  useMutationActionTest1Mutation$data,
  useMutationActionTest1Mutation$variables,
} from './__generated__/useMutationActionTest1Mutation.graphql';
import type {PayloadData} from 'relay-runtime';
import type {Mutation} from 'relay-runtime/util/RelayRuntimeTypes';

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useMutationAction_EXPERIMENTAL = require('../useMutationAction_EXPERIMENTAL');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {graphql} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');

const {useState} = React;
let environment;
let render;
let setEnvironment;
let commitAction;
let instance;

const data = {
  data: {
    commentCreate: {
      feedbackCommentEdge: {
        __typename: 'CommentsEdge',
        cursor: '<cursor>',
        node: {
          body: {
            text: '<text>',
          },
          id: '<id>',
        },
      },
    },
  },
};

const variables = {
  input: {
    feedbackId: '<id>',
  },
};

let CommentCreateMutation;

beforeEach(() => {
  environment = createMockEnvironment();

  CommentCreateMutation = graphql`
    mutation useMutationActionTest1Mutation($input: CommentCreateInput) {
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

  function Renderer({
    initialMutation,
  }: {
    initialMutation: Mutation<
      useMutationActionTest1Mutation$variables,
      useMutationActionTest1Mutation$data,
    >,
  }) {
    const [mutation] = useState(initialMutation);
    commitAction = useMutationAction_EXPERIMENTAL(mutation);
    return null;
  }

  function Container(props: {
    environment: RelayMockEnvironment,
    mutation: Mutation<
      useMutationActionTest1Mutation$variables,
      useMutationActionTest1Mutation$data,
    >,
  }) {
    const [env, setEnv] = useState(props.environment);
    setEnvironment = setEnv;
    return (
      <RelayEnvironmentProvider environment={env}>
        <Renderer initialMutation={props.mutation} />
      </RelayEnvironmentProvider>
    );
  }

  render = async function (
    env: RelayMockEnvironment,
    mutation: Mutation<
      useMutationActionTest1Mutation$variables,
      useMutationActionTest1Mutation$data,
    >,
  ) {
    await ReactTestingLibrary.act(() => {
      instance = ReactTestingLibrary.render(
        <Container environment={env} mutation={mutation} />,
      );
    });
  };
});

it('resolves with response data on success', async () => {
  await render(environment, CommentCreateMutation);

  let result;
  await ReactTestingLibrary.act(async () => {
    // $FlowExpectedError[incompatible-type]
    const promise = commitAction(variables);
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, data);
    result = await promise;
  });

  expect(result).toEqual({
    commentCreate: {
      feedbackCommentEdge: {
        cursor: '<cursor>',
        node: {
          body: {text: '<text>'},
          id: '<id>',
        },
      },
    },
  });
});

it('resolves with response when server returns field errors', async () => {
  await render(environment, CommentCreateMutation);

  let result;
  await ReactTestingLibrary.act(async () => {
    // $FlowExpectedError[incompatible-type]
    const promise = commitAction(variables);
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, {
      data: data.data as PayloadData,
      errors: [{message: '<error0>'}, {message: '<error1>'}],
    });
    result = await promise;
  });

  expect(result).toEqual({
    commentCreate: {
      feedbackCommentEdge: {
        cursor: '<cursor>',
        node: {
          body: {text: '<text>'},
          id: '<id>',
        },
      },
    },
  });
});

it('rejects when the network errors', async () => {
  await render(environment, CommentCreateMutation);

  let rejection;
  await ReactTestingLibrary.act(async () => {
    // $FlowExpectedError[incompatible-type]
    const promise = commitAction(variables);
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.reject(operation, new Error('network failure'));
    try {
      await promise;
    } catch (err) {
      rejection = err;
    }
  });

  expect(rejection).toEqual(new Error('network failure'));
});

it('calls executeMutation on the environment', async () => {
  await render(environment, CommentCreateMutation);

  await ReactTestingLibrary.act(async () => {
    // $FlowExpectedError[incompatible-type]
    const promise = commitAction(variables);
    expect(environment.executeMutation).toBeCalledTimes(1);
    const operation = environment.executeMutation.mock.calls[0][0].operation;
    environment.mock.resolve(operation, data);
    await promise;
  });
});

it('can commit multiple mutations concurrently', async () => {
  await render(environment, CommentCreateMutation);

  await ReactTestingLibrary.act(async () => {
    // $FlowExpectedError[incompatible-type]
    const promise1 = commitAction(variables);
    const promise2 = commitAction({
      input: {feedbackId: '<id-2>'},
    });
    expect(environment.executeMutation).toBeCalledTimes(2);

    const operation1 = environment.executeMutation.mock.calls[0][0].operation;
    const operation2 = environment.executeMutation.mock.calls[1][0].operation;
    environment.mock.resolve(operation1, data);
    environment.mock.resolve(operation2, {
      data: {
        commentCreate: {
          feedbackCommentEdge: {
            __typename: 'CommentsEdge',
            cursor: '<cursor-2>',
            node: {
              body: {text: '<text-2>'},
              id: '<id-2>',
            },
          },
        },
      },
    });

    const [result1, result2] = await Promise.all([promise1, promise2]);
    // $FlowExpectedError[incompatible-use]
    expect(result1.commentCreate.feedbackCommentEdge.node.id).toBe('<id>');
    // $FlowExpectedError[incompatible-use]
    expect(result2.commentCreate.feedbackCommentEdge.node.id).toBe('<id-2>');
  });
});

it('uses the current environment after environment change', async () => {
  await render(environment, CommentCreateMutation);
  const newEnv = createMockEnvironment();

  await ReactTestingLibrary.act(() => setEnvironment(newEnv));

  await ReactTestingLibrary.act(async () => {
    // $FlowExpectedError[incompatible-type]
    const promise = commitAction(variables);
    expect(environment.executeMutation).toBeCalledTimes(0);
    expect(newEnv.executeMutation).toBeCalledTimes(1);
    const operation = newEnv.executeMutation.mock.calls[0][0].operation;
    newEnv.mock.resolve(operation, data);
    await promise;
  });
});

describe('unmount', () => {
  it('mutation completes normally after unmount', async () => {
    await render(environment, CommentCreateMutation);

    let result;
    await ReactTestingLibrary.act(async () => {
      // $FlowExpectedError[incompatible-type]
      const p = commitAction(variables);
      const operation = environment.executeMutation.mock.calls[0][0].operation;
      environment.mock.resolve(operation, data);
      result = await p;
    });
    await ReactTestingLibrary.act(() => {
      instance.unmount();
    });

    // $FlowExpectedError[incompatible-use]
    expect(result?.commentCreate.feedbackCommentEdge.node.id).toBe('<id>');
  });
});
