# Server Query Client Fragment Fails Before Its First Client Read

A client fragment handed off by a `@server` query defers a non-null field
whose resolver throws, so the request fails (as in Relay) and the handoff's
next chunk rejects. Server rendering of the card fails, so React renders the
card on the client after the rejection has arrived: the reader's first client
read already sees a failed handoff, and throws to the nearest error boundary
instead of rendering the missing field.

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
import { waitForGate } from "../RelayRscHost";

/** @gqlDirective on FRAGMENT_SPREAD | INLINE_FRAGMENT */
export function defer(args: { label?: string | null; if?: boolean | null }) {}

/** @gqlType */
class User {
  /** @gqlField */
  id: ID = "4";
  /** @gqlField */
  name: string = "Ada";
  /**
   * @gqlField
   * @killsParentOnException
   */
  async karma(): Promise<Int> {
    await waitForGate("fail");
    throw new Error("Karma service unavailable");
  }
}

/** @gqlQueryField */
export function viewer(): User {
  return new User();
}
```

## Karma Card

```tsx title="KarmaCard.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { KarmaCard_user$key } from "./__generated__/KarmaCard_user.graphql";
import type { KarmaCardDetails_user$key } from "./__generated__/KarmaCardDetails_user.graphql";

function Details(props: { user: KarmaCardDetails_user$key }) {
  const details = useFragment(
    graphql`
      fragment KarmaCardDetails_user on User {
        karma
      }
    `,
    props.user,
  );
  return <p>Karma: {String(details.karma)}</p>;
}

export default function KarmaCard(props: { user: KarmaCard_user$key }) {
  const user = useFragment(
    graphql`
      fragment KarmaCard_user on User {
        name
        ...KarmaCardDetails_user @defer(label: "karma")
      }
    `,
    props.user,
  );
  return (
    <section>
      <p>Card for {user.name}</p>
      <Details user={user} />
    </section>
  );
}
```

## Boundary

```tsx title="Boundary.tsx"
"use client";

import { Component, type ReactNode } from "react";

export default class Boundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error != null) {
      return <p role="alert">Card failed</p>;
    }
    return this.props.children;
  }
}
```

## Page

```tsx title="Page.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import Boundary from "./Boundary";
import KarmaCard from "./KarmaCard";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        viewer {
          name
          ...KarmaCard_user @alias(as: "card")
        }
      }
    `,
    {},
  );
  return (
    <main>
      <h1>{data.viewer?.name}</h1>
      <Boundary>
        <Suspense fallback={<p>Loading card...</p>}>
          {data.viewer != null ? <KarmaCard user={data.viewer.card} /> : null}
        </Suspense>
      </Boundary>
    </main>
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
wait "Ada"
wait "Loading card..."
release "fail"
wait "Card failed"
```
