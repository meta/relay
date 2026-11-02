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

import type {IEnvironment, RequestDescriptor} from '../store/RelayStoreTypes';
import type {ReaderFragment} from './ReaderNode';

const {getPromiseForActiveRequest} = require('../query/fetchQueryInternal');
const RelayFeatureFlags = require('./RelayFeatureFlags');

function getPendingOperationsForFragment(
  environment: IEnvironment,
  fragmentNode: ReaderFragment,
  fragmentOwner: RequestDescriptor,
): {
  promise: Promise<void>,
  pendingOperations: ReadonlyArray<RequestDescriptor>,
} | null {
  let pendingOperations: ReadonlyArray<RequestDescriptor> = [];
  let promise = getPromiseForActiveRequest(environment, fragmentOwner);

  if (promise != null) {
    pendingOperations = [fragmentOwner];
  } else {
    const operationTracker = environment.getOperationTracker();
    const result =
      operationTracker.getPendingOperationsAffectingOwner(fragmentOwner);

    pendingOperations = result?.pendingOperations ?? [];
    promise = result?.promise ?? null;
  }

  if (
    promise == null &&
    RelayFeatureFlags.ENABLE_IN_FLIGHT_OPERATION_CORRELATION
  ) {
    const inFlightPromise = environment.getPromiseForInFlightOperation(
      fragmentOwner.identifier,
    );
    if (inFlightPromise != null) {
      promise = inFlightPromise;
      pendingOperations = [fragmentOwner];
    }
  }

  if (!promise) {
    return null;
  }

  let pendingOperationName =
    pendingOperations?.map(op => op.node.params.name).join(',') ?? null;
  if (pendingOperationName == null || pendingOperationName.length === 0) {
    pendingOperationName = 'Unknown pending operation';
  }
  const fragmentName = fragmentNode.name;
  const promiseDisplayName =
    pendingOperationName === fragmentName
      ? `Relay(${pendingOperationName})`
      : `Relay(${pendingOperationName}:${fragmentName})`;
  // $FlowExpectedError[prop-missing] Expando to annotate Promises.
  promise.displayName = promiseDisplayName;

  // In order to monitor the efficacy of RelayOperationTracker, we log
  // enough information to track whether we are suspending on the fragment
  // owner's operation, or some other operation.
  environment.__log({
    name: 'pendingoperation.found',
    fragment: fragmentNode,
    fragmentOwner,
    pendingOperations,
  });
  return {promise, pendingOperations};
}

module.exports = getPendingOperationsForFragment;
