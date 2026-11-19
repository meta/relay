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

import type {RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription$variables} from './__generated__/RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription.graphql';
import type {RenderProps} from 'react-relay/ReactRelayQueryRenderer';
import type {
  HandleFieldPayload,
  RecordSourceProxy,
} from 'relay-runtime/store/RelayStoreTypes';

const {MockPayloadGenerator, createMockEnvironment} = require('../');
const React = require('react');
const {
  QueryRenderer,
  createFragmentContainer,
  createPaginationContainer,
  createRefetchContainer,
} = require('react-relay');
const ReactTestRenderer = require('react-test-renderer');
const {
  DefaultHandlerProvider,
  commitMutation,
  graphql,
  requestSubscription,
} = require('relay-runtime');

const {useState, useEffect} = React;

describe('ReactRelayTestMocker with Containers', () => {
  let environment;

  beforeEach(() => {
    environment = createMockEnvironment();
  });

  describe('Basic Resolve/Reject Operations', () => {
    let testComponentTree;

    beforeEach(() => {
      const TestQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestFantasticEffortQuery(
          $id: ID = "<default>"
        ) {
          user: node(id: $id) {
            id
            name
          }
        }
      `;
      const TestComponent = () => (
        <QueryRenderer
          environment={environment}
          query={TestQuery}
          variables={{}}
          render={({error, props}) => {
            if (props) {
              return `My id ${props.user.id} and name is ${props.user.name}`;
            } else if (error) {
              return <div testID="error">{error.message}</div>;
            }
            return <div testID="loading">Loading...</div>;
          }}
        />
      );
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
    });

    it('should have pending operations in the queue', () => {
      expect(environment.mock.getAllOperations().length).toEqual(1);
    });

    it('should return most recent operation', () => {
      const operation = environment.mock.getMostRecentOperation();
      expect(operation.request.node.operation.name).toBe(
        'RelayMockEnvironmentWithComponentsTestFantasticEffortQuery',
      );
      expect(operation.request.variables).toEqual({
        id: '<default>',
      });
    });

    it('should resolve query', () => {
      // Should render loading state
      expect(() => {
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        testComponentTree.root.find(node => node.props.testID === 'loading');
      }).not.toThrow();

      // Make sure request was issued
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation),
        );
      });

      // Should render some data
      expect(testComponentTree).toMatchSnapshot();
    });

    it('should reject query', () => {
      ReactTestRenderer.act(() => {
        environment.mock.rejectMostRecentOperation(new Error('Uh-oh'));
      });

      const errorMessage = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'error',
      );
      // Should render error
      expect(errorMessage.props.children).toBe('Uh-oh');
    });

    it('should reject query with function', () => {
      ReactTestRenderer.act(() => {
        environment.mock.rejectMostRecentOperation(
          operation =>
            new Error(`Uh-oh: ${operation.request.node.fragment.name}`),
        );
      });

      const errorMessage = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'error',
      );
      // Should render error
      expect(errorMessage.props.children).toBe(
        'Uh-oh: RelayMockEnvironmentWithComponentsTestFantasticEffortQuery',
      );
    });

    it('should throw if it unable to find operation', () => {
      expect(environment.mock.getAllOperations().length).toEqual(1);
      expect(() => {
        environment.mock.findOperation(operation => false);
      }).toThrow(/Operation was not found/);
    });
  });

  //
  describe('Test Query Renderer with Fragment Container', () => {
    let testComponentTree;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestImpossibleAwesomenessQuery(
          $id: ID = "<default>"
          $scale: Float = 1
        ) {
          user: node(id: $id) {
            id
            name
            ...RelayMockEnvironmentWithComponentsTestProminentSolutionFragment
              @dangerously_unaliased_fixme
          }
        }
      `;

      const ProfilePictureFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestProminentSolutionFragment on User {
          name
          profile_picture(scale: $scale) {
            uri
          }
        }
      `;
      const ProfilePicture = createFragmentContainer(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        (props: $FlowFixMe) => {
          return (
            <img
              testID="profile_picture"
              src={props.user.profile_picture.uri}
              alt={props.user.name}
            />
          );
        },
        {
          // eslint-disable-next-line relay/graphql-naming
          user: ProfilePictureFragment,
        },
      );
      const TestComponent = () => (
        <QueryRenderer
          environment={environment}
          query={UserQuery}
          variables={{}}
          render={({error, props}: RenderProps<$FlowFixMe>) => {
            if (props) {
              return (
                <div>
                  My id ${props.user.id} and name is ${props.user.name}.
                  <hr />
                  <ProfilePicture user={props.user} />
                </div>
              );
            } else if (error) {
              return <div>{error.message}</div>;
            }
            return <div>Loading...</div>;
          }}
        />
      );
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
    });

    it('should render data', () => {
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation),
        );
      });
      expect(testComponentTree).toMatchSnapshot();
    });

    it('should render data with mock resolvers', () => {
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            Image() {
              return {
                uri: 'http://test.com/image-url',
              };
            },
          }),
        );
      });
      const image = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'profile_picture',
      );
      expect(image.props.src).toBe('http://test.com/image-url');
    });
  });

  describe('Test Query Renderer with Pagination Container', () => {
    let testComponentTree;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestNoticeableSuccessQuery(
          $id: ID = "<default>"
          $first: Int = 5
          $cursor: ID = ""
        ) {
          user: node(id: $id) {
            id
            name
            ...RelayMockEnvironmentWithComponentsTestRobustAwesomenessFragment
              @dangerously_unaliased_fixme
          }
        }
      `;

      const UserFriendsFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestRobustAwesomenessFragment on User {
          id
          friends(first: $first, after: $cursor)
            @connection(key: "User_friends") {
            edges {
              node {
                id
                name
                profile_picture {
                  uri
                }
              }
            }
          }
        }
      `;
      function FriendsListComponent(props: $FlowFixMe) {
        const [isLoading, setIsLoading] = useState(props.relay.isLoading());
        return (
          <>
            <ul testID="list">
              {props.user.friends.edges.map(({node, cursor}) => {
                return (
                  <li key={node.id}>
                    Friend: {node.name}
                    <img src={node.profile_picture?.uri} alt={node.name} />
                  </li>
                );
              })}
            </ul>
            {isLoading && <div testID="loadingMore">Loading more...</div>}
            <button
              disabled={isLoading || !props.relay.hasMore()}
              onClick={() => {
                setIsLoading(true);
                props.relay.loadMore(5, () => {
                  setIsLoading(false);
                });
              }}
              testID="loadMore"
            />
          </>
        );
      }
      const FriendsList = createPaginationContainer(
        FriendsListComponent,
        {
          // eslint-disable-next-line relay/graphql-naming
          user: UserFriendsFragment,
        },
        {
          direction: 'forward',
          getConnectionFromProps(props) {
            return props.user.friends;
          },
          getFragmentVariables(vars, totalCount) {
            return {
              ...vars,
              first: totalCount,
            };
          },
          getVariables(props, {count, cursor}, vars) {
            return {
              id: props.user.id,
              cursor: cursor,
              first: count,
            };
          },
          query: UserQuery,
        },
      );
      const TestComponent = () => (
        <QueryRenderer
          environment={environment}
          query={UserQuery}
          variables={{
            id: 'my-pagination-test-user-id',
          }}
          render={({error, props}) => {
            if (props) {
              return (
                <div>
                  My id ${props.user.id} and name is ${props.user.name}.
                  <hr />
                  <FriendsList user={props.user} />
                </div>
              );
            } else if (error) {
              return <div testID="error">{error.message}</div>;
            }
            return <div testID="loading">Loading...</div>;
          }}
        />
      );
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
    });

    it('should render data', () => {
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            ID({path}, generateId) {
              if (path != null && path.join('.') === 'user.id') {
                return operation.request.variables.id;
              }
            },
            User() {
              return {
                name: 'Alice',
              };
            },
            PageInfo() {
              return {
                hasNextPage: true,
              };
            },
          }),
        );
      });
      const list = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'list',
      );
      expect(list.props.children).toBeInstanceOf(Array);
      expect(list.props.children.length).toEqual(1);
      expect(
        list.props.children.map(li => li.props.children)[0].includes('Alice'),
      ).toEqual(true);
      expect(testComponentTree).toMatchSnapshot(
        'It should render list of users with just Alice and `button` loadMore should be enabled.',
      );
    });

    it('should load more data for pagination container', () => {
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            ID({path}, generateId) {
              // Just to make sure we're generating list data for the same parent id
              if (path != null && path.join('.') === 'user.id') {
                return operation.request.variables.id;
              }
              return `my-custom-id-${generateId() + 5}`;
            },
            User() {
              return {
                name: 'Alice',
              };
            },
            PageInfo() {
              return {
                hasNextPage: true,
              };
            },
          }),
        );
      });
      const loadMore = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'loadMore',
      );
      expect(loadMore.props.disabled).toBe(false);
      ReactTestRenderer.act(() => {
        loadMore.props.onClick();
      });
      // Should show preloader
      expect(() => {
        testComponentTree.root.find(
          // In www, this is differently typed (via react-test-renderer.js.flow) than in
          // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
          // to get flow to accept this typing.
          // $FlowFixMe[missing-local-annot]
          node => node.props.testID === 'loadingMore',
        );
      }).not.toThrow();

      // Resolve pagination request
      // We need to add additional resolvers
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            ID({path}, generateId) {
              // Just to make sure we're generating list data for the same parent id
              if (path != null && path.join('.') === 'user.id') {
                return operation.request.variables.id;
              }
              return `my-custom-id-${generateId() + 10}`;
            },
            User() {
              return {
                name: 'Bob',
              };
            },
            PageInfo() {
              return {
                hasNextPage: false,
              };
            },
          }),
        );
      });
      const list = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'list',
      );
      expect(list.props.children).toBeInstanceOf(Array);
      expect(list.props.children.length).toEqual(2);
      const listItems = list.props.children.map(li => li.props.children);
      expect(listItems[0].includes('Alice')).toEqual(true);
      expect(listItems[1].includes('Bob')).toEqual(true);
      expect(testComponentTree).toMatchSnapshot(
        'It should render a list of users with Alice and Bob, button "loadMore" should be disabled',
      );
    });
  });

  describe('Test Query Renderer with Refetch Container', () => {
    let testComponentTree;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestExceptionalImpactQuery(
          $id: ID = "<default>"
        ) {
          user: node(id: $id) {
            id
            name
            hometown {
              ...RelayMockEnvironmentWithComponentsTestUsefulAwesomenessFragment
            }
          }
        }
      `;

      const PageQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestImpressiveResultQuery(
          $id: ID!
        ) @relay_test_operation {
          node(id: $id) {
            ...RelayMockEnvironmentWithComponentsTestUsefulAwesomenessFragment
              @dangerously_unaliased_fixme
          }
        }
      `;

      const PageFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestUsefulAwesomenessFragment on Page {
          id
          name
          websites
        }
      `;
      function UserHometownComponent(props: $FlowFixMe) {
        const [isLoading, setIsLoading] = useState(false);
        return (
          <>
            <div testID="hometown">{props.page.name}</div>
            <div>Websites: {props.page.websites}</div>
            {isLoading && <div testID="refetching">Refetching...</div>}
            <button
              testID="refetch"
              disabled={isLoading}
              onClick={() => {
                setIsLoading(true);
                props.relay.refetch(
                  {
                    id: props.page.id,
                  },
                  null,
                  () => {
                    setIsLoading(false);
                  },
                );
              }}>
              Refetch
            </button>
          </>
        );
      }
      const UserHometown = createRefetchContainer(
        UserHometownComponent,
        {
          // eslint-disable-next-line relay/graphql-naming
          page: PageFragment,
        },
        PageQuery,
      );
      const TestComponent = () => (
        <QueryRenderer
          environment={environment}
          query={UserQuery}
          variables={{}}
          render={({error, props}) => {
            if (props) {
              return (
                <div>
                  My id ${props.user.id} and name is ${props.user.name}.
                  <hr />
                  <UserHometown page={props.user.hometown} />
                </div>
              );
            } else if (error) {
              return <div testID="error">{error.message}</div>;
            }
            return <div testID="loading">Loading...</div>;
          }}
        />
      );
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
    });

    it('should refetch query', () => {
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            Page() {
              return {
                id: 'my-page-id',
                name: 'PHL',
              };
            },
          }),
        );
      });
      // Make sure we're rendered correct hometown
      expect(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        testComponentTree.root.find(node => node.props.testID === 'hometown')
          .children,
      ).toEqual(['PHL']);

      const refetch = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'refetch',
      );
      ReactTestRenderer.act(() => {
        refetch.props.onClick();
      });
      // Should load loading state
      expect(() => {
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        testComponentTree.root.find(node => node.props.testID === 'refetching');
      }).not.toThrow();

      // Verify the query params
      const operation = environment.mock.getMostRecentOperation();
      expect(operation.request.node.operation.name).toBe(
        'RelayMockEnvironmentWithComponentsTestImpressiveResultQuery',
      );
      expect(operation.request.variables).toEqual({id: 'my-page-id'});

      // Resolve refetch query
      ReactTestRenderer.act(() => {
        environment.mock.resolve(
          operation,
          MockPayloadGenerator.generate(operation, {
            Node() {
              return {
                __typename: 'Page',
                id: 'my-page-id',
                name: 'SFO',
              };
            },
          }),
        );
      });
      expect(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        testComponentTree.root.find(node => node.props.testID === 'hometown')
          .children,
      ).toEqual(['SFO']);
      expect(testComponentTree).toMatchSnapshot(
        'Should render hometown with SFO',
      );
    });
  });

  describe('Test Mutations', () => {
    let testComponentTree;

    beforeEach(() => {
      const FeedbackQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestWorldClassAwesomenessQuery(
          $id: ID!
        ) {
          feedback: node(id: $id) {
            ...RelayMockEnvironmentWithComponentsTestNoticeableResultFragment
              @dangerously_unaliased_fixme
          }
        }
      `;

      const FeedbackFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestNoticeableResultFragment on Feedback {
          id
          message {
            text
          }
          doesViewerLike
        }
      `;

      const FeedbackLikeMutation = graphql`
        mutation RelayMockEnvironmentWithComponentsTestDisruptiveSuccessMutation(
          $input: FeedbackLikeInput
        ) {
          feedbackLike(input: $input) {
            feedback {
              id
              doesViewerLike
            }
          }
        }
      `;

      function FeedbackComponent(props: $FlowFixMe) {
        const [busy, setBusy] = useState(false);
        const [errorMessage, setErrorMessage] = useState<null | string>(null);
        return (
          <div>
            {errorMessage != null && (
              <span testID="errorMessage">{errorMessage}</span>
            )}
            {props.feedback.message.text}
            <button
              testID="likeButton"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                commitMutation(props.environment, {
                  mutation: FeedbackLikeMutation,
                  onCompleted: () => {
                    setBusy(false);
                  },
                  onError: e => {
                    setBusy(false);
                    setErrorMessage(e.message);
                  },
                  optimisticResponse: {
                    feedbackLike: {
                      feedback: {
                        id: props.feedback.id,
                        doesViewerLike: true,
                      },
                    },
                  },
                  variables: {
                    input: {
                      feedbackId: props.feedback.id,
                    },
                  },
                });
              }}>
              {(props.feedback.doesViewerLike ?? false) ? 'Unlike' : 'Like'}
            </button>
          </div>
        );
      }

      const Feedback = createFragmentContainer(FeedbackComponent, {
        // eslint-disable-next-line relay/graphql-naming
        feedback: FeedbackFragment,
      });

      const TestComponent = () => {
        return (
          <QueryRenderer
            environment={environment}
            query={FeedbackQuery}
            variables={{id: 'my-feedback-id'}}
            render={({error, props}) => {
              if (props) {
                return (
                  <>
                    <Feedback
                      environment={environment}
                      feedback={props.feedback}
                    />
                  </>
                );
              } else if (error) {
                return <div testID="error">{error.message}</div>;
              }
              return <div testID="loading">Loading...</div>;
            }}
          />
        );
      };
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            ID() {
              return operation.request.variables.id;
            },
            Feedback() {
              return {
                doesViewerLike: false,
              };
            },
          }),
        );
      });
    });

    it('should resolve mutation', () => {
      const likeButton = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'likeButton',
      );
      expect(likeButton.props.disabled).toBe(false);
      expect(likeButton.props.children).toEqual('Like');
      expect(testComponentTree).toMatchSnapshot(
        'Button should be enabled. Text should be "Like".',
      );

      // Should apply optimistic updates
      ReactTestRenderer.act(() => {
        likeButton.props.onClick();
      });

      expect(likeButton.props.disabled).toBe(true);
      expect(likeButton.props.children).toEqual('Unlike');
      expect(testComponentTree).toMatchSnapshot(
        'Should apply optimistic update. Button should says "Unlike". And it should be disabled',
      );
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            Feedback() {
              return {
                id: operation.request.variables?.input?.feedbackId,
                doesViewerLike: true,
              };
            },
          }),
        );
      });
      expect(likeButton.props.disabled).toBe(false);
      expect(likeButton.props.children).toEqual('Unlike');
      expect(testComponentTree).toMatchSnapshot(
        'Should render response from the server. Button should be enabled. And text still "Unlike"',
      );
    });

    it('should reject mutation', () => {
      const likeButton = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'likeButton',
      );
      // Should apply optimistic updates
      ReactTestRenderer.act(() => {
        likeButton.props.onClick();
      });

      // Trigger error
      ReactTestRenderer.act(() => {
        environment.mock.rejectMostRecentOperation(new Error('Uh-oh'));
      });
      expect(testComponentTree).toMatchSnapshot('Should render error message');
    });
  });

  describe('Test Client Filed Handles', () => {
    let testComponentTree;

    beforeEach(() => {
      const HelloHandler = {
        update(storeProxy: RecordSourceProxy, payload: HandleFieldPayload) {
          const record = storeProxy.get(payload.dataID);
          if (record != null) {
            const name = record.getValue(payload.fieldKey);
            record.setValue(
              typeof name === 'string' ? `Hello, ${name.toUpperCase()}!` : null,
              payload.handleKey,
            );
          }
        },
      };
      environment = createMockEnvironment({
        handlerProvider(handle) {
          switch (handle) {
            case 'hello':
              return HelloHandler;
            default:
              return DefaultHandlerProvider(handle);
          }
        },
      });
      const ViewerQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestOutstandingSolutionQuery
        @relay_test_operation {
          viewer {
            actor {
              name @__clientField(handle: "hello")
            }
          }
        }
      `;
      const TestComponent = () => (
        <QueryRenderer
          environment={environment}
          query={ViewerQuery}
          variables={{}}
          render={({error, props}) => {
            if (props) {
              return <div testID="helloMessage">{props.viewer.actor.name}</div>;
            } else if (error) {
              return <div testID="error">{error.message}</div>;
            }
            return <div testID="loading">Loading...</div>;
          }}
        />
      );
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
    });

    it('should resolve operation with handle fields', () => {
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            Actor() {
              return {
                name: 'Carol',
              };
            },
          }),
        );
      });
      expect(
        testComponentTree.root.find(
          // In www, this is differently typed (via react-test-renderer.js.flow) than in
          // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
          // to get flow to accept this typing.
          // $FlowFixMe[missing-local-annot]
          node => node.props.testID === 'helloMessage',
        ).children,
      ).toEqual(['Hello, CAROL!']);
    });
  });

  describe('Subscription Tests', () => {
    let testComponentTree;

    beforeEach(() => {
      const FeedbackQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestRemarkableImpactQuery(
          $id: ID!
        ) {
          feedback: node(id: $id) {
            ...RelayMockEnvironmentWithComponentsTestImpactfulAwesomenessFragment
              @dangerously_unaliased_fixme
          }
        }
      `;

      const FeedbackFragment = graphql`
        fragment RelayMockEnvironmentWithComponentsTestImpactfulAwesomenessFragment on Feedback {
          id
          message {
            text
          }
          doesViewerLike
        }
      `;

      const FeedbackLikeSubscription = graphql`
        subscription RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription(
          $input: FeedbackLikeInput
        ) {
          feedbackLikeSubscribe(input: $input) {
            feedback {
              id
              doesViewerLike
            }
          }
        }
      `;

      function FeedbackComponent(props: $FlowFixMe) {
        useEffect(() => {
          const subscription = requestSubscription(props.environment, {
            subscription: FeedbackLikeSubscription,
            variables: {
              input: {
                feedbackId: props.feedback.id,
              },
            } as RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription$variables,
          });
          return () => {
            subscription.dispose();
          };
        });
        return (
          <div>
            {props.feedback.message.text}
            <span
              testID="reaction"
              reactionType={
                (props.feedback.doesViewerLike ?? false)
                  ? 'Viewer likes it'
                  : 'Viewer does not like it'
              }
            />
          </div>
        );
      }

      const Feedback = createFragmentContainer(FeedbackComponent, {
        // eslint-disable-next-line relay/graphql-naming
        feedback: FeedbackFragment,
      });

      const TestComponent = () => {
        return (
          <QueryRenderer
            environment={environment}
            query={FeedbackQuery}
            variables={{id: 'my-feedback-id'}}
            render={({error, props}) => {
              if (props) {
                return (
                  <Feedback
                    environment={environment}
                    feedback={props.feedback}
                  />
                );
              } else if (error) {
                return <div testID="error">{error.message}</div>;
              }
              return <div testID="loading">Loading...</div>;
            }}
          />
        );
      };
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
      ReactTestRenderer.act(() => {
        environment.mock.resolveMostRecentOperation(operation =>
          MockPayloadGenerator.generate(operation, {
            ID() {
              return operation.request.variables.id;
            },
            Feedback() {
              return {
                doesViewerLike: false,
              };
            },
          }),
        );
      });
    });

    it('should resolve subscription', () => {
      ReactTestRenderer.act(() => {
        expect(testComponentTree).toMatchSnapshot();
      });

      ReactTestRenderer.act(() => {
        jest.runAllTimers();
      });

      const reaction = testComponentTree.root.find(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        node => node.props.testID === 'reaction',
      );
      expect(reaction.props.reactionType).toBe('Viewer does not like it');

      const operation = environment.mock.getMostRecentOperation();
      expect(operation.fragment.node.name).toBe(
        'RelayMockEnvironmentWithComponentsTestRemarkableFixSubscription',
      );
      expect(operation.request.variables).toEqual({
        input: {
          feedbackId: 'my-feedback-id',
        },
      });

      ReactTestRenderer.act(() => {
        environment.mock.nextValue(
          operation.request.node,
          MockPayloadGenerator.generate(operation, {
            Feedback() {
              return {
                id: operation.request.variables?.input?.feedbackId,
                doesViewerLike: true,
              };
            },
          }),
        );
      });
      expect(reaction.props.reactionType).toBe('Viewer likes it');
    });
  });

  describe('Multiple Query Renderers', () => {
    let testComponentTree;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestSwiftPerformanceQuery(
          $userId: ID!
        ) @relay_test_operation {
          user: node(id: $userId) {
            id
            name
          }
        }
      `;

      const PageQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestRedefiningSolutionQuery(
          $pageId: ID!
        ) @relay_test_operation {
          page: node(id: $pageId) {
            id
            name
          }
        }
      `;

      const TestComponent = () => (
        <>
          <QueryRenderer
            environment={environment}
            query={UserQuery}
            variables={{userId: 'my-user-id'}}
            render={({error, props}) => {
              if (props) {
                return <div testID="user">{props.user.name}</div>;
              } else if (error) {
                return <div>{error.message}</div>;
              }
              return <div>Loading...</div>;
            }}
          />
          <QueryRenderer
            environment={environment}
            query={PageQuery}
            variables={{pageId: 'my-page-id'}}
            render={({error, props}) => {
              if (props) {
                return <div testID="page">{props.page.name}</div>;
              } else if (error) {
                return <div>{error.message}</div>;
              }
              return <div>Loading...</div>;
            }}
          />
        </>
      );
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
    });

    it('should resolve both queries', () => {
      const userQuery = environment.mock.findOperation(
        operation =>
          operation.fragment.node.name ===
          'RelayMockEnvironmentWithComponentsTestSwiftPerformanceQuery',
      );
      const pageQuery = environment.mock.findOperation(
        operation =>
          operation.fragment.node.name ===
          'RelayMockEnvironmentWithComponentsTestRedefiningSolutionQuery',
      );
      ReactTestRenderer.act(() => {
        environment.mock.resolve(
          userQuery,
          MockPayloadGenerator.generate(userQuery, {
            Node: () => ({
              id: userQuery.request.variables.userId,
              name: 'Alice',
            }),
          }),
        );
        environment.mock.resolve(
          pageQuery,
          MockPayloadGenerator.generate(pageQuery, {
            Node: () => ({
              id: pageQuery.request.variables.pageId,
              name: 'My Page',
            }),
          }),
        );
      });
      expect(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        testComponentTree.root.find(node => node.props.testID === 'user')
          .children,
      ).toEqual(['Alice']);
      expect(
        // In www, this is differently typed (via react-test-renderer.js.flow) than in
        // fbsource, so it isn't obvious (without syncing react-test-renderer.js.flow) how
        // to get flow to accept this typing.
        // $FlowFixMe[missing-local-annot]
        testComponentTree.root.find(node => node.props.testID === 'page')
          .children,
      ).toEqual(['My Page']);
      expect(testComponentTree).toMatchSnapshot();
    });
  });

  describe('resolve/reject next with components', () => {
    let TestComponent;

    beforeEach(() => {
      const UserQuery = graphql`
        query RelayMockEnvironmentWithComponentsTestWorldClassFeatureQuery(
          $userId: ID!
        ) @relay_test_operation {
          user: node(id: $userId) {
            id
            name
          }
        }
      `;

      TestComponent = () => (
        <QueryRenderer
          environment={environment}
          query={UserQuery}
          variables={{userId: 'my-user-id'}}
          render={({error, props}) => {
            if (props) {
              return <div testID="user">{props.user.name}</div>;
            } else if (error) {
              return <div testID="error">{error.message}</div>;
            }
            return <div>Loading...</div>;
          }}
        />
      );
    });

    it('should resolve next operation', () => {
      environment.mock.queueOperationResolver(operation =>
        MockPayloadGenerator.generate(operation),
      );
      let testComponentTree;
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
      expect(testComponentTree).toMatchSnapshot(
        'should render component with the data',
      );
    });

    it('should reject next operation', () => {
      environment.mock.queueOperationResolver(() => new Error('Uh-oh'));
      let testComponentTree;
      ReactTestRenderer.act(() => {
        testComponentTree = ReactTestRenderer.create(
          <TestComponent />,
          // $FlowFixMe[incompatible-type]
          {
            unstable_isConcurrent: true,
          },
        );
      });
      expect(testComponentTree).toMatchSnapshot(
        'should render component with the error',
      );
    });
  });
});
