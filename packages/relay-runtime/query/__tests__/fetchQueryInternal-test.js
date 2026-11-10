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
  GraphQLSingularResponse,
} from '../../network/RelayNetworkTypes';
import type {Sink, Subscription} from '../../network/RelayObservable';
import type {Observer} from '../../network/RelayObservable';
import type {NormalizationSplitOperation} from '../../util/NormalizationNode';
import type {
  fetchQueryInternalTest1Query$data,
  fetchQueryInternalTest1Query$variables,
} from './__generated__/fetchQueryInternalTest1Query.graphql';
import type {
  fetchQueryInternalTest2Query$data,
  fetchQueryInternalTest2Query$variables,
} from './__generated__/fetchQueryInternalTest2Query.graphql';
import type {
  fetchQueryInternalTest3Query$data,
  fetchQueryInternalTest3Query$variables,
} from './__generated__/fetchQueryInternalTest3Query.graphql';
import type {Query} from 'relay-runtime/util/RelayRuntimeTypes';

const {
  fetchQuery,
  fetchQueryDeduped,
  getObservableForActiveRequest,
  getObservableForRequestCompletion,
  getPromiseForActiveRequest,
} = require('../fetchQueryInternal');
const {createOperationDescriptor, graphql} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');
const {
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();

let response: GraphQLSingularResponse;
let gqlQuery:
  | Query<
      fetchQueryInternalTest1Query$variables,
      fetchQueryInternalTest1Query$data,
    >
  | Query<
      fetchQueryInternalTest2Query$variables,
      fetchQueryInternalTest2Query$data,
    >
  | Query<
      fetchQueryInternalTest3Query$variables,
      fetchQueryInternalTest3Query$data,
    >;
let query;
let environment;

beforeEach(() => {
  environment = createMockEnvironment();
  gqlQuery = graphql`
    query fetchQueryInternalTest1Query($id: ID!) {
      node(id: $id) {
        id
      }
    }
  `;
  query = createOperationDescriptor(gqlQuery, {id: '4'});
  response = {
    data: {
      node: {
        __typename: 'User',
        id: '4',
      },
    },
    extensions: {is_final: true},
  };
});

describe('fetchQuery', () => {
  it('fetches a query', () => {
    let calledObserver = false;
    const observer = {
      complete: () => {
        calledObserver = true;
      },
    };
    const subscription = fetchQuery(environment, query).subscribe(observer);
    environment.mock.nextValue(gqlQuery, response);
    environment.mock.complete(gqlQuery);
    subscription.unsubscribe();
    expect(calledObserver).toEqual(true);
  });

  it('provides data snapshot on `next(...)`', () => {
    let calledNext = false;
    const values = [];
    const observer = {
      next: (value: GraphQLResponse) => {
        calledNext = true;
        values.push(value);
      },
    };
    fetchQuery(environment, query).subscribe(observer);
    environment.mock.nextValue(gqlQuery, response);
    expect(calledNext).toEqual(true);
    expect(values).toEqual([response]);
    environment.mock.complete(gqlQuery);
  });

  it('unsubscribes when the request is disposed', () => {
    let calledNext = false;
    let calledUnsubscribe = false;
    const observer = {
      next: () => {
        calledNext = true;
      },
      unsubscribe: () => {
        calledUnsubscribe = true;
      },
    };
    const subscription = fetchQuery(environment, query).subscribe(observer);
    environment.mock.nextValue(gqlQuery, response);
    subscription.unsubscribe();
    expect(calledNext).toEqual(true);
    expect(calledUnsubscribe).toEqual(true);
  });

  it('handles error correctly', () => {
    let calledError = false;
    let errorMessage = null;
    const observer = {
      error: (error: Error) => {
        calledError = true;
        errorMessage = error.message;
      },
    };
    const subscription = fetchQuery(environment, query).subscribe(observer);
    environment.mock.reject(gqlQuery, new Error('Oops'));
    expect(calledError).toEqual(true);
    expect(errorMessage).toEqual('Oops');
    subscription.unsubscribe();
  });

  it('can dispose same request multiple times without error', () => {
    let calledObserver = false;
    const observer = {
      complete: () => {
        calledObserver = true;
      },
    };
    const subscription = fetchQuery(environment, query).subscribe(observer);
    expect(
      environment.mock.isLoading(gqlQuery, query.request.variables),
    ).toEqual(true);

    environment.mock.nextValue(gqlQuery, response);
    environment.mock.complete(gqlQuery);
    subscription.unsubscribe();
    subscription.unsubscribe();
    expect(calledObserver).toEqual(true);
    expect(
      environment.mock.isLoading(gqlQuery, query.request.variables),
    ).toEqual(false);
  });

  it('unsubscribes from request until the last observer is disposed', () => {
    let unsubscribedObserver1 = false;
    let unsubscribedObserver2 = false;
    const observer1 = {
      unsubscribe: () => {
        unsubscribedObserver1 = true;
      },
    };
    const observer2 = {
      unsubscribe: () => {
        unsubscribedObserver2 = true;
      },
    };
    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    expect(environment.execute).toHaveBeenCalledTimes(0);

    const subscription1 = fetchQuery(environment, query).subscribe(observer1);
    const subscription2 = fetchQuery(environment, query).subscribe(observer2);

    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    expect(environment.execute).toHaveBeenCalledTimes(1);

    environment.mock.nextValue(gqlQuery, response);
    expect(unsubscribedObserver1).toEqual(false);
    expect(unsubscribedObserver2).toEqual(false);
    expect(
      environment.mock.isLoading(gqlQuery, query.request.variables),
    ).toEqual(true);

    // Disposing same request twice has no effect
    subscription1.unsubscribe();
    subscription1.unsubscribe();

    expect(unsubscribedObserver1).toEqual(true);
    expect(unsubscribedObserver2).toEqual(false);
    expect(
      environment.mock.isLoading(gqlQuery, query.request.variables),
    ).toEqual(true);

    subscription2.unsubscribe();

    expect(unsubscribedObserver1).toEqual(true);
    expect(unsubscribedObserver2).toEqual(true);
    expect(
      environment.mock.isLoading(gqlQuery, query.request.variables),
    ).toEqual(false);

    // $FlowFixMe[method-unbinding] added when improving typing for this parameters
    expect(environment.execute).toHaveBeenCalledTimes(1);
  });

  describe('.toPromise()', () => {
    it('fetches request and does not retain query data', async () => {
      const promise = fetchQuery(environment, query).toPromise();
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(true);
      environment.mock.nextValue(gqlQuery, response);
      const result = await promise;
      expect(result).toEqual(response);
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(true);
      environment.mock.complete(gqlQuery);
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(false);
    });

    it('rejects when error occurs', async () => {
      const promise = fetchQuery(environment, query).toPromise();
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(true);
      environment.mock.reject(gqlQuery, new Error('Oops'));
      try {
        await promise;
      } catch (error) {
        expect(error.message).toEqual('Oops');
      }
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(false);
    });
  });

  describe('when making a request that is already in flight', () => {
    it('does not de-dupe requests if using different environments', () => {
      const environment2 = createMockEnvironment();
      let calledObserver1 = false;
      let calledObserver2 = false;
      const observer1 = {
        complete: () => {
          calledObserver1 = true;
        },
      };
      const observer2 = {
        complete: () => {
          calledObserver2 = true;
        },
      };
      const subscription1 = fetchQuery(environment, query).subscribe(observer1);
      const subscription2 = fetchQuery(environment2, query).subscribe(
        observer2,
      );
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(true);
      expect(
        environment2.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(true);

      environment.mock.nextValue(gqlQuery, response);
      environment2.mock.nextValue(gqlQuery, response);
      environment.mock.complete(gqlQuery);
      environment2.mock.complete(gqlQuery);
      expect(calledObserver1).toEqual(true);
      expect(calledObserver2).toEqual(true);
      subscription1.unsubscribe();
      subscription2.unsubscribe();
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(false);
      expect(
        environment2.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(false);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.execute).toHaveBeenCalledTimes(1);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment2.execute).toHaveBeenCalledTimes(1);
    });

    it('de-dupes request and notifies all observers', () => {
      let calledObserver1 = false;
      let calledObserver2 = false;
      const observer1 = {
        complete: () => {
          calledObserver1 = true;
        },
      };
      const observer2 = {
        complete: () => {
          calledObserver2 = true;
        },
      };
      const subscription1 = fetchQuery(environment, query).subscribe(observer1);
      const subscription2 = fetchQuery(environment, query).subscribe(observer2);
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(true);

      environment.mock.nextValue(gqlQuery, response);
      environment.mock.complete(gqlQuery);
      subscription1.unsubscribe();
      subscription2.unsubscribe();
      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(false);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.execute).toHaveBeenCalledTimes(1);
      expect(calledObserver1).toEqual(true);
      expect(calledObserver2).toEqual(true);
    });

    it('de-dupes request and notifies observers of events that were missed', () => {
      let observer1Payload = null;
      let calledObserver1Complete = false;
      let observer2Payload = null;
      let calledObserver2Complete = false;
      const observer1 = {
        complete: () => {
          calledObserver1Complete = true;
        },
        next: (data: GraphQLResponse) => {
          observer1Payload = data;
        },
      };
      const observer2 = {
        complete: () => {
          calledObserver2Complete = true;
        },
        next: (data: GraphQLResponse) => {
          observer2Payload = data;
        },
      };
      const subscription1 = fetchQuery(environment, query).subscribe(observer1);
      // Emit a payload before second observer subscribes
      environment.mock.nextValue(gqlQuery, response);

      const subscription2 = fetchQuery(environment, query).subscribe(observer2);

      expect(
        environment.mock.isLoading(gqlQuery, query.request.variables),
      ).toEqual(true);
      environment.mock.complete(gqlQuery);
      subscription1.unsubscribe();
      subscription2.unsubscribe();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.execute).toHaveBeenCalledTimes(1);

      // Assert both observers got the payload
      expect(observer1Payload).toEqual(response);
      expect(observer2Payload).toEqual(response);
      expect(observer1Payload).toEqual(observer2Payload);

      expect(calledObserver1Complete).toEqual(true);
      expect(calledObserver2Complete).toEqual(true);
    });
  });
});

describe('isRequestActive', () => {
  it('returns false if request is not in flight', () => {
    const isActive = environment.isRequestActive(query.request.identifier);
    expect(isActive).toEqual(false);
  });

  it('returns false if request is not active', () => {
    const observer = {
      complete: jest.fn<[], unknown>(),
      error: jest.fn<[Error], unknown>(),
      next: jest.fn<[GraphQLResponse], unknown>(),
      unsubscribe: jest.fn<[Subscription], unknown>(),
    };
    fetchQuery(environment, query).subscribe(observer);
    environment.mock.nextValue(gqlQuery, response);

    const isActive = environment.isRequestActive(query.request.identifier);
    expect(isActive).toEqual(false);
  });

  it('returns true when request is active', () => {
    fetchQuery(environment, query).subscribe({});

    const isActive = environment.isRequestActive(query.request.identifier);
    expect(isActive).toEqual(true);
  });
});

describe('getPromiseForActiveRequest', () => {
  it('returns null if request is not in flight', () => {
    const promise = getPromiseForActiveRequest(environment, query.request);
    expect(promise).toEqual(null);
  });

  it('returns null if request is not active', () => {
    const observer = {
      complete: jest.fn<[], unknown>(),
      error: jest.fn<[Error], unknown>(),
      next: jest.fn<[GraphQLResponse], unknown>(),
      unsubscribe: jest.fn<[Subscription], unknown>(),
    };
    fetchQuery(environment, query).subscribe(observer);
    environment.mock.nextValue(gqlQuery, response);

    const promise = getPromiseForActiveRequest(environment, query.request);
    expect(promise).toEqual(null);
  });

  it('returns null after request has completed', () => {
    const observer = {
      complete: jest.fn<[], unknown>(),
      error: jest.fn<[Error], unknown>(),
      next: jest.fn<[GraphQLResponse], unknown>(),
      unsubscribe: jest.fn<[Subscription], unknown>(),
    };
    fetchQuery(environment, query).subscribe(observer);
    environment.mock.resolve(gqlQuery, response);

    const promise = getPromiseForActiveRequest(environment, query.request);
    expect(promise).toEqual(null);
  });

  it('returns null after request has errored', () => {
    const observer = {
      complete: jest.fn<[], unknown>(),
      error: jest.fn<[Error], unknown>(),
      next: jest.fn<[GraphQLResponse], unknown>(),
      unsubscribe: jest.fn<[Subscription], unknown>(),
    };
    fetchQuery(environment, query).subscribe(observer);
    environment.mock.reject(gqlQuery, new Error('Oops'));

    const promise = getPromiseForActiveRequest(environment, query.request);
    expect(promise).toEqual(null);
  });

  it('returns null after request has unsubscribed (canceled)', () => {
    const observer = {
      complete: jest.fn<[], unknown>(),
      error: jest.fn<[Error], unknown>(),
      next: jest.fn<[GraphQLResponse], unknown>(),
      unsubscribe: jest.fn<[Subscription], unknown>(),
    };
    const subscription = fetchQuery(environment, query).subscribe(observer);
    subscription.unsubscribe();

    const promise = getPromiseForActiveRequest(environment, query.request);
    expect(promise).toEqual(null);
  });

  describe('when request is active', () => {
    let observer;
    let subscription;
    beforeEach(() => {
      observer = {
        complete: jest.fn<[], unknown>(),
        error: jest.fn<[Error], unknown>(),
        next: jest.fn<[GraphQLResponse], unknown>(),
        unsubscribe: jest.fn<[Subscription], unknown>(),
      };
      subscription = fetchQuery(environment, query).subscribe(observer);
    });
    it('returns a promise that rejects when error occurs', () => {
      expect.assertions(5);
      const promise = getPromiseForActiveRequest(environment, query.request);
      expect(promise).not.toEqual(null);
      if (!promise) {
        return;
      }

      // Assert that promise hasn't resolved
      const spy = jest.fn<[void] | [$FlowFixMe], unknown>();
      promise.then(spy).catch(spy);
      jest.runAllTimers();
      expect(spy).toHaveBeenCalledTimes(0);

      // Make observable call `error`
      environment.mock.reject(gqlQuery, new Error('Oops'));

      // Assert promise rejects after calling `error`
      return promise.catch(error => {
        expect(observer.next).toHaveBeenCalledTimes(0);
        expect(observer.complete).toHaveBeenCalledTimes(0);
        expect(error.message).toEqual('Oops');
      });
    });

    it('returns a promise that resolves when the request is unsubcribed (canceled)', () => {
      expect.assertions(4);
      const promise = getPromiseForActiveRequest(environment, query.request);
      expect(promise).not.toEqual(null);
      if (!promise) {
        return;
      }

      // Assert that promise hasn't resolved
      const spy = jest.fn<[void] | [$FlowFixMe], unknown>();
      promise.then(spy).catch(spy);
      jest.runAllTimers();
      expect(spy).toHaveBeenCalledTimes(0);

      // Cancel the request
      subscription.unsubscribe();

      // Assert promise resolves after the request is cancelled
      return promise.then(() => {
        expect(observer.next).toHaveBeenCalledTimes(0);
        expect(observer.unsubscribe).toHaveBeenCalledTimes(1);
      });
    });

    it('calling getPromiseForActiveRequest does not prevent the request from being unsubscribed (canceled)', () => {
      expect.assertions(6);
      const promise = getPromiseForActiveRequest(environment, query.request);
      expect(promise).not.toEqual(null);
      if (!promise) {
        return;
      }

      // Assert that promise hasn't resolved
      const spy = jest.fn<[void] | [$FlowFixMe], unknown>();
      promise.then(spy).catch(spy);
      jest.runAllTimers();
      expect(spy).toHaveBeenCalledTimes(0);

      // Cancel the request
      subscription.unsubscribe();

      // Assert that unsubscribe is called and that the
      // request is actually cancelled at the network level
      expect(observer.unsubscribe).toBeCalledTimes(1);
      expect(
        environment.mock.isLoading(query, query.request.variables),
      ).toEqual(false);

      // Assert promise resolves after the request is cancelled
      return promise.then(() => {
        expect(observer.next).toHaveBeenCalledTimes(0);
        expect(observer.unsubscribe).toHaveBeenCalledTimes(1);
      });
    });

    describe("when `next` hasn't been called", () => {
      it('returns a promise that resolves when the next call to `next` occurs', () => {
        expect.assertions(4);
        const promise = getPromiseForActiveRequest(environment, query.request);
        expect(promise).not.toEqual(null);
        if (!promise) {
          return;
        }

        // Assert that promise hasn't resolved
        const spy = jest.fn<[void] | [$FlowFixMe], unknown>();
        promise.then(spy).catch(spy);
        jest.runAllTimers();
        expect(spy).toHaveBeenCalledTimes(0);

        // Make observable call `next`
        environment.mock.nextValue(gqlQuery, response);

        // Assert promise resolves after calling `next`
        return promise.then(() => {
          expect(observer.next).toHaveBeenCalledTimes(1);
          expect(observer.complete).toHaveBeenCalledTimes(0);
        });
      });

      it('returns a promise that resolves when the request completes', () => {
        expect.assertions(4);
        const promise = getPromiseForActiveRequest(environment, query.request);
        expect(promise).not.toEqual(null);
        if (!promise) {
          return;
        }

        // Assert that promise hasn't resolved
        const spy = jest.fn<[void] | [$FlowFixMe], unknown>();
        promise.then(spy).catch(spy);
        jest.runAllTimers();
        expect(spy).toHaveBeenCalledTimes(0);

        // Make observable call `complete`
        environment.mock.complete(gqlQuery);

        // Assert promise resolves after calling `complete`
        return promise.then(() => {
          expect(observer.next).toHaveBeenCalledTimes(0);
          expect(observer.complete).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('when next has already been called and request is still active', () => {
      beforeEach(() => {
        response = {
          ...response,
          extensions: {is_final: false},
        };
        environment.mock.nextValue(gqlQuery, response);
        expect(observer.next).toHaveBeenCalledTimes(1);
      });

      it('returns a promise that resolves when the next call to `next` occurs', () => {
        expect.assertions(5);
        const promise = getPromiseForActiveRequest(environment, query.request);
        expect(promise).not.toEqual(null);
        if (!promise) {
          return;
        }

        // Assert that promise hasn't resolved even if first call to
        // `next` has already occurred
        const spy = jest.fn<[void] | [$FlowFixMe], unknown>();
        promise.then(spy).catch(spy);
        jest.runAllTimers();
        expect(spy).toHaveBeenCalledTimes(0);

        // Make observable call `next`
        environment.mock.nextValue(gqlQuery, response);

        // Assert promise resolves after calling `next`
        return promise.then(() => {
          expect(observer.next).toHaveBeenCalledTimes(2);
          expect(observer.complete).toHaveBeenCalledTimes(0);
        });
      });

      it('returns a promise that resolves when the next call to `next` occurs when next has been called more than once', () => {
        expect.assertions(6);

        // Call next a second time
        environment.mock.nextValue(gqlQuery, response);
        expect(observer.next).toHaveBeenCalledTimes(2);

        const promise = getPromiseForActiveRequest(environment, query.request);
        expect(promise).not.toEqual(null);
        if (!promise) {
          return;
        }

        // Assert that promise hasn't resolved even if first call to
        // `next` has already occurred
        const spy = jest.fn<[void] | [$FlowFixMe], unknown>();
        promise.then(spy).catch(spy);
        jest.runAllTimers();
        expect(spy).toHaveBeenCalledTimes(0);

        // Make observable call `next`
        environment.mock.nextValue(gqlQuery, response);

        // Assert promise resolves after calling `next`
        return promise.then(() => {
          expect(observer.next).toHaveBeenCalledTimes(3);
          expect(observer.complete).toHaveBeenCalledTimes(0);
        });
      });

      it('returns a promise that resolves when the request completes', () => {
        expect.assertions(5);
        const promise = getPromiseForActiveRequest(environment, query.request);
        expect(promise).not.toEqual(null);
        if (!promise) {
          return;
        }

        // Assert that promise hasn't resolved even if first call to
        // `next` has already occurred
        const spy = jest.fn<[void] | [$FlowFixMe], unknown>();
        promise.then(spy).catch(spy);
        jest.runAllTimers();
        expect(spy).toHaveBeenCalledTimes(0);

        // Make observable call `complete`
        environment.mock.complete(gqlQuery);

        // Assert promise resolves after calling `complete`
        return promise.then(() => {
          expect(observer.next).toHaveBeenCalledTimes(1);
          expect(observer.complete).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('when loading @module', () => {
    let observer;
    let operationLoader;
    let resolveModule;
    let markdownRendererNormalizationFragment;

    beforeEach(() => {
      observer = {
        complete: jest.fn<[], unknown>(),
        error: jest.fn<[Error], unknown>(),
        next: jest.fn<[GraphQLResponse], unknown>(),
        unsubscribe: jest.fn<[Subscription], unknown>(),
      };
      operationLoader = {
        get: jest.fn<[unknown], NormalizationSplitOperation>(),
        load: jest.fn((moduleName: unknown) => {
          return new Promise(resolve => {
            resolveModule = resolve;
          });
        }),
      };
      // $FlowFixMe[incompatible-type] error found when enabling Flow LTI mode
      environment = createMockEnvironment({operationLoader});
      gqlQuery = graphql`
        query fetchQueryInternalTest2Query($id: ID!) {
          node(id: $id) {
            ... on User {
              nameRenderer {
                # intentionally does not use @match
                ...fetchQueryInternalTestPlainFragment_name
                  @module(name: "PlainUserNameRenderer.react")
                ...fetchQueryInternalTestMarkdownFragment_name
                  @module(name: "MarkdownUserNameRenderer.react")
              }
            }
          }
        }
      `;
      graphql`
        fragment fetchQueryInternalTestPlainFragment_name on PlainUserNameRenderer {
          plaintext
          data {
            text
          }
        }
      `;
      graphql`
        fragment fetchQueryInternalTestMarkdownFragment_name on MarkdownUserNameRenderer {
          __typename
          markdown
          data {
            markup
          }
        }
      `;
      markdownRendererNormalizationFragment = require('./__generated__/fetchQueryInternalTestMarkdownFragment_name$normalization.graphql');
      query = createOperationDescriptor(gqlQuery, {id: '4'});

      fetchQuery(environment, query).subscribe(observer);
    });

    it('returns null if module loads before final payload', () => {
      expect.assertions(5);
      const promise = getPromiseForActiveRequest(environment, query.request);
      expect(promise).not.toEqual(null);
      if (!promise) {
        return;
      }

      operationLoader.get.mockImplementationOnce(
        () => markdownRendererNormalizationFragment,
      );

      expect(
        getPromiseForActiveRequest(environment, query.request),
      ).not.toEqual(null);

      environment.mock.resolve(gqlQuery, {
        data: {
          node: {
            __typename: 'User',
            id: '1',
            nameRenderer: {
              __module_component_fetchQueryInternalTest2Query:
                'MarkdownUserNameRenderer.react',
              __module_operation_fetchQueryInternalTest2Query:
                'fetchQueryInternalTestMarkdownFragment_name$normalization.graphql',
              __typename: 'MarkdownUserNameRenderer',
              data: {
                markup: '<markup/>',
              },
              markdown: 'markdown payload',
            },
          },
        },
        extensions: {is_final: true},
      });

      expect(getPromiseForActiveRequest(environment, query.request)).toEqual(
        null,
      );

      return promise.then(() => {
        expect(observer.next).toHaveBeenCalledTimes(1);
        expect(observer.complete).toHaveBeenCalledTimes(1);
      });
    });

    it('returns promise if module still loading after final payload', async () => {
      expect.assertions(8);
      const initialPromise = getPromiseForActiveRequest(
        environment,
        query.request,
      );
      expect(initialPromise).not.toEqual(null);
      if (!initialPromise) {
        return;
      }

      environment.mock.nextValue(gqlQuery, {
        data: {
          node: {
            __typename: 'User',
            id: '1',
            nameRenderer: {
              __module_component_fetchQueryInternalTest2Query:
                'MarkdownUserNameRenderer.react',
              __module_operation_fetchQueryInternalTest2Query:
                'fetchQueryInternalTestMarkdownFragment_name$normalization.graphql',
              __typename: 'MarkdownUserNameRenderer',
              data: {
                markup: '<markup/>',
              },
              markdown: 'markdown payload',
            },
          },
        },
        extensions: {is_final: true},
      });

      const intermediatePromise = getPromiseForActiveRequest(
        environment,
        query.request,
      );
      expect(intermediatePromise).not.toEqual(null);
      if (!intermediatePromise) {
        return;
      }

      // Complete network request, still waiting on module
      environment.mock.complete(gqlQuery);

      const promiseForModule = getPromiseForActiveRequest(
        environment,
        query.request,
      );
      expect(promiseForModule).not.toEqual(null);
      if (!promiseForModule) {
        return;
      }

      resolveModule(markdownRendererNormalizationFragment);
      jest.runAllTimers();

      expect(getPromiseForActiveRequest(environment, query.request)).toEqual(
        null,
      );

      await initialPromise.then(() => {
        expect(observer.next).toHaveBeenCalledTimes(1);
        expect(observer.complete).toHaveBeenCalledTimes(1);
      });

      let intermediateResolved = false;
      await intermediatePromise.then(() => {
        intermediateResolved = true;
      });
      expect(intermediateResolved).toEqual(true);

      let moduleResolved = false;
      await promiseForModule.then(() => {
        moduleResolved = true;
      });
      expect(moduleResolved).toEqual(true);
    });
  });
});

describe('getObservableForActiveRequest', () => {
  let observer: Observer<void>;
  let events;
  beforeEach(() => {
    events = [] as Array<$FlowFixMe | Error | string>;
    observer = {
      complete: jest.fn(() => events.push('complete')),
      error: jest.fn(error => events.push('error', error)),
      next: jest.fn(() => events.push('next')),
    };
  });

  it('returns null if request is not in flight', () => {
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).toEqual(null);
  });

  it('returns null if request is not active', () => {
    fetchQuery(environment, query).subscribe({});
    environment.mock.nextValue(gqlQuery, response);

    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).toEqual(null);
  });

  it('returns null if the request has already errored', () => {
    fetchQuery(environment, query).subscribe({error: jest.fn()});
    const error = new Error('Oops');
    environment.mock.reject(gqlQuery, error);
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).toBe(null);
  });

  it('errors asynchronously if the request errors', () => {
    fetchQuery(environment, query).subscribe({error: jest.fn()});
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).not.toEqual(null);
    if (!observable) {
      return;
    }

    observable.subscribe(observer);
    expect(events).toEqual([]);

    const error = new Error('Oops');
    environment.mock.reject(gqlQuery, error);
    expect(events).toEqual(['error', error]);
  });

  it('returns null if the request has already completed', () => {
    fetchQuery(environment, query).subscribe({});
    environment.mock.complete(gqlQuery);
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).toBe(null);
  });

  it('completes asynchronously if the request completes', () => {
    fetchQuery(environment, query).subscribe({});
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).not.toEqual(null);
    if (!observable) {
      return;
    }

    observable.subscribe(observer);
    expect(events).toEqual([]);

    environment.mock.complete(gqlQuery);
    expect(events).toEqual(['complete']);
  });

  it('completes when subscribed after the request was unsubscribed (canceled)', () => {
    const subscription = fetchQuery(environment, query).subscribe({});
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).not.toEqual(null);
    if (!observable) {
      return;
    }

    subscription.unsubscribe();
    observable.subscribe(observer);
    expect(events).toEqual(['complete']);
  });

  it('completes when subscribed after the request was canceled and re-issued', () => {
    const subscription = fetchQuery(environment, query).subscribe({});
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).not.toEqual(null);
    if (!observable) {
      return;
    }

    subscription.unsubscribe();
    fetchQuery(environment, query).subscribe({});
    observable.subscribe(observer);
    expect(events).toEqual(['complete']);
  });

  it('errors when subscribed after the request errored', () => {
    fetchQuery(environment, query).subscribe({error: jest.fn()});
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).not.toEqual(null);
    if (!observable) {
      return;
    }

    const error = new Error('Oops');
    environment.mock.reject(gqlQuery, error);
    observable.subscribe(observer);
    expect(events).toEqual(['error', error]);
  });

  it('calls next asynchronously with subsequent non-final payloads', () => {
    fetchQuery(environment, query).subscribe({});
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).not.toEqual(null);
    if (!observable) {
      return;
    }

    response = {
      ...response,
      extensions: {is_final: false},
    };

    observable.subscribe(observer);
    expect(events).toEqual([]);

    environment.mock.nextValue(gqlQuery, response);
    expect(events).toEqual(['next']);
  });

  it('calls complete asynchronously with subsequent final payload', () => {
    fetchQuery(environment, query).subscribe({});
    const observable = getObservableForActiveRequest(
      environment,
      query.request,
    );
    expect(observable).not.toEqual(null);
    if (!observable) {
      return;
    }

    observable.subscribe(observer);
    expect(events).toEqual([]);

    environment.mock.nextValue(gqlQuery, response);
    expect(events).toEqual(['complete']);
  });

  describe('when loading @module', () => {
    let operationLoader;
    let resolveModule;
    let markdownRendererNormalizationFragment;

    beforeEach(() => {
      operationLoader = {
        get: jest.fn<[unknown], NormalizationSplitOperation>(),
        load: jest.fn((moduleName: unknown) => {
          return new Promise(resolve => {
            resolveModule = resolve;
          });
        }),
      };
      // $FlowFixMe[incompatible-type] error found when enabling Flow LTI mode
      environment = createMockEnvironment({operationLoader});
      gqlQuery = graphql`
        query fetchQueryInternalTest3Query($id: ID!) {
          node(id: $id) {
            ... on User {
              nameRenderer {
                # intentionally does not use @match
                ...fetchQueryInternalTestPlain1Fragment_name
                  @module(name: "PlainUserNameRenderer.react")
                ...fetchQueryInternalTestMarkdown1Fragment_name
                  @module(name: "MarkdownUserNameRenderer.react")
              }
            }
          }
        }
      `;

      graphql`
        fragment fetchQueryInternalTestPlain1Fragment_name on PlainUserNameRenderer {
          plaintext
          data {
            text
          }
        }
      `;
      graphql`
        fragment fetchQueryInternalTestMarkdown1Fragment_name on MarkdownUserNameRenderer {
          __typename
          markdown
          data {
            markup
          }
        }
      `;
      markdownRendererNormalizationFragment = require('./__generated__/fetchQueryInternalTestMarkdown1Fragment_name$normalization.graphql');
      query = createOperationDescriptor(gqlQuery, {id: '4'});

      fetchQuery(environment, query).subscribe({});
    });

    it('returns null if module loads before final payload', () => {
      const observable = getObservableForActiveRequest(
        environment,
        query.request,
      );
      expect(observable).not.toEqual(null);
      if (!observable) {
        return;
      }
      observable.subscribe(observer);
      expect(events).toEqual([]);

      operationLoader.get.mockImplementationOnce(
        () => markdownRendererNormalizationFragment,
      );

      expect(
        getObservableForActiveRequest(environment, query.request),
      ).not.toEqual(null);

      environment.mock.resolve(gqlQuery, {
        data: {
          node: {
            __typename: 'User',
            id: '1',
            nameRenderer: {
              __module_component_fetchQueryInternalTest3Query:
                'MarkdownUserNameRenderer.react',
              __module_operation_fetchQueryInternalTest3Query:
                'fetchQueryInternalTestMarkdown1Fragment_name$normalization.graphql',
              __typename: 'MarkdownUserNameRenderer',
              data: {
                markup: '<markup/>',
              },
              markdown: 'markdown payload',
            },
          },
        },
        extensions: {is_final: true},
      });

      expect(getObservableForActiveRequest(environment, query.request)).toEqual(
        null,
      );

      expect(events).toEqual(['complete']);
    });

    it('returns observable if module still loading after final payload', () => {
      const observable = getObservableForActiveRequest(
        environment,
        query.request,
      );
      expect(observable).not.toEqual(null);
      if (!observable) {
        return;
      }
      observable.subscribe(observer);
      expect(events).toEqual([]);

      environment.mock.nextValue(gqlQuery, {
        data: {
          node: {
            __typename: 'User',
            id: '1',
            nameRenderer: {
              __module_component_fetchQueryInternalTest3Query:
                'MarkdownUserNameRenderer.react',
              __module_operation_fetchQueryInternalTest3Query:
                'fetchQueryInternalTestMarkdown1Fragment_name$normalization.graphql',
              __typename: 'MarkdownUserNameRenderer',
              data: {
                markup: '<markup/>',
              },
              markdown: 'markdown payload',
            },
          },
        },
        extensions: {is_final: true},
      });

      expect(events).toEqual(['next']);
      expect(
        getObservableForActiveRequest(environment, query.request),
      ).not.toEqual(null);

      environment.mock.complete(gqlQuery);
      expect(events).toEqual(['next']);

      resolveModule(markdownRendererNormalizationFragment);
      jest.runAllTimers();

      expect(events).toEqual(['next', 'complete']);
      expect(getObservableForActiveRequest(environment, query.request)).toEqual(
        null,
      );
    });
  });
});

describe('getObservableForRequestCompletion', () => {
  it('does not start work or allocate a request for an absent identifier', () => {
    expect(
      getObservableForRequestCompletion(environment, query.request.identifier),
    ).toBeNull();
    expect(environment.execute).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'ignores final/partial NEXT and observes transport completion (late subscribe: %s)',
    late => {
      fetchQuery(environment, query).subscribe({});
      const identifier = query.request.identifier;
      const events = [];
      const observe = () => {
        getObservableForRequestCompletion(environment, identifier)?.subscribe({
          complete: () => events.push('complete'),
          error: () => events.push('error'),
          next: () => events.push('next'),
        });
      };
      if (!late) {
        observe();
      }
      environment.mock.nextValue(gqlQuery, {
        ...response,
        extensions: {is_final: false},
      });
      expect(events).toEqual([]);
      environment.mock.nextValue(gqlQuery, response);
      expect(environment.isRequestActive(identifier)).toBe(false);
      if (late) {
        observe();
      }
      expect(events).toEqual([]);
      environment.mock.complete(gqlQuery);
      expect(events).toEqual(['complete']);
      expect(
        getObservableForRequestCompletion(environment, identifier),
      ).toBeNull();
    },
  );

  it.each(['complete', 'error', 'cancel'])(
    'replays %s between lookup and subscription',
    terminal => {
      const owner = fetchQuery(environment, query).subscribe({});
      const completion = getObservableForRequestCompletion(
        environment,
        query.request.identifier,
      );
      if (terminal === 'complete') {
        environment.mock.resolve(gqlQuery, response);
      } else if (terminal === 'error') {
        environment.mock.reject(gqlQuery, new Error('Request failed'));
      } else {
        owner.unsubscribe();
      }
      const replacement = fetchQuery(environment, query).subscribe({});
      const events = [];
      completion?.subscribe({
        complete: () => events.push('complete'),
        error: () => events.push('error'),
      });
      expect(events).toEqual([terminal === 'error' ? 'error' : 'complete']);
      expect(environment.execute).toHaveBeenCalledTimes(2);
      replacement.unsubscribe();
      expect(
        getObservableForRequestCompletion(
          environment,
          query.request.identifier,
        ),
      ).toBeNull();
    },
  );

  it('a passive observer neither keeps cancelled work alive nor cancels owned work', () => {
    const first = fetchQuery(environment, query).subscribe({});
    const second = fetchQuery(environment, query).subscribe({});
    const complete = jest.fn();
    const observer = getObservableForRequestCompletion(
      environment,
      query.request.identifier,
    )?.subscribe({complete});
    expect(environment.execute).toHaveBeenCalledTimes(1);
    first.unsubscribe();
    expect(complete).not.toHaveBeenCalled();
    expect(environment.mock.getAllOperations()).toHaveLength(1);
    observer?.unsubscribe();
    expect(environment.mock.getAllOperations()).toHaveLength(1);
    const finalComplete = jest.fn();
    getObservableForRequestCompletion(
      environment,
      query.request.identifier,
    )?.subscribe({complete: finalComplete});
    second.unsubscribe();
    expect(finalComplete).toHaveBeenCalledTimes(1);
    expect(environment.mock.getAllOperations()).toHaveLength(0);
    expect(
      getObservableForRequestCompletion(environment, query.request.identifier),
    ).toBeNull();
  });

  it('a completion promise continues after dedup cache eviction', async () => {
    fetchQuery(environment, query).subscribe({});
    const completion = getObservableForRequestCompletion(
      environment,
      query.request.identifier,
    );
    const finished = new Promise<void>(resolve =>
      completion?.subscribe({complete: resolve}),
    );
    environment.mock.resolve(gqlQuery, response);
    await finished;
    expect(
      getObservableForRequestCompletion(environment, query.request.identifier),
    ).toBeNull();
    fetchQuery(environment, query).subscribe({});
    expect(environment.execute).toHaveBeenCalledTimes(2);
    environment.mock.resolve(gqlQuery, response);
  });

  it.each(['raw', 'execution'])(
    'only %s entry exists without starting missing work',
    existing => {
      const Observable = require('../../network/RelayObservable');
      const rawID = `raw-network-request-${query.request.identifier}`;
      const identifier = existing === 'raw' ? rawID : query.request.identifier;
      const owner = fetchQueryDeduped(environment, identifier, () =>
        Observable.create(() => {}),
      ).subscribe({});
      const complete = jest.fn();
      getObservableForRequestCompletion(environment, identifier)?.subscribe({
        complete,
      });
      expect(
        getObservableForRequestCompletion(
          environment,
          existing === 'raw' ? query.request.identifier : rawID,
        ),
      ).toBeNull();
      expect(environment.execute).not.toHaveBeenCalled();
      owner.unsubscribe();
      expect(complete).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['raw first', 'execution first'])(
    'observes each dedup key independently: %s',
    ordering => {
      const Observable = require('../../network/RelayObservable');
      const rawID = `raw-network-request-${query.request.identifier}`;
      let rawSink;
      let executionSink;
      const rawCleanup = jest.fn();
      const executionCleanup = jest.fn();
      const rawFetch = jest.fn(() =>
        Observable.create((sink: Sink<GraphQLResponse>) => {
          rawSink = sink;
          return () => {
            rawCleanup();
          };
        }),
      );
      const executionFetch = jest.fn(() =>
        Observable.create((sink: Sink<GraphQLResponse>) => {
          executionSink = sink;
          return () => {
            executionCleanup();
          };
        }),
      );
      const rawOwner = fetchQueryDeduped(
        environment,
        rawID,
        rawFetch,
      ).subscribe({});
      const executionOwner = fetchQueryDeduped(
        environment,
        query.request.identifier,
        executionFetch,
      ).subscribe({});
      const events = [];
      getObservableForRequestCompletion(environment, rawID)?.subscribe({
        complete: () => events.push('raw'),
      });
      getObservableForRequestCompletion(
        environment,
        query.request.identifier,
      )?.subscribe({complete: () => events.push('execution')});
      if (ordering === 'raw first') {
        rawSink?.complete();
        expect(events).toEqual(['raw']);
        expect(
          getObservableForRequestCompletion(
            environment,
            query.request.identifier,
          ),
        ).not.toBeNull();
        executionSink?.complete();
      } else {
        executionOwner.unsubscribe();
        expect(events).toEqual(['execution']);
        expect(
          getObservableForRequestCompletion(environment, rawID),
        ).not.toBeNull();
        rawOwner.unsubscribe();
      }
      expect(events).toEqual(
        ordering === 'raw first' ? ['raw', 'execution'] : ['execution', 'raw'],
      );
      expect(rawFetch).toHaveBeenCalledTimes(1);
      expect(executionFetch).toHaveBeenCalledTimes(1);
      expect(rawCleanup).toHaveBeenCalledTimes(1);
      expect(executionCleanup).toHaveBeenCalledTimes(1);
      expect(getObservableForRequestCompletion(environment, rawID)).toBeNull();
      expect(
        getObservableForRequestCompletion(
          environment,
          query.request.identifier,
        ),
      ).toBeNull();
    },
  );
});
