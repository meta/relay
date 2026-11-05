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
  MutationParameters,
  RecordSourceSelectorProxy,
  SelectorStoreUpdater,
} from '../store/RelayStoreTypes';
import type {ConcreteRequest} from '../util/RelayConcreteNode';
import type {Variables} from '../util/RelayRuntimeTypes';
import type {RecordProxy} from 'relay-runtime/store/RelayStoreTypes';

const ConnectionHandler = require('../handlers/connection/ConnectionHandler');
const warning = require('warning');

const MutationTypes = Object.freeze({
  RANGE_ADD: 'RANGE_ADD',
  RANGE_DELETE: 'RANGE_DELETE',
  NODE_DELETE: 'NODE_DELETE',
});
export type MutationType = Values<typeof MutationTypes>;

const RangeOperations = Object.freeze({
  APPEND: 'append',
  PREPEND: 'prepend',
});
export type RangeOperation = Values<typeof RangeOperations>;

type RangeBehaviorsFunction = (connectionArgs: {
  [name: string]: unknown,
  ...
}) => RangeOperation;
type RangeBehaviorsObject = {[key: string]: RangeOperation, ...};
export type RangeBehaviors = RangeBehaviorsFunction | RangeBehaviorsObject;

type RangeAddConfig = {
  type: 'RANGE_ADD',
  parentName?: string,
  parentID?: string,
  connectionInfo?: Array<{
    key: string,
    filters?: Variables,
    rangeBehavior: string,
  }>,
  connectionName?: string,
  edgeName: string,
  rangeBehaviors?: RangeBehaviors,
};

type RangeDeleteConfig = {
  type: 'RANGE_DELETE',
  parentName?: string,
  parentID?: string,
  connectionKeys?: Array<{
    key: string,
    filters?: Variables,
  }>,
  connectionName?: string,
  deletedIDFieldName: string | Array<string>,
  pathToConnection: Array<string>,
};

type NodeDeleteConfig = {
  type: 'NODE_DELETE',
  parentName?: string,
  parentID?: string,
  connectionName?: string,
  deletedIDFieldName: string,
};

export type DeclarativeMutationConfig =
  RangeAddConfig | RangeDeleteConfig | NodeDeleteConfig;

function convert<TMutation extends MutationParameters>(
  configs: Array<DeclarativeMutationConfig>,
  request: ConcreteRequest,
  optimisticUpdater?: ?SelectorStoreUpdater<TMutation['response']>,
  updater?: ?SelectorStoreUpdater<TMutation['response']>,
): {
  optimisticUpdater: SelectorStoreUpdater<TMutation['response']>,
  updater: SelectorStoreUpdater<TMutation['response']>,
  ...
} {
  const configOptimisticUpdates: Array<
    SelectorStoreUpdater<TMutation['response']>,
  > = optimisticUpdater ? [optimisticUpdater] : [];
  const configUpdates: Array<SelectorStoreUpdater<TMutation['response']>> =
    updater ? [updater] : [];
  configs.forEach(config => {
    switch (config.type) {
      case 'NODE_DELETE':
        const nodeDeleteResult = nodeDelete(config, request);
        if (nodeDeleteResult) {
          configOptimisticUpdates.push(nodeDeleteResult);
          configUpdates.push(nodeDeleteResult);
        }
        break;
      case 'RANGE_ADD':
        const rangeAddResult = rangeAdd(config, request);
        if (rangeAddResult) {
          configOptimisticUpdates.push(rangeAddResult);
          configUpdates.push(rangeAddResult);
        }
        break;
      case 'RANGE_DELETE':
        const rangeDeleteResult = rangeDelete(config, request);
        if (rangeDeleteResult) {
          configOptimisticUpdates.push(rangeDeleteResult);
          configUpdates.push(rangeDeleteResult);
        }
        break;
    }
  });
  return {
    optimisticUpdater: (
      store: RecordSourceSelectorProxy,
      data: ?TMutation['response'],
    ) => {
      configOptimisticUpdates.forEach(eachOptimisticUpdater => {
        eachOptimisticUpdater(store, data);
      });
    },
    updater: (
      store: RecordSourceSelectorProxy,
      data: ?TMutation['response'],
    ) => {
      configUpdates.forEach(eachUpdater => {
        eachUpdater(store, data);
      });
    },
  };
}

function nodeDelete(
  config: NodeDeleteConfig,
  request: ConcreteRequest,
): ?SelectorStoreUpdater<unknown> {
  const {deletedIDFieldName} = config;
  const rootField = getRootField(request);
  if (!rootField) {
    return null;
  }
  return (store: RecordSourceSelectorProxy, data: ?unknown) => {
    const payload = store.getRootField(rootField);
    if (!payload) {
      return;
    }
    const deleteID = payload.getValue(deletedIDFieldName);
    const deleteIDs = Array.isArray(deleteID) ? deleteID : [deleteID];
    deleteIDs.forEach(id => {
      if (id && typeof id === 'string') {
        store.delete(id);
      }
    });
  };
}

function rangeAdd(
  config: RangeAddConfig,
  request: ConcreteRequest,
): ?SelectorStoreUpdater<unknown> {
  const {parentID, connectionInfo, edgeName} = config;
  if (!parentID) {
    warning(
      false,
      'RelayDeclarativeMutationConfig: For mutation config RANGE_ADD ' +
        'to work you must include a parentID',
    );
    return null;
  }
  const rootField = getRootField(request);
  if (!connectionInfo || !rootField) {
    return null;
  }
  return (store: RecordSourceSelectorProxy, data: ?unknown) => {
    const parent = store.get(parentID);
    if (!parent) {
      return;
    }
    const payload = store.getRootField(rootField);
    if (!payload) {
      return;
    }
    const serverEdge = payload.getLinkedRecord(edgeName);
    for (const info of connectionInfo) {
      if (!serverEdge) {
        continue;
      }
      const connection = ConnectionHandler.getConnection(
        parent,
        info.key,
        info.filters,
      );
      if (!connection) {
        continue;
      }
      const clientEdge = ConnectionHandler.buildConnectionEdge(
        store,
        connection,
        serverEdge,
      );
      if (!clientEdge) {
        continue;
      }
      switch (info.rangeBehavior) {
        case 'append':
          ConnectionHandler.insertEdgeAfter(connection, clientEdge);
          break;
        case 'prepend':
          ConnectionHandler.insertEdgeBefore(connection, clientEdge);
          break;
        default:
          warning(
            false,
            'RelayDeclarativeMutationConfig: RANGE_ADD range behavior `%s` ' +
              'will not work as expected in RelayModern, supported range ' +
              "behaviors are 'append', 'prepend'.",
            info.rangeBehavior,
          );
          break;
      }
    }
  };
}

function rangeDelete(
  config: RangeDeleteConfig,
  request: ConcreteRequest,
): ?SelectorStoreUpdater<unknown> {
  const {parentID, connectionKeys, pathToConnection, deletedIDFieldName} =
    config;
  if (!parentID) {
    warning(
      false,
      'RelayDeclarativeMutationConfig: For mutation config RANGE_DELETE ' +
        'to work you must include a parentID',
    );
    return null;
  }
  const rootField = getRootField(request);
  if (!rootField) {
    return null;
  }
  return (store: RecordSourceSelectorProxy, data: ?unknown) => {
    if (!data) {
      return;
    }
    const deleteIDs = [];
    // the type of data should come from a type parameter associated with ConcreteRequest,
    // but ConcreteRequest does not contain a type parameter. Hence, we use a FlowFixMe.
    // $FlowFixMe[incompatible-use] see above
    let deletedIDField = data[rootField];

    if (deletedIDField && Array.isArray(deletedIDFieldName)) {
      for (const eachField of deletedIDFieldName) {
        if (deletedIDField && typeof deletedIDField === 'object') {
          deletedIDField = deletedIDField[eachField];
        }
      }
      if (Array.isArray(deletedIDField)) {
        deletedIDField.forEach(idObject => {
          if (
            idObject &&
            idObject.id &&
            typeof idObject === 'object' &&
            typeof idObject.id === 'string'
          ) {
            deleteIDs.push(idObject.id);
          }
        });
      } else if (
        deletedIDField &&
        deletedIDField.id &&
        typeof deletedIDField.id === 'string'
      ) {
        deleteIDs.push(deletedIDField.id);
      }
    } else if (
      deletedIDField &&
      typeof deletedIDFieldName === 'string' &&
      typeof deletedIDField === 'object'
    ) {
      deletedIDField = deletedIDField[deletedIDFieldName];
      if (typeof deletedIDField === 'string') {
        deleteIDs.push(deletedIDField);
      } else if (Array.isArray(deletedIDField)) {
        deletedIDField.forEach(id => {
          if (typeof id === 'string') {
            deleteIDs.push(id);
          }
        });
      }
    }
    deleteNode(parentID, connectionKeys, pathToConnection, store, deleteIDs);
  };
}

function deleteNode(
  parentID: string,
  connectionKeys: ?Array<{
    key: string,
    filters?: Variables,
  }>,
  pathToConnection: Array<string>,
  store: RecordSourceSelectorProxy,
  deleteIDs: Array<string>,
): void {
  warning(
    connectionKeys != null,
    'RelayDeclarativeMutationConfig: RANGE_DELETE must provide a ' +
      'connectionKeys',
  );
  const parent = store.get(parentID);
  if (!parent) {
    return;
  }
  if (pathToConnection.length < 2) {
    warning(
      false,
      'RelayDeclarativeMutationConfig: RANGE_DELETE ' +
        'pathToConnection must include at least parent and connection',
    );
    return;
  }
  let recordProxy: ?RecordProxy = parent;
  for (let i = 1; i < pathToConnection.length - 1; i++) {
    if (recordProxy) {
      recordProxy = recordProxy.getLinkedRecord(pathToConnection[i]);
    }
  }
  // Should never enter loop except edge cases
  if (!connectionKeys || !recordProxy) {
    warning(
      false,
      'RelayDeclarativeMutationConfig: RANGE_DELETE ' +
        'pathToConnection is incorrect. Unable to find connection with ' +
        'parentID: %s and path: %s',
      parentID,
      pathToConnection.toString(),
    );
    return;
  }
  for (const key of connectionKeys) {
    const connection = ConnectionHandler.getConnection(
      recordProxy,
      key.key,
      key.filters,
    );
    if (connection) {
      deleteIDs.forEach(deleteID => {
        ConnectionHandler.deleteNode(connection, deleteID);
      });
    }
  }
}

function getRootField(request: ConcreteRequest): ?string {
  if (
    request.fragment.selections &&
    request.fragment.selections.length > 0 &&
    request.fragment.selections[0].kind === 'LinkedField'
  ) {
    return request.fragment.selections[0].name;
  }
  return null;
}

module.exports = {
  MutationTypes,
  RangeOperations,

  convert,
};
