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
  HandleFieldPayload,
  Handler,
  RecordProxy,
  RecordSourceProxy,
} from '../../store/RelayStoreTypes';

const ConnectionHandler = require('./ConnectionHandler');
const ConnectionInterface = require('./ConnectionInterface');
const invariant = require('invariant');
const warning = require('warning');

const DeleteRecordHandler = {
  update: (store: RecordSourceProxy, payload: HandleFieldPayload) => {
    const record = store.get(payload.dataID);

    if (record != null) {
      const idOrIds = record.getValue(payload.fieldKey);

      if (typeof idOrIds === 'string') {
        store.delete(idOrIds);
      } else if (Array.isArray(idOrIds)) {
        idOrIds.forEach(id => {
          if (typeof id === 'string') {
            store.delete(id);
          }
        });
      }
    }
  },
};

const DeleteEdgeHandler = {
  update: (store: RecordSourceProxy, payload: HandleFieldPayload) => {
    const record = store.get(payload.dataID);
    if (record == null) {
      return;
    }
    const {connections} = payload.handleArgs;
    invariant(
      connections != null,
      'MutationHandlers: Expected connection IDs to be specified.',
    );
    const idOrIds = record.getValue(payload.fieldKey);
    const idList = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    idList.forEach(id => {
      if (typeof id === 'string') {
        for (const connectionID of connections) {
          const connection = store.get(connectionID);
          if (connection == null) {
            warning(
              false,
              "[Relay] The connection with id `%s` doesn't exist.",
              connectionID,
            );
            continue;
          }
          ConnectionHandler.deleteNode(connection, id);
        }
      }
    });
  },
};

const AppendEdgeHandler: Handler = {
  update: edgeUpdater(ConnectionHandler.insertEdgeAfter),
};

const PrependEdgeHandler: Handler = {
  update: edgeUpdater(ConnectionHandler.insertEdgeBefore),
};

const AppendNodeHandler: Handler = {
  update: nodeUpdater(ConnectionHandler.insertEdgeAfter),
};

const PrependNodeHandler: Handler = {
  update: nodeUpdater(ConnectionHandler.insertEdgeBefore),
};

function edgeUpdater(
  insertFn: (v0: RecordProxy, v1: RecordProxy, v2: ?string) => void,
): (v0: RecordSourceProxy, v1: HandleFieldPayload) => void {
  return (store: RecordSourceProxy, payload: HandleFieldPayload) => {
    const record = store.get(payload.dataID);
    if (record == null) {
      return;
    }
    const {connections} = payload.handleArgs;
    invariant(
      connections != null,
      'MutationHandlers: Expected connection IDs to be specified.',
    );
    let singleServerEdge, serverEdges;
    try {
      singleServerEdge = record.getLinkedRecord(payload.fieldKey);
    } catch {}
    if (!singleServerEdge) {
      try {
        serverEdges = record.getLinkedRecords(payload.fieldKey);
      } catch {}
    }
    if (singleServerEdge == null && serverEdges == null) {
      warning(
        false,
        'MutationHandlers: Expected the server edge to be non-null.',
      );
      return;
    }
    const {NODE, EDGES} = ConnectionInterface.get();
    const serverEdgeList = serverEdges ?? [singleServerEdge];
    for (const serverEdge of serverEdgeList) {
      if (serverEdge == null) {
        continue;
      }
      const serverNode = serverEdge.getLinkedRecord('node');
      if (!serverNode) {
        continue;
      }
      const serverNodeId = serverNode.getDataID();
      for (const connectionID of connections) {
        const connection = store.get(connectionID);
        if (connection == null) {
          warning(
            false,
            "[Relay] The connection with id `%s` doesn't exist.",
            connectionID,
          );
          continue;
        }
        const nodeAlreadyExistsInConnection = connection
          .getLinkedRecords(EDGES)
          ?.some(
            edge => edge?.getLinkedRecord(NODE)?.getDataID() === serverNodeId,
          );
        if (nodeAlreadyExistsInConnection) {
          continue;
        }
        const clientEdge = ConnectionHandler.buildConnectionEdge(
          store,
          connection,
          serverEdge,
        );
        invariant(
          clientEdge != null,
          'MutationHandlers: Failed to build the edge.',
        );
        insertFn(connection, clientEdge);
      }
    }
  };
}

function nodeUpdater(
  insertFn: (v0: RecordProxy, v1: RecordProxy, v2: ?string) => void,
): (v0: RecordSourceProxy, v1: HandleFieldPayload) => void {
  return (store: RecordSourceProxy, payload: HandleFieldPayload) => {
    const record = store.get(payload.dataID);
    if (record == null) {
      return;
    }
    const {connections, edgeTypeName} = payload.handleArgs;
    invariant(
      connections != null,
      'MutationHandlers: Expected connection IDs to be specified.',
    );
    invariant(
      edgeTypeName != null,
      'MutationHandlers: Expected edge typename to be specified.',
    );
    let singleServerNode;
    let serverNodes;
    try {
      singleServerNode = record.getLinkedRecord(payload.fieldKey);
    } catch {}
    if (!singleServerNode) {
      try {
        serverNodes = record.getLinkedRecords(payload.fieldKey);
      } catch {}
    }
    if (singleServerNode == null && serverNodes == null) {
      warning(false, 'MutationHandlers: Expected target node to exist.');
      return;
    }
    const {NODE, EDGES} = ConnectionInterface.get();
    const serverNodeList = serverNodes ?? [singleServerNode];
    for (const serverNode of serverNodeList) {
      if (serverNode == null) {
        continue;
      }
      const serverNodeId = serverNode.getDataID();
      for (const connectionID of connections) {
        const connection = store.get(connectionID);
        if (connection == null) {
          warning(
            false,
            "[Relay] The connection with id `%s` doesn't exist.",
            connectionID,
          );
          continue;
        }
        const nodeAlreadyExistsInConnection = connection
          .getLinkedRecords(EDGES)
          ?.some(
            edge => edge?.getLinkedRecord(NODE)?.getDataID() === serverNodeId,
          );
        if (nodeAlreadyExistsInConnection) {
          continue;
        }
        const clientEdge = ConnectionHandler.createEdge(
          store,
          connection,
          serverNode,
          edgeTypeName,
        );
        invariant(
          clientEdge != null,
          'MutationHandlers: Failed to build the edge.',
        );
        insertFn(connection, clientEdge);
      }
    }
  };
}

module.exports = {
  AppendEdgeHandler,
  DeleteRecordHandler,
  PrependEdgeHandler,
  AppendNodeHandler,
  PrependNodeHandler,
  DeleteEdgeHandler,
};
