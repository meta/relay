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

import type {PayloadData, PayloadError} from '../../network/RelayNetworkTypes';
import type {Availability} from '../DataChecker';
import type {ExecTimeS2CWork} from '../ExecTimeS2CDataChecker';
import type {
  MissingFieldHandler,
  OperationDescriptor,
  OperationLoader,
  RecordSource,
  RecordSourceJSON,
  RelayResponsePayload,
  S2CExecution,
  Snapshot,
  Store,
  TaskScheduler,
} from '../RelayStoreTypes';
import type {
  NormalizationLinkedField,
  NormalizationOperation,
  NormalizationResolverField,
  NormalizationScalarField,
  NormalizationSelection,
  NormalizationSplitOperation,
} from 'relay-runtime/util/NormalizationNode';
import type {ReaderFragment} from 'relay-runtime/util/ReaderNode';

const {
  INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
} = require('../../multi-actor-environment/ActorIdentifier');
const RelayObservable = require('../../network/RelayObservable');
const {graphql} = require('../../query/GraphQLTag');
const DataChecker = require('../DataChecker');
const defaultGetDataID = require('../defaultGetDataID');
const ExecTimeS2CDataChecker = require('../ExecTimeS2CDataChecker');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayModernRecord = require('../RelayModernRecord');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const {read} = require('../RelayReader');
const RelayRecordSource = require('../RelayRecordSource');
const {normalize} = require('../RelayResponseNormalizer');
const {ROOT_ID, ROOT_TYPE} = require('../RelayStoreUtils');
const {generateTypeID} = require('../TypeID');
const PlainUserNameRendererOperation: NormalizationSplitOperation = require('./__generated__/DataCheckerExecTimeS2CTestPlainUserNameRenderer_name$normalization.graphql');
const ActorNameFragment: ReaderFragment = require('./resolvers/__generated__/ExecTimeS2CResolvers_ActorNameFragment.graphql');
const IdentityFragment: ReaderFragment = require('./resolvers/__generated__/ExecTimeS2CResolvers_IdentityFragment.graphql');
const KeyedFragment: ReaderFragment = require('./resolvers/__generated__/ExecTimeS2CResolvers_KeyedFragment.graphql');
const ShadowRootFragment: ReaderFragment = require('./resolvers/__generated__/ExecTimeS2CShadowResolver_RootFragment.graphql');
const ThingsRootFragment: ReaderFragment = require('./resolvers/__generated__/ExecTimeS2CThingsResolver_RootFragment.graphql');
const nullthrows = require('nullthrows');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();
const ScalarQuery = graphql`
  query DataCheckerExecTimeS2CTestScalarQuery @exec_time_resolvers {
    me {
      exec_time_s2c_identity
    }
  }
`;
const KeyedQuery = graphql`
  query DataCheckerExecTimeS2CTestKeyedQuery @exec_time_resolvers {
    me {
      exec_time_s2c_keyed
    }
  }
`;
const PluralQuery = graphql`
  query DataCheckerExecTimeS2CTestPluralQuery($ids: [ID!])
  @exec_time_resolvers {
    nodes(ids: $ids) {
      ... on User {
        exec_time_s2c_identity
      }
    }
  }
`;
const AbstractQuery = graphql`
  query DataCheckerExecTimeS2CTestAbstractQuery($id: ID!) @exec_time_resolvers {
    node(id: $id) {
      ... on Named {
        name
        ... on User {
          exec_time_s2c_identity
        }
      }
    }
  }
`;
const ConditionQuery = graphql`
  query DataCheckerExecTimeS2CTestConditionQuery($withS2C: Boolean!)
  @exec_time_resolvers {
    me {
      name
      exec_time_s2c_identity @include(if: $withS2C)
    }
  }
`;
const DeferQuery = graphql`
  query DataCheckerExecTimeS2CTestDeferQuery($deferred: Boolean!)
  @exec_time_resolvers {
    me {
      name
      ...DataCheckerExecTimeS2CTestDeferredFragment
        @defer(label: "DataCheckerExecTimeS2CTestDeferred", if: $deferred)
    }
  }
`;
graphql`
  fragment DataCheckerExecTimeS2CTestDeferredFragment on User {
    exec_time_s2c_identity
  }
`;
const ConnectionQuery = graphql`
  query DataCheckerExecTimeS2CTestConnectionQuery @exec_time_resolvers {
    me {
      friends(first: 1) @connection(key: "DataCheckerExecTimeS2CTest_friends") {
        edges {
          node {
            exec_time_s2c_identity
          }
        }
      }
    }
  }
`;
// A root fragment that reads through an abstract refinement.
const ActorNameQuery = graphql`
  query DataCheckerExecTimeS2CTestActorNameQuery @exec_time_resolvers {
    me {
      exec_time_s2c_actor_name
    }
  }
`;
const ActorRefinementQuery = graphql`
  query DataCheckerExecTimeS2CTestActorRefinementQuery($id: ID!)
  @exec_time_resolvers {
    node(id: $id) {
      ... on Actor {
        ... on User {
          exec_time_s2c_identity
        }
      }
    }
  }
`;
const ActorRefinementWithoutS2CQuery = graphql`
  query DataCheckerExecTimeS2CTestActorRefinementWithoutS2CQuery
  @exec_time_resolvers {
    me {
      exec_time_s2c_identity
      ... on Actor {
        name
      }
    }
  }
`;
// Its refinement holds only a client field, so the query text leaves it out,
// and normalizing the response stores `__isActor: false` for a User.
const ClientOnlyActorQuery = graphql`
  query DataCheckerExecTimeS2CTestClientOnlyActorQuery($id: ID!) {
    node(id: $id) {
      ... on Actor {
        client_actor_field
      }
    }
  }
`;
const DeferredNameQuery = graphql`
  query DataCheckerExecTimeS2CTestDeferredNameQuery @exec_time_resolvers {
    me {
      exec_time_s2c_identity
      ...DataCheckerExecTimeS2CTestDeferredNameFragment
        @defer(label: "DataCheckerExecTimeS2CTestDeferredName")
    }
  }
`;
graphql`
  fragment DataCheckerExecTimeS2CTestDeferredNameFragment on User {
    name
  }
`;
const StreamedNamesQuery = graphql`
  query DataCheckerExecTimeS2CTestStreamedNamesQuery($ids: [ID!])
  @exec_time_resolvers {
    me {
      exec_time_s2c_identity
    }
    nodes(ids: $ids)
      @stream(
        label: "DataCheckerExecTimeS2CTestStreamedNames"
        initial_count: 0
      ) {
      name
    }
  }
`;
const ModuleQuery = graphql`
  query DataCheckerExecTimeS2CTestModuleQuery @exec_time_resolvers {
    me {
      exec_time_s2c_identity
      nameRenderer @match {
        ...DataCheckerExecTimeS2CTestPlainUserNameRenderer_name
          @module(name: "PlainUserNameRenderer.react")
      }
    }
  }
`;
graphql`
  fragment DataCheckerExecTimeS2CTestPlainUserNameRenderer_name on PlainUserNameRenderer {
    plaintext
  }
`;
const ClientLinkQuery = graphql`
  query DataCheckerExecTimeS2CTestClientLinkQuery @exec_time_resolvers {
    me {
      client_best_friend {
        exec_time_s2c_identity
      }
    }
  }
`;
const ShadowQuery = graphql`
  query DataCheckerExecTimeS2CTestShadowQuery @exec_time_resolvers {
    exec_time_s2c_shadow_address {
      city
    }
  }
`;
const ClientRootQuery = graphql`
  query DataCheckerExecTimeS2CTestClientRootQuery @exec_time_resolvers {
    me {
      exec_time_s2c_identity
    }
    exec_time_s2c_client_root
  }
`;
const ClientRootOuterQuery = graphql`
  query DataCheckerExecTimeS2CTestClientRootOuterQuery @exec_time_resolvers {
    me {
      exec_time_s2c_identity
    }
    exec_time_s2c_client_root_outer
  }
`;
const ClientAbstractQuery = graphql`
  query DataCheckerExecTimeS2CTestClientAbstractQuery($id: ID!)
  @exec_time_resolvers {
    node(id: $id) {
      ... on IExecTimeS2CThing {
        exec_time_s2c_thing_label
      }
    }
  }
`;
const NestedShadowQuery = graphql`
  query DataCheckerExecTimeS2CTestNestedShadowQuery @exec_time_resolvers {
    exec_time_s2c_shadow_nested {
      city
    }
  }
`;
const StreamQuery = graphql`
  query DataCheckerExecTimeS2CTestStreamQuery($ids: [ID!], $streamed: Boolean)
  @exec_time_resolvers {
    nodes(ids: $ids)
      @stream(
        label: "DataCheckerExecTimeS2CTestStream"
        initial_count: 0
        if: $streamed
      ) {
      ... on User {
        exec_time_s2c_identity
      }
    }
  }
`;
const ThingsQuery = graphql`
  query DataCheckerExecTimeS2CTestThingsQuery($ids: [ID!]!)
  @exec_time_resolvers {
    exec_time_s2c_things(ids: $ids) {
      id
    }
  }
`;

const MODULE_DATA = {
  me: {
    id: '4',
    nameRenderer: {
      __module_component_DataCheckerExecTimeS2CTestModuleQuery:
        'PlainUserNameRenderer.react',
      __module_operation_DataCheckerExecTimeS2CTestModuleQuery:
        'DataCheckerExecTimeS2CTestPlainUserNameRenderer_name$normalization.graphql',
      __typename: 'PlainUserNameRenderer',
      plaintext: 'Zuck',
    },
  },
};

const SHADOW_DATA = {
  me: {
    address: {__typename: 'StreetAddress', city: 'Menlo Park'},
    id: '4',
  },
};

// What the exec-time network path computes from a response: the payload whose
// `source` the cold run reads and whose `s2cExecutions` it runs.
function normalizeCold(
  operation: OperationDescriptor,
  data: PayloadData,
  errors?: Array<PayloadError>,
): RelayResponsePayload {
  const source = RelayRecordSource.create();
  source.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
  return normalize(
    source,
    operation.root,
    data,
    {
      actorIdentifier: INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
      deferDeduplicatedFields: false,
      getDataID: defaultGetDataID,
      log: null,
      path: [],
      treatMissingFieldsAsNull: false,
    },
    errors,
    true,
  );
}

function createEnvironment(
  store: Store = new RelayModernStore(RelayRecordSource.create()),
  missingFieldHandlers?: ReadonlyArray<MissingFieldHandler>,
  scheduler?: TaskScheduler,
): RelayModernEnvironment {
  return new RelayModernEnvironment({
    missingFieldHandlers,
    network: {
      execute: () => RelayObservable.create(() => {}),
    },
    scheduler,
    store,
  });
}

const operationLoaders: WeakMap<RelayModernEnvironment, OperationLoader> =
  new WeakMap();

// `check()` and the exec-time checker load `@module` operations through the
// same loader.
function createEnvironmentWithLoader(
  operationLoader: OperationLoader,
): RelayModernEnvironment {
  const environment = createEnvironment(
    new RelayModernStore(RelayRecordSource.create(), {operationLoader}),
  );
  operationLoaders.set(environment, operationLoader);
  return environment;
}

// Writes what a cold run of `operation` normalized and records that run as a
// fetch of `operation`: the state a remount finds.
function warm(
  store: Store,
  operation: OperationDescriptor,
  cold: RelayResponsePayload,
): void {
  store.retain(operation);
  store.publish(cold.source);
  store.notify(operation);
}

function warmEnvironment(
  operation: OperationDescriptor,
  cold: RelayResponsePayload,
): RelayModernEnvironment {
  const environment = createEnvironment();
  warm(environment.getStore(), operation, cold);
  return environment;
}

type CheckS2CResult =
  ExecTimeS2CWork | Readonly<{kind: 'incomplete', reason: 'missing' | 'stale'}>;

// What the exec-time network layer does: `check()` decides whether the store
// can serve the operation, and the exec-time checker collects the work from
// the store's records. Null for an operation with no such work.
function checkS2C(
  environment: RelayModernEnvironment,
  operation: OperationDescriptor,
): ?CheckS2CResult {
  const node = operation.request.node.operation;
  if (
    node.use_exec_time_resolvers !== true ||
    node.has_server_to_client_resolvers !== true
  ) {
    return null;
  }
  const availability = environment.check(operation);
  if (availability.status !== 'available') {
    return {kind: 'incomplete', reason: availability.status};
  }
  return ExecTimeS2CDataChecker.check(
    environment.getStore().getSource(),
    operation.root,
    operationLoaders.get(environment),
  );
}

function expectComplete(work: ?CheckS2CResult): Readonly<{
  executions: ReadonlyArray<S2CExecution>,
  kind: 'complete',
}> {
  if (work?.kind !== 'complete') {
    throw new Error(
      `Expected complete work, got ${JSON.stringify(work) ?? 'nothing'}`,
    );
  }
  return work;
}

function expectCompleteWork(
  work: ?ExecTimeS2CWork,
): ReadonlyArray<S2CExecution> {
  if (work?.kind !== 'complete') {
    throw new Error(
      `Expected complete work, got ${JSON.stringify(work) ?? 'nothing'}`,
    );
  }
  return work.executions;
}

// The executor builds from the selections it is handed, so the check must hand
// over the normalizer's AST objects, not equal copies.
function expectSameExecutions(
  actual: ReadonlyArray<S2CExecution>,
  cold: RelayResponsePayload,
): void {
  const expected = nullthrows(cold.s2cExecutions);
  expect(actual).toEqual(expected);
  actual.forEach((execution, i) => {
    execution.selections.forEach((selection, j) => {
      expect(selection).toBe(expected[i].selections[j]);
    });
  });
}

function readRootFragment(
  source: RecordSource,
  fragment: ReaderFragment,
  dataID: string,
  operation: OperationDescriptor,
  variables: {[key: string]: unknown} = {},
): Snapshot {
  return read(
    source,
    createReaderSelector(fragment, dataID, variables, operation.request),
  );
}

function recordsOf(
  executions: ReadonlyArray<S2CExecution>,
): ReadonlyArray<{recordID: string, typeName: string}> {
  return executions.map(({recordID, typeName}) => ({recordID, typeName}));
}

describe('exec-time check(): server-to-client work', () => {
  it('loads where WeakMap is missing', () => {
    const {WeakMap} = global;
    delete global.WeakMap;
    try {
      jest.isolateModules(() => {
        require('../ExecTimeS2CDataChecker');
      });
    } finally {
      global.WeakMap = WeakMap;
    }
  });

  describe('collects exactly what the normalizer collects', () => {
    it('collects a record-parented resolver', () => {
      const operation = createOperationDescriptor(ScalarQuery, {});
      const cold = normalizeCold(operation, {me: {id: '4'}});
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('collects plural items in order, skipping null and unmatched items', () => {
      const operation = createOperationDescriptor(PluralQuery, {
        ids: ['4', 'gone', 'page', '5'],
      });
      const cold = normalizeCold(operation, {
        nodes: [
          {__typename: 'User', id: '4'},
          null,
          {__typename: 'Page', id: 'page'},
          {__typename: 'User', id: '5'},
        ],
      });
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
        {recordID: '5', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('collects under an abstract refinement its type record satisfies', () => {
      const operation = createOperationDescriptor(AbstractQuery, {id: '4'});
      const cold = normalizeCold(operation, {
        node: {__isNamed: 'User', __typename: 'User', id: '4', name: 'Zuck'},
      });
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('collects a Query-rooted resolver whose root fragment navigates', () => {
      const operation = createOperationDescriptor(ShadowQuery, {});
      const cold = normalizeCold(operation, SHADOW_DATA);
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: ROOT_ID, typeName: ROOT_TYPE},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('collects nothing behind a pruned condition, and is complete', () => {
      const operation = createOperationDescriptor(ConditionQuery, {
        withS2C: false,
      });
      const cold = normalizeCold(operation, {me: {id: '4', name: 'Zuck'}});
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(cold.s2cExecutions).toBe(undefined);
      expect(executions).toEqual([]);
    });

    it('collects behind a passing condition', () => {
      const operation = createOperationDescriptor(ConditionQuery, {
        withS2C: true,
      });
      const cold = normalizeCold(operation, {me: {id: '4', name: 'Zuck'}});
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('collects inline under @defer(if: false)', () => {
      const operation = createOperationDescriptor(DeferQuery, {
        deferred: false,
      });
      const cold = normalizeCold(operation, {me: {id: '4', name: 'Zuck'}});
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    // The store holds what the deferred payload would bring.
    it('collects under an active @defer, as its payload would bring it', () => {
      const inline = createOperationDescriptor(DeferQuery, {deferred: false});
      const cold = normalizeCold(inline, {me: {id: '4', name: 'Zuck'}});
      const operation = createOperationDescriptor(DeferQuery, {deferred: true});
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('collects under an active @stream, as its payloads would bring the items', () => {
      const inline = createOperationDescriptor(StreamQuery, {
        ids: ['4'],
        streamed: false,
      });
      const cold = normalizeCold(inline, {
        nodes: [{__typename: 'User', id: '4'}],
      });
      const operation = createOperationDescriptor(StreamQuery, {
        ids: ['4'],
        streamed: true,
      });
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('skips a refinement the store rules out when nothing under it is S2C', () => {
      const operation = createOperationDescriptor(
        ActorRefinementWithoutS2CQuery,
        {},
      );
      const cold = normalizeCold(operation, {
        me: {__isActor: 'User', id: '4', name: 'Zuck'},
      });
      const environment = warmEnvironment(operation, cold);
      environment.commitPayload(
        createOperationDescriptor(ClientOnlyActorQuery, {id: '4'}),
        {node: {__typename: 'User', id: '4'}},
      );

      const {executions} = expectComplete(checkS2C(environment, operation));

      expectSameExecutions(executions, cold);
    });

    it('skips a deferred fragment with no S2C resolver in it', () => {
      const operation = createOperationDescriptor(DeferredNameQuery, {});
      const cold = normalizeCold(operation, {me: {id: '4'}});
      const environment = warmEnvironment(operation, cold);
      // The deferred chunk's data, which availability also asks for.
      environment.commitUpdate(store => {
        nullthrows(store.get('4')).setValue('Zuck', 'name');
      });

      const {executions} = expectComplete(checkS2C(environment, operation));

      expectSameExecutions(executions, cold);
    });

    it('skips a streamed field with no S2C resolver in it', () => {
      const operation = createOperationDescriptor(StreamedNamesQuery, {
        ids: ['5'],
      });
      // With `initial_count: 0` the response's list is empty; each item
      // arrives in a later chunk.
      const cold = normalizeCold(operation, {me: {id: '4'}, nodes: []});
      const environment = warmEnvironment(operation, cold);
      environment.commitUpdate(store => {
        const user = store.create('5', 'User');
        user.setValue('5', 'id');
        user.setValue('Mark', 'name');
        nullthrows(store.getRoot()).setLinkedRecords([user], 'nodes', {
          ids: ['5'],
        });
      });

      const {executions} = expectComplete(checkS2C(environment, operation));

      expectSameExecutions(executions, cold);
    });

    // No response carries a client-extension link.
    it('collects nothing behind a client-extension link', () => {
      const operation = createOperationDescriptor(ClientLinkQuery, {});
      const cold = normalizeCold(operation, {me: {id: '4'}});
      const environment = warmEnvironment(operation, cold);
      environment.commitUpdate(store => {
        const friend = store.create('5', 'User');
        friend.setValue('5', 'id');
        nullthrows(store.get('4')).setLinkedRecord(
          friend,
          'client_best_friend',
        );
      });

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(cold.s2cExecutions).toBe(undefined);
      expect(executions).toEqual([]);
    });

    it('walks the connection field, not its handle', () => {
      const operation = createOperationDescriptor(ConnectionQuery, {});
      const data = {
        me: {
          friends: {
            edges: [{cursor: 'cursor:5', node: {__typename: 'User', id: '5'}}],
            pageInfo: {endCursor: 'cursor:5', hasNextPage: true},
          },
          id: '4',
        },
      };
      const cold = normalizeCold(operation, data);
      // A real fetch writes the handle; then an edge only the handle holds.
      const environment = new RelayModernEnvironment({
        network: {execute: () => RelayObservable.from({data})},
        store: new RelayModernStore(RelayRecordSource.create()),
      });
      environment.retain(operation);
      environment.execute({operation}).subscribe({});
      environment.commitUpdate(store => {
        const connection = nullthrows(
          store
            .getRoot()
            .getLinkedRecord('me')
            ?.getLinkedRecord(
              '__DataCheckerExecTimeS2CTest_friends_connection',
            ),
        );
        const user = store.create('6', 'User');
        user.setValue('6', 'id');
        const edge = store.create('client:edge:6', 'FriendsEdge');
        edge.setValue('cursor:6', 'cursor');
        edge.setLinkedRecord(user, 'node');
        connection.setLinkedRecords(
          [...(connection.getLinkedRecords('edges') ?? []), edge],
          'edges',
        );
      });

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '5', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('collects around a module that holds no S2C resolver', () => {
      const operation = createOperationDescriptor(ModuleQuery, {});
      const cold = normalizeCold(operation, MODULE_DATA);
      const environment = createEnvironmentWithLoader({
        get: () => PlainUserNameRendererOperation,
        load: () => Promise.resolve(PlainUserNameRendererOperation),
      });
      warm(environment.getStore(), operation, cold);
      // What normalizing the module's payload writes.
      const rendererID = nullthrows(
        cold.source.getRecordIDs().find(dataID => {
          const record = cold.source.get(dataID);
          return (
            record != null &&
            RelayModernRecord.getType(record) === 'PlainUserNameRenderer'
          );
        }),
      );
      environment.commitUpdate(store => {
        nullthrows(store.get(rendererID)).setValue('Zuck', 'plaintext');
      });

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });
  });

  describe('collects as the normalizer does around root fragments', () => {
    it('collects a resolver whose root fragment reads only client state', () => {
      const operation = createOperationDescriptor(ClientRootQuery, {});
      const cold = normalizeCold(operation, {me: {id: '4'}});
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
        {recordID: ROOT_ID, typeName: ROOT_TYPE},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('does not collect inside a root fragment that reads only client state', () => {
      const operation = createOperationDescriptor(ClientRootOuterQuery, {});
      const cold = normalizeCold(operation, {me: {id: '4'}});
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(executions[1].selections.length).toBe(1);
      expectSameExecutions(executions, cold);
    });

    it('collects resolvers nested in a server-reading root fragment before the outer one', () => {
      const operation = createOperationDescriptor(NestedShadowQuery, {});
      const cold = normalizeCold(operation, {
        me: {
          address: {__typename: 'StreetAddress', city: 'Menlo Park'},
          alternate_name: 'Z',
          id: '4',
        },
      });
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));
      const source = environment.getStore().getSource();

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
        {recordID: ROOT_ID, typeName: ROOT_TYPE},
      ]);
      expect(executions[1].selections.length).toBe(2);
      expectSameExecutions(executions, cold);
      // The nested resolver's root fragment was walked too.
      expect(readRootFragment(source, KeyedFragment, '4', operation)).toEqual(
        readRootFragment(cold.source, KeyedFragment, '4', operation),
      );
    });

    it('collects nothing when its only resolver sits under a client abstract type', () => {
      const operation = createOperationDescriptor(ClientAbstractQuery, {
        id: '4',
      });
      const cold = normalizeCold(operation, {
        node: {__typename: 'User', id: '4'},
      });
      const environment = warmEnvironment(operation, cold);
      // An exec-time run commits the operation's client abstract types, so the
      // store says the refinement holds.
      environment.commitUpdate(store => {
        nullthrows(store.get(generateTypeID('User'))).setValue(
          true,
          '__isIExecTimeS2CThing',
        );
      });
      expect(environment.check(operation).status).toBe('available');
      // The compiler marks no server-to-client resolver here.
      expect(checkS2C(environment, operation)).toBe(null);
      expect(cold.s2cExecutions).toBe(undefined);
    });

    it('writes nothing to the records it reads', () => {
      const operation = createOperationDescriptor(ClientAbstractQuery, {
        id: '4',
      });
      const source = RelayRecordSource.create(
        normalizeCold(operation, {
          node: {__typename: 'User', id: '4'},
        }).source.toJSON(),
      );
      // Where the operation's client abstract types would be written.
      source.remove(generateTypeID('User'));
      const records = source.toJSON();

      ExecTimeS2CDataChecker.check(source, operation.root, null);

      expect(source.toJSON()).toEqual(records);
    });

    it('collects inline under @stream when the stream is off', () => {
      const operation = createOperationDescriptor(StreamQuery, {
        ids: ['4'],
        streamed: false,
      });
      const cold = normalizeCold(operation, {
        nodes: [{__typename: 'User', id: '4'}],
      });
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expectSameExecutions(executions, cold);
    });

    it('collects a dispatcher bound from its field arguments', () => {
      const ids = ['4', '5'];
      const operation = createOperationDescriptor(ThingsQuery, {ids});
      const cold = normalizeCold(operation, {
        nodes: [
          {__typename: 'User', id: '4'},
          {__typename: 'User', id: '5'},
        ],
      });
      const environment = warmEnvironment(operation, cold);

      const {executions} = expectComplete(checkS2C(environment, operation));
      const source = environment.getStore().getSource();

      expect(recordsOf(executions)).toEqual([
        {recordID: ROOT_ID, typeName: ROOT_TYPE},
      ]);
      expectSameExecutions(executions, cold);
      const warmRead = readRootFragment(
        source,
        ThingsRootFragment,
        ROOT_ID,
        operation,
        {ids},
      );
      expect(warmRead.isMissingData).toBe(false);
      expect(warmRead).toEqual(
        readRootFragment(cold.source, ThingsRootFragment, ROOT_ID, operation, {
          ids,
        }),
      );
    });
  });

  describe('hands over the records the root fragments read', () => {
    it('reads an identity root fragment as the cold source does', () => {
      const operation = createOperationDescriptor(ScalarQuery, {});
      const cold = normalizeCold(operation, {me: {id: '4'}});
      const environment = warmEnvironment(operation, cold);

      expectComplete(checkS2C(environment, operation));
      const source = environment.getStore().getSource();

      const warmRead = readRootFragment(
        source,
        IdentityFragment,
        '4',
        operation,
      );
      expect(warmRead.data).toEqual({id: '4'});
      expect(warmRead).toEqual(
        readRootFragment(cold.source, IdentityFragment, '4', operation),
      );
    });

    it('reads a granted key field and its error as the cold source does', () => {
      const operation = createOperationDescriptor(KeyedQuery, {});
      const cold = normalizeCold(
        operation,
        {me: {alternate_name: null, id: '4'}},
        [{message: 'boom', path: ['me', 'alternate_name']}],
      );
      const environment = warmEnvironment(operation, cold);

      expectComplete(checkS2C(environment, operation));
      const source = environment.getStore().getSource();

      const warmRead = readRootFragment(source, KeyedFragment, '4', operation);
      const coldRead = readRootFragment(
        cold.source,
        KeyedFragment,
        '4',
        operation,
      );
      expect(warmRead.data).toEqual({alternate_name: null, id: '4'});
      expect(coldRead.fieldErrors).toEqual([
        {
          error: {message: 'boom'},
          fieldPath: '',
          handled: false,
          kind: 'relay_field_payload.error',
          owner: 'ExecTimeS2CResolvers_KeyedFragment',
          shouldThrow: false,
          uiContext: undefined,
        },
      ]);
      expect(warmRead).toEqual(coldRead);
    });

    it('reads a navigating root fragment as the cold source does', () => {
      const operation = createOperationDescriptor(ShadowQuery, {});
      const cold = normalizeCold(operation, SHADOW_DATA);
      const environment = warmEnvironment(operation, cold);

      expectComplete(checkS2C(environment, operation));
      const source = environment.getStore().getSource();

      expect(
        readRootFragment(source, ShadowRootFragment, ROOT_ID, operation),
      ).toEqual(
        readRootFragment(cold.source, ShadowRootFragment, ROOT_ID, operation),
      );
    });

    it('reads a root fragment that refines to an interface as the cold source does', () => {
      const operation = createOperationDescriptor(ActorNameQuery, {});
      const cold = normalizeCold(operation, {
        me: {__isActor: 'User', id: '4', name: 'Zuck'},
      });
      const environment = warmEnvironment(operation, cold);

      expectComplete(checkS2C(environment, operation));
      const source = environment.getStore().getSource();

      const warmRead = readRootFragment(
        source,
        ActorNameFragment,
        '4',
        operation,
      );
      expect(warmRead.data).toEqual({id: '4', name: 'Zuck'});
      expect(warmRead).toEqual(
        readRootFragment(cold.source, ActorNameFragment, '4', operation),
      );
    });

    it("is incomplete until a missing-field handler's link is committed", () => {
      const operation = createOperationDescriptor(ShadowQuery, {});
      const cold = normalizeCold(operation, SHADOW_DATA);
      // Another operation wrote the user and the address, but nothing links
      // `me` to them.
      const records = RelayRecordSource.create(cold.source.toJSON());
      records.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
      const store = new RelayModernStore(records);
      const before = records.toJSON();
      const resolved: Array<string> = [];
      // A scheduler that has not committed anything yet.
      const scheduled: Array<() => void> = [];
      const scheduler: TaskScheduler = {
        cancel: () => {},
        schedule: task => {
          scheduled.push(task);
          return String(scheduled.length);
        },
      };
      const handlers: ReadonlyArray<MissingFieldHandler> = [
        {
          handle(field, record) {
            if (record?.getType() === ROOT_TYPE && field.name === 'me') {
              resolved.push(field.name);
              return '4';
            }
          },
          kind: 'linked',
        },
      ];

      const environment = createEnvironment(store, handlers, scheduler);

      // The store's records do not hold the link yet.
      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
      expect(resolved).toEqual(['me']);
      expect(scheduled.length).toBe(1);
      expect(store.getSource().toJSON()).toEqual(before);

      scheduled.splice(0).forEach(task => task());
      expectComplete(checkS2C(environment, operation));
      const source = environment.getStore().getSource();

      expect(resolved).toEqual(['me']);
      expect(
        readRootFragment(source, ShadowRootFragment, ROOT_ID, operation),
      ).toEqual(
        readRootFragment(cold.source, ShadowRootFragment, ROOT_ID, operation),
      );
    });
    it('stays incomplete when only a missing-field handler could answer a root-fragment input', () => {
      const operation = createOperationDescriptor(KeyedQuery, {});
      const store = new RelayModernStore(RelayRecordSource.create());
      // Written by an operation that never fetched the granted key.
      warm(
        store,
        operation,
        normalizeCold(createOperationDescriptor(ScalarQuery, {}), {
          me: {id: '4'},
        }),
      );
      let handlerCalls = 0;
      const handlers: ReadonlyArray<MissingFieldHandler> = [
        {
          handle: field => {
            handlerCalls++;
            return field.name === 'alternate_name' ? 'The Zuck' : undefined;
          },
          kind: 'scalar',
        },
      ];
      const environment = createEnvironment(store, handlers);

      // Neither walk asks the handler, so nothing is committed for a later
      // check either: the request writes the input.
      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
      expect(handlerCalls).toBe(0);
    });

    it("is complete once a missing-field handler's null list is committed", () => {
      const operation = createOperationDescriptor(PluralQuery, {ids: ['4']});
      const store = new RelayModernStore(
        RelayRecordSource.create({
          [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE},
        }),
      );
      const handlers: ReadonlyArray<MissingFieldHandler> = [
        {handle: () => null, kind: 'pluralLinked'},
      ];
      // A scheduler that has not committed anything yet.
      const scheduled: Array<() => void> = [];
      const scheduler: TaskScheduler = {
        cancel: () => {},
        schedule: task => {
          scheduled.push(task);
          return String(scheduled.length);
        },
      };

      const environment = createEnvironment(store, handlers, scheduler);

      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });

      scheduled.splice(0).forEach(task => task());
      const {executions} = expectComplete(checkS2C(environment, operation));

      expect(executions).toEqual([]);
      expect(normalizeCold(operation, {nodes: null}).s2cExecutions).toBe(
        undefined,
      );
    });
  });

  describe('is incomplete, with the reason, when the store cannot stand in for a response', () => {
    it('when a root-fragment input is missing', () => {
      const operation = createOperationDescriptor(KeyedQuery, {});
      // Written by an operation that never fetched the granted key.
      const environment = warmEnvironment(
        operation,
        normalizeCold(createOperationDescriptor(ScalarQuery, {}), {
          me: {id: '4'},
        }),
      );

      expect(environment.check(operation).status).toBe('available');
      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
    });

    // Normalizing a response stores `false` for a refinement the response
    // carried no hint for, which includes one a query left out of its text.
    it('when a stored refinement answer could hide S2C work', () => {
      const operation = createOperationDescriptor(ActorRefinementQuery, {
        id: '4',
      });
      const environment = warmEnvironment(
        operation,
        normalizeCold(operation, {
          node: {__isActor: 'User', __typename: 'User', id: '4'},
        }),
      );
      environment.commitPayload(
        createOperationDescriptor(ClientOnlyActorQuery, {id: '4'}),
        {node: {__typename: 'User', id: '4'}},
      );

      expect(environment.check(operation).status).toBe('available');
      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'abstract_refinement',
      });
    });

    it('when a stored refinement answer could hide a root-fragment input', () => {
      const operation = createOperationDescriptor(ActorNameQuery, {});
      const environment = warmEnvironment(
        operation,
        normalizeCold(operation, {
          me: {__isActor: 'User', id: '4', name: 'Zuck'},
        }),
      );
      environment.commitPayload(
        createOperationDescriptor(ClientOnlyActorQuery, {id: '4'}),
        {node: {__typename: 'User', id: '4'}},
      );

      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'abstract_refinement',
      });
    });

    // The module's operation is not inspected, so a module anywhere the walk
    // reaches counts as S2C work.
    it('when the store cannot load an operation the operation reaches through a module', () => {
      const operation = createOperationDescriptor(ModuleQuery, {});
      const cold = normalizeCold(operation, MODULE_DATA);
      const environment = createEnvironmentWithLoader({
        get: () => null,
        load: () => Promise.resolve(null),
      });
      warm(environment.getStore(), operation, cold);

      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
    });

    // With every S2C site pruned, planning has nothing to do, so availability
    // is what reports a cold store.
    it('when the operation is missing and every S2C site is pruned', () => {
      const operation = createOperationDescriptor(ConditionQuery, {
        withS2C: false,
      });

      expect(checkS2C(createEnvironment(), operation)).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
    });

    it('when a server field the operation selects is missing', () => {
      const operation = createOperationDescriptor(ConditionQuery, {
        withS2C: true,
      });
      // Written by an operation that never selected `name`.
      const environment = warmEnvironment(
        createOperationDescriptor(ScalarQuery, {}),
        normalizeCold(createOperationDescriptor(ScalarQuery, {}), {
          me: {id: '4'},
        }),
      );

      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
    });

    it('when a record the operation reads was invalidated', () => {
      const operation = createOperationDescriptor(ScalarQuery, {});
      const environment = warmEnvironment(
        operation,
        normalizeCold(operation, {me: {id: '4'}}),
      );
      environment.commitUpdate(store => {
        nullthrows(store.get('4')).invalidateRecord();
      });

      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'stale',
      });
    });

    it('when the operation is missing', () => {
      const operation = createOperationDescriptor(ScalarQuery, {});

      expect(createEnvironment().check(operation)).toEqual({status: 'missing'});
    });

    it('when the operation is stale', () => {
      const operation = createOperationDescriptor(ScalarQuery, {});
      const environment = warmEnvironment(
        operation,
        normalizeCold(operation, {me: {id: '4'}}),
      );
      environment.commitUpdate(store => {
        store.invalidateStore();
      });

      expect(checkS2C(environment, operation)).toEqual({
        kind: 'incomplete',
        reason: 'stale',
      });
    });

    it('when the store cannot decide a refinement the operation reads', () => {
      const operation = createOperationDescriptor(AbstractQuery, {id: '4'});
      const records = RelayRecordSource.create(
        normalizeCold(operation, {
          node: {__isNamed: 'User', __typename: 'User', id: '4', name: 'Zuck'},
        }).source.toJSON(),
      );
      // The refinement can no longer be decided.
      records.remove(generateTypeID('User'));

      expect(
        checkS2C(createEnvironment(new RelayModernStore(records)), operation),
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });
  });

  // Hand-built ASTs in the compiler's shapes, for rules no compiled fixture
  // reaches: S2C root fragments may select only identity, `@UNSTABLE_key` and
  // magic-fragment fields, and `@as_actor` is off in this project.
  describe('on shapes only a hand-built AST reaches', () => {
    const ID: NormalizationScalarField = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'id',
      storageKey: null,
    };
    const NAME: NormalizationScalarField = {
      alias: null,
      args: null,
      kind: 'ScalarField',
      name: 'name',
      storageKey: null,
    };

    function s2cResolver(
      rootFragmentSelections: ReadonlyArray<NormalizationSelection>,
    ): NormalizationResolverField {
      return {
        args: null,
        isOutputType: true,
        kind: 'RelayResolver',
        name: 'hand_built_s2c',
        resolverInfo: {
          resolverFunction: () => null,
          rootFragment: {
            kind: 'SplitOperation',
            metadata: {hasServerField: true},
            name: 'DataCheckerExecTimeS2CTestHandBuilt$normalization',
            selections: rootFragmentSelections,
          },
        },
        storageKey: null,
      };
    }

    function link(
      name: string,
      selections: ReadonlyArray<NormalizationSelection>,
    ): NormalizationLinkedField {
      return {
        alias: null,
        args: null,
        concreteType: 'User',
        kind: 'LinkedField',
        name,
        plural: false,
        selections,
        storageKey: null,
      };
    }

    // What the exec-time network layer combines: `check()` decides the
    // operation's availability, and the work is collected only when it is
    // available.
    function checkOperation(
      selections: ReadonlyArray<NormalizationSelection>,
      moduleOperation?: NormalizationSplitOperation,
      records: RecordSourceJSON = RECORDS,
    ): Readonly<{
      execTimeS2C: ?ExecTimeS2CWork,
      status: Availability['status'],
    }> {
      const source = RelayRecordSource.create(records);
      const selector = {
        dataID: ROOT_ID,
        node: handBuiltOperation(selections),
        variables: {},
      };
      const operationLoader = {
        get: () => moduleOperation,
        load: () => Promise.resolve(moduleOperation),
      };
      const {status} = DataChecker.check(
        () => source,
        () => source,
        INTERNAL_ACTOR_IDENTIFIER_DO_NOT_USE,
        selector,
        [],
        operationLoader,
        defaultGetDataID,
        null,
        true,
      );
      return {
        execTimeS2C:
          status === 'available'
            ? ExecTimeS2CDataChecker.check(source, selector, operationLoader)
            : null,
        status,
      };
    }

    function handBuiltOperation(
      selections: ReadonlyArray<NormalizationSelection>,
    ): NormalizationOperation {
      return {
        argumentDefinitions: [],
        has_server_to_client_resolvers: true,
        kind: 'Operation',
        name: 'DataCheckerExecTimeS2CTestHandBuiltQuery',
        selections,
        use_exec_time_resolvers: true,
      };
    }

    // `me` is User 4, whose best friend is User 5, also reached through an
    // actor change as `actor_friend`. Its `Document` module resolves to
    // `moduleOperation`.
    const RECORDS: RecordSourceJSON = {
      '4': {
        __id: '4',
        __module_operation_Document: 'Document$normalization',
        __typename: 'User',
        actor_friend: {__actorIdentifier: 'actor:5', __ref: '5'},
        best_friend: {__ref: '5'},
        id: '4',
        name: 'Zuck',
      },
      '5': {__id: '5', __typename: 'User', id: '5'},
      [ROOT_ID]: {__id: ROOT_ID, __typename: ROOT_TYPE, me: {__ref: '4'}},
    };

    function checkMe(
      meSelections: ReadonlyArray<NormalizationSelection>,
      moduleOperation?: NormalizationSplitOperation,
    ): ?ExecTimeS2CWork {
      return checkOperation([link('me', meSelections)], moduleOperation)
        .execTimeS2C;
    }

    const MODULE: NormalizationSelection = {
      documentName: 'Document',
      fragmentName: 'Fragment',
      fragmentPropName: 'fragment',
      kind: 'ModuleImport',
    };

    function splitOperation(
      selections: ReadonlyArray<NormalizationSelection>,
    ): NormalizationSplitOperation {
      return {
        kind: 'SplitOperation',
        metadata: {},
        name: 'Document$normalization',
        selections,
      };
    }

    it('matches a concrete refinement at the root, as the normalizer does', () => {
      const onQuery = (
        selections: ReadonlyArray<NormalizationSelection>,
      ): NormalizationSelection => ({
        abstractKey: null,
        kind: 'InlineFragment',
        selections,
        type: 'Query',
      });
      const executions = expectCompleteWork(
        checkOperation([
          onQuery([s2cResolver([])]),
          {
            if: null,
            kind: 'Defer',
            label: 'DataCheckerExecTimeS2CTestHandBuilt$defer',
            selections: [onQuery([s2cResolver([])])],
          },
          {
            args: null,
            fragment: splitOperation([onQuery([s2cResolver([])])]),
            kind: 'FragmentSpread',
          },
          onQuery([onQuery([s2cResolver([])])]),
        ]).execTimeS2C,
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: ROOT_ID, typeName: ROOT_TYPE},
      ]);
      expect(executions[0].selections).toHaveLength(4);
    });

    it('matches a concrete refinement below the root only by type', () => {
      const executions = expectCompleteWork(
        checkMe([
          ID,
          {
            abstractKey: null,
            kind: 'InlineFragment',
            selections: [s2cResolver([ID])],
            type: 'Page',
          },
          s2cResolver([ID]),
        ]),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expect(executions[0].selections).toHaveLength(1);
    });

    it('leaves out a module in a client extension, as a response fills none', () => {
      const executions = expectCompleteWork(
        checkMe(
          [
            ID,
            {kind: 'ClientExtension', selections: [MODULE]},
            s2cResolver([ID]),
          ],
          splitOperation([s2cResolver([ID])]),
        ),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
      expect(executions[0].selections).toHaveLength(1);
    });

    it("reads a root fragment's concrete refinement on the root record, as the normalizer does", () => {
      expect(
        checkOperation([
          {
            kind: 'ClientExtension',
            selections: [
              s2cResolver([
                {
                  abstractKey: null,
                  kind: 'InlineFragment',
                  selections: [NAME],
                  type: 'Query',
                },
              ]),
            ],
          },
        ]).execTimeS2C,
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    it("checks a root fragment's refinement with only client fields below it", () => {
      expect(
        checkMe([
          ID,
          {
            kind: 'ClientExtension',
            selections: [
              s2cResolver([
                {
                  abstractKey: '__isDataCheckerExecTimeS2CActor',
                  kind: 'InlineFragment',
                  selections: [{kind: 'ClientExtension', selections: [NAME]}],
                  type: 'DataCheckerExecTimeS2CActor',
                },
              ]),
            ],
          },
        ]),
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    it("reads a root fragment's refinement on the root record after reading it below", () => {
      const resolver = s2cResolver([
        {
          abstractKey: null,
          kind: 'InlineFragment',
          selections: [NAME],
          type: 'Query',
        },
      ]);
      const nestedQueryID = 'client:root:nested_query';
      expect(
        checkOperation(
          [
            {
              ...link('nested_query', [
                {kind: 'ClientExtension', selections: [resolver]},
              ]),
              concreteType: 'Query',
            },
            {kind: 'ClientExtension', selections: [resolver]},
          ],
          undefined,
          {
            ...RECORDS,
            [nestedQueryID]: {
              __id: nestedQueryID,
              __typename: 'Query',
              name: 'Q',
            },
            [ROOT_ID]: {
              ...RECORDS[ROOT_ID],
              nested_query: {__ref: nestedQueryID},
            },
          },
        ).execTimeS2C,
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    it('checks a root-fragment link with only client fields below it', () => {
      expect(
        checkMe([
          link('best_friend', [
            ID,
            {
              kind: 'ClientExtension',
              selections: [
                s2cResolver([
                  link('best_friend', [
                    {kind: 'ClientExtension', selections: [NAME]},
                  ]),
                ]),
              ],
            },
          ]),
        ]),
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    it('follows server links in a root fragment under a client extension', () => {
      const executions = expectCompleteWork(
        checkMe([
          ID,
          {
            kind: 'ClientExtension',
            selections: [
              s2cResolver([ID, link('best_friend', [ID, s2cResolver([ID])])]),
            ],
          },
        ]),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '5', typeName: 'User'},
        {recordID: '4', typeName: 'User'},
      ]);
    });

    // `check()` can call this operation available when a missing-field handler
    // answers `missing_friend`.
    it('is incomplete when a link on the way to the work is missing, whatever follows it', () => {
      expect(
        ExecTimeS2CDataChecker.check(
          RelayRecordSource.create(RECORDS),
          {
            dataID: ROOT_ID,
            node: handBuiltOperation([
              link('me', [
                ID,
                link('missing_friend', [ID, s2cResolver([ID])]),
                s2cResolver([ID]),
              ]),
            ]),
            variables: {},
          },
          null,
        ),
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    // Until an exec-time run commits its client abstract types, the store
    // cannot decide this refinement; a miss in a client extension never counts.
    it('does not count a miss in a client extension against the work after it', () => {
      const executions = expectCompleteWork(
        checkMe([
          ID,
          {
            kind: 'ClientExtension',
            selections: [
              {
                abstractKey: '__isIDataCheckerExecTimeS2CClientThing',
                kind: 'InlineFragment',
                selections: [s2cResolver([ID])],
                type: 'IDataCheckerExecTimeS2CClientThing',
              },
              s2cResolver([ID]),
            ],
          },
        ]),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    it('follows no link in a client extension, under @defer, a refinement or fragment too', () => {
      const behindClientLink = link('best_friend', [ID, s2cResolver([ID])]);
      const executions = expectCompleteWork(
        checkMe([
          ID,
          {
            kind: 'ClientExtension',
            selections: [
              {
                if: null,
                kind: 'Defer',
                label: 'DataCheckerExecTimeS2CTestHandBuilt$clientDefer',
                selections: [behindClientLink],
              },
              {
                abstractKey: null,
                kind: 'InlineFragment',
                selections: [behindClientLink],
                type: 'User',
              },
              {
                args: null,
                fragment: splitOperation([behindClientLink]),
                kind: 'FragmentSpread',
              },
            ],
          },
          s2cResolver([ID]),
        ]),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    it('does not count a missing client field before the work in a client extension', () => {
      const executions = expectCompleteWork(
        checkMe([
          ID,
          {
            kind: 'ClientExtension',
            selections: [{...NAME, name: 'client_nickname'}, s2cResolver([ID])],
          },
        ]),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    // `check()` judges the rest of the operation, here with a missing-field
    // handler or an optimistic update standing in for these fields.
    it('reads nothing off the way to the work', () => {
      const executions = expectCompleteWork(
        ExecTimeS2CDataChecker.check(
          RelayRecordSource.create(RECORDS),
          {
            dataID: ROOT_ID,
            node: handBuiltOperation([
              link('me', [
                ID,
                {...NAME, name: 'nickname'},
                link('missing_friend', [ID]),
                s2cResolver([ID]),
              ]),
            ]),
            variables: {},
          },
          null,
        ),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    it("reads nothing off the way to the work in a module's operation", () => {
      const moduleOperation = splitOperation([
        {...NAME, name: 'nickname'},
        s2cResolver([ID]),
      ]);
      const executions = expectCompleteWork(
        ExecTimeS2CDataChecker.check(
          RelayRecordSource.create(RECORDS),
          {
            dataID: ROOT_ID,
            node: handBuiltOperation([link('me', [ID, MODULE])]),
            variables: {},
          },
          {
            get: () => moduleOperation,
            load: () => Promise.resolve(moduleOperation),
          },
        ),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    it('counts a missing root-fragment input under a client extension', () => {
      expect(
        checkMe([
          ID,
          {
            kind: 'ClientExtension',
            selections: [s2cResolver([ID, {...NAME, name: 'nickname'}])],
          },
        ]),
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    it("when the store cannot decide a root fragment's type discriminator", () => {
      expect(
        checkMe([
          ID,
          s2cResolver([
            ID,
            {abstractKey: '__isActor', kind: 'TypeDiscriminator'},
          ]),
        ]),
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    it("when the store cannot decide a root fragment's refinement", () => {
      expect(
        checkMe([
          ID,
          s2cResolver([
            ID,
            {
              abstractKey: '__isActor',
              kind: 'InlineFragment',
              selections: [NAME],
              type: 'Actor',
            },
          ]),
        ]),
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    it('when a record a root fragment links to is missing', () => {
      expect(
        checkOperation(
          [link('me', [ID, s2cResolver([link('best_friend', [ID])])])],
          undefined,
          {...RECORDS, '4': {...RECORDS['4'], best_friend: {__ref: '6'}}},
        ).execTimeS2C,
      ).toEqual({kind: 'incomplete', reason: 'missing'});
    });

    it("checks a root fragment's deferred selection like any other", () => {
      const deferred = (field: NormalizationScalarField) =>
        s2cResolver([
          ID,
          {
            if: null,
            kind: 'Defer',
            label: 'DataCheckerExecTimeS2CTestHandBuilt$defer',
            selections: [field],
          },
        ]);

      expect(
        recordsOf(expectCompleteWork(checkMe([ID, deferred(NAME)]))),
      ).toEqual([{recordID: '4', typeName: 'User'}]);
      expect(checkMe([ID, deferred({...NAME, name: 'nickname'})])).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
    });

    it('checks a root fragment in its own variables', () => {
      const resolver: NormalizationResolverField = {
        args: [{kind: 'Literal', name: 'withNickname', value: true}],
        isOutputType: true,
        kind: 'RelayResolver',
        name: 'hand_built_s2c',
        resolverInfo: {
          resolverFunction: () => null,
          rootFragment: {
            argumentDefinitions: [
              {
                defaultValue: false,
                kind: 'LocalArgument',
                name: 'withNickname',
              },
            ],
            kind: 'SplitOperation',
            metadata: {hasServerField: true},
            name: 'DataCheckerExecTimeS2CTestHandBuiltScoped$normalization',
            selections: [
              {
                condition: 'withNickname',
                kind: 'Condition',
                passingValue: true,
                selections: [{...NAME, name: 'nickname'}],
              },
            ],
          },
        },
        storageKey: null,
      };

      // `nickname` is not in the store, and only the root fragment's own
      // `withNickname` asks for it. That decides the work, not the
      // operation's availability.
      const availability = checkOperation([link('me', [ID, resolver])]);
      expect(availability.status).toBe('available');
      expect(availability.execTimeS2C).toEqual({
        kind: 'incomplete',
        reason: 'missing',
      });
    });

    it('collects inside a module, as its payload would bring it', () => {
      const executions = expectCompleteWork(
        checkMe([ID, MODULE], splitOperation([ID, s2cResolver([ID])])),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    it("matches a concrete refinement in a module's operation only by type", () => {
      const executions = expectCompleteWork(
        checkMe(
          [ID, MODULE],
          splitOperation([
            {
              abstractKey: null,
              kind: 'InlineFragment',
              selections: [s2cResolver([ID])],
              type: 'Page',
            },
          ]),
        ),
      );

      expect(executions).toEqual([]);
    });

    it('is complete when a module holds no S2C work', () => {
      const executions = expectCompleteWork(
        checkMe([ID, MODULE, s2cResolver([ID])], splitOperation([NAME])),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    // A response delivers an actor change to that actor's environment.
    it('collects nothing behind an actor change', () => {
      const executions = expectCompleteWork(
        checkMe([
          ID,
          {
            kind: 'ActorChange',
            linkedField: link('actor_friend', [ID, s2cResolver([ID])]),
          },
        ]),
      );

      expect(executions).toEqual([]);
    });

    it('is complete when an actor change holds no S2C work', () => {
      const executions = expectCompleteWork(
        checkMe([
          ID,
          {kind: 'ActorChange', linkedField: link('actor_friend', [ID])},
          s2cResolver([ID]),
        ]),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    it('is complete when a deferred fragment before the work holds none', () => {
      const executions = expectCompleteWork(
        checkMe([
          ID,
          {
            if: null,
            kind: 'Defer',
            label: 'DataCheckerExecTimeS2CTestHandBuilt$defer',
            selections: [NAME],
          },
          s2cResolver([ID]),
        ]),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
      ]);
    });

    it('collects a fragment spread twice with different arguments once per set of arguments', () => {
      // Only a fragment spread reaches one AST under two sets of variables; the
      // compiler inlines every other spread with its arguments substituted.
      const fragment = {
        argumentDefinitions: [
          {defaultValue: null, kind: 'LocalArgument', name: 'withS2C'},
        ],
        kind: 'SplitOperation',
        metadata: {},
        name: 'DataCheckerExecTimeS2CTestSpreadTwice$normalization',
        selections: [
          {
            abstractKey: null,
            kind: 'InlineFragment',
            selections: [
              {
                condition: 'withS2C',
                kind: 'Condition',
                passingValue: true,
                selections: [s2cResolver([ID])],
              },
            ],
            type: 'User',
          },
        ],
      } as const;
      const spread = (withS2C: boolean) =>
        ({
          args: [{kind: 'Literal', name: 'withS2C', value: withS2C}],
          fragment,
          kind: 'FragmentSpread',
        }) as const;

      const executions = expectCompleteWork(
        checkMe([
          ID,
          s2cResolver([ID]),
          spread(false),
          link('best_friend', [ID, spread(true)]),
        ]),
      );

      expect(recordsOf(executions)).toEqual([
        {recordID: '4', typeName: 'User'},
        {recordID: '5', typeName: 'User'},
      ]);
    });
  });
});
