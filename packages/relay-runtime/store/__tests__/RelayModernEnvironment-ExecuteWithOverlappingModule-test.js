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
import type {Snapshot} from '../RelayStoreTypes';
import type {
  HandleFieldPayload,
  RecordSourceProxy,
} from 'relay-runtime/store/RelayStoreTypes';
import type {RequestParameters} from 'relay-runtime/util/RelayConcreteNode';
import type {
  CacheConfig,
  Variables,
} from 'relay-runtime/util/RelayRuntimeTypes';

const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {graphql} = require('relay-runtime');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe('execute() multiple queries with overlapping @module-s', () => {
  let actorOperation;
  let actorOperationCallback;
  let actorQuery;
  let dataSource;
  let environment;
  let fetch;
  let operationLoader;
  let source;
  let store;
  let userOperation;
  let userOperationCallback;
  let userQuery;
  let variables;

  beforeEach(() => {
    actorQuery = graphql`
      query RelayModernEnvironmentExecuteWithOverlappingModuleTestActorQuery(
        $id: ID!
      ) {
        node(id: $id) {
          ... on Actor {
            nameRenderer {
              # different fragment/module but matching same type
              ...RelayModernEnvironmentExecuteWithOverlappingModuleTestMarkdownActorNameRenderer_name
                @module(name: "MarkdownActorNameRenderer.react")
            }
          }
        }
      }
    `;
    graphql`
      fragment RelayModernEnvironmentExecuteWithOverlappingModuleTestPlainUserNameRenderer_name on PlainUserNameRenderer {
        plaintext
        data {
          text
        }
      }
    `;

    graphql`
      fragment RelayModernEnvironmentExecuteWithOverlappingModuleTestMarkdownActorNameRenderer_name on MarkdownUserNameRenderer {
        __typename
        markdown
        data {
          markup @__clientField(handle: "markup_handler")
        }
      }
    `;
    graphql`
      fragment RelayModernEnvironmentExecuteWithOverlappingModuleTestMarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
        __typename
        markdown
        data {
          markup @__clientField(handle: "markup_handler")
        }
      }
    `;
    userQuery = graphql`
      query RelayModernEnvironmentExecuteWithOverlappingModuleTestQuery(
        $id: ID!
      ) {
        node(id: $id) {
          ... on User {
            nameRenderer {
              # different fragment/module but matching same type
              ...RelayModernEnvironmentExecuteWithOverlappingModuleTestMarkdownUserNameRenderer_name
                @module(name: "MarkdownUserNameRenderer.react")
              ...RelayModernEnvironmentExecuteWithOverlappingModuleTestPlainUserNameRenderer_name
                @module(name: "PlainUserNameRenderer.react")
            }
          }
        }
      }
    `;

    variables = {id: '1'};
    actorOperation = createOperationDescriptor(actorQuery, variables);
    userOperation = createOperationDescriptor(userQuery, variables);

    const MarkupHandler = {
      update(storeProxy: RecordSourceProxy, payload: HandleFieldPayload) {
        const record = storeProxy.get(payload.dataID);
        if (record != null) {
          const markup = record.getValue(payload.fieldKey);
          record.setValue(
            typeof markup === 'string' ? markup.toUpperCase() : null,
            payload.handleKey,
          );
        }
      },
    };

    fetch = (
      _query: RequestParameters,
      _variables: Variables,
      _cacheConfig: CacheConfig,
    ) => {
      // $FlowFixMe[missing-local-annot] Error found while enabling LTI on this file
      return RelayObservable.create(sink => {
        dataSource = sink;
      });
    };
    operationLoader = {
      load: jest.fn(moduleName => {
        return Promise.resolve(undefined);
      }),
      get: jest.fn<[unknown], ?NormalizationRootNode>(),
    };
    source = RelayRecordSource.create();
    store = new RelayModernStore(source);
    environment = new RelayModernEnvironment({
      network: RelayNetwork.create(fetch),
      store,
      operationLoader,
      handlerProvider: name => {
        switch (name) {
          case 'markup_handler':
            return MarkupHandler;
        }
      },
    });
    const actorOperationSnapshot = environment.lookup(actorOperation.fragment);
    actorOperationCallback = jest.fn<[Snapshot], void>();
    environment.subscribe(actorOperationSnapshot, actorOperationCallback);
    const userOperationSnapshot = environment.lookup(userOperation.fragment);
    userOperationCallback = jest.fn<[Snapshot], void>();
    environment.subscribe(userOperationSnapshot, userOperationCallback);
  });

  it('updates @module data selected by the same document', () => {
    environment.execute({operation: userOperation}).subscribe({});
    const userPayload = {
      data: {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayModernEnvironmentExecuteWithOverlappingModuleTestQuery:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayModernEnvironmentExecuteWithOverlappingModuleTestQuery:
              'MarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
        },
      },
    };
    dataSource.next(userPayload);
    jest.runAllTimers();

    expect(userOperationCallback).toBeCalledTimes(1);
    const userOperationSnapshot = userOperationCallback.mock.calls[0][0];
    expect(userOperationSnapshot.isMissingData).toBe(false);
    expect(userOperationSnapshot.data).toEqual({
      node: {
        nameRenderer: {
          __id: 'client:1:nameRenderer',
          __fragmentPropName: 'name',

          __fragments: {
            RelayModernEnvironmentExecuteWithOverlappingModuleTestMarkdownUserNameRenderer_name:
              {},
          },

          __fragmentOwner: userOperation.request,
          __module_component: 'MarkdownUserNameRenderer.react',
        },
      },
    });
    userOperationCallback.mockClear();

    const userPayload2 = {
      data: {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'PlainUserNameRenderer',
            __module_component_RelayModernEnvironmentExecuteWithOverlappingModuleTestQuery:
              'PlainUserNameRenderer.react',
            __module_operation_RelayModernEnvironmentExecuteWithOverlappingModuleTestQuery:
              'PlainUserNameRenderer_name$normalization.graphql',
            plaintext: 'plaintext payload',
            data: {
              text: 'some plaintext!',
            },
          },
        },
      },
    };
    dataSource.next(userPayload2);
    jest.runAllTimers();

    expect(userOperationCallback).toBeCalledTimes(1);
    const userOperationSnapshot2 = userOperationCallback.mock.calls[0][0];
    expect(userOperationSnapshot2.isMissingData).toBe(false);
    expect(userOperationSnapshot2.data).toEqual({
      node: {
        nameRenderer: {
          __id: 'client:1:nameRenderer',
          __fragmentPropName: 'name',

          __fragments: {
            RelayModernEnvironmentExecuteWithOverlappingModuleTestPlainUserNameRenderer_name:
              {},
          },

          __fragmentOwner: userOperation.request,
          __module_component: 'PlainUserNameRenderer.react',
        },
      },
    });
  });

  it('does not update @module data selected by other documents', () => {
    // UserQuery result shouldn't be affected by ActorQuery
    environment.execute({operation: userOperation}).subscribe({});
    const userPayload = {
      data: {
        node: {
          id: '1',
          __typename: 'User',
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            __module_component_RelayModernEnvironmentExecuteWithOverlappingModuleTestQuery:
              'MarkdownUserNameRenderer.react',
            __module_operation_RelayModernEnvironmentExecuteWithOverlappingModuleTestQuery:
              'MarkdownUserNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
        },
      },
    };
    dataSource.next(userPayload);
    jest.runAllTimers();

    expect(userOperationCallback).toBeCalledTimes(1);
    const userOperationSnapshot = userOperationCallback.mock.calls[0][0];
    expect(userOperationSnapshot.isMissingData).toBe(false);
    expect(userOperationSnapshot.data).toEqual({
      node: {
        nameRenderer: {
          __id: 'client:1:nameRenderer',
          __fragmentPropName: 'name',

          __fragments: {
            RelayModernEnvironmentExecuteWithOverlappingModuleTestMarkdownUserNameRenderer_name:
              {},
          },

          __fragmentOwner: userOperation.request,
          __module_component: 'MarkdownUserNameRenderer.react',
        },
      },
    });
    userOperationCallback.mockClear();
    // actor operation updates bc nameRenderer is no longer null, but
    // its @module is missing even though user operation's @module is available
    expect(actorOperationCallback).toBeCalledTimes(1);
    const actorOperationSnapshot = actorOperationCallback.mock.calls[0][0];
    expect(actorOperationSnapshot.isMissingData).toBe(true);
    expect(actorOperationSnapshot.data).toEqual({
      node: {
        nameRenderer: {},
      },
    });
    actorOperationCallback.mockClear();

    environment.execute({operation: actorOperation}).subscribe({});
    const actorPayload = {
      data: {
        node: {
          id: '1',
          __typename: 'User',
          __isActor: true,
          nameRenderer: {
            __typename: 'MarkdownUserNameRenderer',
            // different component: s/User/Actor/
            __module_component_RelayModernEnvironmentExecuteWithOverlappingModuleTestActorQuery:
              'MarkdownActorNameRenderer.react',
            // different operation: s/User/Actor/
            __module_operation_RelayModernEnvironmentExecuteWithOverlappingModuleTestActorQuery:
              'MarkdownActorNameRenderer_name$normalization.graphql',
            markdown: 'markdown payload',
            data: {
              markup: '<markup/>',
            },
          },
        },
      },
    };
    dataSource.next(actorPayload);
    jest.runAllTimers();

    // UserQuery not affected by ActorQuery result
    expect(userOperationCallback).toBeCalledTimes(0);
    expect(actorOperationCallback).toBeCalledTimes(1);
    const actorOperationSnapshot2 = actorOperationCallback.mock.calls[0][0];
    expect(actorOperationSnapshot2.isMissingData).toBe(false);
    expect(actorOperationSnapshot2.data).toEqual({
      node: {
        nameRenderer: {
          __id: 'client:1:nameRenderer',
          __fragmentPropName: 'name',

          __fragments: {
            RelayModernEnvironmentExecuteWithOverlappingModuleTestMarkdownActorNameRenderer_name:
              {},
          },

          __fragmentOwner: actorOperation.request,
          __module_component: 'MarkdownActorNameRenderer.react',
        },
      },
    });
  });
});
