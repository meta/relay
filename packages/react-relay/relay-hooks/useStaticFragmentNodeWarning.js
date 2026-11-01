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

const useUnsafeRef_DEPRECATED = require('./useUnsafeRef_DEPRECATED');
const warning = require('warning');

hook useStaticFragmentNodeWarning(
  fragmentNode: ReaderFragment,
  warningContext: string,
): void {
  if (__DEV__) {
    // This is calling `useRef` conditionally, but based on the environment
    // __DEV__ setting which shouldn't change. This allows us to only pay the
    // cost of `useRef` in development mode to produce the warning.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // $FlowFixMe[react-rule-hook-conditional]
    const initialPropRef = useUnsafeRef_DEPRECATED(fragmentNode.name);
    warning(
      // $FlowFixMe[react-rule-unsafe-ref]
      initialPropRef.current === fragmentNode.name,
      'Relay: The %s has to remain the same over the lifetime of a component. ' +
        'Changing it is not supported and will result in unexpected behavior.',
      warningContext,
    );
  }
}

module.exports = useStaticFragmentNodeWarning;
