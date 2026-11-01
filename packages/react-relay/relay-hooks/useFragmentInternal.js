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

import type {FragmentQueryOptions} from './useFragmentInternal_EXPERIMENTAL';
import type {ReaderFragment, SelectorData} from 'relay-runtime';

import useFragmentInternal_CURRENT from './useFragmentInternal_CURRENT';
import useFragmentInternal_EXPERIMENTAL from './useFragmentInternal_EXPERIMENTAL';
import {RelayFeatureFlags} from 'relay-runtime';

hook useFragmentInternal(
  fragmentNode: ReaderFragment,
  fragmentRef: unknown,
  hookDisplayName: string,
  queryOptions?: FragmentQueryOptions,
): ?SelectorData | Array<?SelectorData> {
  if (RelayFeatureFlags.ENABLE_ACTIVITY_COMPATIBILITY) {
    // $FlowFixMe[react-rule-hook-conditional] - the condition is static
    return useFragmentInternal_EXPERIMENTAL(
      fragmentNode,
      fragmentRef,
      hookDisplayName,
      queryOptions,
    );
  }
  // $FlowFixMe[react-rule-hook-conditional] - the condition is static
  return useFragmentInternal_CURRENT(
    fragmentNode,
    fragmentRef,
    hookDisplayName,
    queryOptions,
  );
}

module.exports = useFragmentInternal;
