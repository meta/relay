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

/* global jest */

import type {IEnvironment} from '../relay-runtime';
import type {OperationDescriptor} from '../relay-runtime/store/RelayStoreTypes';

/**
 * Takes an environment and augments it with a mock implementation of `retain`
 * that tracks what operations are currently retained. Also returns the Jest mock
 * `release` function for backwards-compatibility with existing tests, but you
 * should use `isOperationRetained` for new tests as it is much less error-prone.
 */
function trackRetentionForEnvironment(environment: IEnvironment): {
  release_DEPRECATED: JestMockFn<[unknown], void>,
  isOperationRetained: (v: OperationDescriptor) => boolean,
} {
  const retainCountsByOperation = new Map<unknown, number>();

  const release = jest.fn((id: unknown) => {
    const existing = retainCountsByOperation.get(id) ?? NaN;
    if (existing === 1) {
      retainCountsByOperation.delete(id);
    } else {
      retainCountsByOperation.set(id, existing - 1);
    }
  });

  // $FlowFixMe[cannot-write] safe to do for mocking
  // $FlowFixMe[missing-local-annot] error found when enabling Flow LTI mode
  environment.retain = jest.fn(operation => {
    const id = operation.request.identifier;
    const existing = retainCountsByOperation.get(id) ?? 0;
    retainCountsByOperation.set(id, existing + 1);
    let released = false;
    return {
      dispose: () => {
        if (!released) {
          release(id);
        }
        released = true;
      },
    };
  });

  function isOperationRetained(operation: OperationDescriptor) {
    const id = operation.request.identifier;
    return (retainCountsByOperation.get(id) ?? 0) > 0;
  }

  return {release_DEPRECATED: release, isOperationRetained};
}

module.exports = trackRetentionForEnvironment;
