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

import type {NormalizationRootNode} from '../../util/NormalizationNode';

const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayOperationTracker = require('../RelayOperationTracker');
const invariant = require('invariant');
const {
  MockPayloadGenerator,
  createMockEnvironment,
} = require('relay-test-utils');
const {
  disallowWarnings,
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();
disallowWarnings();

describe.each([true, false])(
  'RelayModernEnvironment with RelayOperationTracker with ENABLE_LOOSE_SUBSCRIPTION_ATTRIBUTION=%p',
  looseAttribution => {
    let tracker;
    let environment;
    let QueryOperation1;
    let QueryOperation2;
    let MutationOperation;
    let operationLoader: {
      get: (reference: unknown) => ?NormalizationRootNode,
      load: JestMockFn<ReadonlyArray<unknown>, Promise<?NormalizationRootNode>>,
    };

    beforeEach(() => {
      RelayFeatureFlags.ENABLE_LOOSE_SUBSCRIPTION_ATTRIBUTION =
        looseAttribution;
      const Query1 = graphql`
        query RelayModernEnvironmentWithOperationTrackerTest1Query($id: ID)
        @relay_test_operation {
          node(id: $id) {
            ... on Feedback {
              id
              body {
                text
              }
              comments {
                edges {
                  node {
                    id
                    message {
                      text
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const Query2 = graphql`
        query RelayModernEnvironmentWithOperationTrackerTest2Query($id: ID)
        @relay_test_operation {
          node(id: $id) {
            id
          }
        }
      `;

      const Mutation1 = graphql`
        mutation RelayModernEnvironmentWithOperationTrackerTest1Mutation(
          $input: CommentCreateInput
        ) @relay_test_operation {
          commentCreate(input: $input) {
            comment {
              id
              message {
                text
              }
            }
            feedback {
              id
              lastName
              body {
                text
              }
            }
          }
        }
      `;

      QueryOperation1 = createOperationDescriptor(Query1, {id: '1'});
      QueryOperation2 = createOperationDescriptor(Query2, {id: '2'});
      MutationOperation = createOperationDescriptor(Mutation1, {id: '1'});
      operationLoader = {
        load: jest.fn(),
        get: jest.fn(),
      };
      tracker = new RelayOperationTracker();
      environment = createMockEnvironment({
        operationTracker: tracker,
        operationLoader,
      });
    });

    afterEach(() => {
      RelayFeatureFlags.ENABLE_LOOSE_SUBSCRIPTION_ATTRIBUTION = false;
    });

    it('should return an instance of tracker', () => {
      expect(environment.getOperationTracker()).toBe(tracker);
    });

    it('should have operation tracker and operations should not be affected', () => {
      invariant(tracker != null, 'Tracker should be defined');
      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);
      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation2.request),
      ).toBe(null);
    });

    it('should return a promise when there are pending operations that are affecting the owner', () => {
      invariant(tracker != null, 'Tracker should be defined');
      environment
        .execute({
          operation: QueryOperation1,
        })
        .subscribe({});

      // Note: Why do we need to `subscribe` here (and in other places)?
      // We need to subscribe a fragment (with the owner) in order to simulate
      // scenario when the fragment is updated - we need to update
      // OperationTracker, and mark this owner as pending, or completed - if an
      // operation that initiated the change is completed.
      environment.subscribe(
        environment.lookup(QueryOperation1.fragment),
        jest.fn(),
      );

      const FEEDBACK_ID = 'my-feedback-id';

      environment.mock.resolve(
        QueryOperation1,
        MockPayloadGenerator.generate(QueryOperation1, {
          Feedback() {
            return {
              id: FEEDBACK_ID,
            };
          },
        }),
      );

      environment
        .executeMutation({
          operation: MutationOperation,
        })
        .subscribe({});

      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);

      // This mutation is changing the same feedback object, so the owner (QueryOperation1)
      // will be affected by this operation
      environment.mock.nextValue(
        MutationOperation,
        MockPayloadGenerator.generate(MutationOperation, {
          Feedback(context) {
            return {
              id: FEEDBACK_ID,
              body: {
                text: 'Updated text',
              },
            };
          },
        }),
      );

      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request)
          ?.promise,
      ).toBeInstanceOf(Promise);

      // Complete the mutation
      environment.mock.complete(MutationOperation.request.node);

      // There should be no pending operations affecting the owner,
      // after the mutation is completed
      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);
    });

    it('should not have pending operation affecting the owner, if owner does not have subscriptions', () => {
      invariant(tracker != null, 'Tracker should be defined');
      environment
        .execute({
          operation: QueryOperation1,
        })
        .subscribe({});

      const FEEDBACK_ID = 'my-feedback-id';

      environment.mock.resolve(
        QueryOperation1,
        MockPayloadGenerator.generate(QueryOperation1, {
          Feedback() {
            return {
              id: FEEDBACK_ID,
            };
          },
        }),
      );

      environment
        .executeMutation({
          operation: MutationOperation,
        })
        .subscribe({});

      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);

      // This mutation will update the same data as the QueryOperation1
      // but since there are not subscriptions that have owner QueryOperation1
      // it should not be affected
      environment.mock.nextValue(
        MutationOperation,
        MockPayloadGenerator.generate(MutationOperation, {
          Feedback(context) {
            return {
              id: FEEDBACK_ID,
              body: {
                text: 'Updated text',
              },
            };
          },
        }),
      );
      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);
    });

    it('should return a promise for operation affecting owner that resolves when operation completes', () => {
      invariant(tracker != null, 'Tracker should be defined');
      environment
        .execute({
          operation: QueryOperation1,
        })
        .subscribe({});

      environment.subscribe(
        environment.lookup(QueryOperation1.fragment),
        jest.fn(),
      );

      const FEEDBACK_ID = 'my-feedback-id';

      environment.mock.resolve(
        QueryOperation1,
        MockPayloadGenerator.generate(QueryOperation1, {
          Feedback() {
            return {
              id: FEEDBACK_ID,
            };
          },
        }),
      );

      // Let's start mutation
      environment
        .executeMutation({
          operation: MutationOperation,
        })
        .subscribe({});
      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);
      environment.mock.nextValue(
        MutationOperation,
        MockPayloadGenerator.generate(MutationOperation, {
          Feedback() {
            return {
              id: FEEDBACK_ID,
              body: {
                text: 'Updated text',
              },
            };
          },
        }),
      );
      const result = tracker.getPendingOperationsAffectingOwner(
        QueryOperation1.request,
      );

      invariant(result != null, 'Expected to have promise for operation');
      const promiseCallback = jest.fn<[void], unknown>();
      // $FlowFixMe[unused-promise]
      result.promise.then(promiseCallback);
      expect(promiseCallback).not.toBeCalled();
      environment.mock.complete(MutationOperation.request.node);
      jest.runAllTimers();
      expect(promiseCallback).toBeCalled();
    });

    it('pending queries that did not change the data should not affect the owner', () => {
      invariant(tracker != null, 'Tracker should be defined');
      // Send the first query
      environment.execute({operation: QueryOperation1}).subscribe({});

      environment.subscribe(
        environment.lookup(QueryOperation1.fragment),
        jest.fn(),
      );

      // Send the second query
      environment.execute({operation: QueryOperation2}).subscribe({});

      environment.subscribe(
        environment.lookup(QueryOperation2.fragment),
        jest.fn(),
      );

      environment.mock.resolve(
        QueryOperation1,
        MockPayloadGenerator.generate(QueryOperation1, {
          Feedback() {
            return {
              id: 'feedback-id-1',
            };
          },
        }),
      );

      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);

      environment.mock.nextValue(
        QueryOperation2,
        MockPayloadGenerator.generate(QueryOperation2, {
          Node() {
            return {
              __typename: 'Feedback',
              id: 'feedback-id-2',
            };
          },
        }),
      );

      const operations = tracker.getPendingOperationsAffectingOwner(
        QueryOperation1.request,
      );

      expect(operations).toBe(null);
    });

    // If a store update changes a record, that will force us to reread any fragment that
    // read that ID. However, if that re-read results in identical data, we will not notify
    // the subscribers.
    //
    // With ENABLE_LOOSE_SUBSCRIPTION_ATTRIBUTION disabled (default) we also
    // won't mark the store update as affecing the fragment.
    //
    // With ENABLE_LOOSE_SUBSCRIPTION_ATTRIBUTION enabled we _will_ mark the
    // store update as affecing the fragment. If this behavior is sufficient, it
    // will allow us to support OperationTracker with lazy subscriptions that
    // don't read eagerly.
    it('pending queries that changed a record that was read, but not any fields', () => {
      invariant(tracker != null, 'Tracker should be defined');
      environment.execute({operation: QueryOperation1}).subscribe({});

      const query1Subscription = jest.fn();

      environment.subscribe(
        environment.lookup(QueryOperation1.fragment),
        query1Subscription,
      );

      const FEEDBACK_ID = 'my-feedback-id';

      environment.mock.resolve(
        QueryOperation1,
        MockPayloadGenerator.generate(QueryOperation1, {
          Feedback() {
            return {id: FEEDBACK_ID};
          },
        }),
      );

      expect(query1Subscription).toHaveBeenCalledTimes(1);

      // Let's start mutation
      environment.executeMutation({operation: MutationOperation}).subscribe({});
      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);
      environment.mock.nextValue(
        MutationOperation,
        MockPayloadGenerator.generate(MutationOperation, {
          Feedback() {
            return {
              id: FEEDBACK_ID,
              // This field changed on this record but, Query1 does not actually
              // read it. This should mean that Query1 will get re-read, but
              // should not actually trigger an update.
              lastName: 'CHANGED',
            };
          },
        }),
      );

      // Becuase `lastName` was not read by Query1, the subscription should not have notified.
      expect(query1Subscription).toHaveBeenCalledTimes(1);

      const result = tracker.getPendingOperationsAffectingOwner(
        QueryOperation1.request,
      );

      if (looseAttribution) {
        invariant(
          result != null,
          `Expected to have promise for operation due to overlap on ${FEEDBACK_ID}.`,
        );
      } else {
        expect(result).toBe(null);
      }
    });

    it('pending queries that changed ROOT_ID, but not other records read by the subscribed fragment', () => {
      invariant(tracker != null, 'Tracker should be defined');
      environment.execute({operation: QueryOperation1}).subscribe({});

      const query1Subscription = jest.fn();

      environment.subscribe(
        environment.lookup(QueryOperation1.fragment),
        query1Subscription,
      );

      const FEEDBACK_ID = 'my-feedback-id';

      environment.mock.resolve(
        QueryOperation1,
        MockPayloadGenerator.generate(QueryOperation1, {
          Feedback() {
            return {id: FEEDBACK_ID};
          },
        }),
      );

      expect(query1Subscription).toHaveBeenCalledTimes(1);

      // Let's start mutation
      environment.executeMutation({operation: MutationOperation}).subscribe({});
      expect(
        tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
      ).toBe(null);

      const payload = MockPayloadGenerator.generate(MutationOperation, {
        Mutation() {
          return {commentCreate: null};
        },
      });
      environment.mock.nextValue(MutationOperation, payload);

      expect(query1Subscription).toHaveBeenCalledTimes(1);

      const result = tracker.getPendingOperationsAffectingOwner(
        QueryOperation1.request,
      );

      // Loose attribution should ignore changes to ROOT_ID, and without loose
      // attribution there should be no changes to the read fragment data.
      expect(result).toBe(null);
    });

    describe('with @match', () => {
      it('should return a promise for affecting operations', () => {
        //const {Query, Mutation, FeedbackFragment} =
        const Query = graphql`
          query RelayModernEnvironmentWithOperationTrackerTestQuery($id: ID)
          @relay_test_operation {
            node(id: $id) {
              ...RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment
                @dangerously_unaliased_fixme
            }
          }
        `;

        graphql`
          fragment RelayModernEnvironmentWithOperationTrackerTestPlainUserNameRenderer_name on PlainUserNameRenderer {
            plaintext
            data {
              text
            }
          }
        `;
        graphql`
          fragment RelayModernEnvironmentWithOperationTrackerTestMarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
            markdown
            data {
              markup
            }
          }
        `;

        const FeedbackFragment = graphql`
          fragment RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment on Feedback {
            id
            body {
              text
            }
            author {
              __typename
              nameRenderer @match {
                ...RelayModernEnvironmentWithOperationTrackerTestPlainUserNameRenderer_name
                  @module(name: "PlainUserNameRenderer.react")
                ...RelayModernEnvironmentWithOperationTrackerTestMarkdownUserNameRenderer_name
                  @module(name: "MarkdownUserNameRenderer.react")
              }
              plainNameRenderer: nameRenderer
                @match(
                  key: "RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment_plainNameRenderer"
                ) {
                ...RelayModernEnvironmentWithOperationTrackerTestPlainUserNameRenderer_name
                  @module(name: "PlainUserNameRenderer.react")
              }
            }
          }
        `;

        const Mutation = graphql`
          mutation RelayModernEnvironmentWithOperationTrackerTestMutation(
            $input: CommentCreateInput
          ) @relay_test_operation {
            commentCreate(input: $input) {
              feedback {
                ...RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment
              }
            }
          }
        `;

        QueryOperation1 = createOperationDescriptor(Query, {id: '1'});
        MutationOperation = createOperationDescriptor(Mutation, {id: '1'});

        invariant(tracker != null, 'Tracker should be defined');
        environment
          .execute({
            operation: QueryOperation1,
          })
          .subscribe({});

        const FEEDBACK_ID = 'my-feedback-id';

        environment.subscribe(
          environment.lookup(QueryOperation1.fragment),
          jest.fn(),
        );
        environment.subscribe(
          environment.lookup(
            createReaderSelector(
              FeedbackFragment,
              FEEDBACK_ID,
              QueryOperation1.request.variables,
              QueryOperation1.request,
            ),
          ),
          jest.fn(),
        );

        operationLoader.load.mockImplementation(() =>
          Promise.resolve(undefined),
        );
        environment.mock.resolve(QueryOperation1.request.node, {
          data: {
            node: {
              __typename: 'Feedback',
              id: FEEDBACK_ID,
              body: {
                text: '<mock-value-for-field-"text">',
              },
              author: {
                __typename: 'User',
                nameRenderer: {
                  __typename: 'MarkdownUserNameRenderer',
                  markdown: 'mock value',
                  data: {
                    markup: 'mock value',
                  },
                  __module_component_RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment:
                    '<mock-value-for-field-"__module_component_FeedbackFragment">',
                  __module_operation_RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment:
                    '<mock-value-for-field-"__module_operation_FeedbackFragment">',
                },
                plainNameRenderer: {
                  __typename: 'PlainUserNameRenderer',
                  __module_component_RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment:
                    '<mock-value-for-field-"__module_component_FeedbackFragment">',
                  __module_operation_RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment:
                    '<mock-value-for-field-"__module_operation_FeedbackFragment">',
                },
                id: '<User-mock-id-1>',
              },
            },
          },
        });
        expect(operationLoader.load).toBeCalled();
        operationLoader.load.mockClear();

        // We still processing follow-up payloads for the initial query
        expect(
          tracker.getPendingOperationsAffectingOwner(QueryOperation1.request)
            ?.promise,
        ).toBeInstanceOf(Promise);
        jest.runAllTimers();

        // All followup completed, operation tracker should be completed
        expect(
          tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
        ).toBe(null);

        // Send the mutation
        environment
          .executeMutation({
            operation: MutationOperation,
          })
          .subscribe({});

        environment.mock.nextValue(MutationOperation, {
          data: {
            commentCreate: {
              feedback: {
                id: FEEDBACK_ID,
                body: {
                  text: '<mock-value-for-field-"text">',
                },
                author: {
                  __typename: 'User',
                  nameRenderer: {
                    __typename: 'PlainUserNameRenderer',
                    __module_component_RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment:
                      '<mock-value-for-field-"__module_component_FeedbackFragment">',
                    __module_operation_RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment:
                      '<mock-value-for-field-"__module_operation_FeedbackFragment">',
                  },
                  plainNameRenderer: {
                    __typename: 'PlainUserNameRenderer',
                    __module_component_RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment_plainNameRenderer:
                      '<mock-value-for-field-"__module_component_FeedbackFragment">',
                    __module_operation_RelayModernEnvironmentWithOperationTrackerTestFeedbackFragment_plainNameRenderer:
                      '<mock-value-for-field-"__module_operation_FeedbackFragment">',
                  },
                  id: '<User-mock-id-1>',
                },
              },
            },
          },
        });

        expect(
          tracker.getPendingOperationsAffectingOwner(QueryOperation1.request)
            ?.promise,
        ).toBeInstanceOf(Promise);

        environment.mock.complete(MutationOperation);
        expect(operationLoader.load).toBeCalled();
        jest.runAllTimers();
        expect(
          tracker.getPendingOperationsAffectingOwner(QueryOperation1.request),
        ).toBe(null);
      });
    });
  },
);
