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

import type {ReaderFragment} from 'relay-runtime';

/**
 * When `@catch` is applied to a fragment's root, the reader wraps the fragment
 * data in a `Result` envelope (`{ok: true, value} | {ok: false, errors}`).
 * Internal hook code (pagination, refetch) needs to read the underlying value
 * to find the connection / identifier fields. The user-facing fragment data
 * remains wrapped.
 */
function getFragmentInternalData(
  fragmentNode: ReaderFragment,
  fragmentData: unknown,
): unknown {
  if (fragmentNode.metadata?.catchTo !== 'RESULT') {
    return fragmentData;
  }
  if (fragmentData == null || typeof fragmentData !== 'object') {
    return fragmentData;
  }
  return fragmentData.ok === true ? fragmentData.value : null;
}

module.exports = getFragmentInternalData;
