# Server Query Error Reaches a Client Error Boundary

The `@server` query's root field throws, so the GraphQL response has no data
and `serverQuery` rejects. The rejection fails the Server Component; React
Flight serializes the error into the stream at that component's position, and
the browser rethrows it there, inside a Client Component error boundary. The
rest of the page renders normally.

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript",
  "featureFlags": {
    "enable_relay_rsc": true
  },
  "rscNodeType": {
    "name": "ReactNode",
    "path": "react"
  }
}
```

## Server

`@killsParentOnException` makes `account` non-null, so its error nulls the
whole response.

```ts title="server.ts"
import { ID, Int } from "grats";

/** @gqlType */
type Account = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  balance: Int;
};

/**
 * @gqlQueryField
 * @killsParentOnException
 */
export function account(): Account {
  throw new Error("Ledger unavailable");
}
```

## Page

```tsx title="Page.tsx"
import Balance from "./Balance";
import ErrorBoundary from "./ErrorBoundary";

export default function Page() {
  return (
    <main>
      <h1>Account</h1>
      <ErrorBoundary>
        <Balance />
      </ErrorBoundary>
    </main>
  );
}
```

## Balance

```tsx title="Balance.tsx"
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import type { BalanceQuery } from "./__generated__/BalanceQuery.graphql";

export default async function Balance() {
  const data = await serverQuery<BalanceQuery>(
    graphql`
      query BalanceQuery @server {
        account {
          balance
        }
      }
    `,
    {},
  );
  return <p>Balance: {data.account.balance}</p>;
}
```

## Error Boundary

```tsx title="ErrorBoundary.tsx"
"use client";

import { Component, type ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error != null) {
      return <p role="alert">Balance failed: {this.state.error.message}</p>;
    }
    return this.props.children;
  }
}
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "Balance failed: Ledger unavailable"
```
