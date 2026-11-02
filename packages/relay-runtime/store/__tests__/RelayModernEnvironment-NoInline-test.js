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
import type {
  GraphQLResponse,
  GraphQLResponseWithData,
  LogRequestInfoFunction,
  UploadableMap,
} from '../../network/RelayNetworkTypes';
import type {Sink} from '../../network/RelayObservable';
import type {NormalizationRootNode} from '../../util/NormalizationNode';
import type {
  ConcreteRequest,
  RequestParameters,
} from '../../util/RelayConcreteNode';
import type {CacheConfig, Variables} from '../../util/RelayRuntimeTypes';
import type {NormalizationResult} from '../NormalizationEngine';
import type {OperationLoader, RecordSource} from '../RelayStoreTypes';

const {
  MultiActorEnvironment,
  getActorIdentifier,
} = require('../../multi-actor-environment');
const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const NormalizationEngine = require('../NormalizationEngine');
const normalizeResponse = require('../normalizeResponse');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {getSingularSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const nullthrows = require('nullthrows');
const {
  disallowWarnings,
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();
disallowWarnings();

// Inline parity-test helpers: drive a (query, variables, loadFragment,
// response) tuple through both code paths (OperationExecutor and
// NormalizationEngine) and return uniform `ParityResult`s. Used by the
// `parity (%s)` describe.each blocks below.
type ParityArgs = Readonly<{
  query: ConcreteRequest,
  variables: Variables,
  loadFragment: (operationReference: unknown) => ?NormalizationRootNode,
  // Optional: when set, .get() always returns null (forcing the async path)
  // and .load() delegates here. Use to test async load semantics — including
  // rejection — that can't be expressed via the sync `loadFragment` alone.
  loadFragmentAsync?: (
    operationReference: unknown,
  ) => Promise<?NormalizationRootNode>,
  response: GraphQLResponseWithData,
}>;

type ParityResult = Readonly<{
  // Record-source view of normalized records.
  //   - executor: env's store source post-commit (all payloads merged in).
  //   - engine:   the LAST payload's source (typically the followup that
  //               populates the parent record's fields). Tests needing other
  //               payloads should reach into `engineResult.payloads[N].source`
  //               directly.
  source: RecordSource,
  // Wraps `normalizeResponse` so tests can introspect per-call args (e.g.,
  // find @module followup invocations by `selector.node.kind`).
  normalizeResponseSpy: JestMockFn<
    Parameters<typeof normalizeResponse>,
    ReturnType<typeof normalizeResponse>,
  >,
  // Engine-only: the raw NormalizationResult. Null for the executor path.
  engineResult: NormalizationResult | null,
  // Errors surfaced during processing, normalized across both paths:
  //   - executor: invocations of `subscribe({error})` (e.g., async @module
  //               load failures forwarded by `OperationExecutor.js:1121`).
  //   - engine:   `Promise.allSettled(pendingModules)` rejection reasons.
  errors: ReadonlyArray<unknown>,
}>;

async function runViaOperationExecutor(
  args: ParityArgs,
): Promise<ParityResult> {
  const normalizeResponseSpy = jest.fn(normalizeResponse);
  let dataSource: ?Sink<GraphQLResponse>;
  const localFetch = (
    _query: RequestParameters,
    _variables: Variables,
    _cacheConfig: CacheConfig,
  ) =>
    RelayObservable.create((sink: Sink<GraphQLResponse>) => {
      dataSource = sink;
    });
  const localStore = new RelayModernStore(RelayRecordSource.create(), {
    gcReleaseBufferSize: 0,
  });
  const localEnv = new RelayModernEnvironment({
    // $FlowFixMe[invalid-tuple-arity] error found when enabling Flow LTI mode
    network: RelayNetwork.create(localFetch),
    normalizeResponse: normalizeResponseSpy,
    operationLoader: buildOperationLoader(
      args.loadFragment,
      args.loadFragmentAsync,
    ),
    store: localStore,
  });
  const errorCallback = jest.fn<[Error], unknown>();
  const op = createOperationDescriptor(args.query, args.variables);
  localEnv.execute({operation: op}).subscribe({
    complete: jest.fn<[], unknown>(),
    error: errorCallback,
    next: jest.fn<[unknown], unknown>(),
  });
  // dataSource is assigned synchronously inside RelayObservable.create above.
  // $FlowFixMe[incompatible-use]
  dataSource.next(args.response);
  jest.runAllTimers();
  return {
    engineResult: null,
    errors: errorCallback.mock.calls.map(call => call[0]),
    normalizeResponseSpy,
    source: localStore.getSource(),
  };
}

async function runViaNormalizationEngine(
  args: ParityArgs,
): Promise<ParityResult> {
  const normalizeResponseSpy = jest.fn(normalizeResponse);
  const op = createOperationDescriptor(args.query, args.variables);
  const engine = new NormalizationEngine({
    normalizeResponse: normalizeResponseSpy,
    operation: op.request.node.operation,
    operationLoader: buildOperationLoader(
      args.loadFragment,
      args.loadFragmentAsync,
    ),
    variables: op.request.variables,
  });
  const engineResult = engine.processResponse(args.response);
  // Drain pendingModules to surface async @module load failures uniformly
  // with the executor path's `subscribe({error})` channel. Hand-rolled
  // settle (Promise.allSettled isn't in the test env's Promise polyfill).
  const settled = await Promise.all(
    engineResult.pendingModules.map(p =>
      p.then<{kind: 'ok'} | {kind: 'err', reason: unknown}>(
        () => ({kind: 'ok'}),
        (reason: unknown) => ({kind: 'err', reason}),
      ),
    ),
  );
  const errors = settled
    .filter(s => s.kind === 'err')
    .map(s => (s as $FlowFixMe).reason);
  return {
    engineResult,
    errors,
    normalizeResponseSpy,
    source: engineResult.payloads[engineResult.payloads.length - 1].source,
  };
}

function buildOperationLoader(
  loadFragment: (ref: unknown) => ?NormalizationRootNode,
  loadFragmentAsync: ?(ref: unknown) => Promise<?NormalizationRootNode>,
): OperationLoader {
  if (loadFragmentAsync != null) {
    return {
      get: jest.fn(() => null),
      load: jest.fn(loadFragmentAsync),
    };
  }
  return {
    get: jest.fn(loadFragment),
    load: jest.fn((ref: unknown) => Promise.resolve(loadFragment(ref))),
  };
}

const Query = graphql`
  query RelayModernEnvironmentNoInlineTestQuery(
    $size: [Int]
    $preset: PhotoSize
  ) {
    me {
      ...RelayModernEnvironmentNoInlineTest_noInline
    }
  }
`;

const NoInlineFragment = graphql`
  fragment RelayModernEnvironmentNoInlineTest_noInline on Actor @no_inline {
    ... on User {
      profile_picture: profilePicture2(
        size: $size
        preset: $preset
        fileExtension: PNG
      ) {
        uri
      }
    }
    ...RelayModernEnvironmentNoInlineTest_inner
      @dangerously_unaliased_fixme
      @arguments(cond: true, preset: $preset, fileExtension: JPG)
  }
`;

const InnerFragment = graphql`
  fragment RelayModernEnvironmentNoInlineTest_inner on User
  @argumentDefinitions(
    cond: {type: "Boolean!"}
    preset: {type: "PhotoSize"}
    fileExtension: {type: "FileExtension"}
  ) {
    ... @include(if: $cond) {
      profile_picture_inner: profilePicture2(
        # accesses a global directly
        size: $size

        # accesses a local that is passed a global
        preset: $preset

        # accesses a local that is passed a constant
        fileExtension: $fileExtension
      ) {
        uri
      }
    }
  }
`;

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  '@no_inline',
  environmentType => {
    describe(environmentType, () => {
      let environment;
      let fetch;
      let store;
      let source;
      let subject;
      let operation;
      let callbacks;

      beforeEach(() => {
        fetch = jest.fn(
          (
            _query: ?(
              | LogRequestInfoFunction
              | UploadableMap
              | RequestParameters
              | Variables
              | CacheConfig
            ),
            _variables: ?(
              | LogRequestInfoFunction
              | UploadableMap
              | RequestParameters
              | Variables
              | CacheConfig
            ),
            _cacheConfig: ?(
              | LogRequestInfoFunction
              | UploadableMap
              | RequestParameters
              | Variables
              | CacheConfig
            ),
          ) =>
            // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
            RelayObservable.create(sink => {
              subject = sink;
            }),
        );
        callbacks = {
          complete: jest.fn<[], unknown>(),
          error: jest.fn<[Error], unknown>(),
          next: jest.fn<[GraphQLResponse], unknown>(),
        };
        source = RelayRecordSource.create();
        store = new RelayModernStore(source, {gcReleaseBufferSize: 0});
        const multiActorEnvironment = new MultiActorEnvironment({
          // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
          createNetworkForActor: _actorID => RelayNetwork.create(fetch),
          createStoreForActor: _actorID => store,
        });

        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
                network: RelayNetwork.create(fetch),
                store,
              });
        operation = createOperationDescriptor(Query, {size: [1]});
      });

      it('executes and reads back results (fragment type matches)', () => {
        environment.execute({operation}).subscribe(callbacks);
        subject.next({
          data: {
            me: {
              __isActor: 'User',
              id: '1',
              profile_picture: {
                uri: 'https://profile.png',
              },
              profile_picture_inner: {
                uri: 'https://profile.jpg',
              },
            },
          },
          extensions: {
            is_final: true,
          },
        });
        expect(
          (callbacks.error as $FlowFixMe).mock.calls.map(call => call[0].stack),
        ).toEqual([]);
        expect(callbacks.next).toBeCalledTimes(1);
        expect(callbacks.complete).toBeCalledTimes(0);
        subject.complete();
        expect(callbacks.complete).toBeCalledTimes(1);

        const queryData = environment.lookup(operation.fragment);
        expect(queryData.data).toEqual({
          me: {
            __fragmentOwner: operation.request,
            __fragments: {
              [NoInlineFragment.name]: expect.anything(),
            },
            __id: '1',
          },
        });

        // noInline fragment data is present
        const selector = nullthrows(
          getSingularSelector(
            NoInlineFragment,
            (queryData.data as $FlowFixMe).me,
          ),
        );
        const selectorData = environment.lookup(selector);
        expect(selectorData.data).toEqual({
          __fragmentOwner: operation.request,
          __fragments: {
            [InnerFragment.name]: expect.anything(),
          },
          __id: '1',
          profile_picture: {
            uri: 'https://profile.png',
          },
        });

        // Inner (normal, inlined) fragment data is present
        const innerSelector = nullthrows(
          getSingularSelector(InnerFragment, selectorData.data as $FlowFixMe),
        );
        const innerSelectorData = environment.lookup(innerSelector);
        expect(innerSelectorData.isMissingData).toBe(false);
        expect(innerSelectorData.data).toEqual({
          profile_picture_inner: {
            uri: 'https://profile.jpg',
          },
        });

        // available before a GC
        expect(environment.check(operation)).toEqual({
          fetchTime: null,
          status: 'available',
        });

        // available after GC if the query is retained
        const retain = environment.retain(operation);
        (environment.getStore() as $FlowFixMe).scheduleGC();
        jest.runAllTimers();
        expect(environment.check(operation)).toEqual({
          fetchTime: null,
          status: 'available',
        });

        // missing after being freed plus a GC run
        retain.dispose();
        (environment.getStore() as $FlowFixMe).scheduleGC();
        jest.runAllTimers();
        expect(environment.check(operation)).toEqual({
          status: 'missing',
        });
      });

      it('executes and reads back results (fragment type does not match)', () => {
        environment.execute({operation}).subscribe(callbacks);
        subject.next({
          data: {
            me: {
              id: '1',
              // pretend that the object doesn't implement Actor
              // (so exclude __isActor and other Actor-conditional fields)
            },
          },
          extensions: {
            is_final: true,
          },
        });
        expect(
          (callbacks.error as $FlowFixMe).mock.calls.map(call => call[0].stack),
        ).toEqual([]);
        expect(callbacks.next).toBeCalledTimes(1);
        expect(callbacks.complete).toBeCalledTimes(0);
        subject.complete();
        expect(callbacks.complete).toBeCalledTimes(1);

        const queryData = environment.lookup(operation.fragment);
        expect(queryData.data).toEqual({
          me: {
            __fragmentOwner: operation.request,
            __fragments: {
              [NoInlineFragment.name]: expect.anything(),
            },
            __id: '1',
          },
        });

        // Data for the noInline fragment should still be read since reader always
        // attempts to read fragments even if the fragment type doesn't match the
        // record
        const selector = nullthrows(
          getSingularSelector(
            NoInlineFragment,
            (queryData.data as $FlowFixMe).me,
          ),
        );
        const selectorData = environment.lookup(selector);
        expect(selectorData.data).toEqual({
          __fragmentOwner: operation.request,
          __fragments: {
            [InnerFragment.name]: {
              $isWithinUnmatchedTypeRefinement: true, // fragment type didn't match
              cond: true,
              fileExtension: 'JPG',
              preset: null,
            },
          },
          __id: '1',
        });

        // Inner data should be missing bc the type didn't match
        const innerSelector = nullthrows(
          getSingularSelector(InnerFragment, selectorData.data as $FlowFixMe),
        );
        const innerSelectorData = environment.lookup(innerSelector);
        expect(innerSelectorData.isMissingData).toBe(false);
        expect(innerSelectorData.data).toEqual({});

        // available before a GC
        expect(environment.check(operation)).toEqual({
          fetchTime: null,
          status: 'available',
        });

        // available after GC if the query is retained
        const retain = environment.retain(operation);
        (environment.getStore() as $FlowFixMe).scheduleGC();
        jest.runAllTimers();
        expect(environment.check(operation)).toEqual({
          fetchTime: null,
          status: 'available',
        });

        // missing after being freed plus a GC run
        retain.dispose();
        (environment.getStore() as $FlowFixMe).scheduleGC();
        jest.runAllTimers();
        expect(environment.check(operation)).toEqual({
          status: 'missing',
        });
      });

      describe('with arguments', () => {
        it('passes an explicit null argument, not the default', () => {
          const QueryWithNullArgument = graphql`
            query RelayModernEnvironmentNoInlineTestNullArgumentQuery(
              $preset: PhotoSize
            ) {
              me {
                ...RelayModernEnvironmentNoInlineTestNullArgument_user
                  @arguments(preset: $preset)
              }
            }
          `;
          const NoInlineFragmentWithNullArgument = graphql`
            fragment RelayModernEnvironmentNoInlineTestNullArgument_user on User
            @no_inline
            @argumentDefinitions(
              preset: {type: "PhotoSize", defaultValue: SMALL}
            ) {
              profilePicture2(preset: $preset) {
                uri
              }
            }
          `;
          operation = createOperationDescriptor(QueryWithNullArgument, {
            preset: null,
          });
          environment.commitPayload(operation, {
            me: {
              __typename: 'User',
              id: '1',
              profilePicture2: {uri: 'https://default-size.png'},
            },
          });
          const queryData = environment.lookup(operation.fragment);
          const snapshot = environment.lookup(
            nullthrows(
              getSingularSelector(
                NoInlineFragmentWithNullArgument,
                (queryData.data as $FlowFixMe).me,
              ),
            ),
          );
          expect(snapshot.isMissingData).toBe(false);
          expect(snapshot.data).toEqual({
            profilePicture2: {uri: 'https://default-size.png'},
          });
        });

        it('passes the default for an explicit null argument with ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS off', () => {
          RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS = false;
          try {
            const QueryWithNullArgument = require('./__generated__/RelayModernEnvironmentNoInlineTestNullArgumentQuery.graphql');
            const NoInlineFragmentWithNullArgument = require('./__generated__/RelayModernEnvironmentNoInlineTestNullArgument_user.graphql');
            operation = createOperationDescriptor(QueryWithNullArgument, {
              preset: null,
            });
            environment.commitPayload(operation, {
              me: {
                __typename: 'User',
                id: '1',
                profilePicture2: {uri: 'https://default-size.png'},
              },
            });
            const queryData = environment.lookup(operation.fragment);
            const snapshot = environment.lookup(
              nullthrows(
                getSingularSelector(
                  NoInlineFragmentWithNullArgument,
                  (queryData.data as $FlowFixMe).me,
                ),
              ),
            );
            // The response was written under the default's key.
            expect(snapshot.isMissingData).toBe(true);
          } finally {
            RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS = true;
          }
        });

        it('executes and reads back results with no-inline fragments on the same level', () => {
          const QueryWithArgs = graphql`
            query RelayModernEnvironmentNoInlineTestWithArgsQuery(
              $size: [Int]
              $preset: PhotoSize
            ) {
              me {
                ...RelayModernEnvironmentNoInlineTestWithArgs_noInline
                  @arguments(cond: true)
              }
              username(name: "Zuck") {
                ...RelayModernEnvironmentNoInlineTestWithArgs_noInline
                  @arguments(cond: false)
              }
            }
          `;
          const NoInlineFragmentWithArgs = graphql`
            fragment RelayModernEnvironmentNoInlineTestWithArgs_noInline on Actor
            @no_inline
            @argumentDefinitions(
              cond: {type: "Boolean!"}
              fileExtension: {type: "FileExtension!", defaultValue: JPG}
            ) {
              ... on User {
                profile_picture: profilePicture2(
                  size: $size
                  preset: $preset
                  fileExtension: PNG
                ) {
                  uri
                }
              }
              ...RelayModernEnvironmentNoInlineTest_inner
                @dangerously_unaliased_fixme
                @arguments(
                  cond: $cond
                  preset: $preset
                  fileExtension: $fileExtension
                )
            }
          `;
          operation = createOperationDescriptor(QueryWithArgs, {
            size: [1],
          });
          environment.execute({operation}).subscribe(callbacks);

          subject.next({
            data: {
              me: {
                __isActor: 'User',
                id: '1',
                profile_picture: {
                  uri: 'https://profile.png',
                },
                profile_picture_inner: {
                  uri: 'https://profile.jpg',
                },
              },
              username: {
                __isActor: 'User',
                __typename: 'User',
                id: '2',
                profile_picture: {
                  uri: 'https://profile.png',
                },
                profile_picture_inner: {
                  uri: 'https://profile.jpg',
                },
              },
            },
            extensions: {
              is_final: true,
            },
          });
          expect(
            (callbacks.error as $FlowFixMe).mock.calls.map(
              call => call[0].stack,
            ),
          ).toEqual([]);
          expect(callbacks.next).toBeCalledTimes(1);
          expect(callbacks.complete).toBeCalledTimes(0);
          subject.complete();
          expect(callbacks.complete).toBeCalledTimes(1);

          const queryData = environment.lookup(operation.fragment);
          expect(queryData.data).toEqual({
            me: {
              __fragmentOwner: operation.request,
              __fragments: {
                [NoInlineFragmentWithArgs.name]: expect.anything(),
              },
              __id: '1',
            },
            username: {
              __fragmentOwner: operation.request,
              __fragments: {
                [NoInlineFragmentWithArgs.name]: expect.anything(),
              },
              __id: '2',
            },
          });

          // noInline fragment data for `me` and `username` is present
          const selector = nullthrows(
            getSingularSelector(
              NoInlineFragmentWithArgs,
              (queryData.data as $FlowFixMe).me,
            ),
          );
          const selectorData = environment.lookup(selector);
          expect(selectorData.data).toEqual({
            __fragmentOwner: operation.request,
            __fragments: {
              [InnerFragment.name]: expect.anything(),
            },
            __id: '1',
            profile_picture: {
              uri: 'https://profile.png',
            },
          });

          const selectorUsername = nullthrows(
            getSingularSelector(
              NoInlineFragmentWithArgs,
              (queryData.data as $FlowFixMe).username,
            ),
          );
          const selectorUsernameData = environment.lookup(selectorUsername);
          expect(selectorUsernameData.data).toEqual({
            __fragmentOwner: operation.request,
            __fragments: {
              [InnerFragment.name]: expect.anything(),
            },
            __id: '2',
            profile_picture: {
              uri: 'https://profile.png',
            },
          });

          // Inner (normal, inlined) fragment data is present
          const innerSelector = nullthrows(
            getSingularSelector(InnerFragment, selectorData.data as $FlowFixMe),
          );
          const innerSelectorData = environment.lookup(innerSelector);
          expect(innerSelectorData.isMissingData).toBe(false);
          expect(innerSelectorData.data).toEqual({
            profile_picture_inner: {
              uri: 'https://profile.jpg',
            },
          });

          // The inner fragment data for `username` should be empty
          // because the `$cond` on `@include` is `false`
          const innerSelectorUsername = nullthrows(
            getSingularSelector(
              InnerFragment,
              selectorUsernameData.data as $FlowFixMe,
            ),
          );
          const innerSelectorUsernameData = environment.lookup(
            innerSelectorUsername,
          );
          expect(innerSelectorUsernameData.isMissingData).toBe(false);
          expect(innerSelectorUsernameData.data).toEqual({});

          // available before a GC
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // available after GC if the query is retained
          const retain = environment.retain(operation);
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // missing after being freed plus a GC run
          retain.dispose();
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            status: 'missing',
          });
        });

        it('executes and reads back results with nested no-inline fragments', () => {
          const QueryNested = graphql`
            query RelayModernEnvironmentNoInlineTestNestedQuery(
              $global_cond: Boolean!
            ) {
              ...RelayModernEnvironmentNoInlineTest_nestedNoInlineParent
                @arguments(cond: true)
            }
          `;

          const NoInlineFragmentNestedParent = graphql`
            fragment RelayModernEnvironmentNoInlineTest_nestedNoInlineParent on Query
            @no_inline
            @argumentDefinitions(cond: {type: "Boolean!"}) {
              mark: username(name: "Mark") {
                ...RelayModernEnvironmentNoInlineTest_nestedNoInline
                  @dangerously_unaliased_fixme
                  @arguments(cond: $global_cond)
              }
              zuck: username(name: "Zuck") {
                ...RelayModernEnvironmentNoInlineTest_nestedNoInline
                  @dangerously_unaliased_fixme
                  @arguments(cond: false)
              }
              joe: username(name: "Joe") {
                ...RelayModernEnvironmentNoInlineTest_nestedNoInline
                  @dangerously_unaliased_fixme
                  @arguments(cond: $cond)
              }
            }
          `;
          const NoInlineFragmentNested = graphql`
            fragment RelayModernEnvironmentNoInlineTest_nestedNoInline on User
            @no_inline
            @argumentDefinitions(cond: {type: "Boolean!"}) {
              ... @include(if: $cond) {
                name
              }
            }
          `;

          operation = createOperationDescriptor(QueryNested, {
            global_cond: false,
          });
          environment.execute({operation}).subscribe(callbacks);

          subject.next({
            data: {
              joe: {
                __isActor: 'User',
                __typename: 'User',
                id: '3',
                name: 'Joe',
              },
              mark: {
                __isActor: 'User',
                __typename: 'User',
                id: '1',
                name: 'Zuck',
              },
              zuck: {
                __isActor: 'User',
                __typename: 'User',
                id: '2',
                name: 'Zuck',
              },
            },
            extensions: {
              is_final: true,
            },
          });
          expect(
            (callbacks.error as $FlowFixMe).mock.calls.map(
              call => call[0].stack,
            ),
          ).toEqual([]);
          expect(callbacks.next).toBeCalledTimes(1);
          expect(callbacks.complete).toBeCalledTimes(0);
          subject.complete();
          expect(callbacks.complete).toBeCalledTimes(1);

          const queryData = environment.lookup(operation.fragment);
          const selector = nullthrows(
            getSingularSelector(
              NoInlineFragmentNestedParent,
              queryData.data as $FlowFixMe,
            ),
          );
          const selectorData = environment.lookup(selector);
          expect(selectorData.data).toEqual({
            joe: {
              __fragmentOwner: operation.request,
              __fragments: {
                [NoInlineFragmentNested.name]: expect.anything(),
              },
              __id: '3',
            },
            mark: {
              __fragmentOwner: operation.request,
              __fragments: {
                [NoInlineFragmentNested.name]: expect.anything(),
              },
              __id: '1',
            },
            zuck: {
              __fragmentOwner: operation.request,
              __fragments: {
                [NoInlineFragmentNested.name]: expect.anything(),
              },
              __id: '2',
            },
          });

          // $cond is set to $global_cond which is false
          const selector1 = nullthrows(
            getSingularSelector(
              NoInlineFragmentNested,
              // $FlowFixMe[incompatible-use]
              selectorData.data.mark,
            ),
          );
          const selector1Data = environment.lookup(selector1);
          expect(selector1Data.isMissingData).toBe(false);
          expect(selector1Data.data).toEqual({});

          // $cond is set to literal false
          const selector2 = nullthrows(
            getSingularSelector(
              NoInlineFragmentNested,
              // $FlowFixMe[incompatible-use]
              selectorData.data.zuck,
            ),
          );
          const selector2Data = environment.lookup(selector2);
          expect(selector2Data.isMissingData).toBe(false);
          expect(selector2Data.data).toEqual({});

          // $cond is set to local $cond which is true
          const selector3 = nullthrows(
            getSingularSelector(
              NoInlineFragmentNested,
              // $FlowFixMe[incompatible-use]
              selectorData.data.joe,
            ),
          );
          const selector3Data = environment.lookup(selector3);
          expect(selector3Data.isMissingData).toBe(false);
          expect(selector3Data.data).toEqual({name: 'Joe'});

          // available before a GC
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // available after GC if the query is retained
          const retain = environment.retain(operation);
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // missing after being freed plus a GC run
          retain.dispose();
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            status: 'missing',
          });
        });
      });

      describe('with @stream and @defer', () => {
        it('executes and reads back results with stream', () => {
          const QueryWithStream = graphql`
            query RelayModernEnvironmentNoInlineTestStreamQuery(
              $cond: Boolean!
            ) {
              node(id: "1") {
                ...RelayModernEnvironmentNoInlineTestStream_feedback
                  @dangerously_unaliased_fixme
                  @arguments(cond: $cond)
              }
            }
          `;
          const NoInlineFragmentWithStream = graphql`
            fragment RelayModernEnvironmentNoInlineTestStream_feedback on Feedback
            @no_inline
            @argumentDefinitions(cond: {type: "Boolean!", defaultValue: true}) {
              actors @stream(label: "actors", initial_count: 0) {
                ... @include(if: $cond) {
                  name
                }
              }
            }
          `;
          operation = createOperationDescriptor(QueryWithStream, {
            cond: false,
          });
          environment.execute({operation}).subscribe(callbacks);

          subject.next({
            data: {
              node: {
                __typename: 'Feedback',
                actors: [],
                id: '1',
              },
            },
          });

          subject.next({
            data: {
              __typename: 'User',
              id: '2',
              name: 'Alice',
            },
            label:
              'RelayModernEnvironmentNoInlineTestStream_feedback$stream$actors',
            path: ['node', 'actors', 0],
          });
          expect(
            (callbacks.error as $FlowFixMe).mock.calls.map(
              call => call[0].stack,
            ),
          ).toEqual([]);
          expect(callbacks.next).toBeCalledTimes(2);
          expect(callbacks.complete).toBeCalledTimes(0);
          subject.complete();
          expect(callbacks.complete).toBeCalledTimes(1);

          const queryData = environment.lookup(operation.fragment);
          expect(queryData.data).toEqual({
            node: {
              __fragmentOwner: operation.request,
              __fragments: {
                [NoInlineFragmentWithStream.name]: expect.anything(),
              },
              __id: '1',
            },
          });

          const selector = nullthrows(
            getSingularSelector(
              NoInlineFragmentWithStream,
              (queryData.data as $FlowFixMe).node,
            ),
          );
          const selectorData = environment.lookup(selector);
          // `name` should not be normalized because $cond is false
          expect(selectorData.data).toEqual({
            actors: [{}],
          });

          // available before a GC
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // available after GC if the query is retained
          const retain = environment.retain(operation);
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // missing after being freed plus a GC run
          retain.dispose();
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            status: 'missing',
          });

          // Set cond to true and the name should be normalized
          operation = createOperationDescriptor(QueryWithStream, {
            cond: true,
          });
          environment.execute({operation}).subscribe(callbacks);
          subject.next({
            data: {
              node: {
                __typename: 'Feedback',
                actors: [],
                id: '1',
              },
            },
          });
          subject.next({
            data: {
              __typename: 'User',
              id: '2',
              name: 'Alice',
            },
            label:
              'RelayModernEnvironmentNoInlineTestStream_feedback$stream$actors',
            path: ['node', 'actors', 0],
          });
          const queryData2 = environment.lookup(operation.fragment);
          const selector2 = nullthrows(
            getSingularSelector(
              NoInlineFragmentWithStream,
              (queryData2.data as $FlowFixMe).node,
            ),
          );
          const selectorData2 = environment.lookup(selector2);
          expect(selectorData2.data).toEqual({
            actors: [{name: 'Alice'}],
          });
        });

        it('executes and reads back results with defer and stream', () => {
          const QueryWithDeferredStream = graphql`
            query RelayModernEnvironmentNoInlineTestDeferredStreamQuery(
              $cond: Boolean!
              $enableStream: Boolean
            ) {
              viewer {
                ...RelayModernEnvironmentNoInlineTestDeferredStreamParent
                  @arguments(cond: $cond, enableStream: $enableStream)
              }
            }
          `;
          const NoInlineFragmentWithDeferredStreamParent = graphql`
            fragment RelayModernEnvironmentNoInlineTestDeferredStreamParent on Viewer
            @argumentDefinitions(
              cond: {type: "Boolean!"}
              enableStream: {type: "Boolean"}
            ) {
              ...RelayModernEnvironmentNoInlineTestDeferredStream_newsFeed
                @arguments(cond: $cond, enableStream: $enableStream)
                @defer(label: "FeedFragment")
            }
          `;
          const NoInlineFragmentWithDeferredStream = graphql`
            fragment RelayModernEnvironmentNoInlineTestDeferredStream_newsFeed on Viewer
            @no_inline
            @argumentDefinitions(
              cond: {type: "Boolean!", defaultValue: true}
              enableStream: {type: "Boolean", defaultValue: false}
            ) {
              newsFeed(first: 2) {
                edges
                  @stream(
                    label: "newsFeed"
                    if: $enableStream
                    initial_count: 0
                  ) {
                  node {
                    ... @include(if: $cond) {
                      feedback {
                        author {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          `;
          operation = createOperationDescriptor(QueryWithDeferredStream, {
            cond: false,
            enableStream: true,
          });
          environment.execute({operation}).subscribe(callbacks);

          subject.next({
            data: {
              viewer: {
                __typename: 'Viewer',
              },
            },
          });

          subject.next({
            data: {
              newsFeed: {
                edges: [],
              },
            },
            label:
              'RelayModernEnvironmentNoInlineTestDeferredStreamParent$defer$FeedFragment',
            path: ['viewer'],
          });

          subject.next({
            data: {
              node: {
                __typename: 'Story',
                feedback: {
                  author: {
                    __typename: 'User',
                    id: 'actor-1',
                    name: 'Alice',
                  },
                  id: 'feedback-1',
                },
                id: '1',
              },
            },
            label:
              'RelayModernEnvironmentNoInlineTestDeferredStream_newsFeed$stream$newsFeed',
            path: ['viewer', 'newsFeed', 'edges', 0],
          });

          expect(
            (callbacks.error as $FlowFixMe).mock.calls.map(
              call => call[0].stack,
            ),
          ).toEqual([]);
          expect(callbacks.next).toBeCalledTimes(3);
          expect(callbacks.complete).toBeCalledTimes(0);
          subject.complete();
          expect(callbacks.complete).toBeCalledTimes(1);

          const queryData = environment.lookup(operation.fragment);
          expect(queryData.data).toEqual({
            viewer: {
              __fragmentOwner: operation.request,
              __fragments: {
                [NoInlineFragmentWithDeferredStreamParent.name]: {
                  cond: false,
                  enableStream: true,
                },
              },
              __id: 'client:root:viewer',
            },
          });

          const parentSelector = nullthrows(
            getSingularSelector(
              NoInlineFragmentWithDeferredStreamParent,
              (queryData.data as $FlowFixMe).viewer,
            ),
          );
          const parentSelectorData = environment.lookup(parentSelector);
          const selector = nullthrows(
            getSingularSelector(
              NoInlineFragmentWithDeferredStream,
              parentSelectorData.data as $FlowFixMe,
            ),
          );
          const selectorData = environment.lookup(selector);
          // `feedback` should not be normalized because $cond is false
          expect(selectorData.data).toEqual({
            newsFeed: {edges: [{node: {}}]},
          });

          // available before a GC
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // available after GC if the query is retained
          const retain = environment.retain(operation);
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // missing after being freed plus a GC run
          retain.dispose();
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            status: 'missing',
          });

          // normalize `feedback` and disable stream
          operation = createOperationDescriptor(QueryWithDeferredStream, {
            cond: true,
            enableStream: false,
          });
          environment.execute({operation}).subscribe(callbacks);
          subject.next({
            data: {
              viewer: {
                __typename: 'Viewer',
              },
            },
          });
          subject.next({
            data: {
              newsFeed: {
                edges: [
                  {
                    node: {
                      __typename: 'Story',
                      feedback: {
                        author: {
                          __typename: 'User',
                          id: 'actor-1',
                          name: 'Alice',
                        },
                        id: 'feedback-1',
                      },
                      id: '1',
                    },
                  },
                ],
              },
            },
            label:
              'RelayModernEnvironmentNoInlineTestDeferredStreamParent$defer$FeedFragment',
            path: ['viewer'],
          });
          // The following data should not be normalized because stream is disabled
          subject.next({
            data: {
              node: {
                __typename: 'Story',
                feedback: {
                  author: {
                    __typename: 'User',
                    id: 'actor-2',
                    name: 'Bob',
                  },
                  id: 'feedback-2',
                },
                id: '2',
              },
            },
            label:
              'RelayModernEnvironmentNoInlineTestDeferredStream_newsFeed$stream$newsFeed',
            path: ['viewer', 'newsFeed', 'edges', 1],
          });
          const queryData2 = environment.lookup(operation.fragment);
          const parentSelector2 = nullthrows(
            getSingularSelector(
              NoInlineFragmentWithDeferredStreamParent,
              (queryData2.data as $FlowFixMe).viewer,
            ),
          );
          const parentSelectorData2 = environment.lookup(parentSelector2);
          const selector2 = nullthrows(
            getSingularSelector(
              NoInlineFragmentWithDeferredStream,
              parentSelectorData2.data as $FlowFixMe,
            ),
          );
          const selectorData2 = environment.lookup(selector2);
          expect(selectorData2.data).toEqual({
            newsFeed: {
              edges: [{node: {feedback: {author: {name: 'Alice'}}}}],
            },
          });
        });
      });

      describe('with @module', () => {
        let resolveFragment;
        let operationLoader;
        let fragmentToReturn;

        const QueryWithModule = graphql`
          query RelayModernEnvironmentNoInlineTestModuleQuery($cond: Boolean!) {
            node(id: "1") {
              ... on User {
                nameRenderer {
                  ...RelayModernEnvironmentNoInlineTestModuleMarkdownUserNameRenderer_name
                    @module(name: "MarkdownUserNameRenderer.react")
                    @arguments(cond: $cond)
                }
              }
            }
          }
        `;
        const NoInlineFragmentMarkdownUserNameRenderer = graphql`
          fragment RelayModernEnvironmentNoInlineTestModuleMarkdownUserNameRenderer_name on MarkdownUserNameRenderer
          @argumentDefinitions(cond: {type: "Boolean!"}) {
            markdown @skip(if: $cond)
            data @include(if: $cond) {
              markup
            }
          }
        `;
        const markdownRendererNormalizationFragment = require('./__generated__/RelayModernEnvironmentNoInlineTestModuleMarkdownUserNameRenderer_name$normalization.graphql');

        beforeEach(() => {
          fragmentToReturn = null;
          operationLoader = {
            get: jest.fn(() => fragmentToReturn),
            load: jest.fn((moduleName: unknown) => {
              return new Promise(resolve => {
                resolveFragment = resolve;
              });
            }),
          };
          store = new RelayModernStore(source, {
            gcReleaseBufferSize: 0,
            // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
            // $FlowFixMe[incompatible-type] error found when enabling Flow LTI mode
            operationLoader,
          });
          environment = new RelayModernEnvironment({
            // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
            network: RelayNetwork.create(fetch),
            // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
            // $FlowFixMe[incompatible-type] error found when enabling Flow LTI mode
            operationLoader,
            store,
          });
        });

        it('executes and reads back results for the MarkdownUserNameRenderer', () => {
          operation = createOperationDescriptor(QueryWithModule, {
            cond: true,
          });
          environment.execute({operation}).subscribe(callbacks);

          subject.next({
            data: {
              node: {
                __typename: 'User',
                id: '1',
                nameRenderer: {
                  __module_component_RelayModernEnvironmentNoInlineTestModuleQuery:
                    'MarkdownUserNameRenderer.react',
                  __module_operation_RelayModernEnvironmentNoInlineTestModuleQuery:
                    'RelayModernEnvironmentNoInlineTestModuleMarkdownUserNameRenderer_name$normalization.graphql',
                  __typename: 'MarkdownUserNameRenderer',
                  data: {
                    id: 'data-1',
                    markup: '<markup/>',
                  },
                  markdown: 'markdown payload',
                },
              },
            },
          });
          expect(callbacks.complete).toBeCalledTimes(0);
          expect(callbacks.error).toBeCalledTimes(0);
          expect(callbacks.next).toBeCalledTimes(1);
          expect(operationLoader.load).toBeCalledTimes(1);

          const queryData = environment.lookup(operation.fragment);
          expect(queryData.data).toEqual({
            node: {
              nameRenderer: {
                __fragmentOwner: operation.request,
                __fragmentPropName: 'name',
                __fragments: {
                  [NoInlineFragmentMarkdownUserNameRenderer.name]: {
                    cond: true,
                  },
                },
                __id: 'client:1:nameRenderer',
                __module_component: 'MarkdownUserNameRenderer.react',
              },
            },
          });

          const selector = nullthrows(
            getSingularSelector(
              NoInlineFragmentMarkdownUserNameRenderer,
              (queryData.data as $FlowFixMe).node.nameRenderer,
            ),
          );
          const initialSelectorData = environment.lookup(selector);
          expect(initialSelectorData.isMissingData).toBe(true);
          expect(initialSelectorData.data).toEqual({
            markdown: undefined,
          });

          // Include `markup` and skip `markdown` becasue $cond is true
          resolveFragment(markdownRendererNormalizationFragment);
          jest.runAllTimers();
          const selectorData = environment.lookup(selector);
          expect(selectorData.data).toEqual({
            data: {
              markup: '<markup/>',
            },
          });
          expect(selectorData.isMissingData).toBe(false);

          // available before a GC
          fragmentToReturn = markdownRendererNormalizationFragment;
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // `markdown` field is not normalized
          const operationCondTrue = createOperationDescriptor(QueryWithModule, {
            cond: false,
          });
          expect(environment.check(operationCondTrue)).toEqual({
            status: 'missing',
          });

          // available after GC if the query is retained
          const retain = environment.retain(operation);
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            fetchTime: null,
            status: 'available',
          });

          // missing after being freed plus a GC run
          retain.dispose();
          (environment.getStore() as $FlowFixMe).scheduleGC();
          jest.runAllTimers();
          expect(environment.check(operation)).toEqual({
            status: 'missing',
          });
        });

        // Parity tests: behaviors that must be identical between the
        // established OperationExecutor path and the exec-time
        // NormalizationEngine path. Each test passes a fresh
        // (query, variables, loadFragment, response) tuple to the runner and
        // asserts on the uniform `ParityResult`.
        describe.each([
          ['OperationExecutor', runViaOperationExecutor],
          ['NormalizationEngine', runViaNormalizationEngine],
        ])('parity (%s)', (_runnerName, runner) => {
          it('SplitOperation followup binds @arguments via getLocalVariables', async () => {
            const {source} = await runner({
              query: QueryWithModule,
              variables: {cond: true},
              loadFragment: () => markdownRendererNormalizationFragment,
              response: {
                data: {
                  node: {
                    __typename: 'User',
                    id: '1',
                    nameRenderer: {
                      __module_component_RelayModernEnvironmentNoInlineTestModuleQuery:
                        'MarkdownUserNameRenderer.react',
                      __module_operation_RelayModernEnvironmentNoInlineTestModuleQuery:
                        'RelayModernEnvironmentNoInlineTestModuleMarkdownUserNameRenderer_name$normalization.graphql',
                      __typename: 'MarkdownUserNameRenderer',
                      data: {id: 'data-1', markup: '<markup/>'},
                      markdown: 'markdown payload',
                    },
                  },
                },
                extensions: {is_final: true as unknown},
              },
            });
            const renderer = source.get('client:1:nameRenderer') as $FlowFixMe;
            expect(renderer).toBeDefined();
            // With cond=true: `data` is selected (@include) and `markdown` is
            // skipped (@skip). Both depend on the SplitOperation's own
            // argumentDefinitions resolving against the call-site args.
            expect(renderer.data).toBeDefined();
            expect(renderer.markdown).toBeUndefined();
          });

          it('async @module load failure surfaces (does not get swallowed)', async () => {
            // The @module fragment fails to load (e.g., network error). Both
            // paths must surface the error: the executor via
            // `subscribe({error})`, the engine via `pendingModules` rejection.
            // Without the fix, NormalizationEngine wrapped its load chain in
            // `.catch(() => emptyResult)`, silently dropping the error.
            const loadError = new Error('forced @module load failure');
            const {errors} = await runner({
              query: QueryWithModule,
              variables: {cond: true},
              loadFragment: () => null, // not used when loadFragmentAsync is set
              loadFragmentAsync: () => Promise.reject(loadError),
              response: {
                data: {
                  node: {
                    __typename: 'User',
                    id: '1',
                    nameRenderer: {
                      __module_component_RelayModernEnvironmentNoInlineTestModuleQuery:
                        'MarkdownUserNameRenderer.react',
                      __module_operation_RelayModernEnvironmentNoInlineTestModuleQuery:
                        'RelayModernEnvironmentNoInlineTestModuleMarkdownUserNameRenderer_name$normalization.graphql',
                      __typename: 'MarkdownUserNameRenderer',
                      data: {id: 'data-1', markup: '<markup/>'},
                      markdown: 'markdown payload',
                    },
                  },
                },
                extensions: {is_final: true as unknown},
              },
            });
            expect(errors).toContain(loadError);
          });
        });
      });
    });
  },
);
