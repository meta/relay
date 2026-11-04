/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The Relay RSC API a fixture's Server Components use, bound to the current
// request by the reference host (src/rsc/referenceHost.server.js), the way a
// framework adapter exports it to apps. `serverQuery` and `useServerFragment`
// call the methods of the same name on the server environment from
// `react-relay/rsc_EXPERIMENTAL`'s `createServerEnvironment`, and throw while
// it has none.

import type { GraphQLTaggedNode, OperationType } from "relay-runtime";
import type { KeyType, KeyTypeData } from "react-relay/ReactRelayTypes";

type ServerHost = {
  serverQuery(query: unknown, variables: unknown): Promise<unknown>;
  useServerFragment(fragment: unknown, fragmentRef: unknown): unknown;
  waitForGate(name: string): Promise<void>;
};

function getServerHost(): ServerHost {
  const host = (
    globalThis as { __RELAY_E2E_RSC_SERVER_HOST__?: ServerHost }
  ).__RELAY_E2E_RSC_SERVER_HOST__;
  if (host == null) {
    throw new Error(
      "serverQuery(), useServerFragment(), and waitForGate() run only on the RSC server.",
    );
  }
  return host;
}

/**
 * Resolves once the fixture's steps run `release "<name>"`. Server code (a
 * resolver in server.ts, or a Server Component) awaits it to hold back part
 * of a response, so a fixture can observe the state before it arrives.
 */
export function waitForGate(name: string): Promise<void> {
  return getServerHost().waitForGate(name);
}

/** Executes a query on the server and resolves to its data. */
export function serverQuery<TQuery extends OperationType>(
  query: GraphQLTaggedNode,
  variables: TQuery["variables"],
): Promise<TQuery["response"]> {
  return getServerHost().serverQuery(query, variables) as Promise<
    TQuery["response"]
  >;
}

/** Reads a fragment synchronously in a Server Component. */
export function useServerFragment<TKey extends KeyType | null | undefined>(
  fragment: GraphQLTaggedNode,
  fragmentRef: TKey,
): TKey extends KeyType ? KeyTypeData<TKey> : TKey {
  return getServerHost().useServerFragment(
    fragment,
    fragmentRef,
  ) as TKey extends KeyType ? KeyTypeData<TKey> : TKey;
}
