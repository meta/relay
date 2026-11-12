/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PreloadedQueryRef } from './rsc_EXPERIMENTAL';
import {GraphQLTaggedNode, IEnvironment, OperationType} from 'relay-runtime';

export function useQueryFromServer<T extends OperationType>(
    query: GraphQLTaggedNode,
    queryRef: PreloadedQueryRef<T['variables'], T['response']>,
    options?: { staleThresholdMs?: number },
): T['response'];

/**
 * Makes `useFragment` read, from `environment`, the fragment references that
 * server components hand client components. Call it once per Environment,
 * before a fragment is first read from it; it throws otherwise.
 */
export function installRelayHandoff(environment: IEnvironment): void;

export { PreloadedQueryRef };
