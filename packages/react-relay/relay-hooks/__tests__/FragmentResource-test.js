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

import type {
  FragmentResourceTest1Fragment$data,
  FragmentResourceTest1Fragment$fragmentType,
} from './__generated__/FragmentResourceTest1Fragment.graphql';
import type {
  FragmentResourceTest1Query$data,
  FragmentResourceTest1Query$variables,
} from './__generated__/FragmentResourceTest1Query.graphql';
import type {
  FragmentResourceTest3Fragment$data,
  FragmentResourceTest3Fragment$fragmentType,
} from './__generated__/FragmentResourceTest3Fragment.graphql';
import type {
  FragmentResourceTest4Fragment$data,
  FragmentResourceTest4Fragment$fragmentType,
} from './__generated__/FragmentResourceTest4Fragment.graphql';
import type {
  FragmentResourceTest4Query$data,
  FragmentResourceTest4Query$variables,
} from './__generated__/FragmentResourceTest4Query.graphql';
import type {
  FragmentResourceTest5Fragment$data,
  FragmentResourceTest5Fragment$fragmentType,
} from './__generated__/FragmentResourceTest5Fragment.graphql';
import type {
  FragmentResourceTest5Query$data,
  FragmentResourceTest5Query$variables,
} from './__generated__/FragmentResourceTest5Query.graphql';
import type {
  FragmentResourceTest6Fragment$data,
  FragmentResourceTest6Fragment$fragmentType,
} from './__generated__/FragmentResourceTest6Fragment.graphql';
import type {
  FragmentResourceTest6Query$data,
  FragmentResourceTest6Query$variables,
} from './__generated__/FragmentResourceTest6Query.graphql';
import type {
  FragmentResourceTest7Fragment$data,
  FragmentResourceTest7Fragment$fragmentType,
} from './__generated__/FragmentResourceTest7Fragment.graphql';
import type {
  FragmentResourceTest8Fragment$data,
  FragmentResourceTest8Fragment$fragmentType,
} from './__generated__/FragmentResourceTest8Fragment.graphql';
import type {LogEvent} from 'relay-runtime';
import type {Fragment, Query} from 'relay-runtime/util/RelayRuntimeTypes';

const {
  getFragmentResourceForEnvironment,
} = require('../legacy/FragmentResource');
const {
  __internal: {fetchQuery},
  createOperationDescriptor,
  getFragment,
  graphql,
} = require('relay-runtime');
const RelayRecordSource = require('relay-runtime/store/RelayRecordSource');
const {
  injectPromisePolyfill__DEPRECATED,
} = require('relay-test-utils-internal');

injectPromisePolyfill__DEPRECATED();

describe('FragmentResource', () => {
  let environment;
  let query;
  let queryMissingData;
  let queryPlural;
  let FragmentResource;
  let createMockEnvironment;
  let UserQuery:
    | Query<
        FragmentResourceTest1Query$variables,
        FragmentResourceTest1Query$data,
      >
    | Query<
        FragmentResourceTest4Query$variables,
        FragmentResourceTest4Query$data,
      >
    | Query<
        FragmentResourceTest5Query$variables,
        FragmentResourceTest5Query$data,
      >
    | Query<
        FragmentResourceTest6Query$variables,
        FragmentResourceTest6Query$data,
      >;
  let UserFragment:
    | Fragment<
        FragmentResourceTest1Fragment$fragmentType,
        FragmentResourceTest1Fragment$data,
      >
    | Fragment<
        FragmentResourceTest4Fragment$fragmentType,
        FragmentResourceTest4Fragment$data,
      >
    | Fragment<
        FragmentResourceTest5Fragment$fragmentType,
        FragmentResourceTest5Fragment$data,
      >
    | Fragment<
        FragmentResourceTest6Fragment$fragmentType,
        FragmentResourceTest6Fragment$data,
      >;
  let UserQueryMissing;
  let UserFragmentMissing;
  let UsersQuery;
  let UsersFragment:
    | Fragment<
        FragmentResourceTest3Fragment$fragmentType,
        FragmentResourceTest3Fragment$data,
      >
    | Fragment<
        FragmentResourceTest7Fragment$fragmentType,
        FragmentResourceTest7Fragment$data,
      >
    | Fragment<
        FragmentResourceTest8Fragment$fragmentType,
        FragmentResourceTest8Fragment$data,
      >;
  const variables = {
    id: '4',
  };
  const pluralVariables = {ids: ['4']};
  const componentDisplayName = 'TestComponent';
  let logEvents: Array<LogEvent>;

  beforeEach(() => {
    ({createMockEnvironment} = require('relay-test-utils-internal'));

    logEvents = [];

    environment = createMockEnvironment({
      log(event) {
        logEvents.push(event);
      },
    });
    FragmentResource = getFragmentResourceForEnvironment(environment);

    UserFragment = graphql`
      fragment FragmentResourceTest1Fragment on User {
        id
        name
      }
    `;
    UserQuery = graphql`
      query FragmentResourceTest1Query($id: ID!) {
        node(id: $id) {
          __typename
          ...FragmentResourceTest1Fragment @dangerously_unaliased_fixme
        }
      }
    `;

    UserFragmentMissing = graphql`
      fragment FragmentResourceTest2Fragment on User {
        id
        name
        username
      }
    `;
    UserQueryMissing = graphql`
      query FragmentResourceTest2Query($id: ID!) {
        node(id: $id) {
          __typename
          ...FragmentResourceTest2Fragment @dangerously_unaliased_fixme
        }
      }
    `;

    UsersFragment = graphql`
      fragment FragmentResourceTest3Fragment on User @relay(plural: true) {
        id
        name
      }
    `;
    UsersQuery = graphql`
      query FragmentResourceTest3Query($ids: [ID!]!) {
        nodes(ids: $ids) {
          __typename
          ...FragmentResourceTest3Fragment
        }
      }
    `;

    query = createOperationDescriptor(UserQuery, variables);
    queryMissingData = createOperationDescriptor(UserQueryMissing, variables);
    queryPlural = createOperationDescriptor(UsersQuery, pluralVariables);
    environment.commitPayload(query, {
      node: {
        __typename: 'User',
        id: '4',
        name: 'Mark',
      },
    });
  });

  describe('read', () => {
    it('should read data for the fragment when all data is available', () => {
      const result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({id: '4', name: 'Mark'});
    });

    it('should read data for plural fragment when all data is available', () => {
      const result = FragmentResource.read(
        getFragment(UsersFragment),
        [
          {
            __id: '4',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
        ],
        componentDisplayName,
      );
      expect(result.data).toEqual([{id: '4', name: 'Mark'}]);
    });

    it('should return empty array for plural fragment when plural field is empty', () => {
      UsersFragment = graphql`
        fragment FragmentResourceTest7Fragment on User @relay(plural: true) {
          id
        }
      `;

      const result = FragmentResource.read(
        getFragment(UsersFragment),
        [],
        componentDisplayName,
      );
      expect(result.data).toEqual([]);
    });

    it('should return the same empty array for multiple calls for the same plural fragment when plural field is empty', () => {
      UsersFragment = graphql`
        fragment FragmentResourceTest8Fragment on User @relay(plural: true) {
          id
        }
      `;

      const firstResult = FragmentResource.read(
        getFragment(UsersFragment),
        [],
        componentDisplayName,
      );
      const secondResult = FragmentResource.read(
        getFragment(UsersFragment),
        [],
        componentDisplayName,
      );
      expect(firstResult.data).toBe(secondResult.data);
    });

    it('should correctly read fragment data when dataID changes', () => {
      let result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({id: '4', name: 'Mark'});

      environment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '5',
          name: 'User 5',
        },
      });

      result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '5',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({id: '5', name: 'User 5'});
    });

    it('should correctly read fragment data when variables used by fragment change', () => {
      UserFragment = graphql`
        fragment FragmentResourceTest4Fragment on Query {
          node(id: $id) {
            __typename
            id
            name
          }
        }
      `;
      UserQuery = graphql`
        query FragmentResourceTest4Query($id: ID!) {
          ...FragmentResourceTest4Fragment
        }
      `;

      const prevVars = {id: '4'};
      query = createOperationDescriptor(UserQuery, prevVars);
      let result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: 'client:root',
          __fragments: {
            FragmentResourceTest4Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({
        node: {__typename: 'User', id: '4', name: 'Mark'},
      });

      const nextVars = {id: '5'};
      query = createOperationDescriptor(UserQuery, nextVars);
      environment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '5',
          name: 'User 5',
        },
      });

      result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: 'client:root',
          __fragments: {
            FragmentResourceTest4Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({
        node: {__typename: 'User', id: '5', name: 'User 5'},
      });
    });

    it(
      'should correctly read fragment data when variables used by fragment ' +
        'in @argumentDefinitions change',
      () => {
        UserFragment = graphql`
          fragment FragmentResourceTest5Fragment on Query
          @argumentDefinitions(id: {type: "ID!"}) {
            node(id: $id) {
              __typename
              id
              name
            }
          }
        `;
        UserQuery = graphql`
          query FragmentResourceTest5Query($id: ID!) {
            ...FragmentResourceTest5Fragment @arguments(id: $id)
          }
        `;
        const prevVars = {id: '4'};
        query = createOperationDescriptor(UserQuery, prevVars);
        let result = FragmentResource.read(
          getFragment(UserFragment),
          {
            __id: 'client:root',
            __fragments: {
              FragmentResourceTest5Fragment: prevVars,
            },
            __fragmentOwner: query.request,
          },
          componentDisplayName,
        );
        expect(result.data).toEqual({
          node: {__typename: 'User', id: '4', name: 'Mark'},
        });

        const nextVars = {id: '5'};
        query = createOperationDescriptor(UserQuery, nextVars);
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '5',
            name: 'User 5',
          },
        });

        result = FragmentResource.read(
          getFragment(UserFragment),
          {
            __id: 'client:root',
            __fragments: {
              FragmentResourceTest5Fragment: nextVars,
            },
            __fragmentOwner: query.request,
          },
          componentDisplayName,
        );
        expect(result.data).toEqual({
          node: {__typename: 'User', id: '5', name: 'User 5'},
        });
      },
    );

    it(
      'should correctly read fragment data when fragment owner variables ' +
        'change',
      () => {
        UserFragment = graphql`
          fragment FragmentResourceTest6Fragment on User {
            id
            name
          }
        `;
        UserQuery = graphql`
          query FragmentResourceTest6Query($id: ID!, $foo: Boolean!) {
            node(id: $id) {
              __typename
              name @include(if: $foo)
              ...FragmentResourceTest6Fragment @dangerously_unaliased_fixme
            }
          }
        `;

        const variablesWithFoo = {
          id: '4',
          foo: false,
        };
        query = createOperationDescriptor(UserQuery, variablesWithFoo);

        const environmentSpy = jest.spyOn(environment, 'lookup');
        let result = FragmentResource.read(
          getFragment(UserFragment),
          {
            __id: '4',
            __fragments: {
              FragmentResourceTest6Fragment: {},
            },
            __fragmentOwner: query.request,
          },
          componentDisplayName,
        );
        expect(result.data).toEqual({id: '4', name: 'Mark'});

        const nextVars = {
          ...variablesWithFoo,
          // Change value of $foo
          foo: true,
        };
        query = createOperationDescriptor(UserQuery, nextVars);
        result = FragmentResource.read(
          getFragment(UserFragment),
          {
            __id: '4',
            __fragments: {
              FragmentResourceTest6Fragment: {},
            },
            __fragmentOwner: query.request,
          },
          componentDisplayName,
        );
        expect(result.data).toEqual({id: '4', name: 'Mark'});

        // Even if variable $foo isn't directly used by the fragment, the cache
        // key for the fragment should still change since $foo might affect
        // descendants of this fragment; if we return a cached value, the
        // fragment ref we pass to our children might be stale.
        expect(environmentSpy).toHaveBeenCalledTimes(2);
        environmentSpy.mockRestore();
      },
    );

    it('should return null data if fragment reference is not provided', () => {
      const result = FragmentResource.read(
        getFragment(UserFragment),
        null,
        componentDisplayName,
      );
      expect(result.data).toBe(null);
    });

    it('should throw and cache promise if reading missing data and network request for parent query is in flight', () => {
      fetchQuery(environment, queryMissingData).subscribe({});

      const fragmentNode = getFragment(UserFragmentMissing);
      const fragmentRef = {
        __id: '4',
        __fragments: {
          FragmentResourceTest2Fragment: {},
        },
        __fragmentOwner: queryMissingData.request,
      };

      // Try reading a fragment while parent query is in flight
      let thrown = null;
      try {
        FragmentResource.read(fragmentNode, fragmentRef, componentDisplayName);
      } catch (p) {
        expect(p).toBeInstanceOf(Promise);
        thrown = p;
      }
      // Assert that promise for request in flight is thrown
      expect(thrown).not.toBe(null);

      // Try reading a fragment a second time while parent query is in flight
      let cached = null;
      try {
        FragmentResource.read(fragmentNode, fragmentRef, componentDisplayName);
      } catch (p) {
        expect(p).toBeInstanceOf(Promise);
        cached = p;
      }
      // Assert that promise from first read was cached
      expect(cached).toBe(thrown);
    });

    it('should log an event if reading missing data and no relevent network request is in flight', () => {
      const fragmentRef = {
        __id: '4',
        __fragments: {
          FragmentResourceTest2Fragment: {},
        },
        __fragmentOwner: query.request,
      };

      const result = FragmentResource.read(
        getFragment(UserFragmentMissing),
        fragmentRef,
        componentDisplayName,
      );

      const expectedData = {id: '4', name: 'Mark', username: undefined};

      expect(result.data).toEqual(expectedData);

      const expectedLogEvent = {
        data: expectedData,
        fragment: UserFragmentMissing,
        isRelayHooks: true,
        name: 'fragmentresource.missing_data',
        cached: false,
      };

      function getMissigDataEvents() {
        return logEvents.filter(
          event => event.name === 'fragmentresource.missing_data',
        );
      }

      expect(getMissigDataEvents()).toEqual([expectedLogEvent]);

      // Reading a second time should result in a second event since we don't
      // cache this state.
      FragmentResource.read(
        getFragment(UserFragmentMissing),
        fragmentRef,
        componentDisplayName,
      );

      expect(getMissigDataEvents()).toEqual([
        expectedLogEvent,
        expectedLogEvent,
      ]);
    });

    it('should log an event if reading missing data and no relevent network request is in flight (triggered by update)', () => {
      const fragmentRef = {
        __id: '4',
        __fragments: {
          FragmentResourceTest2Fragment: {},
        },
        __fragmentOwner: query.request,
      };

      const result = FragmentResource.read(
        getFragment(UserFragmentMissing),
        fragmentRef,
        componentDisplayName,
      );

      const expectedData = {id: '4', name: 'Mark', username: undefined};

      expect(result.data).toEqual(expectedData);

      const expectedLogEvent = {
        data: expectedData,
        fragment: UserFragmentMissing,
        isRelayHooks: true,
        name: 'fragmentresource.missing_data',
        cached: false,
      };

      function getMissigDataEvents() {
        return logEvents.filter(
          event => event.name === 'fragmentresource.missing_data',
        );
      }

      expect(getMissigDataEvents()).toEqual([expectedLogEvent]);

      const mockSubscription = jest.fn<[], void>();
      // Subscribing here will cause Fragment resource to write updated fragment
      // snapshots to its cache.
      const disposable = FragmentResource.subscribe(result, mockSubscription);

      environment
        .getStore()
        .publish(RelayRecordSource.create({'4': {__id: '4', name: 'Mark II'}}));

      environment.getStore().notify();

      expect(mockSubscription).toHaveBeenCalled();

      // Calling read a second time should read the cacheed data and log accordingly.
      FragmentResource.read(
        getFragment(UserFragmentMissing),
        fragmentRef,
        componentDisplayName,
      );

      expect(getMissigDataEvents()).toEqual([
        expectedLogEvent,
        {
          data: {...expectedData, name: 'Mark II'},
          fragment: UserFragmentMissing,
          isRelayHooks: true,
          name: 'fragmentresource.missing_data',
          cached: true,
        },
      ]);

      disposable.dispose();
    });

    it('should not cache or throw an error if network request for parent query errored', () => {
      fetchQuery(environment, queryMissingData).subscribe({error: () => {}});

      const fragmentNode = getFragment(UserFragmentMissing);
      const fragmentRef = {
        __id: '4',
        __fragments: {
          FragmentResourceTest2Fragment: {},
        },
        __fragmentOwner: queryMissingData.request,
      };

      // Try reading a fragment while parent query is in flight
      let thrown = null;
      try {
        FragmentResource.read(fragmentNode, fragmentRef, componentDisplayName);
      } catch (p) {
        expect(p).toBeInstanceOf(Promise);
        thrown = p;
      }
      // Assert that promise for request in flight is thrown
      expect(thrown).not.toBe(null);

      // Make the network request error
      environment.mock.reject(queryMissingData, new Error('Network Error'));
      jest.runAllImmediates();

      // Try reading a fragment a second time after the parent query errored
      let cached = null;
      try {
        FragmentResource.read(fragmentNode, fragmentRef, componentDisplayName);
      } catch (p) {
        cached = p;
      }
      // Assert that promise from first read was cached
      expect(cached).toBe(null);
    });

    it('should show a readable error message if fragment is conditionally included', () => {
      expect(() =>
        FragmentResource.read(
          getFragment(UserFragment),
          {/* no fragment reference */},
          componentDisplayName,
        ),
      ).toThrow(
        `Relay: Expected to receive an object where \`...FragmentResourceTest1Fragment\` was spread, but the fragment reference was not found\`.`,
      );
    });
  });

  describe('readSpec', () => {
    it('should read data for the fragment when all data is available', () => {
      const result = FragmentResource.readSpec(
        {
          user: getFragment(UserFragment),
          user2: getFragment(UserFragment),
        },
        {
          user: {
            __id: '4',
            __fragments: {
              FragmentResourceTest1Fragment: {},
            },
            __fragmentOwner: query.request,
          },
          user2: null,
        },
        componentDisplayName,
      );
      expect(result.user.data).toEqual({id: '4', name: 'Mark'});
      expect(result.user2.data).toEqual(null);
    });

    it('should throw and cache promise if reading missing data and network request for parent query is in flight', () => {
      fetchQuery(environment, queryMissingData).subscribe({});

      const fragmentNodes = {
        user: getFragment(UserFragmentMissing),
      };
      const fragmentRefs: {[key: string]: unknown} = {
        user: {
          __id: '4',
          __fragments: {
            FragmentResourceTest2Fragment: {},
          },
          __fragmentOwner: queryMissingData.request,
        },
      };

      // Try reading a fragment while parent query is in flight
      let thrown = null;
      try {
        FragmentResource.readSpec(
          fragmentNodes,
          fragmentRefs,
          componentDisplayName,
        );
      } catch (p) {
        expect(p).toBeInstanceOf(Promise);
        thrown = p;
      }
      // Assert that promise for request in flight is thrown
      expect(thrown).not.toBe(null);

      // Try reading a fragment a second time while parent query is in flight
      let cached = null;
      try {
        FragmentResource.readSpec(
          fragmentNodes,
          fragmentRefs,
          componentDisplayName,
        );
      } catch (p) {
        expect(p).toBeInstanceOf(Promise);
        cached = p;
      }
      // Assert that promise from first read was cached
      expect(cached).toBe(thrown);
    });
  });

  describe('subscribe', () => {
    let callback;
    beforeEach(() => {
      callback = jest.fn<[], void>();
    });

    it('subscribes to the fragment that was `read`', () => {
      let result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toHaveBeenCalledTimes(0);

      const disposable = FragmentResource.subscribe(result, callback);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(1);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

      // Update data
      environment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Mark Updated',
        },
      });

      // Assert that callback gets update
      expect(callback).toBeCalledTimes(1);

      // Assert that reading the result again will reflect the latest value
      result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({id: '4', name: 'Mark Updated'});

      disposable.dispose();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(1);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);
    });

    it('immediately notifies of data updates that were missed between calling `read` and `subscribe`', () => {
      let result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toHaveBeenCalledTimes(0);

      // Update data once, before subscribe has been called
      environment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Mark Updated 1',
        },
      });

      const disposable = FragmentResource.subscribe(result, callback);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(1);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

      // Assert that callback was immediately called
      expect(callback).toBeCalledTimes(1);

      // Assert that reading the result again will reflect the latest value
      result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({id: '4', name: 'Mark Updated 1'});

      // Update data again
      environment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Mark Updated 2',
        },
      });

      // Assert that callback gets update
      expect(callback).toBeCalledTimes(2);

      // Assert that reading the result again will reflect the latest value
      result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({id: '4', name: 'Mark Updated 2'});

      disposable.dispose();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(1);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);
    });

    it('immediately notifies of data updates that were missed between calling `read` and `subscribe` (revert to original value)', () => {
      let result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toHaveBeenCalledTimes(0);

      // Update data once, before subscribe has been called
      environment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Mark Updated 1',
        },
      });

      const disposable = FragmentResource.subscribe(result, callback);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(1);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

      // Assert that callback was immediately called
      expect(callback).toBeCalledTimes(1);

      // Assert that reading the result again will reflect the latest value
      result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({id: '4', name: 'Mark Updated 1'});

      // Update data again
      environment.commitPayload(query, {
        node: {
          __typename: 'User',
          id: '4',
          name: 'Mark', // original value
        },
      });

      // Assert that callback gets update
      expect(callback).toBeCalledTimes(2);

      // Assert that reading the result again will reflect the latest value
      result = FragmentResource.read(
        getFragment(UserFragment),
        {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        },
        componentDisplayName,
      );
      expect(result.data).toEqual({id: '4', name: 'Mark'});

      disposable.dispose();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(1);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);
    });

    it("doesn't subscribe when result was null", () => {
      const result = FragmentResource.read(
        getFragment(UserFragment),
        null,
        componentDisplayName,
      );
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toHaveBeenCalledTimes(0);

      const disposable = FragmentResource.subscribe(result, callback);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(0);
      expect(callback).toBeCalledTimes(0);

      disposable.dispose();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(0);
      expect(callback).toBeCalledTimes(0);
    });

    it("doesn't subscribe when result was empty", () => {
      const result = FragmentResource.read(
        getFragment(UsersFragment),
        [],
        componentDisplayName,
      );
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toHaveBeenCalledTimes(0);

      const disposable = FragmentResource.subscribe(result, callback);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(0);
      expect(callback).toBeCalledTimes(0);

      disposable.dispose();
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(0);
      expect(callback).toBeCalledTimes(0);
    });

    describe('when subscribing multiple times to the same fragment', () => {
      it('maintains subscription even if one of the fragments is disposed of', () => {
        const fragmentNode = getFragment(UserFragment);
        const fragmentRef = {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        };
        const callback1 = jest.fn<[], void>();
        const callback2 = jest.fn<[], void>();

        let result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toHaveBeenCalledTimes(0);

        const disposable1 = FragmentResource.subscribe(result, callback1);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(1);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

        const disposable2 = FragmentResource.subscribe(result, callback2);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(2);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

        // Update data once
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Update 1',
          },
        });

        // Assert that both callbacks receive update
        expect(callback1).toBeCalledTimes(1);
        expect(callback2).toBeCalledTimes(1);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual({id: '4', name: 'Mark Update 1'});

        // Unsubscribe the second listener
        disposable2.dispose();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(2);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);

        // Update data again
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Update 2',
          },
        });

        // Assert that subscription that hasn't been disposed receives update
        expect(callback1).toBeCalledTimes(2);

        // Assert that subscription that was already disposed isn't called again
        expect(callback2).toBeCalledTimes(1);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual({id: '4', name: 'Mark Update 2'});

        disposable1.dispose();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(2);
      });
    });

    describe('when subscribing to plural fragment', () => {
      it('subscribes to the plural fragment that was `read`', () => {
        const fragmentNode = getFragment(UsersFragment);
        const fragmentRef = [
          {
            __id: '4',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
        ];
        let result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toHaveBeenCalledTimes(0);

        const disposable = FragmentResource.subscribe(result, callback);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(1);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

        // Update data
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated',
          },
        });

        // Assert that callback gets update
        expect(callback).toBeCalledTimes(1);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual([{id: '4', name: 'Mark Updated'}]);

        disposable.dispose();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(1);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);
      });

      it('immediately notifies of data updates that were missed between calling `read` and `subscribe`', () => {
        const fragmentNode = getFragment(UsersFragment);
        const fragmentRef = [
          {
            __id: '4',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
        ];
        let result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toHaveBeenCalledTimes(0);

        // Update data once, before subscribe has been called
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated 1',
          },
        });

        const disposable = FragmentResource.subscribe(result, callback);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(1);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

        // Assert that callback was immediately called
        expect(callback).toBeCalledTimes(1);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual([{id: '4', name: 'Mark Updated 1'}]);

        // Update data again
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated 2',
          },
        });

        // Assert that callback gets update
        expect(callback).toBeCalledTimes(2);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual([{id: '4', name: 'Mark Updated 2'}]);

        disposable.dispose();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(1);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);
      });

      it('correctly subscribes to a plural fragment with multiple records', () => {
        queryPlural = createOperationDescriptor(UsersQuery, {
          ids: ['4', '5'],
        });
        environment.commitPayload(queryPlural, {
          nodes: [
            {
              __typename: 'User',
              id: '4',
              name: 'Mark',
            },
            {
              __typename: 'User',
              id: '5',
              name: 'User 5',
            },
          ],
        });
        const fragmentNode = getFragment(UsersFragment);
        const fragmentRef = [
          {
            __id: '4',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
          {
            __id: '5',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
        ];

        let result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toHaveBeenCalledTimes(0);

        const disposable = FragmentResource.subscribe(result, callback);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(2);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

        // Update data
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated',
          },
        });

        // Assert that callback gets update
        expect(callback).toBeCalledTimes(1);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual([
          {id: '4', name: 'Mark Updated'},
          {id: '5', name: 'User 5'},
        ]);

        disposable.dispose();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(2);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);
      });

      it('immediately notifies of data updates that were missed between calling `read` and `subscribe` when subscribing to multiple records', () => {
        queryPlural = createOperationDescriptor(UsersQuery, {
          ids: ['4', '5'],
        });
        environment.commitPayload(queryPlural, {
          nodes: [
            {
              __typename: 'User',
              id: '4',
              name: 'Mark',
            },
            {
              __typename: 'User',
              id: '5',
              name: 'User 5',
            },
            {
              __typename: 'User',
              id: '6',
              name: 'User 6',
            },
          ],
        });
        const fragmentNode = getFragment(UsersFragment);
        const fragmentRef = [
          {
            __id: '4',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
          {
            __id: '5',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
          {
            __id: '6',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
        ];

        let result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toHaveBeenCalledTimes(0);

        // Update data once, before subscribe has been called
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated 1',
          },
        });
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '6',
            name: 'User 6 Updated',
          },
        });

        const disposable = FragmentResource.subscribe(result, callback);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(3);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

        // Assert that callback was immediately called
        expect(callback).toBeCalledTimes(1);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual([
          {id: '4', name: 'Mark Updated 1'},
          {id: '5', name: 'User 5'},
          {id: '6', name: 'User 6 Updated'},
        ]);

        // Update data again
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated 2',
          },
        });

        // Assert that callback gets update
        expect(callback).toBeCalledTimes(2);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual([
          {id: '4', name: 'Mark Updated 2'},
          {id: '5', name: 'User 5'},
          {id: '6', name: 'User 6 Updated'},
        ]);

        disposable.dispose();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(3);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);
      });

      it('immediately notifies of data updates that were missed between calling `read` and `subscribe` when subscribing to multiple records (revert to original)', () => {
        queryPlural = createOperationDescriptor(UsersQuery, {ids: ['4']});
        environment.commitPayload(queryPlural, {
          nodes: [
            {
              __typename: 'User',
              id: '4',
              name: 'Mark',
            },
          ],
        });
        const fragmentNode = getFragment(UsersFragment);
        const fragmentRef = [
          {
            __id: '4',
            __fragments: {
              FragmentResourceTest3Fragment: {},
            },
            __fragmentOwner: queryPlural.request,
          },
        ];

        let result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toHaveBeenCalledTimes(0);

        // Update data once, before subscribe has been called
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated 1',
          },
        });

        const disposable = FragmentResource.subscribe(result, callback);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(1);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(0);

        // Assert that callback was immediately called
        expect(callback).toBeCalledTimes(1);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual([{id: '4', name: 'Mark Updated 1'}]);

        // Update data again
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark', // revert to original
          },
        });

        // Assert that callback gets update
        expect(callback).toBeCalledTimes(2);

        // Assert that reading the result again will reflect the latest value
        result = FragmentResource.read(
          fragmentNode,
          fragmentRef,
          componentDisplayName,
        );
        expect(result.data).toEqual([{id: '4', name: 'Mark'}]);

        disposable.dispose();
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe).toBeCalledTimes(1);
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        expect(environment.subscribe.mock.dispose).toBeCalledTimes(1);
      });
    });
  });

  describe('subscribeSpec', () => {
    let unsubscribe;
    let callback: JestMockFn<ReadonlyArray<unknown>, void>;
    beforeEach(() => {
      unsubscribe = jest.fn<ReadonlyArray<unknown>, unknown>();
      callback = jest.fn();
      jest.spyOn(environment, 'subscribe').mockImplementation(() => ({
        dispose: unsubscribe,
      }));
    });

    it('subscribes to the fragment spec that was `read`', () => {
      const result = FragmentResource.readSpec(
        {user: getFragment(UserFragment)},
        {
          user: {
            __id: '4',
            __fragments: {
              FragmentResourceTest1Fragment: {},
            },
            __fragmentOwner: query.request,
          },
        },
        componentDisplayName,
      );
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toHaveBeenCalledTimes(0);

      const disposable = FragmentResource.subscribeSpec(result, callback);
      expect(unsubscribe).toBeCalledTimes(0);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(1);

      disposable.dispose();
      expect(unsubscribe).toBeCalledTimes(1);
      // $FlowFixMe[method-unbinding] added when improving typing for this parameters
      expect(environment.subscribe).toBeCalledTimes(1);
    });

    describe('checkMissedUpdatesSpec', () => {
      beforeEach(() => {
        unsubscribe = jest.fn();
        callback = jest.fn();
        jest.spyOn(environment, 'subscribe').mockImplementation(() => ({
          dispose: jest.fn(),
        }));
      });
      test('returns true if one fragment missed updates', () => {
        queryPlural = createOperationDescriptor(UsersQuery, {
          ids: ['4', '5'],
        });
        environment.commitPayload(queryPlural, {
          nodes: [
            {
              __typename: 'User',
              id: '4',
              name: 'Mark',
            },
            {
              __typename: 'User',
              id: '5',
              name: 'User 5',
            },
          ],
        });
        const userARef = {
          __id: '4',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        };
        const userBRef = {
          __id: '5',
          __fragments: {
            FragmentResourceTest1Fragment: {},
          },
          __fragmentOwner: query.request,
        };
        function readUsersSpec() {
          return FragmentResource.readSpec(
            {
              userA: getFragment(UserFragment),
              userB: getFragment(UserFragment),
            },
            {
              userA: userARef,
              userB: userBRef,
            },
            componentDisplayName,
          );
        }
        const result = readUsersSpec();
        expect(FragmentResource.checkMissedUpdatesSpec(result)).toBe(false);
        // Update data once, before subscribe has been called
        environment.commitPayload(query, {
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark Updated 1',
          },
        });
        expect(FragmentResource.checkMissedUpdatesSpec(result)).toBe(true);
      });
    });
  });
});
