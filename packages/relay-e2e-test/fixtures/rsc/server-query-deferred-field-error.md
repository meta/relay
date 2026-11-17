# Field Error in a Deferred Handed-Off Fragment

A field in a `@defer`red client fragment fails on the server. The server's
Relay Environment records the error with the deferred payload's records (see
`defer/field-error` for the same payload in the browser), and the handoff
carries it across the boundary with the data: the Client Component's
`@catch(to: RESULT)` sees the server's failed field, while its sibling field
renders normally.

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

```ts title="server.ts"
import { ID, Int } from "grats";

/** @gqlDirective on FRAGMENT_SPREAD | INLINE_FRAGMENT */
export function defer(args: { label?: string | null; if?: boolean | null }) {}

/** @gqlType */
class User {
  /** @gqlField */
  id: ID = "4";
  /** @gqlField */
  name: string = "Ada";
  /** @gqlField */
  handle: string = "@ada";
  /** @gqlField */
  karma(): Int {
    throw new Error("Karma service unavailable");
  }
}

/** @gqlQueryField */
export function viewer(): User {
  return new User();
}
```

## Page

```tsx title="Page.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import KarmaCard from "./KarmaCard";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        viewer {
          name
          ...KarmaCard_user @alias(as: "card") @defer
        }
      }
    `,
    {},
  );
  const viewer = data.viewer;
  if (viewer == null) {
    return <p>No viewer</p>;
  }
  return (
    <main>
      <h1>{viewer.name}</h1>
      <Suspense fallback={<p>Loading karma...</p>}>
        <KarmaCard user={viewer.card} />
      </Suspense>
    </main>
  );
}
```

## Karma Card

```tsx title="KarmaCard.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { KarmaCard_user$key } from "./__generated__/KarmaCard_user.graphql";

export default function KarmaCard(props: {
  user: KarmaCard_user$key | null | undefined;
}) {
  const user = useFragment(
    graphql`
      fragment KarmaCard_user on User {
        handle
        karma @catch(to: RESULT)
      }
    `,
    props.user,
  );
  if (user == null) {
    return null;
  }
  return (
    <section>
      <p>Card for {user.handle}</p>
      <p>
        {user.karma.ok ? `Karma: ${user.karma.value}` : "Karma failed"}
      </p>
    </section>
  );
}
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "Card for @ada"
wait "Karma failed"
```
