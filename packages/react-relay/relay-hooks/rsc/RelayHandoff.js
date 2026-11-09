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

import type {
  DataID,
  NormalizationSplitOperation,
  Variables,
} from 'relay-runtime';

/**
 * The data of one client fragment root that a server component hands to a
 * client component, carried on the fragment reference as `__handoff`. The
 * records are Relay Store record JSON: exactly the fields the client
 * fragment's normalization selects under `dataID`, with `variables` (the
 * fragment's arguments and the operation variables it reads). `next`
 * resolves with the records that later payloads (`@defer`, `@stream`) add or
 * change, and with `null` once the server query is complete. A list that
 * only grew is sent as `{__refsAppend, __refsAppendFrom}`.
 *
 * Several server queries of one request write one server Store, so the roots
 * they hand off can carry the same fields. `sequence` orders the records of
 * the handoff and of each chunk among all of the request's writes (those of
 * `serverStore`), so that the client applies the newest value of each field
 * whatever order its readers render in.
 */
export type RelayHandoffRecords = {
  readonly [dataID: DataID]: {readonly [storageKey: string]: unknown},
};

export type RelayHandoffChunk = {
  readonly records: RelayHandoffRecords,
  readonly sequence: number,
  readonly next: Promise<?RelayHandoffChunk>,
};

export type RelayHandoff = {
  readonly id: string,
  readonly dataID: DataID,
  readonly fragment: NormalizationSplitOperation,
  readonly variables: Variables,
  readonly records: RelayHandoffRecords,
  readonly next: Promise<?RelayHandoffChunk>,
  readonly serverStore: string,
  readonly sequence: number,
};

declare function getRelayHandoff(fragmentRef: unknown): ?RelayHandoff;

/**
 * The handoff a fragment reference carries, if any (see RelayServerHandoff).
 */
function getRelayHandoff(fragmentRef: unknown): unknown {
  if (fragmentRef == null || typeof fragmentRef !== 'object') {
    return null;
  }
  const handoff = fragmentRef.__handoff;
  if (handoff == null || typeof handoff !== 'object') {
    return null;
  }
  if (
    typeof handoff.id !== 'string' ||
    typeof handoff.dataID !== 'string' ||
    handoff.fragment == null ||
    handoff.variables == null ||
    handoff.records == null ||
    handoff.next == null
  ) {
    throw new Error(
      'Relay: A fragment reference carries a handoff this version of Relay ' +
        'cannot read.',
    );
  }
  return handoff;
}

module.exports = {getRelayHandoff};
